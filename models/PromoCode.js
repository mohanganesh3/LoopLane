/**
 * PromoCode Model
 * Standalone collection for promo codes (extracted from Settings.promoCodes[]).
 */

const mongoose = require('mongoose');

const promoCodeSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    discountType: {
        type: String,
        enum: ['PERCENTAGE', 'FLAT'],
        default: 'PERCENTAGE'
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    maxUses: { type: Number, default: 100 },
    currentUses: { type: Number, default: 0 },
    minBookingAmount: { type: Number, default: 0 },
    expiresAt: { type: Date, index: true },
    description: String,
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

// Compound index for fast lookups during validation
promoCodeSchema.index({ code: 1, isActive: 1 });

module.exports = mongoose.model('PromoCode', promoCodeSchema);
