/**
 * Token Management Routes
 * Handles JWT token refresh, revocation, and session management
 */

const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { 
    generateAccessToken, 
    generateRefreshToken, 
    verifyRefreshToken,
    getCookieOptions,
    isAuthenticatedJWT 
} = require('../middleware/jwt');
const RefreshToken = require('../models/RefreshToken');

/**
 * POST /api/token/refresh
 * Refresh access token using refresh token
 * Implements token rotation (old refresh token is invalidated)
 */
router.post('/refresh', asyncHandler(async (req, res) => {
    // Extract refresh token from cookie or request body
    const oldRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!oldRefreshToken) {
        return res.status(401).json({
            success: false,
            message: 'Refresh token required',
            code: 'REFRESH_TOKEN_REQUIRED'
        });
    }

    // Verify refresh token signature
    const decoded = verifyRefreshToken(oldRefreshToken);
    
    // Find and verify token in database
    const tokenDoc = await RefreshToken.findValidToken(decoded.userId, oldRefreshToken);
    
    if (!tokenDoc) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token',
            code: 'INVALID_REFRESH_TOKEN'
        });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    // Save new refresh token to database
    const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
    
    await RefreshToken.createToken(decoded.userId, newRefreshToken, {
        deviceInfo,
        ipAddress
    });

    // Revoke old refresh token (token rotation)
    await RefreshToken.revokeToken(tokenDoc._id);

    // Set new tokens in HTTP-only cookies
    const accessTokenMaxAge = 60 * 60 * 1000; // 1 hour
    const refreshTokenMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    res.cookie('accessToken', newAccessToken, getCookieOptions(accessTokenMaxAge));
    res.cookie('refreshToken', newRefreshToken, getCookieOptions(refreshTokenMaxAge));

    res.json({
        success: true,
        message: 'Tokens refreshed successfully',
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600 // 1 hour in seconds
    });
}));

/**
 * POST /api/token/revoke
 * Revoke current refresh token (logout from this device)
 */
router.post('/revoke', asyncHandler(async (req, res) => {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
        return res.status(400).json({
            success: false,
            message: 'No refresh token provided'
        });
    }

    try {
        // Verify token
        const decoded = verifyRefreshToken(refreshToken);
        
        // Find and revoke token
        const tokenDoc = await RefreshToken.findValidToken(decoded.userId, refreshToken);
        
        if (tokenDoc) {
            await RefreshToken.revokeToken(tokenDoc._id);
        }

        // Clear cookies
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.json({
            success: true,
            message: 'Token revoked successfully'
        });
    } catch (error) {
        // Even if token is invalid, clear cookies
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
}));

/**
 * POST /api/token/revoke-all
 * Revoke all refresh tokens for current user (logout from all devices)
 * Requires authentication
 */
router.post('/revoke-all', isAuthenticatedJWT, asyncHandler(async (req, res) => {
    const deletedCount = await RefreshToken.revokeAllUserTokens(req.userId);

    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({
        success: true,
        message: `Logged out from ${deletedCount} device(s) successfully`,
        devicesLoggedOut: deletedCount
    });
}));

/**
 * GET /api/token/sessions
 * Get all active sessions for current user
 * Requires authentication
 */
router.get('/sessions', isAuthenticatedJWT, asyncHandler(async (req, res) => {
    const sessions = await RefreshToken.getActiveSessions(req.userId);

    const formattedSessions = sessions.map(session => ({
        id: session._id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        createdAt: session.createdAt,
        lastUsedAt: session.lastUsedAt,
        expiresAt: session.expiresAt
    }));

    res.json({
        success: true,
        sessions: formattedSessions,
        count: formattedSessions.length
    });
}));

/**
 * DELETE /api/token/sessions/:sessionId
 * Revoke a specific session (logout from specific device)
 * Requires authentication
 */
router.delete('/sessions/:sessionId', isAuthenticatedJWT, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    // Verify session belongs to current user
    const tokenDoc = await RefreshToken.findById(sessionId);
    
    if (!tokenDoc) {
        return res.status(404).json({
            success: false,
            message: 'Session not found'
        });
    }

    if (tokenDoc.userId.toString() !== req.userId.toString()) {
        return res.status(403).json({
            success: false,
            message: 'Unauthorized to revoke this session'
        });
    }

    await RefreshToken.revokeToken(sessionId);

    res.json({
        success: true,
        message: 'Session revoked successfully'
    });
}));

/**
 * POST /api/token/verify
 * Verify if current access token is valid
 * Useful for client-side token validation
 */
router.post('/verify', isAuthenticatedJWT, asyncHandler(async (req, res) => {
    res.json({
        success: true,
        message: 'Token is valid',
        user: {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role,
            profile: req.user.profile
        }
    });
}));

module.exports = router;
