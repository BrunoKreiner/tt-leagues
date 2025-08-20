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
            // Guard rails: on Vercel, require DATABASE_URL to avoid ephemeral SQLite usage
            if (process.env.VERCEL && !process.env.DATABASE_URL) {
                throw new Error('DATABASE_URL must be set when running on Vercel. SQLite is not supported in the serverless runtime.');
            }

            await this.connect();

            // Read and execute schema
            const schema = fs.readFileSync(this.schemaPath, 'utf8');
            const statements = schema.split(';').filter(stmt => stmt.trim());

            for (const statement of statements) {
                const sql = statement.trim();
                if (sql) {
                    await this.run(sql);
                }
            }

            // Create/update admin user from env
            await this.createAdminUser();

            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
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
                const hashedPassword = await bcrypt.hash(adminPassword || 'password', 10);
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
            const { text, values } = this._toPg(sql, params);
            const isInsert = /^\s*insert\s+/i.test(text) && !/returning\s+id/i.test(text);
            const textWithReturning = isInsert ? `${text} RETURNING id` : text;
            return this.pool
                .query(textWithReturning, values)
                .then((result) => ({ id: result.rows?.[0]?.id, changes: result.rowCount }))
                .catch((err) => { throw err; });
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
            const { text, values } = this._toPg(sql, params);
            return this.pool
                .query(text, values)
                .then((result) => result.rows?.[0])
                .catch((err) => { throw err; });
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
            const { text, values } = this._toPg(sql, params);
            return this.pool
                .query(text, values)
                .then((result) => result.rows)
                .catch((err) => { throw err; });
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
            const client = await this.pool.connect();
            try {
                await client.query('BEGIN');
                const tx = {
                    run: async (sql, params = []) => {
                        const { text, values } = this._toPg(sql, params);
                        const isInsert = /^\s*insert\s+/i.test(text) && !/returning\s+id/i.test(text);
                        const textWithReturning = isInsert ? `${text} RETURNING id` : text;
                        const result = await client.query(textWithReturning, values);
                        return { id: result.rows?.[0]?.id, changes: result.rowCount };
                    },
                    get: async (sql, params = []) => {
                        const { text, values } = this._toPg(sql, params);
                        const result = await client.query(text, values);
                        return result.rows?.[0];
                    },
                    all: async (sql, params = []) => {
                        const { text, values } = this._toPg(sql, params);
                        const result = await client.query(text, values);
                        return result.rows;
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

