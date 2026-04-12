/**
 * Scheduled Jobs for LANE Carpool Platform
 * Handles automatic status updates and cleanup tasks
 */

const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const RefreshToken = require('../models/RefreshToken');
const Notification = require('../models/Notification');
const Chat = require('../models/Chat');

/**
 * Mark rides as expired if departure time has passed
 * Should be run periodically (e.g., every 5 minutes)
 */
const expireOldRides = async () => {
    const now = new Date();

    try {
        // Find ACTIVE rides where departure time has passed (with 30 min buffer)
        const bufferTime = new Date(now.getTime() - 30 * 60 * 1000); // 30 mins ago

        const expiredRides = await Ride.updateMany(
            {
                status: 'ACTIVE',
                'schedule.departureDateTime': { $lt: bufferTime }
            },
            {
                $set: { status: 'EXPIRED' }
            }
        );

        // Also cancel any confirmed/pending bookings on expired rides
        if (expiredRides.modifiedCount > 0) {
            const expiredRideIds = await Ride.find({ status: 'EXPIRED', 'schedule.departureDateTime': { $lt: bufferTime } }).select('_id');
            const rideIds = expiredRideIds.map(r => r._id);

            const orphanedBookings = await Booking.find({
                ride: { $in: rideIds },
                status: { $in: ['PENDING', 'CONFIRMED'] }
            });

            for (const booking of orphanedBookings) {
                booking.status = 'EXPIRED';
                booking.cancellation = {
                    cancelled: true,
                    cancelledBy: 'SYSTEM',
                    reason: 'Ride expired — departure time passed',
                    cancelledAt: new Date()
                };
                await booking.save();

                // Notify passenger
                try {
                    await Notification.create({
                        user: booking.passenger,
                        type: 'SYSTEM_ALERT',
                        title: 'Booking Expired',
                        message: 'Your booking has expired because the ride departure time has passed.',
                        data: { bookingId: booking._id, rideId: booking.ride },
                        priority: 'NORMAL'
                    });
                } catch (_) { /* notification failure is non-critical */ }
            }
        }

        return expiredRides.modifiedCount;
    } catch (error) {
        console.error('❌ [Scheduled Job] Error expiring rides:', error.message);
        return 0;
    }
};

/**
 * Expire pending bookings that haven't been responded to
 * Default timeout: 15 minutes (configurable)
 */
const expirePendingBookings = async (timeoutMinutes = 15) => {
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - timeoutMinutes * 60 * 1000);

    try {
        // Find PENDING bookings older than timeout
        const expiredBookings = await Booking.find({
            status: 'PENDING',
            createdAt: { $lt: cutoffTime }
        }).populate('ride');

        if (expiredBookings.length === 0) return 0;

        // Bulk expire all bookings (status guard prevents race conditions)
        const bookingOps = expiredBookings.map(booking => ({
            updateOne: {
                filter: { _id: booking._id, status: 'PENDING' },
                update: {
                    $set: {
                        status: 'EXPIRED',
                        'cancellation.cancelled': true,
                        'cancellation.cancelledBy': 'SYSTEM',
                        'cancellation.reason': 'Booking request timed out',
                        'cancellation.cancelledAt': new Date()
                    }
                }
            }
        }));

        // Aggregate seats to restore per ride
        const rideSeats = {};
        for (const booking of expiredBookings) {
            if (booking.ride) {
                const rideId = booking.ride._id.toString();
                rideSeats[rideId] = (rideSeats[rideId] || 0) + booking.seatsBooked;
            }
        }
        const rideOps = Object.entries(rideSeats).map(([rideId, seats]) => ({
            updateOne: {
                filter: { _id: rideId },
                update: { $inc: { 'pricing.availableSeats': seats } }
            }
        }));

        await Booking.bulkWrite(bookingOps);
        if (rideOps.length > 0) {
            await Ride.bulkWrite(rideOps);
        }

        return expiredBookings.length;
    } catch (error) {
        console.error('❌ [Scheduled Job] Error expiring bookings:', error.message);
        return 0;
    }
};

/**
 * Auto-complete rides stuck in IN_PROGRESS for too long
 * If a ride has been IN_PROGRESS for more than 2x its estimated duration (or 24 hours max),
 * auto-complete it and notify the rider.
 */
const autoCompleteStaleRides = async () => {
    const now = new Date();
    const MAX_RIDE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours absolute max

    try {
        // Find IN_PROGRESS rides
        const staleRides = await Ride.find({
            status: 'IN_PROGRESS',
            'schedule.departureDateTime': { $exists: true }
        });

        let completedCount = 0;

        for (const ride of staleRides) {
            const departureTime = new Date(ride.schedule.departureDateTime);
            const estimatedDurationMs = (ride.route?.duration || 120) * 60 * 1000; // default 2 hours
            const maxAllowedMs = Math.min(estimatedDurationMs * 2, MAX_RIDE_DURATION_MS);
            const elapsed = now - departureTime;

            if (elapsed > maxAllowedMs) {
                ride.status = 'COMPLETED';
                await ride.save();

                // Also complete all confirmed bookings on this ride
                const bookings = await Booking.find({
                    ride: ride._id,
                    status: { $in: ['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING', 'DROPPED_OFF'] }
                });

                for (const booking of bookings) {
                    booking.status = 'COMPLETED';
                    await booking.save();
                }

                // Notify rider
                try {
                    await Notification.create({
                        user: ride.rider,
                        type: 'RIDE_COMPLETED',
                        title: 'Ride Auto-Completed',
                        message: `Your ride was automatically marked as completed after ${Math.round(elapsed / 3600000)} hours.`,
                        data: { rideId: ride._id },
                        priority: 'NORMAL'
                    });
                } catch (_) { /* non-critical */ }

                completedCount++;
            }
        }

        return completedCount;
    } catch (error) {
        console.error('❌ [Scheduled Job] Error auto-completing stale rides:', error.message);
        return 0;
    }
};

/**
 * Clean up orphaned chats (no messages for 30 days after ride completed)
 */
const cleanupOldChats = async (daysOld = 30) => {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

    try {
        // Find inactive chats with no messages for daysOld days
        const staleChats = await Chat.find({
            isActive: true,
            lastMessageAt: { $lt: cutoff }
        });

        if (staleChats.length === 0) return 0;

        const chatOps = staleChats.map(chat => ({
            updateOne: {
                filter: { _id: chat._id, isActive: true },
                update: {
                    $set: { isActive: false },
                    $addToSet: { archivedBy: { $each: chat.participants || [] } }
                }
            }
        }));

        const result = await Chat.bulkWrite(chatOps);
        return result.modifiedCount;
    } catch (error) {
        console.error('\u274c [Scheduled Job] Error cleaning up old chats:', error.message);
        return 0;
    }
};

/**
 * Clean up expired JWT refresh tokens
 * Removes tokens that have passed their expiration date
 */
const cleanupExpiredTokens = async () => {
    try {
        const deletedCount = await RefreshToken.cleanupExpired();

        if (deletedCount > 0) {
        }

        return deletedCount;
    } catch (error) {
        console.error('❌ [Scheduled Job] Error cleaning up tokens:', error.message);
        return 0;
    }
};

/**
 * Run all scheduled jobs
 */
const runAllJobs = async () => {
    const startTime = Date.now();

    const results = {
        expiredRides: await expireOldRides(),
        expiredBookings: await expirePendingBookings(),
        autoCompleted: await autoCompleteStaleRides(),
        cleanedChats: await cleanupOldChats(),
        expiredTokens: await cleanupExpiredTokens()
    };

    const duration = Date.now() - startTime;

    return results;
};

module.exports = {
    expireOldRides,
    expirePendingBookings,
    autoCompleteStaleRides,
    cleanupOldChats,
    cleanupExpiredTokens,
    runAllJobs
};
