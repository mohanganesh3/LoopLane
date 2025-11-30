/**
 * Notification Model
 * Stores in-app notifications for users
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // User who receives the notification (optional for broadcast to admins)
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false
    },
    
    // Notification Type
    type: {
        type: String,
        required: true,
        enum: [
            'BOOKING_REQUEST',
            'BOOKING_CONFIRMED',
            'BOOKING_ACCEPTED',        // Alias for BOOKING_CONFIRMED
            'BOOKING_REJECTED',
            'BOOKING_CANCELLED',
            'BOOKING_REASSIGNED',      // NEW: Auto-reassignment successful
            'NEW_BOOKING_REASSIGNED',  // NEW: Rider receives reassigned passenger
            'RIDE_STARTING',
            'RIDE_STARTED',
            'RIDE_COMPLETED',
            'RIDE_CANCELLED',
            'RIDE_CANCELLED_NO_ALTERNATIVE', // NEW: Ride cancelled, no alternatives
            'PICKUP_CONFIRMED',        // New: Pickup OTP verified
            'DROPOFF_CONFIRMED',       // New: Dropoff OTP verified
            'JOURNEY_COMPLETED',       // New: Individual journey done
            'PAYMENT_RECEIVED',
            'PAYMENT_PENDING',         // New: Payment reminder
            'PAYMENT_REFUNDED',        // New: Payment refunded
            'REVIEW_RECEIVED',
            'REVIEW_REMINDER',         // New: Prompt to review
            'MESSAGE_RECEIVED',
            'DOCUMENT_APPROVED',
            'DOCUMENT_REJECTED',
            'SOS_ALERT',
            'ROUTE_DEVIATION',
            'VERIFICATION_REQUEST',
            'VERIFICATION_COMPLETE',
            'VERIFICATION_APPROVED',
            'VERIFICATION_REJECTED',
            'ACCOUNT_SUSPENDED',
            'ACCOUNT_ACTIVATED',
            'ACCOUNT_BANNED',
            'WARNING',
            'NEW_REPORT',              // New: User report filed
            'REPORT_RESOLVED',
            'SYSTEM_ALERT',            // New: System alerts/warnings
            'PRICE_DROP',
            'SYSTEM_UPDATE',
            'ADMIN_MESSAGE'
        ]
    },
    
    // Notification Content
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    
    // Additional Data (context-specific)
    data: {
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking'
        },
        rideId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ride'
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        emergencyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Emergency'
        },
        url: String, // Link to relevant page
        actionRequired: Boolean
    },
    
    // Read Status
    read: {
        type: Boolean,
        default: false
    },
    readAt: Date,
    
    // Delivery Channels
    channels: {
        email: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: false },
        inApp: { type: Boolean, default: true }
    },
    
    // Sent Status
    sentAt: Date,
    emailSent: { type: Boolean, default: false },
    smsSent: { type: Boolean, default: false },
    pushSent: { type: Boolean, default: false },
    
    // Priority
    priority: {
        type: String,
        enum: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
        default: 'NORMAL'
    },
    
    // Expiry
    expiresAt: Date
    
}, {
    timestamps: true
});

// Indexes
notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-delete expired

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId) {
    return this.countDocuments({ user: userId, read: false });
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = function(userId) {
    return this.updateMany(
        { user: userId, read: false },
        { read: true, readAt: new Date() }
    );
};

// Method to mark as read
notificationSchema.methods.markAsRead = function() {
    this.read = true;
    this.readAt = new Date();
    return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
