/**
 * Fraud Detection Engine (Autonomous Ops)
 * Epic 6: Autonomous Ops & Automated Marketing
 */

const Booking = require('../models/Booking');
const User = require('../models/User');

/**
 * Task 22: Detect Closed-Loop Financial Fraud Rings
 * Identifies users who exclusively ride with each other to farm loyalty points,
 * launder credits, or exploit corporate subsidies.
 * 
 * @param {Number} threshold Minimum rides between same pair to flag
 * @param {Number} days Time window to analyze
 */
exports.detectClosedLoopFraud = async (threshold = 5, days = 30) => {
    try {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - days);

        // Fetch all completed bookings in the last X days
        const recentBookings = await Booking.find({
            status: 'COMPLETED',
            createdAt: { $gte: sinceDate }
        }).select('passenger rider ride');

        // Build Adjacency Matrix
        // structure: { 'userId1': { 'userId2': count, 'userId3': count, totalRides: count } }
        const userGraphs = {};

        recentBookings.forEach(booking => {
            const passengerId = booking.passenger.toString();
            const riderId = booking.rider.toString();

            // Init passenger
            if (!userGraphs[passengerId]) {
                userGraphs[passengerId] = { totalRides: 0, partners: {} };
            }
            // Init rider
            if (!userGraphs[riderId]) {
                userGraphs[riderId] = { totalRides: 0, partners: {} };
            }

            // Increment passenger -> rider link
            userGraphs[passengerId].partners[riderId] = (userGraphs[passengerId].partners[riderId] || 0) + 1;
            userGraphs[passengerId].totalRides++;

            // Increment rider -> passenger link
            userGraphs[riderId].partners[passengerId] = (userGraphs[riderId].partners[passengerId] || 0) + 1;
            userGraphs[riderId].totalRides++;
        });

        const suspiciousPairs = [];
        const flaggedUserIds = new Set();

        // Analyze Matrix for "Ring" behavior
        for (const [userId, data] of Object.entries(userGraphs)) {
            // Find partners they ride with frequently
            Object.keys(data.partners).forEach(partnerId => {
                const sharedRides = data.partners[partnerId];

                // If they took > 'threshold' rides together
                if (sharedRides >= threshold) {

                    // Check isolation ratio (Do they ONLY ride with each other?)
                    const isolationRatioNodeA = sharedRides / data.totalRides;
                    const partnerData = userGraphs[partnerId];
                    const isolationRatioNodeB = sharedRides / partnerData.totalRides;

                    // If both users have > 80% of their rides exclusively with each other
                    if (isolationRatioNodeA > 0.8 && isolationRatioNodeB > 0.8) {
                        const pairHash = [userId, partnerId].sort().join('-');

                        // Prevent duplicate pairs in array
                        if (!suspiciousPairs.find(p => p.hash === pairHash)) {
                            suspiciousPairs.push({
                                hash: pairHash,
                                userA: userId,
                                userB: partnerId,
                                ridesTogether: sharedRides,
                                isolationRatioA: Math.round(isolationRatioNodeA * 100),
                                isolationRatioB: Math.round(isolationRatioNodeB * 100)
                            });

                            flaggedUserIds.add(userId);
                            flaggedUserIds.add(partnerId);
                        }
                    }
                }
            });
        }

        // Flag the users in DB for Admin review
        if (flaggedUserIds.size > 0) {
            await User.updateMany(
                { _id: { $in: Array.from(flaggedUserIds) } },
                { $set: { 'riskFlags.fraudFlag': true, 'riskFlags.fraudReason': 'Closed-loop riding detected' } }
            );
        }

        return {
            success: true,
            analyzedBookings: recentBookings.length,
            suspiciousPairsFound: suspiciousPairs.length,
            details: suspiciousPairs
        };

    } catch (error) {
        console.error('Fraud Detection Error:', error);
        throw error;
    }
};
