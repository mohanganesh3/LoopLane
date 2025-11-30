/**
 * Tracking Routes - API Only (React SPA)
 * Real-time ride tracking functionality
 */

const express = require('express');
const router = express.Router();
const trackingController = require('../controllers/trackingController');
const { isAuthenticated } = require('../middleware/auth');

// All tracking routes require authentication
router.use(isAuthenticated);

// Get current tracking data API
router.get('/api/:bookingId', trackingController.getTrackingData);

// Update driver location API
router.post('/api/:rideId/location', trackingController.updateLocation);

// Get tracking info for a booking
router.get('/:bookingId', trackingController.getTrackingData);

module.exports = router;
