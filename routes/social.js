const express = require('express');
const router = express.Router();
const socialController = require('../controllers/socialController');
const { isAuthenticated } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// Apply apiLimiter as baseline
router.use(apiLimiter);

/**
 * @swagger
 * /api/social/sync/{provider}:
 *   post:
 *     tags: ['🔗 Social']
 *     summary: Sync social provider graph
 *     description: Connects a social account (LinkedIn, Facebook, etc.) to the user's LoopLane profile to enable social trust signals and community-based ride matching within professional networks.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [linkedin, facebook, google]
 *         description: Social provider to sync
 *         example: 'linkedin'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accessToken]
 *             properties:
 *               accessToken: { type: string, description: 'OAuth access token from the social provider' }
 *     responses:
 *       200:
 *         description: Social graph synced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string, example: 'LinkedIn profile synced. 12 connections found on LoopLane.' }
 *                 connectionsFound: { type: integer, example: 12 }
 *       400:
 *         description: Invalid provider or OAuth token
 */
router.post('/sync/:provider', isAuthenticated, socialController.syncSocialGraph);

module.exports = router;
