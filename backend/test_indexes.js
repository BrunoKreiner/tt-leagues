/**
 * Script to test database indexes
 * Run with: node backend/test_indexes.js
 */

const database = require('./src/models/database');

async function testIndexes() {
    try {
        await database.connect();
        
        console.log('Testing database indexes...\n');
        
        // Test 1: Check if indexes exist
        console.log('1. Checking index existence...');
        const indexes = await database.all(`
            SELECT name FROM sqlite_master 
            WHERE type='index' AND name LIKE 'idx_%'
            ORDER BY name
        `);
        console.log(`   Found ${indexes.length} indexes`);
        console.log(`   Sample indexes: ${indexes.slice(0, 5).map(i => i.name).join(', ')}...\n`);
        
        // Test 2: Test match query with is_accepted filter
        console.log('2. Testing match query with is_accepted filter...');
        console.time('   Query time');
        const matches = await database.all(`
            SELECT COUNT(*) as count FROM matches 
            WHERE is_accepted = 1
        `);
        console.timeEnd('   Query time');
        console.log(`   Found ${matches[0].count} accepted matches\n`);
        
        // Test 3: Test leaderboard query (ORDER BY current_elo)
        console.log('3. Testing leaderboard query (ORDER BY current_elo)...');
        console.time('   Query time');
        const leaderboard = await database.all(`
            SELECT user_id, current_elo FROM league_members 
            WHERE league_id = 1 
            ORDER BY current_elo DESC 
            LIMIT 10
        `);
        console.timeEnd('   Query time');
        console.log(`   Found ${leaderboard.length} leaderboard entries\n`);
        
        // Test 4: Test league filtering
        console.log('4. Testing league filtering (is_active + is_public)...');
        console.time('   Query time');
        const leagues = await database.all(`
            SELECT COUNT(*) as count FROM leagues 
            WHERE is_active = 1 AND is_public = 1
        `);
        console.timeEnd('   Query time');
        console.log(`   Found ${leagues[0].count} active public leagues\n`);
        
        // Test 5: Test composite index (league_id + is_accepted)
        console.log('5. Testing composite index (league_id + is_accepted)...');
        console.time('   Query time');
        const leagueMatches = await database.all(`
            SELECT COUNT(*) as count FROM matches 
            WHERE league_id = 1 AND is_accepted = 1
        `);
        console.timeEnd('   Query time');
        console.log(`   Found ${leagueMatches[0].count} accepted matches in league 1\n`);
        
        // Test 6: EXPLAIN QUERY PLAN (SQLite only)
        if (!database.isPg) {
            console.log('6. Checking query plan (SQLite EXPLAIN QUERY PLAN)...');
            const plan = await database.all(`
                EXPLAIN QUERY PLAN 
                SELECT * FROM matches 
                WHERE league_id = 1 AND is_accepted = 1 
                ORDER BY created_at DESC 
                LIMIT 20
            `);
            console.log('   Query plan:');
            plan.forEach(row => {
                console.log(`   ${row.detail || row.explain}`);
            });
            console.log('');
        }
        
        console.log('✅ Index testing completed!');
        console.log('\nNote: For detailed performance analysis, compare query times');
        console.log('before and after index creation, and check EXPLAIN QUERY PLAN output.');
        
    } catch (error) {
        console.error('Error testing indexes:', error);
    } finally {
        process.exit(0);
    }
}

testIndexes();

