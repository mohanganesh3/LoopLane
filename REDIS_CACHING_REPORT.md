# Redis Caching & Performance Evidence (LoopLane)

## What was implemented

LoopLane now supports **Redis-backed response caching** (with an in-memory fallback when Redis is unavailable) for high-cost endpoints:

### External API integrations (Nominatim / OSRM)

Cached in `controllers/apiController.js` using `utils/redisCache.js`:

- `GET /api/geocode` — TTL: 24h
- `GET /api/reverse-geocode` — TTL: 24h
- `GET /api/autocomplete` — TTL: 6h
- `POST /api/route` — TTL: 24h
- `POST /api/distance-matrix` — TTL: 24h
- `POST /api/snap-to-road` — TTL: 24h
- `GET /api/eta` — caches route metrics (distance/duration) for 24h; ETA timestamp is computed per request

### Corporate/B2B endpoints

Cached using `utils/redisCache.js`:

- `GET /api/corporate/dashboard` — TTL: 60s
- `GET /api/corporate/esg-report` — TTL: 10m (cache key includes org + date range)

## How to verify caching is active

These endpoints now include headers:

- `X-Cache: HIT | MISS`
- `X-Cache-Store: redis | memory | none`

A **repeat request with the same parameters** should switch from `MISS` to `HIT`.

Example (local dev smoke test):

- `GET /api/geocode?address=...`
	- 1st call: `X-Cache: MISS`, `X-Cache-Store: redis` (~220ms)
	- 2nd call: `X-Cache: HIT`, `X-Cache-Store: redis` (~4ms)
- `POST /api/route` (same body)
	- 1st call: `X-Cache: MISS`, `X-Cache-Store: redis` (~757ms)
	- 2nd call: `X-Cache: HIT`, `X-Cache-Store: redis` (~3ms)

## Benchmarks (repeatable)

A repeatable Redis benchmark is provided:

- Script: `scripts/benchmark-redis-cache.js`

The script measures a forced **MISS** (after invalidation) and then averages multiple **HIT** reads from Redis.

### Prerequisites

- A running Redis instance (configured via `REDIS_URL`)

### Run

- All benchmarks: `node scripts/benchmark-redis-cache.js`
- Only geocode: `node scripts/benchmark-redis-cache.js geocode`
- Only route: `node scripts/benchmark-redis-cache.js route`

Environment knobs:

- `BENCH_HIT_RUNS` (default: 10)
- `BENCH_ADDRESS` (default: `Koramangala, Bangalore`)

> Record the script output below for your submission.

## Results (latest local run)

- Date / machine: 2026-04-15 — macOS (local dev)
- Redis URL type (local / hosted): local (`redis://localhost:6379`)

### Nominatim geocode

- MISS: 201.7 ms
- HIT avg: 0.1 ms (10 runs)
- Speedup (MISS/HIT): 1365.2x

### OSRM route

- MISS: 1058.9 ms
- HIT avg: 0.2 ms (10 runs)
- Speedup (MISS/HIT): 5594.1x

## DB optimization note

Indexes were added to support B2B/cohort queries:

- `models/User.js`: index on `corporate.organization`
- `models/Booking.js`: compound index on `(passenger, status, createdAt)`
