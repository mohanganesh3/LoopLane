/**
 * OTP Service
 * Generates and verifies One-Time Passwords for pickup/dropoff verification
 */

const crypto = require('crypto');

const parseValidityMinutes = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_OTP_VALIDITY_MINUTES = parseValidityMinutes(process.env.OTP_VALIDITY_MINUTES, 15);
const PICKUP_OTP_VALIDITY_MINUTES = parseValidityMinutes(process.env.PICKUP_OTP_VALIDITY_MINUTES, 6 * 60);
const DROPOFF_OTP_VALIDITY_MINUTES = parseValidityMinutes(process.env.DROPOFF_OTP_VALIDITY_MINUTES, 12 * 60);

/**
 * Generate a cryptographically secure random 4-digit OTP
 * @returns {string} 4-digit OTP
 */
const generateOTP = () => {
    return crypto.randomInt(1000, 10000).toString();
};

/**
 * Generate OTP with expiry
 * @param {number} validityMinutes
 * @returns {Object} { code, expiresAt, verified }
 */
const generateOTPWithExpiry = (validityMinutes = DEFAULT_OTP_VALIDITY_MINUTES) => {
    const code = generateOTP();
    const safeValidityMinutes = parseValidityMinutes(validityMinutes, DEFAULT_OTP_VALIDITY_MINUTES);
    const expiresAt = new Date(Date.now() + safeValidityMinutes * 60 * 1000);
    
    return {
        code,
        expiresAt,
        verified: false
    };
};

/**
 * Verify OTP
 * @param {string} inputOTP - OTP entered by user
 * @param {Object} storedOTP - Stored OTP object { code, expiresAt, verified }
 * @returns {Object} { valid: boolean, reason: string }
 */
const verifyOTP = (inputOTP, storedOTP) => {
    // Check if OTP exists
    if (!storedOTP || !storedOTP.code) {
        return {
            valid: false,
            reason: 'NO_OTP_GENERATED'
        };
    }
    
    // Check if already verified
    if (storedOTP.verified) {
        return {
            valid: false,
            reason: 'ALREADY_VERIFIED'
        };
    }
    
    if (isOTPExpired(storedOTP)) {
        return {
            valid: false,
            reason: 'EXPIRED'
        };
    }
    
    // Check if OTP matches
    if (inputOTP !== storedOTP.code) {
        return {
            valid: false,
            reason: 'INVALID_OTP'
        };
    }
    
    // All checks passed
    return {
        valid: true,
        reason: 'VERIFIED'
    };
};

/**
 * Check if OTP is expired
 * @param {Object} otp - OTP object
 * @returns {boolean}
 */
const isOTPExpired = (otp) => {
    if (!otp?.expiresAt) {
        return false;
    }

    const expiresAt = new Date(otp.expiresAt);
    return !Number.isNaN(expiresAt.getTime()) && Date.now() > expiresAt.getTime();
};

/**
 * Format OTP for display (e.g., 1234 -> "1 2 3 4")
 * @param {string} otp - OTP code
 * @returns {string}
 */
const formatOTP = (otp) => {
    return otp.split('').join(' ');
};

/**
 * Mask OTP for security (e.g., 1234 -> "12**")
 * @param {string} otp - OTP code
 * @returns {string}
 */
const maskOTP = (otp) => {
    if (!otp || otp.length < 4) return '****';
    return otp.substring(0, 2) + '**';
};

/**
 * Generate cryptographically secure 6-digit OTP for sensitive operations
 * @returns {string}
 */
const generateSecureOTP = () => {
    return crypto.randomInt(100000, 1000000).toString();
};

/**
 * Get user-friendly error message for OTP verification failure
 * @param {string} reason - Reason code
 * @returns {string}
 */
const getOTPErrorMessage = (reason) => {
    const messages = {
        'NO_OTP_GENERATED': 'No OTP has been generated yet. Please wait for the driver to arrive.',
        'ALREADY_VERIFIED': 'This OTP has already been used.',
        'EXPIRED': 'This OTP has expired. Please request a new one.',
        'INVALID_OTP': 'Invalid OTP. Please check and try again.'
    };
    
    return messages[reason] || 'OTP verification failed. Please try again.';
};

/**
 * Regenerate expired OTP
 * @param {Object} oldOTP - Old OTP object
 * @param {number} validityMinutes - New validity in minutes
 * @returns {Object} New OTP object
 */
const regenerateOTP = (oldOTP, validityMinutes = 15) => {
    return generateOTPWithExpiry(validityMinutes);
};

module.exports = {
    DEFAULT_OTP_VALIDITY_MINUTES,
    PICKUP_OTP_VALIDITY_MINUTES,
    DROPOFF_OTP_VALIDITY_MINUTES,
    generateOTP,
    generateOTPWithExpiry,
    verifyOTP,
    isOTPExpired,
    formatOTP,
    maskOTP,
    generateSecureOTP,
    getOTPErrorMessage,
    regenerateOTP
};
