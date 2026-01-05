# Roster-based league membership (placeholders + matches/ELO)

This project now supports **league roster entries** that can exist **without** a user account (a “placeholder”), and can later be assigned to a real `users` row. Matches and ELO are tracked against **roster IDs**, not user IDs.

## Why this exists

For child leagues, you may want to:

- Pre-create a league roster with simple names (no login / no email yet)
- Record matches and ELO immediately
- Later let a child/parent create an account and **assign** that account to an existing roster entry

## Database model (high level)

### `league_roster` (new)

Each row is a participant slot inside a league.

- **`id`**: roster ID (primary key)
- **`league_id`**: league (FK)
- **`user_id`**: optional link to `users.id` (nullable)
  - `NULL` means **placeholder**
  - non-null means **assigned**
- **`display_name`**: the league-facing name (required)
  - When a placeholder is assigned to a user, this name remains the display name (so the placeholder name “wins”)
- **`current_elo`**: the league ELO for this roster entry
- **`is_admin`**: whether this roster entry’s user is a league admin (only meaningful when `user_id` is set)
- **`joined_at`**

### `matches` (updated)

Matches now reference roster entries:

- **`player1_roster_id`**
- **`player2_roster_id`**
- **`winner_roster_id`**

Legacy columns `player1_id` / `player2_id` / `winner_id` still exist for compatibility, but are **nullable** and should be treated as **non-canonical** (roster IDs are canonical).

### `elo_history` (updated)

ELO history now supports roster entries:

- **`roster_id`** (nullable, but written for roster-based flows)
- **`user_id`** is now nullable (placeholders have no user)

For real users, endpoints that show “user ELO history” use `elo_history.user_id` + the league filter.

## API flows

### Create placeholder roster member (league admin)

`POST /api/leagues/:id/roster`

Body:

```json
{ "display_name": "Max" }
```

Creates a roster entry with `user_id = null`.

### Assign an account to a roster entry (league admin)

`POST /api/leagues/:id/roster/:rosterId/assign`

Body:

```json
{ "user_id": 123 }
```

Rules:

- Roster entry must exist and be unassigned (`user_id` is null)
- The user must exist
- The user must not already be assigned to another roster entry in the same league
- **`display_name` is not changed** on assignment

### Record match (authenticated user)

`POST /api/matches`

Body (important fields):

```json
{
  "league_id": 1,
  "player2_roster_id": 55,
  "player1_sets_won": 2,
  "player2_sets_won": 1,
  "player1_points_total": 33,
  "player2_points_total": 31,
  "game_type": "best_of_3"
}
```

Notes:

- The server finds the caller’s roster entry in that league for player 1.
- `player2_roster_id` can point to a placeholder (no account).
- If the opponent roster entry has `user_id`, they receive a notification; placeholders do not.

## Migration / compatibility notes

On startup, the backend initializes/migrates:

- Creates `league_roster` if missing
- Adds roster columns to `matches` and `elo_history` if missing
- Makes legacy match/user columns nullable (needed for placeholder-vs-user matches)
- Migrates legacy `league_members` into `league_roster` (one roster entry per user per league)
- Backfills roster IDs into existing matches/ELO history where possible

## Next steps (optional)

- Add UI in the admin panel to:
  - create placeholders
  - assign a user to a roster entry
- Allow **public viewing** of leagues/leaderboards without auth (careful with child privacy and data exposure).

