/**
 * Admin Controller
 * Handles admin operations: user verification, reports
 */

const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Report = require('../models/Report');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const Transaction = require('../models/Transaction');
const RouteDeviation = require('../models/RouteDeviation');
const AuditLog = require('../models/AuditLog');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const helpers = require('../utils/helpers');
const { sendEmail } = require('../config/email');
const emailService = require('../utils/emailService');
const { runBatchMatching } = require('../utils/bipartiteMatcher');
const fraudDetectionEngine = require('../utils/fraudDetectionEngine'); // Epic 6
const churnPredictor = require('../utils/churnPredictor'); // Epic 6

/**
 * Get User Details (API)
 */
exports.getUserDetails = asyncHandler(async (req, res) => {
    const userDetails = await User.findById(req.params.id);
    if (!userDetails) {
        return res.json({ success: false, message: 'User not found' });
    }

    const userId = userDetails._id;
    const completedStatuses = ['COMPLETED', 'DROPPED_OFF'];

    // ── Batch 1: Core data (recent items, reports, reviews, financials) ──
    const [
        recentRides, recentBookings, reportsAgainst, reviewsReceived,
        passengerFinancials, riderFinancials, platformRevenueFromRider, platformRevenueFromPassenger
    ] = await Promise.all([
        // Recent rides posted by this user
        Ride.find({ rider: userId })
            .sort({ createdAt: -1 }).limit(10)
            .select('route.start.address route.start.name route.destination.address route.destination.name route.distance route.duration schedule.departureDate status pricing.pricePerSeat pricing.totalSeats pricing.availableSeats carbon createdAt')
            .lean(),
        // Recent bookings as passenger
        Booking.find({ passenger: userId })
            .sort({ createdAt: -1 }).limit(10)
            .populate('ride', 'route.start.address route.start.name route.destination.address route.destination.name')
            .select('status totalPrice seatsBooked createdAt payment.status payment.method payment.platformCommission payment.rideFare bookingReference')
            .lean(),
        // Reports filed against this user
        Report.find({ reportedUser: userId })
            .sort({ createdAt: -1 }).limit(10)
            .populate('reporter', 'profile.firstName profile.lastName email')
            .select('category severity status description createdAt')
            .lean(),
        // Reviews received (full data for categories/tags)
        Review.find({ reviewee: userId })
            .sort({ createdAt: -1 }).limit(20)
            .populate('reviewer', 'profile.firstName profile.lastName profile.photo')
            .select('ratings tags comment type createdAt isPublished')
            .lean(),
        // Passenger financials
        Booking.aggregate([
            { $match: { passenger: userId, status: { $in: completedStatuses } } },
            { $group: { _id: null, totalSpent: { $sum: '$totalPrice' }, count: { $sum: 1 } } }
        ]),
        // Rider earnings
        Booking.aggregate([
            { $match: { rider: userId, status: { $in: completedStatuses } } },
            { $group: { _id: null, totalEarnings: { $sum: '$payment.rideFare' }, count: { $sum: 1 } } }
        ]),
        // Platform commission earned FROM this user's rides (as rider)
        Booking.aggregate([
            { $match: { rider: userId, status: { $in: completedStatuses } } },
            { $group: { _id: null, total: { $sum: '$payment.platformCommission' }, count: { $sum: 1 } } }
        ]),
        // Platform commission earned FROM this user's bookings (as passenger)
        Booking.aggregate([
            { $match: { passenger: userId, status: { $in: completedStatuses } } },
            { $group: { _id: null, total: { $sum: '$payment.platformCommission' }, count: { $sum: 1 } } }
        ])
    ]);

    // ── Batch 2: Analytics (routes, activity patterns, co-travelers, rating categories) ──
    const [topRoutesAsRider, topRoutesAsPassenger, activityByDay, activityByHour, frequentCoTravelers, ratingCategoryAvg, tagFrequency] = await Promise.all([
        // Top routes as rider
        Ride.aggregate([
            { $match: { rider: userId, status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED'] } } },
            { $group: {
                _id: {
                    from: { $ifNull: ['$route.start.name', { $arrayElemAt: [{ $split: ['$route.start.address', ','] }, 0] }] },
                    to: { $ifNull: ['$route.destination.name', { $arrayElemAt: [{ $split: ['$route.destination.address', ','] }, 0] }] }
                },
                count: { $sum: 1 },
                totalDistance: { $sum: '$route.distance' },
                lastTravelled: { $max: '$schedule.departureDate' }
            }},
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]),
        // Top routes as passenger
        Booking.aggregate([
            { $match: { passenger: userId, status: { $in: completedStatuses.concat(['CONFIRMED', 'PICKED_UP', 'IN_TRANSIT']) } } },
            { $lookup: { from: 'rides', localField: 'ride', foreignField: '_id', as: 'rideData' } },
            { $unwind: '$rideData' },
            { $group: {
                _id: {
                    from: { $ifNull: ['$rideData.route.start.name', { $arrayElemAt: [{ $split: ['$rideData.route.start.address', ','] }, 0] }] },
                    to: { $ifNull: ['$rideData.route.destination.name', { $arrayElemAt: [{ $split: ['$rideData.route.destination.address', ','] }, 0] }] }
                },
                count: { $sum: 1 },
                totalSpent: { $sum: '$totalPrice' },
                lastTravelled: { $max: '$createdAt' }
            }},
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]),
        // Activity by day of week (0=Sun, 6=Sat)
        Ride.aggregate([
            { $match: { rider: userId } },
            { $group: { _id: { $dayOfWeek: '$schedule.departureDateTime' }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]),
        // Activity by hour of day
        Ride.aggregate([
            { $match: { rider: userId } },
            { $group: { _id: { $hour: '$schedule.departureDateTime' }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]),
        // Frequent co-travelers (people this user has shared rides with)
        Booking.aggregate([
            { $match: { $or: [{ rider: userId }, { passenger: userId }], status: { $in: completedStatuses } } },
            { $project: {
                coTraveler: { $cond: [{ $eq: ['$rider', userId] }, '$passenger', '$rider'] }
            }},
            { $group: { _id: '$coTraveler', tripsTogether: { $sum: 1 } } },
            { $sort: { tripsTogether: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
            { $unwind: '$user' },
            { $project: {
                tripsTogether: 1,
                name: { $concat: [{ $ifNull: ['$user.profile.firstName', ''] }, ' ', { $ifNull: ['$user.profile.lastName', ''] }] },
                photo: '$user.profile.photo',
                rating: '$user.rating.overall'
            }}
        ]),
        // Average rating by category from reviews received
        Review.aggregate([
            { $match: { reviewee: userId, isPublished: true } },
            { $group: {
                _id: null,
                avgOverall: { $avg: '$ratings.overall' },
                avgPunctuality: { $avg: '$ratings.categories.punctuality' },
                avgCommunication: { $avg: '$ratings.categories.communication' },
                avgDriving: { $avg: '$ratings.categories.driving' },
                avgCleanliness: { $avg: '$ratings.categories.cleanliness' },
                avgRespectfulness: { $avg: '$ratings.categories.respectfulness' },
                avgFriendliness: { $avg: '$ratings.categories.friendliness' },
                totalReviews: { $sum: 1 }
            }}
        ]),
        // Most frequent review tags
        Review.aggregate([
            { $match: { reviewee: userId, isPublished: true } },
            { $unwind: '$tags' },
            { $group: { _id: '$tags', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ])
    ]);

    // Normalize reviews
    const normalizedReviews = reviewsReceived.map(review => ({
        ...review,
        rating: review.ratings?.overall || 0
    }));

    // Build activity pattern maps
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const activityPatterns = {
        byDay: dayNames.map((name, i) => ({
            day: name,
            count: activityByDay.find(d => d._id === (i + 1))?.count || 0  // MongoDB dayOfWeek: 1=Sun
        })),
        byHour: Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            label: `${h.toString().padStart(2, '0')}:00`,
            count: activityByHour.find(d => d._id === h)?.count || 0
        })),
        peakDay: null,
        peakHour: null
    };
    const maxDay = activityPatterns.byDay.reduce((a, b) => b.count > a.count ? b : a, { count: 0 });
    const maxHour = activityPatterns.byHour.reduce((a, b) => b.count > a.count ? b : a, { count: 0 });
    activityPatterns.peakDay = maxDay.count > 0 ? maxDay.day : null;
    activityPatterns.peakHour = maxHour.count > 0 ? maxHour.label : null;

    // Merge top routes
    const topRoutes = [
        ...topRoutesAsRider.map(r => ({ ...r, role: 'rider' })),
        ...topRoutesAsPassenger.map(r => ({ ...r, role: 'passenger' }))
    ].sort((a, b) => b.count - a.count).slice(0, 8);

    // Build platform revenue object
    const platformRevenue = {
        fromRides: platformRevenueFromRider[0]?.total || 0,
        fromRidesCount: platformRevenueFromRider[0]?.count || 0,
        fromBookings: platformRevenueFromPassenger[0]?.total || 0,
        fromBookingsCount: platformRevenueFromPassenger[0]?.count || 0,
        total: (platformRevenueFromRider[0]?.total || 0) + (platformRevenueFromPassenger[0]?.total || 0)
    };

    res.json({
        success: true,
        user: userDetails,
        recentRides,
        recentBookings,
        reportsAgainst,
        reviewsReceived: normalizedReviews,
        financials: {
            totalSpent: passengerFinancials[0]?.totalSpent || 0,
            transactionCount: (passengerFinancials[0]?.count || 0) + (riderFinancials[0]?.count || 0),
            totalEarnings: riderFinancials[0]?.totalEarnings || userDetails.statistics?.totalEarnings || 0
        },
        platformRevenue,
        topRoutes,
        activityPatterns,
        frequentCoTravelers,
        ratingCategories: ratingCategoryAvg[0] || null,
        reviewTags: tagFrequency
    });
});

/**
 * Suspend User (Admin Only)
 */
exports.suspendUser = asyncHandler(async (req, res) => {
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
        return res.json({
            success: false,
            message: 'Please provide a detailed reason (minimum 10 characters) for suspension'
        });
    }

    const userToSuspend = await User.findByIdAndUpdate(
        req.params.id,
        {
            accountStatus: 'SUSPENDED',
            isActive: false,
            isSuspended: true,
            suspensionReason: reason,
            suspendedAt: new Date(),
            suspendedBy: req.user._id,
            $push: {
                accountStatusHistory: {
                    status: 'SUSPENDED',
                    reason: reason,
                    changedBy: req.user._id,
                    changedAt: new Date()
                }
            }
        },
        { new: true }
    );

    if (!userToSuspend) {
        return res.json({ success: false, message: 'User not found' });
    }

    // Send in-app notification
    await Notification.create({
        user: userToSuspend._id,
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account Suspended',
        message: `Your account has been suspended by admin. Check your email for details.`,
        priority: 'HIGH'
    });

    // Send detailed suspension email
    if (userToSuspend.email) {
        try {
            await sendEmail({
                to: userToSuspend.email,
                subject: '🚫 Account Suspended - LANE Carpool',
                text: `Hi ${userToSuspend.profile?.firstName || 'User'},\n\n` +
                    `Your LANE Carpool account has been suspended by our admin team.\n\n` +
                    `REASON FOR SUSPENSION:\n${reason}\n\n` +
                    `WHAT THIS MEANS:\n` +
                    `• You cannot log in to your account\n` +
                    `• Your profile is hidden from other users\n` +
                    `• All active rides/bookings are cancelled\n\n` +
                    `IF YOU BELIEVE THIS IS A MISTAKE:\n` +
                    `Please reply to this email with proof of your innocence and any relevant evidence. ` +
                    `Our admin team will review your appeal and reactivate your account if we find the suspension was unjustified.\n\n` +
                    `APPEAL PROCESS:\n` +
                    `1. Reply to this email with your explanation\n` +
                    `2. Attach any proof/evidence (screenshots, receipts, etc.)\n` +
                    `3. Our team will review within 48 hours\n` +
                    `4. You'll receive an email with the decision\n\n` +
                    `We take user safety seriously and only suspend accounts when necessary. ` +
                    `If you have questions, please reply to this email.\n\n` +
                    `Best regards,\nLANE Carpool Admin Team`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">🚫 Account Suspended</h1>
                        </div>
                        
                        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
                            <p style="font-size: 16px; color: #374151;">Hi ${userToSuspend.profile?.firstName || 'User'},</p>
                            
                            <p style="font-size: 16px; color: #374151;">Your LANE Carpool account has been <strong>suspended</strong> by our admin team.</p>
                            
                            <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 15px; margin: 20px 0;">
                                <h3 style="color: #dc2626; margin-top: 0;">Reason for Suspension:</h3>
                                <p style="color: #374151; margin-bottom: 0;">${reason}</p>
                            </div>
                            
                            <h3 style="color: #1f2937;">What This Means:</h3>
                            <ul style="color: #4b5563; line-height: 1.8;">
                                <li>❌ You cannot log in to your account</li>
                                <li>👤 Your profile is hidden from other users</li>
                                <li>🚫 All active rides/bookings are cancelled</li>
                                <li>📧 You'll receive notifications via email only</li>
                            </ul>
                            
                            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
                                <h3 style="color: #16a34a; margin-top: 0;">✅ Think This is a Mistake?</h3>
                                <p style="color: #374151; margin-bottom: 10px;">You can appeal this suspension by replying to this email with:</p>
                                <ul style="color: #4b5563; margin-top: 10px;">
                                    <li>📝 Your explanation of what happened</li>
                                    <li>📎 Any proof or evidence (screenshots, receipts, etc.)</li>
                                    <li>💬 Context that supports your innocence</li>
                                </ul>
                            </div>
                            
                            <h3 style="color: #1f2937;">Appeal Process:</h3>
                            <ol style="color: #4b5563; line-height: 1.8;">
                                <li><strong>Reply</strong> to this email with your explanation and evidence</li>
                                <li><strong>Wait</strong> for our admin team to review (within 48 hours)</li>
                                <li><strong>Receive</strong> an email with our decision</li>
                                <li><strong>Account reactivated</strong> if appeal is successful</li>
                            </ol>
                            
                            <div style="background: #eff6ff; padding: 15px; margin: 20px 0; border-radius: 8px;">
                                <p style="color: #1e40af; margin: 0; font-size: 14px;">
                                    <strong>📧 Reply to this email:</strong> ${process.env.SUPPORT_EMAIL || 'support@lanecarpool.com'}
                                </p>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                                We take user safety seriously and only suspend accounts when necessary. 
                                If you have questions or need clarification, please don't hesitate to contact us.
                            </p>
                        </div>
                        
                        <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                                Best regards,<br>
                                <strong>LANE Carpool Admin Team</strong>
                            </p>
                        </div>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Failed to send suspension email:', emailError);
        }
    }

    // Cancel active rides/bookings
    if (userToSuspend.role === 'RIDER') {
        const activeRides = await Ride.find({
            rider: userToSuspend._id,
            status: { $in: ['ACTIVE', 'IN_PROGRESS'] }
        });

        for (const ride of activeRides) {
            ride.status = 'CANCELLED';
            ride.cancellationReason = 'Rider account suspended by admin';
            await ride.save();

            // Notify passengers
            const bookings = await Booking.find({
                ride: ride._id,
                status: { $in: ['CONFIRMED', 'PENDING'] }
            });

            for (const booking of bookings) {
                await Notification.create({
                    user: booking.passenger,
                    type: 'RIDE_CANCELLED',
                    title: 'Ride Cancelled',
                    message: `The ride you booked has been cancelled due to administrative reasons.`,
                    priority: 'HIGH'
                });
            }
        }
    } else {
        const activeBookings = await Booking.find({
            passenger: userToSuspend._id,
            status: { $in: ['CONFIRMED', 'PENDING'] }
        });

        for (const booking of activeBookings) {
            booking.status = 'CANCELLED';
            booking.cancellationReason = 'Passenger account suspended by admin';
            await booking.save();

            // Notify rider
            const ride = await Ride.findById(booking.ride);
            if (ride) {
                await Notification.create({
                    user: ride.rider,
                    type: 'BOOKING_CANCELLED',
                    title: 'Booking Cancelled',
                    message: `A passenger cancelled their booking due to administrative reasons.`,
                    priority: 'NORMAL'
                });
            }
        }
    }

    await AuditLog.log(req, {
        action: 'USER_SUSPENDED',
        targetType: 'User',
        targetId: userToSuspend._id,
        description: `Suspended user ${userToSuspend.email} — ${reason}`,
        changes: { before: { accountStatus: 'ACTIVE' }, after: { accountStatus: 'SUSPENDED', suspensionReason: reason } },
        severity: 'HIGH'
    });

    res.json({
        success: true,
        message: `User suspended successfully. Suspension email sent to ${userToSuspend.email}`
    });
});

/**
 * Activate/Reactivate User (After appeal review)
 */
exports.activateUser = asyncHandler(async (req, res) => {
    const { appealNotes } = req.body; // Admin notes about why reactivating

    const userToActivate = await User.findByIdAndUpdate(
        req.params.id,
        {
            accountStatus: 'ACTIVE',
            isActive: true,
            isSuspended: false,
            suspensionReason: null,
            reactivatedAt: new Date(),
            reactivatedBy: req.user._id,
            appealNotes: appealNotes || 'Account reactivated by admin',
            $push: {
                accountStatusHistory: {
                    status: 'ACTIVE',
                    reason: appealNotes || 'Appeal approved - account reactivated',
                    changedBy: req.user._id,
                    changedAt: new Date()
                }
            }
        },
        { new: true }
    );

    if (!userToActivate) {
        return res.json({ success: false, message: 'User not found' });
    }

    // Send in-app notification
    await Notification.create({
        user: userToActivate._id,
        type: 'ACCOUNT_ACTIVATED',
        title: 'Account Reactivated',
        message: 'Great news! Your account has been reactivated by our admin team.',
        priority: 'HIGH'
    });

    // Send reactivation email
    if (userToActivate.email) {
        try {
            await sendEmail({
                to: userToActivate.email,
                subject: '✅ Account Reactivated - LANE Carpool',
                text: `Hi ${userToActivate.profile?.firstName || 'User'},\n\n` +
                    `Great news! Your LANE Carpool account has been REACTIVATED.\n\n` +
                    `ADMIN DECISION:\n${appealNotes || 'Your appeal was reviewed and approved.'}\n\n` +
                    `YOUR ACCOUNT IS NOW FULLY ACTIVE:\n` +
                    `• ✅ You can log in immediately\n` +
                    `• ✅ Create or book rides\n` +
                    `• ✅ Access all features\n` +
                    `• ✅ Connect with other users\n\n` +
                    `Thank you for your patience during the review process. We strive to ensure a safe ` +
                    `and fair platform for all users.\n\n` +
                    `If you have any questions, feel free to contact us.\n\n` +
                    `Welcome back!\n\n` +
                    `Best regards,\nLANE Carpool Admin Team`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                            <h1 style="color: white; margin: 0; font-size: 28px;">✅ Account Reactivated!</h1>
                        </div>
                        
                        <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb;">
                            <p style="font-size: 18px; color: #16a34a; font-weight: bold;">Great News!</p>
                            
                            <p style="font-size: 16px; color: #374151;">Hi ${userToActivate.profile?.firstName || 'User'},</p>
                            
                            <p style="font-size: 16px; color: #374151;">Your LANE Carpool account has been <strong style="color: #16a34a;">REACTIVATED</strong> by our admin team.</p>
                            
                            <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0;">
                                <h3 style="color: #16a34a; margin-top: 0;">Admin Decision:</h3>
                                <p style="color: #374151; margin-bottom: 0;">${appealNotes || 'Your appeal was reviewed and approved. We found the suspension was either a mistake or the issue has been resolved.'}</p>
                            </div>
                            
                            <h3 style="color: #1f2937;">Your Account is Now Fully Active:</h3>
                            <ul style="color: #4b5563; line-height: 1.8;">
                                <li>✅ You can <strong>log in immediately</strong></li>
                                <li>✅ Create or book rides</li>
                                <li>✅ Access all platform features</li>
                                <li>✅ Connect with other users</li>
                                <li>✅ Your previous history is restored</li>
                            </ul>
                            
                            <div style="text-align: center; margin: 30px 0;">
                                <a href="${process.env.APP_URL || 'http://localhost:3000'}/auth/login" 
                                   style="background: #16a34a; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
                                    Log In Now
                                </a>
                            </div>
                            
                            <div style="background: #eff6ff; padding: 15px; margin: 20px 0; border-radius: 8px;">
                                <p style="color: #1e40af; margin: 0; font-size: 14px;">
                                    <strong>💡 Moving Forward:</strong> We encourage you to follow our community guidelines to ensure a positive experience for everyone.
                                </p>
                            </div>
                            
                            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                                Thank you for your patience during the review process. We strive to ensure a safe and fair platform for all users.
                            </p>
                            
                            <p style="color: #374151; font-size: 16px; font-weight: bold; margin-top: 20px;">
                                Welcome back! 🎉
                            </p>
                        </div>
                        
                        <div style="background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px;">
                            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                                Best regards,<br>
                                <strong>LANE Carpool Admin Team</strong>
                            </p>
                        </div>
                    </div>
                `
            });
        } catch (emailError) {
            console.error('Failed to send reactivation email:', emailError);
        }
    }

    await AuditLog.log(req, {
        action: 'USER_ACTIVATED',
        targetType: 'User',
        targetId: userToActivate._id,
        description: `Reactivated user ${userToActivate.email}`,
        changes: { before: { accountStatus: 'SUSPENDED' }, after: { accountStatus: 'ACTIVE', appealNotes: appealNotes || 'Account reactivated by admin' } },
        severity: 'MEDIUM'
    });

    res.json({
        success: true,
        message: `User reactivated successfully. Welcome back email sent to ${userToActivate.email}`
    });
});

/**
 * Delete User
 */
exports.deleteUser = asyncHandler(async (req, res) => {
    const userToDelete = await User.findByIdAndUpdate(
        req.params.id,
        {
            accountStatus: 'DELETED',
            deletedAt: new Date(),
            deletedBy: req.user._id
        },
        { new: true }
    );

    if (!userToDelete) {
        return res.json({ success: false, message: 'User not found' });
    }

    await AuditLog.log(req, {
        action: 'USER_DELETED',
        targetType: 'User',
        targetId: userToDelete._id,
        description: `Soft-deleted user ${userToDelete.email}`,
        severity: 'CRITICAL'
    });

    res.json({ success: true, message: 'User deleted successfully' });
});

/**
 * Approve verification
 */
exports.approveVerification = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const userToVerify = await User.findById(userId);

    if (!userToVerify) {
        throw new AppError('User not found', 404);
    }

    // Only RIDERS need verification
    if (userToVerify.role !== 'RIDER') {
        throw new AppError('Only riders require verification', 400);
    }

    // Check if user is in a verifiable state
    if (userToVerify.verificationStatus !== 'PENDING' && userToVerify.verificationStatus !== 'UNDER_REVIEW') {
        const statusMsg = userToVerify.verificationStatus === 'VERIFIED'
            ? 'User is already verified'
            : `User verification status is ${userToVerify.verificationStatus}`;
        throw new AppError(statusMsg, 400);
    }

    // Update user verification status
    userToVerify.verificationStatus = 'VERIFIED';
    userToVerify.verifiedAt = new Date();

    // Approve all document statuses
    if (userToVerify.documents) {
        if (userToVerify.documents.driverLicense) {
            userToVerify.documents.driverLicense.status = 'APPROVED';
            userToVerify.documents.driverLicense.verifiedBy = req.user._id;
            userToVerify.documents.driverLicense.verifiedAt = new Date();
        }
        if (userToVerify.documents.governmentId) {
            userToVerify.documents.governmentId.status = 'APPROVED';
            userToVerify.documents.governmentId.verifiedBy = req.user._id;
            userToVerify.documents.governmentId.verifiedAt = new Date();
        }
        if (userToVerify.documents.insurance) {
            userToVerify.documents.insurance.status = 'APPROVED';
            userToVerify.documents.insurance.verifiedBy = req.user._id;
            userToVerify.documents.insurance.verifiedAt = new Date();
        }
    }

    // Approve all vehicles
    if (userToVerify.vehicles && userToVerify.vehicles.length > 0) {
        userToVerify.vehicles.forEach(vehicle => {
            vehicle.status = 'APPROVED';
            vehicle.verifiedBy = req.user._id;
            vehicle.verifiedAt = new Date();
        });
    }

    await userToVerify.save();

    // Send notification
    await Notification.create({
        user: userToVerify._id,
        type: 'VERIFICATION_APPROVED',
        title: 'Verification Approved',
        message: 'Your documents have been verified. You can now post rides!',
        priority: 'HIGH'
    });

    await AuditLog.log(req, {
        action: 'VERIFICATION_APPROVED',
        targetType: 'User',
        targetId: userToVerify._id,
        description: `Approved verification for rider ${userToVerify.email}`,
        changes: { before: { verificationStatus: 'PENDING' }, after: { verificationStatus: 'VERIFIED' } },
        severity: 'MEDIUM'
    });

    res.status(200).json({
        success: true,
        message: 'User verified successfully'
    });
});

/**
 * Reject verification
 */
exports.rejectVerification = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { reason } = req.body;

    const userToVerify = await User.findById(userId);

    if (!userToVerify) {
        throw new AppError('User not found', 404);
    }

    // Only RIDERS need verification
    if (userToVerify.role !== 'RIDER') {
        throw new AppError('Only riders require verification', 400);
    }

    // Check if user is in a rejectable state
    if (userToVerify.verificationStatus !== 'PENDING' && userToVerify.verificationStatus !== 'UNDER_REVIEW') {
        const statusMsg = userToVerify.verificationStatus === 'VERIFIED'
            ? 'Cannot reject an already verified user'
            : userToVerify.verificationStatus === 'REJECTED'
                ? 'User is already rejected'
                : `Cannot reject user with status: ${userToVerify.verificationStatus}`;
        throw new AppError(statusMsg, 400);
    }

    userToVerify.verificationStatus = 'REJECTED';
    userToVerify.verificationRejectionReason = reason || 'Documents could not be verified';

    // Clear document data so rider must re-upload — use correct model field paths
    if (userToVerify.documents) {
        if (userToVerify.documents.driverLicense) {
            userToVerify.documents.driverLicense.number = undefined;
            userToVerify.documents.driverLicense.frontImage = undefined;
            userToVerify.documents.driverLicense.backImage = undefined;
            userToVerify.documents.driverLicense.status = 'REJECTED';
        }
        if (userToVerify.documents.governmentId) {
            userToVerify.documents.governmentId.number = undefined;
            userToVerify.documents.governmentId.frontImage = undefined;
            userToVerify.documents.governmentId.backImage = undefined;
            userToVerify.documents.governmentId.status = 'REJECTED';
        }
        if (userToVerify.documents.insurance) {
            userToVerify.documents.insurance.number = undefined;
            userToVerify.documents.insurance.document = undefined;
            userToVerify.documents.insurance.status = 'REJECTED';
        }
    }

    await userToVerify.save();

    // Send notification
    await Notification.create({
        user: userToVerify._id,
        type: 'VERIFICATION_REJECTED',
        title: 'Verification Rejected',
        message: reason || 'Your documents could not be verified. Please re-upload correct documents.',
        priority: 'HIGH'
    });

    await AuditLog.log(req, {
        action: 'VERIFICATION_REJECTED',
        targetType: 'User',
        targetId: userToVerify._id,
        description: `Rejected verification for rider ${userToVerify.email} — ${reason || 'No reason provided'}`,
        changes: { before: { verificationStatus: userToVerify.verificationStatus }, after: { verificationStatus: 'REJECTED' } },
        severity: 'MEDIUM'
    });

    res.status(200).json({
        success: true,
        message: 'Verification rejected'
    });
});

/**
 * Review and take action on report
 * ═══════════════════════════════════════════════════════════════════════
 * END-TO-END: Actions have REAL consequences — suspensions, trust score
 * penalties, email notifications to BOTH parties, rider earnings
 * adjustment on refund, and proper notification URLs.
 * ═══════════════════════════════════════════════════════════════════════
 */
exports.reviewReport = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { status, actionType, notes, suspensionDuration } = req.body;

    const report = await Report.findById(reportId)
        .populate('reportedUser', 'profile email phone accountStatus trustScore')
        .populate('reporter', 'profile email phone');

    if (!report) {
        return res.json({ success: false, message: 'Report not found' });
    }

    // Update report status
    report.status = status || (actionType === 'NO_ACTION' ? 'UNDER_REVIEW' : actionType === 'DISMISSED' ? 'DISMISSED' : 'RESOLVED');

    // Map actionType to model's enum for adminReview.action
    const actionMap = {
        'NO_ACTION': 'NO_ACTION',
        'WARNING': 'WARNING_ISSUED',
        'SUSPENSION': 'TEMPORARY_SUSPENSION',
        'BAN': 'PERMANENT_BAN',
        'DISMISSED': 'NO_ACTION',
        'REFUND': 'REFUND_ISSUED',
        'FURTHER_INVESTIGATION': 'FURTHER_INVESTIGATION'
    };

    report.adminReview = {
        reviewedBy: req.user._id,
        reviewedAt: new Date(),
        action: actionMap[actionType] || 'NO_ACTION',
        actionDate: new Date(),
        actionDetails: notes,
        notes: notes
    };

    // D8: Track SLA response times
    if (!report.sla.firstResponseAt) {
        report.sla.firstResponseAt = new Date();
    }

    if (report.status === 'RESOLVED' || report.status === 'DISMISSED') {
        report.resolution = {
            resolved: true,
            resolvedAt: new Date(),
            outcome: actionType
        };
    }

    // Helper: Get user name safely
    const getReportedName = () => {
        const p = report.reportedUser?.profile;
        return p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'User' : 'User';
    };
    const getReporterName = () => {
        const p = report.reporter?.profile;
        return p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'User' : 'User';
    };

    // ═══════════════════════════════════════════════════════════════════
    // TRUST SCORE PENALTY — Real consequences for substantiated reports
    // WARNING: -5 pts  |  SUSPENSION: -15 pts  |  BAN: -25 pts
    // ═══════════════════════════════════════════════════════════════════
    const trustPenalty = { WARNING: 5, SUSPENSION: 15, BAN: 25 }[actionType] || 0;
    if (trustPenalty > 0 && report.reportedUser?._id) {
        const reportedUser = await User.findById(report.reportedUser._id);
        if (reportedUser) {
            const currentScore = reportedUser.trustScore?.score || 50;
            const newScore = Math.max(0, currentScore - trustPenalty);

            // Auto-recalculate trust level based on new score
            let newLevel = 'NEWCOMER';
            if (newScore >= 80) newLevel = 'EXPERT';
            else if (newScore >= 60) newLevel = 'AMBASSADOR';
            else if (newScore >= 40) newLevel = 'EXPERIENCED';
            else if (newScore >= 20) newLevel = 'REGULAR';

            reportedUser.trustScore.score = newScore;
            reportedUser.trustScore.level = newLevel;
            reportedUser.trustScore.lastCalculated = new Date();
            await reportedUser.save();
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // HANDLE ACTION TYPES — Each has in-app notification + email
    // ═══════════════════════════════════════════════════════════════════
    let refundAmt = 0;

    switch (actionType) {
        case 'WARNING': {
            // In-app notification (correct type: WARNING)
            await Notification.create({
                user: report.reportedUser._id,
                type: 'WARNING',
                title: '⚠️ Community Guidelines Warning',
                message: `You have received a formal warning for ${(report.category || '').replace(/_/g, ' ').toLowerCase()}. Reason: ${notes || 'Policy violation'}. Repeated violations will lead to account suspension.`,
                priority: 'HIGH',
                data: { url: '/notifications', actionRequired: true }
            });

            // Email notification
            emailService.sendWarningEmail(
                report.reportedUser.email,
                report.reportedUser.profile?.firstName,
                { reason: notes, category: report.category }
            ).catch(e => console.error('Warning email failed:', e.message));
            break;
        }

        case 'SUSPENSION': {
            const suspensionEnd = new Date();
            const days = parseInt(suspensionDuration) || 7;
            suspensionEnd.setDate(suspensionEnd.getDate() + days);

            // Actually suspend the user — set BOTH fields for complete enforcement
            await User.findByIdAndUpdate(report.reportedUser._id, {
                accountStatus: 'SUSPENDED',
                isSuspended: true,
                suspensionReason: notes || 'Safety policy violation',
                suspendedAt: new Date(),
                suspendedBy: req.user._id,
                suspensionEnd: suspensionEnd,
                $push: {
                    accountStatusHistory: {
                        status: 'SUSPENDED',
                        reason: notes || 'Safety policy violation',
                        changedBy: req.user._id,
                        changedAt: new Date(),
                        suspensionEnd: suspensionEnd
                    }
                }
            });

            // In-app notification
            await Notification.create({
                user: report.reportedUser._id,
                type: 'ACCOUNT_SUSPENDED',
                title: '🚫 Account Suspended',
                message: `Your account has been suspended for ${days} days due to: ${notes || 'Policy violation'}. It will be automatically reactivated on ${suspensionEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}.`,
                priority: 'HIGH',
                data: { url: '/notifications', actionRequired: true }
            });

            // Email notification
            emailService.sendSuspensionEmail(
                report.reportedUser.email,
                report.reportedUser.profile?.firstName,
                { reason: notes, durationDays: days, suspensionEnd }
            ).catch(e => console.error('Suspension email failed:', e.message));
            break;
        }

        case 'BAN': {
            // Permanently ban user
            await User.findByIdAndUpdate(report.reportedUser._id, {
                accountStatus: 'DELETED',
                isSuspended: true,
                isActive: false,
                deletedAt: new Date(),
                deletedBy: req.user._id,
                deletionReason: notes || 'Permanent ban — severe safety violation',
                $push: {
                    accountStatusHistory: {
                        status: 'DELETED',
                        reason: notes || 'Permanent ban — severe safety violation',
                        changedBy: req.user._id,
                        changedAt: new Date()
                    }
                }
            });

            // In-app notification
            await Notification.create({
                user: report.reportedUser._id,
                type: 'ACCOUNT_BANNED',
                title: '🚫 Account Permanently Banned',
                message: `Your account has been permanently banned. Reason: ${notes || 'Severe policy violation'}. Contact support@looplane.in to appeal.`,
                priority: 'HIGH',
                data: { actionRequired: false }
            });

            // Email notification
            emailService.sendBanEmail(
                report.reportedUser.email,
                report.reportedUser.profile?.firstName,
                { reason: notes }
            ).catch(e => console.error('Ban email failed:', e.message));
            break;
        }

        case 'REFUND': {
            // Process refund if booking exists
            if (report.booking) {
                const booking = await Booking.findById(report.booking).populate('rider', 'profile email');
                if (booking) {
                    refundAmt = parseFloat(req.body.refundAmount) || booking.payment?.totalAmount || booking.totalPrice || 0;

                    // Mark booking payment as refunded
                    if (!booking.payment) booking.payment = {};
                    booking.payment.status = 'REFUNDED';
                    booking.payment.refundedAt = new Date();
                    booking.payment.refundReason = notes;
                    booking.payment.refundAmount = refundAmt;
                    await booking.save();

                    report.refundRequested = true;
                    report.refundAmount = refundAmt;
                    report.refundStatus = 'PROCESSED';

                    // Notify the REPORTER (passenger) about their refund
                    await Notification.create({
                        user: report.reporter._id,
                        type: 'PAYMENT_REFUNDED',
                        title: '💰 Refund Processed',
                        message: `₹${refundAmt} has been refunded to your account for your ${(report.category || '').replace(/_/g, ' ').toLowerCase()} report. The refund will reflect in 3-5 business days.`,
                        priority: 'HIGH',
                        data: { bookingId: booking._id, url: '/my-reports' }
                    });

                    // Notify the RIDER about the deduction from their earnings
                    if (booking.rider?._id) {
                        const bookingRef = booking.bookingReference || booking._id.toString().slice(-8).toUpperCase();
                        await Notification.create({
                            user: booking.rider._id,
                            type: 'PAYMENT_REFUNDED',
                            title: '💸 Refund Deducted From Earnings',
                            message: `₹${refundAmt} has been refunded to a passenger from your ride (Booking: ${bookingRef}). Reason: ${notes || 'Complaint resolved'}. This amount will be adjusted from your earnings.`,
                            priority: 'NORMAL',
                            data: { bookingId: booking._id, url: '/dashboard' }
                        });

                        // Email the rider about the deduction
                        if (booking.rider.email) {
                            emailService.sendRefundDeductionEmail(
                                booking.rider.email,
                                booking.rider.profile?.firstName,
                                { amount: refundAmt, reason: notes, bookingRef }
                            ).catch(e => console.error('Rider refund email failed:', e.message));
                        }
                    }
                }
            }
            break;
        }

        case 'NO_ACTION':
        case 'DISMISSED':
            // No action on reported user — but reporter still gets notification
            break;
    }

    // If admin included a message, push it into the thread
    const messageToReporter = req.body.messageToReporter?.trim();
    if (messageToReporter) {
        report.messages = report.messages || [];
        report.messages.push({ from: 'ADMIN', message: messageToReporter, timestamp: new Date() });
    }

    // Add investigation timeline event for the action
    if (!report.investigation) report.investigation = {};
    if (!report.investigation.timeline) report.investigation.timeline = [];
    report.investigation.timeline.push({
        event: `ACTION_${actionType}`,
        performedBy: req.user._id,
        timestamp: new Date(),
        details: `Action taken: ${actionType}${notes ? ' — ' + notes.substring(0, 200) : ''}`,
        isAutomatic: false
    });

    // ═══════════════════════════════════════════════════════════════════
    // NOTIFY REPORTER — In-app + Email with proper URL and details
    // ═══════════════════════════════════════════════════════════════════
    const outcomeLabels = {
        'WARNING': 'a formal warning has been issued to the reported user',
        'SUSPENSION': 'the reported user\'s account has been suspended',
        'BAN': 'the reported user has been permanently removed from LoopLane',
        'REFUND': `a refund of ₹${refundAmt} has been processed to your account`,
        'NO_ACTION': 'further investigation has been scheduled',
        'DISMISSED': 'the report has been reviewed and closed'
    };
    const outcomeText = outcomeLabels[actionType] || 'your report has been reviewed';

    await Notification.create({
        user: report.reporter._id,
        type: 'REPORT_RESOLVED',
        title: '✅ Your Safety Report Has Been Resolved',
        message: messageToReporter
            ? `${messageToReporter.substring(0, 150)}${messageToReporter.length > 150 ? '…' : ''}`
            : `Your ${(report.category || '').replace(/_/g, ' ').toLowerCase()} report has been reviewed: ${outcomeText}.`,
        priority: actionType === 'DISMISSED' ? 'NORMAL' : 'HIGH',
        data: { reportId: report._id, url: '/my-reports', actionRequired: false }
    });

    // Email the reporter about resolution
    emailService.sendReportResolvedEmail(
        report.reporter.email,
        report.reporter.profile?.firstName,
        {
            category: report.category,
            action: actionMap[actionType] || 'NO_ACTION',
            adminMessage: messageToReporter,
            refundAmount: refundAmt || undefined,
            reportId: report._id
        }
    ).catch(e => console.error('Reporter resolution email failed:', e.message));

    await report.save();

    res.json({
        success: true,
        message: 'Report reviewed successfully',
        report
    });
});

/**
 * Issue standalone refund for a report (without closing the report)
 */
exports.issueReportRefund = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { refundAmount, notes } = req.body;

    const report = await Report.findById(reportId).populate('booking reporter');
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    if (!report.booking) return res.status(400).json({ success: false, message: 'No booking linked to this report' });

    const booking = await Booking.findById(report.booking._id || report.booking);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    const amount = parseFloat(refundAmount) || booking.payment?.totalAmount || booking.totalPrice || 0;

    booking.payment.status = 'REFUNDED';
    booking.payment.refundedAt = new Date();
    booking.payment.refundAmount = amount;
    booking.payment.refundReason = notes || 'Refund issued via admin panel';
    await booking.save();

    report.refundRequested = true;
    report.refundAmount = amount;
    report.refundStatus = 'PROCESSED';
    report.adminReview = {
        ...report.adminReview,
        action: 'REFUND_ISSUED',
        actionDate: new Date(),
        actionDetails: notes
    };
    report.messages = report.messages || [];
    report.messages.push({ from: 'ADMIN', message: `A refund of ₹${amount} has been processed for your booking. ${notes || ''}`.trim(), timestamp: new Date() });
    await report.save();

    await Notification.create({
        user: report.reporter._id || report.reporter,
        type: 'PAYMENT_REFUNDED',
        title: 'Refund Processed',
        message: `₹${amount} has been refunded to your account. ${notes || ''}`.trim(),
        priority: 'HIGH'
    });

    res.json({ success: true, message: `Refund of ₹${amount} processed successfully`, report });
});

/**
 * Suspend/Unsuspend user
 */
exports.toggleUserStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { reason } = req.body;

    const userToToggle = await User.findById(userId);

    if (!userToToggle) {
        throw new AppError('User not found', 404);
    }

    userToToggle.isActive = !userToToggle.isActive;
    await userToToggle.save();

    const action = userToToggle.isActive ? 'activated' : 'suspended';

    // Notify user
    await Notification.create({
        user: userToToggle._id,
        type: 'ACCOUNT_STATUS_CHANGE',
        title: `Account ${action}`,
        message: reason || `Your account has been ${action}`,
        priority: 'HIGH'
    });

    res.status(200).json({
        success: true,
        message: `User ${action} successfully`
    });
});

/**
 * Cancel ride
 */
exports.cancelRide = asyncHandler(async (req, res) => {
    const { rideId } = req.params;
    const { reason } = req.body;

    const ride = await Ride.findById(rideId);

    if (!ride) {
        return res.json({ success: false, message: 'Ride not found' });
    }

    if (ride.status === 'CANCELLED') {
        return res.json({ success: false, message: 'Ride is already cancelled' });
    }

    ride.status = 'CANCELLED';
    ride.cancellationReason = reason;
    ride.cancelledBy = req.user._id;
    ride.cancelledAt = new Date();
    await ride.save();

    // Notify all passengers
    const bookings = await Booking.find({ ride: rideId, status: { $in: ['PENDING', 'CONFIRMED'] } });

    for (const booking of bookings) {
        booking.status = 'CANCELLED';
        await booking.save();

        await Notification.create({
            user: booking.passenger,
            type: 'RIDE_CANCELLED',
            title: 'Ride Cancelled by Admin',
            message: `Ride from ${ride.route?.start?.address || 'origin'} to ${ride.route?.destination?.address || 'destination'} has been cancelled. Reason: ${reason}`,
            priority: 'HIGH'
        });
    }

    // Notify rider
    await Notification.create({
        user: ride.rider,
        type: 'RIDE_CANCELLED',
        title: 'Your Ride Was Cancelled',
        message: `Your ride has been cancelled by admin. Reason: ${reason}`,
        priority: 'HIGH'
    });

    await AuditLog.log(req, {
        action: 'RIDE_CANCELLED',
        targetType: 'Ride',
        targetId: ride._id,
        description: `Admin cancelled ride — ${reason}`,
        changes: { before: { status: ride.status }, after: { status: 'CANCELLED' } },
        severity: 'HIGH'
    });

    res.json({ success: true, message: 'Ride cancelled successfully' });
});

/**
 * Get admin notifications
 */
exports.getNotifications = asyncHandler(async (req, res) => {
    const notifications = await Notification.find({
        user: req.user._id,
        type: {
            $in: [
                'SOS_ALERT',
                'VERIFICATION_APPROVED',
                'VERIFICATION_REJECTED',
                'ACCOUNT_SUSPENDED',
                'ACCOUNT_ACTIVATED',
                'ACCOUNT_BANNED',
                'WARNING',
                'RIDE_CANCELLED',
                'REPORT_RESOLVED',
                'ADMIN_MESSAGE'
            ]
        }
    })
        .sort({ createdAt: -1 })
        .limit(20);

    const unreadCount = await Notification.countDocuments({
        user: req.user._id,
        read: false,
        type: {
            $in: [
                'SOS_ALERT',
                'VERIFICATION_APPROVED',
                'VERIFICATION_REJECTED',
                'ACCOUNT_SUSPENDED',
                'ACCOUNT_ACTIVATED',
                'ACCOUNT_BANNED',
                'WARNING',
                'RIDE_CANCELLED',
                'REPORT_RESOLVED',
                'ADMIN_MESSAGE'
            ]
        }
    });

    res.json({
        success: true,
        notifications,
        unreadCount
    });
});

// ========== API METHODS (JSON responses for React frontend) ==========

/**
 * Get Dashboard Stats API
 */
exports.getDashboardStats = asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments();
    const activeRides = await Ride.countDocuments({ status: 'ACTIVE' });
    const completedRides = await Ride.countDocuments({ status: 'COMPLETED' });
    const pendingVerifications = await User.countDocuments({
        role: 'RIDER',
        verificationStatus: { $in: ['PENDING', 'UNDER_REVIEW'] }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayBookings = await Booking.countDocuments({
        createdAt: { $gte: today }
    });

    const revenueData = await Booking.aggregate([
        {
            $match: {
                status: { $in: ['COMPLETED', 'DROPPED_OFF'] },
                totalPrice: { $gt: 0 }
            }
        },
        {
            $group: {
                _id: null,
                platformRevenue: { $sum: '$payment.platformCommission' },
                totalTransactionVolume: { $sum: '$totalPrice' }
            }
        }
    ]);

    const recentActivities = await Notification.find({ type: { $in: ['RIDE_CREATED', 'BOOKING_CREATED', 'USER_REGISTERED'] } })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();

    res.json({
        success: true,
        stats: {
            totalUsers,
            activeRides,
            completedRides,
            pendingVerifications,
            totalRevenue: revenueData[0]?.platformRevenue || 0,
            totalTransactionVolume: revenueData[0]?.totalTransactionVolume || 0,
            todayBookings
        },
        recentActivities: recentActivities.map(a => ({
            icon: a.type === 'RIDE_CREATED' ? '🚗' : a.type === 'BOOKING_CREATED' ? '📋' : '👤',
            message: a.message,
            time: a.createdAt
        }))
    });
});

/**
 * Get Users API
 */
exports.getUsers = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const requestedRole = req.query.role ? String(req.query.role).toUpperCase() : null;
    const requestedStatus = req.query.status ? String(req.query.status).toUpperCase() : null;
    const search = (req.query.search || '').toString().trim();

    const filterParts = [];
    // Always exclude admin users from the list
    filterParts.push({ role: { $ne: 'ADMIN' } });

    if (requestedRole && requestedRole !== 'ALL') {
        filterParts.push({ role: requestedRole });
    }

    if (requestedStatus && requestedStatus !== 'ALL') {
        filterParts.push({ accountStatus: requestedStatus });
    }

    // Prefer Solr for search if configured (faster than regex scans as the dataset grows).
    if (search) {
        try {
            const { isSolrEnabled, searchUserIds } = require('../utils/solrClient');

            if (isSolrEnabled()) {
                const { ids, total } = await searchUserIds(search, {
                    start: skip,
                    rows: limit,
                    role: req.query.role,
                    status: req.query.status
                });

                if (!ids.length) {
                    return res.json({
                        success: true,
                        users: [],
                        pagination: {
                            page,
                            limit,
                            total: 0,
                            pages: 0
                        }
                    });
                }

                const mongoFilter = filterParts.length ? { $and: filterParts } : {};
                const rawUsers = await User.find({
                    ...mongoFilter,
                    _id: { $in: ids }
                })
                    .select('profile email phone role accountStatus createdAt verificationStatus rating statistics')
                    .lean();

                const byId = new Map(rawUsers.map((u) => [String(u._id), u]));
                const users = ids.map((id) => byId.get(String(id))).filter(Boolean);

                return res.json({
                    success: true,
                    users,
                    pagination: {
                        page,
                        limit,
                        total,
                        pages: Math.ceil(total / limit)
                    }
                });
            }
        } catch {
            // Solr not reachable/misconfigured — fall back to Mongo regex search.
        }

        // Mongo regex fallback (escape to avoid invalid regex / ReDoS patterns)
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 100);
        const searchRegex = new RegExp(escaped, 'i');
        filterParts.push({
            $or: [
                { email: searchRegex },
                { phone: searchRegex },
                { 'profile.firstName': searchRegex },
                { 'profile.lastName': searchRegex }
            ]
        });
    }

    const filter = filterParts.length ? { $and: filterParts } : {};

    const totalUsers = await User.countDocuments(filter);
    const users = await User.find(filter)
        .select('profile email phone role accountStatus createdAt verificationStatus rating statistics')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    res.json({
        success: true,
        users,
        pagination: {
            page,
            limit,
            total: totalUsers,
            pages: Math.ceil(totalUsers / limit)
        }
    });
});

/**
 * Update User Status API
 */
exports.updateUserStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['ACTIVE', 'SUSPENDED', 'DELETED'];

    if (!validStatuses.includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const user = await User.findByIdAndUpdate(
        req.params.id,
        {
            accountStatus: status,
            isActive: status === 'ACTIVE',
            isSuspended: status === 'SUSPENDED'
        },
        { new: true }
    );

    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: `User status updated to ${status}`, user });
});

/**
 * Get Pending Verifications API
 */
exports.getPendingVerifications = asyncHandler(async (req, res) => {
    const verifications = await User.find({
        role: 'RIDER',
        verificationStatus: { $in: ['PENDING', 'UNDER_REVIEW'] }
    })
        .select('profile email phone verificationStatus documents vehicles createdAt')
        .sort({ createdAt: -1 });

    res.json({ success: true, verifications });
});

/**
 * Get Rides API
 */
exports.getRides = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
        filter.status = req.query.status.toUpperCase();
    }
    if (req.query.date) {
        const dayStart = new Date(req.query.date);
        if (!Number.isNaN(dayStart.getTime())) {
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            filter['schedule.departureDateTime'] = { $gte: dayStart, $lt: dayEnd };
        }
    }

    // Build search filter at DB level instead of in-memory
    if (req.query.search) {
        const escaped = req.query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');

        // Find riders matching the search query (name/email)
        const matchingRiders = await User.find({
            $or: [
                { email: regex },
                { 'profile.firstName': regex },
                { 'profile.lastName': regex }
            ]
        }).select('_id').lean();

        const riderIds = matchingRiders.map(r => r._id);
        filter.$or = [
            { 'route.start.name': regex },
            { 'route.start.address': regex },
            { 'route.destination.name': regex },
            { 'route.destination.address': regex },
            ...(riderIds.length ? [{ rider: { $in: riderIds } }] : [])
        ];
    }

    const [rides, totalRides] = await Promise.all([
        Ride.find(filter)
            .populate('rider', 'profile email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean(),
        Ride.countDocuments(filter)
    ]);

    res.json({
        success: true,
        rides,
        pagination: {
            page,
            limit,
            total: totalRides,
            pages: Math.ceil(totalRides / limit)
        }
    });
});

/**
 * Get Ride Details API
 */
exports.getRideDetails = asyncHandler(async (req, res) => {
    const ride = await Ride.findById(req.params.rideId)
        .populate('rider', 'profile email phone vehicles');

    if (!ride) {
        return res.status(404).json({ success: false, message: 'Ride not found' });
    }

    // Resolve vehicle details from rider's vehicles subdocument array
    let vehicleDetails = null;
    if (ride.vehicle && ride.rider?.vehicles?.length) {
        vehicleDetails = ride.rider.vehicles.find(
            v => v._id.toString() === ride.vehicle.toString()
        ) || null;
    }

    const bookings = await Booking.find({ ride: ride._id })
        .populate('passenger', 'profile email');

    // Fetch reviews for all bookings of this ride
    const bookingIds = bookings.map(b => b._id);
    const reviews = await Review.find({ booking: { $in: bookingIds } })
        .populate('reviewer', 'profile email')
        .populate('reviewee', 'profile email')
        .sort({ createdAt: -1 });

    res.json({ success: true, ride, bookings, reviews, vehicleDetails });
});

/**
 * Get Bookings API
 */
exports.getBookings = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
        filter.status = req.query.status.toUpperCase();
    }
    if (req.query.search) {
        const s = req.query.search.trim();
        filter.$or = [
            { bookingReference: { $regex: s, $options: 'i' } },
            { _id: s.length === 24 ? s : undefined }
        ].filter(f => Object.values(f)[0] !== undefined);
        if (filter.$or.length === 0) delete filter.$or;
    }

    // Get stats for all statuses + revenue in parallel
    const [
        totalAll,
        totalPending,
        totalConfirmed,
        totalCompleted,
        totalCancelled,
        totalInTransit,
        totalNoShow,
        revenueAgg
    ] = await Promise.all([
        Booking.countDocuments({}),
        Booking.countDocuments({ status: 'PENDING' }),
        Booking.countDocuments({ status: 'CONFIRMED' }),
        Booking.countDocuments({ status: { $in: ['COMPLETED', 'DROPPED_OFF'] } }),
        Booking.countDocuments({ status: 'CANCELLED' }),
        Booking.countDocuments({ status: { $in: ['IN_TRANSIT', 'PICKED_UP', 'PICKUP_PENDING'] } }),
        Booking.countDocuments({ status: 'NO_SHOW' }),
        Booking.aggregate([
            { $match: { status: { $in: ['COMPLETED', 'DROPPED_OFF'] }, totalPrice: { $gt: 0 } } },
            { $group: {
                _id: null,
                totalVolume: { $sum: '$totalPrice' },
                platformRevenue: { $sum: '$payment.platformCommission' },
                riderEarnings: { $sum: '$payment.rideFare' },
                avgBookingValue: { $avg: '$totalPrice' },
                totalSeatsBooked: { $sum: '$seatsBooked' }
            }}
        ])
    ]);

    const totalBookings = await Booking.countDocuments(filter);
    const bookings = await Booking.find(filter)
        .populate('passenger', 'profile email rating')
        .populate('rider', 'profile email rating')
        .populate({
            path: 'ride',
            select: 'route schedule status pricing',
            populate: { path: 'rider', select: 'profile email rating' }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    res.json({
        success: true,
        bookings,
        pagination: {
            page,
            limit,
            total: totalBookings,
            pages: Math.ceil(totalBookings / limit)
        },
        stats: {
            all: totalAll,
            pending: totalPending,
            confirmed: totalConfirmed,
            completed: totalCompleted,
            cancelled: totalCancelled,
            inTransit: totalInTransit,
            noShow: totalNoShow
        },
        revenue: revenueAgg[0] || { totalVolume: 0, platformRevenue: 0, riderEarnings: 0, avgBookingValue: 0, totalSeatsBooked: 0 }
    });
});

/**
 * Get Booking Details API — Enhanced with analytics
 */
exports.getBookingDetails = asyncHandler(async (req, res) => {
    const booking = await Booking.findById(req.params.bookingId)
        .populate('passenger', 'profile email phone rating statistics verificationStatus')
        .populate('rider', 'profile email phone rating statistics')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile email phone vehicles rating statistics' }
        });

    if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Resolve vehicle details from rider's vehicles subdocument array
    let vehicleDetails = null;
    if (booking.ride?.vehicle && booking.ride?.rider?.vehicles?.length) {
        vehicleDetails = booking.ride.rider.vehicles.find(
            v => v._id.toString() === booking.ride.vehicle.toString()
        ) || null;
    }

    // Run all analytics in parallel
    const [
        reviews,
        siblingBookings,
        passengerStats,
        riderStats,
        carbonData,
        statusHistory
    ] = await Promise.all([
        // 1. Reviews for this booking
        Review.find({ booking: booking._id })
            .populate('reviewer', 'profile email')
            .populate('reviewee', 'profile email')
            .sort({ createdAt: -1 }),

        // 2. Other bookings on the same ride (sibling bookings)
        Booking.find({ ride: booking.ride?._id, _id: { $ne: booking._id } })
            .populate('passenger', 'profile email')
            .select('passenger status seatsBooked totalPrice payment.status payment.platformCommission pickupPoint.name dropoffPoint.name bookingReference createdAt')
            .sort({ createdAt: -1 })
            .limit(20),

        // 3. Passenger booking analytics
        Booking.aggregate([
            { $match: { passenger: booking.passenger?._id } },
            { $group: {
                _id: null,
                totalBookings: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } },
                noShow: { $sum: { $cond: [{ $eq: ['$status', 'NO_SHOW'] }, 1, 0] } },
                totalSpent: { $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'DROPPED_OFF']] }, '$totalPrice', 0] } },
                avgPrice: { $avg: '$totalPrice' },
                totalSeats: { $sum: '$seatsBooked' },
                totalPlatformRevenue: { $sum: '$payment.platformCommission' },
                biddingCount: { $sum: { $cond: ['$bidding.isCounterOffer', 1, 0] } },
                avgResponseTimeWait: { $avg: '$riderResponse.responseTime' }
            }}
        ]),

        // 4. Rider stats for this ride's driver
        booking.ride?.rider?._id ? Booking.aggregate([
            { $match: { rider: booking.ride.rider._id } },
            { $group: {
                _id: null,
                totalBookingsHandled: { $sum: 1 },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
                rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
                totalEarned: { $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'DROPPED_OFF']] }, '$payment.rideFare', 0] } },
                avgResponseTime: { $avg: '$riderResponse.responseTime' }
            }}
        ]) : Promise.resolve([]),

        // 5. Carbon footprint calculation
        (async () => {
            const dist = booking.journey?.distance || booking.ride?.route?.distance || 0;
            const seats = booking.seatsBooked || 1;
            // Average car emits ~120g CO2/km, carpooling splits it
            const soloEmissions = dist * 120; // grams
            const sharedEmissions = soloEmissions / (seats + 1); // +1 for driver
            return {
                distance: dist,
                soloEmissions: Math.round(soloEmissions),
                sharedEmissions: Math.round(sharedEmissions),
                saved: Math.round(soloEmissions - sharedEmissions),
                treesEquivalent: ((soloEmissions - sharedEmissions) / 21000).toFixed(2) // ~21kg CO2 per tree per year
            };
        })(),

        // 6. Booking lifecycle timing (how long in each status transition)
        (async () => {
            const events = [];
            if (booking.createdAt) events.push({ status: 'CREATED', at: new Date(booking.createdAt) });
            if (booking.riderResponse?.respondedAt) events.push({ status: 'RIDER_RESPONDED', at: new Date(booking.riderResponse.respondedAt) });
            if (booking.verification?.pickup?.verifiedAt) events.push({ status: 'PICKUP_VERIFIED', at: new Date(booking.verification.pickup.verifiedAt) });
            if (booking.journey?.startedAt) events.push({ status: 'JOURNEY_STARTED', at: new Date(booking.journey.startedAt) });
            if (booking.verification?.dropoff?.verifiedAt) events.push({ status: 'DROPOFF_VERIFIED', at: new Date(booking.verification.dropoff.verifiedAt) });
            if (booking.journey?.completedAt) events.push({ status: 'COMPLETED', at: new Date(booking.journey.completedAt) });
            if (booking.cancellation?.cancelledAt) events.push({ status: 'CANCELLED', at: new Date(booking.cancellation.cancelledAt) });
            if (booking.payment?.paidAt) events.push({ status: 'PAYMENT_RECEIVED', at: new Date(booking.payment.paidAt) });
            events.sort((a, b) => a.at - b.at);
            // Calculate durations between transitions
            const transitions = [];
            for (let i = 1; i < events.length; i++) {
                transitions.push({
                    from: events[i - 1].status,
                    to: events[i].status,
                    durationMin: Math.round((events[i].at - events[i - 1].at) / 60000)
                });
            }
            const totalLifecycleMin = events.length >= 2
                ? Math.round((events[events.length - 1].at - events[0].at) / 60000)
                : 0;
            return { events, transitions, totalLifecycleMin };
        })()
    ]);

    // Build price comparison (solo taxi vs carpool)
    const dist = booking.journey?.distance || booking.ride?.route?.distance || 0;
    const priceComparison = {
        carpoolPrice: booking.totalPrice || 0,
        estimatedTaxiPrice: Math.round(dist * 14), // ~₹14/km average taxi rate
        estimatedAutoPrice: Math.round(dist * 10), // ~₹10/km auto rate
        savings: Math.max(0, Math.round(dist * 14) - (booking.totalPrice || 0)),
        savingsPercent: dist > 0 && booking.totalPrice > 0
            ? Math.round(((Math.round(dist * 14) - booking.totalPrice) / Math.round(dist * 14)) * 100)
            : 0
    };

    res.json({
        success: true,
        booking,
        reviews,
        vehicleDetails,
        siblingBookings,
        passengerStats: passengerStats[0] || null,
        riderStats: riderStats[0] || null,
        carbonData,
        priceComparison,
        lifecycle: statusHistory
    });
});

/**
 * Refund Booking API
 */
exports.refundBooking = asyncHandler(async (req, res) => {
    const { amount } = req.body;
    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    booking.payment.status = 'REFUNDED';
    booking.payment.refundedAt = new Date();
    booking.payment.refundAmount = amount || booking.totalPrice;
    await booking.save();

    await Notification.create({
        user: booking.passenger,
        type: 'PAYMENT_REFUNDED',
        title: 'Refund Processed',
        message: `₹${amount || booking.totalPrice} has been refunded.`
    });

    await AuditLog.log(req, {
        action: 'BOOKING_REFUNDED',
        targetType: 'Booking',
        targetId: booking._id,
        description: `Refunded ₹${amount || booking.totalPrice} for booking ${booking._id}`,
        changes: { before: { paymentStatus: 'PAID' }, after: { paymentStatus: 'REFUNDED', refundAmount: amount || booking.totalPrice } },
        severity: 'HIGH'
    });

    res.json({ success: true, message: 'Refund processed successfully' });
});

/**
 * Get Revenue Report API
 */
exports.getRevenueReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const revenueData = await Booking.aggregate([
        {
            $match: {
                createdAt: { $gte: start, $lte: end },
                status: { $in: ['COMPLETED', 'DROPPED_OFF'] },
                totalPrice: { $gt: 0 }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                revenue: { $sum: '$payment.platformCommission' },
                volume: { $sum: '$totalPrice' },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const totalRevenue = revenueData.reduce((sum, d) => sum + d.revenue, 0);
    const totalVolume = revenueData.reduce((sum, d) => sum + d.volume, 0);

    res.json({
        success: true,
        data: revenueData,
        totalRevenue,
        totalVolume,
        startDate: start,
        endDate: end
    });
});

/**
 * Get Activity Report API
 */
exports.getActivityReport = asyncHandler(async (req, res) => {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const [userActivity, rideActivity, bookingActivity] = await Promise.all([
        User.aggregate([
            { $match: { createdAt: { $gte: start, $lte: end } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]),
        Ride.aggregate([
            { $match: { createdAt: { $gte: start, $lte: end } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]),
        Booking.aggregate([
            { $match: { createdAt: { $gte: start, $lte: end } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ])
    ]);

    res.json({
        success: true,
        userActivity,
        rideActivity,
        bookingActivity,
        startDate: start,
        endDate: end
    });
});

/**
 * Get Ride Analytics API
 */
exports.getRideAnalytics = asyncHandler(async (req, res) => {
    const { period = 'week' } = req.query;

    let startDate = new Date();
    if (period === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'month') startDate.setMonth(startDate.getMonth() - 1);
    else startDate.setFullYear(startDate.getFullYear() - 1);

    const [statusDistribution, popularRoutes, dailyRides, overallStats] = await Promise.all([
        Ride.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Ride.aggregate([
            { $match: { status: 'COMPLETED', createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: { start: '$route.start.name', destination: '$route.destination.name' },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]),
        Ride.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]),
        Ride.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: null,
                    totalRides: { $sum: 1 },
                    avgOccupancy: {
                        $avg: {
                            $subtract: [
                                { $ifNull: ['$pricing.totalSeats', 0] },
                                { $ifNull: ['$pricing.availableSeats', 0] }
                            ]
                        }
                    },
                    avgDistance: { $avg: '$route.distance' },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } }
                }
            }
        ])
    ]);

    const total = overallStats[0]?.totalRides || 0;
    const completed = overallStats[0]?.completed || 0;

    res.json({
        success: true,
        statusDistribution,
        popularRoutes,
        dailyRides,
        totalRides: total,
        avgOccupancy: overallStats[0]?.avgOccupancy || 0,
        avgDistance: overallStats[0]?.avgDistance || 0,
        completionRate: total > 0 ? (completed / total) * 100 : 0,
        period
    });
});

/**
 * Get Emergencies API
 */
exports.getEmergencies = asyncHandler(async (req, res) => {
    const Emergency = require('../models/Emergency');

    const emergencies = await Emergency.find()
        .populate('user', 'profile email phone')
        .populate('ride')
        .populate('booking')
        .sort({ createdAt: -1 })
        .limit(50);

    res.json({ success: true, emergencies });
});

/**
 * Resolve Emergency API
 */
exports.resolveEmergency = asyncHandler(async (req, res) => {
    const Emergency = require('../models/Emergency');
    const { resolution } = req.body;

    const emergency = await Emergency.findByIdAndUpdate(
        req.params.emergencyId,
        {
            status: 'RESOLVED',
            resolvedAt: new Date(),
            resolvedBy: req.user._id,
            resolution
        },
        { new: true }
    );

    if (!emergency) {
        return res.status(404).json({ success: false, message: 'Emergency not found' });
    }

    await AuditLog.log(req, {
        action: 'EMERGENCY_RESOLVED',
        targetType: 'Emergency',
        targetId: emergency._id,
        description: `Resolved emergency — ${resolution || 'No resolution notes'}`,
        severity: 'HIGH'
    });

    res.json({ success: true, message: 'Emergency resolved', emergency });
});

/**
 * Get Reports API (User Complaints/Issues)
 */
exports.getReports = asyncHandler(async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;

    const query = {};
    if (status && status !== 'all') {
        query.status = status.toUpperCase();
    }

    const reports = await Report.find(query)
        .populate('reporter', 'profile email phone')
        .populate('reportedUser', 'profile email phone')
        .populate('ride', 'route.start.name route.destination.name date')
        .populate('booking')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit));

    const total = await Report.countDocuments(query);

    // Get counts by status
    const statusCounts = await Report.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
        success: true,
        reports,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
        },
        statusCounts: statusCounts.reduce((acc, s) => {
            acc[s._id] = s.count;
            return acc;
        }, {})
    });
});

/**
 * Get Report Details API — Enhanced with safety dossier (Uber/Lyft-style)
 */
exports.getReportDetails = asyncHandler(async (req, res) => {
    const report = await Report.findById(req.params.reportId)
        .populate('reporter', 'profile email phone accountStatus trustScore rating statistics')
        .populate('reportedUser', 'profile email phone accountStatus trustScore rating statistics cancellationRate accountStatusHistory')
        .populate('ride')
        .populate('booking')
        .populate('adminReview.reviewedBy', 'profile email')
        .populate('investigation.assignedTo', 'profile email')
        .populate('investigation.timeline.performedBy', 'profile email');

    if (!report) {
        return res.status(404).json({ success: false, message: 'Report not found' });
    }

    // Build reported user safety dossier
    const reportedUserHistory = await Report.find({
        reportedUser: report.reportedUser._id,
        _id: { $ne: report._id }
    })
    .select('category severity status adminReview.action createdAt resolution')
    .sort({ createdAt: -1 })
    .limit(15);

    const reporterTotalReports = await Report.countDocuments({ reporter: report.reporter._id });

    const substantiatedCount = reportedUserHistory.filter(r =>
        r.status === 'RESOLVED' && r.adminReview?.action && r.adminReview.action !== 'NO_ACTION'
    ).length;

    res.json({
        success: true,
        report,
        reportedUserHistory,
        reportedUserTotalReports: reportedUserHistory.length,
        reporterTotalReports,
        isRepeatOffender: substantiatedCount >= 2
    });
});

/**
 * Add investigation timeline event
 */
exports.addInvestigationEvent = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { event, details } = req.body;

    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    if (!report.investigation) report.investigation = {};
    if (!report.investigation.timeline) report.investigation.timeline = [];

    report.investigation.timeline.push({
        event: event || 'NOTE_ADDED',
        performedBy: req.user._id,
        timestamp: new Date(),
        details,
        isAutomatic: false
    });

    // Track first response for SLA
    if (!report.sla.firstResponseAt) {
        report.sla.firstResponseAt = new Date();
    }

    await report.save();
    res.json({ success: true, message: 'Timeline event added', report });
});

/**
 * Update playbook progress
 */
exports.updatePlaybookProgress = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { templateId, completedSteps } = req.body;

    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

    if (!report.investigation) report.investigation = {};
    report.investigation.playbook = { templateId, completedSteps };

    // Auto-add timeline event
    if (!report.investigation.timeline) report.investigation.timeline = [];
    report.investigation.timeline.push({
        event: 'PLAYBOOK_UPDATED',
        performedBy: req.user._id,
        timestamp: new Date(),
        details: `Completed ${completedSteps.length} of playbook steps`,
        isAutomatic: true
    });

    await report.save();
    res.json({ success: true, message: 'Playbook updated', report });
});

/**
 * Safety Dashboard Metrics (Uber-style ops metrics)
 */
exports.getSafetyMetrics = asyncHandler(async (req, res) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);

    const [totalActive, resolvedThisMonth, avgResolution, breachedCount, refundsProcessed,
        repeatOffenders, categoryBreakdown, tierBreakdown, weeklyTrend] = await Promise.all([
        Report.countDocuments({ status: { $in: ['PENDING', 'UNDER_REVIEW', 'ESCALATED'] } }),
        Report.countDocuments({ 'resolution.resolvedAt': { $gte: thirtyDaysAgo }, status: { $in: ['RESOLVED', 'DISMISSED'] } }),
        Report.aggregate([
            { $match: { 'sla.resolutionTimeMinutes': { $exists: true, $gt: 0 } } },
            { $group: { _id: null, avg: { $avg: '$sla.resolutionTimeMinutes' } } }
        ]),
        Report.countDocuments({ status: { $nin: ['RESOLVED', 'DISMISSED'] }, 'sla.resolutionDeadline': { $lt: now } }),
        Report.countDocuments({ refundStatus: 'PROCESSED', updatedAt: { $gte: thirtyDaysAgo } }),
        Report.aggregate([
            { $group: { _id: '$reportedUser', count: { $sum: 1 } } },
            { $match: { count: { $gte: 3 } } },
            { $count: 'total' }
        ]),
        Report.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]),
        Report.aggregate([
            { $group: { _id: '$investigation.tier', count: { $sum: 1 } } }
        ]),
        Report.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            { $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                count: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ])
    ]);

    const slaCompliance = resolvedThisMonth > 0
        ? Math.round(((resolvedThisMonth - breachedCount) / resolvedThisMonth) * 100)
        : 100;

    res.json({
        success: true,
        metrics: {
            activeIncidents: totalActive,
            resolvedThisMonth,
            avgResolutionMinutes: Math.round(avgResolution[0]?.avg || 0),
            slaBreached: breachedCount,
            slaCompliance,
            refundsProcessed,
            repeatOffenders: repeatOffenders[0]?.total || 0,
            categoryBreakdown: categoryBreakdown.reduce((acc, c) => { acc[c._id] = c.count; return acc; }, {}),
            tierBreakdown: tierBreakdown.reduce((acc, t) => { acc[t._id || 'UNSET'] = t.count; return acc; }, {}),
            weeklyTrend
        }
    });
});

/**
 * Take Action on Report API
 */
exports.takeReportAction = asyncHandler(async (req, res, next) => {
    const actionMap = {
        warn: 'WARNING',
        suspend: 'SUSPENSION',
        ban: 'BAN',
        dismiss: 'DISMISSED',
        refund: 'REFUND',
        investigate: 'NO_ACTION'
    };

    const normalizedActionType = req.body.actionType || actionMap[req.body.action] || 'NO_ACTION';

    req.body = {
        ...req.body,
        actionType: normalizedActionType,
        notes: req.body.notes ?? req.body.reason,
        status: req.body.status || (
            normalizedActionType === 'DISMISSED'
                ? 'DISMISSED'
                : normalizedActionType === 'NO_ACTION'
                    ? 'UNDER_REVIEW'
                    : 'RESOLVED'
        )
    };

    return exports.reviewReport(req, res, next);
});

/**
 * Get Settings API
 */
exports.getSettings = asyncHandler(async (req, res) => {
    const settings = await Settings.getSettings();

    res.json({ success: true, settings });
});

/**
 * Update Settings API
 * Validates that pricing values are within sane ranges before persisting.
 */
exports.updateSettings = asyncHandler(async (req, res) => {
    const updates = req.body;

    // Validate pricing fields if present
    if (updates.pricing) {
        const p = updates.pricing;
        if (p.commission != null && (typeof p.commission !== 'number' || p.commission < 0 || p.commission > 50)) {
            throw new AppError('Commission must be a number between 0 and 50', 400);
        }
        if (p.baseFare != null && (typeof p.baseFare !== 'number' || p.baseFare < 0)) {
            throw new AppError('baseFare must be a non-negative number', 400);
        }
        if (p.pricePerKm != null && (typeof p.pricePerKm !== 'number' || p.pricePerKm < 0)) {
            throw new AppError('pricePerKm must be a non-negative number', 400);
        }
        if (p.pricePerMinute != null && (typeof p.pricePerMinute !== 'number' || p.pricePerMinute < 0)) {
            throw new AppError('pricePerMinute must be a non-negative number', 400);
        }
    }

    // Whitelist only known top-level settings sections
    const allowedSections = ['pricing', 'safety', 'notifications', 'features', 'email', 'sms', 'environmental', 'booking'];
    const sanitizedUpdates = {};
    for (const key of allowedSections) {
        if (updates[key] !== undefined) sanitizedUpdates[key] = updates[key];
    }

    const settings = await Settings.updateSettings(sanitizedUpdates, req.user._id);

    // Invalidate settings cache so middleware picks up changes immediately
    try { require('../middleware/settingsEnforcer').invalidateCache(); } catch {}

    await AuditLog.log(req, {
        action: 'SETTINGS_UPDATED',
        targetType: 'Settings',
        targetId: settings._id,
        description: `Platform settings updated: ${Object.keys(sanitizedUpdates).join(', ')}`,
        severity: 'MEDIUM',
        metadata: { sections: Object.keys(sanitizedUpdates) }
    });

    res.json({
        success: true,
        message: 'Settings updated successfully',
        settings
    });
});

/**
 * Mark Notification as Read API
 */
exports.markNotificationAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findByIdAndUpdate(
        req.params.notificationId,
        { read: true, readAt: new Date() },
        { new: true }
    );

    if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.json({ success: true, notification });
});

/**
 * System Health Check API
 */
exports.getSystemHealth = asyncHandler(async (req, res) => {
    const mongoose = require('mongoose');
    const os = require('os');

    const dbState = mongoose.connection.readyState;
    const dbStatus = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    const uptime = process.uptime();
    const memUsage = process.memoryUsage();

    const [userCount, activeRides, pendingEmergencies, pendingReports] = await Promise.all([
        User.estimatedDocumentCount(),
        Ride.countDocuments({ status: 'ACTIVE' }),
        (async () => {
            try {
                const Emergency = require('../models/Emergency');
                return await Emergency.countDocuments({ status: { $ne: 'RESOLVED' } });
            } catch { return 0; }
        })(),
        Report.countDocuments({ status: 'PENDING' })
    ]);

    res.json({
        success: true,
        health: {
            status: dbState === 1 ? 'healthy' : 'degraded',
            uptime: Math.floor(uptime),
            uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
            database: {
                status: dbStatus[dbState] || 'unknown',
                connected: dbState === 1
            },
            memory: {
                heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
                rss: Math.round(memUsage.rss / 1024 / 1024),
                external: Math.round(memUsage.external / 1024 / 1024)
            },
            system: {
                platform: os.platform(),
                cpus: os.cpus().length,
                totalMem: Math.round(os.totalmem() / 1024 / 1024),
                freeMem: Math.round(os.freemem() / 1024 / 1024),
                loadAvg: os.loadavg().map(l => Math.round(l * 100) / 100)
            },
            counters: {
                totalUsers: userCount,
                activeRides,
                pendingEmergencies,
                pendingReports
            },
            timestamp: new Date().toISOString()
        }
    });
});

/**
 * Per-User Revenue Analytics
 * Shows revenue generated by each user (as rider earnings, passenger spending)
 */
exports.getUserRevenue = asyncHandler(async (req, res) => {
    const { period = '30d', sortBy = 'totalRevenue', order = 'desc', page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
        case '7d': startDate = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': startDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
        case '90d': startDate = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
        case '1y': startDate = new Date(now - 365 * 24 * 60 * 60 * 1000); break;
        default: startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    // Aggregate rider earnings
    const riderRevenue = await Booking.aggregate([
        { $match: { status: { $in: ['COMPLETED', 'DROPPED_OFF'] }, createdAt: { $gte: startDate } } },
        { $lookup: { from: 'rides', localField: 'ride', foreignField: '_id', as: 'rideData' } },
        { $unwind: '$rideData' },
        {
            $group: {
                _id: '$rideData.rider',
                totalEarnings: { $sum: '$payment.rideFare' },
                totalCommission: { $sum: '$payment.platformCommission' },
                completedTrips: { $sum: 1 },
                totalPassengers: { $sum: '$seatsBooked' }
            }
        },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        {
            $project: {
                userId: '$_id',
                name: { $concat: [{ $ifNull: ['$user.profile.firstName', ''] }, ' ', { $ifNull: ['$user.profile.lastName', ''] }] },
                email: '$user.email',
                role: '$user.role',
                rating: '$user.rating.overall',
                totalEarnings: 1,
                totalCommission: 1,
                totalRevenue: { $add: ['$totalEarnings', '$totalCommission'] },
                completedTrips: 1,
                totalPassengers: 1
            }
        },
        { $sort: { [sortBy === 'totalRevenue' ? 'totalRevenue' : sortBy]: order === 'asc' ? 1 : -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) }
    ]);

    // Aggregate passenger spending
    const passengerSpending = await Booking.aggregate([
        { $match: { status: { $in: ['COMPLETED', 'DROPPED_OFF'] }, createdAt: { $gte: startDate } } },
        {
            $group: {
                _id: '$passenger',
                totalSpent: { $sum: '$totalPrice' },
                bookingCount: { $sum: 1 }
            }
        },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: '$user' },
        {
            $project: {
                userId: '$_id',
                name: { $concat: [{ $ifNull: ['$user.profile.firstName', ''] }, ' ', { $ifNull: ['$user.profile.lastName', ''] }] },
                email: '$user.email',
                totalSpent: 1,
                bookingCount: 1
            }
        },
        { $sort: { totalSpent: -1 } },
        { $limit: parseInt(limit) }
    ]);

    res.json({
        success: true,
        period,
        riderRevenue,
        passengerSpending
    });
});

/**
 * Per-Route Analytics
 * Shows which routes generate the most rides, revenue, and bookings
 */
exports.getRouteAnalytics = asyncHandler(async (req, res) => {
    const { period = '30d', limit: queryLimit = 20 } = req.query;

    const now = new Date();
    let startDate;
    switch (period) {
        case '7d': startDate = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': startDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
        case '90d': startDate = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
        case '1y': startDate = new Date(now - 365 * 24 * 60 * 60 * 1000); break;
        default: startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    // Aggregate by route (start city → destination city)
    const routeStats = await Ride.aggregate([
        { $match: { createdAt: { $gte: startDate }, status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED'] } } },
        {
            $group: {
                _id: {
                    from: { $ifNull: ['$route.start.city', '$route.start.address'] },
                    to: { $ifNull: ['$route.destination.city', '$route.destination.address'] }
                },
                fromCoords: { $first: '$route.start.coordinates' },
                toCoords: { $first: '$route.destination.coordinates' },
                totalRides: { $sum: 1 },
                completedRides: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
                avgPrice: { $avg: '$pricing.pricePerSeat' },
                avgDistance: { $avg: '$route.distance' },
                totalSeatsOffered: { $sum: '$pricing.totalSeats' },
                totalEarnings: { $sum: { $ifNull: ['$pricing.totalEarnings', 0] } }
            }
        },
        {
            $addFields: {
                completionRate: { $cond: [{ $gt: ['$totalRides', 0] }, { $multiply: [{ $divide: ['$completedRides', '$totalRides'] }, 100] }, 0] }
            }
        },
        { $sort: { totalRides: -1 } },
        { $limit: parseInt(queryLimit) }
    ]);

    res.json({
        success: true,
        period,
        routes: routeStats.map(r => ({
            from: r._id.from,
            to: r._id.to,
            fromCoords: r.fromCoords || null,
            toCoords: r.toCoords || null,
            totalRides: r.totalRides,
            completedRides: r.completedRides,
            completionRate: Math.round(r.completionRate),
            avgPrice: Math.round(r.avgPrice || 0),
            avgDistance: Math.round((r.avgDistance || 0) * 10) / 10,
            totalSeatsOffered: r.totalSeatsOffered,
            totalEarnings: Math.round(r.totalEarnings || 0)
        }))
    });
});

/**
 * Area/City Analytics
 * Shows which cities/areas have the most activity
 */
exports.getAreaAnalytics = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    const now = new Date();
    let startDate;
    switch (period) {
        case '7d': startDate = new Date(now - 7 * 24 * 60 * 60 * 1000); break;
        case '30d': startDate = new Date(now - 30 * 24 * 60 * 60 * 1000); break;
        case '90d': startDate = new Date(now - 90 * 24 * 60 * 60 * 1000); break;
        case '1y': startDate = new Date(now - 365 * 24 * 60 * 60 * 1000); break;
        default: startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    // Aggregate rides by origin city
    const originCities = await Ride.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
            $group: {
                _id: { $ifNull: ['$route.start.city', '$route.start.address'] },
                coords: { $first: '$route.start.coordinates' },
                ridesFrom: { $sum: 1 },
                completedFrom: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
                avgPrice: { $avg: '$pricing.pricePerSeat' },
                totalEarnings: { $sum: { $ifNull: ['$pricing.totalEarnings', 0] } }
            }
        },
        { $sort: { ridesFrom: -1 } },
        { $limit: 20 }
    ]);

    // Aggregate rides by destination city
    const destCities = await Ride.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
            $group: {
                _id: { $ifNull: ['$route.destination.city', '$route.destination.address'] },
                coords: { $first: '$route.destination.coordinates' },
                ridesTo: { $sum: 1 },
                completedTo: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } }
            }
        },
        { $sort: { ridesTo: -1 } },
        { $limit: 20 }
    ]);

    // User registrations by day for the period
    const userGrowth = await User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                newUsers: { $sum: 1 },
                riders: { $sum: { $cond: [{ $eq: ['$role', 'RIDER'] }, 1, 0] } },
                passengers: { $sum: { $cond: [{ $eq: ['$role', 'PASSENGER'] }, 1, 0] } }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    res.json({
        success: true,
        period,
        originCities: originCities.map(c => ({
            city: c._id || 'Unknown',
            coords: c.coords || null,
            ridesFrom: c.ridesFrom,
            completedFrom: c.completedFrom,
            avgPrice: Math.round(c.avgPrice || 0),
            totalEarnings: Math.round(c.totalEarnings || 0)
        })),
        destCities: destCities.map(c => ({
            city: c._id || 'Unknown',
            coords: c.coords || null,
            ridesTo: c.ridesTo,
            completedTo: c.completedTo
        })),
        userGrowth
    });
});

/**
 * Period Comparison Analytics
 * Compares current period vs previous period (e.g., this month vs last month)
 */
exports.getPeriodComparison = asyncHandler(async (req, res) => {
    const { period = '30d' } = req.query;

    const now = new Date();
    let periodMs;
    switch (period) {
        case '7d': periodMs = 7 * 24 * 60 * 60 * 1000; break;
        case '30d': periodMs = 30 * 24 * 60 * 60 * 1000; break;
        case '90d': periodMs = 90 * 24 * 60 * 60 * 1000; break;
        case '1y': periodMs = 365 * 24 * 60 * 60 * 1000; break;
        default: periodMs = 30 * 24 * 60 * 60 * 1000;
    }

    const currentStart = new Date(now - periodMs);
    const previousStart = new Date(now - 2 * periodMs);

    const [currentRides, previousRides, currentBookings, previousBookings, currentUsers, previousUsers, currentRevenue, previousRevenue] = await Promise.all([
        Ride.countDocuments({ createdAt: { $gte: currentStart } }),
        Ride.countDocuments({ createdAt: { $gte: previousStart, $lt: currentStart } }),
        Booking.countDocuments({ createdAt: { $gte: currentStart } }),
        Booking.countDocuments({ createdAt: { $gte: previousStart, $lt: currentStart } }),
        User.countDocuments({ createdAt: { $gte: currentStart } }),
        User.countDocuments({ createdAt: { $gte: previousStart, $lt: currentStart } }),
        Booking.aggregate([
            { $match: { status: { $in: ['COMPLETED', 'DROPPED_OFF'] }, createdAt: { $gte: currentStart } } },
            { $group: { _id: null, total: { $sum: '$totalPrice' }, commission: { $sum: '$payment.platformCommission' } } }
        ]),
        Booking.aggregate([
            { $match: { status: { $in: ['COMPLETED', 'DROPPED_OFF'] }, createdAt: { $gte: previousStart, $lt: currentStart } } },
            { $group: { _id: null, total: { $sum: '$totalPrice' }, commission: { $sum: '$payment.platformCommission' } } }
        ])
    ]);

    const calcChange = (current, previous) => {
        if (previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - previous) / previous) * 100);
    };

    const curRev = currentRevenue[0]?.commission || 0;
    const prevRev = previousRevenue[0]?.commission || 0;
    const curVol = currentRevenue[0]?.total || 0;
    const prevVol = previousRevenue[0]?.total || 0;

    res.json({
        success: true,
        period,
        comparison: {
            rides: { current: currentRides, previous: previousRides, change: calcChange(currentRides, previousRides) },
            bookings: { current: currentBookings, previous: previousBookings, change: calcChange(currentBookings, previousBookings) },
            newUsers: { current: currentUsers, previous: previousUsers, change: calcChange(currentUsers, previousUsers) },
            revenue: { current: curRev, previous: prevRev, change: calcChange(curRev, prevRev) },
            volume: { current: curVol, previous: prevVol, change: calcChange(curVol, prevVol) }
        }
    });
});

// Note: updateUserStatus and getRideDetails are defined above (single definition, no duplicates)

// ============================================================
// C15: CSV/Data Export
// ============================================================
exports.exportData = asyncHandler(async (req, res) => {
    const { type, startDate, endDate, format = 'csv' } = req.query;
    const MAX_EXPORT_ROWS = 50000; // Safety limit to prevent OOM

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    let data = [];
    let filename = '';
    let headers = [];

    switch (type) {
        case 'users': {
            const users = await User.find(hasDateFilter ? { createdAt: dateFilter } : {})
                .select('profile.firstName profile.lastName email phone role verificationStatus statistics rating createdAt')
                .limit(MAX_EXPORT_ROWS)
                .lean();
            headers = ['Name', 'Email', 'Phone', 'Role', 'Verification', 'Rides Posted', 'Rides Taken', 'Earnings', 'Spent', 'Rating', 'Joined'];
            data = users.map(u => [
                `${u.profile?.firstName || ''} ${u.profile?.lastName || ''}`.trim(),
                u.email, u.phone, u.role, u.verificationStatus,
                u.statistics?.totalRidesPosted || 0, u.statistics?.totalRidesTaken || 0,
                u.statistics?.totalEarnings || 0, u.statistics?.totalSpent || 0,
                u.rating?.overall || 0, u.createdAt?.toISOString()?.split('T')[0]
            ]);
            filename = 'users_export';
            break;
        }
        case 'rides': {
            const rides = await Ride.find(hasDateFilter ? { createdAt: dateFilter } : {})
                .populate('rider', 'profile.firstName profile.lastName')
                .select('route.start.name route.destination.name schedule.departureDateTime pricing status views')
                .limit(MAX_EXPORT_ROWS)
                .lean();
            headers = ['From', 'To', 'Rider', 'Date', 'Price/Seat', 'Total Seats', 'Available', 'Status', 'Views'];
            data = rides.map(r => [
                r.route?.start?.name, r.route?.destination?.name,
                `${r.rider?.profile?.firstName || ''} ${r.rider?.profile?.lastName || ''}`.trim(),
                r.schedule?.departureDateTime?.toISOString()?.split('T')[0],
                r.pricing?.pricePerSeat, r.pricing?.totalSeats, r.pricing?.availableSeats,
                r.status, r.views || 0
            ]);
            filename = 'rides_export';
            break;
        }
        case 'bookings': {
            const bookings = await Booking.find(hasDateFilter ? { createdAt: dateFilter } : {})
                .populate('passenger', 'profile.firstName profile.lastName')
                .populate('rider', 'profile.firstName profile.lastName')
                .select('status totalPrice seatsBooked payment.status payment.method createdAt')
                .limit(MAX_EXPORT_ROWS)
                .lean();
            headers = ['Passenger', 'Rider', 'Status', 'Amount', 'Seats', 'Payment Status', 'Payment Method', 'Date'];
            data = bookings.map(b => [
                `${b.passenger?.profile?.firstName || ''} ${b.passenger?.profile?.lastName || ''}`.trim(),
                `${b.rider?.profile?.firstName || ''} ${b.rider?.profile?.lastName || ''}`.trim(),
                b.status, b.totalPrice, b.seatsBooked, b.payment?.status, b.payment?.method,
                b.createdAt?.toISOString()?.split('T')[0]
            ]);
            filename = 'bookings_export';
            break;
        }
        case 'transactions': {
            const transactions = await Transaction.find(hasDateFilter ? { createdAt: dateFilter } : {})
                .select('type amounts payment.status payment.method description createdAt')
                .limit(MAX_EXPORT_ROWS)
                .lean();
            headers = ['Type', 'Passenger Paid', 'Ride Fare', 'Commission', 'Total', 'Payment Status', 'Method', 'Date'];
            data = transactions.map(t => [
                t.type, t.amounts?.passengerPaid, t.amounts?.rideFare,
                t.amounts?.platformCommission, t.amounts?.total,
                t.payment?.status, t.payment?.method,
                t.createdAt?.toISOString()?.split('T')[0]
            ]);
            filename = 'transactions_export';
            break;
        }
        default:
            throw new AppError('Invalid export type. Use: users, rides, bookings, transactions', 400);
    }

    // Build CSV
    const csvRows = [headers.join(',')];
    data.forEach(row => {
        csvRows.push(row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','));
    });
    const csvContent = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
});

// ============================================================
// E1: Payment Simulation
// ============================================================
exports.simulatePayment = asyncHandler(async (req, res) => {
    const { bookingId, method = 'UPI', simulateFailure = false } = req.body;

    const booking = await Booking.findById(bookingId)
        .populate('ride', 'rider route.start.name route.destination.name')
        .populate('passenger', 'profile.firstName profile.lastName');

    if (!booking) throw new AppError('Booking not found', 404);
    if (booking.payment.status === 'PAID') throw new AppError('Payment already completed', 400);

    // Simulate payment gateway processing delay
    const gatewayOrderId = `SIM_${Date.now()}_${require('crypto').randomBytes(6).toString('hex')}`;
    const gatewayPaymentId = `PAY_${Date.now()}_${require('crypto').randomBytes(6).toString('hex')}`;

    if (simulateFailure) {
        await Transaction.create({
            type: 'BOOKING_PAYMENT', booking: booking._id, ride: booking.ride._id,
            passenger: booking.passenger._id, rider: booking.ride.rider,
            amounts: { passengerPaid: booking.totalPrice, total: booking.totalPrice },
            payment: { method, gateway: 'SIMULATION', gatewayOrderId, status: 'FAILED' },
            description: `Simulated failed payment for booking #${booking._id}`
        });
        return res.json({ success: false, message: 'Payment simulation failed (as requested)', gatewayOrderId });
    }

    // Success path
    booking.payment.status = 'PAID';
    booking.payment.method = method;
    booking.payment.paidAt = new Date();
    await booking.save();

    // Calculate commission
    const settings = await Settings.getSettings();
    const commissionRate = (settings?.pricing?.commission || 10) / 100;
    const rideFare = booking.totalPrice / (1 + commissionRate);
    const commission = booking.totalPrice - rideFare;

    // Create transaction records
    await Transaction.create({
        type: 'BOOKING_PAYMENT', booking: booking._id, ride: booking.ride._id,
        passenger: booking.passenger._id, rider: booking.ride.rider,
        amounts: { passengerPaid: booking.totalPrice, rideFare: Math.round(rideFare), platformCommission: Math.round(commission), total: booking.totalPrice },
        payment: { method, gateway: 'SIMULATION', gatewayOrderId, gatewayPaymentId, status: 'COMPLETED' },
        description: `Payment for booking #${booking._id}`
    });

    res.json({
        success: true, message: 'Payment simulated successfully',
        payment: { gatewayOrderId, gatewayPaymentId, method, amount: booking.totalPrice, status: 'PAID' }
    });
});

// ============================================================
// E7: Invoice Generation
// ============================================================
exports.generateInvoice = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile.firstName profile.lastName email phone')
        .populate('rider', 'profile.firstName profile.lastName email')
        .populate('ride', 'route.start.name route.destination.name route.distance schedule.departureDateTime pricing');

    if (!booking) throw new AppError('Booking not found', 404);

    const settings = await Settings.getSettings();
    const commissionRate = (settings?.pricing?.commission || 10) / 100;
    const rideFare = Math.round(booking.totalPrice / (1 + commissionRate));
    const commission = booking.totalPrice - rideFare;

    const invoice = {
        invoiceNumber: `INV-${booking._id.toString().slice(-8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
        date: new Date(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        booking: {
            id: booking._id,
            status: booking.status,
            seatsBooked: booking.seatsBooked,
            route: {
                from: booking.ride?.route?.start?.name || 'N/A',
                to: booking.ride?.route?.destination?.name || 'N/A',
                distance: booking.ride?.route?.distance || 0
            },
            departureDate: booking.ride?.schedule?.departureDateTime
        },
        passenger: {
            name: `${booking.passenger?.profile?.firstName || ''} ${booking.passenger?.profile?.lastName || ''}`.trim(),
            email: booking.passenger?.email,
            phone: booking.passenger?.phone
        },
        rider: {
            name: `${booking.rider?.profile?.firstName || ''} ${booking.rider?.profile?.lastName || ''}`.trim(),
            email: booking.rider?.email
        },
        lineItems: [
            { description: `Ride fare (${booking.seatsBooked} seat${booking.seatsBooked > 1 ? 's' : ''})`, amount: rideFare },
            { description: `Platform service fee (${(commissionRate * 100).toFixed(0)}%)`, amount: commission }
        ],
        subtotal: rideFare,
        serviceFee: commission,
        total: booking.totalPrice,
        payment: {
            method: booking.payment?.method || 'CASH',
            status: booking.payment?.status || 'PENDING',
            paidAt: booking.payment?.paidAt
        },
        currency: 'INR',
        platform: { name: 'LoopLane', tagline: 'Smart Carpooling Platform' }
    };

    res.json({ success: true, invoice });
});

// ============================================================
// E8: Batch Settlements
// ============================================================
exports.batchSettlement = asyncHandler(async (req, res) => {
    const { riderIds, startDate, endDate } = req.body;

    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);

    const query = {
        status: 'COMPLETED',
        'payment.status': 'PAID',
        'payment.settled': { $ne: true }
    };
    if (riderIds?.length) query.rider = { $in: riderIds };
    if (Object.keys(dateFilter).length) query.createdAt = dateFilter;

    const bookings = await Booking.find(query)
        .populate('rider', 'profile.firstName profile.lastName')
        .lean();

    // Group by rider
    const settlements = {};
    const settings = await Settings.getSettings();
    const commissionRate = (settings?.pricing?.commission || 10) / 100;

    bookings.forEach(b => {
        const riderId = b.rider?._id?.toString();
        if (!riderId) return;
        if (!settlements[riderId]) {
            settlements[riderId] = {
                rider: b.rider,
                bookings: [],
                totalAmount: 0,
                totalCommission: 0,
                riderPayout: 0
            };
        }
        const rideFare = Math.round(b.totalPrice / (1 + commissionRate));
        const commission = b.totalPrice - rideFare;
        settlements[riderId].bookings.push(b._id);
        settlements[riderId].totalAmount += b.totalPrice;
        settlements[riderId].totalCommission += commission;
        settlements[riderId].riderPayout += rideFare;
    });

    // Mark bookings as settled
    const bookingIds = bookings.map(b => b._id);
    await Booking.updateMany({ _id: { $in: bookingIds } }, { $set: { 'payment.settled': true, 'payment.settledAt': new Date() } });

    // Create payout transaction records
    for (const [riderId, settlement] of Object.entries(settlements)) {
        await Transaction.create({
            type: 'RIDER_PAYOUT',
            booking: settlement.bookings[0], // Primary booking reference
            rider: riderId,
            amounts: {
                rideFare: settlement.riderPayout,
                platformCommission: settlement.totalCommission,
                total: settlement.riderPayout
            },
            payment: { method: 'BANK_TRANSFER', status: 'COMPLETED' },
            description: `Batch settlement for ${settlement.bookings.length} bookings`,
            metadata: { bookingIds: settlement.bookings, settlementDate: new Date() }
        });
    }

    res.json({
        success: true,
        message: `Settled ${bookings.length} bookings across ${Object.keys(settlements).length} riders`,
        settlements: Object.values(settlements).map(s => ({
            rider: s.rider,
            bookingCount: s.bookings.length,
            totalAmount: s.totalAmount,
            commission: s.totalCommission,
            payout: s.riderPayout
        }))
    });
});

// ============================================================
// H3: Demand & Supply Analytics
// ============================================================
exports.getDemandSupplyAnalytics = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    // Rides posted (supply) by day
    const supply = await Ride.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                ridesPosted: { $sum: 1 },
                totalSeats: { $sum: '$pricing.totalSeats' },
                avgPrice: { $avg: '$pricing.pricePerSeat' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Bookings (demand) by day
    const demand = await Booking.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                bookingsRequested: { $sum: 1 },
                seatsRequested: { $sum: '$seatsBooked' },
                confirmed: { $sum: { $cond: [{ $in: ['$status', ['CONFIRMED', 'COMPLETED']] }, 1, 0] } },
                cancelled: { $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] } }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Peak hours (by hour of day)
    const peakHours = await Ride.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
            $group: {
                _id: { $hour: '$schedule.departureDateTime' },
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    // Supply-demand ratio
    const totalSupply = supply.reduce((sum, s) => sum + s.totalSeats, 0);
    const totalDemand = demand.reduce((sum, d) => sum + d.seatsRequested, 0);
    const ratio = totalDemand > 0 ? (totalSupply / totalDemand).toFixed(2) : 'N/A';

    res.json({
        success: true,
        analytics: {
            supply, demand, peakHours,
            summary: {
                totalRidesPosted: supply.reduce((s, d) => s + d.ridesPosted, 0),
                totalBookings: demand.reduce((s, d) => s + d.bookingsRequested, 0),
                totalSeatsOffered: totalSupply,
                totalSeatsRequested: totalDemand,
                supplyDemandRatio: parseFloat(ratio) || 0,
                peakHour: peakHours[0]?._id,
                avgPricePerSeat: supply.length ? Math.round(supply.reduce((s, d) => s + d.avgPrice, 0) / supply.length) : 0
            }
        }
    });
});

// ============================================================
// H4: User LTV, Retention & Churn Analytics
// ============================================================
exports.getUserLTVAnalytics = asyncHandler(async (req, res) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const recentActivity30d = {
        $or: [
            { lastLogin: { $gte: thirtyDaysAgo } },
            { 'statistics.lastRideAt': { $gte: thirtyDaysAgo } }
        ]
    };
    const recentActivity60d = {
        $or: [
            { lastLogin: { $gte: sixtyDaysAgo } },
            { 'statistics.lastRideAt': { $gte: sixtyDaysAgo } }
        ]
    };

    // User cohort analysis
    const totalUsers = await User.countDocuments();
    const activeUsers30d = await User.countDocuments(recentActivity30d);
    const activeUsers60d = await User.countDocuments(recentActivity60d);
    const newUsers30d = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });
    const churnedUsers = await User.countDocuments({
        createdAt: { $lt: ninetyDaysAgo },
        $and: [
            {
                $or: [
                    { lastLogin: { $exists: false } },
                    { lastLogin: { $lt: thirtyDaysAgo } }
                ]
            },
            {
                $or: [
                    { 'statistics.lastRideAt': { $exists: false } },
                    { 'statistics.lastRideAt': { $lt: thirtyDaysAgo } }
                ]
            }
        ]
    });

    // LTV by revenue
    const ltvData = await User.aggregate([
        { $match: { 'statistics.totalEarnings': { $gt: 0 } } },
        {
            $group: {
                _id: null,
                avgEarnings: { $avg: '$statistics.totalEarnings' },
                avgSpent: { $avg: '$statistics.totalSpent' },
                medianRides: { $avg: '$statistics.completedRides' },
                topEarners: { $sum: { $cond: [{ $gte: ['$statistics.totalEarnings', 1000] }, 1, 0] } },
                topSpenders: { $sum: { $cond: [{ $gte: ['$statistics.totalSpent', 1000] }, 1, 0] } }
            }
        }
    ]);

    // Retention cohorts (users who signed up in month X that are still active)
    const cohorts = [];
    for (let i = 0; i < 6; i++) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const signedUp = await User.countDocuments({ createdAt: { $gte: monthStart, $lte: monthEnd } });
        const stillActive = await User.countDocuments({
            createdAt: { $gte: monthStart, $lte: monthEnd },
            $or: [
                { lastLogin: { $gte: thirtyDaysAgo } },
                { 'statistics.lastRideAt': { $gte: thirtyDaysAgo } }
            ]
        });
        cohorts.push({
            month: monthStart.toISOString().slice(0, 7),
            signedUp,
            retained: stillActive,
            retentionRate: signedUp > 0 ? Math.round((stillActive / signedUp) * 100) : 0
        });
    }

    // User segments
    const segments = {
        power: await User.countDocuments({ 'statistics.completedRides': { $gte: 20 } }),
        regular: await User.countDocuments({ 'statistics.completedRides': { $gte: 5, $lt: 20 } }),
        casual: await User.countDocuments({ 'statistics.completedRides': { $gte: 1, $lt: 5 } }),
        inactive: await User.countDocuments({ 'statistics.completedRides': 0 })
    };

    res.json({
        success: true,
        analytics: {
            overview: {
                totalUsers, activeUsers30d, activeUsers60d, newUsers30d, churnedUsers,
                retentionRate30d: totalUsers > 0 ? Math.round((activeUsers30d / totalUsers) * 100) : 0,
                churnRate: totalUsers > 0 ? Math.round((churnedUsers / totalUsers) * 100) : 0
            },
            ltv: ltvData[0] || { avgEarnings: 0, avgSpent: 0, medianRides: 0 },
            cohorts,
            segments
        }
    });
});

// ============================================================
// H5: Cancellation Analytics
// ============================================================
exports.getCancellationAnalytics = asyncHandler(async (req, res) => {
    const { days = 30 } = req.query;
    const since = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);

    // Bookings cancelled
    const bookingCancellations = await Booking.aggregate([
        { $match: { status: 'CANCELLED', updatedAt: { $gte: since } } },
        {
            $group: {
                _id: '$cancellationReason',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);

    // Rides cancelled
    const rideCancellations = await Ride.aggregate([
        { $match: { status: 'CANCELLED', updatedAt: { $gte: since } } },
        {
            $group: {
                _id: 'Driver Cancelled', // Simplified since ride model might not have strict reasons
                count: { $sum: 1 }
            }
        }
    ]);

    // Daily cancellation trend
    const dailyTrend = await Booking.aggregate([
        { $match: { status: 'CANCELLED', updatedAt: { $gte: since } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    res.json({
        success: true,
        analytics: {
            reasons: bookingCancellations.map(c => ({
                reason: c._id || 'Not Specified',
                count: c.count
            })),
            rideCancellations: rideCancellations[0]?.count || 0,
            bookingCancellations: bookingCancellations.reduce((s, c) => s + c.count, 0),
            dailyTrend
        }
    });
});

// ============================================================
// H6: Bulk Notification
// ============================================================
exports.sendBulkNotification = asyncHandler(async (req, res) => {
    const { title, message, type = 'SYSTEM', targetRole, targetUserIds, targetSegment } = req.body;

    if (!title || !message) throw new AppError('Title and message are required', 400);

    let userQuery = {};
    if (targetUserIds?.length) {
        userQuery._id = { $in: targetUserIds };
    } else if (targetRole) {
        userQuery.role = targetRole;
    } else if (targetSegment) {
        switch (targetSegment) {
            case 'active':
                userQuery.$or = [
                    { lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
                    { 'statistics.lastRideAt': { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
                ];
                break;
            case 'inactive':
                userQuery.$and = [
                    {
                        $or: [
                            { lastLogin: { $exists: false } },
                            { lastLogin: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
                        ]
                    },
                    {
                        $or: [
                            { 'statistics.lastRideAt': { $exists: false } },
                            { 'statistics.lastRideAt': { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
                        ]
                    }
                ];
                break;
            case 'verified': userQuery.verificationStatus = 'VERIFIED'; break;
            case 'riders': userQuery['statistics.totalRidesPosted'] = { $gte: 1 }; break;
            case 'passengers': userQuery['statistics.totalRidesTaken'] = { $gte: 1 }; break;
        }
    }

    const users = await User.find(userQuery).select('_id').lean();

    const notifications = users.map(u => ({
        user: u._id,
        type,
        title,
        message,
        data: { bulkNotification: true, sentBy: req.user._id }
    }));

    await Notification.insertMany(notifications);

    // Emit via Socket.IO
    const io = req.app.get('io');
    if (io) {
        users.forEach(u => {
            io.to(`user-${u._id}`).emit('notification', { type, title, message });
        });
    }

    res.json({
        success: true,
        message: `Notification sent to ${users.length} users`,
        recipientCount: users.length
    });
});

// ============================================================
// H7: Promo Code System (uses standalone PromoCode collection)
// ============================================================
const PromoCode = require('../models/PromoCode');

exports.getPromoCodes = asyncHandler(async (req, res) => {
    const promoCodes = await PromoCode.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, promoCodes });
});

exports.createPromoCode = asyncHandler(async (req, res) => {
    const { code, discountType, discountValue, maxUses, minBookingAmount, expiresAt, description } = req.body;

    if (!code || !discountType || !discountValue) {
        throw new AppError('Code, discount type, and value are required', 400);
    }

    const promo = await PromoCode.create({
        code: code.toUpperCase(),
        discountType,
        discountValue,
        maxUses: maxUses || 100,
        currentUses: 0,
        minBookingAmount: minBookingAmount || 0,
        expiresAt: expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: description || '',
        isActive: true,
        createdBy: req.user._id
    });

    res.status(201).json({ success: true, message: 'Promo code created', promoCode: promo });
});

exports.updatePromoCode = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { code, discountType, discountValue, maxUses, minBookingAmount, expiresAt, description, isActive } = req.body;

    const promo = await PromoCode.findById(id);
    if (!promo) throw new AppError('Promo code not found', 404);

    if (code !== undefined) promo.code = code.toUpperCase();
    if (discountType !== undefined) promo.discountType = discountType;
    if (discountValue !== undefined) promo.discountValue = discountValue;
    if (maxUses !== undefined) promo.maxUses = maxUses;
    if (minBookingAmount !== undefined) promo.minBookingAmount = minBookingAmount;
    if (expiresAt !== undefined) promo.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (description !== undefined) promo.description = description;
    if (isActive !== undefined) promo.isActive = isActive;

    await promo.save();
    res.json({ success: true, message: 'Promo code updated', promoCode: promo });
});

exports.deletePromoCode = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const promo = await PromoCode.findByIdAndDelete(id);
    if (!promo) throw new AppError('Promo code not found', 404);
    res.json({ success: true, message: 'Promo code deleted' });
});

exports.togglePromoCode = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const promo = await PromoCode.findById(id);
    if (!promo) throw new AppError('Promo code not found', 404);
    promo.isActive = !promo.isActive;
    await promo.save();
    res.json({ success: true, message: `Promo code ${promo.isActive ? 'activated' : 'deactivated'}`, promoCode: promo });
});

// ============================================================
// H9: Data Export (reuses C15 exportData above)
// See exports.exportData above — supports users, rides, bookings, transactions
// ============================================================

// ============================================================
// Epic 2: Bipartite Graph Engine Manual Trigger
// ============================================================
exports.triggerBatchMatch = asyncHandler(async (req, res) => {
    const result = await runBatchMatching();

    // Log the manual trigger
    await AuditLog.create({
        user: req.user._id,
        action: 'batch_matching_triggered',
        entityType: 'System',
        entityId: req.user._id,
        details: { matchesMade: result.matched, processingQueue: result.pending },
        ipAddress: req.ip
    });

    res.json({
        success: true,
        message: 'Bipartite matching engine executed successfully',
        data: result
    });
});

// ============================================================
// Epic 6: Fraud Detection & Autonomous Ops
// ============================================================
exports.triggerFraudDetection = asyncHandler(async (req, res) => {
    // 1. Log the manual trigger
    await AuditLog.log(req, {
        action: 'OTHER',
        targetType: 'System',
        targetId: req.user._id,
        description: 'Triggered closed-loop anomaly detection engine',
        severity: 'MEDIUM'
    });

    const { days, threshold } = req.body;

    // 2. Call Engine
    const result = await fraudDetectionEngine.detectClosedLoopFraud(threshold || 5, days || 30);

    res.status(200).json({
        success: true,
        message: 'Fraud scan completed',
        data: result
    });
});

/**
 * @desc    Task 23: Trigger Churn Prediction
 * @route   POST /api/admin/analytics/churn-predict
 * @access  Private (Admin Role)
 */
exports.triggerChurnPrediction = asyncHandler(async (req, res) => {
    // 1. Log the manual trigger
    await AuditLog.log(req, {
        action: 'OTHER',
        targetType: 'System',
        targetId: req.user._id,
        description: 'Triggered predictive churn scanning engine',
        severity: 'MEDIUM'
    });

    const { inactivityDays, minimumRides } = req.body;

    // 2. Call Engine
    const result = await churnPredictor.predictChurnAndFlag(inactivityDays || 30, minimumRides || 10);

    res.status(200).json({
        success: true,
        message: 'Churn prediction matrix updated',
        data: result
    });
});

/**
 * Route Demand Intelligence — Unbooked Routes Insight
 * Aggregates rides with 0 bookings in the last 30 days, grouped by route.
 * Provides actionable data for marketing: where to promote, where to recruit drivers.
 */
exports.getUnbookedRoutesInsight = asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // 1. Find routes with HIGH DEMAND (many searches) but LOW SUPPLY (few rides)
    // We approximate demand by looking at the booking-to-ride ratio
    const routeAnalysis = await Ride.aggregate([
        {
            $match: {
                createdAt: { $gte: cutoffDate },
                status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED'] }
            }
        },
        {
            $lookup: {
                from: 'bookings',
                localField: '_id',
                foreignField: 'ride',
                as: 'bookings'
            }
        },
        {
            $addFields: {
                bookingCount: { $size: '$bookings' },
                confirmedBookings: {
                    $size: {
                        $filter: {
                            input: '$bookings',
                            as: 'b',
                            cond: { $in: ['$$b.status', ['CONFIRMED', 'COMPLETED', 'PICKED_UP', 'DROPPED_OFF']] }
                        }
                    }
                }
            }
        },
        {
            $group: {
                _id: {
                    startCity: { $ifNull: ['$route.start.name', '$route.start.address'] },
                    endCity: { $ifNull: ['$route.destination.name', '$route.destination.address'] }
                },
                totalRides: { $sum: 1 },
                totalBookings: { $sum: '$confirmedBookings' },
                unbookedRides: {
                    $sum: { $cond: [{ $eq: ['$bookingCount', 0] }, 1, 0] }
                },
                avgPrice: { $avg: '$pricing.pricePerSeat' },
                avgSeatsOffered: { $avg: '$pricing.totalSeats' }
            }
        },
        {
            $addFields: {
                bookingRate: {
                    $cond: [
                        { $gt: ['$totalRides', 0] },
                        { $divide: ['$totalBookings', '$totalRides'] },
                        0
                    ]
                },
                unbookedRate: {
                    $cond: [
                        { $gt: ['$totalRides', 0] },
                        { $divide: ['$unbookedRides', '$totalRides'] },
                        0
                    ]
                }
            }
        },
        { $sort: { unbookedRides: -1 } },
        { $limit: 20 }
    ]);

    // 2. Separate into categories
    const oversupplied = routeAnalysis.filter(r => r.unbookedRate > 0.5); // >50% rides get 0 bookings
    const healthy = routeAnalysis.filter(r => r.unbookedRate <= 0.5 && r.bookingRate > 0.3);
    const needsPromotion = routeAnalysis.filter(r => r.unbookedRate > 0.3 && r.unbookedRate <= 0.5);

    // 3. Find high-demand routes (routes with high booking rates — need more drivers)
    // Look at COMPLETED rides and check how full they were (booking count vs seats)
    const highDemandRoutes = await Ride.aggregate([
        {
            $match: {
                createdAt: { $gte: cutoffDate },
                status: { $in: ['COMPLETED', 'IN_PROGRESS'] }
            }
        },
        {
            $lookup: {
                from: 'bookings',
                localField: '_id',
                foreignField: 'ride',
                as: 'bookings'
            }
        },
        {
            $addFields: {
                confirmedCount: {
                    $size: {
                        $filter: {
                            input: '$bookings',
                            as: 'b',
                            cond: { $in: ['$$b.status', ['CONFIRMED', 'COMPLETED', 'PICKED_UP', 'DROPPED_OFF']] }
                        }
                    }
                },
                totalSeats: { $ifNull: ['$pricing.totalSeats', 4] }
            }
        },
        {
            $group: {
                _id: {
                    startCity: { $ifNull: ['$route.start.name', '$route.start.address'] },
                    endCity: { $ifNull: ['$route.destination.name', '$route.destination.address'] }
                },
                totalRides: { $sum: 1 },
                totalBookings: { $sum: '$confirmedCount' },
                totalSeatsOffered: { $sum: '$totalSeats' }
            }
        },
        {
            $addFields: {
                fillRate: {
                    $cond: [
                        { $gt: ['$totalSeatsOffered', 0] },
                        { $divide: ['$totalBookings', '$totalSeatsOffered'] },
                        0
                    ]
                }
            }
        },
        { $match: { fillRate: { $gte: 0.5 }, totalRides: { $gte: 2 } } },
        { $sort: { fillRate: -1 } },
        { $limit: 10 }
    ]);

    res.status(200).json({
        success: true,
        data: {
            period: `Last ${days} days`,
            oversupplied: oversupplied.map(r => ({
                route: `${r._id.startCity} → ${r._id.endCity}`,
                totalRides: r.totalRides,
                unbookedRides: r.unbookedRides,
                unbookedRate: Math.round(r.unbookedRate * 100),
                avgPrice: Math.round(r.avgPrice || 0),
                suggestion: 'Oversupplied — reduce rides or promote to passengers'
            })),
            needsPromotion: needsPromotion.map(r => ({
                route: `${r._id.startCity} → ${r._id.endCity}`,
                totalRides: r.totalRides,
                unbookedRides: r.unbookedRides,
                unbookedRate: Math.round(r.unbookedRate * 100),
                suggestion: 'Needs promotion — run ads targeting passengers on this route'
            })),
            highDemand: highDemandRoutes.map(r => ({
                route: `${r._id.startCity} → ${r._id.endCity}`,
                totalRides: r.totalRides,
                totalBookings: r.totalBookings,
                fillRate: Math.round(r.fillRate * 100),
                suggestion: 'High demand — recruit more drivers for this route'
            })),
            healthy: healthy.length
        }
    });
});

/**
 * 4B: Conversion Funnel Analytics
 * Retrieves SearchLog funnel progression statistics
 * Groups by funnelStatus to create a waterfall chart of user conversion.
 */
exports.getConversionFunnel = asyncHandler(async (req, res) => {
    const days = parseInt(req.query.days) || 30;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const SearchLog = require('../models/SearchLog');

    const funnelStats = await SearchLog.aggregate([
        {
            $match: {
                createdAt: { $gte: cutoffDate }
            }
        },
        {
            $group: {
                _id: '$funnelStatus',
                count: { $sum: 1 },
                uniqueUsers: { $addToSet: '$user' }
            }
        },
        {
            $project: {
                status: '$_id',
                count: 1,
                uniqueUsersCount: { $size: '$uniqueUsers' },
                _id: 0
            }
        }
    ]);

    // Format into a structured funnel object ensuring all stages exist
    const defaultFunnel = {
        'SEARCHED': 0,
        'VIEWED_RIDE': 0,
        'BOOKING_INITIATED': 0,
        'PAID': 0,
        'COMPLETED': 0,
        'CANCELLED': 0
    };

    funnelStats.forEach(stat => {
        defaultFunnel[stat.status] = stat.count;
    });

    res.status(200).json({
        success: true,
        data: {
            period: `Last ${days} days`,
            funnel: [
                { stage: '1. Searched', count: defaultFunnel['SEARCHED'] || 0 },
                { stage: '2. Viewed Ride', count: defaultFunnel['VIEWED_RIDE'] || 0 },
                { stage: '3. Initiated Booking', count: defaultFunnel['BOOKING_INITIATED'] || 0 },
                { stage: '4. Paid', count: defaultFunnel['PAID'] || 0 },
                { stage: '5. Completed Ride', count: defaultFunnel['COMPLETED'] || 0 }
            ],
            cancellations: defaultFunnel['CANCELLED'] || 0
        }
    });
});

/**
 * Sustainability Dashboard — Dedicated endpoint
 * Aggregates all environmental/carbon metrics from real DB data
 */
exports.getSustainabilityData = asyncHandler(async (req, res) => {
    const os = require('os');

    // Fetch settings for environmental constants
    const settings = await Settings.findOne().lean();
    const co2PerKm = settings?.environmental?.co2PerKm ?? 0.12;
    const co2PerTree = settings?.environmental?.co2PerTree ?? 22;

    // ─── Core Counts ────────────────────────────────────────
    const [
        totalRides, completedRides, totalBookings, completedBookings, totalUsers
    ] = await Promise.all([
        Ride.countDocuments(),
        Ride.countDocuments({ status: 'COMPLETED' }),
        Booking.countDocuments(),
        Booking.countDocuments({ status: { $in: ['COMPLETED', 'DROPPED_OFF'] } }),
        User.countDocuments(),
    ]);

    // ─── Ride Aggregations ──────────────────────────────────
    const [rideAgg, bookingAgg] = await Promise.all([
        Ride.aggregate([
            { $match: { status: 'COMPLETED' } },
            {
                $group: {
                    _id: null,
                    totalDistance: { $sum: '$route.distance' },
                    avgDistance: { $avg: '$route.distance' },
                    avgOccupancy: {
                        $avg: {
                            $subtract: [
                                { $ifNull: ['$pricing.totalSeats', 4] },
                                { $ifNull: ['$pricing.availableSeats', 3] }
                            ]
                        }
                    }
                }
            }
        ]),
        Booking.aggregate([
            { $match: { status: { $in: ['COMPLETED', 'DROPPED_OFF'] } } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$totalPrice' },
                    avgSeats: { $avg: '$seatsBooked' },
                    totalSeats: { $sum: '$seatsBooked' }
                }
            }
        ])
    ]);

    const totalDistance = rideAgg[0]?.totalDistance || 0;
    const avgDistance = rideAgg[0]?.avgDistance || 14;
    const avgOccupancy = rideAgg[0]?.avgOccupancy || 1.5;
    const avgSeatsPerBooking = bookingAgg[0]?.avgSeats || 1.5;
    const totalRevenue = bookingAgg[0]?.totalRevenue || 0;
    const totalPassengerTrips = bookingAgg[0]?.totalSeats || completedBookings;

    // Average passengers per ride (driver + passengers)
    const avgPassengers = completedRides > 0
        ? 1 + (totalPassengerTrips / completedRides)
        : 2.1;

    // ─── Carbon Calculations ────────────────────────────────
    // Solo drive CO₂ = co2PerKm * distance
    // Carpooled CO₂ per person = co2PerKm * distance / avgPassengers
    // Savings per ride = co2PerKm * avgDistance * (1 - 1/avgPassengers)
    const co2SavedPerRide = co2PerKm * avgDistance * (1 - 1 / avgPassengers);
    const totalCO2Saved = completedRides * co2SavedPerRide;
    const treesEquivalent = co2PerTree > 0 ? Math.round(totalCO2Saved / co2PerTree) : 0;
    const fuelSavedLiters = Math.round(totalDistance * (1 - 1 / avgPassengers) / 12); // 12 km/L avg
    const carsOffRoad = Math.round(totalCO2Saved / 4600); // 4600 kg CO₂/car/year
    const soloKmAvoided = Math.round(totalDistance * (1 - 1 / avgPassengers));

    // ─── Monthly Trend ──────────────────────────────────────
    const monthlyRides = await Ride.aggregate([
        { $match: { status: 'COMPLETED' } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                rides: { $sum: 1 },
                distance: { $sum: '$route.distance' },
                avgDist: { $avg: '$route.distance' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    const monthlyBookings = await Booking.aggregate([
        { $match: { status: { $in: ['COMPLETED', 'DROPPED_OFF'] } } },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                bookings: { $sum: 1 },
                revenue: { $sum: '$totalPrice' },
                passengers: { $sum: '$seatsBooked' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Merge monthly data
    const monthMap = {};
    monthlyRides.forEach(m => {
        monthMap[m._id] = {
            month: m._id,
            label: new Date(m._id + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
            rides: m.rides,
            distance: Math.round(m.distance || 0),
            avgDist: Math.round((m.avgDist || 0) * 10) / 10,
        };
    });
    monthlyBookings.forEach(m => {
        if (!monthMap[m._id]) monthMap[m._id] = { month: m._id, label: new Date(m._id + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), rides: 0, distance: 0 };
        monthMap[m._id].bookings = m.bookings;
        monthMap[m._id].revenue = m.revenue;
        monthMap[m._id].passengers = m.passengers;
    });

    // Add CO₂ to each month
    const monthly = Object.values(monthMap).sort((a, b) => a.month.localeCompare(b.month));
    monthly.forEach(m => {
        const monthAvgPass = m.rides > 0 && m.passengers > 0 ? 1 + (m.passengers / m.rides) : avgPassengers;
        m.co2Saved = Math.round(m.rides * co2PerKm * (m.avgDist || avgDistance) * (1 - 1 / monthAvgPass));
        m.fuelSaved = Math.round((m.distance || 0) * (1 - 1 / monthAvgPass) / 12);
    });

    // ─── Top Green Routes ───────────────────────────────────
    const topRoutes = await Ride.aggregate([
        { $match: { status: 'COMPLETED' } },
        {
            $group: {
                _id: { from: '$route.start.name', to: '$route.destination.name' },
                rides: { $sum: 1 },
                totalDist: { $sum: '$route.distance' },
                avgDist: { $avg: '$route.distance' }
            }
        },
        { $sort: { rides: -1 } },
        { $limit: 8 }
    ]);

    const greenRoutes = topRoutes.map(r => ({
        from: r._id?.from || 'Unknown',
        to: r._id?.to || 'Unknown',
        rides: r.rides,
        distance: Math.round((r.avgDist || 0) * 10) / 10,
        co2Saved: Math.round(r.rides * co2PerKm * (r.avgDist || avgDistance) * (1 - 1 / avgPassengers) * 10) / 10,
    }));

    // ─── Top Green Users (most completed bookings) ──────────
    const topUsers = await Booking.aggregate([
        { $match: { status: { $in: ['COMPLETED', 'DROPPED_OFF'] } } },
        { $group: { _id: '$passenger', trips: { $sum: 1 }, totalSeats: { $sum: '$seatsBooked' } } },
        { $sort: { trips: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } }
    ]);

    const greenLeaders = topUsers.map(u => ({
        name: [u.user?.profile?.firstName, u.user?.profile?.lastName].filter(Boolean).join(' ') || u.user?.email || 'Unknown',
        trips: u.trips,
        co2Saved: Math.round(u.trips * co2SavedPerRide * 10) / 10,
    }));

    // ─── Green Score (0-100) ────────────────────────────────
    // Based on: avg occupancy ratio, completion rate, CO₂ per km factor
    const completionRate = totalRides > 0 ? completedRides / totalRides : 0;
    const occupancyRatio = avgPassengers / 4; // out of typical 4-seater
    const greenScore = Math.min(100, Math.round(
        (completionRate * 40) + (occupancyRatio * 40) + (Math.min(1, totalCO2Saved / 1000) * 20)
    ));

    res.json({
        success: true,
        data: {
            // Summary stats
            summary: {
                totalCO2Saved: Math.round(totalCO2Saved * 10) / 10,
                treesEquivalent,
                fuelSavedLiters,
                carsOffRoad,
                soloKmAvoided,
                greenScore,
                totalDistance: Math.round(totalDistance * 10) / 10,
            },
            // Core ride/booking stats
            rides: {
                total: totalRides,
                completed: completedRides,
                completionRate: Math.round(completionRate * 1000) / 10,
                avgDistance: Math.round(avgDistance * 10) / 10,
                avgPassengers: Math.round(avgPassengers * 10) / 10,
                totalPassengerTrips,
            },
            bookings: {
                total: totalBookings,
                completed: completedBookings,
                totalRevenue,
                avgSeatsPerBooking: Math.round(avgSeatsPerBooking * 10) / 10,
            },
            // Config
            config: {
                co2PerKm,
                co2PerTree,
                co2SavedPerRide: Math.round(co2SavedPerRide * 1000) / 1000,
            },
            // Time-series
            monthly,
            // Green routes & leaders
            greenRoutes,
            greenLeaders,
            // Platform
            totalUsers,
        }
    });
});

/**
 * Get Settings Audit Trail + Impact Stats
 * Returns recent audit logs for settings changes plus real-time stats.
 */
exports.getSettingsAudit = asyncHandler(async (req, res) => {
    // Recent settings audit logs
    const auditLogs = await AuditLog.find({ action: 'SETTINGS_UPDATED' })
        .sort({ createdAt: -1 })
        .limit(25)
        .populate('user', 'name email profile.firstName profile.lastName')
        .lean();

    // Real-time impact stats
    const [
        totalRides,
        activeRides,
        totalBookings,
        cancelledBookings,
        totalUsers,
        flaggedUsers,
        totalChats,
        totalReviews,
        totalSOSAlerts,
        totalDeviations,
    ] = await Promise.all([
        Ride.countDocuments(),
        Ride.countDocuments({ status: 'ACTIVE' }),
        Booking.countDocuments(),
        Booking.countDocuments({ status: 'CANCELLED' }),
        User.countDocuments(),
        User.countDocuments({ $or: [{ status: 'SUSPENDED' }, { status: 'FLAGGED' }] }),
        require('../models/Chat').countDocuments(),
        Review.countDocuments(),
        require('../models/Emergency').countDocuments(),
        require('../models/RouteDeviation').countDocuments(),
    ]);

    // Cancellation stats (with fees)
    const cancelStats = await Booking.aggregate([
        { $match: { status: 'CANCELLED', 'cancellation.feeCharged': { $gt: 0 } } },
        { $group: { _id: null, count: { $sum: 1 }, totalFees: { $sum: '$cancellation.feeCharged' } } }
    ]);

    res.json({
        success: true,
        data: {
            auditLogs: auditLogs.map(log => ({
                _id: log._id,
                user: log.user ? (log.user.profile?.firstName ? `${log.user.profile.firstName} ${log.user.profile.lastName || ''}`.trim() : log.user.name || log.user.email) : 'System',
                action: log.action,
                description: log.description,
                sections: log.metadata?.sections || [],
                severity: log.severity,
                createdAt: log.createdAt,
            })),
            stats: {
                rides: { total: totalRides, active: activeRides },
                bookings: { total: totalBookings, cancelled: cancelledBookings },
                users: { total: totalUsers, flagged: flaggedUsers },
                chats: totalChats,
                reviews: totalReviews,
                sosAlerts: totalSOSAlerts,
                routeDeviations: totalDeviations,
                cancellationFees: {
                    count: cancelStats[0]?.count || 0,
                    totalFees: cancelStats[0]?.totalFees || 0,
                },
            },
        },
    });
});
