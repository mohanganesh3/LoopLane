const express = require('express');
const router = express.Router();
const corporateController = require('../controllers/corporateController');
const carbonReportController = require('../controllers/carbonReportController');
const { isAuthenticated } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// Apply apiLimiter as baseline
router.use(apiLimiter);

/**
 * @swagger
 * /api/corporate/dashboard:
 *   get:
 *     tags: ['🏢 Corporate']
 *     summary: B2B HR dashboard stats
 *     description: Returns corporate metrics — total employee rides, CO2 savings, cost center reports, etc. Intended for corporate admin users enrolled in a company cohort.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Corporate dashboard metrics
 *       401:
 *         description: Not authenticated
 */
router.get('/dashboard', isAuthenticated, corporateController.getDashboardStats);

/**
 * @swagger
 * /api/corporate/esg-report:
 *   get:
 *     tags: ['🏢 Corporate']
 *     summary: Generate ESG Carbon Report
 *     description: Generates an Environmental, Social & Governance (ESG) carbon footprint report for the corporate cohort, showing CO2 saved through ride-sharing vs individual commute.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: ESG report data
 */
router.get('/esg-report', isAuthenticated, carbonReportController.generateESGReport);

/**
 * @swagger
 * /api/corporate/locations:
 *   get:
 *     tags: ['🏢 Corporate']
 *     summary: Get corporate geofenced office locations
 *     description: Returns all registered office/tech park locations for the corporate cohort, used to geofence ride matching near office hubs.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: List of corporate office locations
 *   post:
 *     tags: ['🏢 Corporate']
 *     summary: Add a corporate office location
 *     description: Adds a new office location to the corporate cohort's geofencing configuration.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, coordinates]
 *             properties:
 *               name: { type: string, example: 'Whitefield Office Park' }
 *               address: { type: string, example: 'EPIP Zone, Whitefield, Bangalore' }
 *               coordinates:
 *                 type: array
 *                 items: { type: number }
 *                 example: [77.7480, 12.9698]
 *               radius: { type: number, example: 500, description: 'Geofence radius in meters' }
 *     responses:
 *       201:
 *         description: Location added
 */
const corporateLocationController = require('../controllers/corporateLocationController');
router.get('/locations', isAuthenticated, corporateLocationController.getOfficeLocations);
router.post('/locations', isAuthenticated, corporateLocationController.addOfficeLocation);

/**
 * @swagger
 * /api/corporate/enroll:
 *   post:
 *     tags: ['🏢 Corporate']
 *     summary: Enroll in corporate cohort via work email
 *     description: Allows an employee to enroll their LoopLane account into their employer's corporate ride-sharing cohort by verifying their work email domain.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [workEmail]
 *             properties:
 *               workEmail: { type: string, format: email, example: 'ravi.kumar@techmahindra.com' }
 *     responses:
 *       200:
 *         description: Enrolled in corporate cohort
 *       400:
 *         description: Work email domain not registered in any corporate cohort
 */
router.post('/enroll', isAuthenticated, corporateController.enrollEmployee);

module.exports = router;
