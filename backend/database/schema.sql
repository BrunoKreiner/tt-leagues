-- Table Tennis League App Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Optional public profile fields (add columns if they do not exist)
-- Note: SQLite doesn't support IF NOT EXISTS in ALTER TABLE, so we'll handle this in the application
-- These columns will be added by the application if they don't exist

-- Leagues table
CREATE TABLE IF NOT EXISTS leagues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    -- ELO update mode: 'immediate' | 'weekly' | 'monthly'
    elo_update_mode VARCHAR(20) DEFAULT 'immediate',
    season VARCHAR(100),
    created_by INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- League members table (junction table for users and leagues)
CREATE TABLE IF NOT EXISTS league_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    current_elo INTEGER DEFAULT 1200,
    is_admin BOOLEAN DEFAULT FALSE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(league_id, user_id)
);

-- League roster table
-- Supports placeholders (user_id NULL) and assigned members (user_id set).
-- New matches/ELO use roster IDs rather than users directly.
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
);

-- Matches table
CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    -- Legacy user-based references (nullable; canonical fields are roster IDs below)
    player1_id INTEGER,
    player2_id INTEGER,
    -- Roster-based references (canonical fields)
    player1_roster_id INTEGER,
    player2_roster_id INTEGER,
    winner_roster_id INTEGER,
    player1_sets_won INTEGER DEFAULT 0,
    player2_sets_won INTEGER DEFAULT 0,
    player1_points_total INTEGER DEFAULT 0,
    player2_points_total INTEGER DEFAULT 0,
    game_type VARCHAR(20) NOT NULL, -- 'best_of_3', 'best_of_5', 'best_of_7', 'best_of_1'
    winner_id INTEGER,
    player1_elo_before INTEGER,
    player2_elo_before INTEGER,
    player1_elo_after INTEGER,
    player2_elo_after INTEGER,
    is_accepted BOOLEAN DEFAULT FALSE,
    accepted_by INTEGER,
    accepted_at DATETIME,
    -- Consolidation tracking: when ELO updates are applied (for deferred modes)
    elo_applied BOOLEAN DEFAULT FALSE,
    elo_applied_at DATETIME,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    FOREIGN KEY (player1_id) REFERENCES users(id),
    FOREIGN KEY (player2_id) REFERENCES users(id),
    FOREIGN KEY (winner_id) REFERENCES users(id),
    FOREIGN KEY (accepted_by) REFERENCES users(id)
);

-- Match sets table (for detailed set scores)
CREATE TABLE IF NOT EXISTS match_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    set_number INTEGER NOT NULL,
    player1_score INTEGER NOT NULL,
    player2_score INTEGER NOT NULL,
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
);

-- ELO history table
CREATE TABLE IF NOT EXISTS elo_history (
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
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'league_invite', 'match_request', 'match_accepted', 'badge_earned'
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    related_id INTEGER, -- ID of related entity (league_id, match_id, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Badges table
CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100), -- icon name or path
    badge_type VARCHAR(50) NOT NULL, -- 'league_winner', 'tournament_winner', 'achievement'
    image_url TEXT, -- base64 image data or image URL
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User badges table (junction table for users and badges)
CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_id INTEGER NOT NULL,
    league_id INTEGER, -- if badge is league-specific
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    season VARCHAR(100),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(id),
    FOREIGN KEY (league_id) REFERENCES leagues(id)
);

-- League invites table
CREATE TABLE IF NOT EXISTS league_invites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    league_id INTEGER NOT NULL,
    invited_user_id INTEGER NOT NULL,
    invited_by INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
    invite_code VARCHAR(50) UNIQUE,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    responded_at DATETIME,
    FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES users(id)
);

-- Indexes for performance
-- Basic indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_league_members_league_id ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user_id ON league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_league_roster_league_id ON league_roster(league_id);
CREATE INDEX IF NOT EXISTS idx_league_roster_user_id ON league_roster(user_id);
CREATE INDEX IF NOT EXISTS idx_league_roster_league_elo ON league_roster(league_id, current_elo);
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
-- Note: idx_elo_history_roster_id is created in ensureRosterIndexes() after roster_id column is ensured

-- Match sets table
CREATE INDEX IF NOT EXISTS idx_match_sets_match_id ON match_sets(match_id);

-- Insert default admin user (password: admin123)
INSERT OR IGNORE INTO users (username, password_hash, first_name, last_name, email, is_admin) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin', 'User', 'admin@tabletennis.local', TRUE);

-- Insert some default badges
INSERT OR IGNORE INTO badges (name, description, icon, badge_type) VALUES
('League Champion', 'Winner of a league season', 'trophy', 'league_winner');

