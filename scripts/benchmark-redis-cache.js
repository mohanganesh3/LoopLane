/* eslint-disable no-console */

/**
 * Benchmark Redis caching latency improvements for external integrations.
 *
 * This script intentionally benchmarks the cache helper directly (not Express routes),
 * so it can run without a MongoDB seed.
 */

require('dotenv').config();

const axios = require('axios');
const { getRedisClient } = require('../config/redis');
const { buildCacheKey, getOrSetJson, invalidateCacheKey } = require('../utils/redisCache');

const NOMINATIM_URL = process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org';
const OSRM_URL = process.env.OSRM_API_URL || 'https://router.project-osrm.org';

const HIT_RUNS = Number(process.env.BENCH_HIT_RUNS || 10);

function nowMs() {
    return Number(process.hrtime.bigint()) / 1e6;
}

async function waitForRedisReady(redis, timeoutMs = 2000) {
    if (!redis) throw new Error('Redis client not available');
    if (redis.status === 'ready') return;

    // If the shared client was created with lazyConnect, ensure a connect attempt is in-flight.
    if (redis.status === 'wait') {
        try {
            await redis.connect();
        } catch {
            // Ignore "already connecting/connected" style errors.
        }
    }

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Timed out waiting for Redis to become ready (status=${redis.status})`));
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
            resolve();
        }

        function onError(err) {
            cleanup();
            reject(err);
        }

        function onEnd() {
            cleanup();
            reject(new Error('Redis connection ended while waiting for ready'));
        }

        function onClose() {
            cleanup();
            reject(new Error('Redis connection closed while waiting for ready'));
        }

        redis.once('ready', onReady);
        redis.once('error', onError);
        redis.once('end', onEnd);
        redis.once('close', onClose);
    });
}

async function assertRedisReady() {
    const redis = getRedisClient();
    if (!redis) {
        throw new Error('Redis client not available (getRedisClient returned null).');
    }

    // Our shared Redis client is configured to fail fast when not ready (enableOfflineQueue=false).
    // Wait for the underlying connection to be established before issuing PING.
    await waitForRedisReady(redis, 3000);

    try {
        const pong = await redis.ping();
        if (pong !== 'PONG') {
            throw new Error(`Unexpected PING response: ${pong}`);
        }
    } catch (err) {
        const url = process.env.REDIS_URL || 'redis://localhost:6379';
        throw new Error(`Redis not reachable at ${url}: ${err.message}`);
    }
}

async function timeRun(fn) {
    const start = nowMs();
    const result = await fn();
    const end = nowMs();
    return { result, ms: end - start };
}

function formatMs(ms) {
    return `${ms.toFixed(1)} ms`;
}

async function bench(name, key, ttlSeconds, factory) {
    console.log(`\n== ${name} ==`);
    console.log(`cacheKey: ${key}`);

    await invalidateCacheKey(key);

    const miss = await timeRun(() => getOrSetJson(key, ttlSeconds, factory, { useMemoryFallback: false }));
    console.log(`MISS: ${formatMs(miss.ms)} (store=${miss.result.cache.store})`);

    const hitRuns = [];
    for (let i = 0; i < HIT_RUNS; i++) {
        const hit = await timeRun(() => getOrSetJson(key, ttlSeconds, factory, { useMemoryFallback: false }));

        if (!hit.result.cache.hit || hit.result.cache.store !== 'redis') {
            throw new Error(
                `Expected Redis HIT but got hit=${hit.result.cache.hit}, store=${hit.result.cache.store} on run ${i + 1}`
            );
        }

        hitRuns.push(hit.ms);
    }

    const avgHit = hitRuns.reduce((a, b) => a + b, 0) / hitRuns.length;
    console.log(`HIT avg (${HIT_RUNS}x): ${formatMs(avgHit)}`);

    const improvement = miss.ms / Math.max(avgHit, 0.0001);
    console.log(`Speedup (MISS/HIT): ${improvement.toFixed(1)}x`);
}

async function benchGeocode() {
    const address = process.env.BENCH_ADDRESS || 'Koramangala, Bangalore';
    const key = buildCacheKey('bench:geocode', { address, provider: NOMINATIM_URL });

    await bench('Nominatim geocode', key, 24 * 60 * 60, async () => {
        const response = await axios.get(`${NOMINATIM_URL}/search`, {
            params: {
                q: address,
                format: 'json',
                limit: 5,
                countrycodes: 'in',
                addressdetails: 1
            },
            headers: {
                'User-Agent': 'LANE-Carpool-App/1.0'
            }
        });

        return response.data;
    });
}

async function benchRoute() {
    // Bangalore coords (lon,lat)
    const origin = [77.6296, 12.9352];
    const destination = [77.7480, 12.9698];

    const coordString = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
    const key = buildCacheKey('bench:route', { coordString, provider: OSRM_URL });

    await bench('OSRM route', key, 24 * 60 * 60, async () => {
        const response = await axios.get(`${OSRM_URL}/route/v1/driving/${coordString}`, {
            params: {
                overview: 'false',
                geometries: 'geojson'
            }
        });

        return response.data;
    });
}

async function main() {
    const target = (process.argv[2] || 'all').toLowerCase();

    await assertRedisReady();
    console.log('Redis: OK');

    if (target === 'geocode' || target === 'all') {
        await benchGeocode();
    }

    if (target === 'route' || target === 'all') {
        await benchRoute();
    }

    console.log('\nDone.');

    // Clean shutdown so the process exits (ioredis keeps sockets open otherwise).
    const redis = getRedisClient();
    if (redis) {
        try {
            await redis.quit();
        } catch {
            try {
                redis.disconnect();
            } catch {
                // ignore
            }
        }
    }
}

main().catch((err) => {
    console.error(`\nBenchmark failed: ${err.message}`);
    process.exit(1);
});
