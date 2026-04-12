/**
 * Tracking Routes - API Only (React SPA)
 * Real-time ride tracking functionality
 */

const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { isAuthenticated } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');

// All tracking routes require authentication + rate limiting
router.use(isAuthenticated);
router.use(apiLimiter);

/**
 * @swagger
 * /api/tracking/{bookingId}:
 *   get:
 *     tags: ['📍 Tracking']
 *     summary: Get live tracking data for a booking
 *     description: Returns the rider's current GPS coordinates and route progress for a given booking. Used by passengers to track their ride in real-time. Both passenger and rider of the booking can access.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the booking to track
 *     responses:
 *       200:
 *         description: Current tracking data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 tracking:
 *                   type: object
 *                   properties:
 *                     currentLocation:
 *                       type: object
 *                       properties:
 *                         lat: { type: number, example: 12.9698 }
 *                         lng: { type: number, example: 77.7480 }
 *                         accuracy: { type: number }
 *                         updatedAt: { type: string, format: date-time }
 *                     heading: { type: number, example: 180 }
 *                     speed: { type: number, example: 45 }
 *                     eta: { type: string, format: date-time }
 *       403:
 *         description: Not a participant of this booking
 *       404:
 *         description: Booking not found
 */
router.get('/:bookingId', trackingController.getTrackingData);

/**
 * @swagger
 * /api/tracking/{rideId}/location:
 *   post:
 *     tags: ['📍 Tracking']
 *     summary: Update driver location (Rider — real-time)
 *     description: |
 *       Rider pushes their current GPS coordinates for live tracking.
 *       This is separate from the ride location update; this one updates the tracking record used by passengers.
 *       Should be called every 5-10 seconds during active rides.
 *       
 *       **Only the rider of the ride can call this.**
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat: { type: number, example: 12.9698 }
 *               lng: { type: number, example: 77.7480 }
 *               accuracy: { type: number, example: 5 }
 *               heading: { type: number, example: 180 }
 *               speed: { type: number, example: 45 }
 *     responses:
 *       200:
 *         description: Location updated and broadcast to passengers via WebSocket
 *       403:
 *         description: Not the ride's rider
 */
router.post('/:rideId/location', trackingController.updateLocation);

module.exports = router;
