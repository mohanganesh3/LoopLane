/**
 * RouteAlert Model
 * Users can subscribe to route alerts — get notified when a ride is posted 
 * on a route they're interested in.
 * 
 * This solves: "I searched but found nothing" → "Set an alert, we'll notify you"
 */

const mongoose = require('mongoose');

const routeAlertSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Origin area
    origin: {
        address: { type: String, required: true },
        coordinates: {
            type: { type: String, default: 'Point' },
            coordinates: { type: [Number], required: true } // [lng, lat]
        }
    },

    // Destination area
    destination: {
        address: { type: String, required: true },
        coordinates: {
            type: { type: String, default: 'Point' },
            coordinates: { type: [Number], required: true } // [lng, lat]
        }
    },

    // Match radius in km (how close a posted ride's origin/dest must be)
    radiusKm: {
        type: Number,
        default: 5,
        min: 1,
        max: 25
    },

    // Schedule preferences (optional — filter by specific days/times)
    schedule: {
        daysOfWeek: [{ type: Number, min: 0, max: 6 }], // 0=Sun, 6=Sat. Empty = any day
        timeRangeStart: { type: String }, // "06:00"
        timeRangeEnd: { type: String }    // "10:00"
    },

    // Seat requirements
    minSeats: {
        type: Number,
        default: 1,
        min: 1
    },

    // Max price per seat (optional filter)
    maxPricePerSeat: {
        type: Number,
        default: null
    },

    // Alert status
    active: {
        type: Boolean,
        default: true,
        index: true
    },

    // How many times this alert has triggered
    triggerCount: {
        type: Number,
        default: 0
    },

    // Last triggered timestamp
    lastTriggered: {
        type: Date,
        default: null
    },

    // Auto-expire after X days (default: 30 days)
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
}, {
    timestamps: true
});

// Geospatial indexes for efficient matching
routeAlertSchema.index({ 'origin.coordinates': '2dsphere' });
routeAlertSchema.index({ 'destination.coordinates': '2dsphere' });

// Compound index: active alerts for quick lookup
routeAlertSchema.index({ active: 1, expiresAt: 1 });

// TTL index: auto-delete expired alerts (expireAfterSeconds: 0 means use the expiresAt date itself)
routeAlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Find alerts matching a newly posted ride
 * @param {Object} rideOriginCoords - [lng, lat]
 * @param {Object} rideDestCoords - [lng, lat]
 * @param {Date} departureDatetime
 * @param {Number} availableSeats
 * @param {Number} pricePerSeat
 */
routeAlertSchema.statics.findMatchingAlerts = async function (rideOriginCoords, rideDestCoords, departureDatetime, availableSeats, pricePerSeat) {
    const now = new Date();
    const departureDay = departureDatetime.getDay();
    const departureHour = departureDatetime.getHours();
    const departureMinutes = departureDatetime.getMinutes();
    const departureTimeStr = `${String(departureHour).padStart(2, '0')}:${String(departureMinutes).padStart(2, '0')}`;

    // Use $geoNear on origin.coordinates for spatial pre-filter (replaces full collection scan)
    const candidates = await this.aggregate([
        {
            $geoNear: {
                near: { type: 'Point', coordinates: rideOriginCoords },
                distanceField: '_originDistMeters',
                spherical: true,
                maxDistance: 25000, // 25km upper bound (max radiusKm)
                query: {
                    active: true,
                    expiresAt: { $gt: now },
                    minSeats: { $lte: availableSeats },
                    $or: [
                        { maxPricePerSeat: null },
                        { maxPricePerSeat: { $gte: pricePerSeat } }
                    ]
                },
                key: 'origin.coordinates'
            }
        },
        // Only keep alerts where origin distance <= the alert's own radiusKm
        {
            $match: {
                $expr: { $lte: ['$_originDistMeters', { $multiply: ['$radiusKm', 1000] }] }
            }
        },
        // Populate user info via $lookup
        {
            $lookup: {
                from: 'users',
                localField: 'user',
                foreignField: '_id',
                pipeline: [{ $project: { name: 1, email: 1, phone: 1 } }],
                as: '_userArr'
            }
        },
        { $addFields: { user: { $arrayElemAt: ['$_userArr', 0] } } },
        { $project: { _userArr: 0, _originDistMeters: 0 } }
    ]);

    // Post-filter: destination proximity + schedule (on reduced candidate set)
    const matched = [];
    for (const alert of candidates) {
        // Check destination proximity
        const destDist = haversineDistance(
            alert.destination.coordinates.coordinates,
            rideDestCoords
        );
        if (destDist > alert.radiusKm) continue;

        // Check day of week filter
        if (alert.schedule?.daysOfWeek?.length > 0) {
            if (!alert.schedule.daysOfWeek.includes(departureDay)) continue;
        }

        // Check time range filter
        if (alert.schedule?.timeRangeStart && alert.schedule?.timeRangeEnd) {
            if (departureTimeStr < alert.schedule.timeRangeStart || departureTimeStr > alert.schedule.timeRangeEnd) continue;
        }

        matched.push(alert);
    }

    return matched;
};

// Haversine distance helper (returns km)
function haversineDistance(coord1, coord2) {
    const R = 6371;
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

module.exports = mongoose.model('RouteAlert', routeAlertSchema);
