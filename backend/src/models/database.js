const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

class Database {
    constructor() {
        this.db = null;
        // On Vercel serverless, the filesystem is read-only except for /tmp.
        // Default to /tmp/league.db when running on Vercel (VERCEL=1) unless DATABASE_PATH is explicitly set.
        const isVercel = !!process.env.VERCEL;
        const defaultLocalPath = path.join(__dirname, '../../database/league.db');
        const defaultVercelPath = '/tmp/league.db';
        this.dbPath = process.env.DATABASE_PATH || (isVercel ? defaultVercelPath : defaultLocalPath);
        this.schemaPath = process.env.DATABASE_SCHEMA_PATH || path.join(__dirname, '../../database/schema.sql');
    }

    async connect() {
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
            await this.connect();
            
            // Read and execute schema
            const schema = fs.readFileSync(this.schemaPath, 'utf8');
            const statements = schema.split(';').filter(stmt => stmt.trim());
            
            for (const statement of statements) {
                if (statement.trim()) {
                    await this.run(statement);
                }
            }
            
            // Create admin user if it doesn't exist
            await this.createAdminUser();
            
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    async createAdminUser() {
        const bcrypt = require('bcryptjs');
        
        try {
            // Check if admin user already exists
            const existingAdmin = await this.get('SELECT id FROM users WHERE username = ?', ['admin']);
            
            if (!existingAdmin) {
                // Create admin user
                const hashedPassword = await bcrypt.hash('admin123', 10);
                
                await this.run(`
                    INSERT INTO users (username, password_hash, first_name, last_name, is_admin, created_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, ['admin', hashedPassword, 'Admin', 'User', 1]);
                
                console.log('Admin user created successfully');
                console.log('Username: admin');
                console.log('Password: admin123');
            } else {
                console.log('Admin user already exists');
            }
        } catch (error) {
            console.error('Error creating admin user:', error);
            throw error;
        }
    }

    run(sql, params = []) {
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

