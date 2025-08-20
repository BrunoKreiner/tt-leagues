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
