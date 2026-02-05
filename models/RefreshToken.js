/**
 * RefreshToken Model
 * Stores refresh tokens for JWT token rotation
 * Enables token revocation and multi-device login tracking
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const refreshTokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    deviceInfo: {
        type: String,
        default: 'Unknown Device'
    },
    ipAddress: {
        type: String,
        default: 'Unknown'
    },
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastUsedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for efficient queries
refreshTokenSchema.index({ userId: 1, expiresAt: 1 });
refreshTokenSchema.index({ expiresAt: 1 }); // For cleanup job

/**
 * Hash the refresh token before saving
 * @param {string} token - Raw refresh token
 * @returns {Promise<string>} Hashed token
 */
refreshTokenSchema.statics.hashToken = async function(token) {
    return await bcrypt.hash(token, 10);
};

/**
 * Verify a refresh token against its hash
 * @param {string} token - Raw refresh token
 * @param {string} hash - Stored hash
 * @returns {Promise<boolean>} True if token matches hash
 */
refreshTokenSchema.statics.verifyToken = async function(token, hash) {
    return await bcrypt.compare(token, hash);
};

/**
 * Create and save a hashed refresh token
 * @param {string} userId - User ID
 * @param {string} token - Raw refresh token
 * @param {object} options - Device info, IP, expiry
 * @returns {Promise<object>} Saved refresh token document
 */
refreshTokenSchema.statics.createToken = async function(userId, token, options = {}) {
    const tokenHash = await this.hashToken(token);
    
    // Calculate expiry (default 7 days)
    const expiryDays = parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS) || 7;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    return await this.create({
        userId,
        tokenHash,
        deviceInfo: options.deviceInfo || 'Unknown Device',
        ipAddress: options.ipAddress || 'Unknown',
        expiresAt: options.expiresAt || expiresAt
    });
};

/**
 * Find and verify a refresh token
 * @param {string} userId - User ID
 * @param {string} token - Raw refresh token
 * @returns {Promise<object|null>} Token document if valid, null otherwise
 */
refreshTokenSchema.statics.findValidToken = async function(userId, token) {
    // Find all tokens for this user that haven't expired
    const tokens = await this.find({
        userId,
        expiresAt: { $gt: new Date() }
    });

    // Check each token hash
    for (const tokenDoc of tokens) {
        const isValid = await this.verifyToken(token, tokenDoc.tokenHash);
        if (isValid) {
            return tokenDoc;
        }
    }

    return null;
};

/**
 * Revoke a specific refresh token
 * @param {string} tokenId - Token document ID
 * @returns {Promise<void>}
 */
refreshTokenSchema.statics.revokeToken = async function(tokenId) {
    await this.findByIdAndDelete(tokenId);
};

/**
 * Revoke all refresh tokens for a user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Number of tokens revoked
 */
refreshTokenSchema.statics.revokeAllUserTokens = async function(userId) {
    const result = await this.deleteMany({ userId });
    return result.deletedCount;
};

/**
 * Cleanup expired tokens
 * @returns {Promise<number>} Number of tokens deleted
 */
refreshTokenSchema.statics.cleanupExpired = async function() {
    const result = await this.deleteMany({
        expiresAt: { $lt: new Date() }
    });
    return result.deletedCount;
};

/**
 * Get active sessions for a user
 * @param {string} userId - User ID
 * @returns {Promise<array>} List of active tokens with device info
 */
refreshTokenSchema.statics.getActiveSessions = async function(userId) {
    return await this.find({
        userId,
        expiresAt: { $gt: new Date() }
    })
    .select('deviceInfo ipAddress createdAt lastUsedAt expiresAt')
    .sort({ lastUsedAt: -1 });
};

/**
 * Update last used timestamp
 */
refreshTokenSchema.methods.updateLastUsed = async function() {
    this.lastUsedAt = new Date();
    await this.save();
};

// Auto-cleanup expired tokens on query
refreshTokenSchema.pre('find', function() {
    this.where({ expiresAt: { $gt: new Date() } });
});

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;
