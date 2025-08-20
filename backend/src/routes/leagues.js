const express = require('express');
const { authenticateToken, requireAdmin, requireLeagueAdmin, optionalAuth } = require('../middleware/auth');
const { validateLeagueCreation, validateId, validatePagination } = require('../middleware/validation');
const database = require('../models/database');
const crypto = require('crypto');

const router = express.Router();

/**
 * Get all leagues (public + user's leagues)
 * GET /api/leagues
 */
router.get('/', optionalAuth, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                l.id, l.name, l.description, l.is_public, l.season, l.created_at,
                u.username as created_by_username,
                COUNT(DISTINCT lm.user_id) as member_count,
                COUNT(DISTINCT m.id) as match_count
            FROM leagues l
            JOIN users u ON l.created_by = u.id
            LEFT JOIN league_members lm ON l.id = lm.league_id
            LEFT JOIN matches m ON l.id = m.league_id AND m.is_accepted = 1
            WHERE l.is_active = 1
        `;
        
        const params = [];
        
        // If user is authenticated, show their leagues + public leagues
        // If not authenticated, show only public leagues
        if (req.user) {
            query += ` AND (l.is_public = 1 OR lm.user_id = ?)`;
            params.push(req.user.id);
        } else {
            query += ` AND l.is_public = 1`;
        }
        
        query += `
            GROUP BY l.id, l.name, l.description, l.is_public, l.season, l.created_at, u.username
            ORDER BY l.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        params.push(limit, offset);
        
        const leagues = await database.all(query, params);
        
        // Get total count
        let countQuery = `
            SELECT COUNT(DISTINCT l.id) as count
            FROM leagues l
            LEFT JOIN league_members lm ON l.id = lm.league_id
            WHERE l.is_active = 1
        `;
        
        const countParams = [];
        
        if (req.user) {
            countQuery += ` AND (l.is_public = 1 OR lm.user_id = ?)`;
            countParams.push(req.user.id);
        } else {
            countQuery += ` AND l.is_public = 1`;
        }
        
        const totalCount = await database.get(countQuery, countParams);
        
        res.json({
            leagues,
            pagination: {
                page,
                limit,
                total: totalCount.count,
                pages: Math.ceil(totalCount.count / limit)
            }
        });
    } catch (error) {
        console.error('Get leagues error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Create new league (admin only)
 * POST /api/leagues
 */
router.post('/', authenticateToken, requireAdmin, validateLeagueCreation, async (req, res) => {
    try {
        const { name, description, is_public, season } = req.body;
        
        // Check if league name already exists
        const existingLeague = await database.get(
            'SELECT id FROM leagues WHERE name = ? AND is_active = 1',
            [name]
        );
        
        if (existingLeague) {
            return res.status(409).json({ error: 'League name already exists' });
        }
        
        // Create league
        const result = await database.run(
            'INSERT INTO leagues (name, description, is_public, season, created_by) VALUES (?, ?, ?, ?, ?)',
            [name, description || null, is_public || false, season || null, req.user.id]
        );
        
        // Add creator as league admin
        await database.run(
            'INSERT INTO league_members (league_id, user_id, is_admin) VALUES (?, ?, ?)',
            [result.id, req.user.id, true]
        );
        
        // Get created league
        const league = await database.get(`
            SELECT 
                l.id, l.name, l.description, l.is_public, l.season, l.created_at,
                u.username as created_by_username
            FROM leagues l
            JOIN users u ON l.created_by = u.id
            WHERE l.id = ?
        `, [result.id]);
        
        res.status(201).json({
            message: 'League created successfully',
            league
        });
    } catch (error) {
        console.error('Create league error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get league details
 * GET /api/leagues/:id
 */
router.get('/:id', optionalAuth, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        
        const league = await database.get(`
            SELECT 
                l.id, l.name, l.description, l.is_public, l.season, l.created_at,
                u.username as created_by_username,
                COUNT(DISTINCT lm.user_id) as member_count,
                COUNT(DISTINCT m.id) as match_count
            FROM leagues l
            JOIN users u ON l.created_by = u.id
            LEFT JOIN league_members lm ON l.id = lm.league_id
            LEFT JOIN matches m ON l.id = m.league_id AND m.is_accepted = 1
            WHERE l.id = ? AND l.is_active = 1
            GROUP BY l.id, l.name, l.description, l.is_public, l.season, l.created_at, u.username
        `, [leagueId]);
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        // Check if user has access to this league
        if (!league.is_public && req.user) {
            const membership = await database.get(
                'SELECT id FROM league_members WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            
            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        } else if (!league.is_public && !req.user) {
            return res.status(403).json({ error: 'Access denied to private league' });
        }
        
        // Get user's membership status if authenticated
        let userMembership = null;
        if (req.user) {
            userMembership = await database.get(
                'SELECT current_elo, is_admin, joined_at FROM league_members WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
        }
        
        res.json({
            league,
            user_membership: userMembership
        });
    } catch (error) {
        console.error('Get league error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Update league (league admin only)
 * PUT /api/leagues/:id
 */
router.put('/:id', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const { name, description, is_public, season } = req.body;
        
        const updates = [];
        const values = [];
        
        if (name !== undefined) {
            // Check if new name already exists
            const existingLeague = await database.get(
                'SELECT id FROM leagues WHERE name = ? AND id != ? AND is_active = 1',
                [name, leagueId]
            );
            
            if (existingLeague) {
                return res.status(409).json({ error: 'League name already exists' });
            }
            
            updates.push('name = ?');
            values.push(name.trim());
        }
        
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description ? description.trim() : null);
        }
        
        if (is_public !== undefined) {
            updates.push('is_public = ?');
            values.push(is_public);
        }
        
        if (season !== undefined) {
            updates.push('season = ?');
            values.push(season ? season.trim() : null);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(leagueId);
        
        await database.run(
            `UPDATE leagues SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        // Get updated league
        const updatedLeague = await database.get(`
            SELECT 
                l.id, l.name, l.description, l.is_public, l.season, l.created_at, l.updated_at,
                u.username as created_by_username
            FROM leagues l
            JOIN users u ON l.created_by = u.id
            WHERE l.id = ?
        `, [leagueId]);
        
        res.json({
            message: 'League updated successfully',
            league: updatedLeague
        });
    } catch (error) {
        console.error('Update league error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Delete league (league admin only)
 * DELETE /api/leagues/:id
 */
router.delete('/:id', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        
        const league = await database.get('SELECT name FROM leagues WHERE id = ?', [leagueId]);
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        // Soft delete - mark as inactive
        await database.run('UPDATE leagues SET is_active = 0 WHERE id = ?', [leagueId]);
        
        res.json({ message: `League ${league.name} deleted successfully` });
    } catch (error) {
        console.error('Delete league error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get league members
 * GET /api/leagues/:id/members
 */
router.get('/:id/members', authenticateToken, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        
        // Check if user has access to this league
        const league = await database.get('SELECT is_public FROM leagues WHERE id = ? AND is_active = 1', [leagueId]);
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        if (!league.is_public) {
            const membership = await database.get(
                'SELECT id FROM league_members WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            
            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        }
        
        const members = await database.all(`
            SELECT 
                u.id, u.username, u.first_name, u.last_name,
                lm.current_elo, lm.is_admin as is_league_admin, lm.joined_at,
                COUNT(CASE WHEN m.player1_id = u.id OR m.player2_id = u.id THEN m.id END) as matches_played,
                COUNT(CASE WHEN m.winner_id = u.id THEN m.id END) as matches_won
            FROM league_members lm
            JOIN users u ON lm.user_id = u.id
            LEFT JOIN matches m ON m.league_id = lm.league_id AND (m.player1_id = u.id OR m.player2_id = u.id) AND m.is_accepted = 1
            WHERE lm.league_id = ?
            GROUP BY u.id, u.username, u.first_name, u.last_name, lm.current_elo, lm.is_admin, lm.joined_at
            ORDER BY lm.current_elo DESC
        `, [leagueId]);
        
        res.json({
            members: members.map(member => ({
                ...member,
                win_rate: member.matches_played > 0 ? 
                    Math.round((member.matches_won / member.matches_played) * 100) : 0
            }))
        });
    } catch (error) {
        console.error('Get league members error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Invite user to league (league admin only)
 * POST /api/leagues/:id/invite
 */
router.post('/:id/invite', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const { user_id, username } = req.body;
        
        let targetUserId = user_id;
        
        // If username provided instead of user_id, look up the user
        if (!targetUserId && username) {
            const user = await database.get('SELECT id FROM users WHERE username = ?', [username]);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            targetUserId = user.id;
        }
        
        if (!targetUserId) {
            return res.status(400).json({ error: 'User ID or username required' });
        }
        
        // Check if user is already a member
        const existingMember = await database.get(
            'SELECT id FROM league_members WHERE league_id = ? AND user_id = ?',
            [leagueId, targetUserId]
        );
        
        if (existingMember) {
            return res.status(409).json({ error: 'User is already a member of this league' });
        }
        
        // Check if there's already a pending invite
        const existingInvite = await database.get(
            'SELECT id FROM league_invites WHERE league_id = ? AND invited_user_id = ? AND status = "pending"',
            [leagueId, targetUserId]
        );
        
        if (existingInvite) {
            return res.status(409).json({ error: 'User already has a pending invite to this league' });
        }
        
        // Generate invite code
        const inviteCode = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        
        // Create invite
        await database.run(
            'INSERT INTO league_invites (league_id, invited_user_id, invited_by, invite_code, expires_at) VALUES (?, ?, ?, ?, ?)',
            [leagueId, targetUserId, req.user.id, inviteCode, expiresAt.toISOString()]
        );
        
        // Create notification
        const league = await database.get('SELECT name FROM leagues WHERE id = ?', [leagueId]);
        await database.run(
            'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
            [
                targetUserId,
                'league_invite',
                'League Invitation',
                `You have been invited to join the league "${league.name}"`,
                leagueId
            ]
        );
        
        res.json({
            message: 'User invited successfully',
            invite_code: inviteCode,
            expires_at: expiresAt.toISOString()
        });
    } catch (error) {
        console.error('Invite user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Join league (with invite code)
 * POST /api/leagues/:id/join
 */
router.post('/:id/join', authenticateToken, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const { invite_code } = req.body;
        
        if (!invite_code) {
            return res.status(400).json({ error: 'Invite code required' });
        }
        
        // Check if user is already a member
        const existingMember = await database.get(
            'SELECT id FROM league_members WHERE league_id = ? AND user_id = ?',
            [leagueId, req.user.id]
        );
        
        if (existingMember) {
            return res.status(409).json({ error: 'You are already a member of this league' });
        }
        
        // Find and validate invite
        const invite = await database.get(
            'SELECT id, expires_at FROM league_invites WHERE league_id = ? AND invited_user_id = ? AND invite_code = ? AND status = "pending"',
            [leagueId, req.user.id, invite_code]
        );
        
        if (!invite) {
            return res.status(404).json({ error: 'Invalid or expired invite code' });
        }
        
        // Check if invite has expired
        if (new Date(invite.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invite code has expired' });
        }
        
        // Add user to league
        await database.run(
            'INSERT INTO league_members (league_id, user_id) VALUES (?, ?)',
            [leagueId, req.user.id]
        );
        
        // Update invite status
        await database.run(
            'UPDATE league_invites SET status = "accepted", responded_at = CURRENT_TIMESTAMP WHERE id = ?',
            [invite.id]
        );
        
        // Get league info
        const league = await database.get('SELECT name FROM leagues WHERE id = ?', [leagueId]);
        
        res.json({
            message: `Successfully joined league "${league.name}"`,
            current_elo: 1200
        });
    } catch (error) {
        console.error('Join league error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Leave league
 * DELETE /api/leagues/:id/leave
 */
router.delete('/:id/leave', authenticateToken, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        
        const membership = await database.get(
            'SELECT id FROM league_members WHERE league_id = ? AND user_id = ?',
            [leagueId, req.user.id]
        );
        
        if (!membership) {
            return res.status(404).json({ error: 'You are not a member of this league' });
        }
        
        // Remove user from league
        await database.run(
            'DELETE FROM league_members WHERE league_id = ? AND user_id = ?',
            [leagueId, req.user.id]
        );
        
        const league = await database.get('SELECT name FROM leagues WHERE id = ?', [leagueId]);
        
        res.json({ message: `Successfully left league "${league.name}"` });
    } catch (error) {
        console.error('Leave league error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get league leaderboard
 * GET /api/leagues/:id/leaderboard
 */
router.get('/:id/leaderboard', optionalAuth, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        
        // Check if user has access to this league
        const league = await database.get('SELECT is_public FROM leagues WHERE id = ? AND is_active = 1', [leagueId]);
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        if (!league.is_public && req.user) {
            const membership = await database.get(
                'SELECT id FROM league_members WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            
            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        } else if (!league.is_public && !req.user) {
            return res.status(403).json({ error: 'Access denied to private league' });
        }
        
        const leaderboard = await database.all(`
            SELECT 
                u.id, u.username, u.first_name, u.last_name,
                lm.current_elo, lm.joined_at,
                COUNT(CASE WHEN m.player1_id = u.id OR m.player2_id = u.id THEN m.id END) as matches_played,
                COUNT(CASE WHEN m.winner_id = u.id THEN m.id END) as matches_won,
                ROW_NUMBER() OVER (ORDER BY lm.current_elo DESC) as rank
            FROM league_members lm
            JOIN users u ON lm.user_id = u.id
            LEFT JOIN matches m ON m.league_id = lm.league_id AND (m.player1_id = u.id OR m.player2_id = u.id) AND m.is_accepted = 1
            WHERE lm.league_id = ?
            GROUP BY u.id, u.username, u.first_name, u.last_name, lm.current_elo, lm.joined_at
            ORDER BY lm.current_elo DESC
        `, [leagueId]);
        
        res.json({
            leaderboard: leaderboard.map(player => ({
                ...player,
                win_rate: player.matches_played > 0 ? 
                    Math.round((player.matches_won / player.matches_played) * 100) : 0
            }))
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get league matches
 * GET /api/leagues/:id/matches
 */
router.get('/:id/matches', optionalAuth, validateId, validatePagination, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        // Check if user has access to this league
        const league = await database.get('SELECT is_public FROM leagues WHERE id = ? AND is_active = 1', [leagueId]);
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        if (!league.is_public && req.user) {
            const membership = await database.get(
                'SELECT id FROM league_members WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            
            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        } else if (!league.is_public && !req.user) {
            return res.status(403).json({ error: 'Access denied to private league' });
        }
        
        const matches = await database.all(`
            SELECT 
                m.id, m.player1_sets_won, m.player2_sets_won, m.player1_points_total, m.player2_points_total,
                m.game_type, m.winner_id, m.is_accepted, m.played_at,
                p1.username as player1_username, p1.first_name as player1_first_name, p1.last_name as player1_last_name,
                p2.username as player2_username, p2.first_name as player2_first_name, p2.last_name as player2_last_name,
                m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after
            FROM matches m
            JOIN users p1 ON m.player1_id = p1.id
            JOIN users p2 ON m.player2_id = p2.id
            WHERE m.league_id = ? AND m.is_accepted = 1
            ORDER BY m.played_at DESC
            LIMIT ? OFFSET ?
        `, [leagueId, limit, offset]);
        
        const totalCount = await database.get(
            'SELECT COUNT(*) as count FROM matches WHERE league_id = ? AND is_accepted = 1',
            [leagueId]
        );
        
        res.json({
            matches,
            pagination: {
                page,
                limit,
                total: totalCount.count,
                pages: Math.ceil(totalCount.count / limit)
            }
        });
    } catch (error) {
        console.error('Get league matches error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

