/**
 * Tests for utils/helpers
 * Covers: distance, currency, OTP/token generation, pagination,
 *         masking, privacy filtering, and array utilities.
 */

jest.mock('../config/roles', () => ({ ADMIN_ROLES: ['ADMIN', 'SUPER_ADMIN'] }));

const {
    generateOTP,
    generateToken,
    calculateDistance,
    formatCurrency,
    generateBookingRef,
    generateRideRef,
    sanitizeFilename,
    getFileExtension,
    paginate,
    truncateText,
    getInitials,
    formatPhoneNumber,
    maskEmail,
    maskPhone,
    calculatePercentage,
    removeDuplicates,
    groupBy,
    filterUserPrivacy,
    canViewProfile,
    canShareLocation
} = require('../utils/helpers');

// ──────────────────────────────────────────────────────────────────
// generateOTP / generateToken
// ──────────────────────────────────────────────────────────────────
describe('helpers – token generation', () => {
    test('generateOTP(6) returns exactly 6 numeric chars', () => {
        const otp = generateOTP(6);
        expect(otp).toMatch(/^\d{6}$/);
    });

    test('generateOTP(4) returns exactly 4 numeric chars', () => {
        expect(generateOTP(4)).toMatch(/^\d{4}$/);
    });

    test('generateToken returns a hex string of correct length', () => {
        const token = generateToken(16);
        expect(token).toMatch(/^[0-9a-f]+$/);
        expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
    });
});

// ──────────────────────────────────────────────────────────────────
// calculateDistance (Haversine)
// ──────────────────────────────────────────────────────────────────
describe('helpers – calculateDistance (Haversine)', () => {
    test('same point returns 0', () => {
        expect(calculateDistance(12.97, 77.59, 12.97, 77.59)).toBe(0);
    });

    test('Bangalore to Chennai ≈ 290 km', () => {
        const dist = calculateDistance(12.9716, 77.5946, 13.0827, 80.2707);
        expect(dist).toBeGreaterThan(250);
        expect(dist).toBeLessThan(350);
    });

    test('returns a rounded number', () => {
        const dist = calculateDistance(12.9716, 77.5946, 13.0827, 80.2707);
        expect(dist).toBe(Math.round(dist * 100) / 100);
    });
});

// ──────────────────────────────────────────────────────────────────
// formatCurrency
// ──────────────────────────────────────────────────────────────────
describe('helpers – formatCurrency', () => {
    test('formats positive number with ₹ symbol and 2 decimals', () => {
        expect(formatCurrency(150)).toBe('₹150.00');
    });

    test('formats zero correctly', () => {
        expect(formatCurrency(0)).toBe('₹0.00');
    });

    test('handles non-finite values safely', () => {
        expect(formatCurrency(undefined)).toBe('₹0.00');
        expect(formatCurrency(NaN)).toBe('₹0.00');
    });

    test('supports custom currency symbol', () => {
        expect(formatCurrency(200, '$')).toBe('$200.00');
    });
});

// ──────────────────────────────────────────────────────────────────
// Reference generators
// ──────────────────────────────────────────────────────────────────
describe('helpers – reference generators', () => {
    test('generateBookingRef starts with BK-', () => {
        expect(generateBookingRef()).toMatch(/^BK-/);
    });

    test('generateRideRef starts with RD-', () => {
        expect(generateRideRef()).toMatch(/^RD-/);
    });

    test('two booking refs are unique', () => {
        expect(generateBookingRef()).not.toBe(generateBookingRef());
    });
});

// ──────────────────────────────────────────────────────────────────
// File helpers
// ──────────────────────────────────────────────────────────────────
describe('helpers – file utilities', () => {
    test('sanitizeFilename replaces special chars with underscore', () => {
        expect(sanitizeFilename('My File (1).PDF')).toMatch(/^[a-z0-9._-]+$/);
    });

    test('getFileExtension returns lowercased extension', () => {
        expect(getFileExtension('photo.JPG')).toBe('jpg');
        expect(getFileExtension('data.CSV')).toBe('csv');
    });
});

// ──────────────────────────────────────────────────────────────────
// paginate
// ──────────────────────────────────────────────────────────────────
describe('helpers – paginate', () => {
    const items = Array.from({ length: 25 }, (_, i) => i + 1);

    test('returns correct slice for page 1', () => {
        const result = paginate(items, 1, 10);
        expect(result.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(result.currentPage).toBe(1);
        expect(result.totalPages).toBe(3);
        expect(result.hasNextPage).toBe(true);
        expect(result.hasPrevPage).toBe(false);
    });

    test('returns last partial page correctly', () => {
        const result = paginate(items, 3, 10);
        expect(result.items).toEqual([21, 22, 23, 24, 25]);
        expect(result.hasNextPage).toBe(false);
        expect(result.hasPrevPage).toBe(true);
    });

    test('works with a count number instead of array', () => {
        const result = paginate(100, 2, 20);
        expect(result.totalPages).toBe(5);
        expect(result.items).toBeNull();
        expect(result.hasNextPage).toBe(true);
    });
});

// ──────────────────────────────────────────────────────────────────
// Text helpers
// ──────────────────────────────────────────────────────────────────
describe('helpers – text utilities', () => {
    test('truncateText does not modify short text', () => {
        expect(truncateText('Hello', 10)).toBe('Hello');
    });

    test('truncateText appends ellipsis when over limit', () => {
        const result = truncateText('A'.repeat(110), 100);
        expect(result).toHaveLength(103); // 100 + '...'
        expect(result.endsWith('...')).toBe(true);
    });

    test('getInitials handles normal names', () => {
        expect(getInitials('Mohan Ganesh')).toBe('MG');
    });

    test('getInitials handles single word', () => {
        expect(getInitials('Batman')).toBe('B');
    });

    test('getInitials returns empty string for invalid input', () => {
        expect(getInitials(null)).toBe('');
        expect(getInitials(123)).toBe('');
    });
});

// ──────────────────────────────────────────────────────────────────
// maskEmail / maskPhone
// ──────────────────────────────────────────────────────────────────
describe('helpers – masking', () => {
    test('maskEmail masks middle characters', () => {
        const masked = maskEmail('mohan@example.com');
        expect(masked).toMatch(/^m\*+n@example\.com$/);
    });

    test('maskEmail returns original for invalid emails', () => {
        expect(maskEmail('notanemail')).toBe('notanemail');
        expect(maskEmail(null)).toBeNull();
    });

    test('maskPhone masks all but last 4 digits', () => {
        const masked = maskPhone('9876543210');
        expect(masked).toMatch(/^\*{6}3210$/);
    });

    test('maskPhone returns original for falsy value', () => {
        expect(maskPhone(null)).toBeNull();
    });
});

// ──────────────────────────────────────────────────────────────────
// calculatePercentage
// ──────────────────────────────────────────────────────────────────
describe('helpers – calculatePercentage', () => {
    test('50 out of 200 is 25%', () => {
        expect(calculatePercentage(50, 200)).toBe(25);
    });

    test('returns 0 when total is 0 (no division by zero)', () => {
        expect(calculatePercentage(10, 0)).toBe(0);
    });
});

// ──────────────────────────────────────────────────────────────────
// formatPhoneNumber
// ──────────────────────────────────────────────────────────────────
describe('helpers – formatPhoneNumber', () => {
    test('formats 10-digit number with space in middle', () => {
        expect(formatPhoneNumber('9876543210')).toBe('98765 43210');
    });

    test('returns original for non-10-digit numbers', () => {
        expect(formatPhoneNumber('12345')).toBe('12345');
    });
});

// ──────────────────────────────────────────────────────────────────
// Array utilities
// ──────────────────────────────────────────────────────────────────
describe('helpers – array utilities', () => {
    test('removeDuplicates removes duplicate primitives', () => {
        expect(removeDuplicates([1, 2, 2, 3, 1])).toEqual([1, 2, 3]);
    });

    test('removeDuplicates removes by key for objects', () => {
        const arr = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 1, name: 'c' }];
        const result = removeDuplicates(arr, 'id');
        expect(result).toHaveLength(2);
    });

    test('groupBy groups array by given key', () => {
        const arr = [
            { city: 'Bangalore', name: 'Mohan' },
            { city: 'Mumbai', name: 'Rahul' },
            { city: 'Bangalore', name: 'Priya' }
        ];
        const grouped = groupBy(arr, 'city');
        expect(grouped.Bangalore).toHaveLength(2);
        expect(grouped.Mumbai).toHaveLength(1);
    });
});

// ──────────────────────────────────────────────────────────────────
// filterUserPrivacy
// ──────────────────────────────────────────────────────────────────
describe('helpers – filterUserPrivacy', () => {
    function baseUser(overrides = {}) {
        return {
            email: 'test@example.com',
            phone: '9876543210',
            preferences: { privacy: {} },
            ...overrides
        };
    }

    test('returns null when userData is null', () => {
        expect(filterUserPrivacy(null)).toBeNull();
    });

    test('hides phone when showPhone=false', () => {
        const user = baseUser({ preferences: { privacy: { showPhone: false } } });
        const result = filterUserPrivacy(user);
        expect(result.phone).toBeNull();
        expect(result.phoneHidden).toBe(true);
    });

    test('hides email when showEmail=false', () => {
        const user = baseUser({ preferences: { privacy: { showEmail: false } } });
        const result = filterUserPrivacy(user);
        expect(result.email).toBeNull();
        expect(result.emailHidden).toBe(true);
    });

    test('exposes all data during confirmed booking regardless of privacy', () => {
        const user = baseUser({ preferences: { privacy: { showPhone: false, showEmail: false } } });
        const result = filterUserPrivacy(user, { isConfirmedBooking: true });
        expect(result.phone).toBe('9876543210');
        expect(result.email).toBe('test@example.com');
    });
});

// ──────────────────────────────────────────────────────────────────
// canViewProfile
// ──────────────────────────────────────────────────────────────────
describe('helpers – canViewProfile', () => {
    const owner = {
        _id: { toString: () => 'owner1' },
        preferences: { privacy: { profileVisibility: 'PUBLIC' } },
        verificationStatus: 'UNVERIFIED'
    };

    const viewer = {
        _id: { toString: () => 'viewer1' },
        role: 'PASSENGER',
        verificationStatus: 'VERIFIED'
    };

    test('returns false for invalid users', () => {
        expect(canViewProfile(null, viewer).canView).toBe(false);
    });

    test('owner can always view their own profile', () => {
        const self = { ...viewer, _id: { toString: () => 'owner1' }, role: 'PASSENGER' };
        expect(canViewProfile(owner, self).canView).toBe(true);
    });

    test('admin can always view any profile', () => {
        const admin = { ...viewer, role: 'ADMIN' };
        expect(canViewProfile(owner, admin).canView).toBe(true);
    });

    test('PUBLIC profile is visible to everyone', () => {
        expect(canViewProfile(owner, viewer).canView).toBe(true);
    });

    test('PRIVATE profile is not visible', () => {
        const privateOwner = {
            ...owner,
            preferences: { privacy: { profileVisibility: 'PRIVATE' } }
        };
        expect(canViewProfile(privateOwner, viewer).canView).toBe(false);
    });

    test('VERIFIED_ONLY profile is visible to verified users', () => {
        const restrictedOwner = {
            ...owner,
            preferences: { privacy: { profileVisibility: 'VERIFIED_ONLY' } }
        };
        expect(canViewProfile(restrictedOwner, viewer).canView).toBe(true);
    });

    test('VERIFIED_ONLY profile is NOT visible to unverified users', () => {
        const restrictedOwner = {
            ...owner,
            preferences: { privacy: { profileVisibility: 'VERIFIED_ONLY' } }
        };
        const unverified = { ...viewer, verificationStatus: 'UNVERIFIED' };
        expect(canViewProfile(restrictedOwner, unverified).canView).toBe(false);
    });
});

// ──────────────────────────────────────────────────────────────────
// canShareLocation
// ──────────────────────────────────────────────────────────────────
describe('helpers – canShareLocation', () => {
    test('returns false for null user', () => {
        expect(canShareLocation(null)).toBe(false);
    });

    test('defaults to true when preference not set', () => {
        expect(canShareLocation({ preferences: {} })).toBe(true);
    });

    test('returns false when shareLocation is explicitly false', () => {
        expect(canShareLocation({ preferences: { privacy: { shareLocation: false } } })).toBe(false);
    });

    test('returns true when shareLocation is explicitly true', () => {
        expect(canShareLocation({ preferences: { privacy: { shareLocation: true } } })).toBe(true);
    });
});
