/**
 * Enhanced Tracking Controller with Intelligent Geo-Fencing
 * Real-time ride tracking with route deviation detection and safety monitoring
 */

const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const Emergency = require('../models/Emergency');
const RouteDeviation = require('../models/RouteDeviation');
const GeoFencing = require('../utils/geoFencing');
const EmergencyResponseSystem = require('../utils/emergencyResponseSystem');
const { AppError, asyncHandler } = require('../middleware/errorHandler');

// Store for tracking last alerts to prevent spam
const lastAlerts = new Map();

/**
 * Show live tracking page
 * GET /tracking/:bookingId
 */
exports.showTrackingPage = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const userId = req.user._id;

    console.log('🔵 [Tracking] Loading tracking page for ID:', bookingId);

    let booking;

    // Try to find as booking ID first
    booking = await Booking.findById(bookingId)
        .populate({
            path: 'ride',
            populate: [
                { path: 'rider', select: 'profile phone rating vehicles' },
                { path: 'vehicle', select: 'make model color licensePlate' }
            ]
        })
        .populate('passenger', 'profile phone')
        .populate('rider', 'profile phone rating');

    // If not found, try as ride ID
    if (!booking) {
        const ride = await Ride.findById(bookingId);
        if (ride) {
            booking = await Booking.findOne({
                ride: ride._id,
                $or: [{ passenger: userId }, { rider: userId }],
                status: { $in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }
            })
            .populate({
                path: 'ride',
                populate: [
                    { path: 'rider', select: 'profile phone rating vehicles' },
                    { path: 'vehicle', select: 'make model color licensePlate' }
                ]
            })
            .populate('passenger', 'profile phone')
            .populate('rider', 'profile phone rating');
        }
    }

    if (!booking) {
        req.flash('error', 'Booking not found or you do not have access');
        return res.redirect('/bookings/my-bookings');
    }

    // Authorization check
    const isPassenger = booking.passenger._id.toString() === userId.toString();
    const isRider = booking.rider._id.toString() === userId.toString();

    if (!isPassenger && !isRider) {
        throw new AppError('You are not authorized to track this ride', 403);
    }

    const ride = booking.ride;

    // Perform route risk analysis
    let routeRiskAssessment = null;
    if (ride.route?.geometry?.coordinates) {
        const departureHour = new Date(ride.schedule?.departureDateTime).getHours();
        
        // Get historical incidents for this area (simplified - in production would query incident database)
        const historicalIncidents = await Emergency.find({
            'location.coordinates': {
                $near: {
                    $geometry: {
                        type: 'Point',
                        coordinates: ride.route.start.coordinates
                    },
                    $maxDistance: 50000 // 50km
                }
            },
            createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
        }).lean();

        routeRiskAssessment = GeoFencing.predictRouteRisk(
            ride.route.geometry.coordinates,
            departureHour,
            historicalIncidents
        );
    }

    // Prepare tracking data
    const trackingData = {
        booking,
        ride: {
            ...ride.toObject(),
            fromLocation: ride.route?.start?.name || 'Unknown',
            toLocation: ride.route?.destination?.name || 'Unknown',
            departureTime: ride.schedule?.departureDateTime || new Date(),
            from: {
                coordinates: ride.route?.start?.coordinates || null
            },
            to: {
                coordinates: ride.route?.destination?.coordinates || null
            }
        },
        isPassenger,
        isRider,
        currentLocation: ride.tracking?.currentLocation || null,
        breadcrumbs: ride.tracking?.breadcrumbs || [],
        isLive: ride.tracking?.isLive || false,
        startedAt: ride.tracking?.startedAt || null,
        routeRiskAssessment,
        safetyFeatures: {
            geoFencingEnabled: true,
            deviationMonitoring: true,
            speedMonitoring: true,
            automaticAlerts: true
        },
        mapConfig: {
            defaultCenter: ride.route?.start?.coordinates || [77.1025, 28.7041],
            defaultZoom: 13,
            tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors'
        }
    };

    res.render('tracking/live-tracking', {
        title: `Track Ride - ${trackingData.ride.fromLocation} to ${trackingData.ride.toLocation}`,
        ...trackingData,
        user: req.user
    });
});

/**
 * Update location with intelligent geo-fencing
 * POST /api/tracking/:bookingId/location
 */
exports.updateLocation = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { latitude, longitude, speed, accuracy, heading } = req.body;

    const booking = await Booking.findById(bookingId)
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'name phone emergencyContacts' }
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Authorization check
    const isRider = booking.ride.rider._id.toString() === req.user._id.toString();
    if (!isRider) {
        throw new AppError('Only rider can update location', 403);
    }

    const ride = booking.ride;
    const currentLocation = { lat: latitude, lng: longitude };

    // Initialize tracking alerts map for this ride if not exists
    const alertKey = ride._id.toString();
    if (!lastAlerts.has(alertKey)) {
        lastAlerts.set(alertKey, {});
    }
    const rideAlerts = lastAlerts.get(alertKey);

    // 1. Check route corridor deviation
    let deviationCheck = { withinCorridor: true, deviation: 'NONE' };
    if (ride.route?.geometry?.coordinates) {
        deviationCheck = GeoFencing.isWithinRouteCorridor(
            currentLocation,
            ride.route.geometry.coordinates,
            500 // 500m corridor width
        );

        // Send alerts for major/critical deviations
        if (deviationCheck.deviation === 'CRITICAL' || deviationCheck.deviation === 'MAJOR') {
            if (GeoFencing.shouldSendAlert('ROUTE_DEVIATION', rideAlerts)) {
                console.warn(`⚠️ Route deviation detected: ${deviationCheck.deviation}, Distance: ${deviationCheck.distance}m`);
                
                await this.sendDeviationAlert(booking, deviationCheck, req.app.get('io'));
                rideAlerts['ROUTE_DEVIATION'] = Date.now();
            }
        }
    }

    // 2. Check speed patterns
    const locationHistory = ride.tracking?.breadcrumbs || [];
    locationHistory.push({
        coordinates: [longitude, latitude],
        timestamp: new Date(),
        speed: speed || 0,
        accuracy: accuracy || 0
    });

    const speedAnalysis = GeoFencing.analyzeSpeedPatterns(locationHistory);
    if (speedAnalysis.abnormalSpeed && speedAnalysis.severity === 'CRITICAL') {
        if (GeoFencing.shouldSendAlert('SPEED_ALERT', rideAlerts)) {
            console.warn(`🚨 Speed alert: ${speedAnalysis.message}`);
            
            await this.sendSpeedAlert(booking, speedAnalysis, req.app.get('io'));
            rideAlerts['SPEED_ALERT'] = Date.now();
        }
    }

    // 3. Check for unusual stops
    const stopAnalysis = GeoFencing.detectUnusualStops(locationHistory);
    if (stopAnalysis.suspiciousStop) {
        if (GeoFencing.shouldSendAlert('UNUSUAL_STOP', rideAlerts)) {
            console.warn(`⏱️ Unusual stop detected: ${stopAnalysis.duration}s`);
            
            await this.sendStopAlert(booking, stopAnalysis, req.app.get('io'));
            rideAlerts['UNUSUAL_STOP'] = Date.now();
        }
    }

    // 4. Check danger zones (would integrate with danger zone database)
    // const dangerZones = await DangerZone.find({ active: true });
    // const dangerCheck = GeoFencing.checkDangerZones(currentLocation, dangerZones);
    // if (dangerCheck.inDangerZone) {
    //     await this.sendDangerZoneAlert(booking, dangerCheck, req.app.get('io'));
    // }

    // 5. Calculate ETA
    const etaData = GeoFencing.calculateETA(
        currentLocation,
        { lat: ride.route.destination.coordinates[1], lng: ride.route.destination.coordinates[0] },
        ride.route.geometry.coordinates,
        speed || 40
    );

    // Update ride tracking data
    ride.tracking = ride.tracking || {};
    ride.tracking.currentLocation = {
        coordinates: [longitude, latitude],
        timestamp: new Date(),
        speed: speed || 0,
        accuracy: accuracy || 0
    };

    // Keep last 1000 breadcrumbs
    if (!ride.tracking.breadcrumbs) ride.tracking.breadcrumbs = [];
    ride.tracking.breadcrumbs.push({
        coordinates: [longitude, latitude],
        timestamp: new Date(),
        speed: speed || 0
    });
    if (ride.tracking.breadcrumbs.length > 1000) {
        ride.tracking.breadcrumbs = ride.tracking.breadcrumbs.slice(-1000);
    }

    // Update last deviation info
    ride.tracking.lastDeviation = {
        distance: deviationCheck.distance,
        timestamp: new Date(),
        severity: deviationCheck.deviation
    };

    await ride.save();

    // Broadcast location update via Socket.IO
    const io = req.app.get('io');
    if (io) {
        io.to(`ride-${ride._id}`).emit('location-update', {
            bookingId: booking._id,
            rideId: ride._id,
            location: {
                lat: latitude,
                lng: longitude,
                speed,
                accuracy,
                heading,
                timestamp: new Date()
            },
            deviationStatus: deviationCheck.deviation,
            deviationDistance: deviationCheck.distance,
            speedStatus: speedAnalysis.type,
            eta: etaData.etaMinutes,
            onSchedule: etaData.onSchedule
        });
    }

    res.status(200).json({
        success: true,
        message: 'Location updated',
        geoFencing: {
            routeDeviation: deviationCheck.deviation,
            deviationDistance: deviationCheck.distance,
            withinCorridor: deviationCheck.withinCorridor,
            speedStatus: speedAnalysis.type,
            unusualStop: stopAnalysis.suspiciousStop
        },
        eta: etaData
    });
});

/**
 * Send route deviation alert
 * Creates RouteDeviation record, notifies passengers, driver, and admin
 */
exports.sendDeviationAlert = async function(booking, deviationCheck, io) {
    try {
        const ride = await Ride.findById(booking.ride).populate('rider', 'name phone email');
        if (!ride) return;

        // Notify passengers
        const passengers = await Booking.find({
            ride: ride._id,
            status: { $in: ['CONFIRMED', 'IN_PROGRESS'] }
        }).populate('passenger', 'phone name email');

        const currentLocation = ride.tracking.currentLocation.coordinates;
        const deviationDistanceKm = (deviationCheck.distance / 1000).toFixed(2);

        // Determine severity based on distance
        let severity = 'LOW';
        if (deviationCheck.distance > 15000) severity = 'CRITICAL'; // > 15km
        else if (deviationCheck.distance > 10000) severity = 'HIGH'; // > 10km
        else if (deviationCheck.distance > 5000) severity = 'MEDIUM'; // > 5km

        // Check if there's already an active deviation for this ride
        let deviation = await RouteDeviation.findOne({
            ride: ride._id,
            status: 'ACTIVE'
        });

        if (!deviation) {
            // Create new deviation record
            deviation = await RouteDeviation.create({
                ride: ride._id,
                driver: ride.rider._id,
                passengers: passengers.map(p => p.passenger._id),
                deviationType: 'ROUTE_DEVIATION',
                severity: severity,
                deviationLocation: {
                    type: 'Point',
                    coordinates: currentLocation
                },
                deviationDistance: parseFloat(deviationDistanceKm),
                deviatedAt: new Date(),
                locationDescription: `Deviated ${deviationDistanceKm}km from planned route`,
                status: 'ACTIVE'
            });

            console.log(`📝 Created RouteDeviation record: ${deviation._id}`);
        } else {
            // Update existing deviation
            deviation.deviationDistance = parseFloat(deviationDistanceKm);
            deviation.severity = severity;
            deviation.duration = Math.floor((Date.now() - deviation.deviatedAt) / 1000);
            await deviation.save();
        }

        const alertMessage = `⚠️ ROUTE DEVIATION: Driver is ${deviationDistanceKm}km off the planned route. Stay alert!`;
        const driverWarning = `⚠️ WARNING: You are ${deviationDistanceKm}km off route. Please return to the planned path immediately.`;

        // Send notifications to passengers
        for (const passengerBooking of passengers) {
            if (io) {
                io.to(`user-${passengerBooking.passenger._id}`).emit('safety-alert', {
                    type: 'ROUTE_DEVIATION',
                    severity: severity,
                    message: alertMessage,
                    deviationId: deviation._id,
                    distance: deviationDistanceKm,
                    location: {
                        lat: currentLocation[1],
                        lng: currentLocation[0]
                    },
                    actions: [
                        { label: 'View on Map', action: 'VIEW_MAP' },
                        { label: 'Contact Driver', action: 'CALL_DRIVER' },
                        { label: 'Report Emergency', action: 'SOS', critical: severity === 'CRITICAL' }
                    ]
                });
            }

            deviation.notificationsSent.passengerNotified = true;
        }

        // Warn driver
        if (io) {
            io.to(`user-${ride.rider._id}`).emit('driver-warning', {
                type: 'ROUTE_DEVIATION',
                severity: severity,
                message: driverWarning,
                deviationId: deviation._id,
                distance: deviationDistanceKm,
                instructions: 'Return to planned route immediately to avoid penalties'
            });
        }
        deviation.notificationsSent.driverWarned = true;

        // Alert admin for HIGH or CRITICAL deviations
        if (severity === 'HIGH' || severity === 'CRITICAL') {
            if (io) {
                io.to('admin-room').emit('admin-alert', {
                    type: 'ROUTE_DEVIATION',
                    severity: severity,
                    deviationId: deviation._id,
                    ride: {
                        id: ride._id,
                        rider: ride.rider.name,
                        riderPhone: ride.rider.phone,
                        passengers: passengers.map(p => ({
                            name: p.passenger.name,
                            phone: p.passenger.phone
                        }))
                    },
                    message: `${severity} route deviation detected: ${deviationDistanceKm}km off route`,
                    location: {
                        lat: currentLocation[1],
                        lng: currentLocation[0]
                    },
                    timestamp: new Date(),
                    requiresAction: severity === 'CRITICAL'
                });
            }
            deviation.notificationsSent.adminAlerted = true;
        }

        await deviation.save();

        console.log(`📢 Route deviation alert sent for ride ${ride._id} - Severity: ${severity}, Distance: ${deviationDistanceKm}km`);
    } catch (error) {
        console.error('Error sending deviation alert:', error);
    }
};

/**
 * Send speed alert
 */
exports.sendSpeedAlert = async function(booking, speedAnalysis, io) {
    try {
        const ride = booking.ride;

        if (io) {
            io.to(`ride-${ride._id}`).emit('safety-alert', {
                type: 'SPEED_ALERT',
                severity: speedAnalysis.severity,
                message: speedAnalysis.message,
                speed: speedAnalysis.value
            });
        }

        console.log(`🚨 Speed alert sent for ride ${ride._id}`);
    } catch (error) {
        console.error('Error sending speed alert:', error);
    }
};

/**
 * Send unusual stop alert
 */
exports.sendStopAlert = async function(booking, stopAnalysis, io) {
    try {
        const ride = booking.ride;

        // For critical stops (>30 min), escalate
        if (stopAnalysis.criticalStop) {
            // Auto-trigger emergency check
            if (io) {
                io.to(`ride-${ride._id}`).emit('safety-alert', {
                    type: 'EXTENDED_STOP',
                    severity: 'CRITICAL',
                    message: `Vehicle has been stationary for ${Math.round(stopAnalysis.duration / 60)} minutes`,
                    duration: stopAnalysis.duration,
                    requiresCheck: true
                });
            }

            console.log(`🚨 Critical stop alert for ride ${ride._id}`);
        }
    } catch (error) {
        console.error('Error sending stop alert:', error);
    }
};

/**
 * Get tracking data (API endpoint)
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
        throw new AppError('Not authorized', 403);
    }

    const ride = booking.ride;

    res.status(200).json({
        success: true,
        tracking: {
            isLive: ride.tracking?.isLive || false,
            currentLocation: ride.tracking?.currentLocation || null,
            breadcrumbs: ride.tracking?.breadcrumbs || [],
            startedAt: ride.tracking?.startedAt || null,
            lastDeviation: ride.tracking?.lastDeviation || null
        },
        route: ride.route
    });
});

/**
 * Start tracking
 * POST /api/tracking/:bookingId/start
 */
exports.startTracking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate('ride');

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Only rider can start tracking
    if (booking.ride.rider.toString() !== req.user._id.toString()) {
        throw new AppError('Only rider can start tracking', 403);
    }

    const ride = booking.ride;
    ride.tracking = ride.tracking || {};
    ride.tracking.isLive = true;
    ride.tracking.startedAt = new Date();
    ride.tracking.breadcrumbs = [];
    ride.status = 'IN_PROGRESS';

    await ride.save();

    // Notify all passengers
    const io = req.app.get('io');
    if (io) {
        io.to(`ride-${ride._id}`).emit('tracking-started', {
            rideId: ride._id,
            startedAt: ride.tracking.startedAt
        });
    }

    res.status(200).json({
        success: true,
        message: 'Tracking started',
        tracking: ride.tracking
    });
});

/**
 * Stop tracking
 * POST /api/tracking/:bookingId/stop
 */
exports.stopTracking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate('ride');

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Only rider can stop tracking
    if (booking.ride.rider.toString() !== req.user._id.toString()) {
        throw new AppError('Only rider can stop tracking', 403);
    }

    const ride = booking.ride;
    ride.tracking = ride.tracking || {};
    ride.tracking.isLive = false;
    ride.tracking.completedAt = new Date();

    await ride.save();

    // Clear alerts for this ride
    lastAlerts.delete(ride._id.toString());

    // Notify all passengers
    const io = req.app.get('io');
    if (io) {
        io.to(`ride-${ride._id}`).emit('tracking-stopped', {
            rideId: ride._id,
            completedAt: ride.tracking.completedAt
        });
    }

    res.status(200).json({
        success: true,
        message: 'Tracking stopped',
        tracking: ride.tracking
    });
});

/**
 * Get geo-fence analysis for route
 * POST /api/tracking/analyze-route
 */
exports.analyzeRoute = asyncHandler(async (req, res) => {
    const { routeGeometry, departureTime } = req.body;

    if (!routeGeometry || !routeGeometry.coordinates) {
        throw new AppError('Invalid route geometry', 400);
    }

    const departureHour = new Date(departureTime).getHours();
    
    // Get historical incidents (simplified)
    const historicalIncidents = [];

    const riskAssessment = GeoFencing.predictRouteRisk(
        routeGeometry.coordinates,
        departureHour,
        historicalIncidents
    );

    res.status(200).json({
        success: true,
        riskAssessment
    });
});

module.exports = exports;
