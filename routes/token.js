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
const { loginLimiter, apiLimiter } = require('../middleware/rateLimiter');

// Apply apiLimiter to all token routes as baseline
router.use(apiLimiter);

/**
 * @swagger
 * /api/token/refresh:
 *   post:
 *     tags: ['🔑 Token']
 *     summary: Refresh access token
 *     description: |
 *       Exchanges a valid refresh token for a new access token + new refresh token (token rotation).
 *       The old refresh token is immediately invalidated after use.
 *       
 *       Send the refresh token either as a cookie (browser) or in the request body (API clients).
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Required if not sending as a cookie
 *                 example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *     responses:
 *       200:
 *         description: New tokens issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 accessToken: { type: string }
 *                 refreshToken: { type: string }
 *                 expiresIn: { type: integer, example: 7200 }
 *       401:
 *         description: Invalid or expired refresh token
 */
router.post('/refresh', loginLimiter, asyncHandler(async (req, res) => {
    const oldRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!oldRefreshToken) {
        return res.status(401).json({
            success: false,
            message: 'Refresh token required',
            code: 'REFRESH_TOKEN_REQUIRED'
        });
    }

    const decoded = verifyRefreshToken(oldRefreshToken);
    const tokenDoc = await RefreshToken.findValidToken(decoded.userId, oldRefreshToken);

    if (!tokenDoc) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired refresh token',
            code: 'INVALID_REFRESH_TOKEN'
        });
    }

    const newAccessToken = generateAccessToken(decoded.userId);
    const newRefreshToken = generateRefreshToken(decoded.userId);

    const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';

    await RefreshToken.createToken(decoded.userId, newRefreshToken, {
        deviceInfo,
        ipAddress
    });

    await RefreshToken.revokeToken(tokenDoc._id);

    const accessTokenMaxAge = 2 * 60 * 60 * 1000;
    const refreshTokenMaxAge = 7 * 24 * 60 * 60 * 1000;

    res.cookie('accessToken', newAccessToken, getCookieOptions(accessTokenMaxAge));
    res.cookie('refreshToken', newRefreshToken, getCookieOptions(refreshTokenMaxAge));

    res.json({
        success: true,
        message: 'Tokens refreshed successfully',
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 7200
    });
}));

/**
 * @swagger
 * /api/token/revoke:
 *   post:
 *     tags: ['🔑 Token']
 *     summary: Revoke refresh token (logout this device)
 *     description: Invalidates the current refresh token in the database and clears auth cookies. Use this for proper logout that also invalidates server-side sessions.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Required if not sending as cookie
 *     responses:
 *       200:
 *         description: Token revoked. Logged out from this device.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
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
        const decoded = verifyRefreshToken(refreshToken);
        const tokenDoc = await RefreshToken.findValidToken(decoded.userId, refreshToken);

        if (tokenDoc) {
            await RefreshToken.revokeToken(tokenDoc._id);
        }

        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.json({
            success: true,
            message: 'Token revoked successfully'
        });
    } catch (error) {
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');

        res.json({
            success: true,
            message: 'Logged out successfully'
        });
    }
}));

/**
 * @swagger
 * /api/token/revoke-all:
 *   post:
 *     tags: ['🔑 Token']
 *     summary: Revoke all sessions (logout all devices)
 *     description: Invalidates ALL refresh tokens for the current user. Useful when account is compromised. Requires authentication.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out from all devices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Logged out from 3 device(s) successfully' }
 *                 devicesLoggedOut: { type: integer, example: 3 }
 *       401:
 *         description: Not authenticated
 */
router.post('/revoke-all', isAuthenticatedJWT, asyncHandler(async (req, res) => {
    const deletedCount = await RefreshToken.revokeAllUserTokens(req.userId);

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.json({
        success: true,
        message: `Logged out from ${deletedCount} device(s) successfully`,
        devicesLoggedOut: deletedCount
    });
}));

/**
 * @swagger
 * /api/token/sessions:
 *   get:
 *     tags: ['🔑 Token']
 *     summary: List all active sessions
 *     description: Returns all active login sessions for the current user (device info, IP, creation time). Useful for security monitoring.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Active sessions list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 sessions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       deviceInfo: { type: string, example: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17...)' }
 *                       ipAddress: { type: string, example: '49.207.xx.xx' }
 *                       createdAt: { type: string, format: date-time }
 *                       lastUsedAt: { type: string, format: date-time }
 *                       expiresAt: { type: string, format: date-time }
 *                 count: { type: integer, example: 2 }
 *       401:
 *         description: Not authenticated
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
 * @swagger
 * /api/token/sessions/{sessionId}:
 *   delete:
 *     tags: ['🔑 Token']
 *     summary: Revoke a specific session
 *     description: Logs out from a specific device by invalidating its session. You can only revoke your own sessions.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID from GET /api/token/sessions
 *         example: '64a1b2c3d4e5f6g7h8i9j0k1'
 *     responses:
 *       200:
 *         description: Session revoked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: Not authorized to revoke this session
 *       404:
 *         description: Session not found
 */
router.delete('/sessions/:sessionId', isAuthenticatedJWT, asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

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
 * @swagger
 * /api/token/verify:
 *   post:
 *     tags: ['🔑 Token']
 *     summary: Verify if access token is valid
 *     description: Validates the current access token and returns the authenticated user's basic info. Useful for client-side token health checks.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'Token is valid' }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     email: { type: string }
 *                     role: { type: string }
 *       401:
 *         description: Invalid or expired token
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
