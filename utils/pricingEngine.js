/**
 * Dynamic Pricing Engine
 * Epic 5: Behavioral Economics & Gamification
 */

/**
 * Task 19: Time-Decay Pricing Algorithm
 * Drops the price of a seat as the departure time approaches to incentivize filling empty seats.
 * 
 * @param {Number} basePrice Original requested price
 * @param {Date} departureTime When the ride leaves
 * @param {Number} availableSeats How many seats are left
 * @returns {Number} Discounted price
 */
exports.calculateTimeDecayPrice = (basePrice, departureTime, availableSeats) => {
    if (!basePrice || !departureTime || availableSeats <= 0) return basePrice;

    const hoursUntilDeparture = (new Date(departureTime) - new Date()) / (1000 * 60 * 60);

    // Only apply decay if less than 24 hours away
    if (hoursUntilDeparture > 24 || hoursUntilDeparture <= 0) {
        return basePrice;
    }

    // Decay curve:
    // 24h away -> 0% discount
    // 12h away -> 10% discount
    // 6h away -> 20% discount
    // < 2h away -> 35% discount (Max panic to fill seat)

    let discountPercent = 0;

    if (hoursUntilDeparture <= 2) {
        discountPercent = 35;
    } else if (hoursUntilDeparture <= 6) {
        discountPercent = 20;
    } else if (hoursUntilDeparture <= 12) {
        discountPercent = 10;
    } else {
        // Linear decay between 12h and 24h (from 10% to 0%)
        discountPercent = 10 * ((24 - hoursUntilDeparture) / 12);
    }

    // If multiple seats are empty close to departure, discount even heavier
    if (availableSeats > 2 && hoursUntilDeparture <= 12) {
        discountPercent += 5;
    }

    const discountMultiplier = (100 - discountPercent) / 100;
    const finalPrice = Math.round(basePrice * discountMultiplier);

    return {
        originalPrice: basePrice,
        finalPrice: finalPrice,
        discountApplied: discountPercent > 0,
        discountPercent: Math.round(discountPercent),
        reason: 'TIME_DECAY'
    };
};

/**
 * Task 20: Automated Surge Pricing Calculus
 * @param {Number} basePrice 
 * @param {Number} localSupply Count of active rides in the hexbin 
 * @param {Number} localDemand Count of pending requests in the hexbin
 */
exports.calculateSurgeMultiplier = (basePrice, localSupply, localDemand) => {
    if (localSupply === 0) return basePrice * 2.0; // Max surge if zero supply

    const ratio = localDemand / localSupply;

    // Surge Curve
    let multiplier = 1.0;

    if (ratio > 5.0) multiplier = 2.0;      // Extreme Demand
    else if (ratio > 3.0) multiplier = 1.5; // High Demand
    else if (ratio > 1.5) multiplier = 1.2; // Moderate Demand
    else if (ratio < 0.5) multiplier = 0.9; // Oversupply (Markdown)

    const finalPrice = Math.round(basePrice * multiplier);

    return {
        originalPrice: basePrice,
        finalPrice: finalPrice,
        multiplier,
        isSurging: multiplier > 1.0,
        reason: multiplier > 1.0 ? 'HIGH_DEMAND' : 'NORMAL'
    };
};
