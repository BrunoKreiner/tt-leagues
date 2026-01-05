const express = require('express');
const { authenticateToken, requireAdmin, optionalAuth } = require('../middleware/auth');
const { validateId, validatePagination } = require('../middleware/validation');
const { moderateText, moderateImage, ModerationError } = require('../middleware/contentModeration');
const database = require('../models/database');

const router = express.Router();

/**
 * Get all users (admin only, or for league admin invite purposes)
 * GET /api/users
 */
router.get('/', authenticateToken, validatePagination, async (req, res) => {
    try {
        // Only admin can access full user list, but allow search for invite purposes
        // If search is provided, allow any authenticated user (for league invite search)
        // Otherwise, require admin
        const search = req.query.search?.trim();
        if (!search && !req.user.is_admin) {
            return res.status(403).json({ error: 'Access denied. Admin only or search required.' });
        }
        
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // Build WHERE clause for search
        let whereClause = '';
        let params = [];
        
        if (search) {
            whereClause = `WHERE (
                u.username LIKE ? OR 
                u.first_name LIKE ? OR 
                u.last_name LIKE ? OR 
                u.email LIKE ?
            )`;
            const searchPattern = `%${search}%`;
            params = [searchPattern, searchPattern, searchPattern, searchPattern];
        }
        
        // When searching (for invites), return minimal user info with simpler query
        // When admin viewing all, return full info with aggregations
        let users;
        if (search) {
            // Simple query for search
            users = await database.all(`
                SELECT 
                    u.id, u.username, u.first_name, u.last_name, u.email
                FROM users u
                ${whereClause}
                ORDER BY u.username ASC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);
        } else {
            // Full query with aggregations for admin view
            users = await database.all(`
                SELECT 
                    u.id, u.username, u.first_name, u.last_name, u.email, u.is_admin, u.created_at,
                    COALESCE((SELECT COUNT(DISTINCT lr2.league_id) FROM league_roster lr2 WHERE lr2.user_id = u.id), 0) as leagues_count,
                    COALESCE((
                        SELECT COUNT(DISTINCT m2.id)
                        FROM matches m2
                        JOIN league_roster r1 ON m2.player1_roster_id = r1.id
                        JOIN league_roster r2 ON m2.player2_roster_id = r2.id
                        WHERE m2.is_accepted = ? AND (r1.user_id = u.id OR r2.user_id = u.id)
                    ), 0) as matches_played
                FROM users u
                ${whereClause}
                ORDER BY u.created_at DESC
                LIMIT ? OFFSET ?
            `, [true, ...params, limit, offset]);
        }
        
        // Get total count with same search filter
        let countQuery = 'SELECT COUNT(*) as count FROM users u';
        const countParams = [];
        if (search) {
            countQuery += ` WHERE (
                u.username LIKE ? OR 
                u.first_name LIKE ? OR 
                u.last_name LIKE ? OR 
                u.email LIKE ?
            )`;
            const searchPattern = `%${search}%`;
            countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }
        const totalCount = await database.get(countQuery, countParams);
        
        res.json({
            users,
            pagination: {
                page,
                limit,
                total: totalCount.count,
                pages: Math.ceil(totalCount.count / limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get user by ID
 * GET /api/users/:id
 */
router.get('/:id', authenticateToken, validateId, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Users can only view their own profile unless they're admin
        if (userId !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const user = await database.get(`
            SELECT 
                u.id, u.username, u.first_name, u.last_name, u.email, u.is_admin, u.created_at,
                u.forehand_rubber, u.backhand_rubber, u.blade_wood, u.playstyle, u.strengths, u.weaknesses, u.goals,
                COALESCE((SELECT COUNT(DISTINCT lr2.league_id) FROM league_roster lr2 WHERE lr2.user_id = u.id), 0) as leagues_count,
                COALESCE((
                    SELECT COUNT(DISTINCT m2.id)
                    FROM matches m2
                    JOIN league_roster r1 ON m2.player1_roster_id = r1.id
                    JOIN league_roster r2 ON m2.player2_roster_id = r2.id
                    WHERE m2.is_accepted = ? AND (r1.user_id = u.id OR r2.user_id = u.id)
                ), 0) as matches_played,
                COALESCE((
                    SELECT COUNT(DISTINCT m3.id)
                    FROM matches m3
                    JOIN league_roster me ON me.user_id = u.id AND me.league_id = m3.league_id
                    WHERE m3.is_accepted = ? AND m3.winner_roster_id = me.id
                ), 0) as matches_won
            FROM users u
            WHERE u.id = ?
        `, [true, true, userId]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's leagues
        const leagues = await database.all(`
            SELECT 
                l.id, l.name, l.season, lr.current_elo, lr.is_admin as is_league_admin, lr.joined_at, lr.display_name
            FROM leagues l
            JOIN league_roster lr ON l.id = lr.league_id
            WHERE lr.user_id = ? AND l.is_active = ?
            ORDER BY lr.joined_at DESC
        `, [userId, true]);
        
        // Get recent matches
        const recentMatches = await database.all(`
            SELECT 
                m.id, m.league_id, m.player1_sets_won, m.player2_sets_won, 
                m.winner_roster_id, m.played_at, m.is_accepted,
                l.name as league_name,
                r1.display_name as player1_display_name,
                r2.display_name as player2_display_name
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            JOIN league_roster r1 ON m.player1_roster_id = r1.id
            JOIN league_roster r2 ON m.player2_roster_id = r2.id
            WHERE (r1.user_id = ? OR r2.user_id = ?) AND m.is_accepted = ?
            ORDER BY m.played_at DESC
            LIMIT 10
        `, [userId, userId, true]);
        
        res.json({
            user: {
                ...user,
                win_rate: user.matches_played > 0 ? 
                    Math.round((user.matches_won / user.matches_played) * 100) : 0
            },
            leagues,
            recent_matches: recentMatches
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Update user (admin only or self)
 * PUT /api/users/:id
 */
router.put('/:id', authenticateToken, validateId, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { first_name, last_name, email, is_admin, forehand_rubber, backhand_rubber, blade_wood, playstyle, strengths, weaknesses, goals, avatar_url } = req.body;

        moderateText(
            { first_name, last_name, forehand_rubber, backhand_rubber, blade_wood, playstyle, strengths, weaknesses, goals },
            { context: 'profile fields' }
        );
        await moderateImage(avatar_url, { context: 'avatar' });
        
        // Users can only update their own profile unless they're admin
        if (userId !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Only admins can change admin status
        if (is_admin !== undefined && !req.user.is_admin) {
            return res.status(403).json({ error: 'Only admins can change admin status' });
        }
        
        const updates = [];
        const values = [];
        
        if (first_name !== undefined) {
            updates.push('first_name = ?');
            values.push(first_name.trim());
        }
        
        if (last_name !== undefined) {
            updates.push('last_name = ?');
            values.push(last_name.trim());
        }
        
        if (email !== undefined) {
            // Check if email already exists for another user
            if (email) {
                const existingEmail = await database.get(
                    'SELECT id FROM users WHERE email = ? AND id != ?',
                    [email, userId]
                );
                
                if (existingEmail) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
            }
            
            updates.push('email = ?');
            values.push(email || null);
        }
        
        if (is_admin !== undefined && req.user.is_admin) {
            updates.push('is_admin = ?');
            values.push(is_admin);
        }

        if (avatar_url !== undefined) { updates.push('avatar_url = ?'); values.push(avatar_url || null); }
        
        // Optional public profile fields
        if (forehand_rubber !== undefined) { updates.push('forehand_rubber = ?'); values.push(forehand_rubber || null); }
        if (backhand_rubber !== undefined) { updates.push('backhand_rubber = ?'); values.push(backhand_rubber || null); }
        if (blade_wood !== undefined) { updates.push('blade_wood = ?'); values.push(blade_wood || null); }
        if (playstyle !== undefined) { updates.push('playstyle = ?'); values.push(playstyle || null); }
        if (strengths !== undefined) { updates.push('strengths = ?'); values.push(strengths || null); }
        if (weaknesses !== undefined) { updates.push('weaknesses = ?'); values.push(weaknesses || null); }
        if (goals !== undefined) { updates.push('goals = ?'); values.push(goals || null); }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(userId);
        
        await database.run(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        // Get updated user
        const updatedUser = await database.get(
            'SELECT id, username, first_name, last_name, email, is_admin, forehand_rubber, backhand_rubber, blade_wood, playstyle, strengths, weaknesses, goals, avatar_url FROM users WHERE id = ?',
            [userId]
        );
        
        res.json({
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
        if (error instanceof ModerationError) {
            return res.status(error.status || 400).json({ error: error.message, code: error.code });
        }
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Delete user (admin only)
 * DELETE /api/users/:id
 */
router.delete('/:id', authenticateToken, requireAdmin, validateId, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Prevent admin from deleting themselves
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        const user = await database.get('SELECT username FROM users WHERE id = ?', [userId]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        await database.run('DELETE FROM users WHERE id = ?', [userId]);
        
        res.json({ message: `User ${user.username} deleted successfully` });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get user statistics
 * GET /api/users/:id/stats
 */
router.get('/:id/stats', authenticateToken, validateId, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Users can only view their own stats unless they're admin
        if (userId !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Get overall stats
        const overallStats = await database.get(`
            SELECT 
                COALESCE((SELECT COUNT(DISTINCT lr2.league_id) FROM league_roster lr2 WHERE lr2.user_id = ?), 0) as leagues_count,
                COALESCE((
                    SELECT COUNT(DISTINCT m2.id)
                    FROM matches m2
                    JOIN league_roster r1 ON m2.player1_roster_id = r1.id
                    JOIN league_roster r2 ON m2.player2_roster_id = r2.id
                    WHERE m2.is_accepted = ? AND (r1.user_id = ? OR r2.user_id = ?)
                ), 0) as matches_played,
                COALESCE((
                    SELECT COUNT(DISTINCT m3.id)
                    FROM matches m3
                    JOIN league_roster me ON me.user_id = ? AND me.league_id = m3.league_id
                    WHERE m3.is_accepted = ? AND m3.winner_roster_id = me.id
                ), 0) as matches_won,
                COALESCE((SELECT AVG(lr3.current_elo) FROM league_roster lr3 WHERE lr3.user_id = ?), 1200) as average_elo
            FROM users u
            WHERE u.id = ?
        `, [userId, true, userId, userId, userId, true, userId, userId]);
        
        // Get league-specific stats
        const leagueStats = await database.all(`
            SELECT 
                l.id, l.name, l.season,
                lr.current_elo, lr.is_admin as is_league_admin,
                COUNT(CASE WHEN m.player1_roster_id = lr.id OR m.player2_roster_id = lr.id THEN m.id END) as matches_played,
                COUNT(CASE WHEN m.winner_roster_id = lr.id THEN m.id END) as matches_won
            FROM leagues l
            JOIN league_roster lr ON l.id = lr.league_id
            LEFT JOIN matches m ON m.league_id = l.id AND (m.player1_roster_id = lr.id OR m.player2_roster_id = lr.id) AND m.is_accepted = ?
            WHERE lr.user_id = ?
            GROUP BY l.id, l.name, l.season, lr.current_elo, lr.is_admin, lr.id
            ORDER BY lr.current_elo DESC
        `, [true, userId]);
        
        // Get user badges
        let badges = [];
        try {
            badges = await database.all(`
                SELECT 
                    b.id, b.name, b.description, b.icon, b.badge_type, b.image_url,
                    ub.earned_at, ub.season,
                    l.name as league_name
                FROM user_badges ub
                JOIN badges b ON ub.badge_id = b.id
                LEFT JOIN leagues l ON ub.league_id = l.id
                WHERE ub.user_id = ?
                ORDER BY ub.earned_at DESC
            `, [userId]);
        } catch (badgeError) {
            console.warn('Failed to fetch badges:', badgeError.message);
            // Continue without badges if table doesn't exist or error occurs
        }

        // Get user data
        const user = await database.get(
            'SELECT id, username, first_name, last_name, email, avatar_url, forehand_rubber, backhand_rubber, blade_wood, playstyle, strengths, weaknesses, goals FROM users WHERE id = ?',
            [userId]
        );

        res.json({
            user: user,
            overall: {
                ...overallStats,
                win_rate: overallStats.matches_played > 0 ? 
                    Math.round((overallStats.matches_won / overallStats.matches_played) * 100) : 0,
                average_elo: Math.round(overallStats.average_elo || 1200)
            },
            by_league: leagueStats.map(league => ({
                ...league,
                win_rate: league.matches_played > 0 ? 
                    Math.round((league.matches_won / league.matches_played) * 100) : 0
            })),
            badges: badges
        });
    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get user timeline statistics (monthly stats)
 * GET /api/users/:id/timeline-stats
 */
router.get('/:id/timeline-stats', authenticateToken, validateId, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        // Users can only view their own stats unless they're admin
        if (userId !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const isPg = database.isPg;
        
        // Get monthly statistics
        // For SQLite: use strftime('%Y-%m', date) to group by month
        // For PostgreSQL: use to_char(date_trunc('month', date), 'YYYY-MM') to format as YYYY-MM
        // Database abstraction converts ? to $1, $2, etc. automatically for PostgreSQL
        
        // 1. Monthly leagues count (distinct leagues joined per month - will be cumulative in processing)
        let leaguesQuery;
        if (isPg) {
            leaguesQuery = `
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', lr.joined_at), 'YYYY-MM') as month,
                    COUNT(DISTINCT lr.league_id) as leagues_count
                FROM league_roster lr
                WHERE lr.user_id = ?
                GROUP BY DATE_TRUNC('month', lr.joined_at)
                ORDER BY month ASC
            `;
        } else {
            leaguesQuery = `
                SELECT 
                    strftime('%Y-%m', lr.joined_at) as month,
                    COUNT(DISTINCT lr.league_id) as leagues_count
                FROM league_roster lr
                WHERE lr.user_id = ?
                GROUP BY strftime('%Y-%m', lr.joined_at)
                ORDER BY month ASC
            `;
        }
        
        // 2. Monthly matches count and win rate
        let matchesQuery;
        if (isPg) {
            matchesQuery = `
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', m.played_at), 'YYYY-MM') as month,
                    COUNT(*) as matches_played,
                    COUNT(CASE WHEN m.winner_roster_id = me.id THEN 1 END) as matches_won
                FROM matches m
                JOIN league_roster me ON me.user_id = ? AND me.league_id = m.league_id
                WHERE (m.player1_roster_id = me.id OR m.player2_roster_id = me.id)
                    AND m.is_accepted = true
                GROUP BY DATE_TRUNC('month', m.played_at)
                ORDER BY month ASC
            `;
        } else {
            matchesQuery = `
                SELECT 
                    strftime('%Y-%m', m.played_at) as month,
                    COUNT(*) as matches_played,
                    COUNT(CASE WHEN m.winner_roster_id = me.id THEN 1 END) as matches_won
                FROM matches m
                JOIN league_roster me ON me.user_id = ? AND me.league_id = m.league_id
                WHERE (m.player1_roster_id = me.id OR m.player2_roster_id = me.id)
                    AND m.is_accepted = 1
                GROUP BY strftime('%Y-%m', m.played_at)
                ORDER BY month ASC
            `;
        }
        
        // 3. Monthly average ELO (from elo_history; bucketed by match date)
        let eloQuery;
        if (isPg) {
            eloQuery = `
                SELECT 
                    TO_CHAR(DATE_TRUNC('month', m.played_at), 'YYYY-MM') as month,
                    AVG(eh.elo_after) as avg_elo
                FROM elo_history eh
                JOIN matches m ON eh.match_id = m.id
                WHERE eh.user_id = ?
                  AND m.played_at IS NOT NULL
                GROUP BY DATE_TRUNC('month', m.played_at)
                ORDER BY month ASC
            `;
        } else {
            eloQuery = `
                SELECT 
                    strftime('%Y-%m', m.played_at) as month,
                    AVG(eh.elo_after) as avg_elo
                FROM elo_history eh
                JOIN matches m ON eh.match_id = m.id
                WHERE eh.user_id = ?
                  AND m.played_at IS NOT NULL
                GROUP BY strftime('%Y-%m', m.played_at)
                ORDER BY month ASC
            `;
        }
        
        // Execute queries - database abstraction handles ? to $1 conversion automatically
        const [leaguesData, matchesData, eloData] = await Promise.all([
            database.all(leaguesQuery, [userId]),
            database.all(matchesQuery, [userId]),
            database.all(eloQuery, [userId])
        ]);
        
        // Convert to objects keyed by month for easier merging
        const leaguesByMonth = {};
        leaguesData.forEach(row => {
            leaguesByMonth[row.month] = parseInt(row.leagues_count) || 0;
        });
        
        const matchesByMonth = {};
        matchesData.forEach(row => {
            matchesByMonth[row.month] = {
                matches_played: parseInt(row.matches_played) || 0,
                matches_won: parseInt(row.matches_won) || 0,
                win_rate: row.matches_played > 0 ? 
                    Math.round((row.matches_won / row.matches_played) * 100) : 0
            };
        });
        
        const eloByMonth = {};
        eloData.forEach(row => {
            eloByMonth[row.month] = Math.round(parseFloat(row.avg_elo) || 1200);
        });
        
        // Get all unique months and create cumulative/aggregated timeline
        const allMonths = new Set([
            ...Object.keys(leaguesByMonth),
            ...Object.keys(matchesByMonth),
            ...Object.keys(eloByMonth)
        ]);
        
        // Sort months chronologically
        const sortedMonths = Array.from(allMonths).sort();
        
        // Build timeline data with cumulative leagues and monthly stats
        let cumulativeLeagues = 0;
        const timeline = sortedMonths.map(month => {
            cumulativeLeagues += leaguesByMonth[month] || 0;
            const matchStats = matchesByMonth[month] || { matches_played: 0, matches_won: 0, win_rate: 0 };
            
            return {
                month,
                leagues_count: cumulativeLeagues,
                matches_per_month: matchStats.matches_played,
                win_rate: matchStats.win_rate,
                avg_elo: eloByMonth[month] || null
            };
        });
        
        res.json({
            timeline
        });
    } catch (error) {
        console.error('Get timeline stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get user badges
 * GET /api/users/:id/badges
 */
router.get('/:id/badges', authenticateToken, validateId, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        
        const badges = await database.all(`
            SELECT 
                b.id, b.name, b.description, b.icon, b.badge_type, b.image_url,
                ub.earned_at, ub.season,
                l.name as league_name
            FROM user_badges ub
            JOIN badges b ON ub.badge_id = b.id
            LEFT JOIN leagues l ON ub.league_id = l.id
            WHERE ub.user_id = ?
            ORDER BY ub.earned_at DESC
        `, [userId]);
        
        res.json({ badges });
    } catch (error) {
        console.error('Get user badges error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get user ELO history
 * GET /api/users/:id/elo-history
 * Anyone can view any user's ELO history - access is only restricted by league visibility (public vs private)
 */
router.get('/:id/elo-history', optionalAuth, validateId, validatePagination, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { league_id } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        // league_id is required
        if (!league_id) {
            return res.status(400).json({ error: 'league_id parameter is required' });
        }
        
        // Check league visibility - similar to leaderboard endpoint
        // Anyone can view ELO history for public leagues
        // For private leagues, user must be a member or admin
        const league = await database.get('SELECT is_public FROM leagues WHERE id = ? AND is_active = ?', [league_id, true]);
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        if (!league.is_public) {
            // Private league - check if user has access
            if (!req.user) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
            
            const membership = await database.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [league_id, req.user.id]
            );
            
            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        }
        
        // Build query for ELO history
        // Use match-level player_id fields which are always populated, not roster IDs
        // This works even after a user leaves (roster deleted)
        let query = `
            SELECT 
                eh.recorded_at, eh.elo_before, eh.elo_after, 
                (eh.elo_after - eh.elo_before) as elo_change,
                eh.match_id, m.played_at,
                COALESCE(opp_roster.display_name, opp_user.username, 'Unknown') as opponent_display_name,
                CASE 
                    WHEN m.player1_id = ? THEN m.player1_sets_won
                    ELSE m.player2_sets_won
                END as user_sets_won,
                CASE 
                    WHEN m.player1_id = ? THEN m.player2_sets_won
                    ELSE m.player1_sets_won
                END as opponent_sets_won,
                CASE 
                    WHEN (m.player1_id = ? AND m.player1_sets_won > m.player2_sets_won) OR
                         (m.player2_id = ? AND m.player2_sets_won > m.player1_sets_won) THEN 'W'
                    WHEN m.winner_id IS NOT NULL THEN 'L'
                    ELSE 'D'
                END as result
            FROM elo_history eh
            JOIN matches m ON eh.match_id = m.id
            LEFT JOIN league_roster opp_roster ON (
                CASE
                    WHEN m.player1_id = ? THEN m.player2_roster_id
                    ELSE m.player1_roster_id
                END = opp_roster.id
            )
            LEFT JOIN users opp_user ON (
                CASE
                    WHEN m.player1_id = ? THEN m.player2_id
                    ELSE m.player1_id
                END = opp_user.id
            )
            WHERE eh.user_id = ? AND eh.league_id = ?
        `;
        
        const params = [userId, userId, userId, userId, userId, userId, userId, league_id];
        
        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as count
            FROM elo_history eh
            WHERE eh.user_id = ? AND eh.league_id = ?
        `;
        
        const totalCount = await database.get(countQuery, [userId, league_id]);
        
        // Get paginated results
        query += ` ORDER BY eh.recorded_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);
        
        const items = await database.all(query, params);
        
        res.json({
            items: items.map(item => ({
                recorded_at: item.recorded_at,
                elo_before: item.elo_before,
                elo_after: item.elo_after,
                elo_change: item.elo_change,
                match_id: item.match_id,
                played_at: item.played_at,
                opponent_display_name: item.opponent_display_name,
                user_sets_won: item.user_sets_won,
                opponent_sets_won: item.opponent_sets_won,
                result: item.result
            })),
            pagination: {
                page,
                limit,
                total: totalCount.count,
                pages: Math.ceil(totalCount.count / limit)
            }
        });
    } catch (error) {
        console.error('Get user ELO history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get public profile by username (no auth required)
 * GET /api/users/profile/:username
 */
router.get('/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        // Get user basic info
        const user = await database.get(`
            SELECT 
                u.id, u.username, u.first_name, u.last_name, u.created_at,
                u.avatar_url,
                u.forehand_rubber, u.backhand_rubber, u.blade_wood, u.playstyle, u.strengths, u.weaknesses, u.goals
            FROM users u
            WHERE u.username = ?
        `, [username]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's league rankings
        const leagueRankings = await database.all(`
            SELECT 
                l.id as league_id, l.name as league_name, lr.current_elo, lr.is_admin as is_league_admin,
                COUNT(CASE WHEN m.player1_roster_id = lr.id OR m.player2_roster_id = lr.id THEN m.id END) as matches_played,
                COUNT(CASE WHEN m.winner_roster_id = lr.id THEN m.id END) as matches_won
            FROM leagues l
            JOIN league_roster lr ON l.id = lr.league_id
            LEFT JOIN matches m ON m.league_id = l.id AND (m.player1_roster_id = lr.id OR m.player2_roster_id = lr.id) AND m.is_accepted = ?
            WHERE lr.user_id = ? AND l.is_active = ?
            GROUP BY l.id, l.name, lr.current_elo, lr.is_admin, lr.id
            ORDER BY lr.current_elo DESC
        `, [true, user.id, true]);
        
        // Calculate rank for each league
        const rankingsWithRank = await Promise.all(leagueRankings.map(async (league) => {
            const rankResult = await database.get(`
                SELECT COUNT(*) + 1 as rank
                FROM league_roster lr2
                WHERE lr2.league_id = ? AND lr2.current_elo > ?
            `, [league.league_id, league.current_elo]);
            
            const winRate = league.matches_played > 0 
                ? Math.round((league.matches_won * 100) / league.matches_played)
                : 0;
            
            return {
                ...league,
                rank: rankResult.rank,
                win_rate: winRate
            };
        }));
        
        // Get recent matches (last 10)
        const recentMatches = await database.all(`
            SELECT 
                m.id, l.name as league_name,
                CASE 
                    WHEN m.player1_roster_id = me.id THEN r2.display_name
                    ELSE r1.display_name
                END as opponent_display_name,
                CASE 
                    WHEN m.winner_roster_id = me.id THEN 'W'
                    WHEN m.winner_roster_id IS NOT NULL THEN 'L'
                    ELSE 'D'
                END as result,
                m.played_at,
                CASE 
                    WHEN m.player1_roster_id = me.id THEN (m.player1_elo_after - m.player1_elo_before)
                    ELSE (m.player2_elo_after - m.player2_elo_before)
                END as elo_change
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            JOIN league_roster r1 ON m.player1_roster_id = r1.id
            JOIN league_roster r2 ON m.player2_roster_id = r2.id
            JOIN league_roster me ON me.user_id = ? AND me.league_id = m.league_id
            WHERE (m.player1_roster_id = me.id OR m.player2_roster_id = me.id) AND m.is_accepted = ?
            ORDER BY m.played_at DESC
            LIMIT 10
        `, [user.id, true]);
        
        // Get user's badges (with error handling for missing tables)
        let badges = [];
        try {
            badges = await database.all(`
                SELECT 
                    b.id, b.name, b.description, b.icon, b.badge_type, b.image_url,
                    ub.earned_at, ub.league_id,
                    l.name as league_name
                FROM user_badges ub
                JOIN badges b ON ub.badge_id = b.id
                LEFT JOIN leagues l ON ub.league_id = l.id
                WHERE ub.user_id = ?
                ORDER BY ub.earned_at DESC
            `, [user.id]);
        } catch (badgeError) {
            console.warn('Badges table might not exist yet:', badgeError.message);
            // Continue without badges if table doesn't exist
        }
        
        // Calculate overall stats
        const overallStats = await database.get(`
            SELECT 
                COALESCE((SELECT COUNT(DISTINCT lr2.league_id) FROM league_roster lr2 WHERE lr2.user_id = ?), 0) as leagues_count,
                COALESCE((
                    SELECT COUNT(DISTINCT m2.id)
                    FROM matches m2
                    JOIN league_roster r1 ON m2.player1_roster_id = r1.id
                    JOIN league_roster r2 ON m2.player2_roster_id = r2.id
                    WHERE m2.is_accepted = ? AND (r1.user_id = ? OR r2.user_id = ?)
                ), 0) as matches_played,
                COALESCE((
                    SELECT COUNT(DISTINCT m3.id)
                    FROM matches m3
                    JOIN league_roster me ON me.user_id = ? AND me.league_id = m3.league_id
                    WHERE m3.is_accepted = ? AND m3.winner_roster_id = me.id
                ), 0) as matches_won
            FROM users u
            WHERE u.id = ?
        `, [user.id, true, user.id, user.id, user.id, true, user.id]);
        
        const winRate = overallStats.matches_played > 0 
            ? Math.round((overallStats.matches_won * 100) / overallStats.matches_played)
            : 0;
        
        res.json({
            user: {
                id: user.id,
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name,
                created_at: user.created_at,
                avatar_url: user.avatar_url || null
            },
            profile: {
                forehand_rubber: user.forehand_rubber,
                backhand_rubber: user.backhand_rubber,
                blade_wood: user.blade_wood,
                playstyle: user.playstyle,
                strengths: user.strengths,
                weaknesses: user.weaknesses,
                goals: user.goals
            },
            league_rankings: rankingsWithRank,
            recent_matches: recentMatches,
            badges: badges,
            overall: {
                leagues_count: overallStats.leagues_count,
                matches_played: overallStats.matches_played,
                matches_won: overallStats.matches_won,
                win_rate: winRate
            }
        });
    } catch (error) {
        console.error('Get public profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Check and create badges tables if they don't exist (admin only)
 * POST /api/users/check-badges-tables
 */
router.post('/check-badges-tables', authenticateToken, requireAdmin, async (req, res) => {
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
        }
        
        res.json({ 
            message: 'Badges tables check completed',
            badges_table_exists: badgesTableExists.exists,
            user_badges_table_exists: userBadgesTableExists.exists
        });
    } catch (error) {
        console.error('Check badges tables error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

