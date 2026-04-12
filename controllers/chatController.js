/**
 * Chat Controller
 * Handles real-time messaging between riders and passengers
 */

const Chat = require('../models/Chat');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

const getUserPhoto = (user) => user?.profile?.photo || user?.profilePhoto || null;

/**
 * Get or create chat for a booking
 */
exports.getOrCreateChat = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    

    // Get booking and validate
    const booking = await Booking.findById(bookingId)
        .populate({
            path: 'passenger',
            select: 'profile email phone'
        })
        .populate({
            path: 'rider',
            select: 'profile email phone'
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Check if user is part of this booking
    const isParticipant = 
        booking.passenger._id.toString() === req.user._id.toString() ||
        booking.rider._id.toString() === req.user._id.toString();

    if (!isParticipant) {
        console.error('❌ [Chat] User not authorized:', req.user._id);
        throw new AppError('Not authorized', 403);
    }
    

    // Find existing chat or create new one
    let chat = await Chat.findOne({ booking: bookingId })
        .populate({
            path: 'participants',
            select: 'profile email phone'
        })
        .populate('booking')
        .populate({
            path: 'messages.sender',
            select: 'profile'
        });

    if (!chat) {
        chat = await Chat.create({
            booking: bookingId,
            participants: [booking.passenger._id, booking.rider._id]
        });
        
        
        chat = await Chat.findById(chat._id)
            .populate({
                path: 'participants',
                select: 'profile email phone'
            })
            .populate('booking')
            .populate({
                path: 'messages.sender',
                select: 'profile'
            });
    } else {
    }

    res.status(200).json({
        success: true,
        chat
    });
});

/**
 * Get chat by ID
 */
exports.getChatById = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId)
        .populate({
            path: 'participants',
            select: 'profile email phone'
        })
        .populate({
            path: 'messages.sender',
            select: 'profile email phone'
        });

    if (!chat) {
        throw new AppError('Chat not found', 404);
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
        p => p._id.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
        throw new AppError('Not authorized', 403);
    }

    // Mark messages as read
    await chat.markAsRead(req.user._id);

    res.status(200).json({
        success: true,
        chat
    });
});

/**
 * Get all chats for user
 */
exports.getUserChats = asyncHandler(async (req, res) => {
    const chats = await Chat.find({
        participants: req.user._id,
        isActive: true
    })
    .populate({
        path: 'participants',
        select: 'profile email phone'
    })
    .populate('booking')
    .populate({
        path: 'messages.sender',
        select: 'profile email phone'
    })
    .sort({ lastMessageAt: -1 });

    // Calculate unread status (boolean) and add to each chat
    const chatsWithUnread = chats.map(chat => {
        const chatObj = chat.toObject({ virtuals: true });
        // Use hasUnread boolean instead of count for cleaner UI
        chatObj.hasUnread = chat.hasUnreadMessages(req.user._id);
        chatObj.unreadCount = chatObj.hasUnread ? 1 : 0; // Keep for backward compatibility
        return chatObj;
    });

    res.status(200).json({
        success: true,
        chats: chatsWithUnread
    });
});

/**
 * Get messages for a chat
 */
exports.getChatMessages = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    

    const chat = await Chat.findById(chatId)
        .populate({
            path: 'messages.sender',
            select: 'profile email phone'
        })
        .populate({
            path: 'participants',
            select: 'profile email phone'
        });

    if (!chat) {
        console.error('❌ [Messages] Chat not found:', chatId);
        throw new AppError('Chat not found', 404);
    }
    

    // Check if user is participant
    const isParticipant = chat.participants.some(
        p => p._id.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
        console.error('❌ [Messages] User not authorized');
        throw new AppError('Not authorized', 403);
    }

    // Filter out deleted messages (for this user)
    const messages = chat.messages.filter(msg => 
        !msg.deleted || !msg.deletedBy.some(u => u.toString() === req.user._id.toString())
    );
    

    res.status(200).json({
        success: true,
        messages
    });
});

/**
 * Send message
 */
exports.sendMessage = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const { content, type = 'TEXT', location } = req.body;
    

    // Validate content type
    if (!content || typeof content !== 'string') {
        console.error('❌ [Send Message] Invalid content type');
        throw new AppError('Message content is required', 400);
    }

    // Trim, validate, and sanitize content
    const trimmedContent = content.trim().replace(/<[^>]*>/g, ''); // Strip HTML tags
    if (trimmedContent.length === 0) {
        console.error('❌ [Send Message] Empty content after trim');
        throw new AppError('Message content is required', 400);
    }

    // Validate max length
    const MAX_MESSAGE_LENGTH = 5000;
    if (trimmedContent.length > MAX_MESSAGE_LENGTH) {
        console.error('❌ [Send Message] Content too long:', trimmedContent.length);
        throw new AppError(`Message content too long (max ${MAX_MESSAGE_LENGTH} characters)`, 400);
    }

    const chat = await Chat.findById(chatId)
        .populate({
            path: 'participants',
            select: 'profile email phone'
        })
        .populate('booking');

    if (!chat) {
        console.error('❌ [Send Message] Chat not found:', chatId);
        throw new AppError('Chat not found', 404);
    }
    

    // Check if user is participant
    const isParticipant = chat.participants.some(
        p => p._id.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
        console.error('❌ [Send Message] User not authorized');
        throw new AppError('Not authorized', 403);
    }

    // Add message with trimmed content
    await chat.addMessage(req.user._id, trimmedContent, type, location);

    // Reload with populated data
    await chat.populate('messages.sender', 'profile email phone');

    const newMessage = chat.messages[chat.messages.length - 1];

    // Emit socket event to chat room
    const io = req.app.get('io');
    if (io) {
        const chatIdStr = chat._id.toString();
        
        // Get sender name safely
        const senderName = User.getUserName(newMessage.sender) || User.getUserName(req.user);
        
        // Emit to chat room (for real-time display)
        io.to(`chat-${chatIdStr}`).emit('new-message', {
            chatId: chatIdStr,
            message: {
                _id: newMessage._id.toString(),
                content: newMessage.content,
                sender: {
                    _id: newMessage.sender._id || req.user._id,
                    name: senderName,
                    profilePhoto: getUserPhoto(newMessage.sender) || getUserPhoto(req.user)
                },
                timestamp: newMessage.timestamp,
                type: newMessage.type
            }
        });
        

        // Notify other participants (for notifications)
        const otherParticipants = chat.participants.filter(
            p => p._id.toString() !== req.user._id.toString()
        );

        otherParticipants.forEach(participant => {
            io.to(`user-${participant._id}`).emit('chat-notification', {
                chatId: chatIdStr,
                message: newMessage,
                sender: {
                    _id: req.user._id,
                    name: User.getUserName(req.user),
                    profilePhoto: getUserPhoto(req.user)
                }
            });
        });
    } else {
        console.error('❌ [Send Message] Socket.IO not available!');
    }

    res.status(200).json({
        success: true,
        message: newMessage
    });
});

/**
 * Mark chat as read
 */
exports.markChatAsRead = asyncHandler(async (req, res) => {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId).populate('participants', '_id');

    if (!chat) {
        throw new AppError('Chat not found', 404);
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
        p => p._id.toString() === req.user._id.toString()
    );

    if (!isParticipant) {
        throw new AppError('Not authorized', 403);
    }

    await chat.markAsRead(req.user._id);

    // ✅ Emit read receipt to other participants so they see double-tick
    const io = req.app.get('io');
    if (io) {
        const otherParticipants = chat.participants.filter(
            p => p._id.toString() !== req.user._id.toString()
        );
        
        otherParticipants.forEach(participant => {
            io.to(`user-${participant._id}`).emit('messages-read', {
                chatId: chatId,
                readBy: req.user._id,
                readAt: new Date()
            });
        });
        
        // Also emit to chat room
        io.to(`chat-${chatId}`).emit('messages-read', {
            chatId: chatId,
            readBy: req.user._id,
            readAt: new Date()
        });
    }

    res.status(200).json({
        success: true,
        message: 'Messages marked as read'
    });
});

/**
 * Delete message
 */
exports.deleteMessage = asyncHandler(async (req, res) => {
    const { chatId, messageId } = req.params;

    const chat = await Chat.findById(chatId);

    if (!chat) {
        throw new AppError('Chat not found', 404);
    }

    const message = chat.messages.id(messageId);

    if (!message) {
        throw new AppError('Message not found', 404);
    }

    // Only sender can delete
    if (message.sender.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    // Soft delete (mark as deleted, don't remove)
    message.deleted = true;
    message.content = 'This message was deleted';
    await chat.save();

    res.status(200).json({
        success: true,
        message: 'Message deleted'
    });
});

// Check if user has any unread messages across all chats (returns boolean)
exports.getTotalUnreadCount = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Use aggregation to efficiently check for unread messages
    // Only checks if at least one qualifying message exists — no full doc loading
    const result = await Chat.aggregate([
        { $match: { participants: userId, isActive: true } },
        { $project: {
            hasUnread: {
                $gt: [
                    { $size: {
                        $filter: {
                            input: '$messages',
                            as: 'msg',
                            cond: {
                                $and: [
                                    { $ne: ['$$msg.sender', userId] },
                                    { $not: { $in: [userId, { $ifNull: ['$$msg.readBy', []] }] } }
                                ]
                            }
                        }
                    }},
                    0
                ]
            }
        }},
        { $match: { hasUnread: true } },
        { $limit: 1 }
    ]);

    const hasUnread = result.length > 0;

    res.status(200).json({
        success: true,
        hasUnread,
        unreadCount: hasUnread ? 1 : 0
    });
});

/**
 * Get chats for a specific ride (via bookings belonging to that ride)
 */
exports.getChatsByRide = asyncHandler(async (req, res) => {
    const { rideId } = req.params;

    // Find bookings for this ride that the user participates in
    const bookingIds = await Booking.find({ ride: rideId })
        .select('_id')
        .lean()
        .then(docs => docs.map(d => d._id));

    if (!bookingIds.length) {
        return res.status(200).json({ success: true, chats: [] });
    }

    const chats = await Chat.find({
        booking: { $in: bookingIds },
        participants: req.user._id,
        isActive: true
    })
    .populate({ path: 'participants', select: 'profile email phone' })
    .populate('booking')
    .populate({ path: 'messages.sender', select: 'profile email phone' })
    .sort({ lastMessageAt: -1 });

    const chatsWithUnread = chats.map(chat => {
        const chatObj = chat.toObject({ virtuals: true });
        chatObj.hasUnread = chat.hasUnreadMessages(req.user._id);
        chatObj.unreadCount = chatObj.hasUnread ? 1 : 0;
        return chatObj;
    });

    res.status(200).json({ success: true, chats: chatsWithUnread });
});
