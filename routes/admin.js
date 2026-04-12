/**
 * Admin Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const reportController = require('../controllers/reportController');
const employeeController = require('../controllers/employeeController');
const geospatialController = require('../controllers/geospatialController');
const aiController = require('../controllers/aiController');
const RouteDeviation = require('../models/RouteDeviation');
const { isAuthenticated, isAdminOrEmployee, hasPermission } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

router.use(isAuthenticated);
router.use(isAdminOrEmployee);
router.use(apiLimiter);

router.use(async (req, res, next) => {
    try {
        const unresolvedDeviations = await RouteDeviation.countDocuments({
            status: { $in: ['ACTIVE', 'ESCALATED'] }
        });
        req.unresolvedDeviations = unresolvedDeviations;
    } catch (error) {
        req.unresolvedDeviations = 0;
    }
    next();
});

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/stats:
 *   get:
 *     tags: ['🛡️ Admin — Dashboard']
 *     summary: Platform dashboard statistics
 *     description: "⚠️ **ADMIN/EMPLOYEE ONLY** — Returns key platform metrics: total users, active rides, bookings, revenue, trust score average."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *       403:
 *         description: Admin or employee access required
 */
router.get('/stats', adminController.getDashboardStats);

/**
 * @swagger
 * /api/admin/safety-metrics:
 *   get:
 *     tags: ['🛡️ Admin — Dashboard']
 *     summary: Safety KPIs
 *     description: "⚠️ **ADMIN/EMPLOYEE ONLY** — SOS count, route deviations, report resolution rate, avg response times."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Safety metrics
 */
router.get('/safety-metrics', adminController.getSafetyMetrics);

/**
 * @swagger
 * /api/admin/notifications:
 *   get:
 *     tags: ['🛡️ Admin — Dashboard']
 *     summary: Admin notifications
 *     description: "⚠️ **ADMIN/EMPLOYEE ONLY** — Notifications for the admin panel (new reports, SOS alerts, verifications pending)."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Admin notifications list
 */
router.get('/notifications', adminController.getNotifications);

/**
 * @swagger
 * /api/admin/notifications/{notificationId}/read:
 *   post:
 *     tags: ['🛡️ Admin — Dashboard']
 *     summary: Mark admin notification as read
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Marked as read
 */
router.post('/notifications/:notificationId/read', adminController.markNotificationAsRead);

/**
 * @swagger
 * /api/admin/system-health:
 *   get:
 *     tags: ['🛡️ Admin — Dashboard']
 *     summary: System health metrics
 *     description: "⚠️ **ADMIN/EMPLOYEE ONLY** — DB connection status, API latencies, queue depths, error rates."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: System health data
 */
router.get('/system-health', adminController.getSystemHealth);

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     tags: ['👥 Admin — Users']
 *     summary: List all users
 *     description: "⚠️ **manage_users** — Paginated list of all platform users with filter/search support."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [PASSENGER, RIDER, ALL] }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, SUSPENDED, DELETED] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name, email or phone
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Users list with pagination
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AdminUserListResponse'
 *       403:
 *         description: Requires manage_users permission
 */
router.get('/users', hasPermission('manage_users'), adminController.getUsers);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   get:
 *     tags: ['👥 Admin — Users']
 *     summary: Get user details
 *     description: "⚠️ **manage_users** — Full user profile including rides history, bookings, reports, trust score."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Full user details
 *       404:
 *         description: User not found
 */
router.get('/users/:id', hasPermission('manage_users'), adminController.getUserDetails);

/**
 * @swagger
 * /api/admin/users/{id}/status:
 *   patch:
 *     tags: ['👥 Admin — Users']
 *     summary: Update user account status
 *     description: "⚠️ **manage_users** — Set user status to ACTIVE, SUSPENDED, or DELETED."
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
 *             $ref: '#/components/schemas/UpdateUserStatusRequest'
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/users/:id/status', hasPermission('manage_users'), adminController.updateUserStatus);

/**
 * @swagger
 * /api/admin/users/{id}/suspend:
 *   post:
 *     tags: ['👥 Admin — Users']
 *     summary: Suspend a user
 *     description: "⚠️ **manage_users** — Temporarily or permanently suspends a user account."
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
 *             $ref: '#/components/schemas/SuspendUserRequest'
 *     responses:
 *       200:
 *         description: User suspended
 */
router.post('/users/:id/suspend', hasPermission('manage_users'), adminController.suspendUser);

/**
 * @swagger
 * /api/admin/users/{id}/activate:
 *   post:
 *     tags: ['👥 Admin — Users']
 *     summary: Activate a suspended user
 *     description: "⚠️ **manage_users** — Lifts suspension and restores user access."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User activated
 */
router.post('/users/:id/activate', hasPermission('manage_users'), adminController.activateUser);

/**
 * @swagger
 * /api/admin/users/{id}:
 *   delete:
 *     tags: ['👥 Admin — Users']
 *     summary: Delete a user (soft delete)
 *     description: "⚠️ **manage_users** — Marks user as DELETED. Data is retained for audit purposes."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User deleted
 */
router.delete('/users/:id', hasPermission('manage_users'), adminController.deleteUser);

// ─── VERIFICATIONS ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/verifications/pending:
 *   get:
 *     tags: ['👥 Admin — Users']
 *     summary: List pending rider verifications
 *     description: "⚠️ **manage_users** — Lists riders whose document submissions are awaiting admin review."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Pending verification list
 */
router.get('/verifications/pending', hasPermission('manage_users'), adminController.getPendingVerifications);

/**
 * @swagger
 * /api/admin/verifications/{userId}/verify:
 *   post:
 *     tags: ['👥 Admin — Users']
 *     summary: Approve rider verification
 *     description: "⚠️ **manage_users** — Marks rider docs as verified. Rider can now post rides."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string, example: 'All documents clear. License valid until 2028.' }
 *     responses:
 *       200:
 *         description: Rider verified
 */
router.post('/verifications/:userId/verify', hasPermission('manage_users'), adminController.approveVerification);

/**
 * @swagger
 * /api/admin/verifications/{userId}/reject:
 *   post:
 *     tags: ['👥 Admin — Users']
 *     summary: Reject rider verification
 *     description: "⚠️ **manage_users** — Rejects rider docs with a reason. Rider is notified to resubmit."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, example: 'License image is blurry. Please reupload.' }
 *     responses:
 *       200:
 *         description: Verification rejected
 */
router.post('/verifications/:userId/reject', hasPermission('manage_users'), adminController.rejectVerification);

// ─── RIDES MANAGEMENT ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/rides:
 *   get:
 *     tags: ['🚘 Admin — Rides']
 *     summary: List all rides on the platform
 *     description: "⚠️ **manage_rides** — All rides with filters for status, date, route, rider."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, COMPLETED, CANCELLED, IN_PROGRESS] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Rides list
 */
router.get('/rides', hasPermission('manage_rides'), adminController.getRides);

/**
 * @swagger
 * /api/admin/rides/{rideId}:
 *   get:
 *     tags: ['🚘 Admin — Rides']
 *     summary: Get ride details
 *     description: "⚠️ **manage_rides** — Full ride details with all bookings, route, rider info."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ride details
 */
router.get('/rides/:rideId', hasPermission('manage_rides'), adminController.getRideDetails);

/**
 * @swagger
 * /api/admin/rides/{rideId}/cancel:
 *   post:
 *     tags: ['🚘 Admin — Rides']
 *     summary: Admin cancel a ride
 *     description: "⚠️ **manage_rides** — Force cancels a ride and refunds all passengers."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, example: 'Safety concern reported' }
 *     responses:
 *       200:
 *         description: Ride cancelled and passengers refunded
 */
router.post('/rides/:rideId/cancel', hasPermission('manage_rides'), adminController.cancelRide);

// ─── BOOKINGS MANAGEMENT ──────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/bookings:
 *   get:
 *     tags: ['🚘 Admin — Rides']
 *     summary: List all bookings
 *     description: "⚠️ **manage_rides** — Platform-wide bookings with filters."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Bookings list
 */
router.get('/bookings', hasPermission('manage_rides'), adminController.getBookings);

/**
 * @swagger
 * /api/admin/bookings/{bookingId}:
 *   get:
 *     tags: ['🚘 Admin — Rides']
 *     summary: Get booking details
 *     description: "⚠️ **manage_rides** — Full booking details with payment status, OTP logs, timeline."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Booking details
 */
router.get('/bookings/:bookingId', hasPermission('manage_rides'), adminController.getBookingDetails);
router.post('/bookings/:bookingId/refund', hasPermission('manage_finances'), adminController.refundBooking);

/**
 * @swagger
 * /api/admin/bookings/{bookingId}/invoice:
 *   get:
 *     tags: ['💰 Admin — Finance']
 *     summary: Generate invoice for a booking
 *     description: "⚠️ **manage_finances** — Generates a PDF invoice for a completed booking."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice generated (PDF or JSON)
 */
router.get('/bookings/:bookingId/invoice', hasPermission('manage_finances'), adminController.generateInvoice);

// ─── REPORTS ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/reports:
 *   get:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: List all user reports/complaints
 *     description: "⚠️ **manage_reports** — All platform reports with filters by type, status, severity."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [OPEN, INVESTIGATING, RESOLVED, CLOSED] }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [HARASSMENT, UNSAFE_DRIVING, FRAUD, NO_SHOW, OTHER] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Reports list
 */
router.get('/reports', hasPermission('manage_reports'), adminController.getReports);

/**
 * @swagger
 * /api/admin/reports/{reportId}:
 *   get:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Get report details
 *     description: "⚠️ **manage_reports** — Full report with timeline, messages, evidence, related ride/booking."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Report details
 */
router.get('/reports/:reportId', hasPermission('manage_reports'), adminController.getReportDetails);

/**
 * @swagger
 * /api/admin/reports/{reportId}/action:
 *   post:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Take action on a report
 *     description: "⚠️ **manage_reports** — Admin takes action (suspend user, issue warning, close report, etc.)."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string, enum: [SUSPEND_USER, WARN_USER, CLOSE, ESCALATE], example: 'WARN_USER' }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Action taken
 */
router.post('/reports/:reportId/action', hasPermission('manage_reports'), adminController.takeReportAction);

/**
 * @swagger
 * /api/admin/reports/{reportId}/message:
 *   post:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Add admin message to a report
 *     description: "⚠️ **manage_reports** — Admin sends a message to the report submitter."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: Message sent
 */
router.post('/reports/:reportId/message', hasPermission('manage_reports'), reportController.addMessage);
router.post('/reports/:reportId/refund', hasPermission('manage_finances'), adminController.issueReportRefund);

/**
 * @swagger
 * /api/admin/reports/{reportId}/timeline:
 *   post:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Add investigation event to timeline
 *     description: "⚠️ **manage_reports** — Appends a timestamped investigation note to the report's audit timeline."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               event: { type: string, example: 'Called rider for statement' }
 *     responses:
 *       200:
 *         description: Event added
 */
router.post('/reports/:reportId/timeline', hasPermission('manage_reports'), adminController.addInvestigationEvent);

/**
 * @swagger
 * /api/admin/reports/{reportId}/playbook:
 *   post:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Update playbook progress
 *     description: "⚠️ **manage_reports** — Updates checklist progress for the report's standard operating playbook."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               step: { type: string }
 *               completed: { type: boolean }
 *     responses:
 *       200:
 *         description: Playbook updated
 */
router.post('/reports/:reportId/playbook', hasPermission('manage_reports'), adminController.updatePlaybookProgress);

// ─── EMERGENCIES ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/emergencies:
 *   get:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: List all platform emergencies
 *     description: "⚠️ **manage_reports** — All SOS alerts with status filters."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Emergencies list
 */
router.get('/emergencies', hasPermission('manage_reports'), adminController.getEmergencies);

/**
 * @swagger
 * /api/admin/emergencies/{emergencyId}/resolve:
 *   post:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Resolve an emergency
 *     description: "⚠️ **manage_reports** — Marks an emergency as resolved with admin notes."
 *     security:
 *       - BearerAuth: []
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
 *               notes: { type: string, example: 'Police confirmed. Passenger safe.' }
 *     responses:
 *       200:
 *         description: Emergency resolved
 */
router.post('/emergencies/:emergencyId/resolve', hasPermission('manage_reports'), adminController.resolveEmergency);

// ─── ANALYTICS ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/analytics/revenue:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Revenue report
 *     description: "⚠️ **manage_finances** — Platform revenue breakdown by period, route, and user segment."
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
 *         description: Revenue report data
 */
router.get('/analytics/revenue', hasPermission('manage_finances'), adminController.getRevenueReport);

/**
 * @swagger
 * /api/admin/analytics/activity:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Platform activity report
 *     description: "⚠️ **ADMIN/EMPLOYEE** — DAU, MAU, ride frequency, booking conversion rates."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Activity metrics
 */
router.get('/analytics/activity', adminController.getActivityReport);

/**
 * @swagger
 * /api/admin/analytics/bird-eye:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Bird-eye geospatial map data
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Heatmap data for rides/demand across the city grid."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Geospatial heatmap data
 */
router.get('/analytics/bird-eye', geospatialController.getBirdEyeData);

/**
 * @swagger
 * /api/admin/analytics/godseye:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: God's Eye real-time view
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Live view of all active rides and driver positions across the city."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time city view data
 */
router.get('/analytics/godseye', geospatialController.getGodsEyeData);
router.get('/analytics/isochrone', geospatialController.getIsochrone);
router.get('/analytics/weather', geospatialController.getWeatherGrid);
router.get('/analytics/forecast', geospatialController.getSupplyForecast);
router.get('/analytics/ride-analytics', geospatialController.getRideAnalytics);

/**
 * @swagger
 * /api/admin/analytics/rides:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Ride KPI analytics
 *     description: "⚠️ **manage_rides** — Ride counts, cancellation rates, avg trip duration, seat utilization."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Ride analytics
 */
router.get('/analytics/rides', hasPermission('manage_rides'), adminController.getRideAnalytics);

/**
 * @swagger
 * /api/admin/analytics/user-revenue:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Per-user revenue breakdown
 *     description: "⚠️ **manage_finances** — Revenue attributed to top riders and passengers."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User revenue data
 */
router.get('/analytics/user-revenue', hasPermission('manage_finances'), adminController.getUserRevenue);

/**
 * @swagger
 * /api/admin/analytics/routes:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Route analytics
 *     description: "⚠️ **manage_rides** — Most traveled routes, avg fares by corridor."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Route analytics
 */
router.get('/analytics/routes', hasPermission('manage_rides'), adminController.getRouteAnalytics);

/**
 * @swagger
 * /api/admin/analytics/areas:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Area-level analytics
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Demand/supply metrics broken down by city area."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Area analytics
 */
router.get('/analytics/areas', adminController.getAreaAnalytics);

/**
 * @swagger
 * /api/admin/analytics/comparison:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Period-over-period comparison
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Week-over-week, month-over-month comparison of key metrics."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Period comparison data
 */
router.get('/analytics/comparison', adminController.getPeriodComparison);

/**
 * @swagger
 * /api/admin/analytics/cancellations:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Cancellation analytics
 *     description: "⚠️ **manage_reports** — Cancellation rates, reasons breakdown, repeat cancellers."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Cancellation analytics
 */
router.get('/analytics/cancellations', hasPermission('manage_reports'), adminController.getCancellationAnalytics);
router.get('/analytics/funnel', hasPermission('manage_finances'), adminController.getConversionFunnel);
router.get('/analytics/unbooked-routes', hasPermission('manage_rides'), adminController.getUnbookedRoutesInsight);

/**
 * @swagger
 * /api/admin/analytics/trigger-batch-match:
 *   post:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Trigger batch matching algorithm
 *     description: "⚠️ **manage_rides** — Manually triggers the batch ride-passenger matching job."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Batch match triggered
 */
router.post('/analytics/trigger-batch-match', hasPermission('manage_rides'), adminController.triggerBatchMatch);

/**
 * @swagger
 * /api/admin/analytics/demand-supply:
 *   get:
 *     tags: ['📊 Admin — Analytics']
 *     summary: Demand and supply analytics
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Real-time and historical demand vs supply curve analysis."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Demand-supply analytics
 */
router.get('/analytics/demand-supply', adminController.getDemandSupplyAnalytics);
router.get('/analytics/user-ltv', adminController.getUserLTVAnalytics);

/**
 * @swagger
 * /api/admin/analytics/fraud-detect:
 *   post:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Trigger fraud detection scan
 *     description: "⚠️ **manage_reports** — Runs ML-based fraud detection across recent transactions."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Fraud scan results
 */
router.post('/analytics/fraud-detect', hasPermission('manage_reports'), adminController.triggerFraudDetection);

/**
 * @swagger
 * /api/admin/analytics/churn-predict:
 *   post:
 *     tags: ['🚨 Admin — Reports & Emergencies']
 *     summary: Trigger churn prediction
 *     description: "⚠️ **manage_reports** — Identifies users at high risk of churning for targeted retention campaigns."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Churn prediction results with at-risk user segments
 */
router.post('/analytics/churn-predict', hasPermission('manage_reports'), adminController.triggerChurnPrediction);

// ─── SETTINGS ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/settings:
 *   get:
 *     tags: ['⚙️ Admin — Settings']
 *     summary: Get platform settings
 *     description: "⚠️ **manage_settings** — All platform configuration: feature toggles, fee structures, limits."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Platform settings object
 *   put:
 *     tags: ['⚙️ Admin — Settings']
 *     summary: Update platform settings
 *     description: "⚠️ **manage_settings** — Updates platform configuration. Changes take effect immediately."
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminSettingsUpdateRequest'
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.get('/settings', hasPermission('manage_settings'), adminController.getSettings);
router.put('/settings', hasPermission('manage_settings'), adminController.updateSettings);

/**
 * @swagger
 * /api/admin/settings/audit:
 *   get:
 *     tags: ['⚙️ Admin — Settings']
 *     summary: Settings audit log
 *     description: "⚠️ **manage_settings** — History of all settings changes with who made them and when."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Settings audit trail
 */
router.get('/settings/audit', hasPermission('manage_settings'), adminController.getSettingsAudit);

/**
 * @swagger
 * /api/admin/sustainability:
 *   get:
 *     tags: ['⚙️ Admin — Settings']
 *     summary: Sustainability dashboard
 *     description: "⚠️ **manage_reports** — Platform-wide CO2 savings, green ride metrics, ESG summary."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Sustainability metrics
 */
router.get('/sustainability', hasPermission('manage_reports'), adminController.getSustainabilityData);

// ─── EMPLOYEES ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/employees:
 *   get:
 *     tags: ['👥 Admin — Users']
 *     summary: List all employees
 *     description: "⚠️ **manage_users** — Lists all employee accounts with their permissions and status."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Employees list
 *   post:
 *     tags: ['👥 Admin — Users']
 *     summary: Create employee account
 *     description: "⚠️ **manage_users** — Creates a new employee with scoped permissions."
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEmployeeRequest'
 *     responses:
 *       201:
 *         description: Employee created
 */
router.get('/employees/stats', hasPermission('manage_users'), employeeController.getEmployeeStats);
router.get('/employees/permissions', hasPermission('manage_users'), employeeController.getPermissions);
router.get('/employees/hex-coverage', hasPermission('manage_users'), employeeController.getHexCoverage);
router.get('/employees', hasPermission('manage_users'), employeeController.listEmployees);
router.post('/employees', hasPermission('manage_users'), employeeController.createEmployee);

/**
 * @swagger
 * /api/admin/employees/{id}:
 *   get:
 *     tags: ['👥 Admin — Users']
 *     summary: Get employee details
 *     description: "⚠️ **manage_users** — Employee profile, permissions, activity log."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Employee details
 *   put:
 *     tags: ['👥 Admin — Users']
 *     summary: Update employee
 *     description: "⚠️ **manage_users** — Update employee details and permissions."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateEmployeeRequest'
 *     responses:
 *       200:
 *         description: Employee updated
 *   delete:
 *     tags: ['👥 Admin — Users']
 *     summary: Deactivate employee
 *     description: "⚠️ **manage_users** — Deactivates employee account. They lose panel access."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Employee deactivated
 */
router.get('/employees/:id', hasPermission('manage_users'), employeeController.getEmployee);
router.put('/employees/:id', hasPermission('manage_users'), employeeController.updateEmployee);
router.patch('/employees/:id/status', hasPermission('manage_users'), employeeController.updateEmployeeStatus);
router.patch('/employees/:id/onboarding', hasPermission('manage_users'), employeeController.updateOnboarding);
router.delete('/employees/:id', hasPermission('manage_users'), employeeController.deactivateEmployee);

/**
 * @swagger
 * /api/admin/audit-logs:
 *   get:
 *     tags: ['👥 Admin — Users']
 *     summary: Employee audit logs
 *     description: "⚠️ **manage_users** — All admin actions taken by employees with timestamps and context."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Audit logs
 */
router.get('/audit-logs', hasPermission('manage_users'), employeeController.getAuditLogs);

// ─── FINANCE ──────────────────────────────────────────────────────────────────

router.get('/export', hasPermission('manage_finances'), adminController.exportData);
router.post('/payments/simulate', hasPermission('manage_finances'), adminController.simulatePayment);
router.post('/settlements/batch', hasPermission('manage_finances'), adminController.batchSettlement);

// ─── PROMO CODES ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/promo-codes:
 *   get:
 *     tags: ['💰 Admin — Finance']
 *     summary: List all promo codes
 *     description: "⚠️ **manage_finances** — All promo codes with usage stats."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Promo codes list
 *   post:
 *     tags: ['💰 Admin — Finance']
 *     summary: Create promo code
 *     description: "⚠️ **manage_finances** — Creates a new promo/discount code."
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PromoCodeRequest'
 *     responses:
 *       201:
 *         description: Promo code created
 */
router.get('/promo-codes', hasPermission('manage_finances'), adminController.getPromoCodes);
router.post('/promo-codes', hasPermission('manage_finances'), adminController.createPromoCode);

/**
 * @swagger
 * /api/admin/promo-codes/{id}:
 *   put:
 *     tags: ['💰 Admin — Finance']
 *     summary: Update promo code
 *     description: "⚠️ **manage_finances** — Updates promo code details."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PromoCodeRequest'
 *     responses:
 *       200:
 *         description: Promo code updated
 *   delete:
 *     tags: ['💰 Admin — Finance']
 *     summary: Delete promo code
 *     description: "⚠️ **manage_finances** — Permanently deletes a promo code."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Promo code deleted
 */
router.put('/promo-codes/:id', hasPermission('manage_finances'), adminController.updatePromoCode);
router.delete('/promo-codes/:id', hasPermission('manage_finances'), adminController.deletePromoCode);

/**
 * @swagger
 * /api/admin/promo-codes/{id}/toggle:
 *   post:
 *     tags: ['💰 Admin — Finance']
 *     summary: Enable or disable promo code
 *     description: "⚠️ **manage_finances** — Toggles a promo code between active and inactive state."
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Promo code toggled
 */
router.post('/promo-codes/:id/toggle', hasPermission('manage_finances'), adminController.togglePromoCode);

/**
 * @swagger
 * /api/admin/notifications/bulk:
 *   post:
 *     tags: ['👥 Admin — Users']
 *     summary: Send bulk notification to users
 *     description: "⚠️ **manage_users** — Sends push/in-app notifications to a filtered segment of users."
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title: { type: string, example: 'LoopLane Update' }
 *               body: { type: string, example: 'New feature: Route Alerts are now live!' }
 *               targetRole: { type: string, enum: [ALL, PASSENGER, RIDER], default: 'ALL' }
 *               targetArea: { type: string, example: 'Bangalore' }
 *     responses:
 *       200:
 *         description: Notifications queued for delivery
 */
router.post('/notifications/bulk', hasPermission('manage_users'), adminController.sendBulkNotification);

// ─── AI ───────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/admin/ai/insights:
 *   post:
 *     tags: ['🤖 Admin — AI']
 *     summary: Get AI insight (Gemini)
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Ask Gemini for a natural-language insight about a specific metric or dataset."
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query: { type: string, example: 'Why did cancellations spike on Monday?' }
 *               context: { type: object, description: 'Relevant data to include' }
 *     responses:
 *       200:
 *         description: AI-generated insight text
 */
router.post('/ai/insights', aiController.getAIInsight);

/**
 * @swagger
 * /api/admin/ai/batch-insights:
 *   post:
 *     tags: ['🤖 Admin — AI']
 *     summary: Batch AI insights
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Send multiple queries to Gemini in one request."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Array of AI insights
 */
router.post('/ai/batch-insights', aiController.getBatchInsights);

/**
 * @swagger
 * /api/admin/ai/explain-anomaly:
 *   post:
 *     tags: ['🤖 Admin — AI']
 *     summary: Explain a detected anomaly
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Asks Gemini to explain an anomaly detected in the metrics."
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               anomalyType: { type: string, example: 'revenue_drop' }
 *               data: { type: object }
 *     responses:
 *       200:
 *         description: Anomaly explanation
 */
router.post('/ai/explain-anomaly', aiController.explainAnomaly);

/**
 * @swagger
 * /api/admin/ai/dashboard-narrative:
 *   get:
 *     tags: ['🤖 Admin — AI']
 *     summary: AI-generated dashboard narrative
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Gemini generates a human-readable summary of today's dashboard metrics."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Narrative text
 */
router.get('/ai/dashboard-narrative', aiController.getDashboardNarrative);

/**
 * @swagger
 * /api/admin/ai/chat:
 *   post:
 *     tags: ['🤖 Admin — AI']
 *     summary: AI Operations Agent — chat
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Full conversational AI agent with function calling. Can query live data, suggest actions, and explain platform state."
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, example: 'Show me top 5 routes by revenue this week' }
 *               sessionId: { type: string, description: 'Conversation session ID for context continuity' }
 *     responses:
 *       200:
 *         description: AI response with optional function call results
 */
router.post('/ai/chat', aiController.aiChat);

/**
 * @swagger
 * /api/admin/ai/chat/stream:
 *   post:
 *     tags: ['🤖 Admin — AI']
 *     summary: AI chat — streaming response
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Streaming version of the AI chat endpoint. Returns Server-Sent Events (SSE)."
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *     responses:
 *       200:
 *         description: SSE stream of AI response tokens
 */
router.post('/ai/chat/stream', aiController.aiChatStream);

/**
 * @swagger
 * /api/admin/ai/chat/history:
 *   delete:
 *     tags: ['🤖 Admin — AI']
 *     summary: Clear AI chat history
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Clears the AI chat session history for the current admin."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Chat history cleared
 */
router.delete('/ai/chat/history', aiController.clearAIChatHistory);

/**
 * @swagger
 * /api/admin/ai/chat/suggestions:
 *   get:
 *     tags: ['🤖 Admin — AI']
 *     summary: Get AI suggested queries
 *     description: "⚠️ **ADMIN/EMPLOYEE** — Returns contextual suggested questions for the AI ops agent based on current platform state."
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: List of suggested queries
 */
router.get('/ai/chat/suggestions', aiController.getAISuggestions);

module.exports = router;
