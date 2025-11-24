/**
 * Admin Routes for Geo-Fencing (Route Deviation) Management - API Only
 * View and manage route deviations, driver warnings, and safety reports
 */

const express = require('express');
const router = express.Router();
const RouteDeviation = require('../models/RouteDeviation');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

/**
 * GET /admin/deviations - Get all route deviations with filters (API)
 */
router.get('/deviations', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { status, severity, driver, startDate, endDate, reviewed, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (status) query.status = status;
        if (severity) query.severity = severity;
        if (driver) query.driver = driver;
        if (reviewed !== undefined) query['adminReview.reviewed'] = reviewed === 'true';
        
        if (startDate || endDate) {
            query.deviatedAt = {};
            if (startDate) query.deviatedAt.$gte = new Date(startDate);
            if (endDate) query.deviatedAt.$lte = new Date(endDate);
        }

        // Get deviations with pagination
        const deviations = await RouteDeviation.find(query)
            .populate('ride', 'startLocation endLocation status')
            .populate('driver', 'profile email phone')
            .populate('passengers', 'profile phone')
            .populate('adminReview.reviewedBy', 'profile')
            .sort({ deviatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await RouteDeviation.countDocuments(query);

        // Get statistics
        const stats = await RouteDeviation.aggregate([
            { $group: { _id: '$severity', count: { $sum: 1 }, avgDistance: { $avg: '$deviationDistance' } } }
        ]);

        const unresolvedCount = await RouteDeviation.countDocuments({ 
            status: { $in: ['ACTIVE', 'ESCALATED'] } 
        });

        res.json({
            success: true,
            deviations,
            stats,
            unresolvedCount,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching deviations:', error);
        res.status(500).json({ success: false, message: 'Failed to load deviations' });
    }
});

/**
 * GET /admin/deviations/unresolved - Get unresolved deviations (API)
 */
router.get('/deviations/unresolved', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const deviations = await RouteDeviation.getUnresolved();
        res.json({ success: true, deviations });
    } catch (error) {
        console.error('Error fetching unresolved deviations:', error);
        res.status(500).json({ success: false, message: 'Failed to load unresolved deviations' });
    }
});

/**
 * GET /admin/deviations/:id - Get deviation details (API)
 */
router.get('/deviations/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const deviation = await RouteDeviation.findById(req.params.id)
            .populate('ride')
            .populate('driver', 'profile phone email')
            .populate('passengers', 'profile phone email')
            .populate('adminReview.reviewedBy', 'profile email');

        if (!deviation) {
            return res.status(404).json({ success: false, message: 'Deviation not found' });
        }

        // Get driver's deviation history
        const driverHistory = await RouteDeviation.getDriverHistory(deviation.driver._id, 5);

        res.json({ success: true, deviation, driverHistory });

    } catch (error) {
        console.error('Error fetching deviation detail:', error);
        res.status(500).json({ success: false, message: 'Failed to load deviation details' });
    }
});

/**
 * POST /admin/deviations/:id/resolve - Resolve a deviation (API)
 */
router.post('/deviations/:id/resolve', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { notes, action } = req.body;
        
        const deviation = await RouteDeviation.findById(req.params.id);
        if (!deviation) {
            return res.status(404).json({ success: false, message: 'Deviation not found' });
        }

        await deviation.adminResolve(req.user._id, notes, action);

        res.json({ success: true, message: 'Deviation resolved successfully', deviation });

    } catch (error) {
        console.error('Error resolving deviation:', error);
        res.status(500).json({ success: false, message: 'Failed to resolve deviation' });
    }
});

/**
 * POST /admin/deviations/:id/escalate - Escalate deviation (API)
 */
router.post('/deviations/:id/escalate', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const deviation = await RouteDeviation.findById(req.params.id);
        if (!deviation) {
            return res.status(404).json({ success: false, message: 'Deviation not found' });
        }

        await deviation.escalate();

        // Send critical alert to driver
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${deviation.driver}`).emit('critical-warning', {
                type: 'ESCALATED_DEVIATION',
                message: 'Your route deviation has been escalated to CRITICAL by admin. Return to route immediately or face suspension.',
                deviationId: deviation._id
            });
        }

        res.json({ success: true, message: 'Deviation escalated to critical' });

    } catch (error) {
        console.error('Error escalating deviation:', error);
        res.status(500).json({ success: false, message: 'Failed to escalate deviation' });
    }
});

/**
 * GET /admin/deviations/driver/:driverId - Get driver's deviation history (API)
 */
router.get('/deviations/driver/:driverId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const driver = await User.findById(req.params.driverId);
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }

        const deviations = await RouteDeviation.getDriverHistory(driver._id, 50);

        // Calculate driver risk score
        const totalDeviations = deviations.length;
        const criticalCount = deviations.filter(d => d.severity === 'CRITICAL').length;
        const unresolvedCount = deviations.filter(d => d.status === 'ACTIVE' || d.status === 'ESCALATED').length;
        const riskScore = (criticalCount * 10) + (unresolvedCount * 5) + (totalDeviations * 2);

        res.json({
            success: true,
            driver: {
                _id: driver._id,
                profile: driver.profile,
                email: driver.email
            },
            deviations,
            stats: { total: totalDeviations, critical: criticalCount, unresolved: unresolvedCount, riskScore }
        });

    } catch (error) {
        console.error('Error fetching driver deviations:', error);
        res.status(500).json({ success: false, message: 'Failed to load driver deviations' });
    }
});

/**
 * GET /admin/deviations/stats - Get deviation statistics (API)
 */
router.get('/deviations/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const query = {};
        if (startDate || endDate) {
            query.deviatedAt = {};
            if (startDate) query.deviatedAt.$gte = new Date(startDate);
            if (endDate) query.deviatedAt.$lte = new Date(endDate);
        }

        const stats = await RouteDeviation.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalDeviations: { $sum: 1 },
                    avgDistance: { $avg: '$deviationDistance' },
                    maxDistance: { $max: '$deviationDistance' },
                    criticalCount: { $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] } },
                    resolvedCount: { $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] } }
                }
            }
        ]);

        res.json({ success: true, stats: stats[0] || {} });

    } catch (error) {
        console.error('Error fetching deviation stats:', error);
        res.status(500).json({ success: false, message: 'Failed to load statistics' });
    }
});

module.exports = router;
