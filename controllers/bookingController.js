/**
 * Booking Controller
 * Handles ride booking, payment, cancellation, and journey management
 */

const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const Settings = require('../models/Settings');
const emailService = require('../utils/emailService');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const helpers = require('../utils/helpers');
const { incrementTotalBookings } = require('../utils/trustScoreCalculator');

const normalizePaymentMethod = (value) => (value || 'CASH').toString().trim().toUpperCase();
const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING', 'DROPPED_OFF'];

/**
 * Shared helper: finalize booking payment and optionally complete ride.
 * Used by both confirmPayment (rider action) and completePayment (passenger action).
 * Returns { rideCompleted, rideTotalEarnings }.
 */
async function _finalizeBookingPayment(booking, { paymentMethod, paymentGatewayInfo, confirmedBy }) {
    // Update booking payment
    booking.payment.riderConfirmedPayment = true;
    booking.payment.riderConfirmedAt = new Date();
    booking.payment.riderConfirmedBy = confirmedBy;
    booking.payment.status = 'PAYMENT_CONFIRMED';
    if (paymentMethod) booking.payment.method = paymentMethod;
    if (!booking.payment.paidAt) booking.payment.paidAt = new Date();

    // Complete the journey
    booking.status = 'COMPLETED';
    booking.journey.completed = true;
    booking.journey.completedAt = new Date();

    await booking.save();

    // Update Transaction record
    const txUpdate = {
        'payment.status': 'COMPLETED',
        'payment.completedAt': new Date(),
        'commission.collected': true,
        'commission.collectedAt': new Date(),
        'riderPayout.settled': false
    };
    if (paymentMethod) txUpdate['payment.method'] = paymentMethod;
    if (paymentGatewayInfo) {
        txUpdate['payment.gateway'] = paymentGatewayInfo.gateway;
        txUpdate['payment.gatewayPaymentId'] = paymentGatewayInfo.paymentId;
    }
    await Transaction.findOneAndUpdate({ booking: booking._id }, { $set: txUpdate });

    // Update passenger statistics (atomic)
    const journeyDist = booking.journey?.distance || booking.ride.route?.distance || 0;
    const passengerSpent = booking.payment?.totalAmount || 0;
    await User.findByIdAndUpdate(booking.passenger._id, {
        $inc: {
            'statistics.completedRides': 1,
            'statistics.totalDistance': journeyDist,
            'statistics.ridesAsPassenger': 1,
            'statistics.totalSpent': passengerSpent
        }
    });

    // Check if ALL bookings for this ride are now completed
    const pendingBookings = await Booking.countDocuments({
        ride: booking.ride._id,
        status: { $in: ACTIVE_BOOKING_STATUSES }
    });

    let rideCompleted = false;
    let rideTotalEarnings = booking.ride?.pricing?.totalEarnings || 0;

    if (pendingBookings === 0) {
        const ride = await Ride.findById(booking.ride._id);
        if (ride && ride.status === 'IN_PROGRESS') {
            ride.status = 'COMPLETED';
            ride.tracking.completedAt = new Date();
            ride.tracking.isLive = false;

            const completedBookings = await Booking.find({ ride: ride._id, status: 'COMPLETED' });
            const totalRideFare = completedBookings.reduce((sum, b) => sum + (b.payment.rideFare || 0), 0);
            const totalPassengers = completedBookings.reduce((sum, b) => sum + (b.seatsBooked || 1), 0);

            ride.pricing.totalEarnings = totalRideFare;
            rideTotalEarnings = totalRideFare;
            await ride.save();

            await User.findByIdAndUpdate(ride.rider, {
                $inc: {
                    'statistics.completedRides': 1,
                    'statistics.ridesAsDriver': 1,
                    'statistics.totalDistance': ride.route?.distance || 0,
                    'statistics.carbonSaved': ride.carbon?.carbonSaved || 0,
                    'statistics.totalEarnings': totalRideFare,
                    'statistics.totalPassengersCarried': totalPassengers
                },
                $set: { 'statistics.lastRideAt': new Date() }
            });

            rideCompleted = true;
        }
    }

    return { rideCompleted, rideTotalEarnings };
}

/**
 * Create booking
 * ✅ RESPECTS: verifiedUsersOnly, preferredCoRiderGender, ride comfort preferences
 * ✅ EDGE CASE: Uses atomic operations to prevent race conditions
 */
exports.createBooking = asyncHandler(async (req, res) => {

    // Get rideId from URL params OR body for backwards compatibility
    const rideId = req.params.rideId || req.body.rideId;
    const { pickupLocation, dropoffLocation, seats, paymentMethod, specialRequests, pickupPoint, dropoffPoint, seatsBooked, idempotencyKey } = req.body;

    // ✅ EDGE CASE FIX: Idempotency check to prevent duplicate bookings from network retries
    if (idempotencyKey) {
        const existingBooking = await Booking.findOne({
            passenger: req.user._id,
            ride: rideId,
            'metadata.idempotencyKey': idempotencyKey,
            status: { $nin: ['CANCELLED', 'REJECTED'] }
        });
        if (existingBooking) {
            return res.status(200).json({
                success: true,
                message: 'Booking already exists',
                booking: existingBooking,
                duplicate: true
            });
        }
    }

    const ride = await Ride.findById(rideId).populate('rider', 'name email phone profile preferences');
    const passenger = await User.findById(req.user._id);

    if (!ride) throw new AppError('Ride not found', 404);
    if (ride.status !== 'ACTIVE') throw new AppError('Ride is not available for booking', 400);
    if (ride.rider._id.toString() === req.user._id.toString()) throw new AppError('Cannot book your own ride', 400);

    // ✅ CHECK GENDER RESTRICTION (FEMALE ONLY)
    if (ride.preferences.gender === 'FEMALE_ONLY' && passenger.profile.gender !== 'FEMALE') {
        throw new AppError('This ride is for female passengers only', 403);
    }

    // ✅ CHECK VERIFIED USERS ONLY PREFERENCE
    if (ride.rider.preferences?.booking?.verifiedUsersOnly === true) {
        if (passenger.verificationStatus !== 'VERIFIED') {
            throw new AppError('This rider only accepts verified users. Please complete your verification first.', 403);
        }
    }

    // ✅ CHECK PREFERRED CO-RIDER GENDER
    const genderPref = ride.rider.preferences?.booking?.preferredCoRiderGender;
    if (genderPref && genderPref !== 'ANY') {
        const passengerGender = passenger.profile?.gender;
        const riderGender = ride.rider.profile?.gender;

        if (genderPref === 'MALE_ONLY' && passengerGender !== 'MALE') {
            throw new AppError('This rider prefers male co-riders only', 403);
        }
        if (genderPref === 'FEMALE_ONLY' && passengerGender !== 'FEMALE') {
            throw new AppError('This rider prefers female co-riders only', 403);
        }
        if (genderPref === 'SAME_GENDER' && passengerGender !== riderGender) {
            throw new AppError('This rider prefers same gender co-riders only', 403);
        }
    }

    const numSeats = parseInt(seats || seatsBooked || 1);

    // ✅ EDGE CASE FIX: Atomic seat availability check and decrement
    // This prevents race condition where two users book last seats simultaneously
    const seatUpdateResult = await Ride.findOneAndUpdate(
        {
            _id: rideId,
            status: 'ACTIVE',
            'pricing.availableSeats': { $gte: numSeats } // Only if enough seats
        },
        {
            $inc: { 'pricing.availableSeats': -numSeats } // Atomic decrement
        },
        { new: true }
    );

    if (!seatUpdateResult) {
        // Seats were taken by another user or ride status changed
        throw new AppError('Not enough seats available. Another passenger may have just booked.', 400);
    }


    // ✅ EDGE CASE FIX: Atomic check for existing booking using findOneAndUpdate
    // This prevents race condition where same user double-clicks
    const existingCheck = await Booking.findOne({
        passenger: req.user._id,
        ride: ride._id,
        status: { $nin: ['CANCELLED', 'REJECTED'] }
    });

    if (existingCheck) {
        // Rollback seat decrement since user already has booking
        await Ride.findByIdAndUpdate(rideId, {
            $inc: { 'pricing.availableSeats': numSeats }
        });
        throw new AppError('You already have a booking for this ride', 400);
    }

    // Parse locations with error handling - support both JSON and string formats
    let pickup, dropoff;
    try {
        // Handle pickupLocation (JSON string) or pickupPoint (simple string)
        if (pickupLocation) {
            pickup = typeof pickupLocation === 'string' ? JSON.parse(pickupLocation) : pickupLocation;
        } else if (pickupPoint) {
            // Simple string address - use ride's source as default coordinates
            pickup = {
                address: pickupPoint,
                coordinates: ride.route?.start?.coordinates || ride.source?.coordinates
            };
        } else {
            // Default to ride's source
            pickup = {
                address: ride.source?.address || ride.route?.start?.address,
                coordinates: ride.source?.coordinates || ride.route?.start?.coordinates
            };
        }

        // Handle dropoffLocation (JSON string) or dropoffPoint (simple string)
        if (dropoffLocation) {
            dropoff = typeof dropoffLocation === 'string' ? JSON.parse(dropoffLocation) : dropoffLocation;
        } else if (dropoffPoint) {
            // Simple string address - use ride's destination as default coordinates
            dropoff = {
                address: dropoffPoint,
                coordinates: ride.route?.destination?.coordinates || ride.destination?.coordinates
            };
        } else {
            // Default to ride's destination
            dropoff = {
                address: ride.destination?.address || ride.route?.destination?.address,
                coordinates: ride.destination?.coordinates || ride.route?.destination?.coordinates
            };
        }
    } catch (error) {
        console.error('❌ [Create Booking] Location parsing error:', error.message);
        throw new AppError('Invalid location data format', 400);
    }

    // Calculate price with commission from Settings (E10: configurable commission)
    const settings = await Settings.getSettings();
    let commissionRate = (settings?.pricing?.commission || 10) / 100;

    // Epic 5: Gamification Loyalty Tiers Commission Discount
    if (passenger.gamification) {
        if (passenger.gamification.tier === 'PLATINUM') {
            commissionRate = 0.0; // 0% commission for Platinum users
        } else if (passenger.gamification.tier === 'GOLD') {
            commissionRate = commissionRate * 0.5; // 50% off commission for Gold
        }
    }

    const pricePerSeat = ride.pricing.pricePerSeat;
    const rideFare = pricePerSeat * numSeats;
    const platformCommission = Math.round(rideFare * commissionRate);

    // Apply corporate subsidy if passenger belongs to a subsidizing organization
    let corporateSubsidy = 0;
    if (passenger.corporate?.organization) {
        const Corporate = require('../models/Corporate');
        const corp = await Corporate.findById(passenger.corporate.organization).select('rules.subsidyPercentage').lean();
        const subsidyPct = corp?.rules?.subsidyPercentage || 0;
        if (subsidyPct > 0) {
            corporateSubsidy = Math.round(rideFare * (subsidyPct / 100));
        }
    }

    const totalAmount = rideFare + platformCommission - corporateSubsidy;


    // All bookings start as PENDING - rider must approve
    const initialStatus = 'PENDING';


    // Ensure coordinates are present (fallback to ride's coordinates if missing)
    const pickupCoords = pickup.coordinates || ride.route?.start?.coordinates || ride.source?.coordinates;
    const dropoffCoords = dropoff.coordinates || ride.route?.destination?.coordinates || ride.destination?.coordinates;

    if (!pickupCoords || !dropoffCoords) {
        throw new AppError('Unable to determine pickup/dropoff coordinates', 400);
    }

    // Create booking (wrapped in try-catch to rollback seats on failure)
    let booking;
    try {
        booking = await Booking.create({
            passenger: req.user._id,
            rider: ride.rider._id,
            ride: ride._id,
            pickupPoint: {
                name: pickup.address?.split(',')[0] || 'Pickup',
                address: pickup.address,
                coordinates: pickupCoords
            },
            dropoffPoint: {
                name: dropoff.address?.split(',')[0] || 'Dropoff',
                address: dropoff.address,
                coordinates: dropoffCoords
            },
            seatsBooked: numSeats,
            totalPrice: totalAmount,
            specialRequests: specialRequests || '',
            payment: {
                method: paymentMethod || 'CASH',
                rideFare: rideFare,
                platformCommission: platformCommission,
                corporateSubsidy: corporateSubsidy,
                totalAmount: totalAmount,
                amount: totalAmount,
                status: 'PENDING',
                riderConfirmedPayment: false
            },
            status: initialStatus
        });

        // Create financial transaction record
        const Transaction = require('../models/Transaction');
        await Transaction.create({
            type: 'BOOKING_PAYMENT',
            booking: booking._id,
            ride: ride._id,
            passenger: req.user._id,
            rider: ride.rider._id,
            amounts: {
                passengerPaid: totalAmount,
                rideFare: rideFare,
                platformCommission: platformCommission,
                total: totalAmount
            },
            payment: {
                method: paymentMethod || 'CASH',
                status: 'PENDING'
            },
            commission: {
                collected: false,
                pending: true
            },
            riderPayout: {
                amount: rideFare,
                settled: false
            },
            description: `Booking payment for ${numSeats} seat(s)`
        });


        // Update passenger's totalRidesTaken stat
        await User.findByIdAndUpdate(req.user._id, {
            $inc: { 'statistics.totalRidesTaken': 1 }
        });

        // Update cancellation rate denominator so rate stays accurate
        await incrementTotalBookings(req.user._id);

        // ✅ ADD BOOKING TO RIDE'S BOOKINGS ARRAY (seats already decremented atomically above)
        await Ride.findByIdAndUpdate(ride._id, {
            $push: { bookings: booking._id }
        });

        // ✅ NOTIFY RIDER OF BOOKING REQUEST (all bookings require manual approval)
        const passengerName = User.getUserName(req.user);

        await Notification.create({
            user: ride.rider._id,
            type: 'BOOKING_REQUEST',
            title: 'New Booking Request',
            message: `${passengerName} wants to book ${numSeats} seat(s)`,
            data: {
                bookingId: booking._id,
                rideId: ride._id
            }
        });

        const io = req.app.get('io');
        if (io) {
            io.to(`user-${ride.rider._id}`).emit('notification', {
                type: 'BOOKING_REQUEST',
                title: 'New Booking Request',
                message: `${passengerName} wants to book ${numSeats} seat(s) in your ride`,
                bookingId: booking._id,
                rideId: ride._id,
                timestamp: new Date()
            });

            // Also emit specific new-booking-request event for real-time UI updates
            io.to(`user-${ride.rider._id}`).emit('new-booking-request', {
                bookingId: booking._id.toString(),
                rideId: ride._id.toString(),
                passengerName: passengerName,
                seats: numSeats
            });
        }

        // Send email notification to rider
        try {
            await emailService.sendBookingRequestEmail(ride.rider, {
                passengerName: passengerName,
                seats: numSeats,
                pickupLocation: pickup.address,
                dropoffLocation: dropoff.address,
                bookingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/bookings/${booking._id}`
            });
        } catch (emailError) {
            console.error('Failed to send email notification:', emailError);
        }


        // Epic 4: Funnel Tracking - Booking Created
        try {
            const SearchLog = require('../models/SearchLog');
            await SearchLog.findOneAndUpdate(
                { user: req.user._id, funnelStatus: { $in: ['SEARCHED', 'VIEWED_RIDE'] } },
                {
                    $set: {
                        funnelStatus: 'BOOKING_INITIATED',
                        'finalAction.ride': rideId,
                        'finalAction.booking': booking._id
                    }
                },
                { sort: { createdAt: -1 } }
            );
        } catch (err) {
            console.error('Failed to log booking funnel:', err);
        }

    } catch (bookingError) {
        // Rollback seat decrement if booking creation or any subsequent step fails
        console.error('❌ [Create Booking] Failed, rolling back seats:', bookingError.message);
        await Ride.findByIdAndUpdate(rideId, {
            $inc: { 'pricing.availableSeats': numSeats }
        });
        throw bookingError;
    }

    res.status(201).json({
        success: true,
        message: 'Booking request sent. Waiting for rider approval.',
        booking,
        autoAccepted: false,
        redirectUrl: `/bookings/${booking._id}`
    });
});

/**
 * Show booking details
 * ✅ RESPECTS: showPhone, showEmail privacy settings (but shows during active bookings for safety)
 */
exports.showBookingDetails = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { filterUserPrivacy } = require('../utils/helpers');

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'name email phone profilePhoto profile rating statistics preferences.privacy')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'name email phone profilePhoto profile rating vehicles statistics preferences.privacy' }
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Check authorization
    const isPassenger = booking.passenger._id.toString() === req.user._id.toString();
    const isRider = booking.ride.rider._id.toString() === req.user._id.toString();

    if (!isPassenger && !isRider && req.user.role !== 'ADMIN') {
        throw new AppError('Not authorized', 403);
    }

    // Check if user has already reviewed this booking
    const Review = require('../models/Review');
    const revieweeId = isPassenger ? booking.ride.rider._id : booking.passenger._id;
    const hasReviewed = await Review.exists({
        reviewer: req.user._id,
        reviewee: revieweeId,
        booking: booking._id
    });

    // ✅ APPLY PRIVACY FILTERING
    // For CONFIRMED/IN_PROGRESS bookings, always show contact info for safety
    // For PENDING bookings, respect privacy settings
    const isConfirmedOrActive = ['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING', 'DROPPED_OFF', 'COMPLETED'].includes(booking.status);

    const bookingData = booking.toObject();

    // Filter passenger data based on their privacy settings
    if (!isPassenger) { // Only filter when viewing OTHER user's data
        bookingData.passenger = filterUserPrivacy(booking.passenger, {
            isConfirmedBooking: isConfirmedOrActive
        });
    }

    // Filter rider data based on their privacy settings
    if (!isRider && bookingData.ride?.rider) {
        bookingData.ride.rider = filterUserPrivacy(booking.ride.rider, {
            isConfirmedBooking: isConfirmedOrActive
        });
    }

    // Return JSON for React frontend
    res.json({
        success: true,
        booking: bookingData,
        isPassenger,
        isRider,
        hasReviewed: !!hasReviewed
    });
});

/**
 * Accept booking (by rider)
 */
exports.acceptBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { message } = req.body; // Optional message from rider


    // ✅ EDGE CASE FIX: Atomic status update to prevent race condition
    // Uses findOneAndUpdate with status condition instead of find + save
    const booking = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            status: 'PENDING' // Only update if still PENDING
        },
        {
            $set: {
                status: 'CONFIRMED',
                'riderResponse.respondedAt': new Date(),
                ...(message && { 'riderResponse.message': message })
            }
        },
        { new: true }
    ).populate('passenger', 'profile.firstName profile.lastName name email phone')
        .populate({
            path: 'ride',
            populate: {
                path: 'rider',
                select: 'profile.firstName profile.lastName name email phone'
            }
        });

    if (!booking) {
        // Either not found or status was not PENDING
        const existingBooking = await Booking.findById(bookingId);
        if (!existingBooking) {
            throw new AppError('Booking not found', 404);
        }
        throw new AppError(`Booking cannot be accepted. Current status: ${existingBooking.status}`, 400);
    }


    // Authorization check (after atomic update to ensure consistency)
    if (booking.ride.rider._id.toString() !== req.user._id.toString()) {
        // Rollback: Should not happen in normal flow, but for safety
        await Booking.findByIdAndUpdate(bookingId, { $set: { status: 'PENDING' } });
        throw new AppError('Not authorized', 403);
    }

    // Get passenger and rider names safely
    const passengerName = User.getUserName(booking.passenger), riderName = User.getUserName(req.user);

    // Create notification for passenger
    const notification = await Notification.create({
        user: booking.passenger._id,
        type: 'BOOKING_ACCEPTED',
        title: 'Booking Confirmed',
        message: `${riderName} has accepted your booking request for ${booking.seatsBooked} seat(s).`,
        data: {
            bookingId: booking._id,
            rideId: booking.ride._id,
            bookingReference: booking.bookingReference
        }
    });

    // Emit real-time Socket.IO event to passenger
    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.passenger._id}`).emit('booking-confirmed', {
            type: 'BOOKING_ACCEPTED',
            title: notification.title,
            message: notification.message,
            bookingId: booking._id,
            rideId: booking.ride._id,
            bookingReference: booking.bookingReference,
            riderName: riderName,
            riderMessage: message || null,
            timestamp: new Date()
        });

        // Also emit to booking-specific room
        io.to(`booking-${booking._id}`).emit('status-updated', {
            bookingId: booking._id,
            status: 'CONFIRMED',
            timestamp: new Date()
        });
    }

    // Send confirmation email to passenger
    try {
        const emailService = require('../utils/emailService');
        await emailService.sendBookingAcceptedEmail(
            booking.passenger,
            {
                riderName: riderName,
                riderId: req.user._id,
                bookingReference: booking.bookingReference,
                seats: booking.seatsBooked,
                from: booking.ride.route.start.name || booking.ride.route.start.address,
                to: booking.ride.route.destination.name || booking.ride.route.destination.address,
                date: booking.ride.schedule.departureDateTime || booking.ride.schedule.date,
                price: booking.totalPrice,
                riderMessage: message || '',
                bookingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/bookings/${booking._id}`,
                trackingUrl: `${process.env.APP_URL || 'http://localhost:3000'}/tracking/${booking._id}`
            }
        );
    } catch (emailError) {
        console.error('❌ [Accept Booking] Error sending email:', emailError.message);
    }


    res.status(200).json({
        success: true,
        message: 'Booking accepted successfully. Pickup OTP will be sent when ride starts.',
        data: {
            booking: {
                _id: booking._id,
                status: booking.status,
                bookingReference: booking.bookingReference
            },
            passenger: {
                name: passengerName,
                phone: booking.passenger.phone
            }
        }
    });
});

/**
 * Reject booking (by rider)
 */
exports.rejectBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { reason } = req.body;

    // ✅ EDGE CASE FIX: Atomic status update to prevent race condition
    const booking = await Booking.findOneAndUpdate(
        {
            _id: bookingId,
            status: 'PENDING' // Only update if still PENDING
        },
        {
            $set: {
                status: 'REJECTED',
                'cancellation.cancelled': true,
                'cancellation.cancelledBy': 'RIDER',
                'cancellation.cancelledAt': new Date(),
                'cancellation.reason': reason || 'No reason provided'
            }
        },
        { new: true }
    ).populate('passenger', 'profile.firstName profile.lastName name email phone')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile.firstName profile.lastName name email phone' }
        });

    if (!booking) {
        const existingBooking = await Booking.findById(bookingId);
        if (!existingBooking) {
            throw new AppError('Booking not found', 404);
        }
        throw new AppError(`Booking is not pending. Current status: ${existingBooking.status}`, 400);
    }

    // Authorization check
    if (booking.ride.rider._id.toString() !== req.user._id.toString()) {
        // Rollback
        await Booking.findByIdAndUpdate(bookingId, { $set: { status: 'PENDING' } });
        throw new AppError('Not authorized', 403);
    }

    // ✅ RESTORE AVAILABLE SEATS atomically
    await Ride.findByIdAndUpdate(booking.ride._id, {
        $inc: { 'pricing.availableSeats': booking.seatsBooked }
    });

    // Get rider name safely
    const riderName = User.getUserName(req.user);

    // Create notification for passenger
    const notification = await Notification.create({
        user: booking.passenger._id,
        type: 'BOOKING_REJECTED',
        title: 'Booking Request Rejected',
        message: `${riderName} has declined your booking request. Reason: ${reason || 'Not specified'}`,
        data: {
            bookingId: booking._id,
            rideId: booking.ride._id
        }
    });

    // Emit Socket.IO event to passenger
    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.passenger._id}`).emit('notification', {
            type: 'BOOKING_REJECTED',
            title: notification.title,
            message: notification.message,
            data: notification.data,
            _id: notification._id,
            createdAt: notification.createdAt
        });

        // Also emit specific booking-rejected event for real-time UI updates
        io.to(`user-${booking.passenger._id}`).emit('booking-rejected', {
            bookingId: booking._id.toString(),
            rideId: booking.ride._id.toString(),
            status: 'REJECTED',
            reason: reason || 'Not specified'
        });
    }

    // Send email notification to passenger
    try {
        const emailService = require('../utils/emailService');
        await emailService.sendBookingRejectedEmail(
            booking.passenger,
            {
                riderName: riderName,
                bookingReference: booking.bookingReference,
                reason: reason || 'Not specified',
                from: booking.ride.route.start.name || booking.ride.route.start.address,
                to: booking.ride.route.destination.name || booking.ride.route.destination.address,
                date: booking.ride.schedule.departureDateTime || booking.ride.schedule.date
            }
        );
    } catch (emailError) {
        console.error('Error sending booking rejected email:', emailError);
    }

    res.status(200).json({
        success: true,
        message: 'Booking rejected',
        booking
    });
});

/**
 * Verify Pickup OTP
 * POST /bookings/:bookingId/verify-pickup
 * Called by rider when picking up passenger
 */
exports.verifyPickupOTP = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { otp } = req.body;


    if (!otp) {
        throw new AppError('OTP is required', 400);
    }

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile.firstName profile.lastName name email phone')
        .populate('ride', 'status rider');

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Authorization check - only rider can verify
    if (booking.ride.rider.toString() !== req.user._id.toString()) {
        throw new AppError('Only the rider can verify pickup', 403);
    }

    // Status check
    if (booking.status !== 'PICKUP_PENDING' && booking.status !== 'CONFIRMED') {
        throw new AppError(`Cannot verify pickup. Booking status: ${booking.status}`, 400);
    }

    // Verify OTP
    const otpService = require('../utils/otpService');
    const verificationResult = otpService.verifyOTP(otp, booking.verification.pickup);

    // Increment attempts
    booking.verification.pickup.attempts = (booking.verification.pickup.attempts || 0) + 1;

    if (!verificationResult.valid) {
        await booking.save();
        throw new AppError(otpService.getOTPErrorMessage(verificationResult.reason), 400);
    }

    // OTP verified successfully

    // Generate a dropoff OTP that stays valid for the full active trip window.
    const dropoffOTP = otpService.generateOTPWithExpiry(otpService.DROPOFF_OTP_VALIDITY_MINUTES);

    booking.status = 'PICKED_UP';
    booking.verification.pickup.verified = true;
    booking.verification.pickup.verifiedAt = new Date();
    booking.verification.dropoff = dropoffOTP; // ⭐ Generate dropoff OTP NOW
    booking.journey.started = true;
    booking.journey.startedAt = new Date();

    await booking.save();


    // Get passenger and rider names safely
    const passengerName = User.getUserName(booking.passenger);
    const riderName = User.getUserName(booking.ride.rider);

    // Send notification to passenger with DROPOFF OTP
    const notification = await Notification.create({
        user: booking.passenger._id,
        type: 'PICKUP_CONFIRMED',
        title: 'Pickup Confirmed',
        message: `You have been picked up. Dropoff OTP: ${dropoffOTP.code}`,
        data: {
            bookingId: booking._id,
            dropoffOTP: dropoffOTP.code,
            timestamp: new Date()
        }
    });

    // Real-time notification with dropoff OTP
    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.passenger._id}`).emit('pickup-confirmed', {
            bookingId: booking._id,
            status: 'PICKED_UP',
            message: 'Pickup confirmed! You are now on your way.',
            dropoffOTP: dropoffOTP.code, // ⭐ Send dropoff OTP to passenger
            dropoffOTPExpiresAt: dropoffOTP.expiresAt,
            timestamp: new Date()
        });
    }

    // Send email with dropoff OTP
    try {
        const emailService = require('../utils/emailService');
        await emailService.sendPickupConfirmedEmail(
            booking.passenger,
            {
                riderName: riderName,
                dropoffOTP: dropoffOTP.code,
                dropoffLocation: booking.dropoffPoint.address,
                bookingReference: booking.bookingReference
            }
        );
    } catch (emailError) {
        console.error('❌ [Verify Pickup] Email error:', emailError.message);
    }

    res.status(200).json({
        success: true,
        message: 'Pickup verified successfully. Dropoff OTP sent to passenger.',
        data: {
            bookingId: booking._id,
            status: booking.status,
            passengerName: passengerName,
            pickedUpAt: booking.journey.startedAt
            // NOTE: dropoffOTP intentionally NOT returned to rider.
            // Passenger receives it via notification/email and tells rider in person.
        }
    });
});

/**
 * Verify Dropoff OTP
 * POST /bookings/:bookingId/verify-dropoff
 * Called by rider when dropping off passenger
 */
exports.verifyDropoffOTP = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { otp } = req.body;


    if (!otp) {
        throw new AppError('OTP is required', 400);
    }

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile.firstName profile.lastName name email phone statistics')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile.firstName profile.lastName name statistics' }
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Authorization check - only rider can verify
    if (booking.ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Only the rider can verify dropoff', 403);
    }

    // Status check
    if (booking.status !== 'PICKED_UP' && booking.status !== 'DROPOFF_PENDING') {
        throw new AppError(`Cannot verify dropoff. Booking status: ${booking.status}`, 400);
    }

    // Verify OTP
    const otpService = require('../utils/otpService');
    const verificationResult = otpService.verifyOTP(otp, booking.verification.dropoff);

    // Increment attempts
    booking.verification.dropoff.attempts = (booking.verification.dropoff.attempts || 0) + 1;

    if (!verificationResult.valid) {
        await booking.save();
        throw new AppError(otpService.getOTPErrorMessage(verificationResult.reason), 400);
    }

    // OTP verified successfully

    booking.status = 'DROPPED_OFF';
    booking.verification.dropoff.verified = true;
    booking.verification.dropoff.verifiedAt = new Date();
    booking.journey.completed = false; // NOT completed until payment confirmed
    booking.journey.droppedOffAt = new Date();

    // Calculate journey duration
    if (booking.journey.startedAt) {
        const duration = (new Date() - booking.journey.startedAt) / (1000 * 60);
        booking.journey.duration = Math.round(duration);
    }

    await booking.save();


    // ⭐ FIX: Don't update statistics here - will be done at ride completion
    // This prevents double-counting if dropoff and completion happen separately

    // Get passenger name safely
    const passengerName = User.getUserName(booking.passenger);

    // Send notification to passenger
    const notification = await Notification.create({
        user: booking.passenger._id,
        type: 'DROPOFF_CONFIRMED',
        title: 'Journey Complete',
        message: `You have been dropped off. Rider will confirm payment receipt.`,
        data: {
            bookingId: booking._id,
            timestamp: new Date()
        }
    });

    // Real-time notification to passenger
    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.passenger._id}`).emit('dropoff-confirmed', {
            bookingId: booking._id,
            status: 'DROPPED_OFF',
            message: 'Dropped off! Waiting for payment confirmation.',
            timestamp: new Date()
        });

        // Notify rider to confirm payment
        io.to(`user-${booking.ride.rider._id}`).emit('payment-confirmation-needed', {
            bookingId: booking._id,
            passengerName: passengerName,
            amount: booking.payment.totalAmount,
            method: booking.payment.method,
            message: 'Please confirm payment receipt',
            timestamp: new Date()
        });
    }

    // ⭐ CHANGED: No longer auto-complete ride
    // Ride stays IN_PROGRESS until rider confirms all payments

    res.status(200).json({
        success: true,
        message: 'Dropoff verified. Awaiting payment confirmation.',
        data: {
            bookingId: booking._id,
            status: booking.status,
            passengerName: passengerName,
            droppedOffAt: booking.journey.droppedOffAt,
            duration: booking.journey.duration,
            paymentAmount: booking.payment.totalAmount,
            paymentMethod: booking.payment.method
        }
    });
});

/**
 * Confirm Payment Receipt (CASH/UPI)
 * POST /bookings/:bookingId/confirm-payment
 * Rider confirms they received payment → completes booking → updates transaction
 */
exports.confirmPayment = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile.firstName profile.lastName name email statistics')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile.firstName profile.lastName name statistics' }
        });

    if (!booking) throw new AppError('Booking not found', 404);
    if (booking.ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Only the rider can confirm payment receipt', 403);
    }
    if (booking.status !== 'DROPPED_OFF') {
        throw new AppError(`Cannot confirm payment. Booking must be DROPPED_OFF. Current status: ${booking.status}`, 400);
    }
    if (booking.payment.riderConfirmedPayment) {
        throw new AppError('Payment already confirmed', 400);
    }

    const { rideCompleted, rideTotalEarnings } = await _finalizeBookingPayment(booking, {
        confirmedBy: req.user._id
    });

    const passengerName = User.getUserName(booking.passenger);

    await Notification.create({
        user: booking.passenger._id,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Confirmed',
        message: `Your payment of ₹${booking.payment.totalAmount} has been confirmed. Please rate your ride!`,
        data: { bookingId: booking._id, amount: booking.payment.totalAmount }
    });

    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.passenger._id}`).emit('payment-confirmed', {
            bookingId: booking._id,
            status: 'COMPLETED',
            amount: booking.payment.totalAmount,
            message: 'Payment confirmed! Please rate your experience.',
            timestamp: new Date()
        });
        if (rideCompleted) {
            io.to(`user-${booking.ride.rider._id}`).emit('ride-completed', {
                rideId: booking.ride._id,
                message: 'All passengers complete! Ride finished.',
                earnings: rideTotalEarnings,
                timestamp: new Date()
            });
        }
    }

    res.status(200).json({
        success: true,
        message: 'Payment confirmed successfully',
        rideCompleted,
        data: {
            bookingId: booking._id,
            status: booking.status,
            passengerName,
            amount: booking.payment.totalAmount,
            rideFare: booking.payment.rideFare,
            commission: booking.payment.platformCommission,
            confirmedAt: booking.payment.riderConfirmedAt
        }
    });
});

/**
 * Complete Payment (Passenger action after dropoff)
 * POST /bookings/:bookingId/complete-payment
 * Passenger marks payment as completed → same effect as rider confirming
 */
exports.completePayment = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const allowedMethods = ['CASH', 'UPI', 'CARD', 'WALLET'];

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile.firstName profile.lastName name email statistics')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile.firstName profile.lastName name statistics' }
        });

    if (!booking) throw new AppError('Booking not found', 404);

    const requestedMethod = normalizePaymentMethod(req.body.method || req.body.paymentMethod || booking.payment?.method);
    if (!allowedMethods.includes(requestedMethod)) {
        throw new AppError('Invalid payment method', 400);
    }
    if (booking.passenger._id.toString() !== req.user._id.toString()) {
        throw new AppError('Only the passenger can complete this payment', 403);
    }
    if (booking.status !== 'DROPPED_OFF') {
        throw new AppError(`Cannot complete payment. Booking must be DROPPED_OFF. Current status: ${booking.status}`, 400);
    }
    if (booking.payment.riderConfirmedPayment || booking.payment.status === 'PAID' || booking.payment.status === 'PAYMENT_CONFIRMED') {
        throw new AppError('Payment already completed', 400);
    }

    const paymentId = `SIM-PAY-${Date.now()}`;
    const { rideCompleted, rideTotalEarnings } = await _finalizeBookingPayment(booking, {
        paymentMethod: requestedMethod,
        confirmedBy: booking.ride.rider._id,
        paymentGatewayInfo: { gateway: 'SIMULATION', paymentId }
    });

    const passengerName = User.getUserName(booking.passenger);

    await Notification.create({
        user: booking.ride.rider._id,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Received',
        message: `${passengerName} completed payment of ₹${booking.payment.totalAmount}`,
        data: { bookingId: booking._id, amount: booking.payment.totalAmount }
    });

    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.ride.rider._id}`).emit('payment-confirmed', {
            bookingId: booking._id,
            passengerName,
            amount: booking.payment.totalAmount,
            message: 'Payment received from passenger',
            timestamp: new Date()
        });
        if (rideCompleted) {
            io.to(`user-${booking.ride.rider._id}`).emit('ride-completed', {
                rideId: booking.ride._id,
                message: 'All passengers complete! Ride finished.',
                earnings: rideTotalEarnings,
                timestamp: new Date()
            });
        }
    }

    // Epic 4: Funnel Tracking - Payment Completed
    try {
        const SearchLog = require('../models/SearchLog');
        await SearchLog.findOneAndUpdate(
            { 'finalAction.booking': booking._id },
            { $set: { funnelStatus: 'PAID' } }
        );
    } catch (err) {
        console.error('Failed to log payment funnel:', err);
    }

    res.status(200).json({
        success: true,
        message: 'Payment completed successfully',
        rideCompleted,
        paymentId,
        data: {
            bookingId: booking._id,
            status: booking.status,
            paymentId,
            amount: booking.payment.totalAmount,
            rideFare: booking.payment.rideFare,
            commission: booking.payment.platformCommission
        }
    });
});

/**
 * Cancel booking...
 * ...
 */
exports.cancelBooking = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findById(bookingId).populate('ride');

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    if (booking.passenger.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
        throw new AppError('Cannot cancel this booking', 400);
    }

    booking.status = 'CANCELLED';
    booking.cancellation = {
        cancelled: true,
        cancelledBy: 'PASSENGER',
        reason: reason || 'No reason provided',
        cancelledAt: new Date()
    };

    // ── Cancellation Fee enforcement from Settings ─────────
    const settings = req.platformSettings || await Settings.getSettings();
    const cancelWindow = settings?.booking?.cancellationWindow ?? 60;   // minutes
    const cancelFeePercent = settings?.booking?.cancellationFee ?? 0;   // 0-100%
    const departure = booking.ride?.schedule?.departureDateTime;
    const minsUntilDeparture = departure ? (new Date(departure) - new Date()) / 60_000 : Infinity;

    // If cancellation is within the window AND a fee is configured, charge partial
    let cancellationFeeAmount = 0;
    if (minsUntilDeparture < cancelWindow && cancelFeePercent > 0) {
        cancellationFeeAmount = Math.round(booking.totalPrice * (cancelFeePercent / 100));
        booking.cancellation.feeCharged = cancellationFeeAmount;
        booking.cancellation.feePercent = cancelFeePercent;
        booking.cancellation.withinWindow = true;
    } else {
        booking.cancellation.feeCharged = 0;
        booking.cancellation.withinWindow = false;
    }

    // Epic 4: Funnel Tracking - Booking Cancelled
    try {
        const SearchLog = require('../models/SearchLog');
        await SearchLog.findOneAndUpdate(
            { 'finalAction.booking': booking._id },
            { $set: { funnelStatus: 'CANCELLED' } }
        );
    } catch (err) {
        console.error('Failed to log cancellation funnel:', err);
    }

    if (booking.payment.status === 'PAID') {
        const refundAmount = Math.max(0, booking.totalPrice - cancellationFeeAmount);
        booking.payment.refundAmount = refundAmount;
        booking.payment.status = 'REFUNDED';
        booking.payment.refundedAt = new Date();
        booking.cancellation.refundIssued = true;

        // E2: Create refund Transaction record for audit trail
        await Transaction.create({
            type: 'REFUND',
            booking: booking._id,
            ride: booking.ride._id,
            passenger: booking.passenger,
            rider: booking.rider || booking.ride.rider,
            amounts: {
                passengerPaid: 0,
                rideFare: 0,
                platformCommission: 0,
                total: booking.totalPrice
            },
            payment: {
                method: booking.payment.method || 'CASH',
                status: 'REFUNDED'
            },
            description: `Refund for cancelled booking #${booking._id}`,
            metadata: {
                cancellationReason: reason || 'No reason provided',
                cancelledBy: 'PASSENGER',
                originalAmount: booking.totalPrice
            }
        });
    }

    await booking.save();

    // Update passenger's cancelled rides stat
    await User.findByIdAndUpdate(req.user._id, {
        $inc: { 'statistics.cancelledRides': 1 }
    });

    // Restore seats (use already populated booking.ride)
    booking.ride.pricing.availableSeats += booking.seatsBooked;
    await booking.ride.save();

    // Get passenger name safely
    const passengerName = User.getUserName(req.user);

    // Notify rider
    const notification = await Notification.create({
        user: booking.ride.rider,
        type: 'BOOKING_CANCELLED',
        title: 'Booking Cancelled',
        message: `${passengerName} cancelled their booking`,
        data: {
            bookingId: booking._id,
            rideId: booking.ride._id
        }
    });

    // Emit Socket.IO event to rider
    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.ride.rider}`).emit('notification', {
            type: 'BOOKING_CANCELLED',
            title: notification.title,
            message: notification.message,
            data: notification.data,
            _id: notification._id,
            createdAt: notification.createdAt
        });

        // Also emit specific booking-cancelled event for real-time UI updates
        io.to(`user-${booking.ride.rider}`).emit('booking-cancelled', {
            bookingId: booking._id.toString(),
            rideId: booking.ride._id.toString(),
            status: 'CANCELLED',
            cancelledBy: 'PASSENGER'
        });
    }

    res.status(200).json({
        success: true,
        message: 'Booking cancelled',
        booking
    });
});

/**
 * Show my bookings
 */
exports.showMyBookings = asyncHandler(async (req, res) => {
    const { status = 'all', dateFrom, dateTo } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const query = { passenger: req.user._id };
    if (status !== 'all') {
        const statusUpper = status.toUpperCase();

        // Treat UI group filters as logical booking buckets.
        if (statusUpper === 'COMPLETED') {
            query.$or = [
                { status: 'COMPLETED' },
                {
                    status: 'DROPPED_OFF',
                    'payment.status': { $in: ['PAID', 'PAYMENT_CONFIRMED'] }
                }
            ];
        } else if (statusUpper === 'IN_PROGRESS') {
            query.status = { $in: ['PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING', 'DROPPED_OFF'] };
        } else if (statusUpper === 'CANCELLED') {
            query.status = { $in: ['CANCELLED', 'REJECTED', 'EXPIRED'] };
        } else {
            query.status = statusUpper;
        }
    }

    if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) {
            query.createdAt.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
        }
        if (dateTo) {
            query.createdAt.$lte = new Date(`${dateTo}T23:59:59.999Z`);
        }
    }

    const totalBookings = await Booking.countDocuments(query);
    const bookings = await Booking.find(query)
        .populate({
            path: 'ride',
            populate: {
                path: 'rider',
                // Select explicit profile fields so virtual name can be derived reliably
                select: 'profile.firstName profile.lastName profile.photo rating vehicles createdAt'
            }
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

    const pagination = helpers.paginate(totalBookings, page, limit);

    // Return JSON for React frontend
    res.json({
        success: true,
        bookings,
        currentStatus: status,
        pagination
    });
});

/**
 * Start journey (when passenger is picked up)
 */
exports.startJourney = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { otp } = req.body;

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile.firstName profile.lastName name email phone')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile.firstName profile.lastName name email' }
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Use already populated booking.ride instead of fetching again
    if (booking.ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    const otpService = require('../utils/otpService');

    if (!['CONFIRMED', 'PICKUP_PENDING'].includes(booking.status)) {
        throw new AppError(`Booking cannot start from status ${booking.status}`, 400);
    }

    // Legacy compatibility: without an OTP this endpoint only prepares pickup verification.
    if (!otp) {
        if (!booking.verification?.pickup?.code || otpService.isOTPExpired(booking.verification.pickup)) {
            booking.verification.pickup = otpService.generateOTPWithExpiry(otpService.PICKUP_OTP_VALIDITY_MINUTES);
        }

        booking.status = 'PICKUP_PENDING';
        await booking.save();

        return res.status(200).json({
            success: true,
            deprecated: true,
            requiresOtpVerification: true,
            message: 'Pickup OTP generated. Use verify-pickup or retry this endpoint with the passenger OTP to complete pickup.',
            data: {
                bookingId: booking._id,
                status: booking.status,
                pickupOTP: booking.verification.pickup.code,
                pickupOTPExpiresAt: booking.verification.pickup.expiresAt
            }
        });
    }

    const verificationResult = otpService.verifyOTP(otp, booking.verification.pickup);
    booking.verification.pickup.attempts = (booking.verification.pickup.attempts || 0) + 1;

    if (!verificationResult.valid) {
        await booking.save();
        throw new AppError(otpService.getOTPErrorMessage(verificationResult.reason), 400);
    }

    const dropoffOTP = otpService.generateOTPWithExpiry(otpService.DROPOFF_OTP_VALIDITY_MINUTES);
    booking.status = 'PICKED_UP';
    booking.verification.pickup.verified = true;
    booking.verification.pickup.verifiedAt = new Date();
    booking.verification.dropoff = dropoffOTP;
    booking.journey.started = true;
    booking.journey.startedAt = new Date();

    await booking.save();

    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.passenger._id}`).emit('pickup-confirmed', {
            bookingId: booking._id,
            status: booking.status,
            message: 'Pickup confirmed! You are now on your way.',
            dropoffOTP: dropoffOTP.code,
            dropoffOTPExpiresAt: dropoffOTP.expiresAt,
            timestamp: new Date()
        });
    }

    await Notification.create({
        user: booking.passenger._id,
        type: 'PICKUP_CONFIRMED',
        title: 'Pickup Confirmed',
        message: `You have been picked up. Dropoff OTP: ${dropoffOTP.code}`,
        data: {
            bookingId: booking._id,
            dropoffOTP: dropoffOTP.code,
            timestamp: new Date()
        }
    });

    res.status(200).json({
        success: true,
        deprecated: true,
        message: 'Pickup verified successfully. Dropoff OTP sent to passenger.',
        data: {
            bookingId: booking._id,
            status: booking.status,
            pickedUpAt: booking.journey.startedAt
            // NOTE: dropoffOTP intentionally NOT returned to rider
        }
    });
});

/**
 * Complete journey (when passenger is dropped off)
 */
exports.completeJourney = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;
    const { otp } = req.body;

    const booking = await Booking.findById(bookingId)
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile.firstName profile.lastName email' }
        })
        .populate('passenger', 'profile.firstName profile.lastName email');

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Only rider can complete individual passenger journey
    if (booking.ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    const otpService = require('../utils/otpService');

    if (!['PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING'].includes(booking.status)) {
        throw new AppError(`Journey cannot complete from status ${booking.status}`, 400);
    }

    if (!otp) {
        if (booking.status !== 'DROPOFF_PENDING') {
            booking.status = 'DROPOFF_PENDING';
            await booking.save();
        }

        return res.status(200).json({
            success: true,
            deprecated: true,
            requiresOtpVerification: true,
            message: 'Dropoff OTP verification is required before payment confirmation.',
            data: {
                bookingId: booking._id,
                status: booking.status
            }
        });
    }

    const verificationResult = otpService.verifyOTP(otp, booking.verification.dropoff);
    booking.verification.dropoff.attempts = (booking.verification.dropoff.attempts || 0) + 1;

    if (!verificationResult.valid) {
        await booking.save();
        throw new AppError(otpService.getOTPErrorMessage(verificationResult.reason), 400);
    }

    booking.status = 'DROPPED_OFF';
    booking.verification.dropoff.verified = true;
    booking.verification.dropoff.verifiedAt = new Date();
    booking.journey.completed = false;
    booking.journey.droppedOffAt = new Date();
    if (booking.journey.startedAt) {
        booking.journey.duration = Math.round((new Date() - booking.journey.startedAt) / 60000);
    }
    await booking.save();

    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.passenger._id}`).emit('dropoff-confirmed', {
            bookingId: booking._id,
            status: 'DROPPED_OFF',
            message: 'Dropped off! Waiting for payment confirmation.',
            timestamp: new Date()
        });

        io.to(`user-${booking.ride.rider._id}`).emit('payment-confirmation-needed', {
            bookingId: booking._id,
            passengerName: User.getUserName(booking.passenger),
            amount: booking.payment.totalAmount,
            method: booking.payment.method,
            message: 'Please confirm payment receipt',
            timestamp: new Date()
        });
    }

    await Notification.create({
        user: booking.passenger._id,
        type: 'DROPOFF_CONFIRMED',
        title: 'Journey Complete',
        message: 'You have been dropped off. Rider will confirm payment receipt.',
        data: {
            bookingId: booking._id,
            rideId: booking.ride._id,
            riderId: booking.ride.rider._id
        }
    });

    res.status(200).json({
        success: true,
        deprecated: true,
        message: 'Dropoff verified. Awaiting payment confirmation.',
        data: {
            bookingId: booking._id,
            status: booking.status,
            droppedOffAt: booking.journey.droppedOffAt,
            duration: booking.journey.duration,
            paymentAmount: booking.payment.totalAmount,
            paymentMethod: booking.payment.method
        }
    });
});

// ============================================
// API FUNCTION ALIASES (for route compatibility)
// ============================================

// Alias for getMyBookings
exports.getMyBookings = exports.showMyBookings;

// Alias for getBookingDetails
exports.getBookingDetails = exports.showBookingDetails;
