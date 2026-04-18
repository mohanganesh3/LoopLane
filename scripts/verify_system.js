/* eslint-disable no-console */

/**
 * Current system smoke verification for LoopLane.
 *
 * Verifies:
 * - API health
 * - Admin login
 * - Protected Swagger JSON
 * - Admin system health
 * - Admin user listing
 * - Cache headers on a unique route request (MISS -> HIT)
 *
 * Usage:
 *   node scripts/verify_system.js
 *   BASE_URL=https://looplane.onrender.com node scripts/verify_system.js
 */

require('dotenv').config();

const axios = require('axios');

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const API_BASE = `${BASE_URL}/api`;
const ADMIN_EMAIL = process.env.VERIFY_ADMIN_EMAIL || 'admin@lanecarpool.com';
const ADMIN_PASSWORD = process.env.VERIFY_ADMIN_PASSWORD || 'Admin@123';
const SEARCH_TERM = process.env.VERIFY_SEARCH_TERM || 'karthik';

function log(step, message, data) {
    const suffix = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[${step}] ${message}${suffix}`);
}

async function expectOk(label, fn) {
    try {
        return await fn();
    } catch (error) {
        if (error.response) {
            throw new Error(
                `${label} failed: ${error.response.status} ${JSON.stringify(error.response.data)}`
            );
        }
        throw new Error(`${label} failed: ${error.message}`);
    }
}

async function main() {
    log('verify', 'starting', { baseUrl: BASE_URL });

    const health = await expectOk('health', async () => {
        const response = await axios.get(`${API_BASE}/health`, { timeout: 15000 });
        return response.data;
    });

    log('health', 'ok', {
        environment: health.environment || 'unknown',
        message: health.message,
        database: health.database || 'unknown'
    });

    const loginResponse = await expectOk('admin login', async () => {
        return axios.post(
            `${API_BASE}/auth/login`,
            { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
            {
                timeout: 20000,
                validateStatus: (status) => status < 500
            }
        );
    });

    if (loginResponse.status !== 200 || !loginResponse.data?.success || !loginResponse.data?.accessToken) {
        throw new Error(`admin login failed: ${loginResponse.status} ${JSON.stringify(loginResponse.data)}`);
    }

    const accessToken = loginResponse.data.accessToken;
    const authHeaders = {
        Authorization: `Bearer ${accessToken}`
    };

    log('auth', 'ok', {
        role: loginResponse.data.user?.role,
        email: loginResponse.data.user?.email
    });

    const swagger = await expectOk('swagger json', async () => {
        const response = await axios.get(`${API_BASE}/swagger.json`, {
            headers: authHeaders,
            timeout: 20000
        });
        return response.data;
    });

    log('swagger', 'ok', {
        openapi: swagger.openapi,
        title: swagger.info?.title,
        version: swagger.info?.version,
        pathCount: Object.keys(swagger.paths || {}).length,
        tagCount: (swagger.tags || []).length
    });

    const systemHealth = await expectOk('admin system health', async () => {
        const response = await axios.get(`${API_BASE}/admin/system-health`, {
            headers: authHeaders,
            timeout: 20000
        });
        return response.data;
    });

    if (!systemHealth?.success) {
        throw new Error(`admin system health returned unexpected payload: ${JSON.stringify(systemHealth)}`);
    }

    log('admin', 'system health ok', {
        status: systemHealth.health?.status,
        database: systemHealth.health?.database?.status,
        totalUsers: systemHealth.health?.counters?.totalUsers
    });

    const usersList = await expectOk('admin users', async () => {
        const response = await axios.get(`${API_BASE}/admin/users?page=1&limit=2`, {
            headers: authHeaders,
            timeout: 20000
        });
        return response.data;
    });

    if (!usersList?.success || !Array.isArray(usersList.users)) {
        throw new Error(`admin users returned unexpected payload: ${JSON.stringify(usersList)}`);
    }

    log('admin', 'users ok', {
        count: usersList.users.length,
        total: usersList.pagination?.total
    });

    const cacheNonce = (Date.now() % 100000) / 10000000;
    const routePayload = {
        origin: {
            coordinates: [77.6296 + cacheNonce, 12.9352 + cacheNonce]
        },
        destination: {
            coordinates: [77.748 + cacheNonce, 12.9698 + cacheNonce]
        }
    };

    const routeMiss = await expectOk('route miss', async () => {
        return axios.post(`${API_BASE}/route`, routePayload, {
            headers: authHeaders,
            timeout: 30000
        });
    });

    const routeHit = await expectOk('route hit', async () => {
        return axios.post(`${API_BASE}/route`, routePayload, {
            headers: authHeaders,
            timeout: 30000
        });
    });

    const missCache = routeMiss.headers['x-cache'];
    const hitCache = routeHit.headers['x-cache'];
    const cacheStore = routeHit.headers['x-cache-store'] || routeMiss.headers['x-cache-store'] || 'unknown';

    if (missCache !== 'MISS') {
        throw new Error(`expected first route request to MISS cache, got ${missCache || 'none'}`);
    }

    if (hitCache !== 'HIT') {
        throw new Error(`expected second route request to HIT cache, got ${hitCache || 'none'}`);
    }

    log('cache', 'ok', {
        first: missCache,
        second: hitCache,
        store: cacheStore
    });

    const searchResponse = await expectOk('admin search', async () => {
        return axios.get(`${API_BASE}/admin/users`, {
            params: { page: 1, limit: 5, search: SEARCH_TERM },
            headers: authHeaders,
            timeout: 20000
        });
    });

    const searchBackend = searchResponse.headers['x-search-backend'] || 'unknown';
    if (!searchResponse.data?.success || !Array.isArray(searchResponse.data.users)) {
        throw new Error(`admin search returned unexpected payload: ${JSON.stringify(searchResponse.data)}`);
    }

    log('search', 'ok', {
        term: SEARCH_TERM,
        backend: searchBackend,
        count: searchResponse.data.users.length
    });

    log('verify', 'complete', { ok: true });
}

main().catch((error) => {
    console.error(`[verify] FAILED ${error.message}`);
    process.exit(1);
});
