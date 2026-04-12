const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    // Who performed the action
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    actorRole: {
        type: String,
        enum: ['ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'CONTENT_MODERATOR', 'FLEET_MANAGER', 'SYSTEM'],
        required: true
    },
    actorName: String,
    actorEmail: String,

    // What was done
    action: {
        type: String,
        required: true,
        enum: [
            // User management
            'USER_CREATED', 'USER_UPDATED', 'USER_SUSPENDED', 'USER_ACTIVATED', 'USER_DELETED',
            'USER_ROLE_CHANGED', 'USER_VERIFIED', 'USER_REJECTED',
            'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED',
            // Employee management
            'EMPLOYEE_CREATED', 'EMPLOYEE_UPDATED', 'EMPLOYEE_DEACTIVATED', 'EMPLOYEE_PERMISSIONS_CHANGED',
            // Ride management
            'RIDE_CANCELLED', 'RIDE_UPDATED',
            // Booking management
            'BOOKING_REFUNDED', 'BOOKING_CANCELLED',
            // Report management
            'REPORT_REVIEWED', 'REPORT_RESOLVED', 'REPORT_ESCALATED', 'REPORT_ACTION',
            // Financial
            'PAYOUT_PROCESSED', 'REFUND_ISSUED', 'COMMISSION_UPDATED',
            // Settings
            'SETTINGS_UPDATED', 'SYSTEM_CONFIG_CHANGED',
            // Emergency
            'EMERGENCY_RESOLVED', 'EMERGENCY_ESCALATED',
            // Other
            'OTHER'
        ]
    },

    // What was affected
    targetType: {
        type: String,
        enum: ['User', 'Ride', 'Booking', 'Report', 'Transaction', 'Settings', 'Emergency', 'System'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId
    },

    // Description 
    description: {
        type: String,
        required: true
    },

    // Before/after values for auditing changes
    changes: {
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed
    },

    // Request metadata
    metadata: {
        ipAddress: String,
        userAgent: String,
        endpoint: String,
        method: String
    },

    // Severity level
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'LOW'
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ severity: 1 });

// Static helper to create audit entries easily
auditLogSchema.statics.log = async function(req, { action, targetType, targetId, description, changes, severity }) {
    try {
        return await this.create({
            actor: req.user?._id,
            actorRole: req.user?.role || 'SYSTEM',
            actorName: req.user?.profile?.firstName ? `${req.user.profile.firstName} ${req.user.profile.lastName || ''}`.trim() : req.user?.email,
            actorEmail: req.user?.email,
            action,
            targetType,
            targetId,
            description,
            changes,
            severity: severity || 'LOW',
            metadata: {
                ipAddress: req.ip || req.connection?.remoteAddress,
                userAgent: req.get('user-agent'),
                endpoint: req.originalUrl,
                method: req.method
            }
        });
    } catch (err) {
        console.error('Failed to create audit log:', err.message);
    }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
