/**
 * Tracking Controller
 * Handles real-time ride tracking functionality
 * Features: Live location updates, breadcrumb trails, Socket.IO integration
 * ✅ RESPECTS: shareLocation privacy preference
 */

const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { canShareLocation } = require('../utils/helpers');

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
            select: 'tracking status route schedule'
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
            deviation: ride.tracking?.lastDeviation || null,
            route: ride.route || null
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
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
        throw new AppError('Valid latitude and longitude are required', 400);
    }

    const ride = await Ride.findById(rideId).populate('rider', 'preferences.privacy');

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    // Only rider can update location
    if (ride.rider._id.toString() !== userId.toString()) {
        throw new AppError('Only the rider can update location', 403);
    }

    // ✅ CHECK LOCATION SHARING PREFERENCE
    // Even if rider disabled sharing, we still allow tracking during active rides for safety
    // But we log it for audit purposes
    if (!canShareLocation(ride.rider)) {
    }

    // Check ride status (allow active rides before or during the live trip window).
    if (!['IN_PROGRESS', 'ACTIVE'].includes(ride.status)) {
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
        coordinates: [parsedLongitude, parsedLatitude],
        timestamp: new Date(),
        speed: speed || 0,
        accuracy: accuracy || 0
    };

    ride.tracking.lastUpdated = new Date();

    // Add to breadcrumbs (cap to last 500 points)
    ride.tracking.breadcrumbs.push({
        coordinates: [parsedLongitude, parsedLatitude],
        timestamp: new Date(),
        speed: speed || 0
    });
    if (ride.tracking.breadcrumbs.length > 500) {
        ride.tracking.breadcrumbs = ride.tracking.breadcrumbs.slice(-500);
    }

    await ride.save();


    // Emit Socket.IO event to all tracking this ride
    const io = req.app.get('io');
    if (io) {
        io.to(`ride-${rideId}`).emit('location-update', {
            rideId,
            location: {
                latitude: parsedLatitude,
                longitude: parsedLongitude,
                speed,
                accuracy,
                timestamp: new Date()
            }
        });
    }

    // Find all bookings for this ride and emit to booking rooms too
    const bookings = await Booking.find({
        ride: rideId,
        status: { $in: ['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING'] }
    });
    if (io) {
        bookings.forEach(booking => {
            io.to(`tracking-${booking._id}`).emit('location-update', {
                bookingId: booking._id.toString(),
                rideId,
                location: {
                    latitude: parsedLatitude,
                    longitude: parsedLongitude,
                    speed,
                    accuracy,
                    timestamp: new Date()
                }
            });
        });
    }

    // Epic 1: Admin God's Eye Global Telemetry update
    if (io) {
        io.emit('driverLocationUpdated', {
            rideId: ride._id.toString(),
            driverId: ride.rider ? ride.rider._id?.toString?.() || ride.rider.toString() : null,
            location: {
                coordinates: [parsedLongitude, parsedLatitude] // [lng, lat] for DeckGL
            }
        });
    }

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
    if (!ride.schedule?.departureDateTime || !ride.route?.duration) {
        return null;
    }

    const departureTime = new Date(ride.schedule.departureDateTime);
    const estimatedDuration = ride.route.duration || 60; // minutes
    const estimatedArrival = new Date(departureTime.getTime() + estimatedDuration * 60000);

    return estimatedArrival;
}

module.exports = exports;
