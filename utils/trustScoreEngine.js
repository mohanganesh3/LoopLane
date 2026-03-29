/**
 * Composite Trust Score Engine
 * Epic 2: Calculates a holistic trust score (0-100) based on vectors:
 * 1. Verification Level
 * 2. Ride History (Completed vs Cancelled)
 * 3. Peer Ratings
 * 4. Social Graph (LinkedIn/Facebook connections)
 */

const User = require('../models/User');

exports.calculateTrustScore = async (userId) => {
    try {
        const user = await User.findById(userId).select('verificationStatus statistics rating socialConnections badges');
        if (!user) return 0;

        let score = 0;

        // Vector 1: Identity & Verification (Max 30 points)
        if (user.verificationStatus === 'VERIFIED') score += 30;
        else if (user.verificationStatus === 'PARTIALLY_VERIFIED') score += 15;

        // Vector 2: Experience & Reliability (Max 30 points)
        const totalCompleted = user.statistics.completedRides || 0;
        const totalCancelled = user.statistics.cancelledRides || 0;
        const totalRides = totalCompleted + totalCancelled;

        if (totalCompleted > 50) score += 30;
        else if (totalCompleted > 20) score += 20;
        else if (totalCompleted > 5) score += 10;
        else if (totalCompleted > 0) score += 5;

        // Penalty for high cancellation rate
        if (totalRides > 5) {
            const cancelRate = totalCancelled / totalRides;
            if (cancelRate > 0.2) score -= 15;
            else if (cancelRate > 0.1) score -= 5;
        }

        // Vector 3: Peer Reviews (Max 25 points)
        const avgRating = user.rating?.overall || 0;
        const totalRatings = user.rating?.totalRatings || 0;

        if (totalRatings > 5) {
            if (avgRating >= 4.8) score += 25;
            else if (avgRating >= 4.5) score += 20;
            else if (avgRating >= 4.0) score += 10;
            else if (avgRating < 3.5) score -= 20; // Severe penalty for bad actors
        } else if (totalRatings > 0 && avgRating >= 4.0) {
            score += 10; // New but good
        }

        // Vector 4: Social Graph Verification (Max 15 points)
        let socialScore = 0;
        if (user.socialConnections && user.socialConnections.length > 0) {
            user.socialConnections.forEach(conn => {
                if (conn.provider === 'LINKEDIN') {
                    socialScore += 10; // High trust signal
                    if (conn.connectionCount > 500) socialScore += 5;
                }
                if (conn.provider === 'FACEBOOK') {
                    socialScore += 5; // Medium trust signal
                }
            });
        }
        score += Math.min(socialScore, 15);

        // Vector 5: Badges (Bonus)
        if (user.badges && user.badges.length > 0) {
            score += Math.min(user.badges.length * 2, 10);
        }

        // Clamp final score between 10 and 100 (never 0 unless brand new unverified)
        const finalScore = Math.max(10, Math.min(100, Math.round(score)));

        // Determine Level
        let level = 'NEWCOMER';
        if (finalScore >= 90) level = 'EXPERT';
        else if (finalScore >= 75) level = 'AMBASSADOR';
        else if (finalScore >= 50) level = 'EXPERIENCED';
        else if (finalScore >= 30) level = 'REGULAR';

        // Update user record
        await User.findByIdAndUpdate(userId, {
            $set: {
                'trustScore.score': finalScore,
                'trustScore.level': level,
                'trustScore.lastCalculated': new Date(),
                'trustScore.factors.socialBonus': Math.min(socialScore, 15)
            }
        });

        return finalScore;

    } catch (error) {
        console.error('Trust Score Engine Error:', error);
        return 50; // Safe fallback
    }
};
