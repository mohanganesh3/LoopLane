/**
 * Ride Controller
 * Handles ride posting, searching, matching, and management
 */

const Ride = require('../models/Ride');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const routeMatching = require('../utils/routeMatching');
const carbonCalculator = require('../utils/carbonCalculator');
const autoReassignment = require('../utils/autoReassignment');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const helpers = require('../utils/helpers');
const axios = require('axios');
const { getUserDisplay } = require('../utils/userUtils');
const pricingEngine = require('../utils/pricingEngine'); // Epic 5
const Corporate = require('../models/Corporate');

const normalizeLocationInput = (location, fallbackAddress = '') => {
    const parsed = typeof location === 'string' ? JSON.parse(location) : location;
    const coordinates = parsed?.coordinates?.coordinates || parsed?.coordinates;

    if (!Array.isArray(coordinates) || coordinates.length !== 2) {
        throw new AppError(`Invalid coordinates for ${fallbackAddress || 'location'}`, 400);
    }

    return {
        address: parsed?.address || parsed?.name || fallbackAddress,
        coordinates
    };
};

const normalizeIntermediateStops = (stops = []) => (
    (Array.isArray(stops) ? stops : []).map((stop, index) => {
        const parsedStop = typeof stop === 'string' ? JSON.parse(stop) : stop;
        const coordinates = parsedStop?.coordinates?.coordinates || parsedStop?.coordinates;

        if (!Array.isArray(coordinates) || coordinates.length !== 2) {
            throw new AppError(`Invalid coordinates for stop ${index + 1}`, 400);
        }

        return {
            name: parsedStop?.name || parsedStop?.address || `Stop ${index + 1}`,
            address: parsedStop?.address || parsedStop?.name || `Stop ${index + 1}`,
            coordinates,
            order: index + 1
        };
    })
);

const buildRideRoute = async ({ originCoordinates, destinationCoordinates, fromLocation, toLocation, intermediateStops }) => {
    const origin = normalizeLocationInput(originCoordinates, fromLocation);
    const destination = normalizeLocationInput(destinationCoordinates, toLocation);
    const normalizedStops = normalizeIntermediateStops(intermediateStops);

    const waypoints = [
        origin.coordinates,
        ...normalizedStops.map(stop => stop.coordinates),
        destination.coordinates
    ];

    let distance = 0;
    let duration = 0;
    let geometry = null;

    try {
        const routeData = await routeMatching.getRoute(waypoints);
        distance = routeData.distance;
        duration = routeData.duration;
        geometry = routeData.geometry;
    } catch (error) {
        for (let i = 0; i < waypoints.length - 1; i++) {
            const R = 6371;
            const dLat = (waypoints[i + 1][1] - waypoints[i][1]) * Math.PI / 180;
            const dLon = (waypoints[i + 1][0] - waypoints[i][0]) * Math.PI / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(waypoints[i][1] * Math.PI / 180) * Math.cos(waypoints[i + 1][1] * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distance += R * c;
        }

        duration = distance;
        geometry = {
            type: 'LineString',
            coordinates: waypoints
        };
    }

    return {
        route: {
            start: {
                name: fromLocation || origin.address,
                address: origin.address || fromLocation,
                coordinates: origin.coordinates
            },
            destination: {
                name: toLocation || destination.address,
                address: destination.address || toLocation,
                coordinates: destination.coordinates
            },
            intermediateStops: normalizedStops,
            geometry,
            distance,
            duration
        },
        routeStats: {
            distance,
            duration
        }
    };
};

const buildRidePreferences = (user, {
    ladiesOnly,
    smokingAllowed,
    petsAllowed,
    luggageAllowed
} = {}) => {
    const userPrefs = user.preferences || {};
    const userRideComfort = userPrefs.rideComfort || {};

    return {
        gender: ladiesOnly ? 'FEMALE_ONLY' : 'ANY',
        autoAcceptBookings: false,
        smoking: smokingAllowed !== undefined
            ? (smokingAllowed === 'true' || smokingAllowed === true)
            : (userRideComfort.smokingAllowed === true),
        pets: petsAllowed !== undefined
            ? (petsAllowed === 'true' || petsAllowed === true)
            : (userRideComfort.petsAllowed === true),
        luggage: luggageAllowed ? 'LARGE_LUGGAGE' : 'MEDIUM_BAG',
        music: userRideComfort.musicPreference || 'OPEN_TO_REQUESTS',
        conversation: userRideComfort.conversationPreference || 'DEPENDS_ON_MOOD'
    };
};

/**
 * Post a new ride
 */
exports.postRide = asyncHandler(async (req, res) => {
    const user = req.user;

    // Enforce verificationRequired from Settings
    const features = req.platformSettings?.features || {};
    if (features.verificationRequired !== false && user.verificationStatus !== 'VERIFIED') {
        return res.status(403).json({
            success: false,
            message: 'Document verification required'
        });
    }

    const {
        fromLocation,
        toLocation,
        departureTime,
        vehicleId,
        availableSeats,
        pricePerSeat,
        originCoordinates,
        destinationCoordinates,
        intermediateStops, // F2
        ladiesOnly,
        petsAllowed,
        smokingAllowed,
        luggageAllowed,
        notes,
        returnTripDate, // F3
        returnTripTime  // F3
    } = req.body;

    // Enforce maxPassengersPerRide from Settings
    const bookingSettings = req.platformSettings?.booking || {};
    const maxSeats = bookingSettings.maxPassengersPerRide || 8;
    if (parseInt(availableSeats) > maxSeats) {
        return res.status(400).json({
            success: false,
            message: `Maximum ${maxSeats} passengers allowed per ride (platform limit)`
        });
    }

    // Get vehicle details
    const vehicle = user.vehicles.find(v => v._id.toString() === vehicleId);
    if (!vehicle) {
        return res.status(400).json({
            success: false,
            message: 'Vehicle not found'
        });
    }

    if (vehicle.status !== 'APPROVED') {
        return res.status(400).json({
            success: false,
            message: 'Vehicle is not approved yet'
        });
    }

    // Parse date from ISO string
    const departureDate = new Date(departureTime);

    // F8: Validate departure time is not in the past
    if (departureDate < new Date()) {
        return res.status(400).json({
            success: false,
            message: 'Departure time cannot be in the past'
        });
    }

    if ((returnTripDate && !returnTripTime) || (!returnTripDate && returnTripTime)) {
        return res.status(400).json({
            success: false,
            message: 'Return trip date and time must both be provided'
        });
    }

    let returnDepartureDate = null;
    if (returnTripDate && returnTripTime) {
        returnDepartureDate = new Date(`${returnTripDate}T${returnTripTime}`);

        if (Number.isNaN(returnDepartureDate.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid return trip date or time'
            });
        }

        if (returnDepartureDate <= departureDate) {
            return res.status(400).json({
                success: false,
                message: 'Return trip must be scheduled after the outbound ride'
            });
        }
    }

    const hours = departureDate.getHours().toString().padStart(2, '0');
    const minutes = departureDate.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    const { route } = await buildRideRoute({
        originCoordinates,
        destinationCoordinates,
        fromLocation,
        toLocation,
        intermediateStops
    });

    const rideData = {
        rider: user._id,
        vehicle: vehicle._id,
        route,
        schedule: {
            date: departureDate,
            time: timeString,
            departureDateTime: departureDate,
            flexibleTiming: false,
            returnTrip: {
                enabled: !!(returnTripDate && returnTripTime),
                date: returnTripDate ? new Date(returnTripDate) : null,
                time: returnTripTime || null
            }
        },
        pricing: {
            pricePerSeat: parseFloat(pricePerSeat),
            totalSeats: parseInt(availableSeats),
            availableSeats: parseInt(availableSeats)
        },
        preferences: buildRidePreferences(user, {
            ladiesOnly,
            smokingAllowed,
            petsAllowed,
            luggageAllowed
        }),
        specialInstructions: notes || '',
        status: 'ACTIVE'
    };

    // Step 2: Create the ride
    const ride = await Ride.create(rideData);

    // Fire & Forget: Process Route Alerts for the new ride
    processRouteAlerts(ride).catch(err => console.error('Route alert processing failed:', err));

    // F3: Create return ride if requested
    if (returnTripDate && returnTripTime) {
        const returnDepartureDate = new Date(`${returnTripDate}T${returnTripTime}`);
        if (returnDepartureDate > departureDate) {
            const returnRideData = { ...rideData };
            // Swap origin and destination
            returnRideData.route = {
                start: rideData.route.destination,
                destination: rideData.route.start,
                intermediateStops: rideData.route.intermediateStops ? [...rideData.route.intermediateStops].reverse().map((s, i) => ({ ...s, order: i + 1 })) : [],
                geometry: null, // Reversed route might take different roads (one ways), so leaving geometry null to be safe or could reverse coordinates
                distance: route.distance,
                duration: route.duration
            };

            // Reverse OSRM geometry coordinates if it exists
            if (route.geometry && route.geometry.coordinates) {
                returnRideData.route.geometry = {
                    type: 'LineString',
                    coordinates: [...route.geometry.coordinates].reverse()
                };
            }

            returnRideData.schedule = {
                date: returnDepartureDate,
                time: returnTripTime,
                departureDateTime: returnDepartureDate,
                flexibleTiming: false,
                returnTrip: { enabled: false }
            };

            const returnRide = await Ride.create(returnRideData);

            // Fire & Forget: Process Route Alerts for the return ride
            processRouteAlerts(returnRide).catch(err => console.error('Route alert processing failed for return ride:', err));

            // Update totalRidesPosted to +2 instead of +1
            await User.findByIdAndUpdate(req.user._id, {
                $inc: { 'statistics.totalRidesPosted': 2 }
            });

            return res.status(201).json({
                success: true,
                message: 'Round trip posted successfully (2 rides created)',
                ride,
                redirectUrl: `/rides/my-rides`
            });
        }
    }

    // Update rider's totalRidesPosted stat (just 1)
    await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'statistics.totalRidesPosted': 1 }
    });

    res.status(201).json({
        success: true,
        message: 'Ride posted successfully',
        ride,
        redirectUrl: `/rides/my-rides`
    });
});

/**
 * Helper to process route alerts asynchronously when a new ride is posted
 * Finds matching alerts and sends notifications to interested users
 */
async function processRouteAlerts(ride) {
    try {
        const RouteAlert = require('../models/RouteAlert');
        const Notification = require('../models/Notification');

        const matchedAlerts = await RouteAlert.findMatchingAlerts(
            ride.route.start.coordinates,
            ride.route.destination.coordinates,
            ride.schedule.departureDateTime,
            ride.pricing.availableSeats,
            ride.pricing.pricePerSeat
        );

        if (!matchedAlerts || matchedAlerts.length === 0) return;

        // Create notifications for matched users
        const notifications = matchedAlerts.map(alert => ({
            user: alert.user._id,
            type: 'SYSTEM_ALERT',
            title: 'Ride Match Found! 🚗',
            message: `A new ride from ${ride.route.start.name || ride.route.start.address} to ${ride.route.destination.name || ride.route.destination.address} was just posted.`,
            data: { rideId: ride._id, alertId: alert._id }
        }));

        if (notifications.length > 0) {
            await Notification.insertMany(notifications);

            // Note: If you have Socket.io access here, you'd emit real-time events.
            // Since this is in the controller, it will depend on your socket setup.

            // Update trigger counts on alerts
            const alertIds = matchedAlerts.map(a => a._id);
            await RouteAlert.updateMany(
                { _id: { $in: alertIds } },
                {
                    $inc: { triggerCount: 1 },
                    $set: { lastTriggered: new Date() }
                }
            );
        }
    } catch (error) {
        console.error('Error processing route alerts:', error);
    }
}

// Helper function for distance calculation
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Search rides
 * ✅ RESPECTS: Comfort preferences (smoking, pets, music), gender, verifiedUsersOnly
 */
exports.searchRides = asyncHandler(async (req, res) => {
    const { origin, destination, date, seats, smokingAllowed, petsAllowed, verifiedOnly, genderPreference } = req.query;

    if (!origin || !destination) {
        throw new AppError('Origin and destination are required', 400);
    }

    // Parse coordinates
    const originCoords = JSON.parse(origin);
    const destCoords = JSON.parse(destination);

    // Parse date - search for the ENTIRE DAY
    const searchDate = date ? new Date(date) : new Date();
    // Set to start of day
    searchDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Build base query
    const baseQuery = {
        'schedule.departureDateTime': { $gte: searchDate, $lte: endOfDay },
        'pricing.availableSeats': { $gte: parseInt(seats) || 1 },
        status: 'ACTIVE'
    };

    if (req.user?._id) {
        baseQuery.rider = { $ne: req.user._id };
    }

    // ✅ APPLY PREFERENCE FILTERS
    if (smokingAllowed === 'false') {
        baseQuery['preferences.smoking'] = { $ne: true };
    }
    if (petsAllowed === 'false') {
        baseQuery['preferences.pets'] = { $ne: true };
    }
    if (genderPreference === 'FEMALE_ONLY') {
        baseQuery['preferences.gender'] = 'FEMALE_ONLY';
    }

    // Find rides near the route
    let rides = await Ride.find(baseQuery)
        .populate('rider', 'profile.firstName profile.lastName profile.photo profile.gender rating statistics name fullName displayName verificationStatus preferences.booking preferences.rideComfort preferences.privacy vehicles')
        .lean();

    // F2: Also search rides with matching intermediate stops
    const intermediateQuery = {
        ...baseQuery,
        'route.intermediateStops': {
            $elemMatch: {
                'coordinates': {
                    $near: {
                        $geometry: { type: 'Point', coordinates: destCoords.coordinates || destCoords },
                        $maxDistance: 5000 // 5km radius
                    }
                }
            }
        }
    };
    try {
        const intermediateRides = await Ride.find(intermediateQuery)
            .populate('rider', 'profile.firstName profile.lastName profile.photo profile.gender rating statistics name fullName displayName verificationStatus preferences.booking preferences.rideComfort preferences.privacy vehicles')
            .lean();
        // Merge without duplicates
        const existingIds = new Set(rides.map(r => r._id.toString()));
        intermediateRides.forEach(r => {
            if (!existingIds.has(r._id.toString())) rides.push(r);
        });
    } catch (err) {
        // Graceful fallback — intermediate stops index may not exist
    }

    // ✅ FILTER BY VERIFIED RIDERS (if user preference set)
    if (verifiedOnly === 'true') {
        rides = rides.filter(ride => ride.rider?.verificationStatus === 'VERIFIED');
    }

    // ✅ FILTER BY CURRENT USER'S GENDER PREFERENCE
    if (req.user) {
        const currentUser = await User.findById(req.user._id).select('profile.gender preferences.booking');
        const userGenderPref = currentUser?.preferences?.booking?.preferredCoRiderGender;

        if (userGenderPref && userGenderPref !== 'ANY') {
            rides = rides.filter(ride => {
                const riderGender = ride.rider?.profile?.gender;
                if (userGenderPref === 'MALE_ONLY') return riderGender === 'MALE';
                if (userGenderPref === 'FEMALE_ONLY') return riderGender === 'FEMALE';
                if (userGenderPref === 'SAME_GENDER') return riderGender === currentUser.profile?.gender;
                return true;
            });
        }
    }

    // ✅ CORPORATE STRICT MATCHING: Only show co-worker rides when org requires it
    if (req.user) {
        const currentUserForCorp = await User.findById(req.user._id).select('corporate');
        const orgId = currentUserForCorp?.corporate?.organization;
        if (orgId) {
            const corp = await Corporate.findById(orgId).select('rules.requireStrictMatching').lean();
            if (corp?.rules?.requireStrictMatching) {
                // Get all user IDs in the same organization
                const coworkerIds = await User.find({ 'corporate.organization': orgId }).distinct('_id');
                const coworkerIdSet = new Set(coworkerIds.map(id => id.toString()));
                rides = rides.filter(ride => {
                    const riderId = ride.rider?._id?.toString() || ride.rider?.toString();
                    return coworkerIdSet.has(riderId);
                });
            }
        }
    }

    // Filter out rides without proper route geometry
    const ridesWithValidGeometry = rides.filter(ride => {
        if (!ride.route) return false;
        if (!ride.route.geometry) return false;
        if (!ride.route.geometry.coordinates) return false;
        if (ride.route.geometry.coordinates.length < 2) return false;
        return true;
    });

    // Match routes using intelligent algorithm
    const passengerRoute = {
        pickup: originCoords.coordinates,
        dropoff: destCoords.coordinates
    };

    const matchedRides = routeMatching.findMatchingRides(
        passengerRoute,
        ridesWithValidGeometry,
        20
    );

    // Format results
    const results = matchedRides.map(match => {
        // Resolve vehicle from rider's vehicles subdoc (since vehicle is a subdoc _id, not a separate collection)
        const riderVehicles = match.ride?.rider?.vehicles || [];
        const vehicleId = match.ride?.vehicle?.toString?.() || String(match.ride?.vehicle || '');
        const matchedVehicle = riderVehicles.find(v => v?._id?.toString() === vehicleId);

        // Compute safe rider display details (works with plain objects from .lean())
        const riderDisplay = getUserDisplay(match.ride?.rider || {});
        const seatsRequested = parseInt(seats, 10) || 1;
        const carbonData = carbonCalculator.calculateCarbonSaved(
            match.matchDetails.segmentDistance,
            matchedVehicle?.vehicleType || 'SEDAN',
            seatsRequested
        );

        // ✅ FILTER RIDER CONTACT INFO BASED ON PRIVACY SETTINGS
        const riderData = { ...match.ride.rider };
        const privacyPrefs = riderData.preferences?.privacy || {};

        // Hide phone if showPhone is false
        if (privacyPrefs.showPhone === false) {
            delete riderData.phone;
        }
        // Hide email if showEmail is false  
        if (privacyPrefs.showEmail === false) {
            delete riderData.email;
        }

        // Update ride object with filtered rider data
        const filteredRide = { ...match.ride, rider: riderData, vehicle: matchedVehicle || match.ride.vehicle };

        // Epic 5: Dynamic Pricing Engine (Time-Decay & Surge)
        const basePricePerSeat = match.ride.pricing?.pricePerSeat || 0;

        // 1. Apply Time-Decay if departure is soon and seats are empty
        const timeDecayPricing = pricingEngine.calculateTimeDecayPrice(
            basePricePerSeat,
            match.ride.schedule?.departureDateTime,
            match.ride.pricing?.availableSeats
        );

        // 2. Apply Simulated Surge Math (Mocking local demand/supply)
        // In production, fetch actual hexbin counters from Redis
        const mockSupply = Math.floor(Math.random() * 10) + 1;
        const mockDemand = Math.floor(Math.random() * 20);

        const surgePricing = pricingEngine.calculateSurgeMultiplier(
            timeDecayPricing.finalPrice,
            mockSupply,
            mockDemand
        );

        const finalDynamicPricePerSeat = surgePricing.finalPrice;
        const originalPricePerSeat = basePricePerSeat;

        return {
            ride: filteredRide,
            matchScore: match.matchDetails.matchScore,
            matchQuality: match.matchDetails.matchQuality,
            detour: match.matchDetails.detourPercent,
            distance: match.matchDetails.segmentDistance,
            directDistance: match.matchDetails.directDistance,
            pickupPoint: match.matchDetails.pickupPoint,
            dropoffPoint: match.matchDetails.dropoffPoint,

            // Dynamic Pricing Output
            originalPrice: originalPricePerSeat * seatsRequested,
            price: finalDynamicPricePerSeat * seatsRequested,
            pricePerSeat: finalDynamicPricePerSeat,
            originalPricePerSeat,
            pricingBreakdown: {
                originalPricePerSeat,
                finalPricePerSeat: finalDynamicPricePerSeat,
                timeDecayApplied: timeDecayPricing.discountApplied,
                timeDecayPercentage: timeDecayPricing.discountPercent,
                surgeApplied: surgePricing.isSurging,
                surgeMultiplier: surgePricing.multiplier
            },

            carbonSaved: carbonData.totalSaved || 0, // Send just the number
            carbonData: carbonData, // Send full object for detailed display if needed
            riderDisplayName: riderDisplay.name,
            riderPhoto: riderDisplay.photo,
            riderInitials: riderDisplay.initials
        };
    });

    // Disable caching for search results
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

    // Epic 4: Data-Driven Analytics - Log the search
    try {
        const SearchLog = require('../models/SearchLog');
        await SearchLog.create({
            user: req.user ? req.user._id : null,
            sessionId: req.headers['x-session-id'] || 'anonymous',
            searchParams: {
                origin: {
                    address: JSON.parse(req.query.origin || '{}').address || 'Unknown',
                    coordinates: originCoords.coordinates
                },
                destination: {
                    address: JSON.parse(req.query.destination || '{}').address || 'Unknown',
                    coordinates: destCoords.coordinates
                },
                date: searchDate,
                seats: parseInt(seats) || 1,
                filters: {
                    smokingAllowed, petsAllowed, verifiedOnly, genderPreference
                }
            },
            resultsCount: results.length,
            funnelStatus: 'SEARCHED'
        });
    } catch (err) {
        console.error('Failed to log search:', err);
        // Do not block the user response if logging fails
    }

    // Always return JSON for API routes (React frontend)
    res.status(200).json({
        success: true,
        count: results.length,
        rides: results
    });
});

/**
 * Show ride details
 * ✅ RESPECTS: Profile visibility preferences
 */
exports.showRideDetails = asyncHandler(async (req, res) => {
    const { rideId } = req.params;

    // F4: Increment views counter for ride analytics
    await Ride.findByIdAndUpdate(rideId, { $inc: { views: 1 } });

    // Epic 4: Log view in SearchLog if this was part of a funnel
    try {
        const SearchLog = require('../models/SearchLog');
        const sessionId = req.headers['x-session-id'] || 'anonymous';
        // Find the most recent search by this user/session and mark as VIEWED_RIDE
        const query = req.user ? { user: req.user._id } : { sessionId };
        await SearchLog.findOneAndUpdate(
            { ...query, funnelStatus: 'SEARCHED' },
            {
                $set: { funnelStatus: 'VIEWED_RIDE' },
                $addToSet: { viewedRides: rideId }
            },
            { sort: { createdAt: -1 } } // Update latest
        );
    } catch (err) {
        console.error('Failed to log ride view:', err);
    }

    const ride = await Ride.findById(rideId)
        .populate('rider', 'profile.firstName profile.lastName profile.photo profile.gender rating bio vehicles statistics createdAt phone email preferences verificationStatus')
        .populate({
            path: 'bookings',
            populate: {
                path: 'passenger',
                select: 'profile.firstName profile.lastName profile.photo rating email phone statistics verificationStatus badges createdAt preferences'
            }
        });

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    // ✅ CHECK PROFILE VISIBILITY
    let showRiderContact = true;
    const visibilityPref = ride.rider?.preferences?.privacy?.profileVisibility;
    const showPhonePref = ride.rider?.preferences?.privacy?.showPhone;
    const showEmailPref = ride.rider?.preferences?.privacy?.showEmail;

    if (visibilityPref === 'PRIVATE') {
        // Only show contact info after booking is confirmed
        const userBooking = req.user ? await Booking.findOne({
            ride: ride._id,
            passenger: req.user._id,
            status: { $in: ['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_PROGRESS', 'COMPLETED'] }
        }) : null;
        showRiderContact = !!userBooking;
    } else if (visibilityPref === 'VERIFIED_ONLY') {
        // Only show to verified users
        showRiderContact = req.user?.verificationStatus === 'VERIFIED';
    }

    // Mask contact info if not allowed by visibility OR specific preferences
    if (ride.rider) {
        if (!showRiderContact || showPhonePref === false) {
            ride.rider.phone = undefined;
        }
        if (!showRiderContact || showEmailPref === false) {
            ride.rider.email = undefined;
        }
    }

    // Check if current user has booked
    let userBooking = null;
    if (req.user) {
        userBooking = await Booking.findOne({
            ride: ride._id,
            passenger: req.user._id,
            status: { $nin: ['CANCELLED'] }
        });
    }

    // Get reviews for rider
    const Review = require('../models/Review');
    const reviews = await Review.find({
        reviewee: ride.rider._id,
        ride: { $exists: true }
    })
        .populate('reviewer', 'name profilePhoto')
        .sort({ createdAt: -1 })
        .limit(5);

    // Calculate booking statistics for rider
    let bookingStats = {
        totalPending: 0,
        totalConfirmed: 0,
        totalRevenue: 0,
        seatsBooked: 0
    };

    // Filter confirmed bookings (includes all active statuses)
    let confirmedBookings = [];
    const activeStatuses = ['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'DROPOFF_PENDING', 'DROPPED_OFF'];

    if (ride.bookings) {
        ride.bookings.forEach(booking => {
            if (booking.status === 'PENDING') {
                bookingStats.totalPending++;
            }
            if (activeStatuses.includes(booking.status)) {
                bookingStats.totalConfirmed++;
                bookingStats.totalRevenue += booking.totalPrice || 0;
                bookingStats.seatsBooked += booking.seatsBooked || 0;
                confirmedBookings.push(booking);
            }
        });
    }

    // Return JSON for React frontend
    res.json({
        success: true,
        ride,
        userBooking,
        reviews,
        bookingStats,
        confirmedBookings
    });
});

/**
 * Get bookings for a ride (API response for React frontend)
 */
exports.getRideBookings = asyncHandler(async (req, res) => {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId)
        .populate({
            path: 'bookings',
            populate: {
                path: 'passenger',
                select: 'name profile.firstName profile.lastName profile.photo profilePhoto rating phone email'
            }
        });

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    // Verify the requester is the rider
    if (ride.rider.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized to view these bookings', 403);
    }

    res.status(200).json({
        success: true,
        bookings: ride.bookings || []
    });
});

/**
 * Show my rides page (for riders)
 */
exports.showMyRides = asyncHandler(async (req, res) => {
    const user = req.user;

    if (user.role !== 'RIDER') {
        return res.redirect('/user/dashboard');
    }

    const { status = 'all' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    // Build query
    const query = { rider: user._id };
    if (status !== 'all') {
        query.status = status.toUpperCase();
    }

    const totalRides = await Ride.countDocuments(query);
    let rides = await Ride.find(query)
        .populate({
            path: 'rider',
            // Include profile fields for name and photo; vehicles for matching vehicle id
            select: 'profile.firstName profile.lastName profile.photo vehicles createdAt'
        })
        .populate({
            path: 'bookings',
            populate: {
                path: 'passenger',
                // Explicitly include profile fields to compute names and show photo and rating
                select: 'profile.firstName profile.lastName profile.photo rating createdAt verificationStatus statistics phone'
            }
        })
        .sort({ 'schedule.departureDateTime': -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    // Attach vehicle details to each ride (rides are plain objects because of .lean())
    rides = rides.map(ride => {
        const riderVehicles = ride?.rider?.vehicles || [];
        const rideVehicleId = typeof ride.vehicle === 'object' && ride.vehicle !== null && ride.vehicle._id
            ? ride.vehicle._id.toString()
            : (ride.vehicle?.toString ? ride.vehicle.toString() : String(ride.vehicle || ''));

        const matched = riderVehicles.find(v => v?._id?.toString() === rideVehicleId);
        if (matched) {
            ride.vehicle = matched; // make available for EJS as ride.vehicle.make/model
        } else if (riderVehicles.length > 0) {
            // Fallback: use default vehicle if flagged, else the first one
            const defaultVehicle = riderVehicles.find(v => v.isDefault) || riderVehicles[0];
            ride.vehicle = defaultVehicle;
            console.warn('[MyRides] Vehicle ID not found in rider vehicles. Ride vehicle:', rideVehicleId, 'Using fallback vehicle:', defaultVehicle?._id?.toString());
        } else {
            console.warn('[MyRides] Rider has no vehicles. Rider:', ride?.rider?._id);
        }
        return ride;
    });

    const pagination = helpers.paginate(totalRides, page, limit);

    // Return JSON for React frontend
    res.json({
        success: true,
        rides,
        currentStatus: status,
        pagination
    });
});

/**
 * Update ride
 */
exports.updateRide = asyncHandler(async (req, res) => {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId);

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    if (ride.rider.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    if (ride.status !== 'ACTIVE') {
        throw new AppError('Cannot update non-active ride', 400);
    }

    // Server-side check: prevent editing ride with active bookings
    const activeBookingCount = await Booking.countDocuments({
        ride: ride._id,
        status: { $nin: ['CANCELLED', 'REJECTED', 'EXPIRED'] }
    });
    if (activeBookingCount > 0) {
        throw new AppError('Cannot edit ride with active bookings', 400);
    }

    const { departureTime, availableSeats, pricePerSeat, preferences } = req.body;

    // Update allowed fields (using correct nested schema paths)
    if (departureTime) {
        const newDeparture = new Date(departureTime);
        if (!ride.schedule) ride.schedule = {};
        ride.schedule.departureDateTime = newDeparture;
        ride.schedule.date = newDeparture;
        ride.schedule.time = newDeparture.toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }

    if (availableSeats) {
        if (!ride.pricing) ride.pricing = {};
        const bookedSeats = (ride.pricing.totalSeats || 0) - (ride.pricing.availableSeats || 0);
        const newAvailable = parseInt(availableSeats, 10);

        if (isNaN(newAvailable) || newAvailable < bookedSeats) {
            throw new AppError('Cannot reduce seats below booked count', 400);
        }

        ride.pricing.availableSeats = newAvailable;
        ride.pricing.totalSeats = newAvailable + bookedSeats;
    }

    if (pricePerSeat) {
        if (!ride.pricing) ride.pricing = {};
        const price = parseFloat(pricePerSeat);
        if (isNaN(price) || price <= 0) {
            throw new AppError('Invalid price per seat', 400);
        }
        ride.pricing.pricePerSeat = price;
    }

    if (preferences) {
        ride.preferences = { ...ride.preferences, ...JSON.parse(preferences) };
    }

    await ride.save();

    res.status(200).json({
        success: true,
        message: 'Ride updated successfully',
        ride
    });
});

/**
 * Cancel ride - Now with Smart Auto-Reassignment
 * When a rider cancels, automatically finds alternative rides for passengers
 */
exports.cancelRide = asyncHandler(async (req, res) => {
    const { rideId } = req.params;
    const { reason } = req.body;

    // Get Socket.io instance for real-time notifications
    const io = req.app.get('io');

    const ride = await Ride.findById(rideId)
        .populate('rider', 'name profile');

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    if (ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    if (ride.status === 'CANCELLED') {
        throw new AppError('Ride already cancelled', 400);
    }

    if (ride.status === 'COMPLETED') {
        throw new AppError('Cannot cancel completed ride', 400);
    }

    // Update ride status
    ride.status = 'CANCELLED';
    ride.cancellation = {
        cancelled: true,
        cancelledBy: req.user._id,
        cancelledAt: new Date(),
        reason: reason || 'No reason provided'
    };

    await ride.save();

    // Update rider's cancelledRides stat
    await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'statistics.cancelledRides': 1 }
    });

    // Find all affected bookings
    const affectedBookings = await Booking.find({
        ride: ride._id,
        status: { $in: ['CONFIRMED', 'PENDING'] }
    }).populate('passenger', 'name profile email phone');

    let reassignmentResults = null;

    // Trigger auto-reassignment if there are affected bookings
    if (affectedBookings.length > 0) {
        try {
            // Run auto-reassignment
            reassignmentResults = await autoReassignment.findAlternativeRides(
                ride,
                affectedBookings,
                io
            );
        } catch (reassignError) {
            console.error('❌ [Cancel Ride] Auto-reassignment error:', reassignError);
            // Continue with manual cancellation if auto-reassignment fails
            reassignmentResults = {
                totalBookings: affectedBookings.length,
                reassigned: [],
                noAlternative: affectedBookings.map(b => ({ bookingId: b._id, passengerId: b.passenger._id })),
                errors: [{ error: reassignError.message }]
            };
        }

        // For bookings that couldn't be reassigned, ensure they are cancelled
        for (const booking of affectedBookings) {
            // Skip if already processed by auto-reassignment
            const wasReassigned = reassignmentResults?.reassigned?.some(
                r => r.bookingId.toString() === booking._id.toString()
            );

            if (!wasReassigned && booking.status !== 'CANCELLED') {
                booking.status = 'CANCELLED';
                booking.cancellation = {
                    cancelled: true,
                    cancelledBy: 'RIDER',
                    reason: 'Ride cancelled by rider',
                    cancelledAt: new Date()
                };

                // Issue full refund
                if (booking.payment.status === 'PAID' || booking.payment.status === 'PAYMENT_CONFIRMED') {
                    booking.payment.refund = {
                        amount: booking.totalPrice,
                        status: 'PENDING',
                        initiatedAt: new Date(),
                        reason: 'Ride cancelled by rider'
                    };
                    booking.cancellation.refundIssued = true;
                }

                await booking.save();

                // Send cancellation notification to passenger
                const notification = await Notification.create({
                    user: booking.passenger._id || booking.passenger,
                    type: 'RIDE_CANCELLED',
                    title: 'Ride Cancelled',
                    message: `Your ride has been cancelled by the rider. ${booking.payment.refund ? 'A full refund has been initiated.' : ''}`,
                    data: {
                        bookingId: booking._id,
                        rideId: ride._id,
                        refundAmount: booking.payment.refund?.amount || 0
                    },
                    priority: 'HIGH'
                });

                // Send real-time notification
                if (io) {
                    const passengerId = (booking.passenger._id || booking.passenger).toString();
                    io.to(`user-${passengerId}`).emit('ride-cancelled', {
                        type: 'RIDE_CANCELLED',
                        notification: notification,
                        booking: {
                            id: booking._id,
                            rideId: ride._id,
                            status: 'CANCELLED',
                            refundAmount: booking.payment.refund?.amount || 0
                        }
                    });
                }
            }
        }
    }

    // Restore available seats for non-reassigned bookings
    // (Reassigned bookings have their seats transferred to new ride)

    res.status(200).json({
        success: true,
        message: 'Ride cancelled successfully',
        totalBookings: affectedBookings.length,
        reassignment: reassignmentResults ? {
            attempted: true,
            reassigned: reassignmentResults.reassigned.length,
            noAlternative: reassignmentResults.noAlternative.length,
            details: reassignmentResults
        } : null
    });
});

/**
 * Delete ride
 */
exports.deleteRide = asyncHandler(async (req, res) => {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId);

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    if (ride.rider.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    // Check if ride has any active bookings
    const activeBookings = await Booking.countDocuments({
        ride: ride._id,
        status: { $nin: ['CANCELLED', 'REJECTED', 'EXPIRED'] }
    });

    if (activeBookings > 0) {
        throw new AppError('Cannot delete ride with active bookings. Please cancel the ride first.', 400);
    }

    // Only allow deletion of ACTIVE or CANCELLED rides
    if (!['ACTIVE', 'CANCELLED'].includes(ride.status)) {
        throw new AppError('Cannot delete ride in current status', 400);
    }

    // Delete the ride
    await Ride.findByIdAndDelete(rideId);

    // Delete all associated bookings (should only be cancelled/rejected)
    await Booking.deleteMany({ ride: rideId });

    res.status(200).json({
        success: true,
        message: 'Ride deleted successfully'
    });
});

/**
 * Start ride
 */
exports.startRide = asyncHandler(async (req, res) => {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId)
        .populate('rider', 'profile.firstName profile.lastName email');

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    if (ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    if (ride.status !== 'ACTIVE') {
        throw new AppError('Cannot start non-active ride', 400);
    }

    // New rule: do not allow starting a ride with zero confirmed bookings
    const confirmedCount = await Booking.countDocuments({ ride: ride._id, status: 'CONFIRMED' });
    if (confirmedCount === 0) {
        throw new AppError('Cannot start ride until at least one booking is confirmed', 400);
    }

    ride.status = 'IN_PROGRESS';
    ride.tracking.isLive = true;
    ride.tracking.startedAt = new Date();
    ride.tracking.breadcrumbs = ride.tracking.breadcrumbs || [];

    await ride.save();

    // Get all CONFIRMED bookings and update to PICKUP_PENDING
    const bookingsToStart = await Booking.find({
        ride: ride._id,
        status: 'CONFIRMED'
    }).populate('passenger', 'profile.firstName profile.lastName name email phone');

    // Generate fresh pickup OTPs for all confirmed passengers before boarding.
    const otpService = require('../utils/otpService');
    const Notification = require('../models/Notification');
    const emailService = require('../utils/emailService');

    for (const booking of bookingsToStart) {
        const pickupOTP = otpService.generateOTPWithExpiry(otpService.PICKUP_OTP_VALIDITY_MINUTES);

        booking.status = 'PICKUP_PENDING';
        booking.verification.pickup = pickupOTP;
        booking.journey.started = false; // Will be true after pickup verification
        await booking.save();

        // Get passenger and rider names safely
        const passengerName = User.getUserName(booking.passenger);
        const riderName = User.getUserName(ride.rider);

        // Send real-time notification to passenger
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${booking.passenger._id}`).emit('ride-started', {
                type: 'RIDE_STARTED',
                bookingId: booking._id,
                rideId: ride._id,
                message: `${riderName} is on the way to pick you up!`,
                pickupOTP: pickupOTP.code, // ⭐ Send pickup OTP NOW
                timestamp: new Date(),
                riderInfo: {
                    name: riderName,
                    riderId: ride.rider._id
                },
                trackingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/tracking/${booking._id}`
            });
        }

        // Create notification in database
        await Notification.create({
            user: booking.passenger._id,
            type: 'RIDE_STARTED',
            title: 'Rider On The Way',
            message: `${riderName} is coming to pick you up. Your pickup OTP: ${pickupOTP.code}`,
            data: {
                bookingId: booking._id,
                rideId: ride._id,
                riderId: ride.rider._id,
                pickupOTP: pickupOTP.code
            }
        });
        // Send email with pickup OTP
        try {
            await emailService.sendRideStartedEmail(
                booking.passenger,
                {
                    riderName: riderName,
                    pickupOTP: pickupOTP.code,
                    pickupLocation: booking.pickupPoint.address,
                    estimatedPickupTime: ride.schedule.time,
                    bookingReference: booking.bookingReference,
                    trackingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/tracking/${booking._id}`
                }
            );
        } catch (emailError) {
            console.error('❌ [Start Ride] Email error:', emailError.message);
        }
    }

    // Notify rider's room about ride status update
    const io = req.app.get('io');
    if (io) {
        io.to(`ride-${ride._id}`).emit('ride-status-updated', {
            rideId: ride._id,
            status: 'IN_PROGRESS',
            message: 'Ride started! You can now pick up passengers.',
            timestamp: new Date()
        });
    }

    res.status(200).json({
        success: true,
        message: 'Ride started. Safe journey!',
        ride,
        startedBookings: bookingsToStart.length
    });
});

/**
 * Complete ride
 */
exports.completeRide = asyncHandler(async (req, res) => {
    const { rideId } = req.params;

    const ride = await Ride.findById(rideId)
        .populate('rider', 'profile.firstName profile.lastName email');

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    if (ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    // Allow completion in two cases:
    // 1) Normal flow: IN_PROGRESS -> COMPLETED
    // 2) No bookings ever: ACTIVE + no active bookings -> mark COMPLETED (closure)
    if (ride.status === 'ACTIVE') {
        const activeBookingCount = await Booking.countDocuments({
            ride: ride._id,
            status: { $in: ['PENDING', 'CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING', 'DROPPED_OFF'] }
        });
        if (activeBookingCount === 0) {
            ride.status = 'COMPLETED';
            ride.tracking.isLive = false;
            ride.tracking = ride.tracking || {};
            ride.tracking.completedAt = new Date();
            await ride.save();
            return res.status(200).json({
                success: true,
                message: 'Ride closed with no bookings',
                ride,
                completedBookings: 0,
                totalEarnings: ride.pricing?.totalEarnings || 0
            });
        }
        throw new AppError('Ride cannot be completed while there are pending or confirmed bookings. Start the ride and complete after dropoffs.', 400);
    }

    if (ride.status !== 'IN_PROGRESS') {
        throw new AppError('Ride is not in progress', 400);
    }

    ride.status = 'COMPLETED';
    ride.tracking.isLive = false;
    ride.tracking.completedAt = new Date();

    await ride.save();

    // ⭐ FIX: Get all DROPPED_OFF bookings (not IN_PROGRESS!)
    const bookingsToComplete = await Booking.find({
        ride: ride._id,
        status: 'DROPPED_OFF'  // ✅ FIXED: Look for DROPPED_OFF bookings
    }).populate('passenger', 'profile.firstName profile.lastName name email phone statistics');

    // Complete all dropped-off bookings and notify passengers
    for (const booking of bookingsToComplete) {
        // ⭐ Transition: DROPPED_OFF → COMPLETED
        booking.status = 'COMPLETED';

        // Journey already marked complete during dropoff, but ensure it's set
        booking.journey.completed = true;
        if (!booking.journey.completedAt) {
            booking.journey.completedAt = new Date();
        }
        if (booking.journey.startedAt && !booking.journey.duration) {
            booking.journey.duration = Math.round((booking.journey.completedAt - booking.journey.startedAt) / 60000);
        }

        // ⭐ Process Payment (if not already done)
        if (booking.payment.status === 'PENDING') {
            booking.payment.status = 'PAID';
            booking.payment.paidAt = new Date();

            // Calculate rider earnings (deduct configurable platform fee from Settings)
            const settings = await Settings.getSettings();
            const platformFeePercent = (settings?.pricing?.commission || 10) / 100;
            const riderEarnings = booking.totalPrice * (1 - platformFeePercent);

            // Update ride total earnings
            ride.pricing.totalEarnings = (ride.pricing.totalEarnings || 0) + riderEarnings;

        }

        await booking.save();

        // Update passenger statistics only if NOT already counted via confirmPayment
        if (booking.payment.status !== 'PAYMENT_CONFIRMED') {
            const journeyDist = booking.journey?.distance || ride.route?.distance || 0;
            const passengerSpent = booking.payment?.totalAmount || booking.totalPrice || 0;
            await User.findByIdAndUpdate(booking.passenger._id, {
                $inc: {
                    'statistics.completedRides': 1,
                    'statistics.ridesAsPassenger': 1,
                    'statistics.totalDistance': journeyDist,
                    'statistics.totalSpent': passengerSpent
                }
            });
        }

        // Send real-time notification to passenger
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${booking.passenger._id}`).emit('ride-completed', {
                type: 'RIDE_COMPLETED',
                bookingId: booking._id,
                rideId: ride._id,
                message: 'Your ride has been completed! Please rate your experience.',
                timestamp: new Date()
            });
        }

        // Create notification in database
        const Notification = require('../models/Notification');
        await Notification.create({
            user: booking.passenger._id,
            type: 'RIDE_COMPLETED',
            title: 'Ride Completed',
            message: 'Your ride has been completed successfully. Please rate your experience!',
            data: {
                bookingId: booking._id,
                rideId: ride._id,
                riderId: ride.rider._id
            }
        });
    }

    // ⭐ Save ride with updated earnings
    await ride.save();

    // Update rider statistics (only count bookings completed in this call)
    if (bookingsToComplete.length > 0) {
        const totalPassengers = bookingsToComplete.reduce((sum, b) => sum + (b.seatsBooked || 1), 0);
        const totalEarningsFromBookings = bookingsToComplete.reduce((sum, b) => {
            const fare = b.payment?.rideFare || b.totalPrice || 0;
            return sum + fare;
        }, 0);

        await User.findByIdAndUpdate(req.user._id, {
            $inc: {
                'statistics.completedRides': 1,
                'statistics.ridesAsDriver': 1,
                'statistics.totalDistance': ride.route?.distance || 0,
                'statistics.carbonSaved': ride.carbon?.carbonSaved || 0,
                'statistics.totalEarnings': totalEarningsFromBookings,
                'statistics.totalPassengersCarried': totalPassengers
            },
            $set: { 'statistics.lastRideAt': new Date() }
        });
    }

    res.status(200).json({
        success: true,
        message: 'Ride completed successfully',
        ride,
        completedBookings: bookingsToComplete.length,
        totalEarnings: ride.pricing.totalEarnings || 0
    });
});

/**
 * Update ride location (for real-time tracking)
 */
exports.updateLocation = asyncHandler(async (req, res) => {
    const { rideId } = req.params;
    const { latitude, longitude } = req.body;

    const ride = await Ride.findById(rideId);

    if (!ride) {
        throw new AppError('Ride not found', 404);
    }

    if (ride.rider.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    if (ride.status !== 'IN_PROGRESS') {
        throw new AppError('Cannot update location for inactive ride', 400);
    }

    const location = {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };

    // Update current location
    ride.tracking.currentLocation = location;
    ride.tracking.lastUpdated = new Date();

    // Add to breadcrumbs
    ride.tracking.breadcrumbs.push({
        location,
        timestamp: new Date()
    });

    // Check route deviation
    const deviation = routeMatching.checkRouteDeviation(
        location.coordinates,
        ride.route.geometry.coordinates
    );

    if (deviation.isDeviated && deviation.severity !== 'NONE') {
        // Route deviation detected — alert logic can be added here
    }

    await ride.save();

    res.status(200).json({
        success: true,
        location: ride.tracking.currentLocation,
        deviation
    });
});

/**
 * Get nearby rides based on user's location
 */
exports.getNearbyRides = asyncHandler(async (req, res) => {
    const { lat, lng, radius = 10 } = req.query;

    if (!lat || !lng) {
        throw new AppError('Latitude and longitude are required', 400);
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const searchRadius = parseFloat(radius);

    // Find active rides departing from near the user's location
    const rides = await Ride.find({
        status: 'ACTIVE',
        'schedule.departureDateTime': { $gte: new Date() },
        'startPoint': {
            $geoWithin: {
                $centerSphere: [[longitude, latitude], searchRadius / 6371] // radius in radians
            }
        }
    })
        .populate('rider', 'profile.firstName profile.lastName profile.photo rating verificationStatus vehicles')
        .sort({ 'schedule.departureDateTime': 1 })
        .limit(20)
        .lean();

    // Attach vehicle details from rider's vehicles subdoc
    const enrichedRides = rides.map(ride => {
        const riderVehicles = ride.rider?.vehicles || [];
        const vehicleId = ride.vehicle?.toString?.() || String(ride.vehicle || '');
        const matched = riderVehicles.find(v => v?._id?.toString() === vehicleId);
        if (matched) ride.vehicleDetails = matched;
        return ride;
    });

    res.json({
        success: true,
        count: enrichedRides.length,
        rides: enrichedRides
    });
});

/**
 * Get popular routes based on ride frequency
 */
exports.getPopularRoutes = asyncHandler(async (req, res) => {
    // Aggregate ride data to find the most popular origin-destination pairs
    const popularRoutes = await Ride.aggregate([
        {
            $match: {
                status: { $in: ['ACTIVE', 'IN_PROGRESS', 'COMPLETED'] },
                createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } // Last 90 days
            }
        },
        {
            $group: {
                _id: {
                    startName: '$route.start.name',
                    destName: '$route.destination.name'
                },
                count: { $sum: 1 },
                avgPrice: { $avg: '$pricing.pricePerSeat' },
                avgDistance: { $avg: '$route.distance' },
                startCoords: { $first: '$route.start.coordinates' },
                destCoords: { $first: '$route.destination.coordinates' },
                lastRide: { $max: '$schedule.departureDateTime' }
            }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
            $project: {
                _id: 0,
                origin: '$_id.startName',
                destination: '$_id.destName',
                rideCount: '$count',
                avgPrice: { $round: ['$avgPrice', 0] },
                avgDistance: { $round: ['$avgDistance', 1] },
                startCoordinates: '$startCoords',
                destinationCoordinates: '$destCoords',
                lastRide: 1
            }
        }
    ]);

    res.json({
        success: true,
        routes: popularRoutes
    });
});

// ============================================
// API FUNCTION ALIASES (for route compatibility)
// ============================================

// Alias for getMyRides
exports.getMyRides = exports.showMyRides;

// Alias for getRideDetails
exports.getRideDetails = exports.showRideDetails;

// ============================================================
// F1: Recurring Rides
// ============================================================
exports.createRecurringRide = asyncHandler(async (req, res) => {
    const { rideData, recurringDays, endDate } = req.body;
    // recurringDays = array of day numbers: 0=Sun, 1=Mon, etc.
    // endDate = last date to create rides for

    if (!recurringDays?.length) {
        return res.status(400).json({ success: false, message: 'Recurring days are required (0=Sun through 6=Sat)' });
    }

    const user = req.user;
    if (user.verificationStatus !== 'VERIFIED') {
        return res.status(403).json({ success: false, message: 'Document verification required' });
    }

    const vehicle = user.vehicles.find(v => v._id.toString() === rideData.vehicleId);
    if (!vehicle || vehicle.status !== 'APPROVED') {
        return res.status(400).json({ success: false, message: 'Valid approved vehicle required' });
    }

    const end = endDate ? new Date(endDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days
    const MAX_RECURRING_RIDES = 90; // Safety cap
    const createdRides = [];
    const baseDate = new Date(rideData.departureTime);

    if (Number.isNaN(baseDate.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid recurring departure time' });
    }

    if (end < baseDate) {
        return res.status(400).json({ success: false, message: 'Recurring end date must be on or after the first ride date' });
    }

    const baseHour = baseDate.getHours();
    const baseMinute = baseDate.getMinutes();
    const { route } = rideData.route
        ? { route: rideData.route }
        : await buildRideRoute({
            originCoordinates: rideData.originCoordinates,
            destinationCoordinates: rideData.destinationCoordinates,
            fromLocation: rideData.fromLocation,
            toLocation: rideData.toLocation,
            intermediateStops: rideData.intermediateStops
        });
    const preferences = rideData.preferences || buildRidePreferences(user, {
        ladiesOnly: rideData.ladiesOnly,
        smokingAllowed: rideData.smokingAllowed,
        petsAllowed: rideData.petsAllowed,
        luggageAllowed: rideData.luggageAllowed
    });

    let currentDate = new Date(baseDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= end && createdRides.length < MAX_RECURRING_RIDES) {
        if (recurringDays.includes(currentDate.getDay())) {
            const departureDate = new Date(currentDate);
            departureDate.setHours(baseHour, baseMinute, 0, 0);

            if (departureDate <= new Date()) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }

            const ride = await Ride.create({
                rider: user._id,
                vehicle: vehicle._id,
                route,
                schedule: {
                    date: departureDate,
                    time: `${baseHour.toString().padStart(2, '0')}:${baseMinute.toString().padStart(2, '0')}`,
                    departureDateTime: departureDate,
                    flexibleTiming: false,
                    returnTrip: { enabled: false }
                },
                recurring: {
                    isRecurring: true,
                    pattern: 'CUSTOM',
                    daysOfWeek: recurringDays,
                    endDate: end
                },
                pricing: {
                    pricePerSeat: parseFloat(rideData.pricePerSeat),
                    totalSeats: parseInt(rideData.availableSeats),
                    availableSeats: parseInt(rideData.availableSeats)
                },
                preferences,
                specialInstructions: rideData.notes || '',
                status: 'ACTIVE'
            });
            createdRides.push(ride);
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (createdRides.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No recurring rides matched the selected days and date range'
        });
    }

    // Update user stats
    await User.findByIdAndUpdate(user._id, {
        $inc: { 'statistics.totalRidesPosted': createdRides.length }
    });

    res.status(201).json({
        success: true,
        message: `Created ${createdRides.length} recurring rides`,
        count: createdRides.length,
        rides: createdRides.map(r => ({ _id: r._id, date: r.schedule.departureDateTime }))
    });
});

// ============================================================
// F6: Ride Recommendations
// ============================================================
exports.getRecommendations = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // Get user's past rides to find frequent routes
    const pastBookings = await Booking.find({
        passenger: userId,
        status: 'COMPLETED'
    }).populate('ride', 'route.start route.destination').sort({ createdAt: -1 }).limit(20).lean();

    const pastRides = await Ride.find({
        rider: userId,
        status: 'COMPLETED'
    }).select('route.start route.destination').sort({ createdAt: -1 }).limit(20).lean();

    // Extract frequent origin/destination pairs
    const routeFreq = {};
    [...pastBookings.map(b => b.ride), ...pastRides].filter(Boolean).forEach(r => {
        const key = `${r.route?.start?.name || 'Unknown'} -> ${r.route?.destination?.name || 'Unknown'}`;
        routeFreq[key] = (routeFreq[key] || 0) + 1;
    });

    // Find most frequent routes
    const topRoutes = Object.entries(routeFreq).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Get recommendations: upcoming rides on user's frequent routes
    const now = new Date();
    let recommendations = [];

    for (const [routeKey] of topRoutes) {
        const [startName] = routeKey.split(' -> ');
        const matchingRides = await Ride.find({
            'route.start.name': { $regex: startName.substring(0, 10), $options: 'i' },
            'schedule.departureDateTime': { $gte: now },
            status: 'ACTIVE',
            rider: { $ne: userId }
        })
            .populate('rider', 'profile.firstName profile.lastName profile.photo rating')
            .limit(3)
            .lean();

        recommendations.push(...matchingRides.map(r => ({
            ...r,
            recommendationReason: `Based on your frequent route: ${routeKey}`,
            routeFrequency: routeFreq[routeKey]
        })));
    }

    // Also add popular rides nearby if not enough recommendations
    if (recommendations.length < 5) {
        const popular = await Ride.find({
            'schedule.departureDateTime': { $gte: now },
            status: 'ACTIVE',
            rider: { $ne: userId }
        })
            .populate('rider', 'profile.firstName profile.lastName profile.photo rating')
            .sort({ views: -1 })
            .limit(5 - recommendations.length)
            .lean();

        recommendations.push(...popular.map(r => ({
            ...r,
            recommendationReason: 'Popular ride in your area'
        })));
    }

    res.json({
        success: true,
        recommendations,
        frequentRoutes: topRoutes.map(([route, count]) => ({ route, count }))
    });
});
