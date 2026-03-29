const mongoose = require('mongoose');

/**
 * RideRequest Schema
 * Epic 2: Represents a passenger's intent to find a ride,
 * held in the matching pool queue for the Bipartite Graph Batch Matching engine.
 */
const rideRequestSchema = new mongoose.Schema({
    passenger: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    route: {
        origin: {
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true
            },
            address: String
        },
        destination: {
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true
            },
            address: String
        }
    },
    schedule: {
        departureTime: {
            type: Date,
            required: true
        }
    },
    seatsNeeded: {
        type: Number,
        default: 1
    },
    status: {
        type: String,
        enum: ['PENDING_MATCH', 'MATCHED', 'EXPIRED', 'CANCELLED'],
        default: 'PENDING_MATCH'
    },
    matchedRide: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride'
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

// Sync GeoJSON point fields from route coordinates
rideRequestSchema.pre('save', function (next) {
    if (this.route?.origin?.coordinates?.length >= 2) {
        this.originPoint = { type: 'Point', coordinates: this.route.origin.coordinates };
    }
    if (this.route?.destination?.coordinates?.length >= 2) {
        this.destPoint = { type: 'Point', coordinates: this.route.destination.coordinates };
    }
    next();
});

// Geospatial indexes on proper GeoJSON fields
rideRequestSchema.index({ originPoint: '2dsphere' });
rideRequestSchema.index({ destPoint: '2dsphere' });
rideRequestSchema.index({ status: 1, 'schedule.departureTime': 1 }); // For the batch chronological queue
rideRequestSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 }); // TTL: auto-delete stale requests after 7 days

module.exports = mongoose.model('RideRequest', rideRequestSchema);
