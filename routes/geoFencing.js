/**
 * Admin Routes for Geo-Fencing (Route Deviation) Management
 * View and manage route deviations, driver warnings, and safety reports
 */

const express = require('express');
const router = express.Router();
const RouteDeviation = require('../models/RouteDeviation');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

/**
 * GET /admin/deviations
 * View all route deviations with filters
 */
router.get('/deviations', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { status, severity, driver, startDate, endDate, reviewed } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
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
            .populate('driver', 'name phone email')
            .populate('passengers', 'name phone')
            .populate('adminReview.reviewedBy', 'name')
            .sort({ deviatedAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await RouteDeviation.countDocuments(query);
        const totalPages = Math.ceil(total / limit);

        // Get statistics
        const stats = await RouteDeviation.aggregate([
            {
                $group: {
                    _id: '$severity',
                    count: { $sum: 1 },
                    avgDistance: { $avg: '$deviationDistance' }
                }
            }
        ]);

        const unresolvedCount = await RouteDeviation.countDocuments({ 
            status: { $in: ['ACTIVE', 'ESCALATED'] } 
        });

        res.render('admin/geo-fencing', {
            title: 'Route Deviations (Geo-Fencing)',
            deviations,
            stats,
            unresolvedCount,
            currentPage: page,
            totalPages,
            total,
            filters: { status, severity, driver, startDate, endDate, reviewed },
            user: req.user
        });

    } catch (error) {
        console.error('Error fetching deviations:', error);
        req.flash('error', 'Failed to load deviations');
        res.redirect('/admin/dashboard');
    }
});

/**
 * GET /admin/deviations/unresolved
 * View unresolved deviations requiring action
 */
router.get('/deviations/unresolved', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const deviations = await RouteDeviation.getUnresolved();

        res.render('admin/deviations-unresolved', {
            title: 'Unresolved Route Deviations',
            deviations,
            user: req.user
        });

    } catch (error) {
        console.error('Error fetching unresolved deviations:', error);
        req.flash('error', 'Failed to load unresolved deviations');
        res.redirect('/admin/deviations');
    }
});

/**
 * GET /admin/deviations/:id
 * View detailed deviation information
 */
router.get('/deviations/:id', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const deviation = await RouteDeviation.findById(req.params.id)
            .populate('ride')
            .populate('driver', 'name phone email')
            .populate('passengers', 'name phone email')
            .populate('adminReview.reviewedBy', 'name email');

        if (!deviation) {
            req.flash('error', 'Deviation not found');
            return res.redirect('/admin/deviations');
        }

        // Get driver's deviation history
        const driverHistory = await RouteDeviation.getDriverHistory(deviation.driver._id, 5);

        res.render('admin/deviation-detail', {
            title: `Deviation Details - ${deviation._id}`,
            deviation,
            driverHistory,
            user: req.user
        });

    } catch (error) {
        console.error('Error fetching deviation detail:', error);
        req.flash('error', 'Failed to load deviation details');
        res.redirect('/admin/deviations');
    }
});

/**
 * POST /admin/deviations/:id/resolve
 * Admin resolves a deviation with notes and action
 */
router.post('/deviations/:id/resolve', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const { notes, action } = req.body;
        
        const deviation = await RouteDeviation.findById(req.params.id);
        if (!deviation) {
            return res.status(404).json({ 
                success: false, 
                message: 'Deviation not found' 
            });
        }

        await deviation.adminResolve(req.user._id, notes, action);

        req.flash('success', 'Deviation resolved successfully');
        res.redirect(`/admin/deviations/${deviation._id}`);

    } catch (error) {
        console.error('Error resolving deviation:', error);
        req.flash('error', 'Failed to resolve deviation');
        res.redirect(`/admin/deviations/${req.params.id}`);
    }
});

/**
 * POST /admin/deviations/:id/escalate
 * Escalate deviation to critical status
 */
router.post('/deviations/:id/escalate', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const deviation = await RouteDeviation.findById(req.params.id);
        if (!deviation) {
            return res.status(404).json({ 
                success: false, 
                message: 'Deviation not found' 
            });
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

        res.json({ 
            success: true, 
            message: 'Deviation escalated to critical' 
        });

    } catch (error) {
        console.error('Error escalating deviation:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to escalate deviation' 
        });
    }
});

/**
 * GET /admin/deviations/driver/:driverId
 * View specific driver's deviation history
 */
router.get('/deviations/driver/:driverId', isAuthenticated, isAdmin, async (req, res) => {
    try {
        const driver = await User.findById(req.params.driverId);
        if (!driver) {
            req.flash('error', 'Driver not found');
            return res.redirect('/admin/deviations');
        }

        const deviations = await RouteDeviation.getDriverHistory(driver._id, 50);

        // Calculate driver risk score
        const totalDeviations = deviations.length;
        const criticalCount = deviations.filter(d => d.severity === 'CRITICAL').length;
        const unresolvedCount = deviations.filter(d => d.status === 'ACTIVE' || d.status === 'ESCALATED').length;

        const riskScore = (criticalCount * 10) + (unresolvedCount * 5) + (totalDeviations * 2);

        res.render('admin/driver-deviations', {
            title: `${driver.name} - Deviation History`,
            driver,
            deviations,
            stats: {
                total: totalDeviations,
                critical: criticalCount,
                unresolved: unresolvedCount,
                riskScore
            },
            user: req.user
        });

    } catch (error) {
        console.error('Error fetching driver deviations:', error);
        req.flash('error', 'Failed to load driver deviations');
        res.redirect('/admin/deviations');
    }
});

/**
 * GET /admin/deviations/stats
 * Get deviation statistics (API)
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
                    criticalCount: {
                        $sum: { $cond: [{ $eq: ['$severity', 'CRITICAL'] }, 1, 0] }
                    },
                    resolvedCount: {
                        $sum: { $cond: [{ $eq: ['$status', 'RESOLVED'] }, 1, 0] }
                    }
                }
            }
        ]);

        res.json({ 
            success: true, 
            stats: stats[0] || {} 
        });

    } catch (error) {
        console.error('Error fetching deviation stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to load statistics' 
        });
    }
});

module.exports = router;
