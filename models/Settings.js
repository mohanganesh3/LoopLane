/**
 * Settings Model
 * Stores platform-wide configuration settings
 */

const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    // Commission & Pricing
    pricing: {
        commission: {
            type: Number,
            default: 10,
            min: 0,
            max: 50
        },
        baseFare: {
            type: Number,
            default: 20,
            min: 0
        },
        pricePerKm: {
            type: Number,
            default: 5,
            min: 0
        },
        pricePerMinute: {
            type: Number,
            default: 1,
            min: 0
        },
        surgeMultiplierMax: {
            type: Number,
            default: 2.5,
            min: 1,
            max: 5
        },
        surgeThreshold: {
            type: Number,
            default: 0.7,
            min: 0.1,
            max: 2
        },
        minimumFare: {
            type: Number,
            default: 30,
            min: 0
        }
    },

    // Safety Thresholds
    safety: {
        maxSpeed: {
            type: Number,
            default: 100,
            min: 60,
            max: 150
        },
        routeDeviation: {
            type: Number,
            default: 500,
            min: 100,
            max: 2000
        },
        minRating: {
            type: Number,
            default: 3.5,
            min: 1,
            max: 5
        },
        autoSuspendReports: {
            type: Number,
            default: 3,
            min: 1,
            max: 10
        }
    },

    // Notification Settings
    notifications: {
        emailEnabled: {
            type: Boolean,
            default: true
        },
        smsEnabled: {
            type: Boolean,
            default: true
        },
        pushEnabled: {
            type: Boolean,
            default: true
        },
        sosAlertsEnabled: {
            type: Boolean,
            default: true
        }
    },

    // Feature Toggles
    features: {
        rideSharingEnabled: {
            type: Boolean,
            default: true
        },
        chatEnabled: {
            type: Boolean,
            default: true
        },
        reviewsEnabled: {
            type: Boolean,
            default: true
        },
        onlinePaymentRequired: {
            type: Boolean,
            default: true
        },
        verificationRequired: {
            type: Boolean,
            default: true
        },
        maintenanceMode: {
            type: Boolean,
            default: false
        }
    },

    // Email Configuration
    email: {
        smtpHost: {
            type: String,
            default: 'smtp.gmail.com'
        },
        smtpPort: {
            type: Number,
            default: 587
        },
        fromEmail: {
            type: String,
            default: 'noreply@lanecarpool.com'
        },
        fromName: {
            type: String,
            default: 'LANE Carpool'
        }
    },

    // SMS Configuration (Twilio)
    sms: {
        twilioSid: {
            type: String,
            default: ''
        },
        twilioPhone: {
            type: String,
            default: ''
        }
    },

    // Environmental Calculation
    environmental: {
        co2PerKm: {
            type: Number,
            default: 0.12 // kg per km
        },
        co2PerTree: {
            type: Number,
            default: 22 // kg per tree per year
        }
    },

    // Booking & Ride Settings
    booking: {
        maxPassengersPerRide: {
            type: Number,
            default: 4,
            min: 1,
            max: 8
        },
        cancellationWindow: {
            type: Number,
            default: 60, // minutes before ride start
            min: 0
        },
        cancellationFee: {
            type: Number,
            default: 0, // percentage of fare
            min: 0,
            max: 100
        },
        autoAcceptRadius: {
            type: Number,
            default: 5, // km
            min: 1,
            max: 50
        }
    },

    // H7: Promo Codes — DEPRECATED: Use models/PromoCode.js collection instead.
    // Kept for backward compat / one-time migration.
    promoCodes: [{
        code: { type: String, uppercase: true },
        discountType: { type: String, enum: ['PERCENTAGE', 'FLAT'], default: 'PERCENTAGE' },
        discountValue: { type: Number, default: 10 },
        maxUses: { type: Number, default: 100 },
        currentUses: { type: Number, default: 0 },
        minBookingAmount: { type: Number, default: 0 },
        expiresAt: Date,
        description: String,
        isActive: { type: Boolean, default: true },
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],

    // Last updated
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Static method to get or create settings
settingsSchema.statics.getSettings = async function() {
    let settings = await this.findOne();
    if (!settings) {
        settings = await this.create({});
    }
    return settings;
};

// Static method to update settings
settingsSchema.statics.updateSettings = async function(updates, adminId) {
    let settings = await this.getSettings();
    
    // Update each section
    if (updates.pricing) {
        settings.pricing = { ...settings.pricing, ...updates.pricing };
    }
    if (updates.safety) {
        settings.safety = { ...settings.safety, ...updates.safety };
    }
    if (updates.notifications) {
        settings.notifications = { ...settings.notifications, ...updates.notifications };
    }
    if (updates.features) {
        settings.features = { ...settings.features, ...updates.features };
    }
    if (updates.email) {
        settings.email = { ...settings.email, ...updates.email };
    }
    if (updates.sms) {
        settings.sms = { ...settings.sms, ...updates.sms };
    }
    if (updates.environmental) {
        settings.environmental = { ...settings.environmental, ...updates.environmental };
    }
    if (updates.booking) {
        settings.booking = { ...settings.booking, ...updates.booking };
    }
    
    settings.updatedBy = adminId;
    settings.lastUpdated = new Date();
    
    await settings.save();
    return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
