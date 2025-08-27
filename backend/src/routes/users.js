const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateId, validatePagination } = require('../middleware/validation');
const database = require('../models/database');

const router = express.Router();

/**
 * Get all users (admin only)
 * GET /api/users
 */
router.get('/', authenticateToken, requireAdmin, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        const users = await database.all(`
            SELECT 
                u.id, u.username, u.first_name, u.last_name, u.email, u.is_admin, u.created_at,
                COUNT(DISTINCT lm.league_id) as leagues_count,
                COUNT(DISTINCT CASE WHEN m.player1_id = u.id OR m.player2_id = u.id THEN m.id END) as matches_played
            FROM users u
            LEFT JOIN league_members lm ON u.id = lm.user_id
            LEFT JOIN matches m ON (m.player1_id = u.id OR m.player2_id = u.id) AND m.is_accepted = ?
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `, [true, limit, offset]);
        
        const totalCount = await database.get('SELECT COUNT(*) as count FROM users');
        
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
                COUNT(DISTINCT lm.league_id) as leagues_count,
                COUNT(DISTINCT CASE WHEN m.player1_id = u.id OR m.player2_id = u.id THEN m.id END) as matches_played,
                COUNT(DISTINCT CASE WHEN m.winner_id = u.id THEN m.id END) as matches_won
            FROM users u
            LEFT JOIN league_members lm ON u.id = lm.user_id
            LEFT JOIN matches m ON (m.player1_id = u.id OR m.player2_id = u.id) AND m.is_accepted = ?
            WHERE u.id = ?
            GROUP BY u.id
        `, [true, userId]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's leagues
        const leagues = await database.all(`
            SELECT 
                l.id, l.name, l.season, lm.current_elo, lm.is_admin as is_league_admin, lm.joined_at
            FROM leagues l
            JOIN league_members lm ON l.id = lm.league_id
            WHERE lm.user_id = ? AND l.is_active = ?
            ORDER BY lm.joined_at DESC
        `, [userId, true]);
        
        // Get recent matches
        const recentMatches = await database.all(`
            SELECT 
                m.id, m.league_id, m.player1_sets_won, m.player2_sets_won, 
                m.winner_id, m.played_at, m.is_accepted,
                l.name as league_name,
                p1.username as player1_username,
                p2.username as player2_username
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            JOIN users p1 ON m.player1_id = p1.id
            JOIN users p2 ON m.player2_id = p2.id
            WHERE (m.player1_id = ? OR m.player2_id = ?) AND m.is_accepted = ?
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
        const { first_name, last_name, email, is_admin } = req.body;
        
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
            'SELECT id, username, first_name, last_name, email, is_admin FROM users WHERE id = ?',
            [userId]
        );
        
        res.json({
            message: 'User updated successfully',
            user: updatedUser
        });
    } catch (error) {
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
                COUNT(DISTINCT lm.league_id) as leagues_count,
                COUNT(DISTINCT CASE WHEN m.player1_id = ? OR m.player2_id = ? THEN m.id END) as matches_played,
                COUNT(DISTINCT CASE WHEN m.winner_id = ? THEN m.id END) as matches_won,
                AVG(lm.current_elo) as average_elo
            FROM users u
            LEFT JOIN league_members lm ON u.id = lm.user_id
            LEFT JOIN matches m ON (m.player1_id = u.id OR m.player2_id = u.id) AND m.is_accepted = ?
            WHERE u.id = ?
        `, [userId, userId, userId, true, userId]);
        
        // Get league-specific stats
        const leagueStats = await database.all(`
            SELECT 
                l.id, l.name, l.season,
                lm.current_elo,
                COUNT(CASE WHEN m.player1_id = ? OR m.player2_id = ? THEN m.id END) as matches_played,
                COUNT(CASE WHEN m.winner_id = ? THEN m.id END) as matches_won
            FROM leagues l
            JOIN league_members lm ON l.id = lm.league_id
            LEFT JOIN matches m ON m.league_id = l.id AND (m.player1_id = ? OR m.player2_id = ?) AND m.is_accepted = ?
            WHERE lm.user_id = ?
            GROUP BY l.id, l.name, l.season, lm.current_elo
            ORDER BY lm.current_elo DESC
        `, [userId, userId, userId, userId, userId, true, userId]);
        
        res.json({
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
            }))
        });
    } catch (error) {
        console.error('Get user stats error:', error);
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
                b.id, b.name, b.description, b.icon, b.badge_type,
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
 */
router.get('/:id/elo-history', authenticateToken, validateId, validatePagination, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { league_id } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        // Users can only view their own ELO history unless they're admin
        if (userId !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // league_id is required
        if (!league_id) {
            return res.status(400).json({ error: 'league_id parameter is required' });
        }
        
        // Check if user is a member of the specified league
        const membership = await database.get(
            'SELECT id FROM league_members WHERE user_id = ? AND league_id = ?',
            [userId, league_id]
        );
        
        if (!membership && !req.user.is_admin) {
            return res.status(403).json({ error: 'Access denied to league data' });
        }
        
        // Build query for ELO history
        let query = `
            SELECT 
                eh.recorded_at, eh.elo_before, eh.elo_after, 
                (eh.elo_after - eh.elo_before) as elo_change,
                eh.match_id, m.played_at,
                p1.username as opponent_username,
                CASE 
                    WHEN m.player1_id = ? THEN m.player1_sets_won
                    ELSE m.player2_sets_won
                END as user_sets_won,
                CASE 
                    WHEN m.player1_id = ? THEN m.player2_sets_won
                    ELSE m.player1_sets_won
                END as opponent_sets_won,
                CASE 
                    WHEN m.winner_id = ? THEN 'W'
                    WHEN m.winner_id IS NOT NULL THEN 'L'
                    ELSE 'D'
                END as result
            FROM elo_history eh
            JOIN matches m ON eh.match_id = m.id
            JOIN users p1 ON (
                CASE 
                    WHEN m.player1_id = ? THEN m.player2_id
                    ELSE m.player1_id
                END = p1.id
            )
            WHERE eh.user_id = ? AND eh.league_id = ?
        `;
        
        const params = [userId, userId, userId, userId, userId, league_id];
        
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
                opponent_username: item.opponent_username,
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
                u.id, u.username, u.first_name, u.last_name, u.created_at
            FROM users u
            WHERE u.username = ?
        `, [username]);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get user's league rankings
        const leagueRankings = await database.all(`
            SELECT 
                l.id as league_id, l.name as league_name, lm.current_elo,
                COUNT(CASE WHEN m.player1_id = ? OR m.player2_id = ? THEN m.id END) as matches_played,
                COUNT(CASE WHEN m.winner_id = ? THEN m.id END) as matches_won
            FROM leagues l
            JOIN league_members lm ON l.id = lm.league_id
            LEFT JOIN matches m ON m.league_id = l.id AND (m.player1_id = ? OR m.player2_id = ?) AND m.is_accepted = ?
            WHERE lm.user_id = ? AND l.is_active = ?
            GROUP BY l.id, l.name, lm.current_elo
            ORDER BY lm.current_elo DESC
        `, [user.id, user.id, user.id, user.id, user.id, true, user.id, true]);
        
        // Calculate rank for each league
        const rankingsWithRank = await Promise.all(leagueRankings.map(async (league) => {
            const rankResult = await database.get(`
                SELECT COUNT(*) + 1 as rank
                FROM league_members lm2
                WHERE lm2.league_id = ? AND lm2.current_elo > ?
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
                    WHEN m.player1_id = ? THEN p2.username
                    ELSE p1.username
                END as opponent_username,
                CASE 
                    WHEN m.winner_id = ? THEN 'W'
                    WHEN m.winner_id IS NOT NULL THEN 'L'
                    ELSE 'D'
                END as result,
                m.played_at,
                CASE 
                    WHEN m.player1_id = ? THEN (m.player1_elo_after - m.player1_elo_before)
                    ELSE (m.player2_elo_after - m.player2_elo_before)
                END as elo_change
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            JOIN users p1 ON m.player1_id = p1.id
            JOIN users p2 ON m.player2_id = p2.id
            WHERE (m.player1_id = ? OR m.player2_id = ?) AND m.is_accepted = ?
            ORDER BY m.played_at DESC
            LIMIT 10
        `, [user.id, user.id, user.id, user.id, user.id, true]);
        
        // Get user's badges (with error handling for missing tables)
        let badges = [];
        try {
            badges = await database.all(`
                SELECT 
                    b.id, b.name, b.description, b.icon, ub.earned_at, ub.league_id,
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
                COUNT(DISTINCT lm.league_id) as leagues_count,
                COUNT(DISTINCT CASE WHEN m.player1_id = ? OR m.player2_id = ? THEN m.id END) as matches_played,
                COUNT(DISTINCT CASE WHEN m.winner_id = ? THEN m.id END) as matches_won
            FROM users u
            LEFT JOIN league_members lm ON u.id = lm.user_id
            LEFT JOIN matches m ON (m.player1_id = ? OR m.player2_id = ?) AND m.is_accepted = ?
            WHERE u.id = ?
        `, [user.id, user.id, user.id, user.id, user.id, true, user.id]);
        
        const winRate = overallStats.matches_played > 0 
            ? Math.round((overallStats.matches_won * 100) / overallStats.matches_played)
            : 0;
        
        res.json({
            user: {
                id: user.id,
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name,
                created_at: user.created_at
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

