jest.mock('../models/User', () => ({}))

const {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    extractToken,
    getCookieOptions
} = require('../middleware/jwt')

describe('middleware/jwt', () => {
    test('access token round-trip encodes userId + type', () => {
        const token = generateAccessToken('user123')
        const decoded = verifyAccessToken(token)

        expect(decoded).toEqual(expect.objectContaining({ userId: 'user123', type: 'access' }))
    })

    test('refresh token round-trip encodes userId + type', () => {
        const token = generateRefreshToken('user123')
        const decoded = verifyRefreshToken(token)

        expect(decoded).toEqual(expect.objectContaining({ userId: 'user123', type: 'refresh' }))
    })

    test('verifyAccessToken rejects refresh tokens (wrong secret)', () => {
        try {
            verifyAccessToken(generateRefreshToken('user123'))
            throw new Error('Expected verifyAccessToken to throw')
        } catch (err) {
            expect(err).toEqual(expect.objectContaining({ statusCode: 401 }))
            expect(err.message).toBe('Invalid access token.')
        }
    })

    test('verifyAccessToken rejects invalid tokens with statusCode 401', () => {
        try {
            verifyAccessToken('not-a-jwt')
            throw new Error('Expected verifyAccessToken to throw')
        } catch (err) {
            expect(err).toEqual(expect.objectContaining({ statusCode: 401 }))
            expect(err.message).toBe('Invalid access token.')
        }
    })

    test('extractToken prefers Bearer header', () => {
        const req = {
            headers: { authorization: 'Bearer headerToken' },
            cookies: { accessToken: 'cookieToken' }
        }

        expect(extractToken(req)).toBe('headerToken')
    })

    test('extractToken falls back to cookie', () => {
        const req = {
            headers: {},
            cookies: { accessToken: 'cookieToken' }
        }

        expect(extractToken(req)).toBe('cookieToken')
    })

    test('getCookieOptions uses secure+strict in production', () => {
        const prev = process.env.NODE_ENV
        process.env.NODE_ENV = 'production'

        try {
            expect(getCookieOptions(123)).toEqual(expect.objectContaining({
                httpOnly: true,
                secure: true,
                sameSite: 'strict',
                maxAge: 123,
                path: '/'
            }))
        } finally {
            process.env.NODE_ENV = prev
        }
    })

    test('getCookieOptions uses lax in non-production', () => {
        const prev = process.env.NODE_ENV
        process.env.NODE_ENV = 'test'

        try {
            expect(getCookieOptions(123)).toEqual(expect.objectContaining({
                httpOnly: true,
                secure: false,
                sameSite: 'lax',
                maxAge: 123,
                path: '/'
            }))
        } finally {
            process.env.NODE_ENV = prev
        }
    })
})
