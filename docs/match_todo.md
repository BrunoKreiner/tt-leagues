# Matches TODO Plan

## Status
- Backend routes implemented (record, get, update, delete; accept/reject; pending; ELO preview).
- Frontend API (`matchesAPI`) ready.
- Backend cleanup done: duplicate routes for `/pending` and `/preview-elo` removed.
- No blockers for FE work.

## Recommended Next TODOs
1) Matches list page with tabs (Pending/Accepted/All) and pagination via `matchesAPI.getAll({ status, page, limit })` — Status: Completed
2) Record Match form (league/opponent selectors, sets, game type, optional played_at; ELO preview; submit) — Status: Completed
3) Admin Pending Approvals UI (list pending, accept/reject with reason) — Status: Completed
4) Match Detail view/modal (show sets; allow edit before acceptance) — Status: Completed
5) Cross-linking from `LeagueDetailPage` recent matches to detail — Status: Completed
6) Backend cleanup: deduplicate `/pending` and `/preview-elo` routes in `backend/src/routes/matches.js` — Status: Completed (Low)
7) Docs: update TODO and progress once Matches parts ship — Status: Completed (Low)

## Plan (Order of Implementation)
1) Implement Matches list (tabs + pagination) for quick value.
2) Build Record Match form with ELO preview and create. — Completed
3) Add Admin approvals page/section (accept/reject flows). — Completed
4) Implement Match detail/modal and pre-accept edits. — Completed
5) Wire cross-links from league pages. — Completed
6) Do backend duplicate-route cleanup alongside.

Notes:
- Form at `frontend/src/pages/RecordMatchPage.jsx` with protected route `/matches/record` and link from `MatchesPage`.
- Uses `matchesAPI.previewElo` and `matchesAPI.create`.
