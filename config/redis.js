/**
 * Shared Redis client (singleton).
 * Used by rate-limiter, OTP storage, and any future cache needs.
 *
 * Set REDIS_URL env var to connect to a remote Redis instance.
 * Falls back to a graceful no-op when Redis is unavailable (dev).
 */

let client = null;

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
        client.connect().catch(() => {});
    } catch (err) {
        // ioredis not installed — return null sentinel
        console.warn('[Redis] ioredis not installed — Redis features disabled');
        client = null;
    }

    return client;
}

module.exports = { getRedisClient };
