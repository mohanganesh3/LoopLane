/**
 * SOS Emergency Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const sosController = require('../controllers/sosController');
const { isAuthenticated, isAdminOrEmployee, hasPermission } = require('../middleware/auth');
const { sosLimiter, apiLimiter } = require('../middleware/rateLimiter');

// Apply apiLimiter as baseline for all SOS routes
router.use(apiLimiter);

/**
 * @swagger
 * /api/sos/trigger:
 *   post:
 *     tags: ['🆘 SOS']
 *     summary: Trigger emergency SOS alert
 *     description: |
 *       Immediately sends an emergency alert to:
 *       - All admin/support staff
 *       - The user's emergency contacts
 *       - Police (if configured)
 *       
 *       **Strictly rate limited** to prevent accidental triggers.
 *       
 *       ⚠️ This triggers real notifications. Only use in genuine emergencies.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TriggerSOSRequest'
 *     responses:
 *       200:
 *         description: Emergency alert sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string, example: 'Emergency alert sent. Help is on the way.' }
 *                 emergencyId: { type: string }
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/trigger', isAuthenticated, sosLimiter, sosController.triggerEmergency);

/**
 * @swagger
 * /api/sos/status:
 *   get:
 *     tags: ['🆘 SOS']
 *     summary: Get active emergency status
 *     description: Returns the status of the user's currently active emergency alert, if any.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Emergency status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 hasActiveEmergency: { type: boolean }
 *                 emergency:
 *                   type: object
 *                   properties:
 *                     _id: { type: string }
 *                     status: { type: string, enum: [ACTIVE, ESCALATED, RESOLVED] }
 *                     createdAt: { type: string, format: date-time }
 */
router.get('/status', isAuthenticated, sosController.getEmergencyStatus);

/**
 * @swagger
 * /api/sos/{emergencyId}/cancel:
 *   post:
 *     tags: ['🆘 SOS']
 *     summary: Cancel emergency (false alarm)
 *     description: Cancels the emergency alert and notifies responders that it was a false alarm.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: emergencyId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, example: 'Accidentally triggered' }
 *     responses:
 *       200:
 *         description: Emergency cancelled
 */
router.post('/:emergencyId/cancel', isAuthenticated, sosLimiter, sosController.cancelEmergency);

/**
 * @swagger
 * /api/sos/{emergencyId}:
 *   get:
 *     tags: ['🆘 SOS']
 *     summary: Get emergency details
 *     description: Returns full details of an emergency alert. Only the user who triggered it can view it (admins have separate endpoint).
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: emergencyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Emergency details
 *       403:
 *         description: Not authorized to view this emergency
 */
router.get('/:emergencyId', isAuthenticated, sosController.getEmergencyDetails);

/**
 * @swagger
 * /api/sos/admin/all:
 *   get:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: List all emergencies (Admin — manage_reports)
 *     description: |
 *       Returns all emergency alerts across all users with filters.
 *       
 *       **⚠️ Admin/Employee only** — requires `manage_reports` permission
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, ESCALATED, RESOLVED, CANCELLED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: All emergencies
 *       403:
 *         description: Insufficient permissions (requires manage_reports)
 */
router.get('/admin/all', isAuthenticated, isAdminOrEmployee, hasPermission('manage_reports'), sosController.getAllEmergencies);

/**
 * @swagger
 * /api/sos/admin/active:
 *   get:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Get all active emergencies (Admin — manage_reports)
 *     description: Returns only ACTIVE and ESCALATED emergencies requiring immediate attention. **Admin/Employee only.**
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Active emergencies
 *       403:
 *         description: Insufficient permissions
 */
router.get('/admin/active', isAuthenticated, isAdminOrEmployee, hasPermission('manage_reports'), sosController.getActiveEmergencies);

/**
 * @swagger
 * /api/sos/admin/stats:
 *   get:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Emergency statistics (Admin — manage_reports)
 *     description: Returns aggregated emergency statistics (total, by type, resolution rates). **Admin/Employee only.**
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Emergency stats
 *       403:
 *         description: Insufficient permissions
 */
router.get('/admin/stats', isAuthenticated, isAdminOrEmployee, hasPermission('manage_reports'), sosController.getEmergencyStats);

/**
 * @swagger
 * /api/sos/admin/{emergencyId}/update:
 *   post:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Update emergency status (Admin — manage_reports)
 *     description: Admin updates the status of an emergency alert (e.g., mark as INVESTIGATING or RESOLVED). **Admin/Employee only.**
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: emergencyId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [INVESTIGATING, RESOLVED, CLOSED], example: 'RESOLVED' }
 *               notes: { type: string, example: 'Police verified, situation resolved' }
 *     responses:
 *       200:
 *         description: Emergency updated
 *       403:
 *         description: Insufficient permissions
 */
router.post('/admin/:emergencyId/update', isAuthenticated, isAdminOrEmployee, hasPermission('manage_reports'), sosController.updateEmergencyStatus);

/**
 * @swagger
 * /api/sos/admin/{emergencyId}/escalate:
 *   post:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Escalate emergency to CRITICAL (Admin — manage_reports)
 *     description: |
 *       Escalates an emergency to CRITICAL status.
 *       - Notifies ALL admins immediately
 *       - Sends critical warning to the driver via socket
 *       - Notifies all emergency contacts
 *       
 *       **Admin/Employee only — manage_reports permission required.**
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: emergencyId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Emergency escalated to CRITICAL
 *       403:
 *         description: Insufficient permissions
 */
router.post('/admin/:emergencyId/escalate', isAuthenticated, isAdminOrEmployee, hasPermission('manage_reports'), sosController.escalateEmergency);

module.exports = router;
