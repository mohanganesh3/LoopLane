/**
 * Booking Controller
 * Handles ride booking, payment, cancellation, and journey management
 */

const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const User = require('../models/User');
const Notification = require('../models/Notification');
const emailService = require('../utils/emailService');
const smsService = require('../utils/smsService');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const helpers = require('../utils/helpers');

/**
 * Create booking
 */
exports.createBooking = asyncHandler(async (req, res) => {
    console.log('📝 [Create Booking] Request received', 'Body:', req.body, 'User:', req.user._id);

    const { rideId, pickupLocation, dropoffLocation, seats, paymentMethod, specialRequests } = req.body;

    const ride = await Ride.findById(rideId).populate('rider', 'name email phone profile');

    if (!ride) throw new AppError('Ride not found', 404);
    if (ride.status !== 'ACTIVE') throw new AppError('Ride is not available for booking', 400);
    if (ride.rider._id.toString() === req.user._id.toString()) throw new AppError('Cannot book your own ride', 400);

    // ✅ CHECK GENDER RESTRICTION (FEMALE ONLY)
    if (ride.preferences.gender === 'FEMALE_ONLY' && (await User.findById(req.user._id)).profile.gender !== 'FEMALE') {
        throw new AppError('This ride is for female passengers only', 403);
    }

    const numSeats = parseInt(seats);
    if (ride.pricing.availableSeats < numSeats) throw new AppError('Not enough seats available', 400);

    // Check if user already has a booking
    if (await Booking.findOne({ passenger: req.user._id, ride: ride._id, status: { $nin: ['CANCELLED', 'REJECTED'] } })) {
        throw new AppError('You already have a booking for this ride', 400);
    }

    // Parse locations with error handling
    let pickup, dropoff;
    try {
        pickup = JSON.parse(pickupLocation);
        dropoff = JSON.parse(dropoffLocation);
    } catch (error) {
        console.error('❌ [Create Booking] Invalid JSON:', error.message);
        throw new AppError('Invalid location data format', 400);
    }

    // Calculate price with commission
    const pricePerSeat = ride.pricing.pricePerSeat;
    const rideFare = pricePerSeat * numSeats;
    const platformCommission = 50; // Fixed ₹50 commission per booking
    const totalAmount = rideFare + platformCommission;

    console.log('💰 [Create Booking] Price Calculation:');
    console.log(`   - Ride Fare: ₹${rideFare} (${numSeats} seats × ₹${pricePerSeat})`);
    console.log(`   - Platform Commission: ₹${platformCommission}`);
    console.log(`   - Total Amount: ₹${totalAmount}`);

    // ✅ DETERMINE INITIAL STATUS BASED ON AUTO-ACCEPT SETTING
    const initialStatus = ride.preferences.autoAcceptBookings ? 'CONFIRMED' : 'PENDING';

    // Create booking
    const booking = await Booking.create({
        passenger: req.user._id,
        rider: ride.rider._id,
        ride: ride._id,
        pickupPoint: {
            name: pickup.address?.split(',')[0] || 'Pickup',
            address: pickup.address,
            coordinates: pickup.coordinates
        },
        dropoffPoint: {
            name: dropoff.address?.split(',')[0] || 'Dropoff',
            address: dropoff.address,
            coordinates: dropoff.coordinates
        },
        seatsBooked: numSeats,
        totalPrice: totalAmount,
        specialRequests: specialRequests || '',
        payment: {
            method: paymentMethod || 'CASH',
            rideFare: rideFare,
            platformCommission: platformCommission,
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

    console.log('✅ [Create Booking] Transaction record created');

    // ✅ ADD BOOKING TO RIDE'S BOOKINGS ARRAY
    ride.bookings.push(booking._id);
    
    // Update ride's available seats
    ride.pricing.availableSeats -= numSeats;
    await ride.save();

    // ✅ SEND DIFFERENT NOTIFICATIONS BASED ON AUTO-ACCEPT
    const passengerName = User.getUserName(req.user);
    
    if (ride.preferences.autoAcceptBookings) {
        // AUTO-ACCEPTED - Notify passenger of confirmation
        await Notification.create({
            user: req.user._id,
            type: 'BOOKING_CONFIRMED',
            title: 'Booking Confirmed! 🎉',
            message: `Your booking for ${numSeats} seat(s) has been automatically confirmed`,
            data: {
                bookingId: booking._id,
                rideId: ride._id
            }
        });

        // Notify rider about new confirmed booking
        await Notification.create({
            user: ride.rider._id,
            type: 'BOOKING_CONFIRMED',
            title: 'New Booking Confirmed',
            message: `${passengerName} booked ${numSeats} seat(s) (Auto-approved)`,
            data: {
                bookingId: booking._id,
                rideId: ride._id
            }
        });

        const io = req.app.get('io');
        if (io) {
            // Notify passenger
            io.to(`user-${req.user._id}`).emit('notification', {
                type: 'BOOKING_CONFIRMED',
                title: 'Booking Confirmed! 🎉',
                message: `Your booking has been automatically confirmed`,
                bookingId: booking._id,
                rideId: ride._id,
                timestamp: new Date()
            });

            // Notify rider
            io.to(`user-${ride.rider._id}`).emit('notification', {
                type: 'BOOKING_CONFIRMED',
                title: 'New Booking',
                message: `${passengerName} booked ${numSeats} seat(s)`,
                bookingId: booking._id,
                rideId: ride._id,
                timestamp: new Date()
            });
        }

        console.log(`✅ [Auto-Accept] Booking ${booking._id} automatically confirmed`);

    } else {
        // MANUAL APPROVAL REQUIRED - Notify rider of request
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

        // Send SMS notification to rider
        try {
            if (ride.rider.phone && ride.rider.phoneVerified) {
                await smsService.sendBookingRequestSMS(
                    ride.rider.phone,
                    passengerName,
                    numSeats,
                    `${process.env.APP_URL || 'http://localhost:3000'}/bookings/${booking._id}`
                );
            }
        } catch (smsError) {
            console.error('Failed to send SMS notification:', smsError);
        }

        console.log(`📧 [Manual Approval] Booking ${booking._id} requires rider approval`);
    }

    const responseMessage = ride.preferences.autoAcceptBookings 
        ? 'Booking confirmed! Your seat is reserved.'
        : 'Booking request sent. Waiting for rider approval.';

    res.status(201).json({
        success: true,
        message: responseMessage,
        booking,
        autoAccepted: ride.preferences.autoAcceptBookings,
        redirectUrl: `/bookings/${booking._id}`
    });
});

/**
 * Show booking details
 */
exports.showBookingDetails = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'name email phone profilePhoto rating')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'name email phone profilePhoto rating vehicles' }
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

    res.render('bookings/booking-details', {
        title: `Booking ${booking.bookingReference} - LANE Carpool`,
        user: req.user,
        booking,
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

    console.log('🔵 [Accept Booking] Accepting booking:', bookingId);

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile.firstName profile.lastName name email phone')
        .populate({
            path: 'ride',
            populate: { 
                path: 'rider', 
                select: 'profile.firstName profile.lastName name email phone' 
            }
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    console.log('🔵 [Accept Booking] Current booking status:', booking.status);

    // Authorization check
    if (booking.ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    // Status validation
    if (booking.status !== 'PENDING') {
        throw new AppError(`Booking cannot be accepted. Current status: ${booking.status}`, 400);
    }

    console.log('✅ [Accept Booking] Status is PENDING, proceeding with acceptance');

    // ⚠️ NO OTP GENERATED HERE - OTPs are generated when ride starts
    // This prevents issues when ride is scheduled for hours/days away

    // Update booking status
    booking.status = 'CONFIRMED';
    booking.riderResponse.respondedAt = new Date();
    if (message) booking.riderResponse.message = message;
    await booking.save();

    console.log('✅ [Accept Booking] Booking confirmed:', booking._id, 'ℹ️ Pickup OTP will be generated when ride starts');

    // Get passenger and rider names safely
    const passengerName = User.getUserName(booking.passenger), riderName = User.getUserName(req.user);

    // Create notification for passenger
    const notification = await Notification.create({
        user: booking.passenger._id,
        type: 'BOOKING_ACCEPTED',
        title: 'Booking Confirmed! 🎉',
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
        console.log('📡 [Accept Booking] Sending real-time notification to passenger');
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
        console.log('📧 [Accept Booking] Sending confirmation email');
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

    // Send SMS notification to passenger
    try {
        console.log('📱 [Accept Booking] Sending SMS notification');
        const smsService = require('../utils/smsService');
        const passenger = booking.passenger;
        if (passenger.phone) {
            await smsService.sendBookingAcceptedSMS(
                passenger.phone,
                riderName,
                booking.bookingReference,
                booking.seatsBooked
            );
        }
    } catch (smsError) {
        console.error('❌ [Accept Booking] Error sending SMS:', smsError.message);
    }

    console.log('✅ [Accept Booking] All notifications sent successfully');

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

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'name email phone')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'name email phone' }
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Use already populated booking.ride instead of fetching again
    if (booking.ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    if (booking.status !== 'PENDING') {
        throw new AppError('Booking is not pending', 400);
    }

    booking.status = 'REJECTED';
    booking.cancellation = {
        cancelled: true,
        cancelledBy: 'RIDER',
        cancelledAt: new Date(),
        reason: reason || 'No reason provided'
    };
    await booking.save();

    // ✅ RESTORE AVAILABLE SEATS (since we reduced them on booking creation)
    ride.pricing.availableSeats += booking.seatsBooked;
    await ride.save();

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
            rideId: ride._id
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
                from: ride.route.start.name || ride.route.start.address,
                to: ride.route.destination.name || ride.route.destination.address,
                date: ride.schedule.departureDateTime || ride.schedule.date
            }
        );
    } catch (emailError) {
        console.error('Error sending booking rejected email:', emailError);
    }

    // Send SMS notification to passenger
    try {
        const smsService = require('../utils/smsService');
        const passenger = booking.passenger;
        if (passenger.phone) {
            await smsService.sendBookingRejectedSMS(
                passenger.phone,
                riderName,
                booking.bookingReference
            );
        }
    } catch (smsError) {
        console.error('Error sending booking rejected SMS:', smsError);
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

    console.log('🔑 [Verify Pickup] Verifying OTP for booking:', bookingId);

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
        console.log('❌ [Verify Pickup] Invalid OTP:', verificationResult.reason);
        throw new AppError(otpService.getOTPErrorMessage(verificationResult.reason), 400);
    }

    // OTP verified successfully
    console.log('✅ [Verify Pickup] OTP verified successfully');

    // ⭐ NOW GENERATE DROPOFF OTP (valid indefinitely)
    const dropoffOTP = otpService.generateOTPWithExpiry(); // No expiry limit

    booking.status = 'PICKED_UP';
    booking.verification.pickup.verified = true;
    booking.verification.pickup.verifiedAt = new Date();
    booking.verification.dropoff = dropoffOTP; // ⭐ Generate dropoff OTP NOW
    booking.journey.started = true;
    booking.journey.startedAt = new Date();

    await booking.save();

    console.log('✅ [Verify Pickup] Booking status updated to PICKED_UP');
    console.log(`🔑 [Verify Pickup] Dropoff OTP generated: ${otpService.maskOTP(dropoffOTP.code)}`);

    // Get passenger and rider names safely
    const passengerName = User.getUserName(booking.passenger);
    const riderName = User.getUserName(booking.ride.rider);

    // Send notification to passenger with DROPOFF OTP
    const notification = await Notification.create({
        user: booking.passenger._id,
        type: 'PICKUP_CONFIRMED',
        title: 'Pickup Confirmed ✅',
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
        console.log('📡 [Verify Pickup] Sending real-time notification to passenger with dropoff OTP');
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
        console.log(`📧 [Verify Pickup] Email sent with dropoff OTP to ${booking.passenger.email}`);
    } catch (emailError) {
        console.error('❌ [Verify Pickup] Email error:', emailError.message);
    }

    // Send SMS with dropoff OTP
    try {
        const smsService = require('../utils/smsService');
        if (booking.passenger.phone) {
            await smsService.sendPickupConfirmedSMS(
                booking.passenger.phone,
                riderName,
                dropoffOTP.code,
                booking.bookingReference
            );
            console.log(`📱 [Verify Pickup] SMS sent with dropoff OTP to ${booking.passenger.phone}`);
        }
    } catch (smsError) {
        console.error('❌ [Verify Pickup] SMS error:', smsError.message);
    }

    res.status(200).json({
        success: true,
        message: 'Pickup verified successfully. Dropoff OTP sent to passenger.',
        data: {
            bookingId: booking._id,
            status: booking.status,
            passengerName: passengerName,
            pickedUpAt: booking.journey.startedAt,
            dropoffOTP: dropoffOTP.code, // Also return to rider
            dropoffOTPExpiresAt: dropoffOTP.expiresAt
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

    console.log('🔑 [Verify Dropoff] Verifying OTP for booking:', bookingId);

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
        console.log('❌ [Verify Dropoff] Invalid OTP:', verificationResult.reason);
        throw new AppError(otpService.getOTPErrorMessage(verificationResult.reason), 400);
    }

    // OTP verified successfully
    console.log('✅ [Verify Dropoff] OTP verified successfully');

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

    console.log('✅ [Verify Dropoff] Booking status updated to DROPPED_OFF');
    console.log('⚠️  [Verify Dropoff] Ride NOT completed - awaiting payment confirmation');

    // ⭐ FIX: Don't update statistics here - will be done at ride completion
    // This prevents double-counting if dropoff and completion happen separately

    // Get passenger name safely
    const passengerName = User.getUserName(booking.passenger);

    // Send notification to passenger
    const notification = await Notification.create({
        user: booking.passenger._id,
        type: 'DROPOFF_CONFIRMED',
        title: 'Journey Complete! 🎉',
        message: `You have been dropped off. Rider will confirm payment receipt.`,
        data: {
            bookingId: booking._id,
            timestamp: new Date()
        }
    });

    // Real-time notification to passenger
    const io = req.app.get('io');
    if (io) {
        console.log('📡 [Verify Dropoff] Sending real-time notification to passenger');
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

    console.log('💰 [Confirm Payment] Rider confirming payment for booking:', bookingId);

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile.firstName profile.lastName name email statistics')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile.firstName profile.lastName name statistics' }
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Authorization check - only rider can confirm payment
    if (booking.ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Only the rider can confirm payment receipt', 403);
    }

    // Status check - must be DROPPED_OFF
    if (booking.status !== 'DROPPED_OFF') {
        throw new AppError(`Cannot confirm payment. Booking must be DROPPED_OFF. Current status: ${booking.status}`, 400);
    }

    // Check if already confirmed
    if (booking.payment.riderConfirmedPayment) {
        throw new AppError('Payment already confirmed', 400);
    }

    // Update booking payment confirmation
    booking.payment.riderConfirmedPayment = true;
    booking.payment.riderConfirmedAt = new Date();
    booking.payment.riderConfirmedBy = req.user._id;
    booking.payment.status = 'PAYMENT_CONFIRMED';
    
    // Complete the journey
    booking.status = 'COMPLETED';
    booking.journey.completed = true;
    booking.journey.completedAt = new Date();

    await booking.save();

    console.log(`✅ [Confirm Payment] Payment confirmed: ₹${booking.payment.totalAmount} (Fare: ₹${booking.payment.rideFare}, Commission: ₹${booking.payment.platformCommission})`);

    // Update Transaction record
    const Transaction = require('../models/Transaction');
    await Transaction.findOneAndUpdate(
        { booking: booking._id },
        {
            $set: {
                'payment.status': 'COMPLETED',
                'payment.completedAt': new Date(),
                'commission.collected': true,
                'commission.collectedAt': new Date(),
                'riderPayout.settled': false // Will be settled by admin later
            }
        }
    );

    console.log('✅ [Confirm Payment] Transaction record updated');

    // Update passenger statistics
    const passenger = await User.findById(booking.passenger._id);
    if (passenger && passenger.statistics) {
        passenger.statistics.completedRides = (passenger.statistics.completedRides || 0) + 1;
        passenger.statistics.totalDistance = (passenger.statistics.totalDistance || 0) + (booking.journey?.distance || booking.ride.route?.distance || 0);
        await passenger.save();
    }

    // Check if ALL bookings for this ride are now completed
    const pendingBookings = await Booking.countDocuments({
        ride: booking.ride._id,
        status: { $ne: 'COMPLETED' }
    });

    console.log(`🔵 [Confirm Payment] Remaining incomplete bookings: ${pendingBookings}`);

    let rideCompleted = false;
    if (pendingBookings === 0) {
        console.log('🎯 [Confirm Payment] All bookings complete - Completing ride');
        
        const ride = await Ride.findById(booking.ride._id);
        if (ride && ride.status === 'IN_PROGRESS') {
            ride.status = 'COMPLETED';
            ride.tracking.completedAt = new Date();
            ride.tracking.isLive = false;
            
            // Calculate total earnings for rider (sum of all rideFares)
            const completedBookings = await Booking.find({
                ride: ride._id,
                status: 'COMPLETED'
            });
            
            const totalRideFare = completedBookings.reduce((sum, b) => sum + (b.payment.rideFare || 0), 0);
            const totalCommission = completedBookings.reduce((sum, b) => sum + (b.payment.platformCommission || 0), 0);
            
            ride.pricing.totalEarnings = totalRideFare; // Rider's share (after commission)
            
            await ride.save();

            // Update rider statistics
            const rider = await User.findById(ride.rider);
            rider.statistics.completedRides = (rider.statistics.completedRides || 0) + 1;
            rider.statistics.totalDistance = (rider.statistics.totalDistance || 0) + (ride.route?.distance || 0);
            rider.statistics.carbonSaved = (rider.statistics.carbonSaved || 0) + (ride.carbon?.carbonSaved || 0);
            await rider.save();

            console.log(`✅ [Confirm Payment] Ride completed - Rider earnings: ₹${totalRideFare}, Platform commission: ₹${totalCommission}`);
            rideCompleted = true;
        }
    }

    // Get passenger name safely
    const passengerName = User.getUserName(booking.passenger);

    // Send notification to passenger
    await Notification.create({
        user: booking.passenger._id,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Confirmed! 💰',
        message: `Your payment of ₹${booking.payment.totalAmount} has been confirmed. Please rate your ride!`,
        data: {
            bookingId: booking._id,
            amount: booking.payment.totalAmount
        }
    });

    // Real-time notifications
    const io = req.app.get('io');
    if (io) {
        // Notify passenger
        io.to(`user-${booking.passenger._id}`).emit('payment-confirmed', {
            bookingId: booking._id,
            status: 'COMPLETED',
            amount: booking.payment.totalAmount,
            message: 'Payment confirmed! Please rate your experience.',
            timestamp: new Date()
        });

        // If ride completed, notify rider
        if (rideCompleted) {
            io.to(`user-${booking.ride.rider._id}`).emit('ride-completed', {
                rideId: booking.ride._id,
                message: 'All passengers complete! Ride finished.',
                earnings: booking.ride.pricing.totalEarnings,
                timestamp: new Date()
            });
        }
    }

    res.status(200).json({
        success: true,
        message: 'Payment confirmed successfully',
        rideCompleted: rideCompleted,
        data: {
            bookingId: booking._id,
            status: booking.status,
            passengerName: passengerName,
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

    console.log('💰 [Complete Payment] Passenger completing payment for booking:', bookingId);

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile.firstName profile.lastName name email statistics')
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'profile.firstName profile.lastName name statistics' }
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Authorization check - only passenger can complete their own payment
    if (booking.passenger._id.toString() !== req.user._id.toString()) {
        throw new AppError('Only the passenger can complete this payment', 403);
    }

    // Status check - must be DROPPED_OFF
    if (booking.status !== 'DROPPED_OFF') {
        throw new AppError(`Cannot complete payment. Booking must be DROPPED_OFF. Current status: ${booking.status}`, 400);
    }

    // Check if already confirmed
    if (booking.payment.riderConfirmedPayment || booking.payment.status === 'PAID' || booking.payment.status === 'PAYMENT_CONFIRMED') {
        throw new AppError('Payment already completed', 400);
    }

    // Update booking payment - mark as if rider confirmed it
    booking.payment.riderConfirmedPayment = true;
    booking.payment.riderConfirmedAt = new Date();
    booking.payment.riderConfirmedBy = booking.ride.rider._id; // Set rider as confirmer
    booking.payment.status = 'PAYMENT_CONFIRMED';
    
    // Complete the journey
    booking.status = 'COMPLETED';
    booking.journey.completed = true;
    booking.journey.completedAt = new Date();

    await booking.save();

    console.log(`✅ [Complete Payment] Payment completed by passenger: ₹${booking.payment.totalAmount} (Fare: ₹${booking.payment.rideFare}, Commission: ₹${booking.payment.platformCommission})`);

    // Update Transaction record
    const Transaction = require('../models/Transaction');
    await Transaction.findOneAndUpdate(
        { booking: booking._id },
        {
            $set: {
                'payment.status': 'COMPLETED',
                'payment.completedAt': new Date(),
                'commission.collected': true,
                'commission.collectedAt': new Date(),
                'riderPayout.settled': false
            }
        }
    );

    console.log('✅ [Complete Payment] Transaction record updated');

    // Update passenger statistics
    const passenger = await User.findById(booking.passenger._id);
    if (passenger && passenger.statistics) {
        passenger.statistics.completedRides = (passenger.statistics.completedRides || 0) + 1;
        passenger.statistics.totalDistance = (passenger.statistics.totalDistance || 0) + (booking.journey?.distance || booking.ride.route?.distance || 0);
        await passenger.save();
    }

    // Check if ALL bookings for this ride are now completed
    const pendingBookings = await Booking.countDocuments({
        ride: booking.ride._id,
        status: { $ne: 'COMPLETED' }
    });

    console.log(`🔵 [Complete Payment] Remaining incomplete bookings: ${pendingBookings}`);

    let rideCompleted = false;
    if (pendingBookings === 0) {
        console.log('🎯 [Complete Payment] All bookings complete - Completing ride');
        
        const ride = await Ride.findById(booking.ride._id);
        if (ride && ride.status === 'IN_PROGRESS') {
            ride.status = 'COMPLETED';
            ride.tracking.completedAt = new Date();
            ride.tracking.isLive = false;
            
            // Calculate total earnings for rider
            const completedBookings = await Booking.find({
                ride: ride._id,
                status: 'COMPLETED'
            });
            
            const totalRideFare = completedBookings.reduce((sum, b) => sum + (b.payment.rideFare || 0), 0);
            const totalCommission = completedBookings.reduce((sum, b) => sum + (b.payment.platformCommission || 0), 0);
            
            ride.pricing.totalEarnings = totalRideFare;
            
            await ride.save();

            // Update rider statistics
            const rider = await User.findById(ride.rider);
            rider.statistics.completedRides = (rider.statistics.completedRides || 0) + 1;
            rider.statistics.totalDistance = (rider.statistics.totalDistance || 0) + (ride.route?.distance || 0);
            rider.statistics.carbonSaved = (rider.statistics.carbonSaved || 0) + (ride.carbon?.carbonSaved || 0);
            await rider.save();

            console.log(`✅ [Complete Payment] Ride completed - Rider earnings: ₹${totalRideFare}, Platform commission: ₹${totalCommission}`);
            rideCompleted = true;
        }
    }

    // Get passenger name safely
    const passengerName = User.getUserName(booking.passenger);

    // Send notification to rider
    await Notification.create({
        user: booking.ride.rider._id,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Received! 💰',
        message: `${passengerName} completed payment of ₹${booking.payment.totalAmount}`,
        data: {
            bookingId: booking._id,
            amount: booking.payment.totalAmount
        }
    });

    // Real-time notifications
    const io = req.app.get('io');
    if (io) {
        // Notify rider
        io.to(`user-${booking.ride.rider._id}`).emit('payment-confirmed', {
            bookingId: booking._id,
            passengerName: passengerName,
            amount: booking.payment.totalAmount,
            message: 'Payment received from passenger',
            timestamp: new Date()
        });

        // If ride completed, notify rider
        if (rideCompleted) {
            io.to(`user-${booking.ride.rider._id}`).emit('ride-completed', {
                rideId: booking.ride._id,
                message: 'All passengers complete! Ride finished.',
                earnings: booking.ride.pricing.totalEarnings,
                timestamp: new Date()
            });
        }
    }

    res.status(200).json({
        success: true,
        message: 'Payment completed successfully',
        rideCompleted: rideCompleted,
        data: {
            bookingId: booking._id,
            status: booking.status,
            amount: booking.payment.totalAmount,
            rideFare: booking.payment.rideFare,
            commission: booking.payment.platformCommission
        }
    });
});

/**
 * Mark Payment as Paid (DEPRECATED - Use confirmPayment instead)
 * POST /bookings/:bookingId/mark-paid
 * Allows rider to manually mark a booking payment as PAID (for cash payments)
 */
exports.markAsPaid = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

    console.log('💰 [Mark as Paid] Marking payment as paid for booking:', bookingId);

    const booking = await Booking.findById(bookingId)
        .populate('passenger', 'profile.firstName profile.lastName name email')
        .populate('ride', 'rider pricing');

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Authorization check - only rider can mark as paid
    if (booking.ride.rider.toString() !== req.user._id.toString()) {
        throw new AppError('Only the rider can mark payment as paid', 403);
    }

    // Check if payment is already paid
    if (booking.payment.status === 'PAID') {
        throw new AppError('Payment is already marked as PAID', 400);
    }

    // Update payment status
    booking.payment.status = 'PAID';
    booking.payment.paidAt = new Date();

    // Calculate rider earnings (deduct 10% platform fee)
    const platformFeePercent = 0.10;
    const riderEarnings = booking.totalPrice * (1 - platformFeePercent);
    
    // Update ride total earnings
    const ride = await Ride.findById(booking.ride._id);
    ride.pricing.totalEarnings = (ride.pricing.totalEarnings || 0) + riderEarnings;
    await ride.save();

    await booking.save();

    console.log(`✅ [Mark as Paid] Payment marked as PAID: ₹${booking.totalPrice}, Rider gets: ₹${riderEarnings.toFixed(2)}`);

    // Get passenger name safely
    const passengerName = User.getUserName(booking.passenger);

    // Send notification to passenger
    await Notification.create({
        user: booking.passenger._id,
        type: 'PAYMENT_RECEIVED',
        title: 'Payment Confirmed 💰',
        message: `Your payment of ₹${booking.totalPrice} has been confirmed by the rider.`,
        data: {
            bookingId: booking._id,
            amount: booking.totalPrice,
            method: booking.payment.method
        }
    });

    // Real-time notification
    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.passenger._id}`).emit('payment-confirmed', {
            bookingId: booking._id,
            amount: booking.totalPrice,
            message: 'Payment confirmed',
            timestamp: new Date()
        });
    }

    res.status(200).json({
        success: true,
        message: 'Payment marked as PAID successfully',
        data: {
            bookingId: booking._id,
            passengerName: passengerName,
            amount: booking.totalPrice,
            riderEarnings: riderEarnings,
            paymentStatus: booking.payment.status,
            paidAt: booking.payment.paidAt
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

    if (booking.payment.status === 'PAID') {
        booking.payment.refundAmount = booking.totalPrice;
        booking.payment.status = 'REFUNDED';
        booking.payment.refundedAt = new Date();
        booking.cancellation.refundIssued = true;
    }

    await booking.save();

    // Restore seats (use already populated booking.ride)
    booking.ride.pricing.availableSeats += booking.seatsBooked;
    await booking.ride.save();

    // Get passenger name safely
    const passengerName = User.getUserName(req.user);

    // Notify rider
    await Notification.create({
        user: ride.rider,
        type: 'BOOKING_CANCELLED',
        title: 'Booking Cancelled',
        message: `${passengerName} cancelled their booking`,
        data: {
            bookingId: booking._id,
            rideId: ride._id
        }
    });

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
    const { status = 'all' } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;

    const query = { passenger: req.user._id };
    if (status !== 'all') {
        const statusUpper = status.toUpperCase();
        
        // For "completed" filter, show both COMPLETED and DROPPED_OFF with PAID payment
        if (statusUpper === 'COMPLETED') {
            query.$or = [
                { status: 'COMPLETED' },
                { 
                    status: 'DROPPED_OFF',
                    'payment.status': 'PAID'
                }
            ];
        } else {
            query.status = statusUpper;
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

    res.render('bookings/my-bookings', {
        title: 'My Bookings - LANE Carpool',
        user: req.user,
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

    const booking = await Booking.findById(bookingId)
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'name email' }
        });

    if (!booking) {
        throw new AppError('Booking not found', 404);
    }

    // Use already populated booking.ride instead of fetching again
    if (booking.ride.rider._id.toString() !== req.user._id.toString()) {
        throw new AppError('Not authorized', 403);
    }

    if (booking.status !== 'CONFIRMED') {
        throw new AppError('Booking must be confirmed', 400);
    }

    booking.status = 'IN_PROGRESS';
    booking.journey.started = true;
    booking.journey.startedAt = new Date();
    await booking.save();

    res.status(200).json({
        success: true,
        message: 'Journey started',
        booking
    });
});

/**
 * Complete journey (when passenger is dropped off)
 */
exports.completeJourney = asyncHandler(async (req, res) => {
    const { bookingId } = req.params;

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

    if (booking.status !== 'IN_PROGRESS') {
        throw new AppError('Journey is not in progress', 400);
    }

    console.log('🔵 [Complete Journey] Completing booking:', bookingId);

    booking.status = 'COMPLETED';
    booking.journey.completed = true;
    booking.journey.completedAt = new Date();
    if (booking.journey.startedAt) {
        booking.journey.duration = Math.round((new Date() - booking.journey.startedAt) / 60000); // minutes
    }
    await booking.save();

    console.log('✅ [Complete Journey] Booking marked as COMPLETED');

    // Update passenger statistics
    //update passenger statistics...
    const passenger = await User.findById(booking.passenger._id);
    if (passenger && passenger.statistics) {
        passenger.statistics.completedRides = (passenger.statistics.completedRides || 0) + 1;
        await passenger.save();
        console.log('✅ [Complete Journey] Passenger statistics updated');
    }

    // Send real-time notification to passenger
    const io = req.app.get('io');
    if (io) {
        io.to(`user-${booking.passenger._id}`).emit('journey-completed', {
            type: 'JOURNEY_COMPLETED',
            bookingId: booking._id,
            rideId: booking.ride._id,
            message: 'You have reached your destination! Please rate your ride.',
            timestamp: new Date()
        });
        console.log('📡 [Complete Journey] Real-time notification sent to passenger');
    }

    // Create notification in database
    const Notification = require('../models/Notification');
    await Notification.create({
        user: booking.passenger._id,
        type: 'JOURNEY_COMPLETED',
        title: 'Journey Completed',
        message: 'You have reached your destination. Please rate your ride experience!',
        data: {
            bookingId: booking._id,
            rideId: booking.ride._id,
            riderId: booking.ride.rider._id
        }
    });

    console.log('✅ [Complete Journey] Database notification created');

    // Check if all bookings for this ride are completed
    const remainingBookings = await Booking.countDocuments({
        ride: booking.ride._id,
        status: { $in: ['CONFIRMED', 'IN_PROGRESS'] }
    });

    console.log(`🔵 [Complete Journey] Remaining active bookings: ${remainingBookings}`);

    // If no more active bookings, mark ride as completed
    if (remainingBookings === 0) {
        const Ride = require('../models/Ride');
        const ride = await Ride.findById(booking.ride._id);
        if (ride && ride.status === 'IN_PROGRESS') {
            ride.status = 'COMPLETED';
            ride.tracking.isLive = false;
            ride.tracking.completedAt = new Date();
            await ride.save();
            console.log('✅ [Complete Journey] All passengers dropped - Ride auto-completed');

            // Update rider statistics
            const rider = await User.findById(ride.rider);
            if (rider && rider.statistics) {
                rider.statistics.completedRides = (rider.statistics.completedRides || 0) + 1;
                rider.statistics.totalDistance = (rider.statistics.totalDistance || 0) + (ride.route.distance || 0);
                rider.statistics.carbonSaved = (rider.statistics.carbonSaved || 0) + (ride.carbon?.carbonSaved || 0);
                await rider.save();
                console.log('✅ [Complete Journey] Rider statistics updated');
            }

            // Notify rider that ride is auto-completed
            if (io) {
                io.to(`user-${ride.rider}`).emit('ride-auto-completed', {
                    type: 'RIDE_AUTO_COMPLETED',
                    rideId: ride._id,
                    message: 'All passengers have been dropped off. Ride completed!',
                    timestamp: new Date()
                });
            }
        }
    }

    res.status(200).json({
        success: true,
        message: 'Journey completed successfully',
        booking,
        remainingBookings
    });
});
