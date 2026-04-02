/**
 * Report Controller
 * Handles user reports and dispute resolution
 */

const Report = require('../models/Report');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const emailService = require('../utils/emailService');

const ADMIN_PANEL_ROLES = ['ADMIN', 'SUPER_ADMIN', 'SUPPORT_AGENT', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'CONTENT_MODERATOR', 'FLEET_MANAGER'];
const CLOSED_BOOKING_STATUSES = ['REJECTED', 'EXPIRED', 'CANCELLED'];

const hasReportAdminAccess = (user) => {
    if (!user) return false;
    return ADMIN_PANEL_ROLES.includes(user.role) || user.employeeDetails?.permissions?.includes('manage_reports');
};

const toBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    }
    return Boolean(value);
};

/**
 * Submit report
 */
exports.submitReport = asyncHandler(async (req, res) => {
    const {
        reportedUserId,
        rideId,
        bookingId,
        category,
        description,
        severity,
        requestRefund
    } = req.body;

    // Verify reported user exists
    const reportedUser = await User.findById(reportedUserId);
    if (!reportedUser) {
        throw new AppError('Reported user not found', 404);
    }

    // Cannot report yourself
    if (reportedUserId === req.user._id.toString()) {
        throw new AppError('Cannot report yourself', 400);
    }

    if (!rideId && !bookingId) {
        throw new AppError('Ride or booking reference is required', 400);
    }

    const currentUserId = req.user._id.toString();
    let resolvedRideId = rideId || undefined;

    // Verify relationship (must have booking/ride together)
    let hasRelationship = false;

    if (bookingId) {
        const booking = await Booking.findById(bookingId).select('passenger rider ride status');
        if (!booking) {
            throw new AppError('Booking not found', 404);
        }

        if (rideId && booking.ride?.toString() !== rideId) {
            throw new AppError('Ride and booking reference do not match', 400);
        }

        const participantIds = [booking.passenger?.toString(), booking.rider?.toString()];
        hasRelationship = participantIds.includes(currentUserId) && participantIds.includes(reportedUserId);

        if (!hasRelationship || currentUserId === reportedUserId) {
            throw new AppError('You can only report the other party from this booking', 403);
        }

        if (CLOSED_BOOKING_STATUSES.includes(booking.status)) {
            throw new AppError('This booking is no longer eligible for reporting', 403);
        }

        resolvedRideId = booking.ride?.toString() || resolvedRideId;
    } else if (rideId) {
        const ride = await Ride.findById(rideId).select('rider');
        if (!ride) {
            throw new AppError('Ride not found', 404);
        }

        const riderId = ride.rider?.toString();
        if (reportedUserId === riderId && currentUserId !== riderId) {
            hasRelationship = Boolean(await Booking.exists({
                ride: rideId,
                passenger: req.user._id,
                rider: ride.rider,
                status: { $nin: CLOSED_BOOKING_STATUSES }
            }));
        } else if (currentUserId === riderId && reportedUserId !== riderId) {
            hasRelationship = Boolean(await Booking.exists({
                ride: rideId,
                passenger: reportedUserId,
                rider: req.user._id,
                status: { $nin: CLOSED_BOOKING_STATUSES }
            }));
        }
    }

    if (!hasRelationship) {
        throw new AppError('You can only report users you have interacted with', 403);
    }

    // Create report
    const report = await Report.create({
        reporter: req.user._id,
        reportedUser: reportedUserId,
        ride: resolvedRideId || undefined,
        booking: bookingId || undefined,
        category,
        description,
        severity: severity || 'MEDIUM',
        refundRequested: toBoolean(requestRefund)
    });

    // Get reporter and reported user names safely
    const reporterName = User.getUserName(req.user);
    const reportedName = User.getUserName(reportedUser);

    // Notify admins
    const admins = await User.find({
        $or: [
            { role: { $in: ['ADMIN', 'SUPER_ADMIN'] } },
            { 'employeeDetails.permissions': 'manage_reports' }
        ]
    }).select('_id');
    for (const admin of admins) {
        await Notification.create({
            user: admin._id,
            type: 'NEW_REPORT',
            title: 'New Report Filed',
            message: `${reporterName} reported ${reportedName}`,
            priority: severity === 'HIGH' ? 'HIGH' : 'NORMAL',
            data: {
                reportId: report._id,
                category
            }
        });
    }

    // Send confirmation email to reporter
    const slaHoursMap = { HIGH: 2, MEDIUM: 8, LOW: 24 };
    const reporterEmail = req.user.email;
    const reporterFirstName = req.user.profile?.firstName || 'User';
    if (reporterEmail) {
        emailService.sendReportSubmittedEmail(reporterEmail, reporterFirstName, {
            category: report.category,
            severity: report.severity || 'MEDIUM',
            reportId: report._id
        }).catch(err => console.error('Failed to send report submission email:', err.message));
    }

    res.status(201).json({
        success: true,
        message: `Report submitted successfully. We'll investigate within ${slaHoursMap[report.severity] || 24} hours.`,
        report,
        redirectUrl: '/my-reports'
    });
});

/**
 * Get user's reports
 */
exports.getMyReports = asyncHandler(async (req, res) => {
    const reports = await Report.find({
        reporter: req.user._id
    })
    .populate('reportedUser', 'profile email')
    .populate('ride', 'route.start route.destination')
    .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: reports.length,
        reports
    });
});

/**
 * Get report details
 */
exports.getReportDetails = asyncHandler(async (req, res) => {
    const { reportId } = req.params;

    const report = await Report.findById(reportId)
        .populate('reporter', 'profile email phone')
        .populate('reportedUser', 'profile email phone')
        .populate('ride')
        .populate('booking')
        .populate('adminReview.reviewedBy', 'profile');

    if (!report) {
        throw new AppError('Report not found', 404);
    }

    // Check authorization
    const isReporter = report.reporter._id.toString() === req.user._id.toString();
    const isAdmin = hasReportAdminAccess(req.user);

    if (!isReporter && !isAdmin) {
        throw new AppError('Not authorized', 403);
    }

    res.status(200).json({
        success: true,
        report
    });
});

/**
 * Add follow-up message to a report
 */
exports.addMessage = asyncHandler(async (req, res) => {
    const { reportId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
        throw new AppError('Message is required', 400);
    }

    const report = await Report.findById(reportId);
    if (!report) {
        throw new AppError('Report not found', 404);
    }

    const isReporter = report.reporter.toString() === req.user._id.toString();
    const isAdmin = hasReportAdminAccess(req.user);

    if (!isReporter && !isAdmin) {
        throw new AppError('Not authorized', 403);
    }

    const from = isAdmin ? 'ADMIN' : 'REPORTER';

    report.messages.push({
        from,
        message: message.trim(),
        timestamp: new Date()
    });

    await report.save();

    // If admin sends a message, notify the reporter
    if (from === 'ADMIN') {
        await Notification.create({
            user: report.reporter,
            type: 'REPORT_UPDATE',
            title: 'New message on your report',
            message: `An admin responded to your report: "${message.trim().substring(0, 80)}${message.length > 80 ? '...' : ''}"`,
            priority: 'NORMAL',
            data: { reportId: report._id }
        });
    }

    res.status(200).json({
        success: true,
        message: 'Message added',
        report
    });
});

module.exports = exports;
