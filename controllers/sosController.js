/**
 * Enhanced SOS Emergency Controller
 * Handles emergency SOS alerts with multi-tier response system
 */

const Emergency = require('../models/Emergency');
const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const EmergencyResponseSystem = require('../utils/emergencyResponseSystem');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

/**
 * Trigger SOS alert - Enhanced with multi-tier response
 */
exports.triggerSOS = asyncHandler(async (req, res) => {
    const { 
        rideId, 
        bookingId, 
        latitude, 
        longitude, 
        notes, 
        type, 
        silentMode,
        address,
        accuracy,
        speed,
        battery
    } = req.body;

    console.log('🚨 [SOS] Emergency triggered by user:', req.user._id);
    console.log('📍 [SOS] Location data received:', { latitude, longitude, accuracy });

    // Validate location coordinates
    if (!latitude || !longitude || typeof latitude !== 'number' || typeof longitude !== 'number') {
        console.error('❌ [SOS] Invalid location coordinates:', { latitude, longitude });
        return res.status(400).json({
            success: false,
            message: 'Valid location coordinates are required for SOS alert. Please enable location permissions and try again.'
        });
    }

    // Validate coordinate ranges
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        console.error('❌ [SOS] Coordinates out of range:', { latitude, longitude });
        return res.status(400).json({
            success: false,
            message: 'Invalid coordinate values received.'
        });
    }

    const user = await User.findById(req.user._id).populate('emergencyContacts');
    
    // Check for suspicious patterns
    const patterns = await Emergency.findSuspiciousPatterns(user._id, 24);
    if (patterns.suspicious) {
        console.warn(`⚠️ Suspicious SOS pattern detected for user ${user._id}: ${patterns.count} triggers in 24h`);
    }

    // Prepare emergency data
    const emergencyData = {
        rideId,
        bookingId,
        latitude,
        longitude,
        type: type || 'SOS',
        notes: notes || 'Emergency assistance required',
        silentMode: silentMode || false,
        address,
        accuracy,
        speed,
        battery,
        userAgent: req.headers['user-agent'],
        platform: req.headers['sec-ch-ua-platform'] || 'unknown'
    };

    // Get socket.io instance
    const io = req.app.get('io');

    // Initialize emergency response system
    const response = await EmergencyResponseSystem.initialize(emergencyData, user, io);

    console.log('✅ [SOS] Emergency response initialized:', response.emergency.emergencyId);

    res.status(201).json({
        success: true,
        message: 'Emergency response activated. Help is on the way.',
        emergency: {
            id: response.emergency._id,
            emergencyId: response.emergency.emergencyId,
            status: response.emergency.status,
            priority: response.emergency.priority,
            contactsNotified: response.contactsNotified.filter(c => c.status === 'SENT').length,
            adminsNotified: response.adminsNotified.length,
            trackingActive: true
        }
    });
});

/**
 * Update SOS location (continuous tracking)
 */
exports.updateSOSLocation = asyncHandler(async (req, res) => {
    const { emergencyId } = req.params;
    const { latitude, longitude, speed, accuracy, heading } = req.body;

    const emergency = await Emergency.findById(emergencyId);

    if (!emergency) {
        throw new AppError('Emergency not found', 404);
    }

    if (emergency.user.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    if (emergency.status === 'RESOLVED' || emergency.status === 'FALSE_ALARM') {
        throw new AppError('Emergency already resolved', 400);
    }

    const locationData = {
        latitude,
        longitude,
        speed,
        accuracy,
        heading
    };

    const io = req.app.get('io');

    // Update location using emergency response system
    await EmergencyResponseSystem.updateLocation(emergency._id, locationData, io);

    res.status(200).json({
        success: true,
        message: 'Location updated',
        location: {
            lat: latitude,
            lng: longitude
        }
    });
});

/**
 * Resolve SOS emergency
 */
exports.resolveEmergency = asyncHandler(async (req, res) => {
    const { emergencyId } = req.params;
    const { resolution, isFalseAlarm, falseAlarmReason } = req.body;

    const emergency = await Emergency.findById(emergencyId);

    if (!emergency) {
        throw new AppError('Emergency not found', 404);
    }

    // Only user or admin can resolve
    const isUser = emergency.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isUser && !isAdmin) {
        throw new AppError('Not authorized', 403);
    }

    const io = req.app.get('io');
    const resolvedBy = isAdmin ? 'ADMIN' : 'USER';

    if (isFalseAlarm) {
        // Mark as false alarm
        await EmergencyResponseSystem.markFalseAlarm(
            emergencyId,
            falseAlarmReason || 'User reported false alarm',
            resolvedBy
        );
    } else {
        // Resolve normally
        await EmergencyResponseSystem.resolve(
            emergencyId,
            resolution || 'Emergency resolved safely',
            resolvedBy,
            io
        );
    }

    res.status(200).json({
        success: true,
        message: isFalseAlarm ? 'Marked as false alarm' : 'Emergency resolved',
        emergency
    });
});

/**
 * Get emergency details
 */
exports.getEmergencyDetails = asyncHandler(async (req, res) => {
    const { emergencyId } = req.params;

    const emergency = await Emergency.findById(emergencyId)
        .populate('user', 'name phone profilePhoto emergencyContacts profile')
        .populate('ride')
        .populate('booking');

    if (!emergency) {
        throw new AppError('Emergency not found', 404);
    }

    // Check authorization
    const isUser = emergency.user._id.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';
    const isEmergencyContact = req.user.phone && 
        emergency.user.emergencyContacts?.some(c => c.phone === req.user.phone);

    if (!isUser && !isAdmin && !isEmergencyContact) {
        throw new AppError('Not authorized', 403);
    }

    res.status(200).json({
        success: true,
        emergency
    });
});

/**
 * Get user's emergency history
 */
exports.getEmergencyHistory = asyncHandler(async (req, res) => {
    const emergencies = await Emergency.find({
        user: req.user._id
    })
    .populate('ride', 'route schedule status')
    .populate('booking')
    .sort({ createdAt: -1 })
    .limit(50);

    res.status(200).json({
        success: true,
        count: emergencies.length,
        emergencies
    });
});

/**
 * Get all active emergencies (Admin only)
 */
exports.getActiveEmergencies = asyncHandler(async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        throw new AppError('Admin access required', 403);
    }

    const activeEmergencies = await Emergency.find({
        status: { $in: ['ACTIVE', 'ESCALATED'] }
    })
    .populate('user', 'name phone profile')
    .populate('ride', 'route schedule')
    .populate('booking')
    .sort({ createdAt: -1 });

    res.status(200).json({
        success: true,
        count: activeEmergencies.length,
        emergencies: activeEmergencies
    });
});

/**
 * Get emergency statistics (Admin only)
 */
exports.getEmergencyStatistics = asyncHandler(async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        throw new AppError('Admin access required', 403);
    }

    const { timeframe } = req.query;
    
    const stats = await EmergencyResponseSystem.getStatistics(timeframe || 'month');

    res.status(200).json({
        success: true,
        stats
    });
});

/**
 * Escalate emergency manually (Admin only)
 */
exports.escalateEmergency = asyncHandler(async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        throw new AppError('Admin access required', 403);
    }

    const { emergencyId } = req.params;
    const { level, reason } = req.body;

    const emergency = await Emergency.findById(emergencyId);

    if (!emergency) {
        throw new AppError('Emergency not found', 404);
    }

    if (emergency.status !== 'ACTIVE' && emergency.status !== 'ESCALATED') {
        throw new AppError('Can only escalate active emergencies', 400);
    }

    await emergency.escalate(level, reason || 'Manual admin escalation', 'ADMIN');

    const io = req.app.get('io');
    if (io) {
        io.emit('emergency:escalated', {
            emergencyId: emergency._id,
            level,
            reason
        });
    }

    res.status(200).json({
        success: true,
        message: `Emergency escalated to level ${level}`,
        emergency
    });
});

/**
 * Dispatch emergency services (Admin only)
 */
exports.dispatchServices = asyncHandler(async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        throw new AppError('Admin access required', 403);
    }

    const { emergencyId } = req.params;
    const { serviceType, caseNumber, officerName, officerBadge, notes } = req.body;

    const emergency = await Emergency.findById(emergencyId);

    if (!emergency) {
        throw new AppError('Emergency not found', 404);
    }

    emergency.emergencyServices = {
        dispatched: true,
        serviceType,
        dispatchTime: new Date(),
        caseNumber,
        officerName,
        officerBadge,
        notes
    };

    emergency.status = 'ESCALATED';
    await emergency.escalate(4, 'Emergency services dispatched', 'ADMIN');
    await emergency.save();

    const io = req.app.get('io');
    if (io) {
        io.emit('emergency:services-dispatched', {
            emergencyId: emergency._id,
            serviceType
        });
    }

    res.status(200).json({
        success: true,
        message: 'Emergency services dispatched',
        emergency
    });
});

/**
 * Show SOS page
 */
exports.showSOSPage = asyncHandler(async (req, res) => {
    const { rideId, bookingId } = req.query;

    let ride = null;
    let booking = null;

    if (rideId) {
        ride = await Ride.findById(rideId);
    }

    if (bookingId) {
        booking = await Booking.findById(bookingId).populate('ride');
    }

    res.render('sos/trigger', {
        title: 'Emergency SOS - LANE Carpool',
        user: req.user,
        ride,
        booking
    });
});

/**
 * Show emergency tracking page (for emergency contacts)
 */
exports.showTrackingPage = asyncHandler(async (req, res) => {
    const { emergencyId } = req.params;

    const emergency = await Emergency.findById(emergencyId)
        .populate('user', 'name phone profile')
        .populate('ride', 'route schedule')
        .populate('booking');

    if (!emergency) {
        throw new AppError('Emergency not found', 404);
    }

    res.render('sos/track-emergency', {
        title: 'Emergency Tracking - LANE Carpool',
        emergency,
        user: req.user
    });
});

/**
 * Show admin emergency dashboard
 */
exports.showAdminDashboard = asyncHandler(async (req, res) => {
    if (req.user.role !== 'ADMIN') {
        throw new AppError('Admin access required', 403);
    }

    const activeEmergencies = await Emergency.find({
        status: { $in: ['ACTIVE', 'ESCALATED'] }
    })
    .populate('user', 'name phone profile')
    .sort({ createdAt: -1 })
    .limit(20);

    const stats = await EmergencyResponseSystem.getStatistics('day');

    res.render('admin/emergency-dashboard', {
        title: 'Emergency Dashboard - LANE Admin',
        user: req.user,
        activeEmergencies,
        stats
    });
});

module.exports = exports;
