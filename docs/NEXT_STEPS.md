# Next Implementation Steps

**Last Updated**: After Record Match on League Detail Page completion

## Quick Reference: Current Implementation Status

- ✅ **Record Match on League Detail Page**: Completed - Collapsible form at bottom of league pages
- ✅ **Profile Enhancements**: Already implemented - Equipment and playstyle fields are functional
- ❌ **Cross-link Profiles**: Not implemented  
- ❌ **Dashboard Profile CTA**: Not implemented
- ⚠️ **Translation Completion**: Partially done (missing some German strings)
- ⚠️ **Mobile Responsiveness**: Mostly done, needs verification

---

## Recommended Next Task: Cross-link Profiles Across App

**Note**: Profile Enhancements (equipment & playstyle) are already fully implemented. The next logical quick win is making profiles more discoverable through clickable usernames.

**Priority**: High (Quick Win)  
**Estimated Complexity**: Low-Medium  
**Files to Modify**: Multiple frontend components

### Implementation Steps

1. **Identify all username display locations**:
   - League detail page leaderboard
   - League detail page members table
   - Dashboard leaderboards
   - Matches page (player names)
   - Match detail pages
   - Any notifications or other lists

2. **Convert usernames to links**:
   - Replace plain text usernames with `<Link to={`/profile/${username}`}>` components
   - Ensure consistent styling (blue-400 text with hover effects)
   - Preserve existing styling and layout

3. **Test navigation**:
   - Verify links work correctly
   - Check that auth context is preserved
   - Ensure public profiles load properly

### Files to Modify

- `frontend/src/pages/LeagueDetailPage.jsx`
  - Leaderboard table username column
  - Members table username column
  
- `frontend/src/pages/DashboardPage.jsx`
  - Leaderboard row usernames

- `frontend/src/pages/MatchesPage.jsx`
  - Player 1 and Player 2 names in match list
  
- `frontend/src/pages/MatchDetailPage.jsx` (if exists)
  - Player names

- Any other components displaying usernames that should link to profiles

---

## Implementation Notes for Online Agent

### Code Style Guidelines
- Use existing component patterns (Card, Form, Button from `@/components/ui`)
- Follow existing Tailwind CSS classes and color scheme
- Use `react-hook-form` with `zod` for form validation (like RecordMatchForm)
- Use `toast` from `sonner` for success/error messages
- Use `useTranslation()` from `react-i18next` for all user-facing strings

### Testing Checklist
- [ ] Test on own profile (edit mode)
- [ ] Test on other user's profile (view only)
- [ ] Test navigation from various locations
- [ ] Test on mobile devices
- [ ] Verify translations work
- [ ] Check for console errors

### Database Migration Notes
- For SQLite: Run `ALTER TABLE` statements directly
- For Postgres: Same `ALTER TABLE` statements work
- Consider adding migration script in `backend/database/migrations/` if needed

---

## Context for Online Agent

This is a table tennis league management application with:
- React frontend (Vite + React Router)
- Node.js/Express backend
- SQLite (local) / PostgreSQL (production)
- Docker deployment
- Dark theme UI with cyberpunk aesthetic
- User authentication with JWT
- League management, match recording, ELO ratings

The codebase follows these patterns:
- Frontend components in `frontend/src/components/` and `frontend/src/pages/`
- Backend routes in `backend/src/routes/`
- Database schemas in `backend/database/`
- Translation files in `frontend/src/locales/`

When implementing features, ensure:
1. Backward compatibility (new fields are nullable)
2. Proper error handling
3. Loading states for async operations
4. Responsive design
5. Accessibility (keyboard navigation, ARIA labels)

