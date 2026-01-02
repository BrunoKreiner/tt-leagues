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

- [x] Public profiles
  - Files: `backend/src/routes/users.js` (new/profile endpoints), FE profile pages
  - Actions: Public profile route shows user overview, per-league ranks, recent matches, badges; add public profile routes and navigation from leaderboard/matches
  - Acceptance: Any user can view others’ profiles with non-sensitive info; their ranks and badges visible
  - Status: Backend public profile endpoint implemented (`GET /api/users/profile/:username`); FE routes `/profile` and `/profile/:username` render public profiles with league rankings, recent matches, and badges.

- [x] Badges & medals
  - Files: schema updates (badges/user_badges if needed), routes to award/revoke/list badges; FE profile and leaderboard badge display
  - Actions: Support admin-awarded badges; upload/display rank medal PNGs on leaderboard rows; show earned badges on profile
  - Acceptance: Admin can award/revoke; users see badges on profile; leaderboard shows medal icons for top ranks
  - Status: ✅ **COMPLETED**
  - Progress:
    - [x] Backend badge CRUD and awarding/revoking endpoints implemented (`backend/src/routes/badges.js`)
    - [x] Profile badge display implemented (`frontend/src/components/BadgeDisplay.jsx`, `ProfilePage.jsx`)
    - [x] Medal icons on leaderboard rows (frontend) - Already implemented in `LeagueDetailPage.jsx` and `DashboardPage.jsx` using `MedalIcon` component
    - [x] Admin badge management UI (frontend) - Fully implemented in `AdminPage.jsx` with badge CRUD, image upload/cropping, awarding/revoking, and user list management

- [x] UI/UX Polish & Bug Fixes
  - Files: Various frontend components and pages
  - Actions: Fix notification page background, ELO deferred badge styling, dashboard layout improvements, ELO display enhancements, dark theme menu styling
  - Acceptance: All UI elements are readable and properly styled; dashboard layout is optimized; ELO display shows progression; all menus match dark theme
  - Progress:
    - [x] Fix notification page background (white text on white background)
    - [x] Fix "ELO deferred" badge styling in matches list (white text on white background)
    - [x] Move dashboard stats circles below username and align with recent matches
    - [x] Move leaderboards below recent matches and make them narrower
    - [ ] Filter leaderboards by most recent league update
    - [x] Show ELO progression in recent matches: "elo points (+n) vs elo points (+n)"
    - [x] Fix hamburger menu dark theme styling (mobile and desktop)
    - [x] Fix user profile image/avatar dark theme styling
    - [x] Update file input styling for profile image upload
    - [x] Made ELO history visible to all users (removed permission check, only league visibility restricts access)
    - [x] Changed "Insufficient ELO history" placeholder from "-" to SVG straight line in EloSparkline component
    - [x] Fixed "0" appearing below leaderboard table - Changed conditional from `&&` to ternary operator to prevent React rendering 0 (see `docs/DEBUGGING_ZERO_ISSUE.md` for details)

- [x] Notifications UX
  - Files: `backend/src/routes/notifications.js`, FE notifications components
  - Actions: Wire list/mark-as-read/delete; toast for key events; unread count in header
  - Acceptance: Unread count updates; actions return 200; UX consistent
  - Status: Backend list, mark-as-read, delete, mark-all-read implemented; FE header unread counter and dropdown wired; full `/notifications` page with filters, pagination, accept/deny invite actions.

- [x] Mobile Navigation (responsive hamburger menu)
  - Files: `frontend/src/components/layout/HamburgerButton.jsx`, `frontend/src/components/layout/MobileMenu.jsx`, `frontend/src/components/layout/Layout.jsx`
  - Actions: Add hamburger menu, slide-in panel with backdrop blur, responsive nav (md breakpoint), user profile and notifications integration, ARIA labels, Escape/backdrop close, smooth animations.
  - Acceptance: Menu toggles and slides smoothly; mobile/desktop breakpoints respected; notifications and user actions accessible; accessibility and performance validated across major browsers.
  - Status: Completed and verified; redundant docs consolidated into this TODO and removed.

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

- [x] Multi-language (i18n)
  - Status: Implemented with react-i18next; EN/DE resources added; components migrated to `t()`, i18n ready-gate in `App.jsx`, JSON validated; language switcher in header.

- [ ] Cross-link profiles across app
  - Next steps: Make usernames clickable in league members tables, leaderboards, and match lists to `/profile/:username`; ensure navigation preserves auth context
  - Acceptance: Clicking any username navigates to public profile page

- [ ] Dashboard profile CTA placement
  - Next steps: Move or duplicate "View Profile" CTA into welcome header area and recent matches empty state; consider avatar click opening profile
  - Acceptance: Profile is discoverable in top section; click-through rate improves

- [ ] Profile enhancements (editable equipment & playstyle)
  - Backend:
    - Schema: add nullable columns to `users` (or a `user_profiles` table): `forehand_rubber`, `backhand_rubber`, `blade_wood`, `playstyle`, `strengths`, `weaknesses`, `goals`
    - Endpoints: extend `PUT /api/users/:id` to accept/update these fields; include in `GET /api/users/:id` and public profile output where appropriate
  - Frontend:
    - Add editable section on `/profile` (own profile only) with form validation and save/cancel
    - Display these attributes on public profile view
  - Acceptance: Users can view and update these fields; values persist and render on public profiles

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

## 8) Aesthetic Update - Modern Video Game UI Theme

Based on the reference images showing modern dark-themed video game dashboards, the following changes are needed to transform the current design:

### Implementation Priority & Phases

**Phase 1: Foundation (High Priority)**
- [ ] **Dark Theme Implementation**
  - [x] Update `frontend/src/index.css` with dark theme CSS variables
  - [x] Implement dark blue/black background with subtle circuit patterns
  - [x] Add glowing accent colors (purple, blue, green for stats)
  - [x] Ensure high contrast text readability
  - [x] **Background & Visual Polish**
    - [x] Fix background to use dark gradient (black to dark blue-greenish)
    - [x] Replace logo and favicon with `452-4528875_riot-logo-fist-riot-games.png`
    - [x] Add modern cyberpunk font for titles and subtitles
    - [x] Apply cyberpunk font styling to headings and important text
  - [ ] Test across all components for consistency

**Phase 2: Dashboard Redesign (High Priority)**
- [x] **Dashboard Layout Transformation**
  - [x] Convert current dashboard to card-based grid layout
  - [x] Implement large circular progress indicators for key metrics
  - [x] Create "Hall of Fame" style leaderboard cards
  - [x] Add responsive grid (3 columns max) for leaderboards
  - [x] Implement clickable leaderboard cards and rows

**Phase 3: Visual Components (Medium Priority)**
- [x] **Enhanced UI Components**
  - [x] Redesign navigation with game-like styling
  - [x] Update buttons with hover effects and animations
  - [x] Improve form designs with modern styling
  - [x] Add micro-interactions and loading states

**Phase 4: Polish & Responsive (Medium Priority)**
- [x] **Layout & Background Fixes**
  - [x] Fix dark background gradient (forced with !important)
  - [x] Redesign dashboard layout (welcome left, recent matches + stats right)
  - [x] Remove unnecessary buttons and improve navigation
  - [x] Add click indicators and improve UX
- [ ] **Mobile & Performance**
  - [ ] Ensure responsive design works on all devices
  - [ ] Add smooth animations and transitions
  - [ ] Optimize performance and bundle size
  - [ ] Final accessibility review

### Dark Theme & Color Scheme
- [ ] Implement dark theme as default (remove light mode or make dark primary)
- [ ] Update color palette to match video game aesthetics:
  - [ ] Dark blue/black backgrounds with subtle circuit patterns
  - [ ] Glowing accent colors (purple, blue, green for stats)
  - [ ] High contrast text with better readability
  - [ ] Gradient backgrounds and subtle animations
- [ ] Add CSS custom properties for consistent theming across components

### Video Game Stats Dashboard Layout
- [ ] Redesign dashboard to match video game stats layout:
  - [ ] Large circular progress indicators for key metrics (like the green/yellow/blue circles)
  - [ ] Card-based layout with rounded corners and subtle borders
  - [ ] Stats displayed prominently with icons and large numbers
  - [ ] "Hall of Fame" style leaderboard with distinct styling
- [ ] Add animated elements and hover effects
- [ ] Implement responsive grid layouts that work on mobile
- [x] **Dashboard Leaderboard Improvements:**
  - [x] Make leaderboards narrow and box-like (not full width)
  - [x] Display up to 3 leaderboards in one row (responsive grid)
  - [x] Make each leaderboard card clickable to link to the league
  - [x] Make entire leaderboard rows clickable to link to user profiles
  - [x] Add small ELO history visualization (sparkline) on the right side of each leaderboard row
  - [x] Change page title from "Table Tennis League" to just "Leagues"
- [x] **League Page Improvements:**
  - [x] Make entire league cards clickable (not just buttons)
  - [x] Improve league card hover effects and visual feedback

### Enhanced Visual Components
- [x] Redesign leaderboard to be more prominent and visually appealing:
  - [x] Larger medal icons with better positioning
  - [x] Player avatars integrated into medal badges (already implemented)
  - [x] Better spacing and typography
  - [x] Add visual indicators for rank changes (arrows, colors)
- [x] Improve league detail pages with:
  - [x] Fixed black table headers with proper dark theme styling
  - [x] Consolidated admin functions into one compact panel
  - [x] Better layout with sidebar and main content areas
  - [x] Modern table styling with hover effects
- [x] Update navigation to be more game-like:
  - [x] Stylized buttons and hover effects
  - [x] Better mobile menu design
  - [x] Consistent iconography throughout

### Responsive Design Improvements
- [ ] Mobile-first responsive design:
  - [ ] Better breakpoints for tablets and mobile
  - [ ] Touch-friendly interface elements
  - [ ] Optimized layouts for small screens
  - [ ] Improved navigation for mobile devices
- [ ] Performance optimizations:
  - [ ] Lazy loading for images and components
  - [ ] Smooth animations and transitions
  - [ ] Optimized bundle size

### Interactive Elements
- [ ] Add micro-interactions:
  - [ ] Hover effects on cards and buttons
  - [ ] Loading states with animations
  - [ ] Success/error feedback with better styling
  - [ ] Smooth page transitions
- [ ] Implement modern form designs:
  - [ ] Better input styling and focus states
  - [ ] Improved validation feedback
  - [ ] Modern button designs

### Technical Implementation
- [ ] Update CSS framework usage:
  - [ ] Leverage Tailwind CSS more effectively for consistent design
  - [ ] Add custom CSS for unique video game elements
  - [ ] Implement CSS Grid and Flexbox for better layouts
- [ ] Component library updates:
  - [ ] Custom styled components for video game aesthetic
  - [ ] Consistent spacing and typography system
  - [ ] Icon library updates for better visual consistency

### Files to Update (Implementation Order)

**Phase 1 Files:**
- `frontend/src/index.css` - Global dark theme CSS variables and base styles
- `frontend/src/components/ui/card.jsx` - Card component styling for dark theme
- `frontend/src/components/ui/button.jsx` - Button styling with hover effects
- `frontend/src/components/layout/Layout.jsx` - Page title update to "Leagues"

**Phase 2 Files:**
- `frontend/src/pages/DashboardPage.jsx` - Complete dashboard redesign with grid layout
- `frontend/src/components/EloSparkline.jsx` - Sparkline component for leaderboard rows
- `frontend/src/components/MedalIcon.jsx` - Medal styling improvements
- `frontend/src/pages/LeaguesPage.jsx` - League card clickability improvements

**Phase 3 Files:**
- `frontend/src/components/ui/*` - All remaining UI components styling updates
- `frontend/src/components/layout/*` - Navigation and layout components
- `frontend/src/components/BadgeDisplay.jsx` - Badge styling updates
- `frontend/src/pages/*` - All page layouts and component arrangements

**Phase 4 Files:**
- `frontend/src/App.css` - Global animations and transitions
- `frontend/src/components/ui/LoadingSpinner.jsx` - Loading state animations
- All component files for final responsive and accessibility review

### Acceptance Criteria

**Phase 1 Acceptance:**
- [ ] Dark theme is consistently applied across all components
- [ ] Color palette matches video game aesthetic (dark blue/black, glowing accents)
- [ ] Text is highly readable with proper contrast ratios
- [ ] Page title displays as "Leagues"

**Phase 2 Acceptance:**
- [ ] Dashboard displays leaderboards in responsive grid (3 columns max)
- [ ] Leaderboard cards are clickable and link to leagues
- [ ] Leaderboard rows are clickable and link to user profiles
- [ ] ELO sparklines appear on the right side of leaderboard rows
- [ ] Medal icons with user avatars display correctly
- [ ] League cards are fully clickable (not just buttons)

**Phase 3 Acceptance:**
- [ ] All UI components have consistent game-like styling
- [ ] Navigation has modern hover effects and animations
- [ ] Forms have improved styling and validation feedback
- [ ] Micro-interactions provide good user feedback

**Phase 4 Acceptance:**
- [ ] Site is fully responsive on all device sizes
- [ ] Smooth animations and transitions are implemented
- [ ] Performance remains optimal with new styling
- [ ] Accessibility standards are maintained (WCAG compliance)
- [ ] Site has cohesive dark video game aesthetic throughout

---

## 9) User List of Small Fixes

- [ ] "Your sets won" and "Opponent sets won" needs to be translated too in german.
 - [x] Registration: make email truly optional (FE strips empty; BE ignores empty)
 - [x] Login: remove demo admin credentials from login card
 - [x] Login/Register: improve dark mode styling (cards, labels, backgrounds)
 - [x] Dashboard: average ELO now reads from normalized stats and updates
 - [x] Header: replace hamburger with icon and align with logo/title