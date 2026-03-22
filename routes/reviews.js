/**
 * Review Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { isAuthenticated } = require('../middleware/auth');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const { featureGate } = require('../middleware/settingsEnforcer');
const uploadMiddleware = require('../middleware/upload');

// Apply apiLimiter as baseline for all review routes
router.use(apiLimiter);

/**
 * @swagger
 * /api/reviews/given:
 *   get:
 *     tags: ['⭐ Reviews']
 *     summary: Get reviews given by current user
 *     description: Returns all reviews the authenticated user has submitted for others.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Reviews given
 */
router.get('/given', isAuthenticated, reviewController.getMyGivenReviews);

/**
 * @swagger
 * /api/reviews/received:
 *   get:
 *     tags: ['⭐ Reviews']
 *     summary: Get reviews received by current user
 *     description: Returns all reviews that other users have written about the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Reviews received
 */
router.get('/received', isAuthenticated, reviewController.getMyReceivedReviews);

/**
 * @swagger
 * /api/reviews/stats/{userId}:
 *   get:
 *     tags: ['⭐ Reviews']
 *     summary: Get review statistics for a user (Public)
 *     description: Returns aggregated rating statistics for any user. No authentication required — publicly visible.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review stats
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 stats:
 *                   type: object
 *                   properties:
 *                     averageRating: { type: number, example: 4.7 }
 *                     totalReviews: { type: integer, example: 47 }
 *                     ratingBreakdown: { type: object }
 */
router.get('/stats/:userId', reviewController.getUserReviewStats);

/**
 * @swagger
 * /api/reviews/booking/{bookingId}:
 *   post:
 *     tags: ['⭐ Reviews']
 *     summary: Submit a review for a completed booking
 *     description: |
 *       Submits a rating and review for the other party (passenger reviews rider or vice versa).
 *       You can upload up to 5 photos of the ride experience.
 *       
 *       **Requires:** `reviewsEnabled` platform setting to be ON
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5, example: 5 }
 *               comment: { type: string, example: 'Great ride!' }
 *               tags: { type: string, description: 'Comma-separated tags e.g. PUNCTUAL,CLEAN_CAR' }
 *               photos: { type: array, items: { type: string, format: binary } }
 *     responses:
 *       201:
 *         description: Review submitted
 *       400:
 *         description: Already reviewed or booking not completed
 *       403:
 *         description: Not a participant of this booking / reviews disabled
 */
router.post('/booking/:bookingId',
    isAuthenticated,
    featureGate('reviewsEnabled'),
    uploadLimiter,
    uploadMiddleware.multiple('photos', 5),
    reviewController.submitReview
);

/**
 * @swagger
 * /api/reviews/user/{userId}:
 *   get:
 *     tags: ['⭐ Reviews']
 *     summary: Get public reviews for a user (Public)
 *     description: Returns all reviews for any user. No authentication required.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: User's public reviews
 */
router.get('/user/:userId', reviewController.getUserReviews);

/**
 * @swagger
 * /api/reviews/user/{userId}/stats:
 *   get:
 *     tags: ['⭐ Reviews']
 *     summary: Get review stats for a user — legacy (Public)
 *     description: Legacy endpoint. Prefer `GET /api/reviews/stats/{userId}`.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review statistics
 */
router.get('/user/:userId/stats', reviewController.getUserReviewStats);
router.post('/:reviewId/report', isAuthenticated, reviewController.reportReview);
router.post('/:reviewId/respond', isAuthenticated, reviewController.respondToReview);

router.post('/:reviewId/helpful', isAuthenticated, reviewController.markAsHelpful);

/**
 * @swagger
 * /api/reviews/{reviewId}:
 *   put:
 *     tags: ['⭐ Reviews']
 *     summary: Update own review
 *     description: Allows updating a review within the allowed edit window (usually 48 hours).
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SubmitReviewRequest'
 *     responses:
 *       200:
 *         description: Review updated
 *       403:
 *         description: Not the review author
 *   delete:
 *     tags: ['⭐ Reviews']
 *     summary: Delete own review
 *     description: Permanently deletes a review. Only the author can delete it.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: reviewId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Review deleted
 *       403:
 *         description: Not the review author
 */
router.put('/:reviewId', isAuthenticated, reviewController.updateReview);
router.delete('/:reviewId', isAuthenticated, reviewController.deleteReview);

module.exports = router;
