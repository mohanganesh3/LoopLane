/**
 * Review Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { isAuthenticated } = require('../middleware/auth');

// Get reviews given by current user
router.get('/given', isAuthenticated, reviewController.getMyGivenReviews);

// Get reviews received by current user
router.get('/received', isAuthenticated, reviewController.getMyReceivedReviews);

// Get User Review Statistics
router.get('/stats/:userId', reviewController.getUserReviewStats);

// Submit Review API - simplified without complex validation
router.post('/booking/:bookingId',
    isAuthenticated,
    reviewController.submitReview
);

// Get User Reviews
router.get('/user/:userId', reviewController.getUserReviews);

// Get User Review Statistics (legacy route)
router.get('/user/:userId/stats', reviewController.getUserReviewStats);

// Report Review
router.post('/:reviewId/report', isAuthenticated, reviewController.reportReview);

// Delete Review
router.delete('/:reviewId', isAuthenticated, reviewController.deleteReview);

module.exports = router;
