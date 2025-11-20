/**
 * Ride Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const { isAuthenticated, isRider, isVerifiedRider } = require('../middleware/auth');
const {
    validateRidePost,
    validateRideUpdate,
    validateRideSearch,
    handleValidationErrors
} = require('../middleware/validation');

// Search Rides API
router.get('/search/results',
    isAuthenticated,
    validateRideSearch,
    handleValidationErrors,
    rideController.searchRides
);

// Post Ride API
router.post('/post',
    isAuthenticated,
    isRider,
    isVerifiedRider,
    validateRidePost,
    handleValidationErrors,
    rideController.postRide
);

// My Rides API (for riders)
router.get('/my-rides',
    isAuthenticated,
    isRider,
    rideController.getMyRides
);

// Update Ride API
router.put('/:rideId',
    isAuthenticated,
    isRider,
    validateRideUpdate,
    handleValidationErrors,
    rideController.updateRide
);

// Delete Ride API
router.delete('/:rideId',
    isAuthenticated,
    isRider,
    rideController.deleteRide
);

// Ride Details API
router.get('/:rideId', isAuthenticated, rideController.getRideDetails);

// Get ride bookings API (for rider to see all bookings for their ride)
router.get('/:rideId/bookings',
    isAuthenticated,
    isRider,
    rideController.getRideBookings
);

// Cancel Ride API
router.post('/:rideId/cancel',
    isAuthenticated,
    isRider,
    rideController.cancelRide
);

// Start Ride API
router.post('/:rideId/start',
    isAuthenticated,
    isRider,
    rideController.startRide
);

// Complete Ride API
router.post('/:rideId/complete',
    isAuthenticated,
    isRider,
    rideController.completeRide
);

// Update Location API (real-time tracking)
router.post('/:rideId/location',
    isAuthenticated,
    isRider,
    rideController.updateLocation
);

module.exports = router;
