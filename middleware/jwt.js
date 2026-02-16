/**
 * JWT Token Middleware
 * Handles JWT token generation, verification, and authentication
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const User = require('../models/User');

// Token expiry constants
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '1h';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined in environment variables');
}

/**
 * Generate Access Token (short-lived)
 * @param {string} userId - User ID to encode in token
 * @returns {string} JWT access token
 */
exports.generateAccessToken = (userId) => {
    return jwt.sign(
        { 
            userId: userId.toString(),
            type: 'access'
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

/**
 * Generate Refresh Token (long-lived)
 * @param {string} userId - User ID to encode in token
 * @returns {string} JWT refresh token
 */
exports.generateRefreshToken = (userId) => {
    return jwt.sign(
        {
            userId: userId.toString(),
            type: 'refresh'
        },
        JWT_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
};

/**
 * Verify Access Token
 * @param {string} token - JWT token to verify
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
exports.verifyAccessToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'access') {
            throw new Error('Invalid token type');
        }
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AppError('Access token expired. Please refresh.', 401);
        }
        if (error.name === 'JsonWebTokenError') {
            throw new AppError('Invalid access token.', 401);
        }
        throw error;
    }
};

/**
 * Verify Refresh Token
 * @param {string} token - JWT token to verify
 * @returns {object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
exports.verifyRefreshToken = (token) => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.type !== 'refresh') {
            throw new Error('Invalid token type');
        }
        return decoded;
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new AppError('Refresh token expired. Please login again.', 401);
        }
        if (error.name === 'JsonWebTokenError') {
            throw new AppError('Invalid refresh token.', 401);
        }
        throw error;
    }
};


exports.isAuthenticatedJWT = async (req, res, next) => {
    try {
        // Extract token from Authorization header (Bearer token) or cookies
        let token = null;
        
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies && req.cookies.accessToken) {
            token = req.cookies.accessToken;
        }

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Access token required',
                code: 'TOKEN_REQUIRED'
            });
        }

        // Verify token
        const decoded = exports.verifyAccessToken(token);
        
        // Fetch user from database
        const user = await User.findById(decoded.userId)
            .select('accountStatus isActive isSuspended suspensionReason role email profile');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND'
            });
        }

        // Check account status
        if (user.accountStatus === 'SUSPENDED' || user.isSuspended) {
            return res.status(403).json({
                success: false,
                message: `Account suspended. Reason: ${user.suspensionReason || 'Policy violation'}`,
                code: 'ACCOUNT_SUSPENDED'
            });
        }

        if (user.accountStatus === 'DELETED') {
            return res.status(403).json({
                success: false,
                message: 'Account has been deleted',
                code: 'ACCOUNT_DELETED'
            });
        }

        // Attach user to request
        req.user = user;
        req.userId = user._id;
        req.authMethod = 'jwt';
        
        next();
    } catch (error) {
        if (error instanceof AppError) {
            return res.status(error.statusCode).json({
                success: false,
                message: error.message,
                code: 'TOKEN_ERROR'
            });
        }
        
        return res.status(401).json({
            success: false,
            message: 'Authentication failed',
            code: 'AUTH_FAILED'
        });
    }
};

/**
 * Extract token from request without verification
 * Useful for logging or debugging
 */
exports.extractToken = (req) => {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return req.headers.authorization.split(' ')[1];
    }
    if (req.cookies && req.cookies.accessToken) {
        return req.cookies.accessToken;
    }
    return null;
};

/**
 * Create HTTP-only cookie options
 * @param {number} maxAge - Cookie max age in milliseconds
 * @returns {object} Cookie options
 */
exports.getCookieOptions = (maxAge) => {
    const isProduction = process.env.NODE_ENV === 'production';
    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: maxAge,
        path: '/'
    };
};

// Export constants for use in other modules
exports.ACCESS_TOKEN_EXPIRY = ACCESS_TOKEN_EXPIRY;
exports.REFRESH_TOKEN_EXPIRY = REFRESH_TOKEN_EXPIRY;
