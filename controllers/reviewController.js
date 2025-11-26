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
 * Show review page
 */
exports.showReviewPage = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile profilePhoto')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile profilePhoto' }
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Check if ride is completed: status is COMPLETED OR (DROPPED_OFF/PICKED_UP and payment is PAID)
    const isPaymentPaid = booking.payment && booking.payment.status === 'PAID';
    const isDroppedOff = booking.status === 'DROPPED_OFF';
    const isPickedUp = booking.status === 'PICKED_UP';
    const isCompleted = booking.status === 'COMPLETED' || ((isDroppedOff || isPickedUp) && isPaymentPaid);

    if (!isCompleted) {
        throw new AppError('Can only review completed rides', 400);
    }

    // Check if user is part of this booking
    const isPassenger = booking.passenger._id.toString() === req.user._id.toString();
    const isRider = booking.ride.rider._id.toString() === req.user._id.toString();

    if (!isPassenger && !isRider) {
        throw new AppError('Not authorized', 403);
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({
        reviewer: req.user._id,
        reviewee: isPassenger ? booking.ride.rider._id : booking.passenger._id,
        booking: booking._id
    });

    if (existingReview) {
        throw new AppError('You have already reviewed this ride', 400);
    }

    const reviewee = isPassenger ? booking.ride.rider : booking.passenger;
    
    // Ensure name is available (compute from profile if virtual doesn't work)
    if (!reviewee.name && reviewee.profile) {
        reviewee.name = `${reviewee.profile.firstName} ${reviewee.profile.lastName}`.trim();
    }

    res.render('reviews/create', {
        title: `Review ${reviewee.name || 'User'} - LANE Carpool`,
        user: req.user,
        booking,
        reviewee,
        isPassenger
    });
});

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
        tags
    } = req.body;

    console.log('📝 [Review] ========================================');
    console.log('📝 [Review] Submitting review for booking:', bookingId);
    console.log('📝 [Review] Reviewer:', req.user._id);
    console.log('📝 [Review] Reviewee:', revieweeId);
    console.log('📝 [Review] Rating:', rating);
    console.log('📝 [Review] ========================================');

    // STEP 1: Validate booking exists
    const booking = await Booking.findById(bookingId)
        .populate('ride')
        .populate('passenger', '_id');

    if (!booking) {
        console.log('❌ [Review] Booking not found');
        return res.status(404).json({
            success: false,
            message: 'Booking not found'
        });
    }

    console.log('📝 [Review] Booking found, status:', booking.status);

    // STEP 2: Check booking status - allow DROPPED_OFF, COMPLETED, or IN_TRANSIT
    const allowedStatuses = ['DROPPED_OFF', 'COMPLETED', 'PICKED_UP', 'IN_TRANSIT'];
    if (!allowedStatuses.includes(booking.status)) {
        console.log('❌ [Review] Invalid booking status:', booking.status);
        return res.status(400).json({
            success: false,
            message: `Cannot review this booking. Current status: ${booking.status}. Reviews are only allowed for completed rides.`
        });
    }

    // STEP 3: Verify user is part of booking
    const passengerId = booking.passenger._id?.toString() || booking.passenger.toString();
    const riderId = booking.ride.rider?.toString();
    const currentUserId = req.user._id.toString();

    console.log('📝 [Review] PassengerId:', passengerId);
    console.log('📝 [Review] RiderId:', riderId);
    console.log('📝 [Review] CurrentUserId:', currentUserId);

    const isPassenger = passengerId === currentUserId;
    const isRider = riderId === currentUserId;

    if (!isPassenger && !isRider) {
        console.log('❌ [Review] User not part of booking');
        return res.status(403).json({
            success: false,
            message: 'You are not authorized to review this booking'
        });
    }

    // STEP 4: Verify reviewee is correct
    const expectedRevieweeId = isPassenger ? riderId : passengerId;
    
    if (revieweeId !== expectedRevieweeId) {
        console.log('❌ [Review] Reviewee mismatch. Expected:', expectedRevieweeId, 'Got:', revieweeId);
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
        console.log('❌ [Review] Already reviewed');
        return res.status(400).json({
            success: false,
            message: 'You have already reviewed this ride'
        });
    }

    // STEP 6: Create review
    const reviewType = isPassenger ? 'DRIVER_REVIEW' : 'PASSENGER_REVIEW';
    
    // Parse tags
    let parsedTags = [];
    if (tags && Array.isArray(tags)) {
        parsedTags = tags.map(tag => tag.toUpperCase().replace(/\s+/g, '_'));
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
                    cleanliness: cleanliness ? parseFloat(cleanliness) : undefined,
                    driving: driving ? parseFloat(driving) : undefined
                }
            },
            tags: parsedTags,
            comment: comment || ''
        });

        console.log('✅ [Review] Review created:', review._id);

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
                title: 'New Review Received! ⭐',
                message: `${reviewerName} rated you ${rating} stars`,
                data: { reviewId: review._id, bookingId: booking._id }
            });

            // Real-time notification
            const io = req.app.get('io');
            if (io) {
                io.to(`user-${revieweeId}`).emit('notification', {
                    type: 'REVIEW_RECEIVED',
                    title: 'New Review Received! ⭐',
                    message: `${reviewerName} gave you ${rating} stars`,
                    timestamp: new Date()
                });
            }
        } catch (notifError) {
            console.error('⚠️ [Review] Notification error:', notifError.message);
        }

        console.log('✅ [Review] Review submitted successfully');
        
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
    const limit = 10;
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
    const limit = 10;
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
    const limit = 10;
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
        reported: review.reviewer,
        category: 'INAPPROPRIATE_REVIEW',
        description: reason || 'Inappropriate content',
        relatedReview: review._id
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
                avgCleanliness: { $avg: '$ratings.categories.cleanliness' }, // ✅ Fixed path
                avgDriving: { $avg: '$ratings.categories.driving' } // ✅ Fixed path
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
