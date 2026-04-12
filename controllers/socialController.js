/**
 * Social Graph Controller
 * Epic 2: Simulates OAuth ingestion to build the "Social Graph"
 * and feed into the Composite Trust Score Engine.
 */

const User = require('../models/User');
const { calculateTrustScore } = require('../utils/trustScoreEngine');
const { asyncHandler } = require('../middleware/errorHandler');

/**
 * @desc    Simulate OAuth Callback to Sync Social Graph
 * @route   POST /api/social/sync/:provider
 * @access  Private
 */
exports.syncSocialGraph = asyncHandler(async (req, res) => {
    const { provider } = req.params; // 'linkedin', 'facebook', 'google'
    const validProviders = ['linkedin', 'facebook', 'google'];

    if (!validProviders.includes(provider.toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Invalid provider' });
    }

    const uppercaseProvider = provider.toUpperCase();

    // 1. Simulate fetching from Provider's API
    // In a real app, this would use passport.js and actual access tokens
    const simulatedConnectionCount = Math.floor(Math.random() * 800) + 50; // 50 to 850 connections
    const simulatedProviderId = `mock_${provider}_${Math.random().toString(36).substring(7)}`;

    // 2. Format connection object
    const newConnection = {
        provider: uppercaseProvider,
        providerId: simulatedProviderId,
        connectionCount: simulatedConnectionCount,
        verifiedAt: new Date()
    };

    // 3. Update User Document
    const user = await User.findById(req.user._id);

    // Remove if already exists to "resync"
    user.socialConnections = user.socialConnections.filter(c => c.provider !== uppercaseProvider);
    user.socialConnections.push(newConnection);

    await user.save();

    // 4. Trigger Trust Score Recalculation (Epic 2)
    const newTrustScore = await calculateTrustScore(user._id);

    res.status(200).json({
        success: true,
        message: `${uppercaseProvider} synced successfully! Found ${simulatedConnectionCount} connections.`,
        data: {
            socialConnections: user.socialConnections,
            newTrustScore
        }
    });
});
