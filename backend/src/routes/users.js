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

module.exports = router;

