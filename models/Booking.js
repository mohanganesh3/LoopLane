/**
 * Booking Model
 * Stores booking information when passenger books a ride
 */

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    // Reference to Ride and Users
    ride: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride',
        required: true
    },
    passenger: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Pickup and Dropoff Points (may differ from ride start/end)
    pickupPoint: {
        name: String,
        address: String,
        coordinates: {
            type: [Number], // [longitude, latitude]
            required: true
        },
        distanceFromStart: Number, // km from ride start
        estimatedTime: String // Estimated pickup time
    },
    dropoffPoint: {
        name: String,
        address: String,
        coordinates: {
            type: [Number],
            required: true
        },
        distanceFromEnd: Number, // km from ride end
        estimatedTime: String // Estimated dropoff time
    },
    
    // Booking Details
    seatsBooked: {
        type: Number,
        required: true,
        min: 1
    },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    
    // Status Flow: PENDING → CONFIRMED → PICKUP_PENDING → PICKED_UP → IN_TRANSIT → DROPOFF_PENDING → DROPPED_OFF → COMPLETED
    status: {
        type: String,
        enum: [
            'PENDING',          // Waiting for rider acceptance
            'CONFIRMED',        // Rider accepted
            'REJECTED',         // Rider rejected
            'EXPIRED',          // Timeout (15 min)
            'PICKUP_PENDING',   // Ride started, waiting for pickup
            'PICKED_UP',        // OTP verified, passenger in car
            'IN_TRANSIT',       // Driving to dropoff (same as PICKED_UP for now)
            'DROPOFF_PENDING',  // Approaching dropoff
            'DROPPED_OFF',      // OTP verified, passenger dropped
            'COMPLETED',        // Journey completed
            'NO_SHOW',          // Passenger didn't show up
            'CANCELLED'         // Cancelled by passenger or rider
        ],
        default: 'PENDING'
    },
    
    // Special Requests
    specialRequests: {
        type: String,
        maxlength: 300
    },
    
    // Co-Passengers (people traveling with main passenger)
    coPassengers: [{
        name: String,
        phone: String,
        age: Number
    }],
    
    // Payment Information
    payment: {
        status: {
            type: String,
            enum: ['PENDING', 'PAID', 'PAYMENT_CONFIRMED', 'REFUNDED', 'FAILED'],
            default: 'PENDING'
        },
        method: {
            type: String,
            enum: ['CASH', 'UPI', 'CARD', 'WALLET'],
            default: 'CASH'
        },
        
        // Price Breakdown
        rideFare: {
            type: Number,
            default: 0
        },
        platformCommission: {
            type: Number,
            default: 0 // 10% of rideFare, calculated at booking time
        },
        totalAmount: {
            type: Number,
            default: 0
        },
        
        // Payment tracking
        transactionId: String,
        amount: Number,
        paidAt: Date,
        
        // Rider confirmation (for both CASH and UPI)
        riderConfirmedPayment: {
            type: Boolean,
            default: false
        },
        riderConfirmedAt: Date,
        riderConfirmedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        
        // Refund
        refundAmount: Number,
        refundedAt: Date,
        
        // Settlement to rider (platform pays rider later)
        riderPayout: {
            settled: {
                type: Boolean,
                default: false
            },
            amount: Number,
            settledAt: Date,
            method: String, // 'BANK_TRANSFER', 'UPI', 'WALLET'
            transactionId: String
        }
    },
    
    // OTP for verification (pickup and dropoff)
    verification: {
        pickup: {
            code: String,
            expiresAt: Date,
            verified: { type: Boolean, default: false },
            verifiedAt: Date,
            attempts: { type: Number, default: 0 }
        },
        dropoff: {
            code: String,
            expiresAt: Date,
            verified: { type: Boolean, default: false },
            verifiedAt: Date,
            attempts: { type: Number, default: 0 }
        }
    },
    
    // Rider Actions
    riderResponse: {
        respondedAt: Date,
        responseTime: Number, // minutes to respond
        message: String // Message to passenger
    },
    
    // Journey Tracking
    journey: {
        started: { type: Boolean, default: false },
        startedAt: Date,
        completed: { type: Boolean, default: false },
        completedAt: Date,
        duration: Number, // actual duration in minutes
        distance: Number // actual distance in km
    },
    
    // Cancellation
    cancellation: {
        cancelled: { type: Boolean, default: false },
        cancelledBy: {
            type: String,
            enum: ['PASSENGER', 'RIDER', 'ADMIN']
        },
        cancelledAt: Date,
        reason: String,
        refundIssued: { type: Boolean, default: false }
    },
    
    // Auto-Reassignment Tracking
    reassignment: {
        // If this booking was created from reassignment
        isReassigned: { type: Boolean, default: false },
        originalBooking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
        originalRide: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
        reassignedAt: Date,
        reason: String,
        
        // If this booking was cancelled and reassigned to another ride
        chain: [{
            fromRide: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
            toRide: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride' },
            reassignedAt: Date,
            matchScore: Number
        }],
        attempts: { type: Number, default: 0 }
    },
    
    // Review Status
    reviews: {
        passengerReviewed: { type: Boolean, default: false },
        riderReviewed: { type: Boolean, default: false }
    },
    
    // Notifications Sent
    notifications: {
        bookingConfirmed: { type: Boolean, default: false },
        rideStarting: { type: Boolean, default: false },
        rideStarted: { type: Boolean, default: false },
        rideCompleted: { type: Boolean, default: false },
        reviewReminder: { type: Boolean, default: false }
    }
    
}, {
    timestamps: true
});

// Indexes
bookingSchema.index({ ride: 1, passenger: 1 });
bookingSchema.index({ rider: 1, status: 1 });
bookingSchema.index({ passenger: 1, status: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });

// Pre-save middleware to calculate response time
bookingSchema.pre('save', function(next) {
    if (this.isModified('status') && (this.status === 'CONFIRMED' || this.status === 'REJECTED')) {
        if (!this.riderResponse.respondedAt) {
            this.riderResponse.respondedAt = new Date();
            const responseTime = (this.riderResponse.respondedAt - this.createdAt) / (1000 * 60);
            this.riderResponse.responseTime = Math.round(responseTime);
        }
    }
    next();
});

// Method to check if booking can be cancelled
bookingSchema.methods.canCancel = function() {
    const now = new Date();
    const rideTime = new Date(this.ride.schedule.departureDateTime);
    const hoursUntilRide = (rideTime - now) / (1000 * 60 * 60);
    
    // Can cancel if ride is more than 2 hours away
    return this.status !== 'COMPLETED' && 
           this.status !== 'CANCELLED' && 
           hoursUntilRide > 2;
};

// Method to calculate refund amount
bookingSchema.methods.calculateRefund = function() {
    const now = new Date();
    const rideTime = new Date(this.ride.schedule.departureDateTime);
    const hoursUntilRide = (rideTime - now) / (1000 * 60 * 60);
    
    // Refund policy
    if (hoursUntilRide > 24) {
        return this.totalPrice; // 100% refund
    } else if (hoursUntilRide > 12) {
        return this.totalPrice * 0.75; // 75% refund
    } else if (hoursUntilRide > 6) {
        return this.totalPrice * 0.50; // 50% refund
    } else if (hoursUntilRide > 2) {
        return this.totalPrice * 0.25; // 25% refund
    }
    return 0; // No refund
};

// Virtual for booking summary
bookingSchema.virtual('summary').get(function() {
    return {
        bookingId: this._id,
        status: this.status,
        seats: this.seatsBooked,
        price: this.totalPrice,
        from: this.pickupPoint.name,
        to: this.dropoffPoint.name
    };
});

module.exports = mongoose.model('Booking', bookingSchema);
