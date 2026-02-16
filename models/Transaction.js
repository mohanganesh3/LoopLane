/**
 * Transaction Model
 * Tracks all financial transactions for admin dashboard
 */

const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // Transaction Type
    type: {
        type: String,
        enum: ['BOOKING_PAYMENT', 'COMMISSION', 'RIDER_PAYOUT', 'REFUND'],
        required: true
    },
    
    // Related Models
    booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    ride: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ride'
    },
    
    // Parties Involved
    passenger: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    rider: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    // Financial Breakdown
    amounts: {
        // What passenger paid
        passengerPaid: {
            type: Number,
            default: 0
        },
        
        // Ride fare (goes to rider eventually)
        rideFare: {
            type: Number,
            default: 0
        },
        
        // Platform commission
        platformCommission: {
            type: Number,
            default: 0 // 10% of rideFare, calculated at booking time
        },
        
        // Total amount
        total: {
            type: Number,
            default: 0
        }
    },
    
    // Payment Details
    payment: {
        method: {
            type: String,
            enum: ['CASH', 'UPI', 'CARD', 'WALLET'],
            default: 'CASH'
        },
        
        // For online payments
        gateway: String, // 'razorpay', 'paytm', etc.
        gatewayOrderId: String,
        gatewayPaymentId: String,
        
        // Status
        status: {
            type: String,
            enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'],
            default: 'PENDING'
        },
        
        completedAt: Date
    },
    
    // Commission Status
    commission: {
        collected: {
            type: Boolean,
            default: false
        },
        collectedAt: Date,
        
        // For cash payments, rider owes commission
        pending: {
            type: Boolean,
            default: false
        }
    },
    
    // Rider Payout Status (platform pays rider)
    riderPayout: {
        amount: Number,
        settled: {
            type: Boolean,
            default: false
        },
        settledAt: Date,
        method: String, // 'BANK_TRANSFER', 'UPI', 'WALLET'
        transactionId: String
    },
    
    // Metadata
    description: String,
    notes: String,
    
    // Admin Actions
    processedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    processedAt: Date
    
}, {
    timestamps: true
});

// Indexes for fast queries
transactionSchema.index({ type: 1, createdAt: -1 });
transactionSchema.index({ passenger: 1, createdAt: -1 });
transactionSchema.index({ rider: 1, createdAt: -1 });
transactionSchema.index({ booking: 1 });
transactionSchema.index({ 'payment.status': 1 });
transactionSchema.index({ 'commission.collected': 1 });
transactionSchema.index({ 'riderPayout.settled': 1 });

// Static method to get admin financial summary
transactionSchema.statics.getFinancialSummary = async function(startDate, endDate) {
    const match = {};
    if (startDate) match.createdAt = { $gte: new Date(startDate) };
    if (endDate) match.createdAt = { ...match.createdAt, $lte: new Date(endDate) };
    
    const summary = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                totalRevenue: { $sum: '$amounts.total' },
                totalCommission: { $sum: '$amounts.platformCommission' },
                totalRideFare: { $sum: '$amounts.rideFare' },
                
                // By payment method
                cashPayments: {
                    $sum: {
                        $cond: [{ $eq: ['$payment.method', 'CASH'] }, 1, 0]
                    }
                },
                upiPayments: {
                    $sum: {
                        $cond: [{ $eq: ['$payment.method', 'UPI'] }, 1, 0]
                    }
                },
                
                // Commission collected
                commissionCollected: {
                    $sum: {
                        $cond: ['$commission.collected', '$amounts.platformCommission', 0]
                    }
                },
                commissionPending: {
                    $sum: {
                        $cond: ['$commission.pending', '$amounts.platformCommission', 0]
                    }
                },
                
                // Rider payouts
                payoutSettled: {
                    $sum: {
                        $cond: ['$riderPayout.settled', '$riderPayout.amount', 0]
                    }
                },
                payoutPending: {
                    $sum: {
                        $cond: [
                            { $and: ['$commission.collected', { $not: '$riderPayout.settled' }] },
                            '$amounts.rideFare',
                            0
                        ]
                    }
                }
            }
        }
    ]);
    
    return summary[0] || {
        totalBookings: 0,
        totalRevenue: 0,
        totalCommission: 0,
        totalRideFare: 0,
        cashPayments: 0,
        upiPayments: 0,
        commissionCollected: 0,
        commissionPending: 0,
        payoutSettled: 0,
        payoutPending: 0
    };
};

// Static method to get rider earnings
transactionSchema.statics.getRiderEarnings = async function(riderId, startDate, endDate) {
    const match = { rider: mongoose.Types.ObjectId(riderId) };
    if (startDate) match.createdAt = { $gte: new Date(startDate) };
    if (endDate) match.createdAt = { ...match.createdAt, $lte: new Date(endDate) };
    
    const earnings = await this.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                totalRides: { $sum: 1 },
                totalEarnings: { $sum: '$amounts.rideFare' },
                settledAmount: {
                    $sum: {
                        $cond: ['$riderPayout.settled', '$riderPayout.amount', 0]
                    }
                },
                pendingAmount: {
                    $sum: {
                        $cond: [
                            { $not: '$riderPayout.settled' },
                            '$amounts.rideFare',
                            0
                        ]
                    }
                }
            }
        }
    ]);
    
    return earnings[0] || {
        totalRides: 0,
        totalEarnings: 0,
        settledAmount: 0,
        pendingAmount: 0
    };
};

module.exports = mongoose.model('Transaction', transactionSchema);
