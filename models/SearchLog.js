const mongoose = require('mongoose');

/**
 * SearchLog Schema
 * Tracks the complete user conversion funnel:
 * Search → View Details → Book → Pay → Complete
 */
const searchLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        // Optional, as guests might search before logging in
    },
    sessionId: {
        type: String,
        // Used to track anonymous users across the funnel until they log in
    },
    searchParams: {
        origin: {
            address: {
                type: String,
                required: true
            },
            coordinates: {
                type: [Number] // [longitude, latitude]
            }
        },
        destination: {
            address: {
                type: String,
                required: true
            },
            coordinates: {
                type: [Number]
            }
        },
        date: {
            type: Date,
            required: true
        },
        seats: {
            type: Number,
            default: 1
        },
        filters: {
            // Any specific filters the user applied (e.g., maxPrice, womenOnly)
            type: mongoose.Schema.Types.Mixed
        }
    },
    resultsCount: {
        type: Number,
        required: true
    },
    funnelStatus: {
        type: String,
        enum: ['SEARCHED', 'VIEWED_RIDE', 'BOOKING_INITIATED', 'BOOKED', 'PAID', 'COMPLETED', 'CANCELLED'],
        default: 'SEARCHED'
    },
    viewedRides: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride'
    }],
    finalAction: {
        ride: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ride'
        },
        booking: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking'
        }
    },
    // GeoJSON point fields for 2dsphere indexing (synced via pre-save)
    originPoint: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number] }
    },
    destPoint: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number] }
    }
}, {
    timestamps: true
});

// Sync GeoJSON point fields from search params
searchLogSchema.pre('save', function (next) {
    if (this.searchParams?.origin?.coordinates?.length >= 2) {
        this.originPoint = { type: 'Point', coordinates: this.searchParams.origin.coordinates };
    }
    if (this.searchParams?.destination?.coordinates?.length >= 2) {
        this.destPoint = { type: 'Point', coordinates: this.searchParams.destination.coordinates };
    }
    next();
});

// Indexes for analytics and fast funnel querying
searchLogSchema.index({ user: 1, createdAt: -1 });
searchLogSchema.index({ originPoint: '2dsphere' });
searchLogSchema.index({ destPoint: '2dsphere' });
searchLogSchema.index({ funnelStatus: 1 });
searchLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 }); // TTL: auto-delete after 90 days

module.exports = mongoose.model('SearchLog', searchLogSchema);
