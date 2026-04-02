/**
 * Report Model
 * Stores reports filed by users against other users
 */

const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    // Reporter and Reported User
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reportedUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Related Booking
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    },
    
    // Related Ride
    ride: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride'
    },
    
    // Report Category
    category: {
        type: String,
        required: true,
        enum: [
            'RECKLESS_DRIVING',
            'HARASSMENT',
            'INAPPROPRIATE_BEHAVIOR',
            'VEHICLE_MISMATCH',
            'SMOKING',
            'UNSAFE_VEHICLE',
            'ROUTE_DEVIATION',
            'OVERCHARGING',
            'FAKE_PROFILE',
            'NO_SHOW',
            'RUDE_BEHAVIOR',
            'VEHICLE_DAMAGE',
            'PAYMENT_DISPUTE',
            'OTHER'
        ]
    },
    
    // Severity
    severity: {
        type: String,
        required: true,
        enum: ['LOW', 'MEDIUM', 'HIGH'],
        default: 'MEDIUM'
    },
    
    // Description
    description: {
        type: String,
        required: true,
        minlength: 50,
        maxlength: 1000
    },
    
    // Evidence (photos, screenshots)
    evidence: [String],
    
    // Status
    status: {
        type: String,
        enum: ['PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED', 'ESCALATED'],
        default: 'PENDING'
    },
    
    // Admin Review
    adminReview: {
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reviewedAt: Date,
        notes: String,
        action: {
            type: String,
            enum: [
                'NO_ACTION',
                'WARNING_ISSUED',
                'TEMPORARY_SUSPENSION',
                'PERMANENT_BAN',
                'REFUND_ISSUED',
                'FURTHER_INVESTIGATION'
            ]
        },
        actionDate: Date,
        actionDetails: String
    },
    
    // Refund Request
    refundRequested: {
        type: Boolean,
        default: false
    },
    refundAmount: Number,
    refundStatus: {
        type: String,
        enum: ['NOT_REQUESTED', 'PENDING', 'APPROVED', 'REJECTED', 'PROCESSED']
    },
    
    // Communication
    messages: [{
        from: {
            type: String,
            enum: ['REPORTER', 'ADMIN']
        },
        message: String,
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    
    // Resolution
    resolution: {
        resolved: { type: Boolean, default: false },
        resolvedAt: Date,
        outcome: String
    },

    // D7: Structured Dispute Resolution
    dispute: {
        isDispute: { type: Boolean, default: false },
        disputeType: {
            type: String,
            enum: ['FARE_DISPUTE', 'SERVICE_QUALITY', 'DAMAGE_CLAIM', 'SAFETY_CONCERN', 'REFUND_REQUEST', 'OTHER']
        },
        claimedAmount: Number,
        evidence: [{
            type: { type: String, enum: ['PHOTO', 'SCREENSHOT', 'RECEIPT', 'VIDEO'] },
            url: String,
            description: String,
            uploadedAt: { type: Date, default: Date.now }
        }],
        counterResponse: {
            respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            response: String,
            evidence: [String],
            respondedAt: Date
        },
        mediationNotes: String,
        outcome: {
            type: String,
            enum: ['PENDING', 'RULED_FOR_REPORTER', 'RULED_FOR_REPORTED', 'MUTUAL_AGREEMENT', 'ESCALATED']
        }
    },

    // D8: SLA Tracking
    sla: {
        priority: {
            type: String,
            enum: ['P1', 'P2', 'P3', 'P4'],
            default: 'P3'
        },
        firstResponseDeadline: Date,
        resolutionDeadline: Date,
        firstResponseAt: Date,
        firstResponseBreached: { type: Boolean, default: false },
        resolutionBreached: { type: Boolean, default: false },
        responseTimeMinutes: Number,
        resolutionTimeMinutes: Number
    },

    // Trust & Safety: Investigation Lifecycle (Uber/Lyft-style)
    investigation: {
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        assignedAt: Date,
        tier: {
            type: String,
            enum: ['T1_CRITICAL', 'T2_MAJOR', 'T3_MINOR', 'T4_COSMETIC']
        },
        tierAutoAssigned: { type: Boolean, default: true },
        timeline: [{
            event: { type: String, required: true },
            performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            timestamp: { type: Date, default: Date.now },
            details: String,
            isAutomatic: { type: Boolean, default: false }
        }],
        contactAttempts: [{
            method: { type: String, enum: ['IN_APP', 'EMAIL', 'SMS', 'PHONE'] },
            target: { type: String, enum: ['REPORTER', 'REPORTED_USER'] },
            timestamp: { type: Date, default: Date.now },
            successful: Boolean,
            notes: String
        }],
        playbook: {
            templateId: String,
            completedSteps: [{ type: Number }]
        },
        accountHoldApplied: { type: Boolean, default: false },
        autoUnmatched: { type: Boolean, default: false }
    },

    // Compliance & Legal
    compliance: {
        legalHold: { type: Boolean, default: false },
        lawEnforcementRef: String,
        regulatoryFlag: { type: Boolean, default: false }
    }
    
}, {
    timestamps: true
});

// Indexes
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ reportedUser: 1 });
reportSchema.index({ status: 1, severity: -1 });
reportSchema.index({ 'adminReview.reviewedBy': 1 });
reportSchema.index({ 'dispute.isDispute': 1, 'dispute.outcome': 1 });
reportSchema.index({ 'sla.resolutionDeadline': 1, 'sla.resolutionBreached': 1 });
reportSchema.index({ 'investigation.tier': 1, status: 1 });
reportSchema.index({ 'investigation.assignedTo': 1 });

// Auto-set SLA, investigation tier, and initial timeline on create
reportSchema.pre('save', function(next) {
    if (this.isNew) {
        const slaHours = { P1: 2, P2: 8, P3: 24, P4: 72 };
        const priorityMap = { HIGH: 'P1', MEDIUM: 'P2', LOW: 'P3' };
        
        if (!this.sla.priority) {
            this.sla.priority = priorityMap[this.severity] || 'P3';
        }
        
        const hours = slaHours[this.sla.priority] || 24;
        const now = new Date();
        this.sla.firstResponseDeadline = new Date(now.getTime() + (hours / 2) * 60 * 60 * 1000);
        this.sla.resolutionDeadline = new Date(now.getTime() + hours * 60 * 60 * 1000);

        // Auto-assign investigation tier (Uber-style P1-P4 → T1-T4)
        if (!this.investigation) this.investigation = {};
        if (!this.investigation.tier) {
            const criticalCats = ['HARASSMENT', 'RECKLESS_DRIVING'];
            const majorCats = ['UNSAFE_VEHICLE', 'ROUTE_DEVIATION', 'FAKE_PROFILE', 'INAPPROPRIATE_BEHAVIOR'];
            let tier = 'T3_MINOR';
            if (this.severity === 'HIGH' && criticalCats.includes(this.category)) tier = 'T1_CRITICAL';
            else if (this.severity === 'HIGH' || majorCats.includes(this.category)) tier = 'T2_MAJOR';
            else if (this.severity === 'LOW') tier = 'T4_COSMETIC';
            this.investigation.tier = tier;
        }
        // Auto-create initial timeline event
        this.investigation.timeline = [{
            event: 'REPORT_CREATED',
            details: `Report filed: ${this.category} (${this.severity}) — Auto-triaged as ${this.investigation.tier}`,
            isAutomatic: true,
            timestamp: now
        }];
    }
    
    // Track SLA breaches
    if (this.sla.firstResponseAt && this.sla.firstResponseDeadline) {
        this.sla.firstResponseBreached = this.sla.firstResponseAt > this.sla.firstResponseDeadline;
        this.sla.responseTimeMinutes = Math.round((this.sla.firstResponseAt - this.createdAt) / 60000);
    }
    if (this.resolution.resolvedAt && this.sla.resolutionDeadline) {
        this.sla.resolutionBreached = this.resolution.resolvedAt > this.sla.resolutionDeadline;
        this.sla.resolutionTimeMinutes = Math.round((this.resolution.resolvedAt - this.createdAt) / 60000);
    }
    
    next();
});

// Static method to get pending reports count
reportSchema.statics.getPendingCount = function() {
    return this.countDocuments({ status: 'PENDING' });
};

// Static method to get reports by user
reportSchema.statics.getUserReportHistory = function(userId) {
    return this.find({ reportedUser: userId })
        .populate('reporter', 'profile')
        .sort({ createdAt: -1 });
};

module.exports = mongoose.model('Report', reportSchema);
