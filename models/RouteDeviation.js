const mongoose = require('mongoose');

/**
 * RouteDeviation Model
 * Tracks when riders deviate from planned route (geo-fence violations)
 * Used for safety monitoring and admin reports
 */
const routeDeviationSchema = new mongoose.Schema({
    // Reference to the ride
    ride: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride',
        required: true
    },
    
    // Driver who deviated
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Passenger(s) affected
    passengers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    // Deviation details
    deviationType: {
        type: String,
        enum: ['ROUTE_DEVIATION', 'WRONG_DIRECTION', 'SUSPICIOUS_STOP', 'OFF_ROUTE'],
        default: 'ROUTE_DEVIATION'
    },
    
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        default: 'MEDIUM'
    },
    
    // Location where deviation occurred
    deviationLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        }
    },
    
    // Expected location on route
    expectedLocation: {
        type: {
            type: String,
            enum: ['Point'],
            default: 'Point'
        },
        coordinates: {
            type: [Number] // [longitude, latitude]
        }
    },
    
    // Distance deviated from route (in kilometers)
    deviationDistance: {
        type: Number,
        required: true
    },
    
    // Timestamp of deviation
    deviatedAt: {
        type: Date,
        default: Date.now
    },
    
    // Duration of deviation
    duration: {
        type: Number, // in seconds
        default: 0
    },
    
    // Address/description of deviation location
    locationDescription: {
        type: String
    },
    
    // Status of the deviation
    status: {
        type: String,
        enum: ['ACTIVE', 'RETURNED_TO_ROUTE', 'RESOLVED', 'ESCALATED'],
        default: 'ACTIVE'
    },
    
    // Notifications sent
    notificationsSent: {
        passengerNotified: {
            type: Boolean,
            default: false
        },
        driverWarned: {
            type: Boolean,
            default: false
        },
        adminAlerted: {
            type: Boolean,
            default: false
        },
        emergencyContacted: {
            type: Boolean,
            default: false
        }
    },
    
    // Driver's explanation (if provided)
    driverExplanation: {
        type: String
    },
    
    // Admin actions
    adminReview: {
        reviewed: {
            type: Boolean,
            default: false
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reviewedAt: {
            type: Date
        },
        notes: {
            type: String
        },
        action: {
            type: String,
            enum: ['NO_ACTION', 'WARNING_ISSUED', 'DRIVER_SUSPENDED', 'ACCOUNT_FLAGGED']
        }
    },
    
    // Auto-resolved when driver returns to route
    returnedToRoute: {
        type: Boolean,
        default: false
    },
    
    returnedAt: {
        type: Date
    },
    
    // Metadata
    metadata: {
        speed: Number, // Speed at time of deviation
        heading: Number, // Direction driver was heading
        routeProgress: Number, // Percentage of route completed
        estimatedDelay: Number // Minutes of delay caused
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
routeDeviationSchema.index({ ride: 1, deviatedAt: -1 });
routeDeviationSchema.index({ driver: 1, status: 1 });
routeDeviationSchema.index({ status: 1, severity: 1 });
routeDeviationSchema.index({ deviatedAt: -1 });
routeDeviationSchema.index({ 'adminReview.reviewed': 1 });

// Geospatial index for location queries
routeDeviationSchema.index({ deviationLocation: '2dsphere' });

// Virtual for checking if deviation is recent (within 5 minutes)
routeDeviationSchema.virtual('isRecent').get(function() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return this.deviatedAt > fiveMinutesAgo;
});

// Virtual for checking if critical
routeDeviationSchema.virtual('isCritical').get(function() {
    return this.severity === 'CRITICAL' || this.deviationDistance > 15;
});

// Static method: Get all unresolved deviations
routeDeviationSchema.statics.getUnresolved = function() {
    return this.find({ 
        status: { $in: ['ACTIVE', 'ESCALATED'] } 
    })
    .populate('ride', 'startLocation endLocation')
    .populate('driver', 'name phone')
    .populate('passengers', 'name phone')
    .sort({ deviatedAt: -1 });
};

// Static method: Get driver's deviation history
routeDeviationSchema.statics.getDriverHistory = function(driverId, limit = 10) {
    return this.find({ driver: driverId })
        .populate('ride', 'startLocation endLocation status')
        .sort({ deviatedAt: -1 })
        .limit(limit);
};

// Static method: Get deviations for admin review
routeDeviationSchema.statics.getPendingReview = function() {
    return this.find({ 
        'adminReview.reviewed': false,
        severity: { $in: ['HIGH', 'CRITICAL'] }
    })
    .populate('ride')
    .populate('driver', 'name phone email')
    .populate('passengers', 'name phone')
    .sort({ deviatedAt: -1 });
};

// Static method: Get statistics for a ride
routeDeviationSchema.statics.getRideStats = function(rideId) {
    return this.aggregate([
        { $match: { ride: mongoose.Types.ObjectId(rideId) } },
        {
            $group: {
                _id: '$severity',
                count: { $sum: 1 },
                totalDistance: { $sum: '$deviationDistance' },
                avgDistance: { $avg: '$deviationDistance' }
            }
        }
    ]);
};

// Instance method: Mark as returned to route
routeDeviationSchema.methods.markReturned = async function() {
    this.status = 'RETURNED_TO_ROUTE';
    this.returnedToRoute = true;
    this.returnedAt = new Date();
    this.duration = Math.floor((this.returnedAt - this.deviatedAt) / 1000); // seconds
    return await this.save();
};

// Instance method: Escalate to critical
routeDeviationSchema.methods.escalate = async function() {
    this.severity = 'CRITICAL';
    this.status = 'ESCALATED';
    this.notificationsSent.adminAlerted = true;
    return await this.save();
};

// Instance method: Admin resolve
routeDeviationSchema.methods.adminResolve = async function(adminId, notes, action) {
    this.status = 'RESOLVED';
    this.adminReview = {
        reviewed: true,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        notes: notes,
        action: action
    };
    return await this.save();
};

// Pre-save hook: Auto-escalate if deviation is too large or too long
routeDeviationSchema.pre('save', function(next) {
    // Auto-escalate if deviation > 20km
    if (this.deviationDistance > 20 && this.severity !== 'CRITICAL') {
        this.severity = 'CRITICAL';
        this.status = 'ESCALATED';
    }
    
    // Auto-escalate if deviation duration > 15 minutes
    if (this.duration > 900 && this.severity !== 'CRITICAL') { // 900 seconds = 15 min
        this.severity = 'CRITICAL';
        this.status = 'ESCALATED';
    }
    
    next();
});

const RouteDeviation = mongoose.model('RouteDeviation', routeDeviationSchema);

module.exports = RouteDeviation;
