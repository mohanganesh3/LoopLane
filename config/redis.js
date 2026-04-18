/**
 * Shared Redis client (singleton).
 * Used by rate-limiter, OTP storage, and any future cache needs.
 *
 * Set REDIS_URL env var to connect to a remote Redis instance.
 * Falls back to a graceful no-op when Redis is unavailable (dev).
 */

let client = null;
let connectPromise = null;

function ensureRedisConnect(redis) {
    if (!redis) return null;

    if (!connectPromise) {
        connectPromise = redis.connect()
            .catch(() => {})
            .finally(() => {
                connectPromise = null;
            });
    }

    return connectPromise;
}

async function waitForRedisReady(redis = getRedisClient(), timeoutMs = 1000) {
    if (!redis) return false;
    if (redis.status === 'ready') return true;

    if (redis.status === 'wait') {
        ensureRedisConnect(redis);
    }

    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            cleanup();
            resolve(redis.status === 'ready');
        }, timeoutMs);

        function cleanup() {
            clearTimeout(timer);
            redis.off('ready', onReady);
            redis.off('error', onError);
            redis.off('end', onEnd);
            redis.off('close', onClose);
        }

        function onReady() {
            cleanup();
            resolve(true);
        }

        function onError() {
            cleanup();
            resolve(false);
        }

        function onEnd() {
            cleanup();
            resolve(false);
        }

        function onClose() {
            cleanup();
            resolve(false);
        }

        redis.once('ready', onReady);
        redis.once('error', onError);
        redis.once('end', onEnd);
        redis.once('close', onClose);
    });
}

function getRedisClient() {
    if (client) return client;

    try {
        const Redis = require('ioredis');
        client = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
            maxRetriesPerRequest: 1,
            enableOfflineQueue: false,
            lazyConnect: true,
            retryStrategy(times) {
                if (times > 3) return null; // stop retrying after 3 attempts
                return Math.min(times * 200, 2000);
            }
        });

        client.on('error', (err) => {
            if (!client._loopLaneWarned) {
                console.warn('[Redis] Connection failed — falling back to in-memory stores:', err.message);
                client._loopLaneWarned = true;
            }
        });

        // Attempt connection but don't block startup
        ensureRedisConnect(client);
    } catch (err) {
        // ioredis not installed — return null sentinel
        console.warn('[Redis] ioredis not installed — Redis features disabled');
        client = null;
    }

    return client;
}

module.exports = { getRedisClient, waitForRedisReady };
