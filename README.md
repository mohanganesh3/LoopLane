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
