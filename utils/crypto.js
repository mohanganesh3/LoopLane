/**
 * Cryptographic utilities for LoopLane
 * 
 * - AES-256-GCM encryption/decryption for 2FA secrets
 * - SHA-256 hashing for password reset tokens
 * 
 * Requires ENCRYPTION_KEY env var (32-byte hex string, 64 chars).
 * Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from env, or derive a fallback in development.
 * In production, ENCRYPTION_KEY MUST be set.
 */
function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (key) {
        if (key.length !== 64) {
            throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
        }
        return Buffer.from(key, 'hex');
    }

    // Fallback: derive from JWT_SECRET (development only)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
        throw new Error('ENCRYPTION_KEY or JWT_SECRET must be set');
    }

    if (process.env.NODE_ENV === 'production') {
        console.error('⛔ SECURITY: ENCRYPTION_KEY not set in production. Set a unique 32-byte hex key.');
    }

    return crypto.scryptSync(jwtSecret, 'looplance-2fa-salt', 32);
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @param {string} plaintext - Text to encrypt
 * @returns {string} Encrypted string in format: iv:authTag:ciphertext (all hex)
 */
function encrypt(plaintext) {
    if (!plaintext) return plaintext;

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt AES-256-GCM encrypted string
 * @param {string} encryptedStr - Encrypted string in format: iv:authTag:ciphertext
 * @returns {string} Decrypted plaintext
 */
function decrypt(encryptedStr) {
    if (!encryptedStr || !encryptedStr.includes(':')) return encryptedStr;

    const parts = encryptedStr.split(':');
    if (parts.length !== 3) return encryptedStr; // Not encrypted, return as-is

    const [ivHex, authTagHex, ciphertext] = parts;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

/**
 * Hash a token (for password reset tokens, etc.) using SHA-256
 * @param {string} token - Raw token to hash
 * @returns {string} Hex-encoded SHA-256 hash
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a cryptographically secure random token
 * @param {number} bytes - Number of random bytes (default: 32)
 * @returns {string} Hex-encoded random token
 */
function generateSecureToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
    encrypt,
    decrypt,
    hashToken,
    generateSecureToken
};
