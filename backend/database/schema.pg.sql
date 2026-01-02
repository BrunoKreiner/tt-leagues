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
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

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
    image_url TEXT,
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
-- Basic indexes
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

-- Additional performance indexes
-- Matches table
CREATE INDEX IF NOT EXISTS idx_matches_is_accepted ON matches(is_accepted);
CREATE INDEX IF NOT EXISTS idx_matches_league_accepted ON matches(league_id, is_accepted);
CREATE INDEX IF NOT EXISTS idx_matches_winner_id ON matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_matches_elo_applied ON matches(elo_applied);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at);
CREATE INDEX IF NOT EXISTS idx_matches_player1_accepted ON matches(player1_id, is_accepted);
CREATE INDEX IF NOT EXISTS idx_matches_player2_accepted ON matches(player2_id, is_accepted);

-- Leagues table
CREATE INDEX IF NOT EXISTS idx_leagues_is_active ON leagues(is_active);
CREATE INDEX IF NOT EXISTS idx_leagues_is_public ON leagues(is_public);
CREATE INDEX IF NOT EXISTS idx_leagues_active_public ON leagues(is_active, is_public);
CREATE INDEX IF NOT EXISTS idx_leagues_updated_at ON leagues(updated_at);
CREATE INDEX IF NOT EXISTS idx_leagues_created_by ON leagues(created_by);

-- League members table
CREATE INDEX IF NOT EXISTS idx_league_members_current_elo ON league_members(current_elo);
CREATE INDEX IF NOT EXISTS idx_league_members_league_elo ON league_members(league_id, current_elo);
CREATE INDEX IF NOT EXISTS idx_league_members_is_admin ON league_members(is_admin);

-- League invites table
CREATE INDEX IF NOT EXISTS idx_league_invites_league_id ON league_invites(league_id);
CREATE INDEX IF NOT EXISTS idx_league_invites_invited_user_id ON league_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_league_invites_status ON league_invites(status);
CREATE INDEX IF NOT EXISTS idx_league_invites_league_user_status ON league_invites(league_id, invited_user_id, status);

-- User badges table
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_league_id ON user_badges(league_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at ON user_badges(earned_at);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_league ON user_badges(user_id, league_id);

-- Notifications table
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at);

-- ELO history table
CREATE INDEX IF NOT EXISTS idx_elo_history_match_id ON elo_history(match_id);
CREATE INDEX IF NOT EXISTS idx_elo_history_user_league_recorded ON elo_history(user_id, league_id, recorded_at);

-- Match sets table
CREATE INDEX IF NOT EXISTS idx_match_sets_match_id ON match_sets(match_id);
