# Public Profiles & Badges/Medals — Implementation Plan

## Status
- ✅ **Implemented** - Public profiles and core badge system completed; remaining: medals on leaderboards and admin badge UI

## Goals
- Public profile pages accessible to all users
- Badge system for achievements and admin-awarded badges
- Medal icons for top ranks in leaderboards
- Profile pages showing user stats, badges, and league rankings

## Recommended Next TODOs

### 1) ✅ Backend: Public Profile Endpoint
- **Endpoint**: `GET /api/users/profile/:username` (public, no auth required)
- **Returns**: User basic info, league rankings, recent matches, earned badges
- **Data**: 
  - User: `{ id, username, first_name, last_name, created_at }`
  - League rankings: `[{ league_id, league_name, current_elo, rank, matches_played, win_rate }]`
  - Recent matches: `[{ id, league_name, opponent_username, result, played_at, elo_change }]`
  - Badges: `[{ id, name, description, icon, earned_at, league_name? }]`
- **Status**: ✅ **COMPLETED** - Endpoint implemented with comprehensive data aggregation

### 2) ✅ Backend: Badge System Endpoints
- **Badge Management**: `GET /api/badges`, `POST /api/badges` (admin only)
- **User Badges**: `GET /api/users/:id/badges`, `POST /api/users/:id/badges` (admin only)
- **Schema**: Ensure `badges` and `user_badges` tables are properly set up
- **Default Badges**: League Champion, First Victory, Streak Master, Comeback King
- **Status**: ✅ **COMPLETED** - Full CRUD operations for badges, user badge awarding, and notifications

### 3) ✅ Frontend: Public Profile Page
- **Route**: `/profile/:username` (public access)
- **Components**: Profile header, league rankings table, recent matches, badges display
- **Navigation**: Links from leaderboards, match lists, and user mentions
- **Status**: ✅ **COMPLETED** - Combined with existing ProfilePage component, supports both `/profile` and `/profile/:username`

### 4) ✅ Frontend: Badge Display Components
- **Badge Component**: Reusable `<BadgeDisplay />` for showing badges with icons
- **Badge Grid**: Grid layout for displaying multiple badges
- **Badge Tooltips**: Show badge description and earning criteria
- **Status**: ✅ **COMPLETED** - Full badge display system with icons, tooltips, and responsive layouts

### 5) Frontend: Medal Icons for Leaderboards
- **Medal Assets**: Gold/Silver/Bronze medal icons for ranks 1-3
- **Leaderboard Integration**: Show medals next to usernames in top ranks
- **Responsive**: Ensure medals work on mobile and desktop
- **Status**: 🔄 Pending (UI task; API and badge display components exist)

### 6) Frontend: Admin Badge Management
- **Badge Creation**: Admin form to create new badges
- **Badge Awarding**: Admin interface to award badges to users
- **Badge Management**: List, edit, and delete badges (admin only)
- **Status**: 🔄 Pending (backend endpoints completed at `/api/badges` and `/api/users/:id/badges`)

## API Shapes (Draft)

### GET `/api/users/:id/profile`
```json
{
  "user": {
    "id": 123,
    "username": "alice",
    "first_name": "Alice",
    "last_name": "Smith",
    "created_at": "2025-01-15T10:00:00Z"
  },
  "league_rankings": [
    {
      "league_id": 5,
      "league_name": "Spring 2025",
      "current_elo": 1310,
      "rank": 3,
      "matches_played": 24,
      "win_rate": 58
    }
  ],
  "recent_matches": [
    {
      "id": 456,
      "league_name": "Spring 2025",
      "opponent_username": "bob",
      "result": "W",
      "played_at": "2025-08-20T14:30:00Z",
      "elo_change": 16
    }
  ],
  "badges": [
    {
      "id": 1,
      "name": "League Champion",
      "description": "Winner of a league season",
      "icon": "trophy",
      "earned_at": "2025-06-15T12:00:00Z",
      "league_name": "Spring 2025"
    }
  ]
}
```

### GET `/api/badges`
```json
{
  "badges": [
    {
      "id": 1,
      "name": "League Champion",
      "description": "Winner of a league season",
      "icon": "trophy",
      "badge_type": "league_winner",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

### POST `/api/users/:id/badges` (admin only)
```json
{
  "badge_id": 1,
  "league_id": 5,
  "season": "Spring 2025"
}
```

## Plan (Order of Implementation)
1) Backend public profile endpoint (core data)
2) Backend badge system endpoints (CRUD operations)
3) Frontend public profile page (basic layout)
4) Frontend badge display components (reusable)
5) Frontend medal integration in leaderboards
6) Frontend admin badge management UI
7) Polish and testing

## Notes
- Public profiles should be accessible without authentication
- Badge icons can use Lucide React icons initially (trophy, star, fire, etc.)
- Medal assets should be SVG or PNG with proper licensing
- Consider badge earning automation (e.g., "First Victory" on first win)
- League rankings should show current position and historical best

- Recent matches should be limited to last 10-20 for performance
