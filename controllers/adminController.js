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
const RouteDeviation = require('../models/RouteDeviation');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const helpers = require('../utils/helpers');
const { sendEmail } = require('../config/email');

/**
 * Show admin dashboard
 */
exports.showDashboard = asyncHandler(async (req, res) => {
    // Get statistics
    const totalUsers = await User.countDocuments();
    const totalRiders = await User.countDocuments({ role: 'RIDER' });
    const totalPassengers = await User.countDocuments({ role: 'PASSENGER' });
    const pendingVerifications = await User.countDocuments({ 
        role: 'RIDER', 
        verificationStatus: { $in: ['PENDING', 'UNDER_REVIEW'] }
    });

    const totalRides = await Ride.countDocuments();
    const activeRides = await Ride.countDocuments({ status: 'ACTIVE' });
    const completedRides = await Ride.countDocuments({ status: 'COMPLETED' });

    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'PENDING' });
    const confirmedBookings = await Booking.countDocuments({ status: 'CONFIRMED' });

    // Get recent users
    const recentUsers = await User.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .select('profile email role createdAt accountStatus');

    // Get recent rides
    const recentRides = await Ride.find()
        .populate('rider', 'profile email')
        .sort({ createdAt: -1 })
        .limit(10);

    // Get revenue statistics - Enhanced to count more booking statuses
    const totalRevenue = await Booking.aggregate([
        { 
            $match: { 
                // Include more statuses to capture completed/paid rides
                status: { $in: ['COMPLETED', 'DROPPED_OFF'] },
                // Make payment status optional since some bookings might not have it set properly
                $or: [
                    { 'payment.status': { $in: ['PAID', 'PAYMENT_CONFIRMED'] } },
                    { totalPrice: { $gt: 0 } } // Fallback: any booking with a price
                ]
            } 
        },
        { 
            $group: { 
                _id: null, 
                total: { $sum: '$totalPrice' }, // Use totalPrice for total revenue
                count: { $sum: 1 }
            } 
        }
    ]);

    console.log('📊 [Admin Dashboard] Revenue calculation:', totalRevenue);

    // Calculate platform commission (₹50 per completed booking)
    const completedBookingsCount = totalRevenue[0]?.count || 0;
    const platformRevenue = completedBookingsCount * 50; // ₹50 commission per booking

    // Get unresolved route deviations count for geo-fencing badge
    const unresolvedDeviations = await RouteDeviation.countDocuments({ 
        status: { $in: ['ACTIVE', 'ESCALATED'] } 
    });

    res.render('admin/dashboard', {
        title: 'Admin Dashboard',
        stats: {
            users: {
                total: totalUsers,
                riders: totalRiders,
                passengers: totalPassengers,
                pendingVerifications
            },
            rides: {
                total: totalRides,
                active: activeRides,
                completed: completedRides
            },
            bookings: {
                total: totalBookings,
                pending: pendingBookings,
                confirmed: confirmedBookings
            },
            revenue: totalRevenue[0]?.total || 0,
            platformRevenue: platformRevenue,
            revenueBookings: completedBookingsCount
        },
        unresolvedDeviations,
        recentUsers,
        recentRides,
        user: req.user
    });
});

/**
 * Show all users with filters
 */
exports.showUsers = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build filter query
    const filter = {};
    
    if (req.query.role && req.query.role !== 'all') {
        filter.role = req.query.role;
    }
    
    if (req.query.status && req.query.status !== 'all') {
        filter.accountStatus = req.query.status;
    }
    
    if (req.query.search) {
        const searchRegex = new RegExp(req.query.search, 'i');
        filter.$or = [
            { email: searchRegex },
            { phone: searchRegex },
            { 'profile.firstName': searchRegex },
            { 'profile.lastName': searchRegex }
        ];
    }

    // Get users with pagination
    const users = await User.find(filter)
        .sort('-createdAt')
        .skip(skip)
        .limit(limit);

    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);

    res.render('admin/users', {
        title: 'Users Management',
        users,
        user: req.user,
        pagination: {
            page,
            pages: totalPages,
            total: totalUsers
        },
        filters: {
            role: req.query.role || 'all',
            status: req.query.status || 'all',
            search: req.query.search || ''
        }
    });
});

/**
 * Get User Details (API)
 */
exports.getUserDetails = asyncHandler(async (req, res) => {
    const userDetails = await User.findById(req.params.id);
    if (!userDetails) {
        return res.json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: userDetails });
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
        title: '🚫 Account Suspended',
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
                    priority: 'MEDIUM'
                });
            }
        }
    }
    
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
        title: '✅ Account Reactivated',
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

    res.json({ success: true, message: 'User deleted successfully' });
});

/**
 * Show verification requests
 */
exports.showVerificationRequests = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Only show RIDERS who need verification (not PASSENGERS)
    const query = { 
        role: 'RIDER',
        verificationStatus: { 
            $in: ['PENDING', 'UNDER_REVIEW'] 
        } 
    };

    const totalRequests = await User.countDocuments(query);
    const requests = await User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const pagination = helpers.paginate(totalRequests, page, limit);

    res.render('admin/verifications', {
        title: 'Verification Requests - Admin',
        user: req.user,
        requests,
        pagination
    });
});

/**
 * Show verification details
 */
exports.showVerificationDetails = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const userToVerify = await User.findById(userId);

    if (!userToVerify) {
        throw new AppError('User not found', 404);
    }

    // Only show verification details for RIDERS
    if (userToVerify.role !== 'RIDER') {
        req.flash('error', 'Verification is only applicable to riders');
        return res.redirect('/admin/verifications');
    }

    res.render('admin/verification-details', {
        title: `Verify ${userToVerify.name} - Admin`,
        user: req.user,
        userToVerify
    });
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

    // Clear documents
    userToVerify.documents = {
        drivingLicense: null,
        aadharCard: null,
        vehicleRC: null,
        vehicleInsurance: null
    };

    await userToVerify.save();

    // Send notification
    await Notification.create({
        user: userToVerify._id,
        type: 'VERIFICATION_REJECTED',
        title: 'Verification Rejected',
        message: reason || 'Your documents could not be verified. Please re-upload correct documents.',
        priority: 'HIGH'
    });

    res.status(200).json({
        success: true,
        message: 'Verification rejected'
    });
});

/**
 * Show reports
 */
exports.showReports = asyncHandler(async (req, res) => {
    const { status, severity, category } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    if (status) {
        const s = status.toUpperCase();
        query.status = s === 'IN_REVIEW' ? 'UNDER_REVIEW' : s;
    }
    if (severity) query.severity = severity.toUpperCase();
    if (category) query.category = category.toUpperCase();

    // Get stats for dashboard
    const stats = {
        pending: await Report.countDocuments({ status: 'PENDING' }),
        underReview: await Report.countDocuments({ status: 'UNDER_REVIEW' }),
        highSeverity: await Report.countDocuments({ severity: 'HIGH' }),
        resolved: await Report.countDocuments({ status: 'RESOLVED' })
    };

    const totalReports = await Report.countDocuments(query);
    const reports = await Report.find(query)
        .populate('reporter', 'profile email profilePhoto role')
        .populate('reportedUser', 'profile email profilePhoto role')
        .populate({
            path: 'booking',
            populate: {
                path: 'ride',
                populate: { path: 'rider', select: 'profile' }
            }
        })
        .populate('ride')
        .sort({ createdAt: -1, severity: -1 })
        .skip(skip)
        .limit(limit);

    // Compute names for users
    reports.forEach(report => {
        if (report.reporter && !report.reporter.name && report.reporter.profile) {
            report.reporter.name = `${report.reporter.profile.firstName} ${report.reporter.profile.lastName}`.trim();
        }
        if (report.reportedUser && !report.reportedUser.name && report.reportedUser.profile) {
            report.reportedUser.name = `${report.reportedUser.profile.firstName} ${report.reportedUser.profile.lastName}`.trim();
        }
    });

    const pagination = {
        currentPage: page,
        totalPages: Math.ceil(totalReports / limit),
        totalReports,
        limit,
        hasPrevPage: page > 1,
        hasNextPage: page < Math.ceil(totalReports / limit)
    };

    res.render('admin/reports', {
        title: 'Reports Management',
        user: req.user,
        reports,
        stats,
        pagination,
        currentStatus: status ? status.toUpperCase() : 'ALL'
    });
});

/**
 * Show report details
 */
exports.showReportDetails = asyncHandler(async (req, res) => {
    const { reportId } = req.params;

    const report = await Report.findById(reportId)
        .populate('reporter', 'profile email phoneNumber profilePhoto role')
        .populate('reportedUser', 'profile email phoneNumber profilePhoto role')
        .populate({
            path: 'booking',
            populate: {
                path: 'ride passenger',
                populate: { path: 'rider', select: 'profile profilePhoto' }
            }
        })
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile profilePhoto' }
        })
        .populate('adminReview.reviewedBy', 'profile');

    if (!report) {
        throw new AppError('Report not found', 404);
    }

    // Compute names for users if needed
    if (report.reporter && !report.reporter.name && report.reporter.profile) {
        report.reporter.name = `${report.reporter.profile.firstName} ${report.reporter.profile.lastName}`.trim();
    }
    if (report.reportedUser && !report.reportedUser.name && report.reportedUser.profile) {
        report.reportedUser.name = `${report.reportedUser.profile.firstName} ${report.reportedUser.profile.lastName}`.trim();
    }

    res.render('admin/report-detail', {
        title: `Report Details - Admin`,
        user: req.user,
        report
    });
});

/**
 * Review and take action on report
 */
exports.reviewReport = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { status, actionType, notes, suspensionDuration } = req.body;

    const report = await Report.findById(reportId).populate('reportedUser reporter');

    if (!report) {
        return res.json({ success: false, message: 'Report not found' });
    }

    // Update report status
    report.status = status;
    
    // Map actionType to model's enum for adminReview.action
    const actionMap = {
        'NO_ACTION': 'NO_ACTION',
        'WARNING': 'WARNING_ISSUED',
        'SUSPENSION': 'TEMPORARY_SUSPENSION',
        'BAN': 'PERMANENT_BAN',
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

    // Handle different action types
    switch (actionType) {
        case 'WARNING':
            // Issue warning notification
            await Notification.create({
                user: report.reportedUser._id,
                type: 'SYSTEM_ALERT',
                title: 'Warning from Admin',
                message: `You have received a warning. Reason: ${notes}`,
                priority: 'HIGH'
            });
            break;

        case 'SUSPENSION':
            // Suspend user account
            const suspensionEnd = new Date();
            suspensionEnd.setDate(suspensionEnd.getDate() + (suspensionDuration || 7));
            
            await User.findByIdAndUpdate(report.reportedUser._id, {
                accountStatus: 'SUSPENDED',
                suspensionEnd: suspensionEnd,
                $push: {
                    accountStatusHistory: {
                        status: 'SUSPENDED',
                        reason: notes,
                        changedBy: req.user._id,
                        changedAt: new Date(),
                        suspensionEnd: suspensionEnd
                    }
                }
            });

            await Notification.create({
                user: report.reportedUser._id,
                type: 'ACCOUNT_SUSPENDED',
                title: 'Account Suspended',
                message: `Your account has been suspended for ${suspensionDuration} days. Reason: ${notes}`,
                priority: 'HIGH'
            });
            break;

        case 'BAN':
            // Permanently ban user
            await User.findByIdAndUpdate(report.reportedUser._id, {
                accountStatus: 'DELETED',
                deletedAt: new Date(),
                deletedBy: req.user._id,
                deletionReason: notes
            });

            await Notification.create({
                user: report.reportedUser._id,
                type: 'SYSTEM_ALERT',
                title: 'Account Banned',
                message: `Your account has been permanently banned. Reason: ${notes}`,
                priority: 'HIGH'
            });
            break;

        case 'REFUND':
            // Process refund if booking exists
            if (report.booking) {
                const booking = await Booking.findById(report.booking);
                if (booking && booking.payment.status === 'COMPLETED') {
                    booking.payment.status = 'REFUNDED';
                    booking.payment.refundedAt = new Date();
                    booking.payment.refundReason = notes;
                    await booking.save();

                    await Notification.create({
                        user: booking.passenger,
                        type: 'PAYMENT_REFUNDED',
                        title: 'Refund Processed',
                        message: `₹${booking.pricing.totalAmount} has been refunded to your account.`,
                        priority: 'MEDIUM'
                    });
                }
            }
            break;

        case 'NO_ACTION':
            // No action required, just update status
            break;
    }

    // Notify reporter about resolution
    await Notification.create({
        user: report.reporter._id,
        type: 'REPORT_RESOLVED',
        title: 'Your Report Has Been Reviewed',
        message: `The report you filed has been reviewed and appropriate action has been taken.`,
        priority: 'MEDIUM'
    });

    await report.save();

    res.json({ 
        success: true, 
        message: 'Report reviewed successfully',
        report 
    });
});

/**
 * Show all users
 */
exports.showUsers = asyncHandler(async (req, res) => {
    const { role = 'all', status = 'active' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const query = {};
    if (role !== 'all') query.role = role.toUpperCase();
    if (status === 'active') query.isActive = true;
    if (status === 'suspended') query.isActive = false;

    const totalUsers = await User.countDocuments(query);
    const users = await User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const pagination = helpers.paginate(totalUsers, page, limit);

    res.render('admin/users', {
        title: 'Manage Users - Admin',
        user: req.user,
        users,
        currentRole: role,
        currentStatus: status,
        pagination
    });
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
 * Show system statistics
 */
exports.showStatistics = asyncHandler(async (req, res) => {
    const { range = 'month' } = req.query;

    console.log('📊 [Statistics] Loading statistics page with range:', range);

    // Calculate date range
    let startDate = new Date();
    if (range === 'week') {
        startDate.setDate(startDate.getDate() - 7);
    } else if (range === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
    } else {
        startDate.setFullYear(startDate.getFullYear() - 1);
    }

    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    // ===== USER STATISTICS =====
    const totalUsers = await User.countDocuments();
    const newUsersThisMonth = await User.countDocuments({
        createdAt: { $gte: firstDayOfMonth }
    });
    console.log(`👥 Users - Total: ${totalUsers}, New this month: ${newUsersThisMonth}`);

    // ===== RIDE STATISTICS =====
    const totalRides = await Ride.countDocuments();
    const completedRides = await Ride.countDocuments({ status: 'COMPLETED' });
    const inProgressRides = await Ride.countDocuments({ status: 'IN_PROGRESS' });
    const cancelledRides = await Ride.countDocuments({ status: 'CANCELLED' });
    const completionRate = totalRides > 0 ? Math.round((completedRides / totalRides) * 100) : 0;
    console.log(`🚗 Rides - Total: ${totalRides}, Completed: ${completedRides}, Completion Rate: ${completionRate}%`);

    // ===== REVENUE STATISTICS (FIXED) =====
    // Use totalPrice field with flexible status matching
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
                totalRevenue: { $sum: '$totalPrice' },
                platformFees: { $sum: '$payment.platformCommission' },
                count: { $sum: 1 }
            }
        }
    ]);

    const revenueThisMonth = await Booking.aggregate([
        {
            $match: {
                status: { $in: ['COMPLETED', 'DROPPED_OFF'] },
                totalPrice: { $gt: 0 },
                createdAt: { $gte: firstDayOfMonth }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$totalPrice' },
                count: { $sum: 1 }
            }
        }
    ]);

    const totalRevenue = revenueData[0]?.totalRevenue || 0;
    const revenueThisMonthValue = revenueThisMonth[0]?.total || 0;
    const platformFees = revenueData[0]?.platformFees || 0;
    console.log(`💰 Revenue - Total: ₹${totalRevenue}, This Month: ₹${revenueThisMonthValue}, Platform Fees: ₹${platformFees}`);

    // ===== ENVIRONMENTAL IMPACT (FIXED) =====
    // Use route.distance field (already in km)
    const totalDistance = await Ride.aggregate([
        { $match: { status: 'COMPLETED', 'route.distance': { $exists: true } } },
        { $group: { _id: null, total: { $sum: '$route.distance' } } }
    ]);
    const totalDistanceKm = totalDistance[0]?.total || 0;
    // CO2 saved: Assume 120g CO2 per km saved by carpooling
    const co2Saved = Math.round(totalDistanceKm * 0.12); // in kg
    const treesEquivalent = Math.round(co2Saved / 21); // 1 tree absorbs 21kg CO2/year
    console.log(`🌍 Environmental - Distance: ${totalDistanceKm.toFixed(1)} km, CO2 Saved: ${co2Saved} kg, Trees: ${treesEquivalent}`);

    // ===== USER GROWTH CHART DATA =====
    const userGrowthData = await User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
            $group: {
                _id: { $dateToString: { format: range === 'week' ? '%Y-%m-%d' : '%Y-%m', date: '$createdAt' } },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
    console.log(`📈 User Growth Data (${range}):`, userGrowthData);

    // ===== REVENUE CHART DATA (FIXED) =====
    const revenueChartData = await Booking.aggregate([
        {
            $match: {
                status: { $in: ['COMPLETED', 'DROPPED_OFF'] },
                totalPrice: { $gt: 0 },
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                revenue: { $sum: '$totalPrice' }
            }
        },
        { $sort: { _id: 1 } }
    ]);
    console.log(`💵 Revenue Chart Data:`, revenueChartData);

    // ===== RIDES OVERVIEW CHART =====
    const ridesOverviewData = await Ride.aggregate([
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
    console.log(`🚙 Rides Overview Data:`, ridesOverviewData);

    // ===== POPULAR ROUTES (FIXED) =====
    const popularRoutes = await Ride.aggregate([
        { $match: { status: { $in: ['COMPLETED', 'IN_PROGRESS'] } } },
        {
            $group: {
                _id: {
                    origin: { $ifNull: ['$route.start.name', '$route.start.address'] },
                    destination: { $ifNull: ['$route.destination.name', '$route.destination.address'] }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);
    console.log(`🗺️ Popular Routes:`, popularRoutes);

    // ===== SAFETY METRICS =====
    // Check all users with ratings
    const averageRating = await User.aggregate([
        { $match: { 'rating.overall': { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$rating.overall' } } }
    ]);

    // Verified drivers/riders
    const verifiedUsersCount = await User.countDocuments({ verificationStatus: 'VERIFIED' });
    const totalUsersForVerification = await User.countDocuments();
    const verifiedPercentage = totalUsersForVerification > 0 ? Math.round((verifiedUsersCount / totalUsersForVerification) * 100) : 0;

    const sosAlerts = 0; // SOS removed
    const reportsCount = await Report.countDocuments();
    
    const avgRatingValue = averageRating[0]?.avg ? averageRating[0].avg.toFixed(1) : '5';
    console.log(`🛡️ Safety - Avg Rating: ${avgRatingValue}, Verified: ${verifiedPercentage}%, SOS: ${sosAlerts}, Reports: ${reportsCount}`);

    // Helper to format chart data
    const formatUserGrowth = (data) => {
        const labels = data.map(d => d._id);
        const counts = data.map(d => d.count);
        console.log('📊 [Format] User Growth - Labels:', labels, 'Data:', counts);
        return { labels, data: counts };
    };

    const formatRevenue = (data) => {
        const labels = data.map(d => d._id);
        const revenues = data.map(d => d.revenue);
        console.log('📊 [Format] Revenue - Labels:', labels, 'Data:', revenues);
        return { labels, data: revenues };
    };

    const formatRides = (data) => {
        const labels = data.map(d => d._id);
        const counts = data.map(d => d.count);
        console.log('📊 [Format] Rides - Labels:', labels, 'Data:', counts);
        return { labels, data: counts };
    };

    const formatRoutes = (data) => {
        const labels = data.map(d => `${d._id.origin.split(',')[0]} -> ${d._id.destination.split(',')[0]}`);
        const counts = data.map(d => d.count);
        console.log('📊 [Format] Routes - Labels:', labels, 'Data:', counts);
        return { labels, data: counts };
    };


    res.render('admin/statistics', {
        title: 'Platform Statistics',
        user: req.user,
        currentRange: range,
        stats: {
            users: {
                total: totalUsers,
                newThisMonth: newUsersThisMonth
            },
            rides: {
                total: totalRides,
                completed: completedRides,
                active: inProgressRides,
                cancelled: cancelledRides,
                completionRate
            },
            revenue: {
                total: totalRevenue,
                thisMonth: revenueThisMonthValue,
                platformFees
            },
            environmental: {
                co2Saved,
                treesEquivalent,
                totalDistance: totalDistanceKm
            },
            safety: {
                averageRating: avgRatingValue,
                verifiedDrivers: verifiedPercentage,
                sosAlerts: sosAlerts,
                reports: reportsCount
            },
            charts: {
                userGrowth: formatUserGrowth(userGrowthData),
                revenue: formatRevenue(revenueChartData),
                ridesOverview: formatRides(ridesOverviewData),
                popularRoutes: formatRoutes(popularRoutes)
            }
        }
    });
});

/**
 * Show all rides
 */
exports.showRides = asyncHandler(async (req, res) => {
    const { status = 'all', search = '', date = '' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const query = {};
    
    if (status !== 'all') {
        query.status = status.toUpperCase();
    }
    
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
            { 'origin.address': searchRegex },
            { 'destination.address': searchRegex }
        ];
    }
    
    if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        query.departureTime = { $gte: startOfDay, $lte: endOfDay };
    }

    const totalRides = await Ride.countDocuments(query);
    const rides = await Ride.find(query)
        .populate('rider', 'profile email phone')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit);

    const pagination = helpers.paginate(totalRides, page, limit);

    res.render('admin/rides', {
        title: 'Rides Management',
        user: req.user,
        rides,
        pagination
    });
});

/**
 * Show ride details
 */
exports.showRideDetails = asyncHandler(async (req, res) => {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId)
        .populate('rider', 'profile email phone name')
        .populate({
            path: 'bookings',
            populate: {
                path: 'passenger',
                select: 'profile email phone name'
            }
        });

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    res.render('admin/ride-details', {
        title: `Ride Details - Admin`,
        user: req.user,
        ride
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
            message: `Ride from ${ride.origin.address} to ${ride.destination.address} has been cancelled. Reason: ${reason}`,
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

    res.json({ success: true, message: 'Ride cancelled successfully' });
});

/**
 * Show all bookings
 */
exports.showBookings = asyncHandler(async (req, res) => {
    const { status = 'all' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const query = status !== 'all' ? { status: status.toUpperCase() } : {};

    const totalBookings = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
        .populate('passenger', 'profile email phone')
        .populate('ride', 'origin destination departureTime')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit);

    const pagination = helpers.paginate(totalBookings, page, limit);

    res.render('admin/bookings', {
        title: 'Bookings Management',
        user: req.user,
        bookings,
        currentStatus: status,
        pagination
    });
});

/**
 * Show booking details
 */
exports.showBookingDetails = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile email phone')
        .populate('ride')
        .populate('ride.rider', 'profile email phone');

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    res.render('admin/booking-details', {
        title: `Booking Details - Admin`,
        user: req.user,
        booking
    });
});

/**
 * Show settings
 */
exports.showSettings = asyncHandler(async (req, res) => {
    const settings = await Settings.getSettings();
    
    res.render('admin/settings', {
        title: 'System Settings',
        user: req.user,
        settings: settings || {}
    });
});

/**
 * Update settings
 */
exports.updateSettings = asyncHandler(async (req, res) => {
    try {
        const {
            // Pricing
            commission,
            baseFare,
            pricePerKm,
            pricePerMinute,
            
            // Safety
            maxSpeed,
            routeDeviation,
            minRating,
            autoSuspend,
            
            // Notifications
            emailNotifications,
            smsNotifications,
            pushNotifications,
            sosAlerts,
            
            // Features
            rideSharingEnabled,
            chatEnabled,
            reviewsEnabled,
            paymentOnline,
            verificationRequired,
            maintenanceMode,
            
            // Email Config
            smtpHost,
            smtpPort,
            fromEmail,
            fromName,
            
            // SMS Config
            twilioSid,
            twilioPhone,
            
            // Environmental
            co2PerKm,
            co2PerTree,
            
            // Booking
            maxPassengers,
            cancellationWindow,
            cancellationFee,
            autoAcceptRadius
        } = req.body;

        const updates = {
            pricing: {
                commission: parseFloat(commission) || 10,
                baseFare: parseFloat(baseFare) || 20,
                pricePerKm: parseFloat(pricePerKm) || 5,
                pricePerMinute: parseFloat(pricePerMinute) || 1
            },
            safety: {
                maxSpeed: parseInt(maxSpeed) || 100,
                routeDeviation: parseInt(routeDeviation) || 500,
                minRating: parseFloat(minRating) || 3.5,
                autoSuspendReports: parseInt(autoSuspend) || 3
            },
            notifications: {
                emailEnabled: emailNotifications === 'on' || emailNotifications === true,
                smsEnabled: smsNotifications === 'on' || smsNotifications === true,
                pushEnabled: pushNotifications === 'on' || pushNotifications === true,
                sosAlertsEnabled: sosAlerts === 'on' || sosAlerts === true
            },
            features: {
                rideSharingEnabled: rideSharingEnabled === 'on' || rideSharingEnabled === true,
                chatEnabled: chatEnabled === 'on' || chatEnabled === true,
                reviewsEnabled: reviewsEnabled === 'on' || reviewsEnabled === true,
                onlinePaymentRequired: paymentOnline === 'on' || paymentOnline === true,
                verificationRequired: verificationRequired === 'on' || verificationRequired === true,
                maintenanceMode: maintenanceMode === 'on' || maintenanceMode === true
            },
            email: {
                smtpHost: smtpHost || 'smtp.gmail.com',
                smtpPort: parseInt(smtpPort) || 587,
                fromEmail: fromEmail || 'noreply@lanecarpool.com',
                fromName: fromName || 'LANE Carpool'
            },
            sms: {
                twilioSid: twilioSid || '',
                twilioPhone: twilioPhone || ''
            }
        };

        // Add optional fields if provided
        if (co2PerKm) {
            updates.environmental = {
                co2PerKm: parseFloat(co2PerKm) || 0.12,
                co2PerTree: parseFloat(co2PerTree) || 22
            };
        }

        if (maxPassengers) {
            updates.booking = {
                maxPassengersPerRide: parseInt(maxPassengers) || 4,
                cancellationWindow: parseInt(cancellationWindow) || 60,
                cancellationFee: parseFloat(cancellationFee) || 0,
                autoAcceptRadius: parseFloat(autoAcceptRadius) || 5
            };
        }

        const settings = await Settings.updateSettings(updates, req.user._id);
        
        console.log('✅ [Settings] Settings updated successfully by admin:', req.user.email);
        
        res.json({ 
            success: true, 
            message: 'Settings updated successfully',
            settings: settings
        });
    } catch (error) {
        console.error('❌ [Settings] Error updating settings:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update settings: ' + error.message 
        });
    }
});

/**
 * Get admin notifications
 */
exports.getNotifications = asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ 
        user: req.user._id,
        type: { $in: [
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
        ]}
    })
    .sort({ createdAt: -1 })
    .limit(20);

    const unreadCount = await Notification.countDocuments({
        user: req.user._id,
        read: false,
        type: { $in: [
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
        ]}
    });

    res.json({
        success: true,
        notifications,
        unreadCount
    });
});

/**
 * Mark notification as read
 */
exports.markNotificationAsRead = asyncHandler(async (req, res) => {
    const { notificationId } = req.params;

    await Notification.findByIdAndUpdate(notificationId, {
        read: true,
        readAt: new Date()
    });

    res.json({ success: true, message: 'Notification marked as read' });
});

/**
 * Show Financial Dashboard
 * GET /admin/financial-dashboard
 */
exports.showFinancialDashboard = asyncHandler(async (req, res) => {
    const Transaction = require('../models/Transaction');
    const Booking = require('../models/Booking');
    
    // Get date range from query params or default to last 30 days
    const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
    const startDate = req.query.startDate 
        ? new Date(req.query.startDate) 
        : new Date(endDate.getTime() - (30 * 24 * 60 * 60 * 1000));

    console.log(`📊 [Admin Financial] Fetching data from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Get financial summary from Transaction model
    const summary = await Transaction.getFinancialSummary(startDate, endDate);

    // Get recent transactions
    const recentTransactions = await Transaction.find({
        createdAt: { $gte: startDate, $lte: endDate }
    })
    .populate('passenger', 'profile.firstName profile.lastName name email')
    .populate('rider', 'profile.firstName profile.lastName name email')
    .populate('booking')
    .sort({ createdAt: -1 })
    .limit(50);

    // Get bookings requiring payment confirmation
    const pendingPayments = await Booking.find({
        status: 'DROPPED_OFF',
        'payment.riderConfirmedPayment': false
    })
    .populate('passenger', 'profile.firstName profile.lastName name')
    .populate('ride', 'rider')
    .populate({
        path: 'ride',
        populate: { path: 'rider', select: 'profile.firstName profile.lastName name' }
    })
    .sort({ 'journey.droppedOffAt': -1 })
    .limit(20);

    res.render('admin/financial-dashboard', {
        title: 'Financial Dashboard',
        user: req.user,
        summary,
        recentTransactions,
        pendingPayments,
        startDate,
        endDate,
        getUserName: require('../models/User').getUserName
    });
});

