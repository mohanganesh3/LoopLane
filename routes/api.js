/**
 * API Routes (External API integrations)
 */

const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const userController = require('../controllers/userController');
const authController = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/auth');
const { apiLimiter, searchLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const uploadMiddleware = require('../middleware/upload');

// All API routes require authentication + rate limiting
router.use(isAuthenticated);
router.use(apiLimiter);

/**
 * @swagger
 * /api/users/profile:
 *   get:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Get user profile (External API)
 *     description: External API endpoint for fetching the authenticated user's profile. Used by third-party integrations.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *   put:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Update user profile (External API)
 *     description: External API endpoint for updating user profile with optional profile photo upload.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ProfileUpdateRequest'
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.get('/users/profile', userController.getProfileAPI);
router.put('/users/profile',
    uploadLimiter,
    uploadMiddleware.fields([{ name: 'profilePhoto', maxCount: 1 }]),
    userController.updateProfile
);

/**
 * @swagger
 * /api/users/change-password:
 *   post:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Change password (External API)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed
 */
router.post('/users/change-password', authController.changePassword);

/**
 * @swagger
 * /api/users/account:
 *   delete:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Delete account (External API)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 */
router.delete('/users/account', userController.deleteAccount);

/**
 * @swagger
 * /api/geocode:
 *   get:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Geocode an address to lat/lng
 *     description: Converts a human-readable address to geographic coordinates. Rate limited as it calls an external geocoding API.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema: { type: string }
 *         example: 'Koramangala, Bangalore'
 *     responses:
 *       200:
 *         description: Geographic coordinates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 lat: { type: number, example: 12.9352 }
 *                 lng: { type: number, example: 77.6296 }
 *                 formattedAddress: { type: string }
 */
router.get('/geocode', searchLimiter, apiController.geocodeAddress);

/**
 * @swagger
 * /api/reverse-geocode:
 *   get:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Reverse geocode lat/lng to address
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: lat
 *         required: true
 *         schema: { type: number }
 *         example: 12.9352
 *       - in: query
 *         name: lng
 *         required: true
 *         schema: { type: number }
 *         example: 77.6296
 *     responses:
 *       200:
 *         description: Address for the coordinates
 */
router.get('/reverse-geocode', searchLimiter, apiController.reverseGeocode);

/**
 * @swagger
 * /api/route:
 *   post:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Get driving route between two points
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [origin, destination]
 *             properties:
 *               origin: { type: array, items: { type: number }, example: [77.6296, 12.9352] }
 *               destination: { type: array, items: { type: number }, example: [77.7480, 12.9698] }
 *               mode: { type: string, enum: [driving, walking, transit], default: 'driving' }
 *     responses:
 *       200:
 *         description: Route path, distance, and duration
 */
router.post('/route', apiController.getRoute);

/**
 * @swagger
 * /api/distance-matrix:
 *   post:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Get distance matrix between multiple points
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               origins: { type: array, items: { type: array, items: { type: number } } }
 *               destinations: { type: array, items: { type: array, items: { type: number } } }
 *     responses:
 *       200:
 *         description: Distance and duration matrix
 */
router.post('/distance-matrix', apiController.getDistanceMatrix);

/**
 * @swagger
 * /api/snap-to-road:
 *   post:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Snap GPS points to nearest road
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               points: { type: array, items: { type: array, items: { type: number } } }
 *     responses:
 *       200:
 *         description: Road-snapped coordinates
 */
router.post('/snap-to-road', apiController.snapToRoad);

/**
 * @swagger
 * /api/autocomplete:
 *   get:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Location search autocomplete
 *     description: Returns autocomplete suggestions for a location search query. Rate limited for high-frequency use.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema: { type: string }
 *         example: 'Kormangala 5th'
 *       - in: query
 *         name: lat
 *         schema: { type: number }
 *         description: User's current lat for proximity bias
 *       - in: query
 *         name: lng
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Autocomplete suggestions
 */
router.get('/autocomplete', searchLimiter, apiController.autocomplete);

/**
 * @swagger
 * /api/eta:
 *   get:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Calculate ETA between two points
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *         example: '12.9352,77.6296'
 *       - in: query
 *         name: to
 *         schema: { type: string }
 *         example: '12.9698,77.7480'
 *     responses:
 *       200:
 *         description: Estimated time of arrival
 */
router.get('/eta', apiController.calculateETA);

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Get notifications (recent)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Recent notifications
 */
router.get('/notifications', apiController.getNotifications);

/**
 * @swagger
 * /api/notifications/all:
 *   get:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Get all notifications (paginated)
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: All notifications
 */
router.get('/notifications/all', apiController.getAllNotifications);

/**
 * @swagger
 * /api/notifications/count:
 *   get:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Get unread notification count
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Unread count
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 count: { type: integer, example: 3 }
 */
router.get('/notifications/count', apiController.getNotificationCount);

/**
 * @swagger
 * /api/notifications/{notificationId}/read:
 *   post:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Mark notification as read
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Marked as read
 */
router.post('/notifications/:notificationId/read', apiController.markNotificationAsRead);

/**
 * @swagger
 * /api/notifications/mark-all-read:
 *   post:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Mark all notifications as read
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 */
router.post('/notifications/mark-all-read', apiController.markAllNotificationsAsRead);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   delete:
 *     tags: ['🗺️ Geocoding & Notifications']
 *     summary: Delete a notification
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Notification deleted
 */
router.delete('/notifications/:notificationId', apiController.deleteNotification);

module.exports = router;
