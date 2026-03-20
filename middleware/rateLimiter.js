/**
 * Rate Limiting Middleware
 * Prevents abuse and brute force attacks.
 * Uses Redis store (via ioredis + rate-limit-redis) when available;
 * falls back to the default in-memory MemoryStore otherwise.
 */

const rateLimit = require('express-rate-limit');
const { getRedisClient } = require('../config/redis');

/**
 * Build a RedisStore for a given prefix, or return undefined (MemoryStore fallback).
 */
function createStore(prefix) {
    try {
        // Support multiple export styles across rate-limit-redis versions
        const rateLimitRedis = require('rate-limit-redis');
        const RedisStore = rateLimitRedis?.RedisStore || rateLimitRedis?.default || rateLimitRedis;
        const redis = getRedisClient();
        if (!redis) return undefined;

        const store = new RedisStore({
            sendCommand: (...args) => redis.call(...args),
            prefix: `rl:${prefix}:`
        });

        // rate-limit-redis eagerly loads LUA scripts and stores those Promises on the instance.
        // If Redis is unavailable at startup, those Promises can reject before they are ever awaited,
        // which becomes a fatal unhandled rejection on modern Node versions.
        // Attach no-op rejection handlers to keep startup resilient and allow in-memory fallback.
        if (store?.incrementScriptSha?.catch) store.incrementScriptSha.catch(() => {});
        if (store?.getScriptSha?.catch) store.getScriptSha.catch(() => {});

        return store;
    } catch {
        // rate-limit-redis not installed — use default MemoryStore
        return undefined;
    }
}

// General API rate limiter
exports.apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    skip: () => process.env.NODE_ENV === 'test',
    store: createStore('api'),
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict rate limiter for login attempts
exports.loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    skip: () => process.env.NODE_ENV === 'test',
    store: createStore('login'),
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes.'
    },
    skipSuccessfulRequests: true,
});

// Rate limiter for registration
exports.registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    skip: () => process.env.NODE_ENV === 'test',
    store: createStore('register'),
    message: {
        success: false,
        message: 'Too many accounts created from this IP, please try again after an hour.'
    }
});

// Rate limiter for OTP requests
exports.otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 30,
    skip: () => process.env.NODE_ENV === 'test',
    store: createStore('otp'),
    message: {
        success: false,
        message: 'Too many OTP requests, please try again after 5 minutes.'
    }
});

// Rate limiter for SOS alerts
exports.sosLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    skip: () => process.env.NODE_ENV === 'test',
    store: createStore('sos'),
    message: {
        success: false,
        message: 'SOS alert rate limit exceeded. Please wait before triggering another alert.'
    }
});

// Rate limiter for file uploads
exports.uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 120,
    skip: () => process.env.NODE_ENV === 'test',
    store: createStore('upload'),
    message: {
        success: false,
        message: 'Too many file uploads, please try again later.'
    }
});

// Rate limiter for search queries
exports.searchLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    skip: () => process.env.NODE_ENV === 'test',
    store: createStore('search'),
    message: {
        success: false,
        message: 'Too many search requests, please slow down.'
    }
});

// Rate limiter for chat messages
exports.chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    skip: () => process.env.NODE_ENV === 'test',
    store: createStore('chat'),
    message: {
        success: false,
        message: 'You are sending messages too quickly. Please slow down.'
    }
});

// Rate limiter for OTP verification (brute-force protection)
exports.otpVerifyLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    skip: () => process.env.NODE_ENV === 'test',
    store: createStore('otp-verify'),
    message: {
        success: false,
        message: 'Too many OTP verification attempts. Please wait 5 minutes before trying again.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});
