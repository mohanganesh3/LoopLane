# Solr Search Integration (LoopLane)

LoopLane includes an **optional Apache Solr** integration to improve the **admin user search** experience.

## What is improved

The endpoint:

- `GET /api/admin/users?search=<query>`

Previously relied on MongoDB regex scans over `email`, `phone`, `profile.firstName`, and `profile.lastName`.

With Solr enabled, the controller:

1. Queries Solr for relevant user IDs (fast full‑text search)
2. Fetches those users from MongoDB in the same order
3. Falls back to the Mongo regex approach automatically if Solr is not configured/reachable

## Configuration

Set:

- `SOLR_URL=http://localhost:8983/solr`

If `SOLR_URL` is not set, Solr is considered **disabled**.

## Docker (recommended)

`docker-compose.yml` includes a Solr service that pre-creates a `users` core.

After starting the stack:

- Solr UI: http://localhost:8983

## Indexing users

Solr needs documents. Reindexing script:

- `npm run solr:reindex-users`
- `npm run solr:reindex-users:clean` (clears the core first)

### Indexed fields

- `email_t`, `phone_t`, `firstName_t`, `lastName_t`, `fullName_t` (full-text)
- `role_s`, `accountStatus_s`, `verificationStatus_s` (filters)

## How to verify in the demo

1. Create/seed some users
2. Run the Solr reindex script
3. Call `GET /api/admin/users?search=<name/email/phone>` and confirm results return quickly

> If Solr is down/misconfigured, the endpoint still works via MongoDB fallback.
