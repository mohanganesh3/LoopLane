# Database Optimization Report

This report is the review-facing summary of the database and search optimization work completed in LoopLane.

## 1. Bottlenecks identified

The main latency and scalability risks in this codebase were:

- repeated external API calls for geocoding and routing
- regex-heavy admin user search over `email`, `phone`, `profile.firstName`, and `profile.lastName`
- repeated booking-history queries sorted by `createdAt`
- repeated ride listings filtered by status and departure time
- emergency/admin lookups filtered by user and status

## 2. Optimizations implemented

### 2.1 Indexing

The current Mongo schema includes explicit indexes for the main query shapes used by the application:

- `models/User.js`
  - `role_1`
  - `verificationStatus_1`
  - `rating.overall_-1`
  - `corporate.organization_1`
- `models/Booking.js`
  - `ride_1_passenger_1`
  - `rider_1_status_1`
  - `passenger_1_status_1`
  - `passenger_1_status_1_createdAt_-1`
  - `status_1_createdAt_-1`
- `models/Ride.js`
  - `startPoint_2dsphere`
  - `destPoint_2dsphere`
  - `rider_1_status_1`
  - `schedule.departureDateTime_1`
  - `status_1_schedule.departureDateTime_1`
- `models/Emergency.js`
  - `location.coordinates_2dsphere`
  - `user_1_status_1`
  - `status_1_triggeredAt_-1`
- `models/SearchLog.js`
  - `user_1_createdAt_-1`
  - `originPoint_2dsphere`
  - `destPoint_2dsphere`
  - TTL cleanup index on `createdAt`

### 2.2 Query planning evidence

Use the repo script below to print the live index inventory and real `explain('executionStats')` output against MongoDB:

```bash
npm run report:db
```

Latest run on `2026-04-18` showed:

- Booking history query
  - pattern: passenger + status + `createdAt desc`
  - winning index: `passenger_1_status_1_createdAt_-1`
  - stages: `IXSCAN -> FETCH -> LIMIT`
  - keys examined: `1`
  - docs examined: `1`
- Upcoming rides query
  - pattern: status + `schedule.departureDateTime`
  - winning index: `status_1_schedule.departureDateTime_1`
  - stages: `IXSCAN -> FETCH -> LIMIT`
  - keys examined: `10`
  - docs examined: `10`
- Emergency lookup query
  - pattern: user + status
  - winning index: `user_1_status_1`
  - stages: `IXSCAN -> FETCH -> LIMIT`
  - keys examined: `2`
  - docs examined: `2`

The B2B corporate-organization explain path is also included in the script. It was skipped in the latest run only because the current dataset had no seeded corporate users.

### 2.3 Redis caching

High-cost external API endpoints are cached through `utils/redisCache.js`:

- `GET /api/geocode`
- `GET /api/reverse-geocode`
- `GET /api/autocomplete`
- `POST /api/route`
- `POST /api/distance-matrix`
- `POST /api/snap-to-road`
- `GET /api/eta`

B2B dashboard endpoints are also cached:

- `GET /api/corporate/dashboard`
- `GET /api/corporate/esg-report`

Verification signal:

- `X-Cache: MISS | HIT`
- `X-Cache-Store: redis | memory | none`

### 2.4 Solr-backed user search

Admin search uses Solr when `SOLR_URL` is configured. This avoids Mongo regex scans on larger datasets.

Verification signal:

- `X-Search-Backend: solr | mongo | mongo-fallback`

## 3. Measured performance improvement

### Local Docker Redis

Results from `REDIS_CACHING_REPORT.md`:

- Nominatim geocode
  - MISS: `201.7 ms`
  - HIT avg: `0.1 ms`
  - speedup: `1365.2x`
- OSRM route
  - MISS: `1058.9 ms`
  - HIT avg: `0.2 ms`
  - speedup: `5594.1x`

### Managed Redis (Upstash)

Results from `2026-04-18` using the hosted TLS Redis URL:

- Nominatim geocode
  - MISS: `1089.5 ms`
  - HIT avg: `45.4 ms`
  - speedup: `24.0x`
- OSRM route
  - MISS: `1027.3 ms`
  - HIT avg: `35.9 ms`
  - speedup: `28.6x`

Interpretation:

- local Redis is fastest because it avoids network latency entirely
- Upstash is slower than local Redis but still removes the expensive external API round-trip
- for deployment, managed Redis still gives a strong real-world improvement over uncached misses

## 4. Reproducible commands

```bash
# Live Mongo index inventory + explain plans
npm run report:db

# Redis benchmark against current REDIS_URL
npm run bench:redis

# Example managed Redis benchmark
REDIS_URL=rediss://<upstash-url> BENCH_HIT_RUNS=5 npm run bench:redis

# Full app smoke verification
npm run verify:system
```

## 5. What to say in review

- We optimized the database in two layers: Mongo indexing/query planning and Redis/Solr at the application layer.
- We can show both static evidence and runtime evidence.
- Static evidence: schema indexes in the models and `npm run report:db`.
- Runtime evidence: `X-Cache`, `X-Cache-Store`, `X-Search-Backend`, and the Redis benchmark script.
