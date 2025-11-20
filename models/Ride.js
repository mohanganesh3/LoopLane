/**
 * Ride Model
 * Stores ride information posted by riders
 */

const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    // Rider Information
    rider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    
    // Route Information
    route: {
        start: {
            name: { type: String, required: true },
            address: String,
            coordinates: {
                type: [Number], // [longitude, latitude]
                required: true,
                index: '2dsphere' // Geospatial index
            }
        },
        destination: {
            name: { type: String, required: true },
            address: String,
            coordinates: {
                type: [Number],
                required: true,
                index: '2dsphere'
            }
        },
        intermediateStops: [{
            name: String,
            address: String,
            coordinates: [Number],
            order: Number
        }],
        // Complete route geometry from OSRM
        geometry: {
            type: {
                type: String,
                enum: ['LineString'],
                default: 'LineString'
            },
            coordinates: [[Number]] // Array of [lon, lat] pairs
        },
        distance: { type: Number, required: true }, // in kilometers
        duration: { type: Number, required: true } // in minutes
    },
    
    // Schedule
    schedule: {
        date: { type: Date, required: true },
        time: { type: String, required: true }, // Format: "HH:MM"
        departureDateTime: { type: Date, required: true },
        flexibleTiming: { type: Boolean, default: false },
        returnTrip: {
            enabled: { type: Boolean, default: false },
            date: Date,
            time: String
        }
    },
    
    // Pricing
    pricing: {
        pricePerSeat: { type: Number, required: true, min: 0 },
        totalSeats: { type: Number, required: true, min: 1 },
        availableSeats: { type: Number, required: true },
        currency: { type: String, default: 'INR' },
        totalEarnings: { type: Number, default: 0 }
    },
    
    // Preferences & Rules
    preferences: {
        gender: {
            type: String,
            enum: ['ANY', 'MALE_ONLY', 'FEMALE_ONLY', 'MIXED'],
            default: 'ANY'
        },
        autoAcceptBookings: { type: Boolean, default: false }, // Auto-approve bookings without rider confirmation
        smoking: { type: Boolean, default: false },
        pets: { type: Boolean, default: false },
        music: {
            type: String,
            enum: ['NO_MUSIC', 'SOFT_MUSIC', 'ANY_MUSIC', 'LIGHT_MUSIC', 'OPEN_TO_REQUESTS'],
            default: 'OPEN_TO_REQUESTS'
        },
        conversation: {
            type: String,
            enum: ['QUIET', 'SOME_CHAT', 'CHATTY', 'DEPENDS_ON_MOOD'],
            default: 'DEPENDS_ON_MOOD'
        },
        luggage: {
            type: String,
            enum: ['SMALL_BAG', 'MEDIUM_BAG', 'LARGE_LUGGAGE'],
            default: 'MEDIUM_BAG'
        },
        maxLuggagePerPassenger: { type: Number, default: 1 }
    },
    
    // Special Instructions
    specialInstructions: {
        type: String,
        maxlength: 500
    },
    
    // Carbon Footprint
    carbon: {
        totalEmission: Number, // Total CO2 for journey
        perPersonEmission: Number, // CO2 per person
        carbonSaved: Number, // CO2 saved through carpooling
        equivalentTrees: Number // Trees equivalent
    },
    
    // Ride Status
    status: {
        type: String,
        enum: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'],
        default: 'ACTIVE'
    },
    
    // Bookings for this ride
    bookings: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
    }],
    
    // Tracking Information (when ride is in progress)
    tracking: {
        isLive: { type: Boolean, default: false },
        startedAt: Date,
        completedAt: Date,
        currentLocation: {
            coordinates: [Number],
            timestamp: Date,
            speed: Number,
            accuracy: Number
        },
        breadcrumbs: [{
            coordinates: [Number],
            timestamp: Date,
            speed: Number
        }],
        lastDeviation: {
            distance: Number,
            threshold: Number,
            severity: {
                type: String,
                enum: ['NONE', 'LOW', 'MEDIUM', 'HIGH']
            },
            timestamp: Date
        },
        deviationHistory: [{
            distance: Number,
            threshold: Number,
            severity: {
                type: String,
                enum: ['LOW', 'MEDIUM', 'HIGH']
            },
            timestamp: Date
        }]
    },
    
    // Views and Interactions
    views: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },
    
    // Cancellation
    cancellation: {
        cancelled: { type: Boolean, default: false },
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        cancelledAt: Date,
        reason: String
    }
    
}, {
    timestamps: true
});

// Indexes for efficient queries
rideSchema.index({ 'route.start.coordinates': '2dsphere' });
rideSchema.index({ 'route.destination.coordinates': '2dsphere' });
rideSchema.index({ rider: 1, status: 1 });
rideSchema.index({ 'schedule.departureDateTime': 1 });
rideSchema.index({ status: 1, 'schedule.departureDateTime': 1 });
rideSchema.index({ 'pricing.availableSeats': 1 });

// Pre-save middleware to set availableSeats
rideSchema.pre('save', function(next) {
    if (this.isNew) {
        this.pricing.availableSeats = this.pricing.totalSeats;
    }
    next();
});

// Method to check if ride is bookable
rideSchema.methods.isBookable = function() {
    return this.status === 'ACTIVE' && 
           this.pricing.availableSeats > 0 && 
           new Date(this.schedule.departureDateTime) > new Date();
};

// Method to calculate route matching score
rideSchema.methods.calculateMatchScore = function(pickupCoords, dropoffCoords) {
    // This will be implemented in the controller using Turf.js
    // Returns a score between 0-100 indicating how well this ride matches
    return 0;
};

// Virtual for formatted price
rideSchema.virtual('formattedPrice').get(function() {
    return `₹${this.pricing.pricePerSeat}`;
});

// Virtual for seats info
rideSchema.virtual('seatsInfo').get(function() {
    return `${this.pricing.availableSeats}/${this.pricing.totalSeats} available`;
});

module.exports = mongoose.model('Ride', rideSchema);
