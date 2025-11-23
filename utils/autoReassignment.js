/**
 * Auto-Reassignment Utility
 * Smart system to automatically find alternative rides when a driver cancels
 * Implements immediate reassignment to reduce passenger frustration
 */

const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Notification = require('../models/Notification');
const routeMatching = require('./routeMatching');
const helpers = require('./helpers');

class AutoReassignment {
    constructor() {
        // Configuration
        this.MAX_REASSIGNMENT_ATTEMPTS = 3; // Maximum number of alternative rides to try
        this.SEARCH_RADIUS_KM = 30; // Search radius for alternative rides
        this.TIME_WINDOW_HOURS = 24; // Search rides within +/- 24 hours of original (full day coverage)
        this.MIN_MATCH_SCORE = 40; // Minimum match score for reassignment
    }

    /**
     * Find alternative rides when a ride is cancelled
     * @param {Object} cancelledRide - The cancelled ride document
     * @param {Array} affectedBookings - Bookings that need reassignment
     * @param {Object} io - Socket.io instance for real-time notifications
     * @returns {Object} Reassignment results
     */
    async findAlternativeRides(cancelledRide, affectedBookings, io) {
        console.log('🔄 [Auto-Reassignment] Starting reassignment process...');
        console.log(`   Cancelled Ride: ${cancelledRide._id}`);
        console.log(`   Affected Bookings: ${affectedBookings.length}`);

        const results = {
            totalBookings: affectedBookings.length,
            reassigned: [],
            noAlternative: [],
            errors: []
        };

        // Get original ride details
        const originalDeparture = new Date(cancelledRide.schedule.departureDateTime);

        // Search time window - from NOW to +48 hours to cover today and next day
        // This ensures we find any upcoming rides even if the cancelled ride was earlier
        const now = new Date();
        const searchStartTime = now < originalDeparture 
            ? new Date(Math.min(now.getTime(), originalDeparture.getTime() - (24 * 60 * 60 * 1000)))
            : now;
        const searchEndTime = new Date(originalDeparture.getTime() + (48 * 60 * 60 * 1000)); // +48 hours from original departure

        console.log(`   Original departure: ${originalDeparture.toLocaleString()}`);
        console.log(`   Time window: ${searchStartTime.toLocaleString()} to ${searchEndTime.toLocaleString()}`);
        console.log(`   (Searching +48 hours to cover today and next day)`);

        // Process each affected booking - search for alternatives based on BOOKING's pickup/dropoff
        for (const booking of affectedBookings) {
            try {
                // Get booking's actual pickup and dropoff (not the ride's start/destination)
                const bookingPickup = booking.pickupPoint?.coordinates || cancelledRide.route.start.coordinates;
                const bookingDropoff = booking.dropoffPoint?.coordinates || cancelledRide.route.destination.coordinates;

                console.log(`\n   📍 Booking ${booking._id}:`);
                console.log(`      Pickup: ${JSON.stringify(bookingPickup)}`);
                console.log(`      Dropoff: ${JSON.stringify(bookingDropoff)}`);

                // Find alternative rides for THIS booking's route
                const alternativeRides = await this.searchAlternativeRides(
                    { pickup: bookingPickup, dropoff: bookingDropoff },
                    searchStartTime,
                    searchEndTime,
                    cancelledRide._id,
                    cancelledRide.rider
                );

                console.log(`      Found ${alternativeRides.length} potential alternative rides`);

                const reassignmentResult = await this.reassignBooking(
                    booking,
                    alternativeRides,
                    cancelledRide,
                    io
                );

                if (reassignmentResult.success) {
                    results.reassigned.push({
                        bookingId: booking._id,
                        passengerId: booking.passenger,
                        newRideId: reassignmentResult.newRide._id,
                        matchScore: reassignmentResult.matchScore
                    });
                } else {
                    results.noAlternative.push({
                        bookingId: booking._id,
                        passengerId: booking.passenger,
                        reason: reassignmentResult.reason
                    });
                }
            } catch (error) {
                console.error(`   ❌ Error reassigning booking ${booking._id}:`, error.message);
                results.errors.push({
                    bookingId: booking._id,
                    error: error.message
                });
            }
        }

        console.log('\n🔄 [Auto-Reassignment] Process complete:');
        console.log(`   ✅ Reassigned: ${results.reassigned.length}`);
        console.log(`   ❌ No Alternative: ${results.noAlternative.length}`);
        console.log(`   ⚠️ Errors: ${results.errors.length}`);

        return results;
    }

    /**
     * Search for alternative rides matching the booking's pickup/dropoff
     * @param {Object} bookingRoute - { pickup: [lon, lat], dropoff: [lon, lat] }
     * @param {Date} startTime - Search start time
     * @param {Date} endTime - Search end time
     * @param {String} excludeRideId - Ride ID to exclude
     * @param {String} excludeRiderId - Rider ID to exclude (same rider)
     * @returns {Array} Alternative rides sorted by match score
     */
    async searchAlternativeRides(bookingRoute, startTime, endTime, excludeRideId, excludeRiderId) {
        console.log(`\n   🔍 [searchAlternativeRides] Starting search...`);
        console.log(`      Time window: ${startTime.toISOString()} to ${endTime.toISOString()}`);
        console.log(`      Excluding ride: ${excludeRideId}`);
        console.log(`      Excluding rider: ${excludeRiderId}`);
        console.log(`      Booking Pickup: [${bookingRoute.pickup}]`);
        console.log(`      Booking Dropoff: [${bookingRoute.dropoff}]`);
        
        // Convert excludeRiderId to string for comparison
        const excludeRiderIdStr = excludeRiderId?.toString ? excludeRiderId.toString() : excludeRiderId;
        
        // First, let's find ALL active rides to debug
        const allActiveRides = await Ride.find({ status: 'ACTIVE' }).lean();
        console.log(`\n      📊 Total ACTIVE rides in database: ${allActiveRides.length}`);
        
        // Log all active rides for debugging
        allActiveRides.forEach((ride, idx) => {
            const rideRiderId = ride.rider?.toString ? ride.rider.toString() : ride.rider;
            const depTime = new Date(ride.schedule?.departureDateTime);
            const isInTimeWindow = depTime >= startTime && depTime <= endTime;
            const isSameRider = rideRiderId === excludeRiderIdStr;
            const isSameRide = ride._id.toString() === excludeRideId?.toString();
            const hasSeats = ride.pricing?.availableSeats >= 1;
            
            console.log(`      Ride ${idx + 1}: ${ride._id}`);
            console.log(`        Route: ${ride.route?.start?.name} → ${ride.route?.destination?.name}`);
            console.log(`        Departure: ${depTime.toISOString()}`);
            console.log(`        Seats: ${ride.pricing?.availableSeats}`);
            console.log(`        Rider: ${rideRiderId}`);
            console.log(`        ✓ In time window: ${isInTimeWindow}`);
            console.log(`        ✓ Not same ride: ${!isSameRide}`);
            console.log(`        ✓ Not same rider: ${!isSameRider}`);
            console.log(`        ✓ Has seats: ${hasSeats}`);
            console.log(`        → Would qualify: ${isInTimeWindow && !isSameRide && !isSameRider && hasSeats}`);
        });

        // Build search query - be more lenient
        const query = {
            status: 'ACTIVE',
            'pricing.availableSeats': { $gte: 1 }
        };

        // Find ALL active rides first (we'll filter manually for better debugging)
        const allRides = await Ride.find(query)
            .populate('rider', 'name profile rating verificationStatus preferences')
            .lean();

        console.log(`\n      Found ${allRides.length} active rides with seats`);

        // Manually filter by time window and exclusions
        const candidateRides = allRides.filter(ride => {
            const rideId = ride._id.toString();
            const riderId = ride.rider?._id?.toString() || ride.rider?.toString();
            const depTime = new Date(ride.schedule?.departureDateTime);
            
            // Exclude the cancelled ride
            if (rideId === excludeRideId?.toString()) {
                console.log(`        ❌ Excluding ${rideId}: Same ride`);
                return false;
            }
            
            // Exclude same rider
            if (riderId === excludeRiderIdStr) {
                console.log(`        ❌ Excluding ${rideId}: Same rider (${riderId})`);
                return false;
            }
            
            // Check time window
            if (depTime < startTime || depTime > endTime) {
                console.log(`        ❌ Excluding ${rideId}: Outside time window (${depTime.toISOString()})`);
                return false;
            }
            
            console.log(`        ✅ Including ${rideId}: ${ride.route?.start?.name} → ${ride.route?.destination?.name}`);
            return true;
        });

        console.log(`\n      ${candidateRides.length} rides in time window after filtering`);

        if (candidateRides.length === 0) {
            console.log(`      ⚠️ No rides found in time window`);
            return [];
        }

        // Filter rides with valid geometry
        const ridesWithGeometry = candidateRides.filter(ride => {
            const hasGeometry = ride.route?.geometry?.coordinates?.length >= 2;
            if (!hasGeometry) {
                console.log(`        ⚠️ Ride ${ride._id}: No geometry`);
            }
            return hasGeometry;
        });

        console.log(`      ${ridesWithGeometry.length} rides have valid geometry`);

        if (ridesWithGeometry.length === 0) {
            console.log(`      ⚠️ No rides with geometry found`);
            return [];
        }

        // Create passenger route for matching
        // Ensure coordinates are in [lon, lat] format
        const passengerRoute = {
            pickup: Array.isArray(bookingRoute.pickup) ? bookingRoute.pickup : [bookingRoute.pickup.lng || bookingRoute.pickup[0], bookingRoute.pickup.lat || bookingRoute.pickup[1]],
            dropoff: Array.isArray(bookingRoute.dropoff) ? bookingRoute.dropoff : [bookingRoute.dropoff.lng || bookingRoute.dropoff[0], bookingRoute.dropoff.lat || bookingRoute.dropoff[1]]
        };

        console.log(`\n      Normalized pickup: [${passengerRoute.pickup}]`);
        console.log(`      Normalized dropoff: [${passengerRoute.dropoff}]`);

        // Match routes using routeMatching utility
        const matchedRides = routeMatching.findMatchingRides(
            passengerRoute,
            ridesWithGeometry,
            10 // Get top 10 matches
        );

        console.log(`\n      ${matchedRides.length} rides matched via polyline`);

        // Filter by minimum match score
        const qualifiedMatches = matchedRides.filter(match => match.matchDetails.matchScore >= this.MIN_MATCH_SCORE);
        
        console.log(`      ${qualifiedMatches.length} rides meet minimum score (${this.MIN_MATCH_SCORE})`);

        return qualifiedMatches;
    }

    /**
     * Attempt to reassign a single booking to an alternative ride
     * @param {Object} booking - The booking to reassign
     * @param {Array} alternativeRides - Available alternative rides
     * @param {Object} cancelledRide - The cancelled ride
     * @param {Object} io - Socket.io instance
     * @returns {Object} Reassignment result
     */
    async reassignBooking(booking, alternativeRides, cancelledRide, io) {
        const passenger = await User.findById(booking.passenger);
        
        if (!passenger) {
            return { success: false, reason: 'Passenger not found' };
        }

        // Find a suitable alternative ride
        for (const match of alternativeRides) {
            const alternativeRide = match.ride;

            // Check if ride has enough seats
            if (alternativeRide.pricing.availableSeats < booking.seatsBooked) {
                continue;
            }

            // Check gender preference compatibility
            if (alternativeRide.preferences.gender === 'FEMALE_ONLY' && 
                passenger.profile?.gender !== 'FEMALE') {
                continue;
            }

            // Check if rider prefers verified users only
            if (alternativeRide.rider?.preferences?.booking?.verifiedUsersOnly &&
                passenger.verificationStatus !== 'VERIFIED') {
                continue;
            }

            // Found a suitable alternative - create reassignment
            try {
                const result = await this.executeReassignment(
                    booking,
                    alternativeRide,
                    match.matchDetails,
                    cancelledRide,
                    io
                );
                return result;
            } catch (error) {
                console.log(`   ⚠️ Failed to reassign to ride ${alternativeRide._id}: ${error.message}`);
                continue; // Try next alternative
            }
        }

        // No suitable alternative found
        // Send notification to passenger about no alternatives
        await this.notifyNoAlternative(booking, cancelledRide, io);
        
        return { 
            success: false, 
            reason: 'No suitable alternative rides found' 
        };
    }

    /**
     * Execute the reassignment - create new booking and update records
     * @param {Object} originalBooking - Original cancelled booking
     * @param {Object} newRide - New ride to reassign to
     * @param {Object} matchDetails - Route match details
     * @param {Object} cancelledRide - The cancelled ride
     * @param {Object} io - Socket.io instance
     * @returns {Object} Reassignment result
     */
    async executeReassignment(originalBooking, newRide, matchDetails, cancelledRide, io) {
        // Get passenger ID (handle both populated and non-populated cases)
        const passengerId = originalBooking.passenger?._id?.toString() || originalBooking.passenger?.toString();
        const newRiderId = newRide.rider?._id?.toString() || newRide.rider?.toString();
        
        console.log(`   📝 Executing reassignment:`);
        console.log(`      Passenger ID: ${passengerId}`);
        console.log(`      New Rider ID: ${newRiderId}`);
        console.log(`      New Ride ID: ${newRide._id}`);
        
        // Update original booking with reassignment info
        originalBooking.status = 'CANCELLED';
        originalBooking.cancellation = {
            cancelled: true,
            cancelledBy: 'RIDER',
            cancelledAt: new Date(),
            reason: 'Ride cancelled by rider - Auto-reassignment initiated'
        };
        
        // Track reassignment chain
        if (!originalBooking.reassignment) {
            originalBooking.reassignment = {
                chain: [],
                originalRide: cancelledRide._id,
                attempts: 0
            };
        }
        
        originalBooking.reassignment.chain.push({
            fromRide: cancelledRide._id,
            toRide: newRide._id,
            reassignedAt: new Date(),
            matchScore: matchDetails.matchScore
        });
        originalBooking.reassignment.attempts += 1;

        await originalBooking.save();

        // Calculate new price (use same or similar price)
        const newTotalPrice = newRide.pricing.pricePerSeat * originalBooking.seatsBooked;

        // Use original booking's pickup/dropoff points (not the cancelled ride's start/end)
        const pickupCoords = originalBooking.pickupPoint?.coordinates || cancelledRide.route.start.coordinates;
        const dropoffCoords = originalBooking.dropoffPoint?.coordinates || cancelledRide.route.destination.coordinates;

        // Create new booking for the alternative ride
        const newBooking = new Booking({
            ride: newRide._id,
            passenger: passengerId, // Use extracted ID
            rider: newRiderId, // Use extracted ID
            pickupPoint: {
                name: originalBooking.pickupPoint?.name || cancelledRide.route.start.name,
                address: originalBooking.pickupPoint?.address || cancelledRide.route.start.address,
                coordinates: pickupCoords,
                estimatedTime: this.calculateEstimatedTime(newRide, matchDetails.pickupPoint?.routeIndex || 0)
            },
            dropoffPoint: {
                name: originalBooking.dropoffPoint?.name || cancelledRide.route.destination.name,
                address: originalBooking.dropoffPoint?.address || cancelledRide.route.destination.address,
                coordinates: dropoffCoords,
                estimatedTime: this.calculateEstimatedTime(newRide, matchDetails.dropoffPoint?.routeIndex || 0)
            },
            seatsBooked: originalBooking.seatsBooked,
            totalPrice: newTotalPrice,
            status: 'PENDING', // All bookings require rider approval
            specialRequests: originalBooking.specialRequests,
            payment: {
                status: 'PENDING',
                method: originalBooking.payment.method,
                rideFare: newTotalPrice,
                platformCommission: 50,
                totalAmount: newTotalPrice
            },
            reassignment: {
                isReassigned: true,
                originalBooking: originalBooking._id,
                originalRide: cancelledRide._id,
                reassignedAt: new Date(),
                reason: 'Original ride cancelled by rider'
            }
        });

        await newBooking.save();

        // Update new ride's available seats (atomic operation)
        await Ride.findByIdAndUpdate(
            newRide._id,
            {
                $inc: { 'pricing.availableSeats': -originalBooking.seatsBooked },
                $push: { bookings: newBooking._id }
            }
        );

        // Create notifications
        await this.createReassignmentNotifications(
            originalBooking,
            newBooking,
            newRide,
            cancelledRide,
            matchDetails,
            io
        );

        return {
            success: true,
            newRide: newRide,
            newBooking: newBooking,
            matchScore: matchDetails.matchScore
        };
    }

    /**
     * Calculate estimated pickup/dropoff time
     * @param {Object} ride - The ride
     * @param {Number} routeIndex - Index on route
     * @returns {String} Estimated time string
     */
    calculateEstimatedTime(ride, routeIndex) {
        const departureTime = new Date(ride.schedule.departureDateTime);
        const totalDuration = ride.route.duration || 60; // minutes
        const totalPoints = ride.route.geometry?.coordinates?.length || 2;
        
        const estimatedMinutes = (routeIndex / totalPoints) * totalDuration;
        const estimatedTime = new Date(departureTime.getTime() + (estimatedMinutes * 60 * 1000));
        
        return estimatedTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }

    /**
     * Create notifications for reassignment
     * @param {Object} originalBooking - Original booking
     * @param {Object} newBooking - New booking
     * @param {Object} newRide - New ride
     * @param {Object} cancelledRide - Cancelled ride
     * @param {Object} matchDetails - Match details
     * @param {Object} io - Socket.io instance
     */
    async createReassignmentNotifications(originalBooking, newBooking, newRide, cancelledRide, matchDetails, io) {
        // Extract IDs properly (handle both populated and non-populated cases)
        const passengerId = originalBooking.passenger?._id?.toString() || originalBooking.passenger?.toString();
        const newRiderId = newRide.rider?._id?.toString() || newRide.rider?.toString();

        console.log(`   📧 Creating notifications:`);
        console.log(`      Passenger ID: ${passengerId}`);
        console.log(`      New Rider ID: ${newRiderId}`);

        // Get passenger and new rider details
        const [passenger, newRider] = await Promise.all([
            User.findById(passengerId).select('name profile'),
            User.findById(newRiderId).select('name profile')
        ]);

        const passengerName = passenger?.profile?.firstName || passenger?.name || 'Passenger';
        const newRiderName = newRider?.profile?.firstName || newRider?.name || 'Rider';
        const newDepartureTime = new Date(newRide.schedule.departureDateTime).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short'
        });

        // Notification to Passenger - Reassignment successful
        const passengerNotification = await Notification.create({
            user: passengerId,
            type: 'BOOKING_REASSIGNED',
            title: '🔄 Your ride has been reassigned!',
            message: `Your original ride was cancelled, but we found you an alternative! New ride with ${newRiderName} departing at ${newDepartureTime}. Match quality: ${matchDetails.matchQuality || 'GOOD'}.`,
            data: {
                originalBookingId: originalBooking._id,
                newBookingId: newBooking._id,
                originalRideId: cancelledRide._id,
                newRideId: newRide._id,
                matchScore: matchDetails.matchScore,
                matchQuality: matchDetails.matchQuality,
                newDepartureTime: newRide.schedule.departureDateTime,
                newRiderName: newRiderName
            },
            priority: 'HIGH',
            actionUrl: `/bookings/${newBooking._id}`
        });

        // Notification to New Rider - New booking from reassignment
        const riderNotification = await Notification.create({
            user: newRiderId,
            type: 'NEW_BOOKING_REASSIGNED',
            title: '📥 New booking (Reassigned passenger)',
            message: `${passengerName} has been reassigned to your ride after their original ride was cancelled. ${originalBooking.seatsBooked} seat(s) booked.`,
            data: {
                bookingId: newBooking._id,
                rideId: newRide._id,
                passengerId: passengerId,
                passengerName: passengerName,
                seatsBooked: originalBooking.seatsBooked,
                isReassignment: true
            },
            priority: 'HIGH',
            actionUrl: `/rides/${newRide._id}/bookings`
        });

        // Send real-time notifications via Socket.io
        if (io) {
            // Notify passenger
            io.to(`user-${passengerId}`).emit('booking-reassigned', {
                type: 'BOOKING_REASSIGNED',
                notification: passengerNotification,
                originalBooking: {
                    id: originalBooking._id,
                    rideId: cancelledRide._id
                },
                newBooking: {
                    id: newBooking._id,
                    rideId: newRide._id,
                    status: newBooking.status,
                    departureTime: newRide.schedule.departureDateTime,
                    riderName: newRiderName,
                    matchScore: matchDetails.matchScore
                }
            });

            // Notify new rider
            io.to(`user-${newRiderId}`).emit('new-booking', {
                type: 'NEW_BOOKING_REASSIGNED',
                notification: riderNotification,
                booking: {
                    id: newBooking._id,
                    passenger: passengerName,
                    seats: originalBooking.seatsBooked,
                    isReassignment: true
                }
            });
        }

        console.log(`   📧 Notifications sent to passenger ${passengerId} and rider ${newRiderId}`);
    }

    /**
     * Notify passenger when no alternative is found
     * @param {Object} booking - The booking
     * @param {Object} cancelledRide - The cancelled ride
     * @param {Object} io - Socket.io instance
     */
    async notifyNoAlternative(booking, cancelledRide, io) {
        // Extract ID properly (handle both populated and non-populated cases)
        const passengerId = booking.passenger?._id?.toString() || booking.passenger?.toString();

        console.log(`   📧 Notifying no alternative found for passenger: ${passengerId}`);

        // Update booking status
        booking.status = 'CANCELLED';
        booking.cancellation = {
            cancelled: true,
            cancelledBy: 'RIDER',
            cancelledAt: new Date(),
            reason: 'Ride cancelled by rider - No alternative rides available'
        };
        
        // Issue full refund if payment was made
        if (booking.payment.status === 'PAID' || booking.payment.status === 'PAYMENT_CONFIRMED') {
            booking.payment.refund = {
                amount: booking.totalPrice,
                status: 'PENDING',
                initiatedAt: new Date(),
                reason: 'Ride cancelled by rider'
            };
        }
        
        await booking.save();

        // Create notification
        const notification = await Notification.create({
            user: passengerId,
            type: 'RIDE_CANCELLED_NO_ALTERNATIVE',
            title: '❌ Ride Cancelled - No Alternative Found',
            message: `Unfortunately, your ride was cancelled and we couldn't find an alternative ride at this time. A full refund has been initiated. We apologize for the inconvenience.`,
            data: {
                bookingId: booking._id,
                rideId: cancelledRide._id,
                refundAmount: booking.totalPrice,
                cancelledAt: new Date()
            },
            priority: 'HIGH',
            actionUrl: '/search'
        });

        // Send real-time notification
        if (io) {
            io.to(`user-${passengerId}`).emit('ride-cancelled', {
                type: 'RIDE_CANCELLED_NO_ALTERNATIVE',
                notification: notification,
                booking: {
                    id: booking._id,
                    rideId: cancelledRide._id,
                    refundAmount: booking.totalPrice
                },
                message: 'Your ride was cancelled. No alternative rides available. Full refund initiated.'
            });
        }

        console.log(`   📧 No-alternative notification sent to passenger ${passengerId}`);
    }

    /**
     * Get reassignment statistics for a user
     * @param {String} userId - User ID (rider)
     * @returns {Object} Statistics
     */
    async getReassignmentStats(userId) {
        const stats = await Booking.aggregate([
            {
                $match: {
                    'reassignment.originalRide': { $exists: true }
                }
            },
            {
                $lookup: {
                    from: 'rides',
                    localField: 'reassignment.originalRide',
                    foreignField: '_id',
                    as: 'originalRide'
                }
            },
            {
                $unwind: '$originalRide'
            },
            {
                $match: {
                    'originalRide.rider': userId
                }
            },
            {
                $group: {
                    _id: null,
                    totalReassignments: { $sum: 1 },
                    successfulReassignments: {
                        $sum: {
                            $cond: [{ $eq: ['$reassignment.isReassigned', true] }, 1, 0]
                        }
                    }
                }
            }
        ]);

        return stats[0] || { totalReassignments: 0, successfulReassignments: 0 };
    }
}

module.exports = new AutoReassignment();
