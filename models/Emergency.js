/**
 * Emergency Model (Rebuilt October 2025)
 * --------------------------------------
 * Stores SOS emergency alerts with a compact, well-defined schema.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

const STATUS_VALUES = ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'CANCELLED'];
const SEVERITY_VALUES = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
const TYPE_VALUES = ['SOS', 'ACCIDENT', 'MEDICAL', 'SAFETY', 'OTHER'];

const notificationSchema = new Schema({
    channel: {
        type: String,
        enum: ['EMAIL', 'SMS', 'PUSH'],
        required: true
    },
    target: {
        type: String,
        required: true
    },
    deliveredAt: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: Map,
        of: String,
        default: () => ({})
    }
}, { _id: false });

const contactSchema = new Schema({
    name: String,
    email: String,
    phone: String,
    notifiedAt: Date
}, { _id: false });

const emergencySchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: STATUS_VALUES,
        default: 'ACTIVE'
    },
    type: {
        type: String,
        enum: TYPE_VALUES,
        default: 'SOS'
    },
    severity: {
        type: String,
        enum: SEVERITY_VALUES,
        default: 'HIGH'
    },
    description: {
        type: String,
        default: 'Emergency alert sent by user'
    },
    location: {
        coordinates: {
            type: {
                type: String,
                enum: ['Point'],
                default: 'Point'
            },
            coordinates: {
                type: [Number],
                default: undefined
            }
        },
        address: {
            type: String,
            default: ''
        },
        accuracy: Number
    },
    deviceInfo: {
        userAgent: String,
        platform: String,
        language: String
    },
    triggeredAt: {
        type: Date,
        default: Date.now
    },
    acknowledgedAt: Date,
    resolvedAt: Date,
    cancelledAt: Date,
    responder: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    adminNotes: {
        type: String,
        default: ''
    },
    escalation: {
        level: { type: Number, default: 0 },          // 0 = not escalated, 1 = supervisory, 2 = critical/external
        escalatedAt: { type: Date },
        escalatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, default: '' },
        notifiedTo: [{ type: String }],              // e.g. 'admin:email@x.com', 'contact:name'
    },
    contacts: [contactSchema],
    notifications: [notificationSchema]
}, {
    timestamps: true
});

// Virtuals
emergencySchema.virtual('isOpen').get(function isOpen() {
    return this.status === 'ACTIVE' || this.status === 'ACKNOWLEDGED';
});

// Instance helpers
emergencySchema.methods.markAcknowledged = function markAcknowledged(responderId, note = '') {
    this.status = 'ACKNOWLEDGED';
    this.acknowledgedAt = new Date();
    this.responder = responderId;
    if (note) {
        this.adminNotes = note;
    }
    return this.save();
};

emergencySchema.methods.markResolved = function markResolved(responderId, note = '') {
    this.status = 'RESOLVED';
    this.resolvedAt = new Date();
    this.responder = responderId;
    if (note) {
        this.adminNotes = note;
    }
    return this.save();
};

emergencySchema.methods.markCancelled = function markCancelled(responderId, note = '') {
    this.status = 'CANCELLED';
    this.cancelledAt = new Date();
    this.responder = responderId;
    if (note) {
        this.adminNotes = note;
    }
    return this.save();
};

// Static helpers
emergencySchema.statics.getOpenEmergencyForUser = function getOpenEmergencyForUser(userId) {
    return this.findOne({
        user: userId,
        status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] }
    }).sort({ triggeredAt: -1 });
};

emergencySchema.statics.getStats = async function getStats({ start, end } = {}) {
    const match = {};
    if (start || end) {
        match.triggeredAt = {};
        if (start) match.triggeredAt.$gte = start;
        if (end) match.triggeredAt.$lte = end;
    }

    const stats = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgResolutionMinutes: {
                    $avg: {
                        $cond: [
                            { $and: ['$resolvedAt', '$triggeredAt'] },
                            { $divide: [{ $subtract: ['$resolvedAt', '$triggeredAt'] }, 1000 * 60] },
                            null
                        ]
                    }
                }
            }
        }
    ]);

    const summary = stats.reduce((acc, item) => {
        acc[item._id] = {
            count: item.count,
            avgResolutionMinutes: item.avgResolutionMinutes || 0
        };
        return acc;
    }, {});

    summary.total = stats.reduce((total, item) => total + item.count, 0);
    return summary;
};

// 2dsphere index for geospatial queries ($near in trackingControllerEnhanced)
emergencySchema.index({ 'location.coordinates': '2dsphere' });
emergencySchema.index({ user: 1, status: 1 });
emergencySchema.index({ status: 1, triggeredAt: -1 });

module.exports = mongoose.model('Emergency', emergencySchema);
