/**
 * Chat Model
 * Stores chat messages between riders and passengers
 */

const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    // Reference to Booking
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
        unique: true
    },
    
    // Participants (rider and passenger)
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    
    // Messages
    messages: [{
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        content: {
            type: String,
            required: true,
            maxlength: 1000
        },
        type: {
            type: String,
            enum: ['TEXT', 'LOCATION', 'QUICK_REPLY', 'SYSTEM'],
            default: 'TEXT'
        },
        // Location data (if type is LOCATION)
        location: {
            coordinates: [Number],
            address: String
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        // Read receipts
        readBy: [{
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            readAt: Date
        }],
        // Soft delete
        deleted: {
            type: Boolean,
            default: false
        },
        deletedBy: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }]
    }],
    
    // Last message timestamp (for sorting)
    lastMessageAt: {
        type: Date,
        default: Date.now
    },
    
    // Typing indicator
    typing: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        timestamp: Date
    }],
    
    // Chat Status
    isActive: {
        type: Boolean,
        default: true
    },
    archivedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // Moderation
    flagged: {
        type: Boolean,
        default: false
    },
    flaggedReason: String,
    flaggedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
    
}, {
    timestamps: true
});

// Indexes
chatSchema.index({ booking: 1 });
chatSchema.index({ participants: 1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ 'messages.timestamp': -1 });

// Method to add message
chatSchema.methods.addMessage = function(senderId, content, type = 'TEXT', locationData = null) {
    const message = {
        sender: senderId,
        content,
        type,
        timestamp: new Date()
    };
    
    if (type === 'LOCATION' && locationData) {
        message.location = locationData;
    }
    
    this.messages.push(message);
    this.lastMessageAt = new Date();
    
    return this.save();
};

// Method to mark messages as read
// ✅ EDGE CASE FIX: Uses atomic update to prevent race conditions
chatSchema.methods.markAsRead = async function(userId) {
    const Chat = this.constructor;
    const userIdStr = userId.toString();
    
    console.log(`📖 [markAsRead] Marking messages as read for user: ${userIdStr} in chat: ${this._id}`);
    
    // Use updateOne with arrayFilters to update all unread messages atomically
    const result = await Chat.updateOne(
        { _id: this._id },
        {
            $addToSet: {
                'messages.$[unreadMsg].readBy': {
                    user: userId,
                    readAt: new Date()
                }
            }
        },
        {
            arrayFilters: [
                {
                    'unreadMsg.sender': { $ne: userId },
                    'unreadMsg.readBy.user': { $ne: userId }
                }
            ]
        }
    );
    
    console.log(`📖 [markAsRead] Update result:`, {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount
    });
    
    // Reload the document to get fresh data
    const updatedChat = await Chat.findById(this._id);
    if (updatedChat) {
        this.messages = updatedChat.messages;
    }
    
    return this;
};

// Method to check if user has any unread messages (messages not in readBy array)
chatSchema.methods.hasUnreadMessages = function(userId) {
    return this.messages.some(msg => {
        return msg.sender.toString() !== userId.toString() &&
               !msg.readBy.some(r => r.user.toString() === userId.toString()) &&
               !msg.deleted;
    });
};

// Method to get unread count for a user
chatSchema.methods.getUnreadCount = function(userId) {
    return this.messages.filter(msg => {
        return msg.sender.toString() !== userId.toString() &&
               !msg.readBy.some(r => r.user.toString() === userId.toString()) &&
               !msg.deleted;
    }).length;
};

// Virtual for last message
chatSchema.virtual('lastMessage').get(function() {
    if (this.messages.length === 0) return null;
    const activeMessages = this.messages.filter(m => !m.deleted);
    return activeMessages[activeMessages.length - 1];
});

module.exports = mongoose.model('Chat', chatSchema);
