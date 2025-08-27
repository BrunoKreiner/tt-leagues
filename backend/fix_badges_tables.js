const database = require('./src/models/database');

async function checkAndCreateBadgesTables() {
    try {
        console.log('Checking if badges tables exist...');
        
        // Check if badges table exists
        const badgesTableExists = await database.get(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'badges'
            ) as exists
        `);
        
        if (!badgesTableExists.exists) {
            console.log('Creating badges table...');
            await database.run(`
                CREATE TABLE badges (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    icon VARCHAR(100),
                    badge_type VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                )
            `);
            console.log('✅ Badges table created successfully');
        } else {
            console.log('✅ Badges table already exists');
        }
        
        // Check if user_badges table exists
        const userBadgesTableExists = await database.get(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'user_badges'
            ) as exists
        `);
        
        if (!userBadgesTableExists.exists) {
            console.log('Creating user_badges table...');
            await database.run(`
                CREATE TABLE user_badges (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    badge_id INTEGER NOT NULL REFERENCES badges(id),
                    league_id INTEGER,
                    earned_at TIMESTAMP DEFAULT NOW(),
                    season VARCHAR(100)
                )
            `);
            console.log('✅ User badges table created successfully');
        } else {
            console.log('✅ User badges table already exists');
        }
        
        console.log('🎉 All badges tables are ready!');
        
    } catch (error) {
        console.error('❌ Error checking/creating badges tables:', error);
        throw error;
    }
}

// Run the function
checkAndCreateBadgesTables()
    .then(() => {
        console.log('Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('Script failed:', error);
        process.exit(1);
    });
