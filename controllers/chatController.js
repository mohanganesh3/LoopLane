/**
 * Chat Controller
 * Handles real-time messaging between riders and passengers
 */

const Chat = require('../models/Chat');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

/**
 * Get or create chat for a booking
 */
exports.getOrCreateChat = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    
    console.log('🔵 [Chat] Get/Create chat for booking:', bookingId);
    console.log('🔵 [Chat] User:', req.user._id, req.user.name);

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
        console.error('❌ [Chat] Booking not found:', bookingId);
        throw new AppError('Booking not found', 404);
    }
    
    console.log('✅ [Chat] Booking found:', {
        id: booking._id,
        passenger: booking.passenger?.profile?.firstName,
        rider: booking.rider?.profile?.firstName,
        status: booking.status
    });

    // Check if user is part of this booking
    const isParticipant = 
        booking.passenger._id.toString() === req.user._id.toString() ||
        booking.rider._id.toString() === req.user._id.toString();

    if (!isParticipant) {
        console.error('❌ [Chat] User not authorized:', req.user._id);
        throw new AppError('Not authorized', 403);
    }
    
    console.log('✅ [Chat] User is participant');

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
        console.log('🔵 [Chat] Chat not found, creating new chat');
        chat = await Chat.create({
            booking: bookingId,
            participants: [booking.passenger._id, booking.rider._id]
        });
        
        console.log('✅ [Chat] Chat created:', chat._id);
        
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
        console.log('✅ [Chat] Existing chat found:', chat._id);
    }

    console.log('✅ [Chat] Returning chat to client');
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
    
    console.log('🔵 [Messages] Get messages for chat:', chatId);
    console.log('🔵 [Messages] User:', req.user._id);

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
    
    console.log('✅ [Messages] Chat found with', chat.messages.length, 'messages');

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
    
    console.log('✅ [Messages] Returning', messages.length, 'messages');

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
    
    console.log('🔵 [Send Message] Chat:', chatId);
    console.log('🔵 [Send Message] User:', req.user._id, req.user.name);
    console.log('🔵 [Send Message] Content preview:', content?.substring(0, 50));

    // Validate content type
    if (!content || typeof content !== 'string') {
        console.error('❌ [Send Message] Invalid content type');
        throw new AppError('Message content is required', 400);
    }

    // Trim and validate content
    const trimmedContent = content.trim();
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
    
    console.log('✅ [Send Message] Chat found');

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
    console.log('✅ [Send Message] Message added to chat');

    // Reload with populated data
    await chat.populate('messages.sender', 'profile email phone');

    const newMessage = chat.messages[chat.messages.length - 1];
    console.log('✅ [Send Message] New message ID:', newMessage._id);

    // Emit socket event to chat room
    const io = req.app.get('io');
    if (io) {
        const chatIdStr = chat._id.toString();
        console.log('🔵 [Send Message] Emitting to chat room: chat-' + chatIdStr);
        console.log('🔵 [Send Message] Message content:', content.trim().substring(0, 50));
        
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
                    profilePhoto: newMessage.sender.profilePhoto || req.user.profilePhoto
                },
                timestamp: newMessage.timestamp,
                type: newMessage.type
            }
        });
        
        console.log('✅ [Send Message] Emitted to chat room successfully');

        // Notify other participants (for notifications)
        const otherParticipants = chat.participants.filter(
            p => p._id.toString() !== req.user._id.toString()
        );

        console.log('🔵 [Send Message] Notifying', otherParticipants.length, 'other participants');
        otherParticipants.forEach(participant => {
            console.log('🔵 [Send Message] Sending notification to user-' + participant._id);
            io.to(`user-${participant._id}`).emit('chat-notification', {
                chatId: chatIdStr,
                message: newMessage,
                sender: {
                    _id: req.user._id,
                    name: User.getUserName(req.user),
                    profilePhoto: req.user.profilePhoto
                }
            });
        });
    } else {
        console.error('❌ [Send Message] Socket.IO not available!');
    }

    console.log('✅ [Send Message] Message sent successfully');
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
 * Show chat page
 * GET /chat/:idOrChatId
 * Accepts chatId, bookingId, or rideId
 */
exports.showChatPage = asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    
    console.log('🔵 [Chat Page] Loading chat page for:', chatId);
    console.log('🔵 [Chat Page] User:', req.user._id, req.user.name);

    let currentChat = null;
    
    if (chatId && chatId !== 'new') {
        // Try to find as chat ID first
        currentChat = await Chat.findById(chatId)
            .populate({
                path: 'participants',
                select: 'profile email phone'
            })
            .populate('booking')
            .populate({
                path: 'messages.sender',
                select: 'profile'
            });

        // If not found as chat, try as booking ID
        if (!currentChat) {
            console.log('🔵 [Chat Page] Not a chat ID, trying as booking ID...');
            const booking = await Booking.findById(chatId);
            
            if (booking) {
                console.log('✅ [Chat Page] Found booking, looking for chat...');
                currentChat = await Chat.findOne({ booking: booking._id })
                    .populate({
                        path: 'participants',
                        select: 'profile email phone'
                    })
                    .populate('booking')
                    .populate({
                        path: 'messages.sender',
                        select: 'profile'
                    });
                
                // If no chat exists, create one
                if (!currentChat) {
                    console.log('🔵 [Chat Page] No chat for booking, creating...');
                    const newChat = await Chat.create({
                        booking: booking._id,
                        participants: [booking.passenger, booking.rider]
                    });
                    
                    currentChat = await Chat.findById(newChat._id)
                        .populate({
                            path: 'participants',
                            select: 'profile email phone'
                        })
                        .populate('booking')
                        .populate({
                            path: 'messages.sender',
                            select: 'profile'
                        });
                        
                    console.log('✅ [Chat Page] Chat created:', currentChat._id);
                }
            }
        }

        // If still not found, try as ride ID
        if (!currentChat) {
            console.log('🔵 [Chat Page] Not a booking ID, trying as ride ID...');
            const ride = await Ride.findById(chatId);
            
            if (ride) {
                console.log('✅ [Chat Page] Found ride, looking for user booking...');
                // Find user's booking for this ride
                const booking = await Booking.findOne({
                    ride: ride._id,
                    $or: [
                        { passenger: req.user._id },
                        { rider: req.user._id }
                    ],
                    status: { $in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }
                }).sort({ createdAt: -1 }); // Get most recent booking
                
                if (booking) {
                    console.log('✅ [Chat Page] Found booking for ride:', booking._id);
                    // Find or create chat for this booking
                    currentChat = await Chat.findOne({ booking: booking._id })
                        .populate({
                            path: 'participants',
                            select: 'profile email phone'
                        })
                        .populate('booking')
                        .populate({
                            path: 'messages.sender',
                            select: 'profile'
                        });
                    
                    if (!currentChat) {
                        console.log('🔵 [Chat Page] Creating chat for booking...');
                        const newChat = await Chat.create({
                            booking: booking._id,
                            participants: [booking.passenger, booking.rider]
                        });
                        
                        currentChat = await Chat.findById(newChat._id)
                            .populate({
                                path: 'participants',
                                select: 'profile email phone'
                            })
                            .populate('booking')
                            .populate({
                                path: 'messages.sender',
                                select: 'profile'
                            });
                            
                        console.log('✅ [Chat Page] Chat created:', currentChat._id);
                    }
                }
            }
        }

        if (!currentChat) {
            console.log('⚠️ [Chat Page] No chat found, redirecting to /chat/new');
            return res.redirect('/chat/new');
        }
        
        console.log('✅ [Chat Page] Chat found:', currentChat._id);

        // Check authorization
        const isParticipant = currentChat.participants.some(
            p => p._id.toString() === req.user._id.toString()
        );

        if (!isParticipant) {
            console.error('❌ [Chat Page] User not authorized');
            req.flash('error', 'You are not authorized to view this chat');
            return res.redirect('/chat');
        }

        // Mark as read
        await currentChat.markAsRead(req.user._id);
        console.log('✅ [Chat Page] Messages marked as read');
    }

    // Get all user chats for sidebar
    const allChats = await Chat.find({
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
        select: 'profile'
    })
    .sort({ lastMessageAt: -1 });
    
    console.log('✅ [Chat Page] Found', allChats.length, 'chats for sidebar');

    // Add unread count to each chat
    const allChatsWithUnread = allChats.map(chat => {
        const chatObj = chat.toObject({ virtuals: true });
        chatObj.unreadCount = chat.getUnreadCount(req.user._id);
        console.log(`🔵 [Chat ${chat._id}] Unread count:`, chatObj.unreadCount);
        return chatObj;
    });

    console.log('✅ [Chat Page] Rendering chat page');
    res.render('chat/index', {
        title: 'Messages - LANE Carpool',
        user: req.user,
        currentChat,
        allChats: allChatsWithUnread
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
    message.isDeleted = true;
    message.content = 'This message was deleted';
    await chat.save();

    res.status(200).json({
        success: true,
        message: 'Message deleted'
    });
});

// Check if user has any unread messages across all chats (returns boolean)
exports.getTotalUnreadCount = asyncHandler(async (req, res) => {
    console.log('🔵 [Unread Check] Checking for unread messages for user:', req.user._id);

    // Get all chats for user
    const chats = await Chat.find({
        participants: req.user._id,
        isActive: true
    });

    console.log('🔵 [Unread Check] Found', chats.length, 'active chats');

    // Check if any chat has unread messages
    let hasUnread = false;
    for (const chat of chats) {
        if (chat.hasUnreadMessages(req.user._id)) {
            hasUnread = true;
            console.log(`🔵 [Chat ${chat._id}] Has unread messages`);
            break; // No need to check further
        }
    }

    console.log('✅ [Unread Check] Has unread:', hasUnread);

    res.status(200).json({
        success: true,
        hasUnread: hasUnread,
        unreadCount: hasUnread ? 1 : 0 // Keep for backward compatibility
    });
});
