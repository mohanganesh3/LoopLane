function loadRedisCache(getRedisClientImpl) {
    jest.resetModules();

    jest.doMock('../config/redis', () => ({
        getRedisClient: jest.fn(getRedisClientImpl)
    }));

    // eslint-disable-next-line global-require
    return require('../utils/redisCache');
}

describe('utils/redisCache', () => {
    test('buildCacheKey is stable for identical input', () => {
        const { buildCacheKey } = loadRedisCache(() => null);

        const k1 = buildCacheKey('geo:geocode', { address: 'Koramangala' });
        const k2 = buildCacheKey('geo:geocode', { address: 'Koramangala' });

        expect(k1).toBe(k2);
        expect(k1).toMatch(/^cache:v1:geo:geocode:/);
    });

    test('buildCacheKey changes when version changes', () => {
        const { buildCacheKey } = loadRedisCache(() => null);

        const k1 = buildCacheKey('ns', { a: 1 }, 1);
        const k2 = buildCacheKey('ns', { a: 1 }, 2);

        expect(k1).not.toBe(k2);
    });

    test('getOrSetJson falls back to memory when Redis is unavailable', async () => {
        const { getOrSetJson } = loadRedisCache(() => null);

        const key = 'test:key:mem';
        const factory = jest.fn(async () => ({ ok: true }));

        const first = await getOrSetJson(key, 60, factory);
        expect(first.value).toEqual({ ok: true });
        expect(first.cache).toEqual(expect.objectContaining({ hit: false, store: 'memory', key }));

        const second = await getOrSetJson(key, 60, factory);
        expect(second.value).toEqual({ ok: true });
        expect(second.cache).toEqual(expect.objectContaining({ hit: true, store: 'memory', key }));

        expect(factory).toHaveBeenCalledTimes(1);
    });

    test('getOrSetJson uses Redis when available', async () => {
        const redisMap = new Map();
        const redis = {
            get: jest.fn(async (key) => redisMap.get(key) || null),
            set: jest.fn(async (key, value) => {
                redisMap.set(key, value);
                return 'OK';
            }),
            del: jest.fn(async (key) => {
                redisMap.delete(key);
                return 1;
            })
        };

        const { getOrSetJson } = loadRedisCache(() => redis);

        const key = 'test:key:redis';
        const factory = jest.fn(async () => ({ cached: 'yes' }));

        const first = await getOrSetJson(key, 60, factory);
        expect(first.value).toEqual({ cached: 'yes' });
        expect(first.cache).toEqual(expect.objectContaining({ hit: false, store: 'redis', key }));

        const second = await getOrSetJson(key, 60, factory);
        expect(second.value).toEqual({ cached: 'yes' });
        expect(second.cache).toEqual(expect.objectContaining({ hit: true, store: 'redis', key }));

        expect(factory).toHaveBeenCalledTimes(1);
        expect(redis.set).toHaveBeenCalled();
    });

    test('invalidateCacheKey clears Redis and memory entries', async () => {
        const redisMap = new Map();
        const redis = {
            get: jest.fn(async (key) => redisMap.get(key) || null),
            set: jest.fn(async (key, value) => {
                redisMap.set(key, value);
                return 'OK';
            }),
            del: jest.fn(async (key) => {
                redisMap.delete(key);
                return 1;
            })
        };

        const { getOrSetJson, invalidateCacheKey } = loadRedisCache(() => redis);

        const key = 'test:key:invalidate';
        const factory = jest.fn(async () => ({ v: Math.random() }));

        const first = await getOrSetJson(key, 60, factory);
        await invalidateCacheKey(key);
        const second = await getOrSetJson(key, 60, factory);

        expect(factory).toHaveBeenCalledTimes(2);
        expect(redis.del).toHaveBeenCalledWith(key);

        // Values should differ because factory ran again after invalidation.
        expect(second.value).not.toEqual(first.value);
    });
});
