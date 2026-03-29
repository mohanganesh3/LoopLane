/**
 * Trust Score Calculator
 * Calculates user trust score based on multiple factors
 * Similar to BlaBlaCar's trust system and Uber's ratings
 */

const User = require('../models/User');

// Badge definitions
const BADGES = {
    VERIFIED_ID: { name: 'Verified Identity', description: 'Government ID verified', icon: '🪪' },
    VERIFIED_LICENSE: { name: 'Licensed Driver', description: 'Driving license verified', icon: '🚗' },
    VERIFIED_VEHICLE: { name: 'Verified Vehicle', description: 'Vehicle documents verified', icon: '✅' },
    FIRST_RIDE: { name: 'First Ride', description: 'Completed your first ride', icon: '🎉' },
    TEN_RIDES: { name: 'Road Regular', description: 'Completed 10 rides', icon: '🏅' },
    FIFTY_RIDES: { name: 'Frequent Traveler', description: 'Completed 50 rides', icon: '🏆' },
    HUNDRED_RIDES: { name: 'Road Warrior', description: 'Completed 100 rides', icon: '👑' },
    FIVE_STAR_DRIVER: { name: '5-Star Driver', description: 'Maintained 5-star rating', icon: '⭐' },
    ECO_CHAMPION: { name: 'Eco Champion', description: 'Saved 100kg+ CO2', icon: '🌱' },
    SUPER_HOST: { name: 'Super Host', description: 'Top-rated with 50+ rides', icon: '🌟' },
    QUICK_RESPONDER: { name: 'Quick Responder', description: 'Responds within 1 hour', icon: '⚡' },
    RELIABLE_DRIVER: { name: 'Reliable', description: 'Less than 5% cancellation rate', icon: '💎' },
    TOP_RATED: { name: 'Top Rated', description: 'In top 10% of drivers', icon: '🥇' },
    EARLY_ADOPTER: { name: 'Early Adopter', description: 'Joined in the first year', icon: '🚀' },
    COMMUNITY_HELPER: { name: 'Community Helper', description: 'Helped other users', icon: '🤝' }
};

// Trust level thresholds
const TRUST_LEVELS = {
    NEWCOMER: { min: 0, max: 20, label: 'Newcomer', color: '#9CA3AF' },
    REGULAR: { min: 21, max: 40, label: 'Regular', color: '#60A5FA' },
    EXPERIENCED: { min: 41, max: 60, label: 'Experienced', color: '#34D399' },
    AMBASSADOR: { min: 61, max: 80, label: 'Ambassador', color: '#F59E0B' },
    EXPERT: { min: 81, max: 100, label: 'Expert', color: '#8B5CF6' }
};

/**
 * Calculate profile completeness score (0-20 points)
 */
const calculateProfileScore = (user) => {
    let score = 0;
    
    // Basic info (5 points)
    if (user.profile?.firstName && user.profile?.lastName) score += 2;
    if (user.profile?.photo && user.profile.photo !== '/images/default-avatar.png') score += 2;
    if (user.profile?.bio && user.profile.bio.length > 20) score += 1;
    
    // Contact verification (5 points)
    if (user.emailVerified) score += 2.5;
    if (user.phoneVerified) score += 2.5;
    
    // Additional profile info (5 points)
    if (user.profile?.dateOfBirth) score += 1;
    if (user.profile?.gender) score += 1;
    if (user.profile?.address?.city) score += 1;
    if (user.emergencyContacts?.length > 0) score += 2;
    
    // Vehicle info for riders (5 points)
    if (user.role === 'RIDER' && user.vehicles?.length > 0) {
        const vehicle = user.vehicles[0];
        if (vehicle.make && vehicle.model) score += 2;
        if (vehicle.licensePlate) score += 1.5;
        if (vehicle.photos?.length > 0) score += 1.5;
    } else if (user.role === 'PASSENGER') {
        score += 5; // Passengers get full points if they don't need vehicle
    }
    
    return Math.min(score, 20);
};

/**
 * Calculate verification bonus score (0-20 points)
 */
const calculateVerificationScore = (user) => {
    let score = 0;
    
    // Email & Phone verification (4 points each)
    if (user.emailVerified) score += 4;
    if (user.phoneVerified) score += 4;
    
    // Document verification for riders (12 points)
    if (user.role === 'RIDER') {
        if (user.documents?.driverLicense?.status === 'APPROVED') score += 4;
        if (user.documents?.governmentId?.status === 'APPROVED') score += 4;
        if (user.vehicles?.some(v => v.status === 'APPROVED')) score += 4;
    } else {
        // Passengers get verification points for ID
        if (user.verificationStatus === 'VERIFIED') score += 12;
    }
    
    return Math.min(score, 20);
};

/**
 * Calculate rating bonus score (0-20 points)
 */
const calculateRatingScore = (user) => {
    const rating = user.rating?.overall || 0;
    const totalRatings = user.rating?.totalRatings || 0;
    
    if (totalRatings === 0) return 5; // Neutral score for new users
    
    // Rating contribution (0-15 points)
    const ratingPoints = (rating / 5) * 15;
    
    // Volume bonus (0-5 points) - more ratings = more reliable score
    const volumeBonus = Math.min(totalRatings / 20, 1) * 5;
    
    return Math.min(ratingPoints + volumeBonus, 20);
};

/**
 * Calculate experience bonus score (0-20 points)
 */
const calculateExperienceScore = (user) => {
    const completedRides = user.statistics?.completedRides || 0;
    
    // Completed rides contribution
    if (completedRides >= 100) return 20;
    if (completedRides >= 50) return 16;
    if (completedRides >= 25) return 12;
    if (completedRides >= 10) return 8;
    if (completedRides >= 5) return 4;
    if (completedRides >= 1) return 2;
    
    return 0;
};

/**
 * Calculate reliability bonus score (0-20 points)
 */
const calculateReliabilityScore = (user) => {
    const cancellationRate = user.cancellationRate?.rate || 0;
    const totalBookings = user.cancellationRate?.totalBookings || 0;
    
    // New users get neutral score
    if (totalBookings < 3) return 10;
    
    // Cancellation rate penalty
    if (cancellationRate <= 2) return 20; // Excellent
    if (cancellationRate <= 5) return 16; // Very Good
    if (cancellationRate <= 10) return 12; // Good
    if (cancellationRate <= 20) return 8; // Fair
    if (cancellationRate <= 30) return 4; // Poor
    
    return 0; // Very Poor
};

/**
 * Determine trust level based on score
 */
const getTrustLevel = (score) => {
    if (score >= 81) return 'EXPERT';
    if (score >= 61) return 'AMBASSADOR';
    if (score >= 41) return 'EXPERIENCED';
    if (score >= 21) return 'REGULAR';
    return 'NEWCOMER';
};

/**
 * Calculate full trust score for a user
 */
const calculateTrustScore = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return null;
    
    const factors = {
        profileComplete: calculateProfileScore(user),
        verificationBonus: calculateVerificationScore(user),
        ratingBonus: calculateRatingScore(user),
        experienceBonus: calculateExperienceScore(user),
        reliabilityBonus: calculateReliabilityScore(user)
    };
    
    const totalScore = Math.round(
        factors.profileComplete +
        factors.verificationBonus +
        factors.ratingBonus +
        factors.experienceBonus +
        factors.reliabilityBonus
    );
    
    const level = getTrustLevel(totalScore);
    
    // Only save if score or level actually changed
    if (user.trustScore?.score !== totalScore || user.trustScore?.level !== level) {
        user.trustScore = {
            level,
            score: totalScore,
            lastCalculated: new Date(),
            factors
        };
        
        await user.save();
    }
    
    return {
        level,
        score: totalScore,
        factors,
        levelInfo: TRUST_LEVELS[level]
    };
};

/**
 * Award badge to user if not already earned
 */
const awardBadge = async (userId, badgeType) => {
    if (!BADGES[badgeType]) return null;
    
    const user = await User.findById(userId);
    if (!user) return null;
    
    // Check if already has badge
    const hasBadge = user.badges?.some(b => b.type === badgeType);
    if (hasBadge) return null;
    
    // Award badge
    if (!user.badges) user.badges = [];
    user.badges.push({
        type: badgeType,
        earnedAt: new Date(),
        description: BADGES[badgeType].description
    });
    
    await user.save();
    
    return {
        badge: badgeType,
        ...BADGES[badgeType],
        earnedAt: new Date()
    };
};

/**
 * Check and award applicable badges based on user activity
 * Batched: single findById, evaluate all criteria in memory, single save
 */
const checkAndAwardBadges = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return [];
    
    const existingBadgeTypes = new Set((user.badges || []).map(b => b.type));
    const newBadges = [];
    
    const mayAward = (type) => {
        if (!BADGES[type] || existingBadgeTypes.has(type)) return;
        newBadges.push({
            type,
            earnedAt: new Date(),
            description: BADGES[type].description
        });
        existingBadgeTypes.add(type);
    };
    
    // Verification badges
    if (user.documents?.governmentId?.status === 'APPROVED') mayAward('VERIFIED_ID');
    if (user.documents?.driverLicense?.status === 'APPROVED') mayAward('VERIFIED_LICENSE');
    if (user.vehicles?.some(v => v.status === 'APPROVED')) mayAward('VERIFIED_VEHICLE');
    
    // Ride milestone badges
    const completedRides = user.statistics?.completedRides || 0;
    if (completedRides >= 1) mayAward('FIRST_RIDE');
    if (completedRides >= 10) mayAward('TEN_RIDES');
    if (completedRides >= 50) mayAward('FIFTY_RIDES');
    if (completedRides >= 100) mayAward('HUNDRED_RIDES');
    
    // Rating badges
    if (user.rating?.overall >= 4.9 && user.rating?.totalRatings >= 10) mayAward('FIVE_STAR_DRIVER');
    
    // Eco badge
    if ((user.statistics?.carbonSaved || 0) >= 100) mayAward('ECO_CHAMPION');
    
    // Super host badge
    if (completedRides >= 50 && (user.rating?.overall || 0) >= 4.5) mayAward('SUPER_HOST');
    
    // Quick responder badge
    if (user.responseMetrics?.quickResponder) mayAward('QUICK_RESPONDER');
    
    // Reliable driver badge
    if ((user.cancellationRate?.rate || 0) <= 5 && (user.cancellationRate?.totalBookings || 0) >= 10) mayAward('RELIABLE_DRIVER');
    
    // Single save for all new badges
    if (newBadges.length > 0) {
        if (!user.badges) user.badges = [];
        user.badges.push(...newBadges);
        await user.save();
    }
    
    // Also update loyalty tier based on completed rides
    await updateLoyaltyTier(userId);

    return newBadges.map(b => ({
        badge: b.type,
        ...BADGES[b.type],
        earnedAt: b.earnedAt
    }));
};

/**
 * Update gamification loyalty tier based on completed rides.
 * BLUE: 0-9 rides, GOLD: 10-49 rides, PLATINUM: 50+ rides
 */
const updateLoyaltyTier = async (userId) => {
    const user = await User.findById(userId).select('statistics.completedRides gamification');
    if (!user) return null;

    const completedRides = user.statistics?.completedRides || 0;
    let newTier;
    let nextTierProgress;

    if (completedRides >= 50) {
        newTier = 'PLATINUM';
        nextTierProgress = 100;
    } else if (completedRides >= 10) {
        newTier = 'GOLD';
        nextTierProgress = Math.round(((completedRides - 10) / 40) * 100); // 10→50 = 0→100%
    } else {
        newTier = 'BLUE';
        nextTierProgress = Math.round((completedRides / 10) * 100); // 0→10 = 0→100%
    }

    const currentTier = user.gamification?.tier || 'BLUE';
    if (currentTier !== newTier || (user.gamification?.nextTierProgress || 0) !== nextTierProgress) {
        await User.findByIdAndUpdate(userId, {
            $set: {
                'gamification.tier': newTier,
                'gamification.nextTierProgress': nextTierProgress
            }
        });
    }

    return { tier: newTier, nextTierProgress };
};

/**
 * Update cancellation rate when a booking is cancelled
 */
const updateCancellationRate = async (userId, rideId, reason, wasLastMinute = false) => {
    const user = await User.findById(userId);
    if (!user) return null;
    
    if (!user.cancellationRate) {
        user.cancellationRate = {
            totalBookings: 0,
            cancelledByUser: 0,
            rate: 0,
            recentCancellations: []
        };
    }
    
    user.cancellationRate.cancelledByUser += 1;
    user.cancellationRate.rate = Math.round(
        (user.cancellationRate.cancelledByUser / Math.max(user.cancellationRate.totalBookings, 1)) * 100
    );
    user.cancellationRate.lastUpdated = new Date();
    
    // Add to recent cancellations (keep last 5)
    user.cancellationRate.recentCancellations.unshift({
        rideId,
        reason,
        cancelledAt: new Date(),
        wasLastMinute
    });
    
    if (user.cancellationRate.recentCancellations.length > 5) {
        user.cancellationRate.recentCancellations = user.cancellationRate.recentCancellations.slice(0, 5);
    }
    
    await user.save();
    
    return user.cancellationRate;
};

/**
 * Increment totalBookings counter so cancellation rate stays accurate.
 * Call this every time a booking is successfully created.
 */
const incrementTotalBookings = async (userId) => {
    await User.findByIdAndUpdate(userId, {
        $inc: { 'cancellationRate.totalBookings': 1 }
    });
};

/**
 * Update response time when user responds to a booking request
 */
const updateResponseTime = async (userId, responseTimeMinutes) => {
    const user = await User.findById(userId);
    if (!user) return null;
    
    if (!user.responseMetrics) {
        user.responseMetrics = {
            averageResponseTime: 0,
            totalResponses: 0,
            quickResponder: false
        };
    }
    
    const totalResponses = user.responseMetrics.totalResponses + 1;
    const newAverage = (
        (user.responseMetrics.averageResponseTime * user.responseMetrics.totalResponses) + responseTimeMinutes
    ) / totalResponses;
    
    user.responseMetrics = {
        averageResponseTime: Math.round(newAverage),
        totalResponses,
        quickResponder: newAverage <= 60, // Quick if average response < 1 hour
        lastResponseAt: new Date()
    };
    
    await user.save();
    
    // Check for quick responder badge
    if (user.responseMetrics.quickResponder && user.responseMetrics.totalResponses >= 5) {
        await awardBadge(userId, 'QUICK_RESPONDER');
    }
    
    return user.responseMetrics;
};

/**
 * Calculate recommended price per seat based on distance (like BlaBlaCar)
 * Using ₹2.5/km as base rate
 */
const calculateRecommendedPrice = (distanceKm, vehicleType = 'SEDAN') => {
    // Base rate per km (in INR)
    const baseRates = {
        MOTORCYCLE: 1.5,
        AUTO: 2.0,
        HATCHBACK: 2.0,
        SEDAN: 2.5,
        SUV: 3.0,
        MPV: 2.8,
        VAN: 3.5,
        LUXURY: 4.0
    };
    
    const baseRate = baseRates[vehicleType] || 2.5;
    
    // Calculate base price
    let recommendedPrice = Math.round(distanceKm * baseRate);
    
    // Minimum price
    if (recommendedPrice < 50) recommendedPrice = 50;
    
    // Round to nearest 10
    recommendedPrice = Math.round(recommendedPrice / 10) * 10;
    
    // Calculate range (±20%)
    const minPrice = Math.round(recommendedPrice * 0.8);
    const maxPrice = Math.round(recommendedPrice * 1.2);
    
    return {
        recommended: recommendedPrice,
        min: minPrice,
        max: maxPrice,
        perKm: baseRate,
        currency: 'INR'
    };
};

module.exports = {
    BADGES,
    TRUST_LEVELS,
    calculateTrustScore,
    awardBadge,
    checkAndAwardBadges,
    updateCancellationRate,
    incrementTotalBookings,
    updateLoyaltyTier,
    updateResponseTime,
    calculateRecommendedPrice,
    getTrustLevel
};
