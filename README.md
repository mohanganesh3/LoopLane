# LoopLane - Run Instructions

Live: https://looplane.onrender.com/

## Option A: Run locally (dev)

## Step 1: Install Dependencies

```bash
npm install
cd client && npm install && cd ..
```

## Step 2: Run Backend

```bash
npm run dev
```
Backend runs at: http://localhost:3000

## Step 3: Run Frontend (new terminal)

```bash
cd client
npm run dev
```
Frontend runs at: http://localhost:5173

## Verification Commands

Use these before the review to produce repeatable proof that the app is healthy:

```bash
npm test -- --runInBand
npm run build
npm run verify:system
BASE_URL=https://looplane.onrender.com npm run verify:system
```

`npm run verify:system` checks:

- `/api/health`
- admin login
- protected Swagger JSON
- `/api/admin/system-health`
- `/api/admin/users`
- cache behavior on `/api/route` (`MISS` then `HIT`)
- admin search backend visibility via `X-Search-Backend`

## Review Artifacts

These files map directly to the evaluation checklist:

- [END_REVIEW_GUIDE.md](/Users/mohanganesh/wbd/LoopLane/END_REVIEW_GUIDE.md)
- [DB_OPTIMIZATION_REPORT.md](/Users/mohanganesh/wbd/LoopLane/DB_OPTIMIZATION_REPORT.md)
- [REDIS_CACHING_REPORT.md](/Users/mohanganesh/wbd/LoopLane/REDIS_CACHING_REPORT.md)
- [SOLR_SEARCH.md](/Users/mohanganesh/wbd/LoopLane/SOLR_SEARCH.md)

## Option B: Run with Docker (Mongo + Redis + API)

This brings up **MongoDB**, **Redis**, **Solr**, and the **LoopLane API** (serving the built client).

1) Start services:

```bash
docker compose up --build
```

2) Seed an admin user (first time only):

```bash
docker compose exec app npm run seed:admin
```

3) (Optional) Index users into Solr (enables fast admin search):

```bash
docker compose exec app node scripts/solr/reindex-users.js
```

4) Open the app:

- API: http://localhost:3000
- Swagger (requires login): http://localhost:3000/api/docs

> Note: `docker-compose.yml` includes **dev-only** placeholder secrets for `JWT_SECRET`/`COOKIE_SECRET`.
> Replace these for any real deployment.
