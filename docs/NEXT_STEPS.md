# Next Implementation Steps

**Last Updated**: After Record Match on League Detail Page completion

## Quick Reference: Current Implementation Status

- ✅ **Record Match on League Detail Page**: Completed - Collapsible form at bottom of league pages
- ✅ **Profile Enhancements**: Completed - Equipment and playstyle fields are functional
- ✅ **Cross-link Profiles**: Completed - All usernames link to user profiles throughout the app
- ✅ **Dashboard Profile CTA**: Completed - Profile CTAs added in header and empty states
- ✅ **Translation Completion**: Completed - All known translations including German "sets won" strings
- ⚠️ **Mobile Responsiveness**: Mostly done, needs final verification

---

## Recommended Next Tasks

**Note**: All "Quick Win" items from the previous TODO list have been completed:
- ✅ Profile Enhancements (equipment & playstyle)
- ✅ Cross-link Profiles Across App
- ✅ Dashboard Profile CTA Placement
- ✅ Translation Completion

### Next Priority: Mobile Responsiveness & Polish

**Priority**: Medium (Final polish)
**Estimated Complexity**: Medium
**Scope**: Testing and refinement

### Implementation Steps

1. **Mobile Testing**:
   - Test all pages on various mobile devices (320px - 768px widths)
   - Verify touch targets are adequate (44x44px minimum)
   - Check form layouts and inputs on mobile
   - Test navigation menu on mobile
   - Verify tables are scrollable/responsive on mobile
   - Test leaderboard cards and match lists

2. **Performance Optimization**:
   - Review bundle size and lazy loading opportunities
   - Ensure smooth animations and transitions
   - Optimize images and assets

3. **Accessibility Review**:
   - Verify WCAG compliance (keyboard navigation, ARIA labels)
   - Check color contrast ratios
   - Test with screen readers
   - Ensure all interactive elements are accessible

### Files to Review

- All frontend components and pages, especially:
  - `frontend/src/pages/DashboardPage.jsx`
  - `frontend/src/pages/LeagueDetailPage.jsx`
  - `frontend/src/pages/MatchesPage.jsx`
  - `frontend/src/components/layout/MobileMenu.jsx`
  - `frontend/src/components/ui/*`

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

