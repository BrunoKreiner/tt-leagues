# Project TODO and Roadmap

Scope: Align database usage with environment (SQLite for local/testing; Neon Postgres in production on Vercel via DATABASE_URL) and track near-term technical and product backlog.

Quick facts (current state):
- backend/src/models/database.js: selects Postgres when DATABASE_URL is set; otherwise uses SQLite. On Vercel, default SQLite path is /tmp/league.db.
- backend/api/index.js and backend/vercel.json: serverless export and routes (/api/*, /health) are configured.
- bcryptjs is used in code (auth and admin seeding), but backend/package.json still includes bcrypt.
- docker-compose.yml runs the backend with NODE_ENV=production and DATABASE_PATH (SQLite) for local containerized usage.

---

## 1) Database Environment Strategy (High Priority)

- [x] Guard rails for Vercel: fail fast if DATABASE_URL is missing
  - Files: `backend/src/models/database.js`
  - Action: If running on Vercel (process.env.VERCEL), throw on startup when DATABASE_URL is not set. Do not enforce for local Docker (which uses NODE_ENV=production with SQLite).
  - Acceptance:
    - On Vercel without DATABASE_URL: app fails startup with clear error to avoid ephemeral SQLite.
    - Local dev and Docker (with SQLite path) continue working.

- [x] Boolean portability audit (SQLite vs Postgres)
  - Files: `backend/src/routes/**/*.js`, `backend/src/models/**/*.js`
  - Action: Replace SQL like `is_accepted = 0/1`, `is_read = 0/1`, `lm.is_admin = 1` with parameterized booleans or dialect-agnostic SQL (e.g., `... = ?` with JS `true/false`, or use TRUE/FALSE in SQL on PG-specific code paths if needed).
  - Acceptance: Queries behave identically across SQLite and Postgres without casting issues.
  - Progress:
    - Updated: `backend/src/routes/matches.js` (parameterized `m.is_accepted` and `lm.is_admin` subquery conditions; accept route uses boolean parameter), `backend/src/routes/notifications.js` (`is_read` filters/updates), `backend/src/routes/leagues.js` (`is_active`, `is_public`, joins on `m.is_accepted`), `backend/src/routes/users.js` (joins on `m.is_accepted`, league `is_active`), `backend/src/routes/auth.js` (stats join on `m.is_accepted`).
    - Re-scan: Completed across `backend/src/**/*.js`; no remaining `= 0/1` comparisons for boolean columns.

- [x] Postgres transaction handling
  - Files: `backend/src/models/database.js`, routes that perform multi-step writes (e.g., `backend/src/routes/matches.js`)
  - Action: Added `withTransaction(fn)` using a pinned client for Postgres, providing `tx.run/get/all`. Updated multi-step flows in `matches.js` (create, accept, reject) to wrap writes in a transaction.
  - Acceptance: Multi-operation flows commit/rollback atomically on Postgres. (Done)

- [x] Admin seeding: boolean consistency
  - Files: `backend/src/models/database.js`
  - Action: When inserting/updating `is_admin`, pass boolean `true` (parameterized) to work for both SQLite and Postgres.
  - Acceptance: Admin user is correctly created/updated on both DBs. (Done)

- [x] .env.example (backend)
  - Files: `backend/.env.example`
  - Action: Provide a template with local defaults and production guidance.
    - Local: omit DATABASE_URL; set `DATABASE_PATH=backend/database/league.db`; set `FRONTEND_URL=http://localhost,http://localhost:5173`.
    - Production (Vercel): include `DATABASE_URL` (with sslmode=require if not present), `JWT_SECRET`, `FRONTEND_URL`.
  - Acceptance: Contributors can copy this to quickly configure local and Vercel environments.

- [x] DB mode smoke tests
  - Files: `backend/scripts/db-smoke.js` (new), `backend/package.json` (scripts)
  - Action: Add a script that:
    - Without DATABASE_URL: verifies SQLite can read/write (simple create table, insert, select).
    - With DATABASE_URL: connects and runs `SELECT 1` on Postgres.
  - Acceptance: `npm run db:smoke` reports pass/fail for both modes.

- [ ] Documentation updates (envs and SSL)
  - Files: `README.md`, `docs/vercel_deployment_guide.md`
  - Action: Explain DB selection logic explicitly and Neon usage on Vercel, including SSL requirements (`sslmode=require` or Pool SSL object). Provide copyable examples and screenshots (optional).
  - Acceptance: New contributors can deploy locally and to Vercel without surprises.

- [ ] Verify Vercel configuration
  - Files: `backend/vercel.json`, `backend/api/index.js`, Vercel project settings
  - Action: Ensure routes `/api/*` and `/health` are correct. Confirm envs set on Vercel: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`.
  - Acceptance: Health check OK, routes map correctly, DB connects to Neon on Vercel.

- [ ] Optional: evaluate `@neondatabase/serverless`
  - Files: spike only
  - Action: Compare cold starts and query performance vs `pg` Pool. Evaluate connection reuse and cost. Document tradeoffs and a migration plan if beneficial.
  - Acceptance: Decision recorded; if adopting, create a separate implementation task.

- [ ] Dependency cleanup: remove bcrypt
  - Files: `backend/package.json`
  - Action: Remove the `bcrypt` dependency (code uses `bcryptjs`). Ensure no imports reference `bcrypt`.
  - Acceptance: Clean install works; auth and admin seeding continue to function.

---

## 2) Schema Parity and Quality (Medium Priority)

- [ ] Align SQLite and Postgres schemas
  - Files: `backend/database/schema.sql`, `backend/database/schema.pg.sql`
  - Action: Ensure consistent columns, defaults, indexes, and constraints. Confirm all entities are created with `IF NOT EXISTS`. Document any expected dialect differences (e.g., autoincrement vs serial/identity; datetime types).
  - Acceptance: Feature parity across DBs; initialization succeeds in both modes.

- [ ] Indexing review for critical queries
  - Files: same as above
  - Action: Verify indexes for frequent lookups (user by username/email, memberships, pending matches, elo history).
  - Acceptance: No obvious slow queries due to missing indexes.

---

## 3) CORS and Developer Workflow (Medium/Low Priority)

- [ ] CORS docs
  - Files: `README.md`
  - Action: Document `FRONTEND_URL` behavior (comma-separated, wildcard support). Provide local and Vercel examples.
  - Acceptance: Clear CORS configuration guidance.

- [ ] Developer workflow docs
  - Files: `README.md`
  - Action: Document local SQLite workflow (database file under `backend/database`, `npm run init-db`, docker-compose) vs Vercel/Neon production.
  - Acceptance: New devs can follow repeatable steps.

- [ ] Optional: local Postgres dev script
  - Files: `backend/package.json`
  - Action: Add `dev:pg` to run against a local/remote Postgres URL for contributors who want to test PG locally.
  - Acceptance: Script runs server pointing to Postgres.

---

## 4) Product Backlog — Planned Features (from docs/FEATURES.md)

These are not implemented; capture next steps at a high level.

- [ ] Tournament System (brackets)
  - Next steps: Design schema (tournaments, rounds, matches), endpoints for creation/progression, UI for brackets.

- [ ] Advanced Statistics (detailed analytics)
  - Next steps: Define KPIs (win streaks, set-level stats), aggregate tables/materialized views, endpoints, UI dashboards.

- [ ] Mobile App (native)
  - Next steps: Decide tech (React Native/Flutter), shared API auth flows, minimal feature set (auth, record matches, view rankings).

- [ ] Social Features (messaging, social interaction)
  - Next steps: Messaging schema, endpoints, notification integration, UI components, moderation policy.

- [ ] Integration (external tournament systems)
  - Next steps: Identify target systems/APIs, define sync jobs, mapping strategy.

- [ ] Reporting (advanced analytics)
  - Next steps: Define report templates, export formats (CSV/PDF), server-side generation.

- [ ] Multi-language (i18n)
  - Next steps: Choose i18n library, extract strings, translation files, language switcher.

---

## 5) Technical Improvements (from docs/FEATURES.md)

- [ ] PostgreSQL for production (Neon) — ongoing
  - Next steps: Complete items in Section 1; add pooling/driver evaluation; confirm migration path for existing data (if any).

- [ ] Redis Caching
  - Next steps: Identify cacheable endpoints, add Redis client/config, cache invalidation strategy.

- [ ] WebSocket (real-time)
  - Next steps: Choose transport (WS/SSE), define real-time events (match updates, notifications), server integration compatible with serverless (or move to edge/another service).

- [ ] Microservices (SOA)
  - Next steps: Identify bounded contexts, extract services (auth/matches/notifications), messaging layer (e.g., queue), deployment plan.

- [ ] CI/CD Pipeline
  - Next steps: Add CI (lint, tests, smoke), CD to Vercel for frontend/backend, database migration steps.

- [ ] Monitoring and Alerting
  - Next steps: Add structured logging, error tracking (Sentry), metrics dashboards.

---

## 6) Implementation Notes

- Guard rails must only enforce on Vercel (`process.env.VERCEL`) to avoid breaking local Docker where `NODE_ENV=production` and SQLite is intended.
- For Postgres SSL: ensure `sslmode=require` in DATABASE_URL if not present, and pass `ssl: { rejectUnauthorized: false }` in Pool options (as already done).
- Keep queries parameterized and prefer booleans over integer flags.

---

## 7) Definition of Done (for DB environment work)

- On Vercel: backend refuses to start without `DATABASE_URL`; with it, initializes/queries Neon successfully.
- Locally: SQLite flows remain functional (bare metal and Docker).
- Transactional operations are atomic on Postgres.
- Docs updated with clear env setup and workflows.
- Smoke tests pass for both modes.
- No lingering bcrypt dependency.
