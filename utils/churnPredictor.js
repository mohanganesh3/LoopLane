/**
 * Churn Prediction Service
 * Epic 6: Autonomous Ops & Automated Marketing
 */

const User = require('../models/User');

/**
 * Task 23: Build Churn Prediction Service
 * Flags high-value users who haven't taken a ride recently as "At Risk of Churn".
 * 
 * @param {Number} inactivityDays Days since last ride to consider "at risk"
 * @param {Number} minimumRides Threshold to be considered a "high-value" user
 */
exports.predictChurnAndFlag = async (inactivityDays = 30, minimumRides = 10) => {
    try {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - inactivityDays);

        // Find high value users who are inactive
        // We look for: totalRidesTaken >= minimumRides AND lastRideAt < thresholdDate
        const atRiskUsers = await User.find({
            'statistics.totalRidesTaken': { $gte: minimumRides },
            $or: [
                { 'statistics.lastRideAt': { $lt: thresholdDate } },
                { 'statistics.lastRideAt': { $exists: false }, 'statistics.memberSince': { $lt: thresholdDate } }
            ],
            // Ignore users already flagged so we don't double count
            'riskFlags.churnRisk': { $ne: true }
        });

        const flaggedIds = atRiskUsers.map(u => u._id);

        if (flaggedIds.length > 0) {
            // Flag them in the DB
            await User.updateMany(
                { _id: { $in: flaggedIds } },
                {
                    $set: {
                        'riskFlags.churnRisk': true,
                        'riskFlags.churnRiskDetectedAt': new Date()
                    }
                }
            );

            // Task 24: Implement Automated Lifecycle Email/Push pipelines
            // Trigger winback email directly from here since we detected them
            const emailService = require('../utils/emailService');
            for (const user of atRiskUsers) {
                try {
                    // Send winback promo
                    if (emailService.sendWinbackEmail) {
                        await emailService.sendWinbackEmail(user, {
                            promoCode: 'MISSYOU20',
                            discountPercent: 20
                        });
                    }
                } catch (err) {
                    console.error('Failed to send winback email to', user.email);
                }
            }
        }

        return {
            success: true,
            flaggedCount: flaggedIds.length,
            users: atRiskUsers.map(u => ({
                id: u._id,
                name: `${u.profile.firstName} ${u.profile.lastName}`,
                email: u.email,
                lastRideAt: u.statistics.lastRideAt,
                totalRides: u.statistics.totalRidesTaken
            }))
        };
    } catch (error) {
        console.error('Churn Prediction Error:', error);
        throw error;
    }
};
