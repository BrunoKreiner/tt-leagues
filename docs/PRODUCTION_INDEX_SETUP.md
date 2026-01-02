# Setting Up Indexes in Production (Vercel/Neon)

## Quick Answer

**YES, you need to run the SQL script on production separately!**

Your local database (SQLite) and production database (PostgreSQL on Vercel/Neon) are **completely separate**. Changes to one don't affect the other.

## The Two Databases

```
┌─────────────────────┐         ┌─────────────────────┐
│  LOCAL (SQLite)     │         │  PRODUCTION (Neon)  │
│  Your Computer      │         │  Vercel/Cloud       │
│                     │         │                     │
│  backend/           │         │  Remote Server      │
│  database/          │         │  (DATABASE_URL)     │
│  league.db          │         │                     │
└─────────────────────┘         └─────────────────────┘
       Separate!                        Separate!
```

## Will Indexes Be Created Automatically?

### For NEW Databases: ✅ YES
If you create a **brand new database** on Vercel/Neon and initialize it, the `schema.pg.sql` file will automatically create all indexes.

### For EXISTING Databases: ❌ NO
If your production database already exists, you need to manually add the new indexes.

## How to Add Indexes to Production

### Method 1: Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit https://vercel.com/dashboard
   - Select your backend project

2. **Navigate to Database**
   - Click on "Storage" in the sidebar
   - Select your Postgres database (Neon)

3. **Open SQL Editor**
   - Click on "SQL Editor" or "Query" tab
   - This opens a SQL query interface

4. **Run the Index Script**
   - Copy all contents from `backend/database/add_indexes.sql`
   - Paste into the SQL editor
   - Click "Run" or "Execute"
   - Wait for it to complete (may take 1-2 minutes)

### Method 2: Using psql (Command Line)

1. **Get Connection String**
   - Vercel Dashboard → Storage → Your Database → Settings
   - Copy the "Connection String" (starts with `postgres://...`)

2. **Run the Script**
   ```bash
   # Set your connection string
   export DATABASE_URL="postgres://..."
   
   # Run the script (convert SQLite syntax to PostgreSQL if needed)
   psql $DATABASE_URL -f backend/database/add_indexes.sql
   ```

   **Note**: The `add_indexes.sql` file uses SQLite syntax. For PostgreSQL, the syntax is the same, so it should work directly.

### Method 3: Database Management Tool

If you use tools like:
- DBeaver
- pgAdmin
- TablePlus
- DataGrip

1. Connect to your Neon database using the connection string
2. Open SQL editor
3. Copy/paste and run `add_indexes.sql`

## Checking If Indexes Were Created

### In Vercel SQL Editor
Run this query:
```sql
SELECT 
    tablename, 
    indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

You should see all the new indexes listed.

## Important Notes

### ✅ Safe to Run
- Uses `IF NOT EXISTS` - won't break if indexes already exist
- Won't delete or modify existing data
- Won't cause downtime

### ⏱️ Takes Time
- Creating indexes on large tables can take 1-5 minutes
- Database remains available during index creation (in PostgreSQL)
- Larger tables = longer time

### 📊 Impact on Existing Data
- **No data loss**: Indexes don't modify data
- **No downtime**: PostgreSQL creates indexes without locking tables (usually)
- **Disk space**: Indexes use some disk space (usually small)

## What If You Don't Add Indexes to Production?

Your app will still work, but:
- ⚠️ Queries will be slower
- ⚠️ Page loads will take longer
- ⚠️ Leaderboards, match lists, etc. will be slower
- ✅ But everything will function normally

## Future Deployments

If you:
- **Create a new database**: Indexes will be created automatically from `schema.pg.sql`
- **Keep existing database**: You need to manually add new indexes if schema changes

## Summary

| Scenario | Action Needed |
|----------|--------------|
| Local development (new DB) | Indexes created automatically from `schema.sql` |
| Local development (existing DB) | Run `add_indexes.sql` manually |
| Production (new DB) | Indexes created automatically from `schema.pg.sql` |
| Production (existing DB) | **Run `add_indexes.sql` manually via Vercel SQL Editor** |

**For your current situation**: If your production database already exists, you need to manually run the index script in the Vercel SQL Editor.

