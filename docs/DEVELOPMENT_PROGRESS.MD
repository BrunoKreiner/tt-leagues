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

Date: 2025-08-26

Summary: Implemented "Leave League" action on League Detail page with confirmation dialog.

Changes:
- Updated `frontend/src/pages/LeagueDetailPage.jsx`:
  - Added a member-only "Leave this league" card.
  - Uses `AlertDialog` (`@/components/ui/alert-dialog`) to confirm action.
  - Calls `DELETE /api/leagues/:id/leave` via `leaguesAPI.leave(id)` and shows success/error toasts.
  - Refactored `handleLeave` to component scope and added `refreshLeagueData()` to keep UI in sync.

Result:
- Members can leave a league with a clear confirmation step; UI refreshes to reflect non-member state.

Next steps:
- Build basic member management UI (admin) and top-bar invite notification with accept/deny.

Date: 2025-08-26

Summary: Implemented "Join with invite code" flow on League Detail page.

Changes:
- Updated `frontend/src/pages/LeagueDetailPage.jsx`:
  - Added a join form for authenticated non-members to enter an invite code.
  - Wired to `leaguesAPI.join(id, inviteCode)` which posts to `POST /api/leagues/:id/join`.
  - Added toast notifications via `sonner` for success and error states.
  - On success, clears the field and refreshes league data (league details + members) to reflect new membership.
  - Graceful error handling for invalid/expired codes (404), missing code (400), and already-a-member (409) with conditional refresh.

Result:
- Users with a valid invite code can join a league from the League Detail page with immediate UI feedback.

Next steps:
- Implement admin-only Invite UI on the same page to invite users by username (calls `POST /api/leagues/:id/invite`).
- Add leave action and basic members management UI.


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

---

Date: 2025-08-21

Summary: Documentation updates for envs and SSL.

Changes:
- Updated `README.md`:
  - Clarified DB selection: SQLite (local) / Postgres (production).
  - Expanded backend env section with `DATABASE_URL`, `DATABASE_PATH`, `FRONTEND_URL`, JWT vars, admin seeding.
  - Added notes on automatic `sslmode=require` and PG Pool SSL settings.
- Updated `docs/vercel_deployment_guide.md`:
  - Emphasized Postgres on Vercel with `DATABASE_URL` required; SQLite non-persistence note.
  - Documented SSL behavior (append `sslmode=require`, TLS enabled) and CORS.
  - Clarified environment variables and health route.

Result:
- New contributors can set up local and Vercel environments confidently with clear SSL guidance.

---

Date: 2025-08-22

Summary: Verified Vercel configuration (routes, handler, health endpoint, DB guard rails).

Changes/Verification:
- Checked `backend/vercel.json`: routes `/api/(.*)` and `/health` to `api/index.js`.
- Checked `backend/api/index.js`: exports Express `app`.
- Checked `backend/src/app.js`: `/health` endpoint exists and returns JSON 200; CORS supports comma-separated origins and wildcards; DB init awaited on Vercel cold start.
- Checked `backend/src/models/database.js`: on Vercel, requires `DATABASE_URL`; appends `sslmode=require` if missing and enables TLS in `Pool`.

Result:
- Code-level configuration is correct. Pending verification on live Vercel deployment.

Next steps:
- Confirm Vercel project envs: `DATABASE_URL`, `JWT_SECRET`, `FRONTEND_URL`.
- Hit `<backend-url>/health` and a simple API endpoint to confirm Neon connectivity and routing.

---

Date: 2025-08-22

Summary: Evaluation of `@neondatabase/serverless` vs `pg` Pool.

Notes:
- Pros: serverless-oriented driver; API-compatible `Pool`; potentially improved cold starts/connection reuse.
- Cons: adds dependency; requires validating transactional flows with pinned client.

Decision:
- Defer adoption until after initial Vercel deploy and metrics collection. Keep `pg` Pool for now.

Follow-up:
- If metrics indicate connection limits/cold start concerns, create a dedicated task to spike migration and benchmarks.

---

Date: 2025-08-22

Summary: Dependency cleanup — removed native `bcrypt` in favor of `bcryptjs`.

Changes:
- Updated `backend/fix_admin.js` and `backend/test_db.js` to `require('bcryptjs')`.
- Removed `bcrypt` from `backend/package.json` dependencies.

Verification:
- Repo-wide search confirms no remaining `require('bcrypt')` usages.
- Runtime already uses `bcryptjs` in `backend/src/models/database.js` (admin seeding) and `backend/src/routes/auth.js` (login/register).

Next steps:
- Run `npm uninstall bcrypt` in `backend/` to update lockfile locally.
- Optionally run `npm run db:smoke` to validate both DB modes still work.

---

Date: 2025-08-22

Summary: Reorganized `docs/TODO.md` into a feature-first roadmap aligned with `docs/FEATURES.md`.

Changes:
- Added new section: "MVP Core Features (High Priority Roadmap)" with clear Files/Actions/Acceptance for:
  - Auth & Profile
  - Leagues (create/join/manage)
  - Matches (record/approve/history)
  - Leaderboards & ELO history
  - Notifications UX
- Moved/clustered schema parity and indexing under "Schema Parity and Quality".
- Kept CORS/Dev Workflow, Technical Improvements, and Definition of Done as separate sections.
- Expanded Product Backlog with missing items from `docs/FEATURES.md`:
  - Admin Panel
  - Achievement System (badges)
- Updated Quick facts to reflect bcrypt native removal.

Impact:
- Clear MVP path and prioritization for near-term delivery.
- Better traceability from features to concrete actions and acceptance criteria.

Next steps:
- Flesh out endpoint-by-endpoint mapping for MVP items and link to specific frontend components.
- Track progress by checking items and appending status notes under each.

---

Date: 2025-08-22

Summary: Verified "Auth & Profile" feature (backend) and marked it as completed in `docs/TODO.md`. Reviewed leagues endpoints to prepare the next task.

Changes/Verification:
- Auth & Profile
  - Reviewed `backend/src/routes/auth.js`: register, login, me, profile update, and logout are implemented with `bcryptjs` + JWT and validation. No further backend work needed for MVP.
  - Updated `docs/TODO.md` to check the "Auth & Profile" item.
- Leagues (create/join/manage) — backend review
  - `backend/src/routes/leagues.js` provides: list (`GET /api/leagues`), create (`POST /api/leagues`, admin), details (`GET /api/leagues/:id`), update (`PUT /api/leagues/:id`, league admin), delete (soft, `DELETE /api/leagues/:id`, league admin), members (`GET /api/leagues/:id/members`), invite (`POST /api/leagues/:id/invite`, league admin), join with invite (`POST /api/leagues/:id/join`), leave (`DELETE /api/leagues/:id/leave`), leaderboard (`GET /api/leagues/:id/leaderboard`), and league matches (`GET /api/leagues/:id/matches`).
  - Access controls via `optionalAuth`/`authenticateToken` and `requireLeagueAdmin`. Boolean portability respected.

Result:
- Auth & Profile: backend complete; FE follow-ups remain (password reset flow, token lifecycle UX).
- Leagues: backend is implementation-ready; FE wiring is the next focus.

Next steps:
- Implement FE pages/flows for leagues: list and detail, create (admin), invite + join via code, members list, leave action, and minimal permissions UI (read-only for now).
- Keep "Leagues" unchecked in TODO until FE acceptance is validated end-to-end.

---

Date: 2025-08-22 (later)

Summary: Implemented Leagues frontend — list and detail pages wired to backend.

Changes:
- Updated `frontend/src/pages/LeaguesPage.jsx`:
  - Fetches `GET /api/leagues` via `leaguesAPI.getAll({ page, limit })`.
  - Displays cards with name, description, visibility (Public/Private), season, member/match counts.
  - Pagination UI using `@/components/ui/pagination` with URL `?page=` syncing.
  - Shows "Create League" button for admins (links to `/admin`, placeholder for upcoming create flow).
- Implemented `frontend/src/pages/LeagueDetailPage.jsx`:
  - Fetches league details `GET /api/leagues/:id`, leaderboard, members, and recent matches in parallel.
  - Renders overview stats, top-10 leaderboard, members preview, and last 10 matches with ELO deltas.
  - Uses shared UI: `Card`, `Badge`, `Table`, `LoadingSpinner`.

Docs:
- Added a progress note under "Leagues (create/join/manage)" in `docs/TODO.md` marking list page as implemented with pagination.

Notes:
- Ensure backend is running with appropriate `FRONTEND_URL` CORS settings and frontend has `VITE_API_URL` pointing to the API (`http://localhost:3001/api` by default).
- Admin-only actions (create, invites) will be added next.

Next steps:
- Build Create League form (admin) and route.
- Implement invite and join flows (invite code), and leave action.
- Expand detail page with full members list, permissions UI, and pagination where needed.

---

Date: 2025-08-22 (later)

Summary: LeagueDetailPage — auth-aware members fetch and resilient parallel loading.

Changes:
- Updated `frontend/src/pages/LeagueDetailPage.jsx` to:
  - Use `useAuth()` to detect authentication and skip `GET /api/leagues/:id/members` when unauthenticated (endpoint requires auth).
  - Switch to `Promise.allSettled` for parallel requests so a failure in one sub-request (e.g., private league access) does not break the whole page.
  - Default missing sections to empty arrays and still render available data (e.g., overview).

Result:
- More robust UX for public/private leagues and mixed auth states; prevents full-page error due to a single sub-request.

Next steps:
- Build admin create flow and invites/join.
- Add full members list with pagination and permissions UI.

---

Date: 2025-08-22 (later)

Summary: Implemented Create League admin UI and added quick API test script.

Changes:
- Updated `frontend/src/pages/AdminPage.jsx`:
  - Added Create League form using `react-hook-form` + `zod` with fields: name, description (optional), season (optional), public toggle.
  - Submits to `POST /api/leagues` via `leaguesAPI.create`, shows success/error toasts, handles 409 duplicate name, and navigates to `/leagues/:id` on success.
  - Uses shared UI components: `Card`, `Input`, `Textarea`, `Switch`, `Button`, and `Form` primitives.
- Added `backend/scripts/quick-api-tests.ps1`:
  - Health check, admin login, unauthorized create (expect 401/403), authorized create, duplicate name (expect 409), fetch by id, list leagues.
  - Parameterized `-ApiBase` (defaults to `http://localhost:3001/api`).

Result:
- Admins can create leagues from `/admin` and get redirected to the new league.
- Quick smoke of auth + league creation available via PowerShell script.

Next steps:
- Implement invite and join flows (invite code) and leave action.
- Expand League Detail with full members list and permissions UI.
- Add frontend tests for Create League form validation and success/error flows.

---
