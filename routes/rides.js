/**
 * Ride Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const { isAuthenticated, isRider, isVerifiedRider } = require('../middleware/auth');
const { apiLimiter, searchLimiter } = require('../middleware/rateLimiter');
const { featureGate } = require('../middleware/settingsEnforcer');
const {
    validateRidePost,
    validateRideUpdate,
    validateRideSearch,
    handleValidationErrors
} = require('../middleware/validation');

// Apply apiLimiter as baseline for all ride routes
router.use(apiLimiter);

/**
 * @swagger
 * /api/rides/search/results:
 *   get:
 *     tags: ['🚗 Rides']
 *     summary: Search available rides
 *     description: Searches for available rides between two locations on a given date. Rate limited for high-frequency searches. Both PASSENGER and RIDER can search.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string }
 *         description: Starting location (address or lat,lng)
 *         example: 'Koramangala, Bangalore'
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string }
 *         description: Destination location
 *         example: 'Whitefield, Bangalore'
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *         description: Date of ride (YYYY-MM-DD)
 *         example: '2026-03-25'
 *       - in: query
 *         name: seats
 *         schema: { type: integer, default: 1 }
 *         description: Number of seats required
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of matching rides
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 rides:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/RideResponse'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       400:
 *         description: Missing required search parameters
 *       401:
 *         description: Not authenticated
 */
router.get('/search/results',
    isAuthenticated,
    searchLimiter,
    validateRideSearch,
    handleValidationErrors,
    rideController.searchRides
);

/**
 * @swagger
 * /api/rides/post:
 *   post:
 *     tags: ['🚗 Rides']
 *     summary: Post a new ride (Rider only)
 *     description: |
 *       Creates a new ride offer. 
 *       **Restrictions:**
 *       - Requires `RIDER` role
 *       - Rider must be fully verified (`verificationStatus: VERIFIED`)
 *       - Platform feature `rideSharingEnabled` must be ON
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PostRideRequest'
 *     responses:
 *       201:
 *         description: Ride posted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 ride:
 *                   $ref: '#/components/schemas/RideResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not a verified rider / ride sharing disabled
 */
router.post('/post',
    isAuthenticated,
    featureGate('rideSharingEnabled'),
    isRider,
    isVerifiedRider,
    validateRidePost,
    handleValidationErrors,
    rideController.postRide
);

/**
 * @swagger
 * /api/rides/nearby:
 *   get:
 *     tags: ['🚗 Rides']
 *     summary: Get nearby rides (geolocation-based)
 *     description: Returns rides with pickup points near the user's current location. Requires user's coordinates.
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
 *       - in: query
 *         name: radius
 *         schema: { type: integer, default: 5 }
 *         description: Search radius in kilometers
 *     responses:
 *       200:
 *         description: Nearby rides list
 *       401:
 *         description: Not authenticated
 */
router.get('/nearby', isAuthenticated, rideController.getNearbyRides);

/**
 * @swagger
 * /api/rides/popular-routes:
 *   get:
 *     tags: ['🚗 Rides']
 *     summary: Get popular routes on the platform
 *     description: Returns the most frequently traveled routes, useful for users to discover common routes.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: List of popular routes
 *       401:
 *         description: Not authenticated
 */
router.get('/popular-routes', isAuthenticated, rideController.getPopularRoutes);

/**
 * @swagger
 * /api/rides/recommendations:
 *   get:
 *     tags: ['🚗 Rides']
 *     summary: Get personalized ride recommendations
 *     description: Returns AI-powered ride recommendations based on the user's past ride history and preferences.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Recommended rides
 *       401:
 *         description: Not authenticated
 */
router.get('/recommendations', isAuthenticated, rideController.getRecommendations);

/**
 * @swagger
 * /api/rides/recurring:
 *   post:
 *     tags: ['🚗 Rides']
 *     summary: Create a recurring ride schedule (Rider only)
 *     description: |
 *       Creates a recurring ride (e.g., Mon-Fri commute). 
 *       **Requires:** `RIDER` role + verified status
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               baseRide:
 *                 $ref: '#/components/schemas/PostRideRequest'
 *               recurrence:
 *                 type: object
 *                 properties:
 *                   days: { type: array, items: { type: string, enum: [MON,TUE,WED,THU,FRI,SAT,SUN] }, example: [MON,TUE,WED,THU,FRI] }
 *                   startDate: { type: string, format: date, example: '2026-03-25' }
 *                   endDate: { type: string, format: date, example: '2026-06-30' }
 *     responses:
 *       201:
 *         description: Recurring schedule created
 *       403:
 *         description: Not a verified rider
 */
router.post('/recurring',
    isAuthenticated,
    isRider,
    isVerifiedRider,
    rideController.createRecurringRide
);

/**
 * @swagger
 * /api/rides/my-rides:
 *   get:
 *     tags: ['🚗 Rides']
 *     summary: Get rider's own posted rides (Rider only)
 *     description: Returns all rides posted by the authenticated rider, including past and upcoming rides with their booking counts.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, COMPLETED, CANCELLED, ALL] }
 *         example: 'ACTIVE'
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *     responses:
 *       200:
 *         description: Rider's rides list
 *       403:
 *         description: Not a rider
 */
router.get('/my-rides', isAuthenticated, isRider, rideController.getMyRides);

/**
 * @swagger
 * /api/rides/{rideId}:
 *   put:
 *     tags: ['🚗 Rides']
 *     summary: Update ride details (Rider only)
 *     description: Updates ride details like departure time, seats, or price. Only the rider who posted the ride can update it. Cannot update after ride has started.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *         example: '64a1b2c3d4e5f6g7h8i9j0k1'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               departureTime: { type: string, format: date-time }
 *               availableSeats: { type: integer }
 *               pricePerSeat: { type: number }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Ride updated
 *       403:
 *         description: Not the ride owner or not a rider
 *       404:
 *         description: Ride not found
 *   delete:
 *     tags: ['🚗 Rides']
 *     summary: Delete a ride (Rider only)
 *     description: Deletes a ride. Can only delete rides with no accepted bookings.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ride deleted
 *       403:
 *         description: Not the ride owner
 *       404:
 *         description: Ride not found
 *   get:
 *     tags: ['🚗 Rides']
 *     summary: Get ride details
 *     description: Returns full details of a specific ride including rider info, available seats, route, and passenger list.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ride details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 ride:
 *                   $ref: '#/components/schemas/RideResponse'
 *       404:
 *         description: Ride not found
 */
router.put('/:rideId',
    isAuthenticated,
    isRider,
    validateRideUpdate,
    handleValidationErrors,
    rideController.updateRide
);

router.delete('/:rideId', isAuthenticated, isRider, rideController.deleteRide);

/**
 * @swagger
 * /api/rides/{rideId}/bookings:
 *   get:
 *     tags: ['🚗 Rides']
 *     summary: View all bookings on rider's ride (Rider only)
 *     description: Returns all passenger bookings for a specific ride. Only the ride's owner can view this.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Bookings for the ride
 *       403:
 *         description: Not the ride owner or not a rider
 */
router.get('/:rideId', isAuthenticated, rideController.getRideDetails);

router.get('/:rideId/bookings', isAuthenticated, isRider, rideController.getRideBookings);

/**
 * @swagger
 * /api/rides/{rideId}/cancel:
 *   post:
 *     tags: ['🚗 Rides']
 *     summary: Cancel ride (Rider only)
 *     description: Cancels the ride and notifies all confirmed passengers. Refunds are processed automatically.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
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
 *               reason: { type: string, example: 'Car breakdown' }
 *     responses:
 *       200:
 *         description: Ride cancelled and passengers notified
 *       403:
 *         description: Not the ride owner or not a rider
 */
router.post('/:rideId/cancel', isAuthenticated, isRider, rideController.cancelRide);

/**
 * @swagger
 * /api/rides/{rideId}/start:
 *   post:
 *     tags: ['🚗 Rides']
 *     summary: Start ride (Rider only)
 *     description: Marks the ride as started (IN_PROGRESS). After this, no new bookings can be made. Passengers are notified.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ride started
 *       403:
 *         description: Not the ride owner
 */
router.post('/:rideId/start', isAuthenticated, isRider, rideController.startRide);

/**
 * @swagger
 * /api/rides/{rideId}/complete:
 *   post:
 *     tags: ['🚗 Rides']
 *     summary: Complete ride (Rider only)
 *     description: Marks the ride as COMPLETED. Triggers payment settlement and review prompts for passengers.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ride completed
 *       403:
 *         description: Not the ride owner
 */
router.post('/:rideId/complete', isAuthenticated, isRider, rideController.completeRide);

/**
 * @swagger
 * /api/rides/{rideId}/location:
 *   post:
 *     tags: ['🚗 Rides']
 *     summary: Update rider location (Rider only — real-time tracking)
 *     description: Pushes the rider's current GPS coordinates for live tracking by passengers. Should be called every 5-10 seconds during active rides.
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
 *         description: Location updated
 *       403:
 *         description: Not the ride owner
 */
router.post('/:rideId/location', isAuthenticated, isRider, rideController.updateLocation);

module.exports = router;
