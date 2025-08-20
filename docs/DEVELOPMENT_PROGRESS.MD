# Development Progress Log

Date: 2025-08-20

Summary: Completed database boolean portability refactor across backend routes to ensure cross-database compatibility (SQLite ↔ Postgres/Neon). Replaced integer-based boolean literals (0/1) with parameterized booleans and corrected parameter ordering where needed. Verified via repo-wide scan.

Changes:
- Updated `backend/src/routes/leagues.js`
  - Parameterized `l.is_active` checks (`... is_active = ?` with `true`).
  - Ensured joins and counts use `m.is_accepted = ?` with `true`.
- Updated `backend/src/routes/users.js`
  - Parameterized multiple `m.is_accepted` joins and `l.is_active` filters.
  - Adjusted parameter arrays to match placeholder order.
- Updated `backend/src/routes/auth.js`
  - Parameterized `m.is_accepted` join in `/me` stats.
  - Fixed parameter order to align with placeholders.
- Previously completed: `backend/src/routes/matches.js`, `backend/src/routes/notifications.js`.

Verification:
- Ran a scan for `= 0/1` usages on boolean columns in `backend/src/**/*.js`.
- No remaining occurrences found for `is_accepted`, `is_active`, `is_public`, `is_read`, `is_admin` using integer literals.

Docs:
- Updated `docs/TODO.md` to mark the Boolean portability audit as completed and documented updated files.

Notes:
- This aligns with the production DB strategy (SQLite locally, Neon Postgres in production) and keeps SQL dialect-agnostic as per project guidelines.

Next steps:
- Implement Postgres transaction handling (`withTransaction`) and update multi-step routes accordingly.

---

Date: 2025-08-20 (cont.)

Summary: Implemented transaction handling and refactored match flows.

Changes:
- Added `withTransaction(fn)` in `backend/src/models/database.js` that pins a Postgres client and exposes `tx.run/get/all`. Falls back to `BEGIN/COMMIT/ROLLBACK` on SQLite.
- Updated `backend/src/routes/matches.js`:
  - Create match: wrap inserts and notification creation in a transaction.
  - Accept match: wrap acceptance, ELO updates, ELO history inserts, and notifications in a transaction.
  - Reject match: wrap deletion and notifications in a transaction.

Result:
- Multi-step operations are now atomic across Postgres and SQLite.

Next steps:
- Create `backend/.env.example` with local defaults and Vercel guidance.
- Add DB mode smoke tests and document env/SSL details.

---

Date: 2025-08-21

Summary: Added environment template and DB smoke tests.

Changes:
- Created `backend/.env.example` with:
  - Local defaults: `DATABASE_PATH`, `FRONTEND_URL`, `PORT`, JWT vars.
  - Production guidance: `DATABASE_URL` with `sslmode=require`, `JWT_SECRET`, `FRONTEND_URL`.
- Added `backend/scripts/db-smoke.js` to verify:
  - SQLite mode (no `DATABASE_URL`): create table, insert, select.
  - Postgres mode (`DATABASE_URL` set): `SELECT 1`.
- Updated `backend/package.json` with script `db:smoke`.

Result:
- Contributors can configure env quickly and validate DB connectivity/mode via `npm run db:smoke`.
