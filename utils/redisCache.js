/**
 * Redis-backed JSON cache with in-memory fallback.
 *
 * - Uses Redis when available (see config/redis.js)
 * - Falls back to an in-process Map cache when Redis is unavailable
 *
 * Keep cached values JSON-serializable.
 */

const crypto = require('crypto');
const redisConfig = require('../config/redis');

const { getRedisClient } = redisConfig;
const waitForRedisReady = redisConfig.waitForRedisReady || (async () => true);

const memoryCache = new Map();
const DEFAULT_MEMORY_MAX_ENTRIES = 500;

function sha256(input) {
    return crypto.createHash('sha256').update(String(input)).digest('hex');
}

/**
 * Build a short, safe cache key.
 * @param {string} namespace - Logical namespace, e.g. 'geo:geocode'
 * @param {any} payload - Will be stringified for hashing
 * @param {number} version - Bump to invalidate old keys
 */
function buildCacheKey(namespace, payload, version = 1) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const digest = sha256(raw).slice(0, 32);
    return `cache:v${version}:${namespace}:${digest}`;
}

function getFromMemory(key) {
    const entry = memoryCache.get(key);
    if (!entry) return null;

    if (entry.expiresAtMs <= Date.now()) {
        memoryCache.delete(key);
        return null;
    }

    return entry.value;
}

function setInMemory(key, value, ttlSeconds, maxEntries = DEFAULT_MEMORY_MAX_ENTRIES) {
    if (!ttlSeconds || ttlSeconds <= 0) return;

    const now = Date.now();

    // Prune expired entries
    for (const [k, v] of memoryCache.entries()) {
        if (v.expiresAtMs <= now) memoryCache.delete(k);
    }

    // Cap cache size (FIFO by insertion order)
    while (memoryCache.size >= maxEntries) {
        const firstKey = memoryCache.keys().next().value;
        if (firstKey === undefined) break;
        memoryCache.delete(firstKey);
    }

    memoryCache.set(key, { value, expiresAtMs: now + ttlSeconds * 1000 });
}

async function getFromRedis(key) {
    const redis = getRedisClient();
    if (!redis) return null;

    try {
        const ready = await waitForRedisReady(redis, 1000);
        if (!ready) return null;
        const raw = await redis.get(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

async function setInRedis(key, value, ttlSeconds) {
    const redis = getRedisClient();
    if (!redis) return false;

    try {
        const ready = await waitForRedisReady(redis, 1000);
        if (!ready) return false;
        if (!ttlSeconds || ttlSeconds <= 0) {
            await redis.set(key, JSON.stringify(value));
        } else {
            await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        }
        return true;
    } catch {
        return false;
    }
}

async function invalidateCacheKey(key) {
    memoryCache.delete(key);

    const redis = getRedisClient();
    if (!redis) return;

    try {
        const ready = await waitForRedisReady(redis, 1000);
        if (!ready) return;
        await redis.del(key);
    } catch {
        // ignore
    }
}

/**
 * Get a cached JSON value or compute and cache it.
 *
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<any>} factory
 * @param {{ useMemoryFallback?: boolean, memoryMaxEntries?: number }} options
 */
async function getOrSetJson(key, ttlSeconds, factory, options = {}) {
    const useMemoryFallback = options.useMemoryFallback !== false;
    const memoryMaxEntries = options.memoryMaxEntries || DEFAULT_MEMORY_MAX_ENTRIES;

    // 1) Redis first (shared across instances)
    const redisValue = await getFromRedis(key);
    if (redisValue !== null && redisValue !== undefined) {
        return { value: redisValue, cache: { hit: true, store: 'redis', key } };
    }

    // 2) In-memory fallback (single instance)
    if (useMemoryFallback) {
        const memValue = getFromMemory(key);
        if (memValue !== null && memValue !== undefined) {
            return { value: memValue, cache: { hit: true, store: 'memory', key } };
        }
    }

    // 3) Compute and cache
    const value = await factory();

    const storedInRedis = await setInRedis(key, value, ttlSeconds);
    if (!storedInRedis && useMemoryFallback) {
        setInMemory(key, value, ttlSeconds, memoryMaxEntries);
    }

    return {
        value,
        cache: {
            hit: false,
            store: storedInRedis ? 'redis' : (useMemoryFallback ? 'memory' : 'none'),
            key
        }
    };
}

module.exports = {
    buildCacheKey,
    getOrSetJson,
    invalidateCacheKey
};
