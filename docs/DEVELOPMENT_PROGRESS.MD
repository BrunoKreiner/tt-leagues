# Development Progress Log

Date: 2026-01-02

Summary: Fixed badge image cropper overlay rendering issue and cancel button behavior. Implemented comprehensive badge image upload and cropping functionality.

Changes:
- Fixed `InlineImageCropper` component overlay rendering:
  - Changed from using `clearRect()` (which cleared both overlay and image) to drawing overlay in four rectangles around crop area (top, bottom, left, right)
  - Image is now clearly visible inside the crop area for both new uploads and editing existing images
  - Overlay opacity set to 30% for good contrast while keeping image visible
- Fixed cancel button behavior:
  - Added `onCancel` prop to `InlineImageCropper` component
  - Cancel button now preserves existing images when editing (only closes cropper) instead of deleting them
  - When uploading new images, cancel still removes the image as expected
- Previously completed: Badge image upload with inline cropper, database schema updates (image_url column), badge image display in profiles and leaderboards

Result:
- Badge image cropper now works correctly: image is visible in crop area, overlay provides clear visual distinction, cancel button behaves correctly for both new uploads and edits

---

Date: 2025-08-27 (later)

Summary: Added ELO consolidation setting per league with deferred application and consolidation endpoint.

Changes:
- Updated `backend/database/schema.sql` and `backend/database/schema.pg.sql`:
  - Added `leagues.elo_update_mode` (immediate|weekly|monthly, default `immediate`).
  - Added `matches.elo_applied` and `matches.elo_applied_at` to track when deferred ELO is applied.
- Updated `backend/src/routes/leagues.js`:
  - List and details now include `elo_update_mode`.
  - `PUT /api/leagues/:id` allows updating `elo_update_mode` with validation.
- Updated `backend/src/routes/matches.js`:
  - `POST /api/matches/:id/accept`: respects league `elo_update_mode`.
    - Immediate: applies ELO, records history, marks `elo_applied=true`.
    - Weekly/Monthly: marks accepted but defers ELO, notifies players of deferral.
  - Added consolidation endpoint: `POST /api/matches/leagues/:leagueId/consolidate?force=true` to apply deferred ELO updates in chronological order.

Result:
- Leagues can choose immediate ELO updates or deferred weekly/monthly consolidation to reduce volatility.

Notes:
- Frontend admin UI to expose `elo_update_mode` and a "Run consolidation now" action is pending.
- Endpoint path for consolidation is under matches router as noted above; can be aliased under leagues later if preferred.

Next steps:
- Add admin UI on `LeagueDetailPage` to configure `elo_update_mode` and trigger consolidation.
- Add schedule/CRON (out-of-scope for serverless) or operational docs for running consolidation periodically.

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

Date: 2025-08-27 (later)

Summary: Added Admin Pending Approvals UI under /admin to review, accept, or reject pending matches.

Changes:
- Updated `frontend/src/pages/AdminPage.jsx`:
  - Added a "Pending Match Approvals" card that lists pending matches via `matchesAPI.getPending({ page, limit: 10 })`.
  - Implemented Accept and Reject actions using `matchesAPI.accept(id)` and `matchesAPI.reject(id, reason)` with confirmation prompt for an optional reason.
  - Included pagination using shared `@/components/ui/pagination` and date display via `date-fns/format`.
  - Added loading state with `LoadingSpinner` and toasts for success/error.

Result:
- League admins can process match approvals efficiently from the Admin Panel.

Notes:
- The table shows When, League, Players, and Result for each pending item. Paging and total counts are displayed.

Next steps:
- Build Match Detail view/modal and cross-link from listings.


Date: 2025-08-27

Summary: Implemented Record Match form with ELO preview and added routing/link.

Changes:
- Created `frontend/src/pages/RecordMatchPage.jsx`:
  - Uses `react-hook-form` + `zod` with fields matching backend validation: `league_id`, `player2_id`, `game_type`, `player1_sets_won`, `player2_sets_won`, `player1_points_total`, `player2_points_total`, optional `played_at`.
  - League selector fetches only leagues where current user is a member (`GET /api/leagues` with `is_member` flag, filtered on FE).
  - Opponent selector fetches members via `GET /api/leagues/:id/members` and excludes current user.
  - Live ELO preview via `POST /api/matches/preview-elo`, debounced on relevant input changes.
  - Submits to `POST /api/matches` and navigates to `/matches` with success/error toasts.
- Updated `frontend/src/App.jsx` to add protected route: `/matches/record`.
- Updated `frontend/src/pages/MatchesPage.jsx` to add a "Record Match" button linking to `/matches/record`.

Result:
- Authenticated users can record a match against a league opponent with immediate ELO change preview.

Notes:
- `played_at` is optional and may require backend persistence support in a follow-up.

Next steps:
- Build Admin Pending Approvals UI and Match Detail as tracked in `docs/match_todo.md`.

Date: 2025-08-27 (later)

Summary: Fixed Record Match league/members loading issues.

Changes:
- Updated `frontend/src/pages/RecordMatchPage.jsx`:
  - Leagues fetch now uses `limit=100` (backend max per `validatePagination`) to avoid 400 Bad Request.
  - Opponent selector and related filtering switched from `member.user_id` to `member.id` to match `GET /api/leagues/:id/members` response (`u.id AS id`).

Result:
- Record Match page loads leagues and members correctly for authenticated users. Opponent selection works with the correct IDs. No more 400 errors when listing leagues.

Notes:
- Verified `leaguesAPI.getAll({ page: 1, limit: 100 })` and `leaguesAPI.getMembers(leagueId)` in `frontend/src/services/api.js` align with backend routes.

Next steps:
- Thorough UI test of Record Match flow, then proceed with Admin Pending Approvals UI.

Date: 2025-08-26 (later)

Summary: Implemented full Notifications page with pagination and filters, added route, and linked it from the header dropdown.

Changes:
- Created `frontend/src/pages/NotificationsPage.jsx`:
  - Lists notifications with unread highlighting, icons, and relative timestamps via `date-fns`.
  - Pagination (page size 10) with previous/next controls using `@/components/ui/pagination`.
  - Filter toggle: All vs Unread (passes `unread_only=true` to `GET /api/notifications`).
  - Actions: mark single notification as read, mark all as read, accept/deny league invites (code-less join via `leaguesAPI.join(id)`).
- Updated `frontend/src/App.jsx` to add route: `/notifications`.
- Updated `frontend/src/components/layout/Layout.jsx` to include a footer "View all notifications" link in the dropdown to navigate to the page.

Result:
- Users can browse all notifications with pagination, filter by unread, take actions (read, mark-all-read, accept/deny invites), and navigate back to leagues when relevant.

Notes:
- Backend `GET /api/notifications` already supports `page`, `limit`, and `unread_only`; FE uses these params.

Date: 2025-08-26

Summary: Polished Notifications dropdown with relative timestamps, icons, and unread styling. Accept invite from dropdown no longer requires a code and actions are hidden after read.

Changes:
- Updated `frontend/src/components/layout/Layout.jsx`:
  - Render relative time via date-fns `formatDistanceToNow` using `created_at`.
  - Icons per type (`UserPlus` for `league_invite`, default `Bell`).
  - Unread styling: background highlight and bold title; hide Accept/Deny once read; “Invite handled” label.
- Updated `frontend/src/services/api.js`:
  - `leaguesAPI.join` supports empty body when accepting via notification (code-less join when pending invite exists).
- Updated `docs/TODO.md` to reflect only pagination/"View all" remains for notifications.

Result:
- Cleaner notifications UX; invitations can be accepted directly without code; read items are visually distinct and non-actionable.

Next steps:
- Add notifications pagination or create a `Notifications` page with pagination and filters.

---

Date: 2025-08-26

Summary: Completed Members management UI and added Notifications dropdown with league invite actions.

Changes:
- Updated `frontend/src/pages/LeagueDetailPage.jsx`:
  - Implemented comprehensive "All Members" table with columns: User (username + full name), Role (Admin/Member badges), ELO, W/L, Win%, Joined date.
  - Kept existing preview members card; added role/permissions hints for future management.
- Updated `frontend/src/components/layout/Layout.jsx`:
  - Added top-bar Notifications dropdown with unread badge.
  - Fetches `GET /api/notifications` via `notificationsAPI.getAll({ limit: 10 })` and shows list.
  - Supports Mark as read, Mark all as read.
  - For `league_invite` notifications: Accept via invite code (calls `POST /api/leagues/:id/join`), Deny (marks as read), and quick link to the league.
- Updated `docs/TODO.md` to mark Members management UI as implemented and list remaining items for Notifications UI and dashboard label fix.

Result:
- Members list is now feature-complete for read-only management and stats.
- Users can see invitation notifications in the header and accept/deny invites without navigating into the league page.

Next steps:
- Polish notifications item rendering (timestamps, icons) and add pagination or "View all" page if needed.
- Fix Dashboard label to clearly indicate membership vs public leagues in "Your leagues" section.

Date: 2025-08-26

Summary: Dashboard "My Leagues" now reflects actual memberships.

Changes:
- Updated `backend/src/routes/leagues.js`:
  - `GET /api/leagues` now includes `is_member` aggregation for authenticated users (`MAX(CASE WHEN lm.user_id = ? THEN 1 ELSE 0 END) as is_member`).
- Updated `frontend/src/pages/DashboardPage.jsx`:
  - "My Leagues" list now filters using `league.is_member` instead of a member count heuristic.

Result:
- The dashboard only shows leagues the user is actually a member of, not all public leagues.

Next steps:
- Polish notifications item rendering (timestamps, icons) and consider pagination or a "View all" page.

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

Date: 2025-08-26 (later)

Summary: Implemented League Admin Tools on the frontend — promote/demote admins and revoke pending invites.

Changes:
- Updated `frontend/src/services/api.js`:
  - Added `listInvites(leagueId, { status })`, `revokeInvite(leagueId, inviteId)`,
    `promoteMember(leagueId, userId)`, and `demoteMember(leagueId, userId)` methods.
- Updated `frontend/src/pages/LeagueDetailPage.jsx`:
  - Added admin-only action buttons in the Members table to Promote/Demote with confirmation and toasts.
  - Added a "Pending Invites" card for admins listing invitee, inviter, expiry, and a Revoke button per invite.
  - Implemented supporting state, effects, and handlers to refresh data post-action.

Result:
- League admins can manage roles (promote/demote) and clean up pending invites directly from the league detail page.
- UI guards ensure actions only render for admins; backend enforces authorization and last-admin safeguards.

Notes:
- Used existing toast system (`sonner`) and `date-fns` formatting for timestamps.
- Data refreshes after actions via `refreshLeagueData()` and `fetchInvites()`.

Next steps:
- Add frontend tests for admin tools flows (promote/demote, revoke invite) and access controls.
- Continue UI polish and pagination for members/leaderboard as planned.

Date: 2025-08-26 (later)

Summary: Cleaned up duplicate Matches routes and implemented Matches list page with tabs and pagination.

Changes:
- Updated `backend/src/routes/matches.js`:
  - Removed duplicate route definitions for `GET /api/matches/pending` and `POST /api/matches/preview-elo` to avoid double-registration.
  - Left a cleanup note at the end of the file.
- Replaced placeholder `frontend/src/pages/MatchesPage.jsx` with a functional implementation:
  - Tabs: All, Accepted, Pending (uses `Tabs` from `@/components/ui/tabs`).
  - Pagination: page size 10 using shared `@/components/ui/pagination`.
  - Data: `matchesAPI.getAll({ status, page, limit })` wired up.
  - Table columns: When, League, Players, Result, Status, Your ΔELO.

Result:
- Users can browse their matches with status filters and pagination.
- ELO delta for the current user is displayed for accepted matches.

Next steps:
- Build Record Match form (league/opponent selectors, sets input, optional played_at, ELO preview via `matchesAPI.previewElo`).
- Admin Pending Approvals UI using `matchesAPI.getPending` with league filter and accept/reject actions.
- Match Detail view/modal with sets list and pre-acceptance edit via `matchesAPI.update`.
- Cross-link match items from League Detail recent matches to Match Detail.

---

Date: 2025-08-27 (later)

Summary: Implemented Match Detail page with pre-accept editing and added cross-linking from Matches and League pages.

Changes:
- Created `frontend/src/pages/MatchDetailPage.jsx`:
  - Fetches full match by ID via `matchesAPI.getById(id)` and displays league, players, sets, totals, ELO before/after with delta.
  - Allows authorized participants to edit match details (sets, scores, game type, played_at) before acceptance using `react-hook-form` + `zod`.
  - Submits updates via `matchesAPI.update(id, payload)` with validation and toasts.
- Updated `frontend/src/App.jsx` to add protected route: `/matches/:id` rendering `MatchDetailPage`.
- Updated `frontend/src/pages/MatchesPage.jsx` to link When/League/Players/Result cells to `/matches/:id`.
- Updated `frontend/src/pages/LeagueDetailPage.jsx` recent matches table to link date, players, and score cells to `/matches/:id`.

Result:
- Users can navigate to a detailed view for each match. If they are one of the participants and the match is not accepted, they can edit and resubmit before acceptance.

Notes:
- UI reuses shared components (`Card`, `Form`, `Button`, inputs) and mirrors validation used on the Record Match page.
- Further polish and tests will follow.
