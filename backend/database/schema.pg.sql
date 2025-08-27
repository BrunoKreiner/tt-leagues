-- Table Tennis League App Database Schema (Postgres)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS forehand_rubber TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS backhand_rubber TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blade_wood TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS playstyle VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS strengths TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weaknesses TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS goals TEXT;

-- Leagues table
CREATE TABLE IF NOT EXISTS leagues (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    -- ELO update mode: 'immediate' | 'weekly' | 'monthly'
    elo_update_mode VARCHAR(20) DEFAULT 'immediate',
    season VARCHAR(100),
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- League members table (junction table for users and leagues)
CREATE TABLE IF NOT EXISTS league_members (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_elo INTEGER DEFAULT 1200,
    is_admin BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(league_id, user_id)
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    player1_id INTEGER NOT NULL REFERENCES users(id),
    player2_id INTEGER NOT NULL REFERENCES users(id),
    player1_sets_won INTEGER DEFAULT 0,
    player2_sets_won INTEGER DEFAULT 0,
    player1_points_total INTEGER DEFAULT 0,
    player2_points_total INTEGER DEFAULT 0,
    game_type VARCHAR(20) NOT NULL,
    winner_id INTEGER REFERENCES users(id),
    player1_elo_before INTEGER,
    player2_elo_before INTEGER,
    player1_elo_after INTEGER,
    player2_elo_after INTEGER,
    is_accepted BOOLEAN DEFAULT FALSE,
    accepted_by INTEGER REFERENCES users(id),
    accepted_at TIMESTAMP,
    -- Consolidation tracking: when ELO updates are applied (for deferred modes)
    elo_applied BOOLEAN DEFAULT FALSE,
    elo_applied_at TIMESTAMP,
    played_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Match sets table (for detailed set scores)
CREATE TABLE IF NOT EXISTS match_sets (
    id SERIAL PRIMARY KEY,
    match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    set_number INTEGER NOT NULL,
    player1_score INTEGER NOT NULL,
    player2_score INTEGER NOT NULL
);

-- ELO history table
CREATE TABLE IF NOT EXISTS elo_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    league_id INTEGER NOT NULL REFERENCES leagues(id),
    match_id INTEGER REFERENCES matches(id),
    elo_before INTEGER NOT NULL,
    elo_after INTEGER NOT NULL,
    elo_change INTEGER NOT NULL,
    recorded_at TIMESTAMP DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_id INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    badge_type VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- User badges table (junction table for users and badges)
CREATE TABLE IF NOT EXISTS user_badges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_id INTEGER NOT NULL REFERENCES badges(id),
    league_id INTEGER,
    earned_at TIMESTAMP DEFAULT NOW(),
    season VARCHAR(100)
);

-- League invites table
CREATE TABLE IF NOT EXISTS league_invites (
    id SERIAL PRIMARY KEY,
    league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
    invited_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_by INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    invite_code VARCHAR(50) UNIQUE,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    responded_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_league_members_league_id ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user_id ON league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_league_id ON matches(league_id);
CREATE INDEX IF NOT EXISTS idx_matches_player1_id ON matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_matches_player2_id ON matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at);
CREATE INDEX IF NOT EXISTS idx_elo_history_user_league ON elo_history(user_id, league_id);
CREATE INDEX IF NOT EXISTS idx_elo_history_recorded_at ON elo_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
