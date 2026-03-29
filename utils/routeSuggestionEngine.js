/**
 * Route Suggestion Engine
 * Analyzes supply/demand patterns to suggest optimal routes to drivers.
 * When a driver's ride gets 0 bookings, this engine suggests better alternatives.
 */

const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Notification = require('../models/Notification');

/**
 * Analyze route demand and generate suggestions
 * @param {number} lookbackDays - How many days of historical data to analyze
 * @returns {Array} - Routes sorted by demand/supply gap
 */
async function analyzeRouteDemand(lookbackDays = 30) {
    const cutoffDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

    // Get routes with booking data
    const routeStats = await Ride.aggregate([
        {
            $match: {
                createdAt: { $gte: cutoffDate },
                status: { $in: ['ACTIVE', 'COMPLETED', 'FULL'] }
            }
        },
        {
            $lookup: {
                from: 'bookings',
                localField: '_id',
                foreignField: 'ride',
                as: 'bookings'
            }
        },
        {
            $addFields: {
                bookingCount: { $size: '$bookings' },
                confirmedBookings: {
                    $size: {
                        $filter: {
                            input: '$bookings',
                            as: 'b',
                            cond: { $in: ['$$b.status', ['CONFIRMED', 'COMPLETED', 'PICKED_UP', 'DROPPED_OFF']] }
                        }
                    }
                }
            }
        },
        {
            $group: {
                _id: {
                    startCity: { $ifNull: ['$route.start.name', '$route.start.address'] },
                    endCity: { $ifNull: ['$route.destination.name', '$route.destination.address'] },
                    startCoords: '$route.start.coordinates',
                    endCoords: '$route.destination.coordinates'
                },
                totalRides: { $sum: 1 },
                totalBookings: { $sum: '$confirmedBookings' },
                fullRides: {
                    $sum: { $cond: [{ $eq: ['$status', 'FULL'] }, 1, 0] }
                },
                avgPrice: { $avg: '$pricing.pricePerSeat' },
                avgDistance: { $avg: '$route.distance' }
            }
        },
        {
            $addFields: {
                demandScore: {
                    $add: [
                        { $multiply: ['$totalBookings', 2] }, // Weight bookings heavily
                        { $multiply: ['$fullRides', 3] }      // Full rides = very high demand
                    ]
                },
                bookingRate: {
                    $cond: [
                        { $gt: ['$totalRides', 0] },
                        { $divide: ['$totalBookings', '$totalRides'] },
                        0
                    ]
                }
            }
        },
        { $sort: { demandScore: -1 } },
        { $limit: 20 }
    ]);

    return routeStats;
}

/**
 * Generate suggestions for a specific driver based on their ride history
 * @param {string} driverId - The driver's user ID
 * @returns {Array} - Personalized route suggestions
 */
async function generateDriverSuggestions(driverId) {
    // 1. Get the driver's recent rides
    const driverRides = await Ride.find({
        rider: driverId,
        createdAt: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) }
    }).select('route.start route.destination').lean();

    // 2. Get high-demand routes
    const demandRoutes = await analyzeRouteDemand(30);

    // 3. Filter to routes near the driver's usual area
    const suggestions = demandRoutes
        .filter(route => {
            // Only suggest routes with high demand
            return route.bookingRate > 0.3 || route.fullRides > 0;
        })
        .map(route => ({
            route: `${route._id.startCity} → ${route._id.endCity}`,
            startCity: route._id.startCity,
            endCity: route._id.endCity,
            startCoords: route._id.startCoords,
            endCoords: route._id.endCoords,
            demandScore: route.demandScore,
            avgBookingsPerRide: route.bookingRate.toFixed(1),
            fullRides: route.fullRides,
            totalRides: route.totalRides,
            avgPrice: Math.round(route.avgPrice || 0),
            avgDistance: Math.round(route.avgDistance || 0),
            reason: route.fullRides > 2
                ? `This route fills up fast — ${route.fullRides} rides were fully booked recently`
                : `Passengers are actively booking on this route (${route.totalBookings} bookings recently)`
        }))
        .slice(0, 5); // Top 5 suggestions

    return suggestions;
}

/**
 * Auto-notify drivers whose rides have 0 bookings approaching departure
 * Should be called by a scheduled job (e.g., every 6 hours)
 */
async function notifyDriversWithUnbookedRides() {
    const hoursBeforeDeparture = 24;
    const now = new Date();
    const cutoff = new Date(now.getTime() + hoursBeforeDeparture * 60 * 60 * 1000);

    // Find active rides with 0 bookings departing within 24 hours
    const unbookedRides = await Ride.find({
        status: 'ACTIVE',
        'schedule.departureDateTime': {
            $gte: now,
            $lte: cutoff
        }
    }).populate('rider', 'profile.firstName profile.lastName email').lean();

    // Check which rides have 0 confirmed bookings
    const notificationsSent = [];
    for (const ride of unbookedRides) {
        const bookingCount = await Booking.countDocuments({
            ride: ride._id,
            status: { $in: ['PENDING', 'CONFIRMED'] }
        });

        if (bookingCount === 0 && ride.rider) {
            // Get suggestion for this driver
            const suggestions = await generateDriverSuggestions(ride.rider._id || ride.rider);

            if (suggestions.length > 0) {
                const topSuggestion = suggestions[0];

                // Create notification
                await Notification.create({
                    user: ride.rider._id || ride.rider,
                    type: 'SYSTEM_ALERT',
                    title: '💡 Route Suggestion for You',
                    message: `Your ride to ${ride.route?.destination?.name || 'destination'} has no bookings yet. ${topSuggestion.reason}. Consider posting on: ${topSuggestion.route}`,
                    data: {
                        rideId: ride._id,
                        suggestion: topSuggestion
                    }
                });

                notificationsSent.push({
                    driver: ride.rider.profile?.firstName || ride.rider.email,
                    originalRoute: `${ride.route?.start?.name} → ${ride.route?.destination?.name}`,
                    suggestedRoute: topSuggestion.route
                });
            }
        }
    }

    return {
        unbookedRidesChecked: unbookedRides.length,
        notificationsSent: notificationsSent.length,
        details: notificationsSent
    };
}

module.exports = {
    analyzeRouteDemand,
    generateDriverSuggestions,
    notifyDriversWithUnbookedRides
};
