/**
 * Tests for utils/pricingEngine
 * Covers: time-decay pricing, surge pricing, edge cases
 */

const {
    calculateTimeDecayPrice,
    calculateSurgeMultiplier
} = require('../utils/pricingEngine');

function futureTime(hoursFromNow) {
    return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
}

describe('utils/pricingEngine', () => {

    // ──────────────────────────────────────────────────────────────
    // calculateTimeDecayPrice
    // ──────────────────────────────────────────────────────────────
    describe('calculateTimeDecayPrice', () => {
        test('returns basePrice unchanged when departure is > 24 hours away', () => {
            const result = calculateTimeDecayPrice(500, futureTime(25), 2);
            expect(result).toBe(500);
        });

        test('returns basePrice unchanged when departure is in the past', () => {
            const result = calculateTimeDecayPrice(500, futureTime(-1), 2);
            expect(result).toBe(500);
        });

        test('returns basePrice unchanged when no seats available', () => {
            const result = calculateTimeDecayPrice(500, futureTime(5), 0);
            expect(result).toBe(500);
        });

        test('returns basePrice when basePrice is falsy', () => {
            expect(calculateTimeDecayPrice(0, futureTime(5), 2)).toBe(0);
            expect(calculateTimeDecayPrice(null, futureTime(5), 2)).toBe(null);
        });

        test('applies 35% discount when < 2 hours away', () => {
            const result = calculateTimeDecayPrice(1000, futureTime(1), 1);
            expect(result.discountPercent).toBe(35);
            expect(result.finalPrice).toBe(650);
            expect(result.reason).toBe('TIME_DECAY');
        });

        test('applies 20% discount when 6 hours away', () => {
            const result = calculateTimeDecayPrice(1000, futureTime(5), 1);
            expect(result.discountPercent).toBe(20);
            expect(result.finalPrice).toBe(800);
        });

        test('applies 10% discount when 10 hours away', () => {
            const result = calculateTimeDecayPrice(1000, futureTime(10), 1);
            expect(result.discountPercent).toBe(10);
            expect(result.finalPrice).toBe(900);
        });

        test('applies additional 5% when > 2 seats available and within 12 hours', () => {
            // 10h away → 10% base, +5% for >2 seats = 15%
            const result = calculateTimeDecayPrice(1000, futureTime(10), 3);
            expect(result.discountPercent).toBe(15);
            expect(result.finalPrice).toBe(850);
        });

        test('includes originalPrice in the result', () => {
            const result = calculateTimeDecayPrice(900, futureTime(1), 1);
            expect(result.originalPrice).toBe(900);
            expect(result.discountApplied).toBe(true);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // calculateSurgeMultiplier
    // ──────────────────────────────────────────────────────────────
    describe('calculateSurgeMultiplier', () => {
        test('applies 2x multiplier when supply is zero', () => {
            const result = calculateSurgeMultiplier(100, 0, 10);
            expect(result).toBe(200);
        });

        test('applies 2x surge for extreme demand (ratio > 5)', () => {
            const result = calculateSurgeMultiplier(100, 1, 10); // ratio = 10
            expect(result.multiplier).toBe(2.0);
            expect(result.finalPrice).toBe(200);
            expect(result.isSurging).toBe(true);
        });

        test('applies 1.5x for high demand (ratio > 3)', () => {
            const result = calculateSurgeMultiplier(100, 2, 8); // ratio = 4
            expect(result.multiplier).toBe(1.5);
            expect(result.finalPrice).toBe(150);
        });

        test('applies 1.2x for moderate demand (ratio > 1.5)', () => {
            const result = calculateSurgeMultiplier(100, 2, 4); // ratio = 2
            expect(result.multiplier).toBe(1.2);
            expect(result.finalPrice).toBe(120);
        });

        test('applies 0.9x markdown for oversupply (ratio < 0.5)', () => {
            const result = calculateSurgeMultiplier(100, 10, 2); // ratio = 0.2
            expect(result.multiplier).toBe(0.9);
            expect(result.finalPrice).toBe(90);
            expect(result.isSurging).toBe(false);
        });

        test('applies 1x multiplier for balanced supply/demand', () => {
            const result = calculateSurgeMultiplier(100, 4, 4); // ratio = 1
            expect(result.multiplier).toBe(1.0);
            expect(result.finalPrice).toBe(100);
            expect(result.isSurging).toBe(false);
        });

        test('includes originalPrice and reason in result', () => {
            const result = calculateSurgeMultiplier(200, 1, 10);
            expect(result.originalPrice).toBe(200);
            expect(result.reason).toBe('HIGH_DEMAND');
        });

        test('reason is NORMAL when no surge', () => {
            const result = calculateSurgeMultiplier(100, 4, 4);
            expect(result.reason).toBe('NORMAL');
        });
    });
});
