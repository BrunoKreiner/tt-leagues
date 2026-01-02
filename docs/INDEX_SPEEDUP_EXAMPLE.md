# Real Example: Index Speedup in Our App

## Example: Leaderboard Query Speedup

### The Query
When you view a league's leaderboard (like `/leagues/1`), the app runs this query:

```sql
SELECT 
    u.id, u.username, u.first_name, u.last_name, u.avatar_url,
    lm.current_elo, lm.joined_at,
    COUNT(...) as matches_played,
    COUNT(...) as matches_won,
    ROW_NUMBER() OVER (ORDER BY lm.current_elo DESC) as rank
FROM league_members lm
JOIN users u ON lm.user_id = u.id
LEFT JOIN matches m ON m.league_id = lm.league_id AND ...
WHERE lm.league_id = 1
GROUP BY u.id, u.username, u.first_name, u.last_name, u.avatar_url, lm.current_elo, lm.joined_at
ORDER BY lm.current_elo DESC  -- ← THIS IS WHERE INDEX HELPS
LIMIT 20 OFFSET 0
```

### Without Index (Before)
- Database has to scan ALL league_members rows
- Sort them by current_elo (slow operation)
- Then return top 20

**Time**: ~500ms to 2 seconds (depending on data size)

### With Index (After)
- Database uses `idx_league_members_league_elo` index
- Index is already sorted by `(league_id, current_elo)`
- Database jumps directly to league_id=1 and reads in sorted order
- No sorting needed!

**Time**: ~10-50ms (10-40x faster!)

### Real-World Impact
- **Before**: Page loads, you see spinner for 1-2 seconds
- **After**: Page loads almost instantly, leaderboard appears immediately

## Another Example: Match Filtering

When you filter matches by status (accepted/pending), the app queries:

```sql
SELECT * FROM matches 
WHERE league_id = 1 AND is_accepted = 1  -- ← Index helps here
ORDER BY created_at DESC
LIMIT 20
```

### Without Composite Index
- Database scans all matches
- Checks each one: `league_id = 1 AND is_accepted = 1`
- Then sorts by created_at

**Time**: ~200-800ms

### With Composite Index `idx_matches_league_accepted`
- Database uses index on `(league_id, is_accepted)`
- Jumps directly to league_id=1 AND is_accepted=1 rows
- Much faster filtering!

**Time**: ~5-30ms (10-30x faster!)

## Production vs Local Databases

**YES, you need to run the SQL script on production separately!**

### Why?
- **Local database** (SQLite file on your computer) and **Production database** (Neon/PostgreSQL on Vercel) are **completely separate**
- They don't share data or indexes
- Changes to one don't affect the other

### How They're Different

| Aspect | Local (Development) | Production (Vercel/Neon) |
|--------|-------------------|-------------------------|
| Database Type | SQLite | PostgreSQL |
| Location | Your computer (`backend/database/league.db`) | Vercel/Neon cloud servers |
| Connection | File-based | Network connection string |
| Schema File | `schema.sql` | `schema.pg.sql` |

## How to Apply Indexes to Production

### Option 1: Via Vercel SQL Editor (Easiest)

1. Go to your Vercel dashboard
2. Navigate to your backend project
3. Go to Storage → Your Postgres database
4. Click on "SQL Editor" or "Query Editor"
5. Copy the contents of `backend/database/add_indexes.sql`
6. Paste and run it

### Option 2: Via psql Command Line

If you have the database connection string:

```bash
# Get connection string from Vercel dashboard
# Then run:
psql $DATABASE_URL -f backend/database/add_indexes.sql
```

### Option 3: Through Database Management Tool

If you use a tool like DBeaver, pgAdmin, or TablePlus:
1. Connect to your Neon/PostgreSQL database
2. Open SQL editor
3. Run the `add_indexes.sql` file

## Important Notes

1. **Safe to Run**: The script uses `IF NOT EXISTS`, so it won't break anything if indexes already exist
2. **No Downtime**: Creating indexes doesn't lock tables (in PostgreSQL)
3. **Takes Time**: Creating indexes on large tables can take a few minutes
4. **Automatic on New Deployments**: If you recreate the database, `schema.pg.sql` will automatically create the indexes

## What Happens If You Don't Add Indexes to Production?

- Your production app will be slower than local (if local has indexes)
- Queries will take longer
- Users experience slower page loads
- But the app will still work - just slower

## Summary

**Local (SQLite)**: Run `add_indexes.sql` if you want faster development  
**Production (PostgreSQL)**: Run `add_indexes.sql` (or the PostgreSQL version) for faster production app

They're separate, so you need to update both if you want indexes in both places!

