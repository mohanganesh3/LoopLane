/**
 * Review Controller
 * Handles two-way rating and review system
 */

const Review = require('../models/Review');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

/**
 * Submit review
 */
exports.submitReview = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const {
        revieweeId,
        rating,
        comment,
        punctuality,
        communication,
        cleanliness,
        driving,
        respectfulness,
        friendliness,
        tags,
        photos
    } = req.body;

    // STEP 1: Validate booking exists
    const booking = await Booking.findById(bookingId)
        .populate('ride')
        .populate('passenger', '_id');

    if (!booking) {
        return res.status(404).json({
            success: false,
            message: 'Booking not found'
        });
    }

    // STEP 2: Check booking status - allow DROPPED_OFF, COMPLETED, or IN_TRANSIT
    const allowedStatuses = ['DROPPED_OFF', 'COMPLETED', 'PICKED_UP', 'IN_TRANSIT'];
    if (!allowedStatuses.includes(booking.status)) {
        return res.status(400).json({
            success: false,
            message: `Cannot review this booking. Current status: ${booking.status}. Reviews are only allowed for completed rides.`
        });
    }

    // STEP 3: Verify user is part of booking
    const passengerId = booking.passenger._id?.toString() || booking.passenger.toString();
    const riderId = booking.ride.rider?.toString();
    const currentUserId = req.user._id.toString();

    const isPassenger = passengerId === currentUserId;
    const isRider = riderId === currentUserId;

    if (!isPassenger && !isRider) {
        return res.status(403).json({
            success: false,
            message: 'You are not authorized to review this booking'
        });
    }

    // STEP 4: Verify reviewee is correct
    const expectedRevieweeId = isPassenger ? riderId : passengerId;

    if (revieweeId !== expectedRevieweeId) {
        return res.status(400).json({
            success: false,
            message: 'Invalid reviewee. Please refresh the page and try again.'
        });
    }

    // STEP 5: Check for duplicate review
    const existingReview = await Review.findOne({
        reviewer: req.user._id,
        booking: booking._id
    });

    if (existingReview) {
        return res.status(400).json({
            success: false,
            message: 'You have already reviewed this ride'
        });
    }

    // STEP 6: Create review
    const reviewType = isPassenger ? 'DRIVER_REVIEW' : 'PASSENGER_REVIEW';

    // Parse tags (handles both JSON array and raw array depending on form-data/json)
    let parsedTags = [];
    if (tags && typeof tags === 'string') {
        try {
            parsedTags = JSON.parse(tags);
        } catch (e) {
            parsedTags = tags.split(',').map(tag => tag.trim());
        }
    } else if (Array.isArray(tags)) {
        parsedTags = tags;
    }
    parsedTags = parsedTags.map(tag => tag.toUpperCase().replace(/\s+/g, '_'));

    // Handle photos from multer (Cloudinary URLs)
    let uploadedPhotos = [];
    if (req.files && req.files.length > 0) {
        uploadedPhotos = req.files.map(file => file.path);
    } else if (photos && Array.isArray(photos)) {
        uploadedPhotos = photos.slice(0, 5); // Fallback
    }

    try {
        const review = await Review.create({
            reviewer: req.user._id,
            reviewee: revieweeId,
            booking: booking._id,
            type: reviewType,
            ratings: {
                overall: parseFloat(rating),
                categories: {
                    punctuality: punctuality ? parseFloat(punctuality) : undefined,
                    communication: communication ? parseFloat(communication) : undefined,
                    // Driver-only categories (DRIVER_REVIEW)
                    ...(reviewType === 'DRIVER_REVIEW' ? {
                        cleanliness: cleanliness ? parseFloat(cleanliness) : undefined,
                        driving: driving ? parseFloat(driving) : undefined
                    } : {}),
                    // Passenger-only categories (PASSENGER_REVIEW)
                    ...(reviewType === 'PASSENGER_REVIEW' ? {
                        respectfulness: respectfulness ? parseFloat(respectfulness) : undefined,
                        friendliness: friendliness ? parseFloat(friendliness) : undefined
                    } : {})
                }
            },
            tags: parsedTags,
            comment: comment || '',
            photos: uploadedPhotos
        });

        // Update user's rating
        const ratingStats = await Review.calculateUserRating(revieweeId);
        await User.findByIdAndUpdate(revieweeId, {
            'rating.overall': ratingStats.avgRating || 0,
            'rating.totalRatings': ratingStats.totalReviews || 0
        });

        // Mark booking as reviewed
        if (isPassenger) {
            booking.reviews = booking.reviews || {};
            booking.reviews.passengerReviewed = true;
        } else {
            booking.reviews = booking.reviews || {};
            booking.reviews.riderReviewed = true;
        }
        await booking.save();

        // Send notification
        try {
            const reviewerName = req.user.profile?.firstName || req.user.name || 'Someone';
            await Notification.create({
                user: revieweeId,
                type: 'REVIEW_RECEIVED',
                title: 'New Review Received',
                message: `${reviewerName} rated you ${rating} stars`,
                data: { reviewId: review._id, bookingId: booking._id }
            });

            // Real-time notification
            const io = req.app.get('io');
            if (io) {
                io.to(`user-${revieweeId}`).emit('notification', {
                    type: 'REVIEW_RECEIVED',
                    title: 'New Review Received',
                    message: `${reviewerName} gave you ${rating} stars`,
                    timestamp: new Date()
                });
            }
        } catch (notifError) {
            console.error('⚠️ [Review] Notification error:', notifError.message);
        }

        return res.status(201).json({
            success: true,
            message: 'Review submitted successfully!',
            review
        });

    } catch (createError) {
        console.error('❌ [Review] Error creating review:', createError);
        return res.status(500).json({
            success: false,
            message: 'Failed to create review: ' + createError.message
        });
    }
});

/**
 * Get reviews for a user
 */
exports.getUserReviews = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const skip = (page - 1) * limit;

    const mongoose = require('mongoose');

    const totalReviews = await Review.countDocuments({ reviewee: userId, isPublished: true });
    const reviews = await Review.find({ reviewee: userId, isPublished: true })
        .populate('reviewer', 'profile profilePhoto rating')
        .populate('booking', 'bookingReference')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    // Calculate rating breakdown - Fixed ObjectId usage
    const ratingBreakdown = await Review.aggregate([
        {
            $match: {
                reviewee: new mongoose.Types.ObjectId(userId), // ✅ Fixed
                isPublished: true
            }
        },
        {
            $group: {
                _id: '$ratings.overall', // ✅ Fixed: Use ratings.overall
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: -1 } }
    ]);

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingBreakdown.forEach(item => {
        breakdown[Math.floor(item._id)] = item.count;
    });

    res.status(200).json({
        success: true,
        totalReviews,
        reviews,
        ratingBreakdown: breakdown,
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit)
    });
});

/**
 * Get reviews given by current user
 */
exports.getMyGivenReviews = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const skip = (page - 1) * limit;

    const totalReviews = await Review.countDocuments({ reviewer: req.user._id });
    const reviews = await Review.find({ reviewer: req.user._id })
        .populate('reviewee', 'profile profilePhoto rating')
        .populate('booking', 'bookingReference')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    res.status(200).json({
        success: true,
        totalReviews,
        reviews,
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit)
    });
});

/**
 * Get reviews received by current user
 */
exports.getMyReceivedReviews = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
    const skip = (page - 1) * limit;

    const mongoose = require('mongoose');

    const totalReviews = await Review.countDocuments({ reviewee: req.user._id, isPublished: true });
    const reviews = await Review.find({ reviewee: req.user._id, isPublished: true })
        .populate('reviewer', 'profile profilePhoto rating')
        .populate('booking', 'bookingReference')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    // Calculate rating breakdown
    const ratingBreakdown = await Review.aggregate([
        {
            $match: {
                reviewee: new mongoose.Types.ObjectId(req.user._id),
                isPublished: true
            }
        },
        {
            $group: {
                _id: '$ratings.overall',
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: -1 } }
    ]);

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    ratingBreakdown.forEach(item => {
        breakdown[Math.floor(item._id)] = item.count;
    });

    res.status(200).json({
        success: true,
        totalReviews,
        reviews,
        ratingBreakdown: breakdown,
        currentPage: page,
        totalPages: Math.ceil(totalReviews / limit)
    });
});

/**
 * Report review
 */
exports.reportReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { reason } = req.body;

    const review = await Review.findById(reviewId);

    if (!review) {
        throw new AppError('Review not found', 404);
    }

    // Only the reviewee can report
    if (review.reviewee.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    // Add to reported list
    review.reportedBy.push({
        user: req.user._id,
        reason: reason || 'Inappropriate content',
        reportedAt: new Date()
    });
    review.reportedCount = (review.reportedCount || 0) + 1;

    // Auto-hide if multiple reports (e.g., 3 or more)
    if (review.reportedCount >= 3) {
        review.isPublished = false;
    }

    await review.save();

    // Create report in Report system
    const Report = require('../models/Report');
    await Report.create({
        reporter: req.user._id,
        reportedUser: review.reviewer,
        category: 'OTHER',
        severity: 'LOW',
        description: reason || 'Inappropriate review content reported by user. Review ID: ' + review._id
    });

    res.status(200).json({
        success: true,
        message: 'Review reported successfully. Admin will review it.'
    });
});

/**
 * Delete review (by admin or review owner)
 */
exports.deleteReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);

    if (!review) {
        throw new AppError('Review not found', 404);
    }

    // Check authorization
    const isReviewer = review.reviewer.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isReviewer && !isAdmin) {
        throw new AppError('Not authorized', 403);
    }

    await review.deleteOne();

    // Recalculate user rating and update cache on User
    const updatedStats = await Review.calculateUserRating(review.reviewee);
    await User.findByIdAndUpdate(review.reviewee, {
        'rating.overall': updatedStats.avgRating || 0,
        'rating.totalRatings': updatedStats.totalReviews || 0,
        'rating.breakdown.fiveStar': updatedStats.fiveStar || 0,
        'rating.breakdown.fourStar': updatedStats.fourStar || 0,
        'rating.breakdown.threeStar': updatedStats.threeStar || 0,
        'rating.breakdown.twoStar': updatedStats.twoStar || 0,
        'rating.breakdown.oneStar': updatedStats.oneStar || 0
    });

    res.status(200).json({
        success: true,
        message: 'Review deleted successfully'
    });
});

/**
 * Update a review
 * Allows the reviewer to update their review comment and rating
 */
exports.updateReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { comment, rating } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
        throw new AppError('Review not found', 404);
    }

    if (review.reviewer.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized to update this review', 403);
    }

    if (comment !== undefined) review.comment = comment;
    if (rating !== undefined) {
        review.rating = rating;
        if (review.ratings) review.ratings.overall = rating;
    }

    await review.save();

    // Re-calculate reviewee stats (simplified)
    const User = require('../models/User');
    const allReviews = await Review.find({ reviewee: review.reviewee, isPublished: true });
    const totalRatings = allReviews.length;
    const avgRating = totalRatings > 0
        ? allReviews.reduce((sum, r) => sum + (r.ratings?.overall || r.rating || 0), 0) / totalRatings
        : 0;

    await User.findByIdAndUpdate(review.reviewee, {
        'rating.overall': avgRating,
        'rating.totalRatings': totalRatings
    });

    res.status(200).json({
        success: true,
        data: review
    });
});

/**
 * Respond to a review (only the reviewee can respond)
 */
exports.respondToReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length === 0) {
        throw new AppError('Response text is required', 400);
    }

    if (text.length > 500) {
        throw new AppError('Response must be 500 characters or less', 400);
    }

    const review = await Review.findById(reviewId);
    if (!review) {
        throw new AppError('Review not found', 404);
    }

    // Only the reviewee can respond
    if (review.reviewee.toString() !== req.user._id.toString()) {
        throw new AppError('Only the reviewed person can respond', 403);
    }

    // Can only respond once
    if (review.response && review.response.text) {
        throw new AppError('You have already responded to this review', 400);
    }

    review.response = {
        text: text.trim(),
        respondedAt: new Date()
    };
    await review.save();

    // Notify the reviewer about the response
    try {
        const responderName = req.user.profile?.firstName || req.user.name || 'Someone';
        await Notification.create({
            user: review.reviewer,
            type: 'REVIEW_RESPONSE',
            title: 'Response to Your Review',
            message: `${responderName} responded to your review`,
            data: { reviewId: review._id }
        });
    } catch (notifError) {
        console.error('Review response notification error:', notifError.message);
    }

    res.status(200).json({
        success: true,
        message: 'Response submitted successfully',
        response: review.response
    });
});

/**
 * Mark a review as helpful
 */
exports.markAsHelpful = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
        throw new AppError('Review not found', 404);
    }

    // Cannot mark own review as helpful
    if (review.reviewer.toString() === req.user._id.toString()) {
        throw new AppError('Cannot mark your own review as helpful', 400);
    }

    review.helpfulCount = (review.helpfulCount || 0) + 1;
    await review.save();

    res.status(200).json({
        success: true,
        message: 'Marked as helpful',
        helpfulCount: review.helpfulCount
    });
});

/**
 * Get review statistics for a user
 */
exports.getUserReviewStats = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const mongoose = require('mongoose');

    const stats = await Review.aggregate([
        {
            $match: {
                reviewee: new mongoose.Types.ObjectId(userId), // ✅ Fixed
                isPublished: true
            }
        },
        {
            $group: {
                _id: null,
                totalReviews: { $sum: 1 },
                averageRating: { $avg: '$ratings.overall' }, // ✅ Fixed path
                avgPunctuality: { $avg: '$ratings.categories.punctuality' }, // ✅ Fixed path
                avgCommunication: { $avg: '$ratings.categories.communication' }, // ✅ Fixed path
                avgCleanliness: { $avg: '$ratings.categories.cleanliness' },
                avgDriving: { $avg: '$ratings.categories.driving' },
                avgRespectfulness: { $avg: '$ratings.categories.respectfulness' },
                avgFriendliness: { $avg: '$ratings.categories.friendliness' }
            }
        }
    ]);

    // Get most common tags
    const commonTags = await Review.aggregate([
        {
            $match: {
                reviewee: new mongoose.Types.ObjectId(userId), // ✅ Fixed
                isPublished: true
            }
        },
        { $unwind: '$tags' },
        {
            $group: {
                _id: '$tags',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    res.status(200).json({
        success: true,
        stats: stats[0] || {},
        commonTags: commonTags.map(t => ({ tag: t._id, count: t.count }))
    });
});
