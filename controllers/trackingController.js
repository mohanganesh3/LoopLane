/**
 * Tracking Controller
 * Handles real-time ride tracking functionality
 * Features: Live location updates, breadcrumb trails, Socket.IO integration
 */

const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

/**
 * Show live tracking page
 * GET /tracking/:idOrBookingId
 * Accepts either a booking ID or ride ID
 */
exports.showTrackingPage = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const userId = req.user._id;

    console.log('🔵 [Tracking] Loading tracking page for ID:', bookingId);
    console.log('🔵 [Tracking] User:', userId);

    let booking;

    // Try to find as booking ID first
    booking = await Booking.findById(bookingId)
        .populate({
            path: 'ride',
            populate: [
                { path: 'rider', select: 'profile.firstName profile.lastName profile.photo phone rating vehicles' },
                { path: 'vehicle', select: 'make model color licensePlate' }
            ]
        })
        .populate('passenger', 'profile.firstName profile.lastName profile.photo phone')
        .populate('rider', 'profile.firstName profile.lastName profile.photo phone rating');

    // If not found, try as ride ID and find user's booking
    if (!booking) {
        console.log('🔵 [Tracking] Not a booking ID, trying as ride ID...');
        const ride = await Ride.findById(bookingId);
        
        if (ride) {
            console.log('✅ [Tracking] Found ride, looking for user booking...');
            // Find user's booking for this ride
            booking = await Booking.findOne({
                ride: ride._id,
                $or: [
                    { passenger: userId },
                    { rider: userId }
                ],
                status: { $in: ['CONFIRMED', 'READY_FOR_PICKUP', 'IN_PROGRESS', 'COMPLETED'] }
            })
            .populate({
                path: 'ride',
                populate: [
                    { path: 'rider', select: 'profile.firstName profile.lastName profile.photo phone rating vehicles' },
                    { path: 'vehicle', select: 'make model color licensePlate' }
                ]
            })
            .populate('passenger', 'profile.firstName profile.lastName profile.photo phone')
            .populate('rider', 'profile.firstName profile.lastName profile.photo phone rating');
        }
    }

    if (!booking) {
        console.log('❌ [Tracking] No booking found for this ID');
        req.flash('error', 'Booking not found or you do not have access to track this ride');
        return res.redirect('/bookings/my-bookings');
    }

    // Authorization check - only passenger or rider can track
    const isPassenger = booking.passenger._id.toString() === userId.toString();
    const isRider = booking.rider._id.toString() === userId.toString();

    if (!isPassenger && !isRider) {
        console.log('❌ [Tracking] Unauthorized access attempt');
        throw new AppError('You are not authorized to track this ride', 403);
    }

    console.log('✅ [Tracking] Booking found:', {
        status: booking.status,
        isLive: booking.ride.tracking?.isLive,
        userRole: isPassenger ? 'passenger' : 'rider'
    });

    // Get ride data
    const ride = booking.ride;

    // Prepare tracking data with correct schema fields
    const trackingData = {
        booking,
        ride: {
            ...ride.toObject(),
            // Add convenience fields for template
            fromLocation: ride.route?.start?.name || 'Unknown',
            toLocation: ride.route?.destination?.name || 'Unknown',
            departureTime: ride.schedule?.departureDateTime || new Date(),
            from: {
                coordinates: ride.route?.start?.coordinates || null
            },
            to: {
                coordinates: ride.route?.destination?.coordinates || null
            },
            // Status field to check ride state
            status: ride.status,
            // Vehicle information (already populated)
            vehicle: ride.vehicle,
            // Rider information (already populated)
            rider: ride.rider
        },
        isPassenger,
        isRider,
        currentLocation: ride.tracking?.currentLocation || null,
        breadcrumbs: ride.tracking?.breadcrumbs || [],
        isLive: ride.tracking?.isLive || false,
        startedAt: ride.tracking?.startedAt || null,
        // Map configuration - ensure coordinates are in correct format
        mapConfig: {
            defaultCenter: ride.route?.start?.coordinates 
                ? [ride.route.start.coordinates[1], ride.route.start.coordinates[0]] // [lat, lng] for Leaflet
                : [28.7041, 77.1025], // Default to Delhi
            defaultZoom: 13,
            tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors'
        }
    };

    const fromLoc = ride.route?.start?.name || 'Unknown';
    const toLoc = ride.route?.destination?.name || 'Unknown';

    res.render('tracking/live-tracking', {
        title: `Track Ride - ${fromLoc} to ${toLoc}`,
        ...trackingData,
        user: req.user
    });
});

/**
 * Get current tracking data (API endpoint)
 * GET /api/tracking/:bookingId
 */
exports.getTrackingData = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const userId = req.user._id;

    const booking = await Booking.findById(bookingId)
        .populate({
            path: 'ride',
            select: 'tracking status fromLocation toLocation from to estimatedDuration'
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Authorization check
    const isPassenger = booking.passenger.toString() === userId.toString();
    const isRider = booking.rider.toString() === userId.toString();

    if (!isPassenger && !isRider) {
        throw new AppError('Unauthorized', 403);
    }

    const ride = booking.ride;

    res.json({
        success: true,
        data: {
            isLive: ride.tracking?.isLive || false,
            currentLocation: ride.tracking?.currentLocation || null,
            breadcrumbs: ride.tracking?.breadcrumbs || [],
            lastUpdated: ride.tracking?.currentLocation?.timestamp || null,
            rideStatus: ride.status,
            startedAt: ride.tracking?.startedAt,
            estimatedArrival: calculateETA(ride),
            deviation: ride.tracking?.lastDeviation || null
        }
    });
});

/**
 * Update driver location during ride (API endpoint)
 * POST /api/tracking/:rideId/location
 */
exports.updateLocation = asyncHandler(async (req, res) => {
    const { rideId } = req.params;
    const { latitude, longitude, speed, accuracy } = req.body;
    const userId = req.user._id;

    console.log('🔵 [Tracking] Location update for ride:', rideId);
    console.log('🔵 [Tracking] Location:', { latitude, longitude, speed });

    const ride = await Ride.findById(rideId);

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    // Only rider can update location
    if (ride.rider.toString() !== userId.toString()) {
        throw new AppError('Only the rider can update location', 403);
    }

    // Check ride status (allow ACTIVE, READY_FOR_PICKUP or IN_PROGRESS to start streaming)
    if (!['IN_PROGRESS', 'ACTIVE', 'READY_FOR_PICKUP'].includes(ride.status)) {
        throw new AppError('Ride is not active', 400);
    }

    // Ensure tracking object exists
    if (!ride.tracking) {
        ride.tracking = {};
    }
    if (!Array.isArray(ride.tracking.breadcrumbs)) {
        ride.tracking.breadcrumbs = [];
    }
    if (!ride.tracking.isLive) {
        ride.tracking.isLive = true;
        ride.tracking.startedAt = ride.tracking.startedAt || new Date();
    }

    // Update current location
    ride.tracking.currentLocation = {
        coordinates: [longitude, latitude],
        timestamp: new Date(),
        speed: speed || 0,
        accuracy: accuracy || 0
    };

    ride.tracking.lastUpdated = new Date();

    // Add to breadcrumbs (cap to last 500 points)
    ride.tracking.breadcrumbs.push({
        coordinates: [longitude, latitude],
        timestamp: new Date(),
        speed: speed || 0
    });
    if (ride.tracking.breadcrumbs.length > 500) {
        ride.tracking.breadcrumbs = ride.tracking.breadcrumbs.slice(-500);
    }

    await ride.save();

    console.log('✅ [Tracking] Location updated successfully');

    // Emit Socket.IO event to all tracking this ride
    const io = req.app.get('io');
    io.to(`ride-${rideId}`).emit('location-update', {
        rideId,
        location: {
            latitude,
            longitude,
            speed,
            accuracy,
            timestamp: new Date()
        }
    });

    // Find all bookings for this ride and emit to booking rooms too
    const bookings = await Booking.find({ ride: rideId, status: { $in: ['CONFIRMED', 'IN_PROGRESS'] } });
    bookings.forEach(booking => {
        io.to(`tracking-${booking._id}`).emit('location-update', {
            bookingId: booking._id.toString(),
            rideId,
            location: {
                latitude,
                longitude,
                speed,
                accuracy,
                timestamp: new Date()
            }
        });
    });

    res.json({
        success: true,
        message: 'Location updated successfully',
        data: {
            currentLocation: ride.tracking.currentLocation,
            breadcrumbsCount: ride.tracking.breadcrumbs.length
        }
    });
});

/**
 * Calculate estimated time of arrival
 */
function calculateETA(ride) {
    if (!ride.tracking?.isLive || !ride.tracking?.currentLocation) {
        return null;
    }

    // Simple ETA calculation based on estimated duration
    // In production, use actual distance and traffic APIs
    const departureTime = new Date(ride.departureTime);
    const estimatedDuration = ride.estimatedDuration || 60; // minutes
    const estimatedArrival = new Date(departureTime.getTime() + estimatedDuration * 60000);

    return estimatedArrival;
}

module.exports = exports;
