# Project TODO and Roadmap

Scope: Align database usage with environment (SQLite for local/testing; Neon Postgres in production on Vercel via DATABASE_URL) and track near-term technical and product backlog.

Quick facts (current state):
- backend/src/models/database.js: selects Postgres when DATABASE_URL is set; otherwise uses SQLite. On Vercel, default SQLite path is /tmp/league.db.
- backend/api/index.js and backend/vercel.json: serverless export and routes (/api/*, /health) are configured.
- bcryptjs is used in code (auth and admin seeding); native `bcrypt` has been removed from `backend/package.json`.
- docker-compose.yml runs the backend with NODE_ENV=production and DATABASE_PATH (SQLite) for local containerized usage.

---

## MVP Core Features (High Priority Roadmap)

- [x] Auth & Profile
  - Files: `backend/src/routes/auth.js`, frontend auth pages/components
  - Actions: Add password reset flow; ensure token refresh/expiry handling on FE; profile edit endpoints wired with UI validation
  - Acceptance: Register/login/logout work reliably; profile updates persist; FE handles token lifecycle gracefully

 - [x] Leagues (create/join/manage)
  - Files: `backend/src/routes/leagues.js`, FE league pages
  - Actions: Create league (admin), join/invite flows, membership management UI; access controls
  - Acceptance: Users can create/join leagues; membership lists and permissions work end-to-end
  - Status: Backend endpoints implemented and reviewed (`leagues.js`); FE: list + detail pages implemented; Create League admin UI implemented on `/admin`. Join via invite code UI implemented on `LeagueDetailPage` (for authenticated non-members). Invite by username (admin) implemented on `LeagueDetailPage` with generated code + expiry display. Leave League action implemented with confirmation dialog. Members management UI implemented with roles/stats table. Notifications dropdown implemented in header with league invite accept/deny actions (accept now works without code via pending invite; invite is marked accepted to prevent reuse after leaving/kick). Admin tools for promoting/demoting league admins and revoking pending invites are implemented on `LeagueDetailPage` with confirmation dialogs, toasts, and proper admin-only UI gating.
  - Progress: FE Leagues list page implemented and wired to `GET /api/leagues` with pagination; detail page implemented (overview, leaderboard, members preview, recent matches). Members fetch is auth-aware and page uses resilient parallel loading. Create League form on `/admin` uses `react-hook-form` + `zod`, posts to `POST /api/leagues`, handles 409 duplicate name, and navigates to the new league. Added `backend/scripts/quick-api-tests.ps1` to exercise auth and league creation (health, login, unauthorized create, authorized create, duplicate check, fetch by id, list). Implemented Join with invite code on `LeagueDetailPage` calling `POST /api/leagues/:id/join` with proper error handling and success refresh. Implemented Invite by username on `LeagueDetailPage` calling `POST /api/leagues/:id/invite` with toasts and showing `invite_code` and `expires_at`. Implemented Leave League on `LeagueDetailPage` calling `DELETE /api/leagues/:id/leave` with a confirmation `AlertDialog` and success/error toasts. Implemented full Members table with roles (admin/member), W/L, Win%, and Joined date using `GET /api/leagues/:id/members`. Implemented Dashboard "My Leagues" fix by adding `is_member` in `GET /api/leagues` and filtering on FE `DashboardPage.jsx`.
  - Status: Notifications page with pagination and filters implemented at `/notifications` and linked from the header dropdown.

- [x] Matches (record/approve/history)
  - Files: `backend/src/routes/matches.js`, FE match forms/history
  - Actions: Record match with set scores; pending/approve/reject admin flow; history list with filters
  - Acceptance: Recording and approvals update ELO; audit trail visible; UX validated
  - Status: Backend endpoints implemented; duplicate `/pending` and `/preview-elo` routes deduplicated in `backend/src/routes/matches.js`. Added league ELO consolidation feature: schema fields `leagues.elo_update_mode` and `matches.elo_applied(_at)`; `POST /api/matches/:id/accept` now respects `elo_update_mode` (immediate vs deferred weekly/monthly); added `POST /api/matches/leagues/:leagueId/consolidate?force=true`. FE: Matches list with tabs/pagination; Record Match form with live ELO preview; Admin Pending Approvals UI; Match Detail view with pre-accept editing + inline ELO preview; cross-linking from lists; ELO Applied/Deferred badges surfaced. Admin UI added on League Detail to set `elo_update_mode` and run consolidation. Dockerized tests added (Jest + supertest), CI workflow created.

- [x] Leaderboards & ELO history
  - Files: `backend/src/routes/leagues.js` (leaderboard endpoint), ELO history endpoint; FE leaderboard + chart
  - Actions: Add top-N leaderboard with pagination; per-user ELO history endpoint (from `elo_history`); FE: league leaderboard table (paginate), per-user ELO timeline chart (sparklines on leaderboard + full chart on profile)
  - Acceptance: Leaderboard reflects latest accepted matches (and deferred applied only after consolidation); ELO timeline renders correctly with tooltips
  - Status: ✅ **COMPLETED** - Paginated leaderboards, ELO history API, sparklines, full ELO charts, and consolidation system all implemented and working

- [ ] Public profiles
  - Files: `backend/src/routes/users.js` (new/profile endpoints), FE profile pages
  - Actions: Public profile route shows user overview, per-league ranks, recent matches, badges; add public profile routes and navigation from leaderboard/matches
  - Acceptance: Any user can view others’ profiles with non-sensitive info; their ranks and badges visible

- [ ] Badges & medals
  - Files: schema updates (badges/user_badges if needed), routes to award/revoke/list badges; FE profile and leaderboard badge display
  - Actions: Support admin-awarded badges; upload/display rank medal PNGs on leaderboard rows; show earned badges on profile
  - Acceptance: Admin can award/revoke; users see badges on profile; leaderboard shows medal icons for top ranks

- [ ] Notifications UX
  - Files: `backend/src/routes/notifications.js`, FE notifications components
  - Actions: Wire list/mark-as-read/delete; toast for key events; unread count in header
  - Acceptance: Unread count updates; actions return 200; UX consistent

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

- [x] Documentation updates (envs and SSL)
  - Files: `README.md`, `docs/vercel_deployment_guide.md`
  - Action: Explain DB selection logic explicitly and Neon usage on Vercel, including SSL requirements (`sslmode=require` or Pool SSL object). Provide copyable examples and screenshots (optional).
  - Acceptance: New contributors can deploy locally and to Vercel without surprises.

- [x] Verify Vercel configuration
  - Files: `backend/vercel.json`, `backend/api/index.js`, Vercel project settings
  - Action: Ensure routes `/api/*` and `/health` are correct. Confirm envs set on Vercel: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`.
  - Acceptance: Health check OK, routes map correctly, DB connects to Neon on Vercel.
  - Status: Code-level verification completed. `backend/vercel.json` routes `/api/*` and `/health` to `api/index.js`; `backend/api/index.js` exports the Express `app`; `/health` endpoint present in `backend/src/app.js`; Vercel guard rails in `backend/src/models/database.js` require `DATABASE_URL` and enforce SSL. Awaiting deployed backend URL to confirm 200 health response and Neon connectivity.

- [x] Optional: evaluate `@neondatabase/serverless`
  - Files: spike only
  - Action: Compare cold starts and query performance vs `pg` Pool. Evaluate connection reuse and cost. Document tradeoffs and a migration plan if beneficial.
  - Acceptance: Decision recorded; if adopting, create a separate implementation task.
  - Status: Reviewed driver. Pros: serverless-friendly, API-compatible `Pool` export; likely better connection behavior on serverless. Cons: new dep; requires validation of transactions with pinned client. Decision: defer adoption until after first Vercel deploy and metrics; keep `pg` Pool for now. Added evaluation notes in `docs/DEVELOPMENT_PROGRESS.MD`.

- [x] Dependency cleanup: remove bcrypt
  - Files: `backend/package.json`
  - Action: Remove the `bcrypt` dependency (code uses `bcryptjs`). Ensure no imports reference `bcrypt`.
  - Acceptance: Clean install works; auth and admin seeding continue to function.
  - Status: Updated `backend/fix_admin.js` and `backend/test_db.js` to use `bcryptjs`; removed `bcrypt` from `backend/package.json`; repo-wide scan shows no remaining `require('bcrypt')`. Runtime already uses `bcryptjs` in `backend/src/models/database.js` and `backend/src/routes/auth.js`.

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

- [ ] Admin Panel
  - Next steps: User management, match approval queue, league creation/management, system overview pages.

- [ ] Achievement System (badges)
  - Next steps: Badge schema, award rules (seasonal/performance), server logic, UI badge display on profiles.

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
