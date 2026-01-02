-- Additional indexes for performance optimization
-- These indexes target frequently queried columns and common query patterns

-- Matches table indexes
-- is_accepted is used in almost every match query
CREATE INDEX IF NOT EXISTS idx_matches_is_accepted ON matches(is_accepted);
-- Composite index for common query: league_id + is_accepted
CREATE INDEX IF NOT EXISTS idx_matches_league_accepted ON matches(league_id, is_accepted);
-- winner_id is used in COUNT queries for stats
CREATE INDEX IF NOT EXISTS idx_matches_winner_id ON matches(winner_id);
-- elo_applied is used in consolidation queries
CREATE INDEX IF NOT EXISTS idx_matches_elo_applied ON matches(elo_applied);
-- created_at is used in ORDER BY for match lists
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at);
-- Composite for player queries: (player1_id OR player2_id) AND is_accepted
CREATE INDEX IF NOT EXISTS idx_matches_player1_accepted ON matches(player1_id, is_accepted);
CREATE INDEX IF NOT EXISTS idx_matches_player2_accepted ON matches(player2_id, is_accepted);

-- Leagues table indexes
-- is_active is used in almost every league query
CREATE INDEX IF NOT EXISTS idx_leagues_is_active ON leagues(is_active);
-- is_public is used in filtering public leagues
CREATE INDEX IF NOT EXISTS idx_leagues_is_public ON leagues(is_public);
-- Composite for common query: is_active + is_public
CREATE INDEX IF NOT EXISTS idx_leagues_active_public ON leagues(is_active, is_public);
-- updated_at is used in ORDER BY for recent updates
CREATE INDEX IF NOT EXISTS idx_leagues_updated_at ON leagues(updated_at);
-- created_by is used in JOINs
CREATE INDEX IF NOT EXISTS idx_leagues_created_by ON leagues(created_by);

-- League members table indexes
-- current_elo is used in ORDER BY for leaderboards
CREATE INDEX IF NOT EXISTS idx_league_members_current_elo ON league_members(current_elo);
-- Composite for leaderboard queries: league_id + current_elo
CREATE INDEX IF NOT EXISTS idx_league_members_league_elo ON league_members(league_id, current_elo);
-- Composite for membership checks: league_id + user_id (already has UNIQUE, but index helps)
-- is_admin is used in permission checks
CREATE INDEX IF NOT EXISTS idx_league_members_is_admin ON league_members(is_admin);

-- League invites table indexes
CREATE INDEX IF NOT EXISTS idx_league_invites_league_id ON league_invites(league_id);
CREATE INDEX IF NOT EXISTS idx_league_invites_invited_user_id ON league_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_league_invites_status ON league_invites(status);
-- Composite for common query: league_id + invited_user_id + status
CREATE INDEX IF NOT EXISTS idx_league_invites_league_user_status ON league_invites(league_id, invited_user_id, status);
-- invite_code already has UNIQUE constraint, which creates an index

-- User badges table indexes
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge_id ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_league_id ON user_badges(league_id);
-- earned_at is used in ORDER BY
CREATE INDEX IF NOT EXISTS idx_user_badges_earned_at ON user_badges(earned_at);
-- Composite for common query: user_id + league_id (for filtering badges by league)
CREATE INDEX IF NOT EXISTS idx_user_badges_user_league ON user_badges(user_id, league_id);

-- Notifications table indexes
-- created_at is used in ORDER BY
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
-- Composite for common query: user_id + is_read + created_at
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at);

-- ELO history table indexes
-- match_id is used in JOINs
CREATE INDEX IF NOT EXISTS idx_elo_history_match_id ON elo_history(match_id);
-- recorded_at is already indexed, but composite might help
-- Composite for user queries: user_id + league_id + recorded_at
CREATE INDEX IF NOT EXISTS idx_elo_history_user_league_recorded ON elo_history(user_id, league_id, recorded_at);

-- Match sets table indexes
CREATE INDEX IF NOT EXISTS idx_match_sets_match_id ON match_sets(match_id);

