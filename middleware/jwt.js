/**
 * JWT Token Middleware
 * Handles JWT token generation, verification, and authentication
 */

const jwt = require('jsonwebtoken');
const { AppError } = require('./errorHandler');
const User = require('../models/User');

// Token expiry constants
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '2h';
const REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET must be defined in environment variables');
}

if (!JWT_REFRESH_SECRET) {
    console.error('⛔ SECURITY WARNING: JWT_REFRESH_SECRET is not set. Falling back to derived secret. Set a unique JWT_REFRESH_SECRET in production.');
    // Weak fallback — acceptable only in development
}

const EFFECTIVE_REFRESH_SECRET = JWT_REFRESH_SECRET || (JWT_SECRET + '_refresh');

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
        EFFECTIVE_REFRESH_SECRET,
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
        const decoded = jwt.verify(token, EFFECTIVE_REFRESH_SECRET);
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

        // Check account status — auto-lift expired suspensions
        if (user.accountStatus === 'SUSPENDED' || user.isSuspended) {
            // Check if suspension has expired
            const fullUser = await User.findById(decoded.userId).select('suspensionEnd accountStatusHistory');
            if (fullUser?.suspensionEnd && new Date(fullUser.suspensionEnd) < new Date()) {
                // Suspension has expired — auto-reactivate
                await User.findByIdAndUpdate(decoded.userId, {
                    accountStatus: 'ACTIVE',
                    isSuspended: false,
                    suspensionReason: null,
                    suspendedAt: null,
                    suspendedBy: null,
                    suspensionEnd: null,
                    $push: {
                        accountStatusHistory: {
                            status: 'ACTIVE',
                            reason: 'Suspension period expired — auto-reactivated',
                            changedBy: decoded.userId,
                            changedAt: new Date()
                        }
                    }
                });
                // Refresh user object for the request
                const reactivated = await User.findById(decoded.userId)
                    .select('accountStatus isActive isSuspended suspensionReason role email profile');
                req.user = reactivated;
                req.userId = reactivated._id;
                req.authMethod = 'jwt';
                return next();
            }

            return res.status(403).json({
                success: false,
                message: `Account suspended${user.suspensionReason ? `. Reason: ${user.suspensionReason}` : ''}`,
                code: 'ACCOUNT_SUSPENDED',
                suspensionEnd: fullUser?.suspensionEnd || null
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
        sameSite: isProduction ? 'strict' : 'lax',
        maxAge: maxAge,
        path: '/'
    };
};

// Export constants for use in other modules
exports.ACCESS_TOKEN_EXPIRY = ACCESS_TOKEN_EXPIRY;
exports.REFRESH_TOKEN_EXPIRY = REFRESH_TOKEN_EXPIRY;
