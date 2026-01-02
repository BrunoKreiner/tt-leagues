# Database Index Testing Guide

## Overview
This guide explains how to test and verify the new database indexes for performance improvements.

## 1. Review the Changes

### Files Modified
- `backend/database/schema.sql` - SQLite schema with indexes
- `backend/database/schema.pg.sql` - PostgreSQL schema with indexes
- `backend/database/add_indexes.sql` - Standalone migration file

### What Was Added
- 30+ new indexes covering frequently queried columns
- Composite indexes for common query patterns
- Indexes for ORDER BY operations (leaderboards, match lists)

## 2. Testing Locally (SQLite)

### Step 1: Check Current Database State
```bash
cd backend
sqlite3 database/league.db ".schema" | grep -i index
```

### Step 2: Apply Indexes to Existing Database
If you have an existing database, you can apply the indexes manually:

```bash
cd backend
sqlite3 database/league.db < database/add_indexes.sql
```

Or run the statements individually:
```bash
sqlite3 database/league.db
```

Then execute:
```sql
CREATE INDEX IF NOT EXISTS idx_matches_is_accepted ON matches(is_accepted);
CREATE INDEX IF NOT EXISTS idx_matches_league_accepted ON matches(league_id, is_accepted);
-- ... (continue with other indexes)
```

### Step 3: Verify Indexes Were Created
```bash
sqlite3 database/league.db ".indices"
```

Or check specific table:
```bash
sqlite3 database/league.db ".indices matches"
```

### Step 4: Test Query Performance
Use EXPLAIN QUERY PLAN to see if indexes are being used:

```bash
sqlite3 database/league.db
```

```sql
-- Test match query with is_accepted filter
EXPLAIN QUERY PLAN 
SELECT * FROM matches 
WHERE league_id = 1 AND is_accepted = 1 
ORDER BY created_at DESC 
LIMIT 20;

-- Test leaderboard query
EXPLAIN QUERY PLAN 
SELECT * FROM league_members 
WHERE league_id = 1 
ORDER BY current_elo DESC 
LIMIT 20;

-- Test league filtering
EXPLAIN QUERY PLAN 
SELECT * FROM leagues 
WHERE is_active = 1 AND is_public = 1 
ORDER BY updated_at DESC;
```

Look for "USING INDEX" in the output - this confirms indexes are being used.

## 3. Testing on Production (PostgreSQL/Vercel)

### Step 1: Connect to Production Database
If using Vercel Postgres, get connection string from Vercel dashboard.

### Step 2: Check Existing Indexes
```sql
-- List all indexes
SELECT 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Check specific table indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'matches' 
AND schemaname = 'public';
```

### Step 3: Apply Indexes
Run the PostgreSQL schema or add_indexes.sql:

```bash
# If you have psql access
psql $DATABASE_URL -f backend/database/add_indexes.sql
```

Or apply via Vercel SQL editor or your database management tool.

### Step 4: Verify Index Usage
Use EXPLAIN ANALYZE to see query plans:

```sql
-- Test match query
EXPLAIN ANALYZE 
SELECT * FROM matches 
WHERE league_id = 1 AND is_accepted = true 
ORDER BY created_at DESC 
LIMIT 20;

-- Check if index is used (look for "Index Scan" in output)
```

## 4. Performance Testing

### Before/After Comparison

1. **Test Query Execution Time**
   - Run the same queries before and after adding indexes
   - Measure execution time
   - Compare results

2. **Test Common Endpoints**
   - GET /api/leagues (with filtering)
   - GET /api/leagues/:id/leaderboard
   - GET /api/matches (with status filter)
   - GET /api/users/:id/stats

3. **Monitor Database Performance**
   - Check slow query logs
   - Monitor query execution times
   - Watch for index usage in query plans

### Example Performance Test Script

Create `backend/test_performance.js`:

```javascript
const database = require('./src/models/database');

async function testPerformance() {
    await database.connect();
    
    console.time('Query with indexes');
    const result = await database.all(`
        SELECT * FROM matches 
        WHERE league_id = 1 AND is_accepted = 1 
        ORDER BY created_at DESC 
        LIMIT 20
    `);
    console.timeEnd('Query with indexes');
    
    console.log(`Found ${result.length} matches`);
    
    process.exit(0);
}

testPerformance();
```

Run: `node backend/test_performance.js`

## 5. Verification Checklist

- [ ] All indexes created successfully (no errors)
- [ ] Indexes appear in database schema
- [ ] EXPLAIN QUERY PLAN shows index usage
- [ ] Query performance improved (faster execution)
- [ ] No breaking changes to existing functionality
- [ ] Both SQLite and PostgreSQL schemas updated

## 6. Rollback Plan

If indexes cause issues, you can drop them:

```sql
-- SQLite
DROP INDEX IF EXISTS idx_matches_is_accepted;
DROP INDEX IF EXISTS idx_matches_league_accepted;
-- ... (drop other indexes)

-- PostgreSQL
DROP INDEX IF EXISTS idx_matches_is_accepted;
DROP INDEX IF EXISTS idx_matches_league_accepted;
-- ... (drop other indexes)
```

## 7. Monitoring After Deployment

- Monitor database query performance
- Check for any slow queries
- Verify indexes are being used (not just created)
- Watch database size (indexes take space)
- Monitor write performance (indexes can slow writes slightly)

## Common Issues

1. **Indexes not being used**: Check query conditions match index columns
2. **Slow writes**: Too many indexes can slow INSERT/UPDATE operations
3. **Database size**: Indexes increase database file size
4. **Migration errors**: Ensure indexes use `IF NOT EXISTS` to avoid conflicts

