/**
 * Authentication Middleware
 * Protects routes and checks user roles
 * JWT-only authentication (no sessions)
 */

const User = require('../models/User');
const { verifyAccessToken, extractToken } = require('./jwt');

/**
 * Check if user is authenticated via JWT
 * Extracts token from Authorization header or httpOnly cookie
 */
exports.isAuthenticated = async (req, res, next) => {
    const token = extractToken(req);

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
            redirectUrl: '/login'
        });
    }

    let decoded;
    try {
        decoded = verifyAccessToken(token);
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: error.message || 'Invalid or expired token',
            code: 'TOKEN_INVALID',
            redirectUrl: '/login',
            forceLogout: true
        });
    }

    try {
        // Fetch user from database to check current status
        const user = await User.findById(decoded.userId)
            .select('accountStatus isActive isSuspended suspensionReason role email profile vehicles documents verificationStatus');
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Account not found. Please login again.',
                code: 'USER_NOT_FOUND',
                redirectUrl: '/login',
                forceLogout: true
            });
        }
        
        // Check if account is suspended
        if (user.accountStatus === 'SUSPENDED' || user.isSuspended) {
            return res.status(403).json({
                success: false,
                message: `Your account has been suspended. Reason: ${user.suspensionReason || 'Policy violation'}. Please check your email for details.`,
                code: 'ACCOUNT_SUSPENDED',
                accountSuspended: true,
                redirectUrl: '/login',
                forceLogout: true
            });
        }
        
        // Check if account is deleted
        if (user.accountStatus === 'DELETED') {
            return res.status(403).json({
                success: false,
                message: 'This account has been deleted.',
                code: 'ACCOUNT_DELETED',
                accountDeleted: true,
                redirectUrl: '/login',
                forceLogout: true
            });
        }
        
        // Check if account is inactive
        if (user.isActive === false) {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive. Please contact support.',
                code: 'ACCOUNT_INACTIVE',
                accountInactive: true,
                redirectUrl: '/login',
                forceLogout: true
            });
        }
        
        // Attach user and auth info to request for downstream use
        req.user = user;
        req.userId = decoded.userId;
        req.authMethod = 'jwt';
        
        return next();
    } catch (error) {
        console.error('Error in isAuthenticated middleware:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error during authentication',
            code: 'SERVER_ERROR'
        });
    }
};

/**
 * Check if user is a rider
 * Must be used AFTER isAuthenticated middleware
 */
exports.isRider = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
            redirectUrl: '/login'
        });
    }

    if (req.user.role !== 'RIDER') {
        return res.status(403).json({
            success: false,
            message: 'This action is only available to riders'
        });
    }

    next();
};

/**
 * Check if user is a passenger
 * Must be used AFTER isAuthenticated middleware
 */
exports.isPassenger = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
            redirectUrl: '/login'
        });
    }

    if (req.user.role !== 'PASSENGER') {
        return res.status(403).json({
            success: false,
            message: 'This action is only available to passengers'
        });
    }

    next();
};

/**
 * Check if user is an admin
 * Must be used AFTER isAuthenticated middleware
 */
exports.isAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
            redirectUrl: '/login'
        });
    }

    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }

    next();
};

/**
 * Check if rider is verified
 * Must be used AFTER isAuthenticated middleware
 */
exports.isVerifiedRider = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
            redirectUrl: '/login'
        });
    }

    if (req.user.role !== 'RIDER') {
        return res.status(403).json({
            success: false,
            message: 'This action is only available to riders'
        });
    }

    if (req.user.verificationStatus !== 'VERIFIED') {
        return res.status(403).json({
            success: false,
            message: 'Your account is pending verification',
            verificationStatus: req.user.verificationStatus,
            redirectUrl: '/user/documents'
        });
    }

    next();
};

/**
 * Check if user can access resource
 * Must be used AFTER isAuthenticated middleware
 */
exports.canAccessResource = (resourceUserIdField) => {
    return (req, res, next) => {
        const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
        
        if (req.user && req.user.role === 'ADMIN') {
            return next();
        }
        
        if (resourceUserId && req.userId && resourceUserId === req.userId.toString()) {
            return next();
        }
        
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to access this resource'
        });
    };
};

/**
 * Attach user object to request if JWT token is present (optional auth)
 * Does not block the request if no token — just enriches req.user if possible
 */
exports.attachUser = async (req, res, next) => {
    const token = extractToken(req);

    if (token) {
        try {
            const decoded = verifyAccessToken(token);
            const user = await User.findById(decoded.userId)
                .select('-password')
                .lean();
            
            if (user && user.accountStatus !== 'SUSPENDED' && !user.isSuspended && user.accountStatus !== 'DELETED') {
                req.user = user;
                req.userId = decoded.userId;
            }
        } catch (error) {
            // Token invalid or expired — continue without user
        }
    }
    next();
};

/**
 * Check if user is not authenticated (for login/register pages)
 */
exports.isGuest = (req, res, next) => {
    const token = extractToken(req);

    if (token) {
        try {
            verifyAccessToken(token);
            // Token is valid — user is already authenticated
            return res.status(200).json({
                success: true,
                message: 'Already authenticated',
                redirectUrl: '/dashboard'
            });
        } catch (error) {
            // Token invalid — user is a guest, continue
        }
    }
    next();
};
