const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

class Database {
    constructor() {
        this.db = null;
        this.pool = null;
        this.isPg = !!process.env.DATABASE_URL;
        // On Vercel serverless, the filesystem is read-only except for /tmp.
        // Default to /tmp/league.db when running on Vercel (VERCEL=1) unless DATABASE_PATH is explicitly set.
        const isVercel = !!process.env.VERCEL;
        const defaultLocalPath = path.join(__dirname, '../../database/league.db');
        const defaultVercelPath = '/tmp/league.db';
        this.dbPath = process.env.DATABASE_PATH || (isVercel ? defaultVercelPath : defaultLocalPath);
        // Choose schema by backend
        this.schemaPath = this.isPg
            ? (process.env.DATABASE_SCHEMA_PATH_PG || path.join(__dirname, '../../database/schema.pg.sql'))
            : (process.env.DATABASE_SCHEMA_PATH || path.join(__dirname, '../../database/schema.sql'));
    }

    async connect() {
        if (this.isPg) {
            // Connect to Postgres (Neon)
            const rawUrl = process.env.DATABASE_URL;
            const hasQuery = rawUrl.includes('?');
            const hasSslMode = /[?&]sslmode=/i.test(rawUrl);
            const connString = hasSslMode ? rawUrl : `${rawUrl}${hasQuery ? '&' : '?'}sslmode=require`;
            this.pool = new Pool({ connectionString: connString, ssl: { rejectUnauthorized: false } });
            try {
                await this.pool.query('SELECT 1');
                console.log('Connected to Postgres database');
                return;
            } catch (err) {
                console.error('Error connecting to Postgres:', err);
                throw err;
            }
        }

        return new Promise((resolve, reject) => {
            try {
                // Ensure directory for DB file exists
                const dir = path.dirname(this.dbPath);
                fs.mkdirSync(dir, { recursive: true });
            } catch (e) {
                console.warn('Warning creating database directory:', e?.message || e);
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                    reject(err);
                } else {
                    console.log('Connected to SQLite database');
                    console.log('Database file:', this.dbPath);
                    // Enable foreign keys
                    this.db.run('PRAGMA foreign_keys = ON');
                    resolve();
                }
            });
        });
    }

    async initialize() {
        try {
            const debugInit = process.env.DB_INIT_DEBUG === '1';
            // Guard rails: on Vercel, require DATABASE_URL to avoid ephemeral SQLite usage
            if (process.env.VERCEL && !process.env.DATABASE_URL) {
                throw new Error('DATABASE_URL must be set when running on Vercel. SQLite is not supported in the serverless runtime.');
            }

            await this.connect();

            // Read and execute schema
            const schema = fs.readFileSync(this.schemaPath, 'utf8');
            // Split schema into statements safely.
            // We strip SQL comments first so semicolons inside comments don't break splitting.
            // (node-postgres doesn't support executing multiple statements in one query call.)
            const schemaWithoutComments = schema
                .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
                .replace(/--.*$/gm, '');            // line comments
            const statements = schemaWithoutComments.split(';').filter(stmt => stmt.trim());

            if (debugInit) {
                console.log(`DB init: executing schema from ${this.schemaPath} (${statements.length} statements)`);
            }
            for (let i = 0; i < statements.length; i += 1) {
                const statement = statements[i];
                const sql = statement.trim();
                if (sql) {
                    try {
                        await this.run(sql);
                    } catch (err) {
                        const maxLen = 800;
                        const snippet = sql.length > maxLen ? `${sql.slice(0, maxLen)}\n... (truncated)` : sql;
                        const wrapped = new Error(
                            `DB init: schema statement failed (index=${i + 1}/${statements.length}):\n${snippet}`
                        );
                        wrapped.cause = err;
                        throw wrapped;
                    }
                }
            }

            // Add optional profile columns if they don't exist (SQLite compatibility)
            if (!this.isPg) {
                await this.addOptionalColumns();
            }

            // Add image_url column to badges table if it doesn't exist (both SQLite and Postgres)
            await this.addBadgeImageUrlColumn();

            // Add visibility/owner columns to badges table (both SQLite and Postgres)
            await this.addBadgeVisibilityColumns();

            // Ensure roster + roster-based matches/ELO schema exists (SQLite + Postgres) and migrate legacy data.
            if (debugInit) console.log('DB init: ensuring roster schema');
            await this.ensureRosterSchema();

            // Create/update admin user from env
            if (debugInit) console.log('DB init: ensuring admin user');
            await this.createAdminUser();

            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    async addOptionalColumns() {
        const optionalColumns = [
            'forehand_rubber TEXT',
            'backhand_rubber TEXT',
            'blade_wood TEXT',
            'playstyle VARCHAR(100)',
            'strengths TEXT',
            'weaknesses TEXT',
            'goals TEXT',
            'avatar_url TEXT'
        ];

        for (const columnDef of optionalColumns) {
            const columnName = columnDef.split(' ')[0];
            try {
                // Check if column exists by trying to select from it
                await this.run(`SELECT ${columnName} FROM users LIMIT 1`);
            } catch (err) {
                // Column doesn't exist, add it
                try {
                    await this.run(`ALTER TABLE users ADD COLUMN ${columnDef}`);
                    console.log(`Added column: ${columnName}`);
                } catch (addErr) {
                    console.warn(`Failed to add column ${columnName}:`, addErr.message);
                }
            }
        }
    }

    async addBadgeImageUrlColumn() {
        try {
            // Check if badges table exists first
            if (this.isPg) {
                // PostgreSQL: check if column exists
                const columnExists = await this.get(`
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'badges' AND column_name = 'image_url'
                    ) as exists
                `);
                if (!columnExists.exists) {
                    await this.run('ALTER TABLE badges ADD COLUMN image_url TEXT');
                    console.log('Added image_url column to badges table');
                }
            } else {
                // SQLite: try to select from column, if it fails, add it
                try {
                    await this.run('SELECT image_url FROM badges LIMIT 1');
                } catch (err) {
                    // Column doesn't exist, add it
                    await this.run('ALTER TABLE badges ADD COLUMN image_url TEXT');
                    console.log('Added image_url column to badges table');
                }
            }
        } catch (err) {
            // Table might not exist yet, that's okay
            console.warn('Could not add image_url column to badges table (table might not exist):', err.message);
        }
    }

    async addBadgeVisibilityColumns() {
        try {
            // Ensure visibility exists and defaults to 'public'
            const visibilityType = this.isPg
                ? "VARCHAR(20) NOT NULL DEFAULT 'public'"
                : "TEXT NOT NULL DEFAULT 'public'";
            await this.ensureColumnExists('badges', 'visibility', visibilityType);

            // Ensure created_by exists (owner of private badges)
            const createdByType = this.isPg
                ? 'INTEGER REFERENCES users(id)'
                : 'INTEGER';
            await this.ensureColumnExists('badges', 'created_by', createdByType);

            // Normalize existing rows
            await this.run("UPDATE badges SET visibility = 'public' WHERE visibility IS NULL OR TRIM(visibility) = ''");

            // Helpful indexes (safe to create repeatedly)
            await this.run('CREATE INDEX IF NOT EXISTS idx_badges_visibility ON badges(visibility)');
            await this.run('CREATE INDEX IF NOT EXISTS idx_badges_created_by ON badges(created_by)');
        } catch (err) {
            // Table might not exist yet, that's okay
            console.warn('Could not add visibility/created_by columns to badges table (table might not exist):', err.message);
        }
    }

    async ensureRosterSchema() {
        // This method is intentionally idempotent: safe to run on every startup.
        // It supports:
        // - Placeholder roster entries (no user_id)
        // - Matches + ELO history referencing roster entries
        // - Migration from legacy league_members + user-based matches
        await this.ensureLeagueRosterTable();
        await this.ensureMatchesRosterColumns();
        await this.ensureEloHistoryRosterColumn();
        await this.ensureRosterLegacyNullability();
        await this.ensureRosterIndexes();
        await this.migrateLegacyLeagueMembersToRoster();
        await this.migrateLegacyMatchesToRoster();
        await this.migrateLegacyEloHistoryToRoster();
    }

    async ensureRosterLegacyNullability() {
        // Roster-based matches allow opponents without user accounts, so the legacy user_id columns
        // on matches/elo_history must be nullable.
        if (this.isPg) {
            try { await this.run('ALTER TABLE matches ALTER COLUMN player1_id DROP NOT NULL'); } catch (_) {}
            try { await this.run('ALTER TABLE matches ALTER COLUMN player2_id DROP NOT NULL'); } catch (_) {}
            try { await this.run('ALTER TABLE elo_history ALTER COLUMN user_id DROP NOT NULL'); } catch (_) {}
            return;
        }

        // SQLite: if existing tables were created with NOT NULL constraints, recreate them.
        const matchesNeedsRebuild = await this.sqliteColumnIsNotNull('matches', 'player1_id')
            || await this.sqliteColumnIsNotNull('matches', 'player2_id');
        if (matchesNeedsRebuild) {
            await this.rebuildSQLiteMatchesTable();
        }

        const eloNeedsRebuild = await this.sqliteColumnIsNotNull('elo_history', 'user_id');
        if (eloNeedsRebuild) {
            await this.rebuildSQLiteEloHistoryTable();
        }
    }

    async sqliteColumnIsNotNull(tableName, columnName) {
        if (this.isPg) return false;
        try {
            const rows = await this.all(`PRAGMA table_info(${tableName})`);
            const col = rows.find(r => r.name === columnName);
            return !!col?.notnull;
        } catch (_) {
            return false;
        }
    }

    async rebuildSQLiteMatchesTable() {
        // Create a new matches table with nullable player1_id/player2_id and roster columns.
        // Preserve existing data and swap tables.
        await this.withTransaction(async (tx) => {
            // Temporarily disable foreign keys during rebuild to handle orphaned data
            await tx.run('PRAGMA foreign_keys = OFF');
            
            await tx.run(`
                CREATE TABLE IF NOT EXISTS matches_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    league_id INTEGER NOT NULL,
                    player1_id INTEGER,
                    player2_id INTEGER,
                    player1_roster_id INTEGER,
                    player2_roster_id INTEGER,
                    winner_roster_id INTEGER,
                    player1_sets_won INTEGER DEFAULT 0,
                    player2_sets_won INTEGER DEFAULT 0,
                    player1_points_total INTEGER DEFAULT 0,
                    player2_points_total INTEGER DEFAULT 0,
                    game_type VARCHAR(20) NOT NULL,
                    winner_id INTEGER,
                    player1_elo_before INTEGER,
                    player2_elo_before INTEGER,
                    player1_elo_after INTEGER,
                    player2_elo_after INTEGER,
                    is_accepted BOOLEAN DEFAULT FALSE,
                    accepted_by INTEGER,
                    accepted_at DATETIME,
                    elo_applied BOOLEAN DEFAULT FALSE,
                    elo_applied_at DATETIME,
                    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
                    FOREIGN KEY (player1_id) REFERENCES users(id),
                    FOREIGN KEY (player2_id) REFERENCES users(id),
                    FOREIGN KEY (winner_id) REFERENCES users(id),
                    FOREIGN KEY (accepted_by) REFERENCES users(id)
                )
            `);

            // Copy known columns from old table; roster columns may not exist yet (NULLs are fine).
            // Only filter out rows with invalid league_id (required foreign key)
            // Allow NULL user_ids since roster-based matches support placeholders
            await tx.run(`
                INSERT INTO matches_new (
                    id, league_id, player1_id, player2_id,
                    player1_roster_id, player2_roster_id, winner_roster_id,
                    player1_sets_won, player2_sets_won, player1_points_total, player2_points_total,
                    game_type, winner_id,
                    player1_elo_before, player2_elo_before, player1_elo_after, player2_elo_after,
                    is_accepted, accepted_by, accepted_at, elo_applied, elo_applied_at, played_at, created_at
                )
                SELECT
                    m.id, m.league_id, m.player1_id, m.player2_id,
                    m.player1_roster_id, m.player2_roster_id, m.winner_roster_id,
                    m.player1_sets_won, m.player2_sets_won, m.player1_points_total, m.player2_points_total,
                    m.game_type, m.winner_id,
                    m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after,
                    m.is_accepted, m.accepted_by, m.accepted_at, m.elo_applied, m.elo_applied_at, m.played_at, m.created_at
                FROM matches m
                WHERE m.league_id IN (SELECT id FROM leagues)
            `);

            await tx.run('DROP TABLE matches');
            await tx.run('ALTER TABLE matches_new RENAME TO matches');
            
            // Re-enable foreign keys
            await tx.run('PRAGMA foreign_keys = ON');
        });
    }

    async rebuildSQLiteEloHistoryTable() {
        await this.withTransaction(async (tx) => {
            // Temporarily disable foreign keys during rebuild to handle orphaned data
            await tx.run('PRAGMA foreign_keys = OFF');
            
            await tx.run(`
                CREATE TABLE IF NOT EXISTS elo_history_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    league_id INTEGER NOT NULL,
                    roster_id INTEGER,
                    match_id INTEGER,
                    elo_before INTEGER NOT NULL,
                    elo_after INTEGER NOT NULL,
                    elo_change INTEGER NOT NULL,
                    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id),
                    FOREIGN KEY (league_id) REFERENCES leagues(id),
                    FOREIGN KEY (match_id) REFERENCES matches(id)
                )
            `);

            // Only filter out rows with invalid league_id (required foreign key)
            // Allow NULL user_id and match_id since roster-based ELO supports placeholders
            await tx.run(`
                INSERT INTO elo_history_new (
                    id, user_id, league_id, roster_id, match_id, elo_before, elo_after, elo_change, recorded_at
                )
                SELECT
                    e.id, e.user_id, e.league_id, e.roster_id, e.match_id, e.elo_before, e.elo_after, e.elo_change, e.recorded_at
                FROM elo_history e
                WHERE e.league_id IN (SELECT id FROM leagues)
            `);

            await tx.run('DROP TABLE elo_history');
            await tx.run('ALTER TABLE elo_history_new RENAME TO elo_history');
            
            // Re-enable foreign keys
            await tx.run('PRAGMA foreign_keys = ON');
        });
    }

    async ensureLeagueRosterTable() {
        if (this.isPg) {
            await this.run(`
                CREATE TABLE IF NOT EXISTS league_roster (
                    id SERIAL PRIMARY KEY,
                    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    display_name VARCHAR(200) NOT NULL,
                    current_elo INTEGER DEFAULT 1200,
                    is_admin BOOLEAN DEFAULT FALSE,
                    joined_at TIMESTAMP DEFAULT NOW(),
                    UNIQUE(league_id, user_id)
                )
            `);
            return;
        }

        // SQLite
        await this.run(`
            CREATE TABLE IF NOT EXISTS league_roster (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                league_id INTEGER NOT NULL,
                user_id INTEGER,
                display_name VARCHAR(200) NOT NULL,
                current_elo INTEGER DEFAULT 1200,
                is_admin BOOLEAN DEFAULT FALSE,
                joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
                UNIQUE(league_id, user_id)
            )
        `);
    }

    async ensureMatchesRosterColumns() {
        // We keep legacy user_id-based columns for compatibility/migration, but
        // roster-based columns are the canonical fields for new code.
        await this.ensureColumnExists('matches', 'player1_roster_id', this.isPg ? 'INTEGER' : 'INTEGER');
        await this.ensureColumnExists('matches', 'player2_roster_id', this.isPg ? 'INTEGER' : 'INTEGER');
        await this.ensureColumnExists('matches', 'winner_roster_id', this.isPg ? 'INTEGER' : 'INTEGER');
    }

    async ensureEloHistoryRosterColumn() {
        await this.ensureColumnExists('elo_history', 'roster_id', this.isPg ? 'INTEGER' : 'INTEGER');
    }

    async ensureRosterIndexes() {
        // Indexes are safe to create repeatedly.
        await this.run('CREATE INDEX IF NOT EXISTS idx_league_roster_league_id ON league_roster(league_id)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_league_roster_user_id ON league_roster(user_id)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_league_roster_league_elo ON league_roster(league_id, current_elo)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_matches_roster_ids ON matches(league_id, player1_roster_id, player2_roster_id)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_elo_history_roster_id ON elo_history(roster_id)');
    }

    async ensureColumnExists(tableName, columnName, columnType) {
        if (this.isPg) {
            const row = await this.get(
                `SELECT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = ? AND column_name = ?
                ) as exists`,
                [tableName, columnName]
            );
            if (row && row.exists) return;
            await this.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
            return;
        }

        // SQLite: try to SELECT the column, add if it fails.
        try {
            await this.run(`SELECT ${columnName} FROM ${tableName} LIMIT 1`);
        } catch (_) {
            await this.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnType}`);
        }
    }

    async migrateLegacyLeagueMembersToRoster() {
        // If legacy league_members table exists and roster is empty, migrate.
        const legacyExists = await this.tableExists('league_members');
        if (!legacyExists) return;

        const rosterCount = await this.get('SELECT COUNT(*) as count FROM league_roster');
        if (rosterCount && Number(rosterCount.count) > 0) return;

        const rows = await this.all(`
            SELECT lm.league_id, lm.user_id, lm.current_elo, lm.is_admin, lm.joined_at,
                   u.first_name, u.last_name
            FROM league_members lm
            JOIN users u ON lm.user_id = u.id
        `);

        for (const r of rows) {
            const displayName = `${r.first_name} ${r.last_name}`.trim();
            const existing = await this.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [r.league_id, r.user_id]
            );
            if (existing) continue;
            await this.run(
                'INSERT INTO league_roster (league_id, user_id, display_name, current_elo, is_admin, joined_at) VALUES (?, ?, ?, ?, ?, ?)',
                [r.league_id, r.user_id, displayName, r.current_elo ?? 1200, r.is_admin ?? false, r.joined_at]
            );
        }
    }

    async migrateLegacyMatchesToRoster() {
        // Fill roster_id columns from legacy user_id columns if needed.
        const candidates = await this.all(
            'SELECT id, league_id, player1_id, player2_id, winner_id, player1_roster_id, player2_roster_id, winner_roster_id FROM matches'
        );
        for (const m of candidates) {
            if (m.player1_roster_id && m.player2_roster_id) continue;
            if (!m.player1_id || !m.player2_id) continue;

            const p1 = await this.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [m.league_id, m.player1_id]
            );
            const p2 = await this.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [m.league_id, m.player2_id]
            );
            if (!p1 || !p2) continue;

            let winnerRosterId = null;
            if (m.winner_id) {
                const w = await this.get(
                    'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                    [m.league_id, m.winner_id]
                );
                winnerRosterId = w?.id ?? null;
            }

            await this.run(
                'UPDATE matches SET player1_roster_id = ?, player2_roster_id = ?, winner_roster_id = ? WHERE id = ?',
                [p1.id, p2.id, winnerRosterId, m.id]
            );
        }
    }

    async migrateLegacyEloHistoryToRoster() {
        const rows = await this.all('SELECT id, league_id, user_id, roster_id FROM elo_history');
        for (const r of rows) {
            if (r.roster_id) continue;
            if (!r.user_id) continue;

            const roster = await this.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [r.league_id, r.user_id]
            );
            if (!roster) continue;
            await this.run('UPDATE elo_history SET roster_id = ? WHERE id = ?', [roster.id, r.id]);
        }
    }

    async tableExists(tableName) {
        if (this.isPg) {
            const row = await this.get(
                `SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = ?
                ) as exists`,
                [tableName]
            );
            return !!row?.exists;
        }
        const row = await this.get(
            `SELECT name FROM sqlite_master WHERE type='table' AND name = ?`,
            [tableName]
        );
        return !!row;
    }

    async createAdminUser() {
        const bcrypt = require('bcryptjs');

        // Read admin credentials from env
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminFirst = process.env.ADMIN_FIRST_NAME || 'Admin';
        const adminLast = process.env.ADMIN_LAST_NAME || 'User';
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@tabletennis.local';
        const adminPassword = process.env.ADMIN_PASSWORD;

        const inProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

        try {
            // Check if admin user already exists
            const existingAdmin = await this.get('SELECT id FROM users WHERE username = ?', [adminUsername]);

            if (!existingAdmin) {
                if (!adminPassword && inProduction) {
                    throw new Error('ADMIN_PASSWORD must be set in production to create admin user');
                }
                const hashedPassword = await bcrypt.hash(adminPassword || 'admin123', 10);
                await this.run(
                    'INSERT INTO users (username, password_hash, first_name, last_name, email, is_admin, created_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [adminUsername, hashedPassword, adminFirst, adminLast, adminEmail, true]
                );
                console.log('Admin user created from env vars');
            } else {
                // Update existing admin to match env (avoid changing password if not provided)
                const updates = ['first_name = ?', 'last_name = ?', 'email = ?', 'is_admin = ?'];
                const params = [adminFirst, adminLast, adminEmail, true];
                if (adminPassword) {
                    const hashedPassword = await bcrypt.hash(adminPassword, 10);
                    updates.unshift('password_hash = ?');
                    params.unshift(hashedPassword);
                }
                params.push(adminUsername);
                await this.run(`UPDATE users SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE username = ?`, params);
                console.log('Admin user updated from env vars');
            }
        } catch (error) {
            console.error('Error creating/updating admin user:', error);
            throw error;
        }
    }

    run(sql, params = []) {
        if (this.isPg) {
            const debugSql = process.env.DB_SQL_DEBUG === '1';
            const { text, values } = this._toPg(sql, params);
            const isInsert = /^\s*insert\s+/i.test(text) && !/returning\s+id/i.test(text);
            const textWithReturning = isInsert ? `${text} RETURNING id` : text;
            return this.pool
                .query(textWithReturning, values)
                .then((result) => ({ id: result.rows?.[0]?.id, changes: result.rowCount }))
                .catch((err) => {
                    if (debugSql) {
                        console.error('DB query failed (run):', textWithReturning, { paramCount: values?.length ?? 0 });
                    }
                    throw err;
                });
        }
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        if (this.isPg) {
            const debugSql = process.env.DB_SQL_DEBUG === '1';
            const { text, values } = this._toPg(sql, params);
            return this.pool
                .query(text, values)
                .then((result) => result.rows?.[0])
                .catch((err) => {
                    if (debugSql) {
                        console.error('DB query failed (get):', text, { paramCount: values?.length ?? 0 });
                    }
                    throw err;
                });
        }
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        if (this.isPg) {
            const debugSql = process.env.DB_SQL_DEBUG === '1';
            const { text, values } = this._toPg(sql, params);
            return this.pool
                .query(text, values)
                .then((result) => result.rows)
                .catch((err) => {
                    if (debugSql) {
                        console.error('DB query failed (all):', text, { paramCount: values?.length ?? 0 });
                    }
                    throw err;
                });
        }
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        console.log('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // Transaction support
    async beginTransaction() {
        await this.run('BEGIN TRANSACTION');
    }

    async commit() {
        await this.run('COMMIT');
    }

    async rollback() {
        await this.run('ROLLBACK');
    }

    async withTransaction(fn) {
        if (this.isPg) {
            const debugSql = process.env.DB_SQL_DEBUG === '1';
            const client = await this.pool.connect();
            try {
                await client.query('BEGIN');
                const tx = {
                    run: async (sql, params = []) => {
                        const { text, values } = this._toPg(sql, params);
                        const isInsert = /^\s*insert\s+/i.test(text) && !/returning\s+id/i.test(text);
                        const textWithReturning = isInsert ? `${text} RETURNING id` : text;
                        try {
                            const result = await client.query(textWithReturning, values);
                            return { id: result.rows?.[0]?.id, changes: result.rowCount };
                        } catch (err) {
                            if (debugSql) {
                                console.error('DB query failed (tx.run):', textWithReturning, { paramCount: values?.length ?? 0 });
                            }
                            throw err;
                        }
                    },
                    get: async (sql, params = []) => {
                        const { text, values } = this._toPg(sql, params);
                        try {
                            const result = await client.query(text, values);
                            return result.rows?.[0];
                        } catch (err) {
                            if (debugSql) {
                                console.error('DB query failed (tx.get):', text, { paramCount: values?.length ?? 0 });
                            }
                            throw err;
                        }
                    },
                    all: async (sql, params = []) => {
                        const { text, values } = this._toPg(sql, params);
                        try {
                            const result = await client.query(text, values);
                            return result.rows;
                        } catch (err) {
                            if (debugSql) {
                                console.error('DB query failed (tx.all):', text, { paramCount: values?.length ?? 0 });
                            }
                            throw err;
                        }
                    }
                };
                const result = await fn(tx);
                await client.query('COMMIT');
                return result;
            } catch (err) {
                try { await client.query('ROLLBACK'); } catch (_) {}
                throw err;
            } finally {
                client.release();
            }
        } else {
            await this.beginTransaction();
            try {
                const tx = {
                    run: (sql, params = []) => this.run(sql, params),
                    get: (sql, params = []) => this.get(sql, params),
                    all: (sql, params = []) => this.all(sql, params)
                };
                const result = await fn(tx);
                await this.commit();
                return result;
            } catch (err) {
                try { await this.rollback(); } catch (_) {}
                throw err;
            }
        }
    }

    // Convert SQLite-style '?' placeholders to Postgres $1, $2, ...
    _toPg(sql, params) {
        let index = 0;
        const text = sql.replace(/\?/g, () => {
            index += 1;
            return `$${index}`;
        });
        return { text, values: params };
    }
}

// Create singleton instance
const database = new Database();

// Initialize database if this file is run directly
if (require.main === module) {
    database.initialize()
        .then(() => {
            console.log('Database setup complete');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Database setup failed:', error);
            process.exit(1);
        });
}

module.exports = database;

