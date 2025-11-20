/**
 * Ride Controller
 * Handles ride posting, searching, matching, and management
 */

const Ride = require('../models/Ride');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');
const routeMatching = require('../utils/routeMatching');
const carbonCalculator = require('../utils/carbonCalculator');
const autoReassignment = require('../utils/autoReassignment');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const helpers = require('../utils/helpers');
const axios = require('axios');
const { getUserDisplay } = require('../utils/userUtils');

/**
 * Show post ride page
 */
exports.showPostRidePage = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    // Early exit if not a rider
    if (user.role === 'DRIVER' || user.role !== 'RIDER') {
        req.flash('error', 'Only riders can post rides');
        return res.redirect('/user/dashboard');
    }

    // Validate profile completeness
    const hasVehicles = Array.isArray(user.vehicles) && user.vehicles.length > 0;
    if (!hasVehicles) {
        req.flash('warning', 'Please complete your profile and add vehicle details first');
        return res.redirect('/user/complete-profile');
    }

    // Validate document upload
    const licenseUploaded = user.documents?.driverLicense?.frontImage;
    const idUploaded = user.documents?.governmentId?.frontImage;
    if (!(licenseUploaded && idUploaded)) {
        req.flash('warning', 'Please upload your verification documents first');
        return res.redirect('/user/upload-documents');
    }

    // Check verification status
    const isVerified = user.verificationStatus === 'VERIFIED';
    if (!isVerified) {
        return res.render('error', {
            title: 'Verification Pending',
            message: 'Your documents are under review. You can post rides once admin approves your verification.'
        });
    }

    // Collect approved vehicles
    const approvedVehicles = (user.vehicles || []).reduce((acc, v) => {
        if (v.status === 'APPROVED') acc.push(v);
        return acc;
    }, []);

    // If none approved
    if (!approvedVehicles.length) {
        return res.render('error', {
            title: 'No Approved Vehicles',
            message: 'You need at least one approved vehicle to post rides. Please wait for admin to verify your vehicle, or contact support if this is taking too long.'
        });
    }

    // Render post-ride page
    res.render('rides/post-ride', {
        title: 'Post a Ride - LANE Carpool',
        user,
        vehicles: approvedVehicles
    });
});


/**
 * Post a new ride
 */
exports.postRide = asyncHandler(async (req, res) => {
    const user = req.user;
    
    console.log('Post Ride Request Body:', JSON.stringify(req.body, null, 2));

    if (user.verificationStatus !== 'VERIFIED') {
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
        ladiesOnly,
        petsAllowed,
        smokingAllowed,
        luggageAllowed,
        notes
    } = req.body;

    console.log('Vehicle ID:', vehicleId);
    console.log('User vehicles:', user.vehicles);

    // Get vehicle details
    const vehicle = user.vehicles.find(v => v._id.toString() === vehicleId);
    if (!vehicle) {
        console.log('Vehicle not found');
        return res.status(400).json({
            success: false,
            message: 'Vehicle not found'
        });
    }
    
    if (vehicle.status !== 'APPROVED') {
        console.log('Vehicle not approved, status:', vehicle.status);
        return res.status(400).json({
            success: false,
            message: 'Vehicle is not approved yet'
        });
    }

    // Parse date from ISO string
    const departureDate = new Date(departureTime);
    const hours = departureDate.getHours().toString().padStart(2, '0');
    const minutes = departureDate.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;

    // Calculate route using OSRM
    const fromCoords = originCoordinates.coordinates;
    const toCoords = destinationCoordinates.coordinates;
    
    console.log('🗺️ [Route Calculation] Starting route calculation');
    console.log('  From:', fromLocation);
    console.log('  To:', toLocation);
    console.log('  From coords:', fromCoords, '[lon, lat]');
    console.log('  To coords:', toCoords, '[lon, lat]');
    
    // Build waypoints: Start → Destination
    const waypoints = [fromCoords, toCoords];
    
    console.log('  Total waypoints:', waypoints.length);
    
    let distance = 0;
    let duration = 0;
    let geometry = null;
    
    try {
        console.log('  Calling OSRM API with', waypoints.length, 'waypoints...');
        const routeData = await routeMatching.getRoute(waypoints);
        // getRoute already returns distance in km and duration in minutes
        distance = routeData.distance; // Already in km
        duration = routeData.duration; // Already in minutes
        geometry = routeData.geometry;
        
        console.log('✅ [Route Calculation] OSRM Success!');
        console.log('  Total Distance:', distance.toFixed(2), 'km');
        console.log('  Total Duration:', Math.round(duration), 'mins');
        console.log('  Geometry points:', geometry?.coordinates?.length || 0);
    } catch (error) {
        console.error('❌ [Route Calculation] OSRM Failed:', error.message);
        console.log('🔄 [Route Calculation] Using fallback calculation (Haversine formula)');
        
        // Fallback to approximate calculation - sum all segments
        distance = 0;
        for (let i = 0; i < waypoints.length - 1; i++) {
            const R = 6371; // Earth's radius in km
            const dLat = (waypoints[i+1][1] - waypoints[i][1]) * Math.PI / 180;
            const dLon = (waypoints[i+1][0] - waypoints[i][0]) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(waypoints[i][1] * Math.PI / 180) * Math.cos(waypoints[i+1][1] * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            distance += R * c;
        }
        duration = (distance / 60) * 60; // Rough estimate: 60 km/h average speed
        geometry = {
            type: 'LineString',
            coordinates: waypoints
        };
        
        console.log('✅ [Route Calculation] Fallback calculation complete');
        console.log('  Distance:', distance.toFixed(2), 'km');
        console.log('  Duration:', Math.round(duration), 'mins (estimated at 60 km/h)');
    }

    // Create ride with correct schema structure
    // ✅ GET USER'S DEFAULT PREFERENCES
    const userPrefs = user.preferences || {};
    const userRideComfort = userPrefs.rideComfort || {};
    
    // Use form values if provided, otherwise use user's default preferences
    const useSmokingAllowed = smokingAllowed !== undefined 
        ? (smokingAllowed === 'true' || smokingAllowed === true)
        : (userRideComfort.smokingAllowed === true);
    const usePetsAllowed = petsAllowed !== undefined 
        ? (petsAllowed === 'true' || petsAllowed === true)
        : (userRideComfort.petsAllowed === true);

const rideData = {
    rider: user._id,
    vehicle: vehicle._id,
    route: {
        start: {
            name: fromLocation,
            address: originCoordinates.address || fromLocation,
            coordinates: fromCoords
        },
        destination: {
            name: toLocation,
            address: destinationCoordinates.address || toLocation,
            coordinates: toCoords
        },
        geometry: geometry,
        distance: distance,
        duration: duration
    },
    schedule: {
        date: departureDate,
        time: timeString,
        departureDateTime: departureDate,
        flexibleTiming: false
    },
    pricing: {
        pricePerSeat: parseFloat(pricePerSeat),
        totalSeats: parseInt(availableSeats),
        availableSeats: parseInt(availableSeats)
    },
    preferences: {
        gender: ladiesOnly ? 'FEMALE_ONLY' : 'ANY',
        autoAcceptBookings: false, // All bookings require rider approval
        smoking: useSmokingAllowed,
        pets: usePetsAllowed,
        luggage: luggageAllowed ? 'LARGE_LUGGAGE' : 'MEDIUM_BAG',
        // ✅ COPY RIDER'S MUSIC AND CONVERSATION PREFERENCES
        music: userRideComfort.musicPreference || 'OPEN_TO_REQUESTS',
        conversation: userRideComfort.conversationPreference || 'DEPENDS_ON_MOOD'
    },
    specialInstructions: notes || '',
    status: 'ACTIVE'
};

// Step 2: Create the ride
const ride = await Ride.create(rideData);


    console.log('Ride created successfully:', ride._id);

    res.status(201).json({
        success: true,
        message: 'Ride posted successfully',
        ride,
        redirectUrl: `/rides/my-rides`
    });
});

// Helper function for distance calculation
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Show search rides page
 */
exports.showSearchPage = (req, res) => {
    res.render('rides/search', {
        title: 'Search Rides - LANE Carpool',
        user: req.user
    });
};

/**
 * Search rides
 * ✅ RESPECTS: Comfort preferences (smoking, pets, music), gender, verifiedUsersOnly
 */
exports.searchRides = asyncHandler(async (req, res) => {
    const { origin, destination, date, seats, smokingAllowed, petsAllowed, verifiedOnly, genderPreference } = req.query;

    console.log('🔍 [Search Rides] ========== NEW SEARCH REQUEST ==========');
    console.log('  Origin:', origin);
    console.log('  Destination:', destination);
    console.log('  Date:', date);
    console.log('  Seats:', seats);

    if (!origin || !destination) {
        throw new AppError('Origin and destination are required', 400);
    }

    // Parse coordinates
    const originCoords = JSON.parse(origin);
    const destCoords = JSON.parse(destination);

    console.log('  Parsed origin coords:', originCoords.coordinates);
    console.log('  Parsed dest coords:', destCoords.coordinates);

    // Parse date - search for the ENTIRE DAY
    const searchDate = date ? new Date(date) : new Date();
    // Set to start of day
    searchDate.setHours(0, 0, 0, 0);
    const endOfDay = new Date(searchDate);
    endOfDay.setHours(23, 59, 59, 999);

    console.log('  Search date range:', searchDate.toISOString(), 'to', endOfDay.toISOString());

    // Build base query
    const baseQuery = {
        'schedule.departureDateTime': { $gte: searchDate, $lte: endOfDay },
        'pricing.availableSeats': { $gte: parseInt(seats) || 1 },
        status: 'ACTIVE'
    };

    console.log('  Base query:', JSON.stringify(baseQuery, null, 2));

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
    .populate('rider', 'profile.firstName profile.lastName profile.photo profile.gender rating statistics name fullName displayName verificationStatus preferences.booking preferences.rideComfort preferences.privacy')
    .populate('vehicle', 'make model type')
    .lean();

    console.log('📊 [Search Rides] Found', rides.length, 'rides matching date/seats/status criteria');
    
    // Debug: Log all found rides
    rides.forEach((ride, idx) => {
        console.log(`  Ride ${idx + 1}: ${ride._id}`);
        console.log(`    Status: ${ride.status}`);
        console.log(`    Departure: ${ride.schedule?.departureDateTime}`);
        console.log(`    Available seats: ${ride.pricing?.availableSeats}`);
        console.log(`    Route: ${ride.route?.start?.name} → ${ride.route?.destination?.name}`);
        console.log(`    Start coords:`, ride.route?.start?.coordinates);
        console.log(`    End coords:`, ride.route?.destination?.coordinates);
        console.log(`    Geometry points:`, ride.route?.geometry?.coordinates?.length || 0);
    });

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

    console.log('After gender filter:', rides.length, 'rides');

    // Filter out rides without proper route geometry and log reasons
    const ridesWithValidGeometry = rides.filter(ride => {
        if (!ride.route) {
            console.log(`⚠️  Ride ${ride._id} skipped: No route field`);
            return false;
        }
        if (!ride.route.geometry) {
            console.log(`⚠️  Ride ${ride._id} skipped: No geometry in route`);
            return false;
        }
        if (!ride.route.geometry.coordinates) {
            console.log(`⚠️  Ride ${ride._id} skipped: No coordinates in geometry`);
            return false;
        }
        if (ride.route.geometry.coordinates.length < 2) {
            console.log(`⚠️  Ride ${ride._id} skipped: Insufficient coordinates (${ride.route.geometry.coordinates.length})`);
            return false;
        }
        console.log(`✓ Ride ${ride._id} has ${ride.route.geometry.coordinates.length} route points`);
        return true;
    });

    console.log(`Valid rides with geometry: ${ridesWithValidGeometry.length} / ${rides.length}`);

    // Match routes using intelligent algorithm
    const passengerRoute = {
        pickup: originCoords.coordinates,
        dropoff: destCoords.coordinates
    };

    console.log('🔍 [Route Matching] Passenger route:', passengerRoute);

    const matchedRides = routeMatching.findMatchingRides(
        passengerRoute,
        ridesWithValidGeometry,
        20
    );

    console.log('✅ [Search Rides] Matched rides:', matchedRides.length);
    matchedRides.forEach((match, idx) => {
        console.log(`  Match ${idx + 1}: Score ${match.matchDetails.matchScore}, Quality: ${match.matchDetails.matchQuality}`);
    });

    // Format results
    const results = matchedRides.map(match => {
        // Compute safe rider display details (works with plain objects from .lean())
        const riderDisplay = getUserDisplay(match.ride?.rider || {});
        const carbonData = carbonCalculator.calculateCarbonSaved(
            match.matchDetails.segmentDistance,
            match.ride.vehicle?.type || 'SEDAN',
            parseInt(seats) || 1
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
        const filteredRide = { ...match.ride, rider: riderData };
        
        return {
            ride: filteredRide,
            matchScore: match.matchDetails.matchScore,
            matchQuality: match.matchDetails.matchQuality,
            detour: match.matchDetails.detourPercent,
            distance: match.matchDetails.segmentDistance,
            directDistance: match.matchDetails.directDistance,
            pickupPoint: match.matchDetails.pickupPoint,
            dropoffPoint: match.matchDetails.dropoffPoint,
            price: (match.ride.pricing?.pricePerSeat || 0) * (parseInt(seats) || 1),
            carbonSaved: carbonData.totalSaved || 0, // Send just the number
            carbonData: carbonData, // Send full object for detailed display if needed
            riderDisplayName: riderDisplay.name,
            riderPhoto: riderDisplay.photo,
            riderInitials: riderDisplay.initials
        };
    });

    console.log('Sending response with', results.length, 'rides');
    console.log('First result sample:', results[0] ? {
        rideId: results[0].ride._id,
        hasRider: !!results[0].ride.rider,
        hasVehicle: !!results[0].ride.vehicle,
        matchQuality: results[0].matchQuality,
        price: results[0].price,
        carbonSaved: results[0].carbonSaved,
        carbonSavedType: typeof results[0].carbonSaved
    } : 'No results');

    // Disable caching for search results
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    });

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
 * Show edit ride page
 */
exports.showEditRidePage = asyncHandler(async (req, res) => {
    const { rideId } = req.params;
    const user = req.user;

    const ride = await Ride.findById(rideId)
        .populate('rider', 'profile.firstName profile.lastName name vehicles');

    if (!ride) {
        req.flash('error', 'Ride not found');
        return res.redirect('/rides/my-rides');
    }

    if (ride.rider._id.toString() !== user._id.toString()) {
        req.flash('error', 'Not authorized to edit this ride');
        return res.redirect('/rides/my-rides');
    }

    if (ride.status !== 'ACTIVE') {
        req.flash('error', 'Cannot edit ride in current status');
        return res.redirect('/rides/my-rides');
    }

    // Check if ride has any active bookings
    const activeBookings = await Booking.countDocuments({
        ride: ride._id,
        status: { $nin: ['CANCELLED', 'REJECTED', 'EXPIRED'] }
    });

    if (activeBookings > 0) {
        req.flash('error', 'Cannot edit ride with active bookings');
        return res.redirect('/rides/my-rides');
    }

    // Get approved vehicles for the dropdown
    const approvedVehicles = user.vehicles.filter(v => v.status === 'APPROVED');

    res.render('rides/edit-ride', {
        title: 'Edit Ride - LANE Carpool',
        user,
        ride,
        vehicles: approvedVehicles
    });
});

/**
 * Update ride
 */
exports.updateRide = asyncHandler(async (req, res) => {
    const { rideId } = req.params;
    
    console.log('📝 [Update Ride] Request received for ride:', rideId);
    console.log('📝 [Update Ride] Request body:', JSON.stringify(req.body, null, 2));
    
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

    console.log('🚫 [Cancel Ride] Starting cancellation process for ride:', rideId);
    console.log('   Reason:', reason || 'No reason provided');

    // Update ride status
    ride.status = 'CANCELLED';
    ride.cancellation = {
        cancelled: true,
        cancelledBy: req.user._id,
        cancelledAt: new Date(),
        reason: reason || 'No reason provided'
    };

    await ride.save();

    // Find all affected bookings
    const affectedBookings = await Booking.find({
        ride: ride._id,
        status: { $in: ['CONFIRMED', 'PENDING'] }
    }).populate('passenger', 'name profile email phone');

    console.log(`   Found ${affectedBookings.length} affected bookings`);

    let reassignmentResults = null;

    // Trigger auto-reassignment if there are affected bookings
    if (affectedBookings.length > 0) {
        console.log('🔄 [Cancel Ride] Initiating auto-reassignment...');
        
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
                    title: '❌ Ride Cancelled',
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

    console.log('✅ [Cancel Ride] Cancellation complete');
    console.log('   Reassignment results:', reassignmentResults);

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

    console.log('✅ [Delete Ride] Ride deleted:', rideId);

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

    console.log('✅ [Start Ride] Ride started:', ride._id);

    // Get all CONFIRMED bookings and update to PICKUP_PENDING
    const bookingsToStart = await Booking.find({ 
        ride: ride._id, 
        status: 'CONFIRMED' 
    }).populate('passenger', 'profile.firstName profile.lastName name email phone');

    console.log(`🔵 [Start Ride] Found ${bookingsToStart.length} bookings to start`);

    // ⭐ NOW GENERATE PICKUP OTPs for all passengers (no expiry)
    const otpService = require('../utils/otpService');
    const Notification = require('../models/Notification');
    const emailService = require('../utils/emailService');
    
    for (const booking of bookingsToStart) {
        // ⭐ GENERATE PICKUP OTP (valid indefinitely)
        const pickupOTP = otpService.generateOTPWithExpiry(); // No expiry limit
        
        booking.status = 'PICKUP_PENDING';
        booking.verification.pickup = pickupOTP;
        booking.journey.started = false; // Will be true after pickup verification
        await booking.save();

        console.log(`✅ [Start Ride] Booking ${booking._id} marked as PICKUP_PENDING`);
        console.log(`🔑 [Start Ride] Pickup OTP generated: ${otpService.maskOTP(pickupOTP.code)}`);

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
            console.log(`📡 [Start Ride] Real-time notification sent to passenger ${booking.passenger._id}`);
        }

        // Create notification in database
        await Notification.create({
            user: booking.passenger._id,
            type: 'RIDE_STARTED',
            title: 'Rider On The Way! 🚗',
            message: `${riderName} is coming to pick you up. Your pickup OTP: ${pickupOTP.code}`,
            data: {
                bookingId: booking._id,
                rideId: ride._id,
                riderId: ride.rider._id,
                pickupOTP: pickupOTP.code
            }
        });
        console.log(`📧 [Start Ride] Database notification created for passenger ${booking.passenger._id}`);

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
            console.log(`📧 [Start Ride] Email sent to ${booking.passenger.email}`);
        } catch (emailError) {
            console.error('❌ [Start Ride] Email error:', emailError.message);
        }
    }

    console.log('✅ [Start Ride] All bookings synced and passengers notified with PICKUP OTPs');

    // Notify rider's room about ride status update
    const io = req.app.get('io');
    if (io) {
        io.to(`ride-${ride._id}`).emit('ride-status-updated', {
            rideId: ride._id,
            status: 'IN_PROGRESS',
            message: 'Ride started! You can now pick up passengers.',
            timestamp: new Date()
        });
        console.log(`📡 [Start Ride] Ride status update emitted to ride room`);
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
            status: { $in: ['PENDING','CONFIRMED','PICKUP_PENDING','PICKED_UP','IN_TRANSIT','DROPOFF_PENDING','DROPPED_OFF'] }
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

    console.log('✅ [Ride Complete] Ride marked as COMPLETED:', ride._id);

    // Update rider statistics
    const rider = await User.findById(req.user._id);
    if (rider && rider.statistics) {
        rider.statistics.completedRides = (rider.statistics.completedRides || 0) + 1;
        rider.statistics.totalDistance = (rider.statistics.totalDistance || 0) + (ride.route.distance || 0);
        rider.statistics.carbonSaved = (rider.statistics.carbonSaved || 0) + (ride.carbon?.carbonSaved || 0);
        await rider.save();
        console.log('✅ [Ride Complete] Rider statistics updated');
    }

    // ⭐ FIX: Get all DROPPED_OFF bookings (not IN_PROGRESS!)
    const bookingsToComplete = await Booking.find({ 
        ride: ride._id, 
        status: 'DROPPED_OFF'  // ✅ FIXED: Look for DROPPED_OFF bookings
    }).populate('passenger', 'profile.firstName profile.lastName name email phone statistics');

    console.log(`🔵 [Ride Complete] Found ${bookingsToComplete.length} DROPPED_OFF bookings to complete`);

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
            
            // Calculate rider earnings (deduct platform fee)
            const platformFeePercent = 0.10; // 10% platform fee
            const riderEarnings = booking.totalPrice * (1 - platformFeePercent);
            
            // Update ride total earnings
            ride.pricing.totalEarnings = (ride.pricing.totalEarnings || 0) + riderEarnings;
            
            console.log(`💰 [Ride Complete] Payment processed: ₹${booking.totalPrice}, Rider gets: ₹${riderEarnings}`);
        }
        
        await booking.save();

        console.log(`✅ [Ride Complete] Booking ${booking._id}: DROPPED_OFF → COMPLETED`);

        // ⭐ NOW update passenger statistics (moved from dropoff to completion)
        const passenger = await User.findById(booking.passenger._id);
        if (passenger && passenger.statistics) {
            // Only increment if not already counted
            if (!booking._previouslyCountedInStats) {
                passenger.statistics.completedRides = (passenger.statistics.completedRides || 0) + 1;
                passenger.statistics.totalDistance = (passenger.statistics.totalDistance || 0) + (booking.journey.distance || ride.route.distance || 0);
                await passenger.save();
                console.log(`✅ [Ride Complete] Passenger ${passenger._id} statistics updated`);
            }
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
            console.log(`📡 [Ride Complete] Real-time notification sent to passenger ${booking.passenger._id}`);
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
        console.log(`📧 [Ride Complete] Database notification created for passenger ${booking.passenger._id}`);
    }

    // ⭐ Save ride with updated earnings
    await ride.save();

    console.log('✅ [Ride Complete] All bookings synced and passengers notified');
    console.log(`💰 [Ride Complete] Total ride earnings: ₹${ride.pricing.totalEarnings || 0}`);

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
        // TODO: Send deviation alert
        console.log('Route deviation detected:', deviation);
    }

    await ride.save();

    res.status(200).json({
        success: true,
        location: ride.tracking.currentLocation,
        deviation
    });
});

// ============================================
// API FUNCTION ALIASES (for route compatibility)
// ============================================

// Alias for getMyRides
exports.getMyRides = exports.showMyRides;

// Alias for getRideDetails
exports.getRideDetails = exports.showRideDetails;
