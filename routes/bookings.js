/**
 * Booking Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const biddingController = require('../controllers/biddingController'); // Epic 5
const { isAuthenticated, isRider } = require('../middleware/auth');
const {
    validateBooking,
    handleValidationErrors
} = require('../middleware/validation');
const { otpVerifyLimiter, apiLimiter } = require('../middleware/rateLimiter');
const { featureGate } = require('../middleware/settingsEnforcer');

// Apply apiLimiter as baseline for all booking routes
router.use(apiLimiter);

/**
 * @swagger
 * /api/bookings/create/{rideId}:
 *   post:
 *     tags: ['📋 Bookings']
 *     summary: Book a seat on a ride (Passenger)
 *     description: |
 *       Creates a booking request on an available ride.
 *       
 *       **Flow:** PASSENGER books → RIDER receives notification → RIDER accepts/rejects
 *       
 *       **Restrictions:**
 *       - Platform feature `rideSharingEnabled` must be ON
 *       - Cannot book your own ride
 *       - Ride must have available seats
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema: { type: string }
 *         description: ID of the ride to book
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateBookingRequest'
 *     responses:
 *       201:
 *         description: Booking created. Awaiting rider acceptance.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 booking:
 *                   $ref: '#/components/schemas/BookingResponse'
 *       400:
 *         description: Not enough seats / invalid request
 *       403:
 *         description: Feature disabled or cannot book own ride
 *       404:
 *         description: Ride not found
 */
router.post('/create/:rideId',
    isAuthenticated,
    featureGate('rideSharingEnabled'),
    validateBooking,
    handleValidationErrors,
    bookingController.createBooking
);

/**
 * @swagger
 * /api/bookings/my-bookings:
 *   get:
 *     tags: ['📋 Bookings']
 *     summary: List own bookings
 *     description: Returns all bookings for the authenticated user. Passengers see rides they booked; riders see their own context.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, ACCEPTED, REJECTED, CANCELLED, COMPLETED, ALL] }
 *         example: 'ACCEPTED'
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: User's bookings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 bookings:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BookingResponse'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationMeta'
 */
router.get('/my-bookings', isAuthenticated, bookingController.getMyBookings);

/**
 * @swagger
 * /api/bookings/{bookingId}:
 *   get:
 *     tags: ['📋 Bookings']
 *     summary: Get booking details
 *     description: Returns full booking details. Only the passenger who made the booking or the ride's rider can view it.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Booking details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 booking:
 *                   $ref: '#/components/schemas/BookingResponse'
 *       403:
 *         description: Not authorized to view this booking
 *       404:
 *         description: Booking not found
 */
router.get('/:bookingId', isAuthenticated, bookingController.getBookingDetails);
router.post('/:id/bid', isAuthenticated, biddingController.proposeBid);
router.post('/:id/bid/resolve', isAuthenticated, biddingController.resolveBid);

/**
 * @swagger
 * /api/bookings/{bookingId}/accept:
 *   post:
 *     tags: ['📋 Bookings']
 *     summary: Accept booking request (Rider only)
 *     description: Rider confirms a passenger's booking. The passenger is notified and pickup/dropoff OTPs are generated.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Booking accepted. OTPs generated.
 *       403:
 *         description: Not the ride's rider or not a RIDER role
 */
router.post('/:bookingId/accept', isAuthenticated, isRider, bookingController.acceptBooking);

/**
 * @swagger
 * /api/bookings/{bookingId}/reject:
 *   post:
 *     tags: ['📋 Bookings']
 *     summary: Reject booking request (Rider only)
 *     description: Rider declines a passenger's booking request. The passenger is notified.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, example: 'Route does not suit today' }
 *     responses:
 *       200:
 *         description: Booking rejected
 *       403:
 *         description: Not the ride's rider
 */
router.post('/:bookingId/reject', isAuthenticated, isRider, bookingController.rejectBooking);

/**
 * @swagger
 * /api/bookings/{bookingId}/cancel:
 *   post:
 *     tags: ['📋 Bookings']
 *     summary: Cancel booking (by passenger or rider)
 *     description: Cancels a booking. Passengers cancel their own bookings; riders can cancel on behalf of passengers. Refund policy applies.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, example: 'Plans changed' }
 *     responses:
 *       200:
 *         description: Booking cancelled
 *       403:
 *         description: Not authorized to cancel this booking
 */
router.post('/:bookingId/cancel', isAuthenticated, bookingController.cancelBooking);

/**
 * @swagger
 * /api/bookings/{bookingId}/verify-pickup:
 *   post:
 *     tags: ['📋 Bookings']
 *     summary: Verify passenger pickup OTP (Rider only)
 *     description: |
 *       Rider enters the OTP shown to the passenger to confirm pickup.
 *       This starts the journey leg for the passenger.
 *       Rate limited to prevent brute force.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp: { type: string, example: '4521' }
 *     responses:
 *       200:
 *         description: Pickup verified. Journey started.
 *       400:
 *         description: Invalid OTP
 *       403:
 *         description: Not the ride's rider
 *       429:
 *         description: Too many OTP attempts
 */
router.post('/:bookingId/verify-pickup',
    isAuthenticated,
    isRider,
    otpVerifyLimiter,
    bookingController.verifyPickupOTP
);

/**
 * @swagger
 * /api/bookings/{bookingId}/verify-dropoff:
 *   post:
 *     tags: ['📋 Bookings']
 *     summary: Verify passenger dropoff OTP (Rider only)
 *     description: |
 *       Rider enters the dropoff OTP to confirm the passenger has been dropped off.
 *       This ends the journey leg and triggers payment flow.
 *       Rate limited to prevent brute force.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp: { type: string, example: '8764' }
 *     responses:
 *       200:
 *         description: Dropoff verified. Payment flow triggered.
 *       400:
 *         description: Invalid OTP
 *       403:
 *         description: Not the ride's rider
 */
router.post('/:bookingId/verify-dropoff',
    isAuthenticated,
    isRider,
    otpVerifyLimiter,
    bookingController.verifyDropoffOTP
);

/**
 * @swagger
 * /api/bookings/{bookingId}/complete-payment:
 *   post:
 *     tags: ['📋 Bookings']
 *     summary: Passenger confirms payment
 *     description: Passenger confirms they have paid the agreed amount to the rider. Updates booking status to payment-confirmed.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethod: { type: string, enum: [CASH, UPI, WALLET], example: 'UPI' }
 *               transactionRef: { type: string, example: 'UPI123456' }
 *     responses:
 *       200:
 *         description: Payment confirmed
 */
router.post('/:bookingId/complete-payment', isAuthenticated, bookingController.completePayment);

/**
 * @swagger
 * /api/bookings/{bookingId}/confirm-payment:
 *   post:
 *     tags: ['📋 Bookings']
 *     summary: Rider confirms payment received (Rider only)
 *     description: Rider acknowledges receipt of payment from the passenger. Completes the booking and triggers review prompts.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Payment receipt confirmed. Booking completed.
 *       403:
 *         description: Not the ride's rider
 */
router.post('/:bookingId/confirm-payment', isAuthenticated, isRider, bookingController.confirmPayment);

/**
 * @swagger
 * /api/bookings/{bookingId}/start:
 *   post:
 *     tags: ['📋 Bookings']
 *     summary: Start journey — legacy (Rider only)
 *     description: Legacy endpoint. Prefer `POST /api/bookings/{bookingId}/verify-pickup` instead. Marks journey as started.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Journey started
 *       403:
 *         description: Not the ride's rider
 */
router.post('/:bookingId/start', isAuthenticated, isRider, bookingController.startJourney);

/**
 * @swagger
 * /api/bookings/{bookingId}/complete:
 *   post:
 *     tags: ['📋 Bookings']
 *     summary: Complete journey — legacy (Rider only)
 *     description: Legacy endpoint. Prefer `POST /api/bookings/{bookingId}/verify-dropoff` instead. Marks journey as completed.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Journey completed
 *       403:
 *         description: Not the ride's rider
 */
router.post('/:bookingId/complete', isAuthenticated, isRider, bookingController.completeJourney);

module.exports = router;
