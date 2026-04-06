/**
 * Admin Routes for Geo-Fencing (Route Deviation) Management - API Only
 */

const express = require('express');
const router = express.Router();
const RouteDeviation = require('../models/RouteDeviation');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { isAuthenticated, isAdminOrEmployee, hasPermission } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(apiLimiter);

/**
 * @swagger
 * /api/admin/deviations:
 *   get:
 *     tags: ['🌐 Admin — GeoFencing']
 *     summary: List all route deviations
 *     description: "⚠️ **manage_rides** — Paginated list of all route deviations with filters for status, severity, driver, and date range."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, ESCALATED, RESOLVED] }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [LOW, MEDIUM, HIGH, CRITICAL] }
 *       - in: query
 *         name: driver
 *         schema: { type: string }
 *         description: Filter by driver user ID
 *       - in: query
 *         name: reviewed
 *         schema: { type: boolean }
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Deviations with pagination and stats
 *       403:
 *         description: Requires manage_rides permission
 */
router.get('/deviations', isAuthenticated, isAdminOrEmployee, hasPermission('manage_rides'), async (req, res) => {
    try {
        const { status, severity, driver, startDate, endDate, reviewed, page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

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

        const deviations = await RouteDeviation.find(query)
            .populate('ride', 'route.start route.destination status')
            .populate('driver', 'profile email phone')
            .populate('passengers', 'profile phone')
            .populate('adminReview.reviewedBy', 'profile')
            .sort({ deviatedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await RouteDeviation.countDocuments(query);

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
 * @swagger
 * /api/admin/deviations/unresolved:
 *   get:
 *     tags: ['🌐 Admin — GeoFencing']
 *     summary: Get unresolved deviations
 *     description: "⚠️ **manage_rides** — Returns only ACTIVE and ESCALATED deviations requiring admin attention."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Unresolved deviations list
 */
router.get('/deviations/unresolved', isAuthenticated, isAdminOrEmployee, hasPermission('manage_rides'), async (req, res) => {
    try {
        const deviations = await RouteDeviation.getUnresolved();
        res.json({ success: true, deviations });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load unresolved deviations' });
    }
});

/**
 * @swagger
 * /api/admin/deviations/driver/{driverId}:
 *   get:
 *     tags: ['🌐 Admin — GeoFencing']
 *     summary: Get driver's deviation history and risk score
 *     description: "⚠️ **manage_rides** — Full deviation history for a specific driver with computed risk score."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Driver deviation history with risk metrics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 driver: { type: object }
 *                 deviations: { type: array }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total: { type: integer }
 *                     critical: { type: integer }
 *                     unresolved: { type: integer }
 *                     riskScore: { type: integer, example: 45, description: 'Higher = riskier driver' }
 *       404:
 *         description: Driver not found
 */
router.get('/deviations/driver/:driverId', isAuthenticated, isAdminOrEmployee, hasPermission('manage_rides'), async (req, res) => {
    try {
        const driver = await User.findById(req.params.driverId);
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }

        const deviations = await RouteDeviation.getDriverHistory(driver._id, 50);

        const totalDeviations = deviations.length;
        const criticalCount = deviations.filter(d => d.severity === 'CRITICAL').length;
        const unresolvedCount = deviations.filter(d => d.status === 'ACTIVE' || d.status === 'ESCALATED').length;
        const riskScore = (criticalCount * 10) + (unresolvedCount * 5) + (totalDeviations * 2);

        res.json({
            success: true,
            driver: { _id: driver._id, profile: driver.profile, email: driver.email },
            deviations,
            stats: { total: totalDeviations, critical: criticalCount, unresolved: unresolvedCount, riskScore }
        });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load driver deviations' });
    }
});

/**
 * @swagger
 * /api/admin/deviations/stats:
 *   get:
 *     tags: ['🌐 Admin — GeoFencing']
 *     summary: Aggregated deviation statistics
 *     description: "⚠️ **manage_rides** — Platform-wide deviation stats: total, avg distance, critical count, resolution rate."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: endDate
 *         schema: { type: string, format: date }
 *     responses:
 *       200:
 *         description: Deviation statistics
 */
router.get('/deviations/stats', isAuthenticated, isAdminOrEmployee, hasPermission('manage_rides'), async (req, res) => {
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
        res.status(500).json({ success: false, message: 'Failed to load statistics' });
    }
});

/**
 * @swagger
 * /api/admin/deviations/{id}:
 *   get:
 *     tags: ['🌐 Admin — GeoFencing']
 *     summary: Get deviation details
 *     description: "⚠️ **manage_rides** — Full deviation record with ride info, driver profile, passenger list, and driver's recent history."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deviation details with driver history
 *       404:
 *         description: Deviation not found
 */
router.get('/deviations/:id', isAuthenticated, isAdminOrEmployee, hasPermission('manage_rides'), async (req, res) => {
    try {
        const deviation = await RouteDeviation.findById(req.params.id)
            .populate('ride')
            .populate('driver', 'profile phone email')
            .populate('passengers', 'profile phone email')
            .populate('adminReview.reviewedBy', 'profile email');

        if (!deviation) {
            return res.status(404).json({ success: false, message: 'Deviation not found' });
        }

        const driverHistory = await RouteDeviation.getDriverHistory(deviation.driver._id, 5);
        res.json({ success: true, deviation, driverHistory });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to load deviation details' });
    }
});

/**
 * @swagger
 * /api/admin/deviations/{id}/resolve:
 *   post:
 *     tags: ['🌐 Admin — GeoFencing']
 *     summary: Resolve a route deviation
 *     description: "⚠️ **manage_rides** — Admin resolves a deviation with an action (warn driver, suspend, no action, etc.)."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string, example: 'Driver explained road closure. Acceptable deviation.' }
 *               action:
 *                 type: string
 *                 enum: [resolve, no_action, warning, suspend, flag]
 *                 example: 'warning'
 *                 description: |
 *                   - resolve → RESOLVED
 *                   - no_action → NO_ACTION
 *                   - warning → WARNING_ISSUED
 *                   - suspend → DRIVER_SUSPENDED
 *                   - flag → ACCOUNT_FLAGGED
 *     responses:
 *       200:
 *         description: Deviation resolved
 *       404:
 *         description: Deviation not found
 */
router.post('/deviations/:id/resolve', isAuthenticated, isAdminOrEmployee, hasPermission('manage_rides'), async (req, res) => {
    try {
        const { notes, action } = req.body;

        const ACTION_MAP = {
            resolve: 'RESOLVED',
            no_action: 'NO_ACTION',
            warning: 'WARNING_ISSUED',
            suspend: 'DRIVER_SUSPENDED',
            flag: 'ACCOUNT_FLAGGED'
        };
        const normalizedAction = ACTION_MAP[(action || '').toLowerCase()] || action || 'RESOLVED';

        const deviation = await RouteDeviation.findById(req.params.id);
        if (!deviation) {
            return res.status(404).json({ success: false, message: 'Deviation not found' });
        }

        await deviation.adminResolve(req.user._id, notes, normalizedAction);
        res.json({ success: true, message: 'Deviation resolved successfully', deviation });

    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to resolve deviation' });
    }
});

/**
 * @swagger
 * /api/admin/deviations/{id}/escalate:
 *   post:
 *     tags: ['🌐 Admin — GeoFencing']
 *     summary: Escalate deviation to CRITICAL
 *     description: "⚠️ **manage_rides** — Escalates a deviation to CRITICAL. Sends an immediate warning to the driver via WebSocket and notifies all admins."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deviation escalated to CRITICAL. Driver notified.
 *       404:
 *         description: Deviation not found
 */
router.post('/deviations/:id/escalate', isAuthenticated, isAdminOrEmployee, hasPermission('manage_rides'), async (req, res) => {
    try {
        const deviation = await RouteDeviation.findById(req.params.id);
        if (!deviation) {
            return res.status(404).json({ success: false, message: 'Deviation not found' });
        }

        await deviation.escalate();

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
        res.status(500).json({ success: false, message: 'Failed to escalate deviation' });
    }
});

module.exports = router;
