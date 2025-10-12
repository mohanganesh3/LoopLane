/**
 * Admin Controller
 * Handles admin operations: user verification, emergency management, reports
 */

const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Emergency = require('../models/Emergency');
const Report = require('../models/Report');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
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

    // Get revenue statistics
    const totalRevenue = await Booking.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$fare' } } }
    ]);

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
            revenue: totalRevenue[0]?.total || 0
        },
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
 * Show active emergencies
 */
exports.showEmergencies = asyncHandler(async (req, res) => {
    const { status = 'ACTIVE' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const query = status === 'all' ? {} : { status: status.toUpperCase() };

    const totalEmergencies = await Emergency.countDocuments(query);
    const emergencies = await Emergency.find(query)
        .populate('user', 'name phone profilePhoto emergencyContacts')
        .populate('ride', 'origin destination')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const pagination = helpers.paginate(totalEmergencies, page, limit);

    res.render('admin/emergencies', {
        title: 'Emergency Alerts - Admin',
        user: req.user,
        emergencies,
        currentStatus: status,
        pagination
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

    // Calculate date range
    let startDate = new Date();
    if (range === 'week') {
        startDate.setDate(startDate.getDate() - 7);
    } else if (range === 'month') {
        startDate.setMonth(startDate.getMonth() - 1);
    } else {
        startDate.setFullYear(startDate.getFullYear() - 1);
    }

    // User Statistics
    const totalUsers = await User.countDocuments();
    const newUsersThisMonth = await User.countDocuments({
        createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });

    // Ride Statistics
    const totalRides = await Ride.countDocuments();
    const completedRides = await Ride.countDocuments({ status: 'COMPLETED' });
    const activeRides = await Ride.countDocuments({ status: 'ACTIVE' });
    const cancelledRides = await Ride.countDocuments({ status: 'CANCELLED' });
    const completionRate = totalRides > 0 ? Math.round((completedRides / totalRides) * 100) : 0;

    // Revenue Statistics
    const revenueData = await Booking.aggregate([
        { $match: { status: 'COMPLETED', 'payment.status': 'SUCCESS' } },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: '$pricing.total' },
                platformFees: { $sum: '$pricing.platformFee' }
            }
        }
    ]);

    const revenueThisMonth = await Booking.aggregate([
        {
            $match: {
                status: 'COMPLETED',
                'payment.status': 'SUCCESS',
                createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$pricing.total' }
            }
        }
    ]);

    // Environmental Impact
    const totalDistance = await Ride.aggregate([
        { $match: { status: 'COMPLETED' } },
        { $group: { _id: null, total: { $sum: '$distance' } } }
    ]);
    const co2Saved = totalDistance[0] ? Math.round((totalDistance[0].total / 1000) * 0.12) : 0; // 120g CO2 per km
    const treesEquivalent = Math.round(co2Saved / 21); // 1 tree absorbs 21kg CO2/year

    // User Growth Chart Data
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

    // Revenue Chart Data
    const revenueChartData = await Booking.aggregate([
        {
            $match: {
                status: 'COMPLETED',
                'payment.status': 'SUCCESS',
                createdAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                revenue: { $sum: '$pricing.total' }
            }
        },
        { $sort: { _id: 1 } }
    ]);

    // Popular Routes
    const popularRoutes = await Ride.aggregate([
        { $match: { status: { $in: ['COMPLETED', 'ACTIVE'] } } },
        {
            $group: {
                _id: {
                    origin: '$origin.address',
                    destination: '$destination.address'
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);

    // Safety Metrics
    const averageRating = await User.aggregate([
        { $match: { role: 'RIDER', 'rating.overall': { $gt: 0 } } },
        { $group: { _id: null, avg: { $avg: '$rating.overall' } } }
    ]);

    const verifiedDriversCount = await User.countDocuments({ role: 'RIDER', verificationStatus: 'VERIFIED' });
    const totalDrivers = await User.countDocuments({ role: 'RIDER' });
    const verifiedPercentage = totalDrivers > 0 ? Math.round((verifiedDriversCount / totalDrivers) * 100) : 0;

    const sosAlerts = await Emergency.countDocuments();
    const reportsCount = await Report.countDocuments();

    res.render('admin/statistics', {
        title: 'Analytics & Statistics',
        user: req.user,
        stats: {
            users: {
                total: totalUsers,
                newThisMonth: newUsersThisMonth
            },
            rides: {
                total: totalRides,
                completed: completedRides,
                active: activeRides,
                cancelled: cancelledRides,
                completionRate
            },
            revenue: {
                total: revenueData[0]?.totalRevenue || 0,
                thisMonth: revenueThisMonth[0]?.total || 0
            },
            environmental: {
                co2Saved,
                treesEquivalent
            },
            safety: {
                averageRating: averageRating[0]?.avg ? averageRating[0].avg.toFixed(1) : '0.0',
                verifiedDrivers: verifiedPercentage,
                sosAlerts,
                reports: reportsCount
            },
            charts: {
                userGrowth: {
                    labels: userGrowthData.map(d => d._id),
                    data: userGrowthData.map(d => d.count)
                },
                revenue: {
                    labels: revenueChartData.map(d => d._id),
                    data: revenueChartData.map(d => d.revenue)
                },
                popularRoutes: {
                    labels: popularRoutes.map(r => `${r._id.origin} → ${r._id.destination}`),
                    data: popularRoutes.map(r => r.count)
                }
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
    res.render('admin/settings', {
        title: 'System Settings',
        user: req.user
    });
});

/**
 * Update settings
 */
exports.updateSettings = asyncHandler(async (req, res) => {
    // TODO: Implement settings update logic
    res.json({ success: true, message: 'Settings updated successfully' });
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

/**
 * Show SOS Emergency Dashboard
 */
exports.showSOSDashboard = asyncHandler(async (req, res) => {
    res.render('admin/sos-dashboard', {
        title: 'SOS Emergency Dashboard',
        user: req.user
    });
});

/**
 * Get all emergencies (API endpoint)
 */
exports.getAllEmergencies = asyncHandler(async (req, res) => {
    const { status, priority, type, limit = 50 } = req.query;
    
    const query = {};
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (type) query.type = type;
    
    const emergencies = await Emergency.find(query)
        .populate('user', 'profile email phone')
        .populate('ride', 'route.start.name route.destination.name')
        .populate('booking', 'bookingReference')
        .populate('responseTimeline.performedBy', 'profile')
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));
    
    // Calculate statistics
    const stats = {
        active: await Emergency.countDocuments({ status: 'ACTIVE' }),
        inProgress: await Emergency.countDocuments({ status: 'IN_PROGRESS' }),
        resolved: await Emergency.countDocuments({ status: 'RESOLVED' }),
        highPriority: await Emergency.countDocuments({ 
            priority: { $in: ['CRITICAL', 'HIGH'] },
            status: { $in: ['ACTIVE', 'IN_PROGRESS'] }
        }),
        resolvedToday: await Emergency.countDocuments({
            status: 'RESOLVED',
            'resolution.resolvedAt': { 
                $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
            }
        })
    };
    
    // Calculate average response time
    const resolvedEmergencies = await Emergency.find({
        status: 'RESOLVED',
        'resolution.resolvedAt': { $exists: true }
    }).select('createdAt resolution.resolvedAt').limit(100);
    
    if (resolvedEmergencies.length > 0) {
        const totalTime = resolvedEmergencies.reduce((sum, e) => {
            const responseTime = (new Date(e.resolution.resolvedAt) - new Date(e.createdAt)) / 1000 / 60; // minutes
            return sum + responseTime;
        }, 0);
        const avgMinutes = Math.round(totalTime / resolvedEmergencies.length);
        stats.avgResponseTime = avgMinutes < 60 ? `${avgMinutes}m` : `${Math.round(avgMinutes / 60)}h`;
    } else {
        stats.avgResponseTime = '--';
    }
    
    res.json({
        success: true,
        emergencies,
        stats
    });
});

/**
 * Get emergency details (API endpoint)
 */
exports.getEmergencyDetails = asyncHandler(async (req, res) => {
    const { emergencyId } = req.params;
    
    const emergency = await Emergency.findById(emergencyId)
        .populate('user', 'profile email phone emergencyContacts')
        .populate('ride', 'route.start.name route.destination.name rider')
        .populate('booking', 'bookingReference passenger')
        .populate('responseTimeline.performedBy', 'profile')
        .populate('resolution.resolvedBy', 'profile');
    
    if (!emergency) {
        throw new AppError('Emergency not found', 404);
    }
    
    res.json({
        success: true,
        emergency
    });
});

/**
 * Respond to emergency (API endpoint)
 */
exports.respondToEmergency = asyncHandler(async (req, res) => {
    const { emergencyId } = req.params;
    const adminId = req.user._id;
    
    const emergency = await Emergency.findById(emergencyId);
    
    if (!emergency) {
        throw new AppError('Emergency not found', 404);
    }
    
    if (emergency.status !== 'ACTIVE') {
        throw new AppError('Emergency is not active', 400);
    }
    
    // Update status to IN_PROGRESS
    emergency.status = 'IN_PROGRESS';
    
    // Add to response timeline
    emergency.responseTimeline.push({
        action: 'Admin Responded',
        timestamp: new Date(),
        performedBy: adminId,
        details: `Admin ${req.user.profile.firstName} is now responding to this emergency`
    });
    
    await emergency.save();
    
    // Emit socket event to user
    const io = req.app.get('io');
    if (io) {
        io.to(`emergency-${emergencyId}`).emit('admin-responding', {
            emergencyId,
            admin: {
                name: `${req.user.profile.firstName} ${req.user.profile.lastName}`,
                id: adminId
            },
            message: 'An admin is now responding to your emergency'
        });
    }
    
    res.json({
        success: true,
        message: 'Successfully marked as responding',
        emergency
    });
});

/**
 * Resolve emergency (API endpoint)
 */
exports.resolveEmergency = asyncHandler(async (req, res) => {
    const { emergencyId } = req.params;
    const { resolution } = req.body;
    const adminId = req.user._id;
    
    const emergency = await Emergency.findById(emergencyId);
    
    if (!emergency) {
        throw new AppError('Emergency not found', 404);
    }
    
    if (emergency.status === 'RESOLVED') {
        throw new AppError('Emergency already resolved', 400);
    }
    
    // Update status and resolution
    emergency.status = 'RESOLVED';
    emergency.resolution = {
        resolvedAt: new Date(),
        resolvedBy: adminId,
        resolution: resolution || 'Emergency resolved by admin',
        method: 'ADMIN_ACTION'
    };
    
    // Add to response timeline
    emergency.responseTimeline.push({
        action: 'Emergency Resolved',
        timestamp: new Date(),
        performedBy: adminId,
        details: resolution || 'Emergency resolved by admin'
    });
    
    await emergency.save();
    
    // Emit socket event to user
    const io = req.app.get('io');
    if (io) {
        io.to(`emergency-${emergencyId}`).emit('emergency-resolved', {
            emergencyId,
            resolution: resolution || 'Emergency resolved by admin'
        });
    }
    
    res.json({
        success: true,
        message: 'Emergency marked as resolved',
        emergency
    });
});

