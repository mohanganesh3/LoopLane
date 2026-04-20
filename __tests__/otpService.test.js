/**
 * Tests for utils/otpService
 * Covers: generation, verification, expiry, masking, formatting, error messages
 */

const {
    generateOTP,
    generateOTPWithExpiry,
    generateSecureOTP,
    verifyOTP,
    isOTPExpired,
    formatOTP,
    maskOTP,
    getOTPErrorMessage,
    regenerateOTP,
    DEFAULT_OTP_VALIDITY_MINUTES,
    PICKUP_OTP_VALIDITY_MINUTES,
    DROPOFF_OTP_VALIDITY_MINUTES
} = require('../utils/otpService');

describe('utils/otpService', () => {

    // ──────────────────────────────────────────────────────────────
    // generateOTP
    // ──────────────────────────────────────────────────────────────
    describe('generateOTP', () => {
        test('returns a string of exactly 4 digits', () => {
            const otp = generateOTP();
            expect(typeof otp).toBe('string');
            expect(otp).toMatch(/^\d{4}$/);
        });

        test('is within the range 1000–9999', () => {
            for (let i = 0; i < 20; i++) {
                const num = parseInt(generateOTP(), 10);
                expect(num).toBeGreaterThanOrEqual(1000);
                expect(num).toBeLessThanOrEqual(9999);
            }
        });

        test('produces different values over multiple calls (randomness check)', () => {
            const otps = new Set(Array.from({ length: 20 }, () => generateOTP()));
            expect(otps.size).toBeGreaterThan(1);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // generateSecureOTP
    // ──────────────────────────────────────────────────────────────
    describe('generateSecureOTP', () => {
        test('returns a string of exactly 6 digits', () => {
            const otp = generateSecureOTP();
            expect(otp).toMatch(/^\d{6}$/);
        });

        test('is within the range 100000–999999', () => {
            const num = parseInt(generateSecureOTP(), 10);
            expect(num).toBeGreaterThanOrEqual(100000);
            expect(num).toBeLessThanOrEqual(999999);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // generateOTPWithExpiry
    // ──────────────────────────────────────────────────────────────
    describe('generateOTPWithExpiry', () => {
        test('returns code, expiresAt and verified=false', () => {
            const otp = generateOTPWithExpiry();
            expect(otp).toMatchObject({ verified: false });
            expect(typeof otp.code).toBe('string');
            expect(otp.expiresAt).toBeInstanceOf(Date);
        });

        test('expiresAt is approximately validity minutes from now', () => {
            const before = Date.now();
            const otp = generateOTPWithExpiry(10);
            const after = Date.now();

            const expiresMs = otp.expiresAt.getTime();
            expect(expiresMs).toBeGreaterThanOrEqual(before + 10 * 60 * 1000 - 50);
            expect(expiresMs).toBeLessThanOrEqual(after + 10 * 60 * 1000 + 50);
        });

        test('uses DEFAULT_OTP_VALIDITY_MINUTES when no argument provided', () => {
            const before = Date.now();
            const otp = generateOTPWithExpiry();
            const expectedExpiry = before + DEFAULT_OTP_VALIDITY_MINUTES * 60 * 1000;
            expect(otp.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiry - 100);
        });

        test('falls back to default for zero/negative validity', () => {
            const otpZero = generateOTPWithExpiry(0);
            const otpNeg  = generateOTPWithExpiry(-5);
            // Should still produce a future expiry (falling back to default)
            expect(otpZero.expiresAt.getTime()).toBeGreaterThan(Date.now());
            expect(otpNeg.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });
    });

    // ──────────────────────────────────────────────────────────────
    // isOTPExpired
    // ──────────────────────────────────────────────────────────────
    describe('isOTPExpired', () => {
        test('returns false for an OTP expiring in the future', () => {
            const otp = { expiresAt: new Date(Date.now() + 60_000) };
            expect(isOTPExpired(otp)).toBe(false);
        });

        test('returns true for an OTP that has already expired', () => {
            const otp = { expiresAt: new Date(Date.now() - 1) };
            expect(isOTPExpired(otp)).toBe(true);
        });

        test('returns false when expiresAt is missing', () => {
            expect(isOTPExpired({})).toBe(false);
            expect(isOTPExpired(null)).toBe(false);
        });
    });

    // ──────────────────────────────────────────────────────────────
    // verifyOTP
    // ──────────────────────────────────────────────────────────────
    describe('verifyOTP', () => {
        function freshOTP(code = '1234') {
            return { code, expiresAt: new Date(Date.now() + 60_000), verified: false };
        }

        test('returns valid=true for correct, unexpired, unverified OTP', () => {
            const result = verifyOTP('1234', freshOTP('1234'));
            expect(result).toEqual({ valid: true, reason: 'VERIFIED' });
        });

        test('returns INVALID_OTP for wrong code', () => {
            const result = verifyOTP('9999', freshOTP('1234'));
            expect(result).toEqual({ valid: false, reason: 'INVALID_OTP' });
        });

        test('returns NO_OTP_GENERATED when storedOTP is null', () => {
            expect(verifyOTP('1234', null)).toEqual({ valid: false, reason: 'NO_OTP_GENERATED' });
        });

        test('returns NO_OTP_GENERATED when storedOTP has no code', () => {
            expect(verifyOTP('1234', {})).toEqual({ valid: false, reason: 'NO_OTP_GENERATED' });
        });

        test('returns ALREADY_VERIFIED when OTP was already used', () => {
            const otp = { ...freshOTP('1234'), verified: true };
            expect(verifyOTP('1234', otp)).toEqual({ valid: false, reason: 'ALREADY_VERIFIED' });
        });

        test('returns EXPIRED for an expired OTP', () => {
            const otp = { code: '1234', expiresAt: new Date(Date.now() - 1), verified: false };
            expect(verifyOTP('1234', otp)).toEqual({ valid: false, reason: 'EXPIRED' });
        });
    });

    // ──────────────────────────────────────────────────────────────
    // formatOTP
    // ──────────────────────────────────────────────────────────────
    describe('formatOTP', () => {
        test('separates digits with spaces', () => {
            expect(formatOTP('1234')).toBe('1 2 3 4');
        });

        test('works for 6-digit secure OTP', () => {
            expect(formatOTP('987654')).toBe('9 8 7 6 5 4');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // maskOTP
    // ──────────────────────────────────────────────────────────────
    describe('maskOTP', () => {
        test('masks last two digits', () => {
            expect(maskOTP('1234')).toBe('12**');
        });

        test('returns **** for undefined/null input', () => {
            expect(maskOTP(null)).toBe('****');
            expect(maskOTP(undefined)).toBe('****');
            expect(maskOTP('')).toBe('****');
        });

        test('returns **** when OTP shorter than 4 chars', () => {
            expect(maskOTP('12')).toBe('****');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // getOTPErrorMessage
    // ──────────────────────────────────────────────────────────────
    describe('getOTPErrorMessage', () => {
        test.each([
            ['NO_OTP_GENERATED', 'No OTP has been generated yet'],
            ['ALREADY_VERIFIED', 'already been used'],
            ['EXPIRED', 'expired'],
            ['INVALID_OTP', 'Invalid OTP']
        ])('returns correct message for reason %s', (reason, expectedSubstring) => {
            expect(getOTPErrorMessage(reason)).toContain(expectedSubstring);
        });

        test('returns generic message for unknown reason', () => {
            expect(getOTPErrorMessage('UNKNOWN')).toContain('OTP verification failed');
        });
    });

    // ──────────────────────────────────────────────────────────────
    // regenerateOTP
    // ──────────────────────────────────────────────────────────────
    describe('regenerateOTP', () => {
        test('returns a new OTP object with verified=false', () => {
            const old = { code: '1234', expiresAt: new Date(Date.now() - 1), verified: true };
            const newOtp = regenerateOTP(old);
            expect(newOtp.verified).toBe(false);
            expect(newOtp.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });
    });

    // ──────────────────────────────────────────────────────────────
    // Constants sanity checks
    // ──────────────────────────────────────────────────────────────
    describe('constants', () => {
        test('DEFAULT_OTP_VALIDITY_MINUTES is a positive number', () => {
            expect(DEFAULT_OTP_VALIDITY_MINUTES).toBeGreaterThan(0);
        });

        test('PICKUP_OTP_VALIDITY_MINUTES is greater than DEFAULT', () => {
            expect(PICKUP_OTP_VALIDITY_MINUTES).toBeGreaterThan(DEFAULT_OTP_VALIDITY_MINUTES);
        });

        test('DROPOFF_OTP_VALIDITY_MINUTES is at least equal to PICKUP', () => {
            expect(DROPOFF_OTP_VALIDITY_MINUTES).toBeGreaterThanOrEqual(PICKUP_OTP_VALIDITY_MINUTES);
        });
    });
});
