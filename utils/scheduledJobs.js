/**
 * Scheduled Jobs for LANE Carpool Platform
 * Handles automatic status updates and cleanup tasks
 */

const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const RefreshToken = require('../models/RefreshToken');

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
        
        if (expiredRides.modifiedCount > 0) {
            console.log(`✅ [Scheduled Job] Expired ${expiredRides.modifiedCount} old rides`);
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
        
        let expiredCount = 0;
        
        for (const booking of expiredBookings) {
            // Expire the booking
            await Booking.findByIdAndUpdate(booking._id, {
                $set: { 
                    status: 'EXPIRED',
                    'cancellation.cancelled': true,
                    'cancellation.cancelledBy': 'SYSTEM',
                    'cancellation.reason': 'Booking request timed out',
                    'cancellation.cancelledAt': new Date()
                }
            });
            
            // Restore seats to ride
            if (booking.ride) {
                await Ride.findByIdAndUpdate(booking.ride._id, {
                    $inc: { 'pricing.availableSeats': booking.seatsBooked }
                });
            }
            
            expiredCount++;
        }
        
        if (expiredCount > 0) {
            console.log(`✅ [Scheduled Job] Expired ${expiredCount} pending bookings`);
        }
        
        return expiredCount;
    } catch (error) {
        console.error('❌ [Scheduled Job] Error expiring bookings:', error.message);
        return 0;
    }
};

/**
 * Clean up orphaned chats (no messages for 30 days after ride completed)
 */
const cleanupOldChats = async (daysOld = 30) => {
    // Implementation for later
    console.log('🧹 [Scheduled Job] Chat cleanup not yet implemented');
    return 0;
};

/**
 * Clean up expired JWT refresh tokens
 * Removes tokens that have passed their expiration date
 */
const cleanupExpiredTokens = async () => {
    try {
        const deletedCount = await RefreshToken.cleanupExpired();
        
        if (deletedCount > 0) {
            console.log(`✅ [Scheduled Job] Cleaned up ${deletedCount} expired refresh tokens`);
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
    console.log('🕐 [Scheduled Jobs] Running scheduled jobs...');
    const startTime = Date.now();
    
    const results = {
        expiredRides: await expireOldRides(),
        expiredBookings: await expirePendingBookings(),
        cleanedChats: await cleanupOldChats(),
        expiredTokens: await cleanupExpiredTokens()
    };
    
    const duration = Date.now() - startTime;
    console.log(`✅ [Scheduled Jobs] Completed in ${duration}ms:`, results);
    
    return results;
};

module.exports = {
    expireOldRides,
    expirePendingBookings,
    cleanupOldChats,
    cleanupExpiredTokens,
    runAllJobs
};
