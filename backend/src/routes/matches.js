const express = require('express');
const { authenticateToken, requireAdmin, requireLeagueAdmin } = require('../middleware/auth');
const { validateMatchCreation, validateId, validatePagination } = require('../middleware/validation');
const { calculateNewElos, validateMatchResult, determineGameType, previewEloChange } = require('../utils/eloCalculator');
const database = require('../models/database');

const router = express.Router();

/**
 * Get user's matches
 * GET /api/matches
 */
router.get('/', authenticateToken, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status; // 'pending', 'accepted', 'all'
        
        let whereClause = '(m.player1_id = ? OR m.player2_id = ?)';
        const params = [req.user.id, req.user.id];
        
        if (status === 'pending') {
            whereClause += ' AND m.is_accepted = ?';
            params.push(false);
        } else if (status === 'accepted') {
            whereClause += ' AND m.is_accepted = ?';
            params.push(true);
        }
        
        const matches = await database.all(`
            SELECT 
                m.id, m.league_id, m.player1_sets_won, m.player2_sets_won, 
                m.player1_points_total, m.player2_points_total, m.game_type, 
                m.winner_id, m.is_accepted, m.played_at, m.created_at,
                m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after,
                l.name as league_name,
                p1.username as player1_username, p1.first_name as player1_first_name, p1.last_name as player1_last_name,
                p2.username as player2_username, p2.first_name as player2_first_name, p2.last_name as player2_last_name,
                accepter.username as accepted_by_username
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            JOIN users p1 ON m.player1_id = p1.id
            JOIN users p2 ON m.player2_id = p2.id
            LEFT JOIN users accepter ON m.accepted_by = accepter.id
            WHERE ${whereClause}
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        
        const totalCount = await database.get(
            `SELECT COUNT(*) as count FROM matches m WHERE ${whereClause}`,
            params
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
        console.error('Get matches error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Create new match
 * POST /api/matches
 */
router.post('/', authenticateToken, validateMatchCreation, async (req, res) => {
    try {
        const {
            league_id,
            player2_id,
            player1_sets_won,
            player2_sets_won,
            player1_points_total,
            player2_points_total,
            game_type,
            sets
        } = req.body;
        
        // Check if user is member of the league
        const membership = await database.get(
            'SELECT current_elo FROM league_members WHERE league_id = ? AND user_id = ?',
            [league_id, req.user.id]
        );
        
        if (!membership) {
            return res.status(403).json({ error: 'You are not a member of this league' });
        }
        
        // Check if opponent is member of the league
        const opponentMembership = await database.get(
            'SELECT current_elo FROM league_members WHERE league_id = ? AND user_id = ?',
            [league_id, player2_id]
        );
        
        if (!opponentMembership) {
            return res.status(400).json({ error: 'Opponent is not a member of this league' });
        }
        
        // Validate match result
        const validation = validateMatchResult(player1_sets_won, player2_sets_won, game_type);
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.error });
        }
        
        // Determine winner
        const winnerId = player1_sets_won > player2_sets_won ? req.user.id : player2_id;
        
        // Get current ELO ratings
        const player1Elo = membership.current_elo;
        const player2Elo = opponentMembership.current_elo;
        
        // Calculate new ELO ratings (preview)
        const eloResult = calculateNewElos(
            player1Elo,
            player2Elo,
            player1_points_total,
            player2_points_total,
            player1_sets_won > player2_sets_won,
            player1_sets_won,
            player2_sets_won
        );
        
        // Start transaction
        await database.beginTransaction();
        
        try {
            // Create match
            const matchResult = await database.run(`
                INSERT INTO matches (
                    league_id, player1_id, player2_id, player1_sets_won, player2_sets_won,
                    player1_points_total, player2_points_total, game_type, winner_id,
                    player1_elo_before, player2_elo_before, player1_elo_after, player2_elo_after
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                league_id, req.user.id, player2_id, player1_sets_won, player2_sets_won,
                player1_points_total, player2_points_total, game_type, winnerId,
                player1Elo, player2Elo, eloResult.newRating1, eloResult.newRating2
            ]);
            
            // Create match sets if provided
            if (sets && sets.length > 0) {
                for (let i = 0; i < sets.length; i++) {
                    await database.run(
                        'INSERT INTO match_sets (match_id, set_number, player1_score, player2_score) VALUES (?, ?, ?, ?)',
                        [matchResult.id, i + 1, sets[i].player1_score, sets[i].player2_score]
                    );
                }
            }
            
            // Create notification for opponent
            const league = await database.get('SELECT name FROM leagues WHERE id = ?', [league_id]);
            await database.run(
                'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                [
                    player2_id,
                    'match_request',
                    'New Match Result',
                    `${req.user.username} has submitted a match result in "${league.name}"`,
                    matchResult.id
                ]
            );
            
            await database.commit();
            
            // Get created match with details
            const match = await database.get(`
                SELECT 
                    m.id, m.league_id, m.player1_sets_won, m.player2_sets_won, 
                    m.player1_points_total, m.player2_points_total, m.game_type, 
                    m.winner_id, m.is_accepted, m.played_at, m.created_at,
                    m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after,
                    l.name as league_name,
                    p1.username as player1_username,
                    p2.username as player2_username
                FROM matches m
                JOIN leagues l ON m.league_id = l.id
                JOIN users p1 ON m.player1_id = p1.id
                JOIN users p2 ON m.player2_id = p2.id
                WHERE m.id = ?
            `, [matchResult.id]);
            
            res.status(201).json({
                message: 'Match created successfully. Waiting for admin approval.',
                match,
                elo_preview: {
                    player1_change: eloResult.newRating1 - player1Elo,
                    player2_change: eloResult.newRating2 - player2Elo
                }
            });
        } catch (error) {
            await database.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Create match error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get pending matches (admin only)
 * GET /api/matches/pending
 */
router.get('/pending', authenticateToken, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        let whereClause = 'm.is_accepted = ?';
        const params = [false];
        
        // If not global admin, filter by leagues where user is league admin
        if (!req.user.is_admin) {
            whereClause += ' AND EXISTS (SELECT 1 FROM league_members lm WHERE lm.league_id = m.league_id AND lm.user_id = ? AND lm.is_admin = ?)';
            params.push(req.user.id, true);
        }
        
        const matches = await database.all(`
            SELECT 
                m.id, m.league_id, m.player1_sets_won, m.player2_sets_won, 
                m.player1_points_total, m.player2_points_total, m.game_type, 
                m.winner_id, m.played_at, m.created_at,
                m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after,
                l.name as league_name,
                p1.username as player1_username, p1.first_name as player1_first_name, p1.last_name as player1_last_name,
                p2.username as player2_username, p2.first_name as player2_first_name, p2.last_name as player2_last_name
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            JOIN users p1 ON m.player1_id = p1.id
            JOIN users p2 ON m.player2_id = p2.id
            WHERE ${whereClause}
            ORDER BY m.created_at ASC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        
        const totalCount = await database.get(
            `SELECT COUNT(*) as count FROM matches m WHERE ${whereClause}`,
            params
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
        console.error('Get pending matches error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Preview ELO changes for a potential match
 * POST /api/matches/preview-elo
 */
router.post('/preview-elo', authenticateToken, async (req, res) => {
    try {
        const {
            league_id,
            player2_id,
            player1_sets_won,
            player2_sets_won,
            player1_points_total,
            player2_points_total
        } = req.body;
        
        // Get current ELO ratings
        const player1Membership = await database.get(
            'SELECT current_elo FROM league_members WHERE league_id = ? AND user_id = ?',
            [league_id, req.user.id]
        );
        
        const player2Membership = await database.get(
            'SELECT current_elo FROM league_members WHERE league_id = ? AND user_id = ?',
            [league_id, player2_id]
        );
        
        if (!player1Membership || !player2Membership) {
            return res.status(400).json({ error: 'One or both players are not members of this league' });
        }
        
        const eloResult = calculateNewElos(
            player1Membership.current_elo,
            player2Membership.current_elo,
            player1_points_total || 0,
            player2_points_total || 0,
            player1_sets_won > player2_sets_won,
            player1_sets_won,
            player2_sets_won
        );
        
        res.json({
            current_elos: {
                player1: player1Membership.current_elo,
                player2: player2Membership.current_elo
            },
            new_elos: {
                player1: eloResult.newRating1,
                player2: eloResult.newRating2
            },
            changes: {
                player1: eloResult.newRating1 - player1Membership.current_elo,
                player2: eloResult.newRating2 - player2Membership.current_elo
            },
            calculation_details: {
                expected_score_player1: eloResult.expectedScore1,
                points_factor: eloResult.pointsFactor,
                format_multiplier: eloResult.formatMultiplier
            }
        });
    } catch (error) {
        console.error('Preview ELO error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get match details
 * GET /api/matches/:id
 */
router.get('/:id', authenticateToken, validateId, async (req, res) => {
    try {
        const matchId = parseInt(req.params.id);
        
        const match = await database.get(`
            SELECT 
                m.id, m.league_id, m.player1_sets_won, m.player2_sets_won, 
                m.player1_points_total, m.player2_points_total, m.game_type, 
                m.winner_id, m.is_accepted, m.played_at, m.created_at,
                m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after,
                l.name as league_name,
                p1.id as player1_id, p1.username as player1_username, p1.first_name as player1_first_name, p1.last_name as player1_last_name,
                p2.id as player2_id, p2.username as player2_username, p2.first_name as player2_first_name, p2.last_name as player2_last_name,
                accepter.username as accepted_by_username
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            JOIN users p1 ON m.player1_id = p1.id
            JOIN users p2 ON m.player2_id = p2.id
            LEFT JOIN users accepter ON m.accepted_by = accepter.id
            WHERE m.id = ?
        `, [matchId]);
        
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        // Check if user has access to this match
        if (match.player1_id !== req.user.id && match.player2_id !== req.user.id && !req.user.is_admin) {
            // Check if user is league admin
            const leagueAdmin = await database.get(
                'SELECT is_admin FROM league_members WHERE league_id = ? AND user_id = ?',
                [match.league_id, req.user.id]
            );
            
            if (!leagueAdmin || !leagueAdmin.is_admin) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        
        // Get match sets
        const sets = await database.all(
            'SELECT set_number, player1_score, player2_score FROM match_sets WHERE match_id = ? ORDER BY set_number',
            [matchId]
        );
        
        res.json({
            match,
            sets
        });
    } catch (error) {
        console.error('Get match error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Update match (players only, before acceptance)
 * PUT /api/matches/:id
 */
router.put('/:id', authenticateToken, validateId, async (req, res) => {
    try {
        const matchId = parseInt(req.params.id);
        const {
            player1_sets_won,
            player2_sets_won,
            player1_points_total,
            player2_points_total,
            game_type,
            sets
        } = req.body;
        
        const match = await database.get(
            'SELECT player1_id, player2_id, is_accepted, league_id FROM matches WHERE id = ?',
            [matchId]
        );
        
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        if (match.is_accepted) {
            return res.status(400).json({ error: 'Cannot update accepted match' });
        }
        
        // Only players involved can update the match
        if (match.player1_id !== req.user.id && match.player2_id !== req.user.id) {
            return res.status(403).json({ error: 'Only match participants can update the match' });
        }
        
        // Validate match result if provided
        if (player1_sets_won !== undefined && player2_sets_won !== undefined && game_type) {
            const validation = validateMatchResult(player1_sets_won, player2_sets_won, game_type);
            if (!validation.isValid) {
                return res.status(400).json({ error: validation.error });
            }
        }
        
        const updates = [];
        const values = [];
        
        if (player1_sets_won !== undefined) {
            updates.push('player1_sets_won = ?');
            values.push(player1_sets_won);
        }
        
        if (player2_sets_won !== undefined) {
            updates.push('player2_sets_won = ?');
            values.push(player2_sets_won);
        }
        
        if (player1_points_total !== undefined) {
            updates.push('player1_points_total = ?');
            values.push(player1_points_total);
        }
        
        if (player2_points_total !== undefined) {
            updates.push('player2_points_total = ?');
            values.push(player2_points_total);
        }
        
        if (game_type !== undefined) {
            updates.push('game_type = ?');
            values.push(game_type);
        }
        
        // Recalculate winner and ELO if sets are updated
        if (player1_sets_won !== undefined && player2_sets_won !== undefined) {
            const winnerId = player1_sets_won > player2_sets_won ? match.player1_id : match.player2_id;
            updates.push('winner_id = ?');
            values.push(winnerId);
            
            // Get current ELO ratings and recalculate
            const player1Membership = await database.get(
                'SELECT current_elo FROM league_members WHERE league_id = ? AND user_id = ?',
                [match.league_id, match.player1_id]
            );
            
            const player2Membership = await database.get(
                'SELECT current_elo FROM league_members WHERE league_id = ? AND user_id = ?',
                [match.league_id, match.player2_id]
            );
            
            const eloResult = calculateNewElos(
                player1Membership.current_elo,
                player2Membership.current_elo,
                player1_points_total || 0,
                player2_points_total || 0,
                player1_sets_won > player2_sets_won,
                player1_sets_won,
                player2_sets_won
            );
            
            updates.push('player1_elo_after = ?', 'player2_elo_after = ?');
            values.push(eloResult.newRating1, eloResult.newRating2);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        values.push(matchId);
        
        await database.run(
            `UPDATE matches SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        // Update match sets if provided
        if (sets && sets.length > 0) {
            // Delete existing sets
            await database.run('DELETE FROM match_sets WHERE match_id = ?', [matchId]);
            
            // Insert new sets
            for (let i = 0; i < sets.length; i++) {
                await database.run(
                    'INSERT INTO match_sets (match_id, set_number, player1_score, player2_score) VALUES (?, ?, ?, ?)',
                    [matchId, i + 1, sets[i].player1_score, sets[i].player2_score]
                );
            }
        }
        
        res.json({ message: 'Match updated successfully' });
    } catch (error) {
        console.error('Update match error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Delete match (admin only)
 * DELETE /api/matches/:id
 */
router.delete('/:id', authenticateToken, requireAdmin, validateId, async (req, res) => {
    try {
        const matchId = parseInt(req.params.id);
        
        const match = await database.get(
            'SELECT id, is_accepted FROM matches WHERE id = ?',
            [matchId]
        );
        
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        if (match.is_accepted) {
            return res.status(400).json({ error: 'Cannot delete accepted match. Contact system administrator.' });
        }
        
        await database.run('DELETE FROM matches WHERE id = ?', [matchId]);
        
        res.json({ message: 'Match deleted successfully' });
    } catch (error) {
        console.error('Delete match error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Accept match (admin only)
 * POST /api/matches/:id/accept
 */
router.post('/:id/accept', authenticateToken, validateId, async (req, res) => {
    try {
        const matchId = parseInt(req.params.id);
        
        const match = await database.get(`
            SELECT 
                m.id, m.league_id, m.player1_id, m.player2_id, m.is_accepted,
                m.player1_elo_after, m.player2_elo_after
            FROM matches m
            WHERE m.id = ?
        `, [matchId]);
        
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        if (match.is_accepted) {
            return res.status(400).json({ error: 'Match is already accepted' });
        }
        
        // Check if user is admin or league admin
        if (!req.user.is_admin) {
            const leagueAdmin = await database.get(
                'SELECT is_admin FROM league_members WHERE league_id = ? AND user_id = ?',
                [match.league_id, req.user.id]
            );
            
            if (!leagueAdmin || !leagueAdmin.is_admin) {
                return res.status(403).json({ error: 'League admin access required' });
            }
        }
        
        // Start transaction
        await database.beginTransaction();
        
        try {
            // Accept match
            await database.run(
                'UPDATE matches SET is_accepted = ?, accepted_by = ?, accepted_at = CURRENT_TIMESTAMP WHERE id = ?',
                [true, req.user.id, matchId]
            );
            
            // Update player ELO ratings
            await database.run(
                'UPDATE league_members SET current_elo = ? WHERE league_id = ? AND user_id = ?',
                [match.player1_elo_after, match.league_id, match.player1_id]
            );
            
            await database.run(
                'UPDATE league_members SET current_elo = ? WHERE league_id = ? AND user_id = ?',
                [match.player2_elo_after, match.league_id, match.player2_id]
            );
            
            // Record ELO history
            const player1EloChange = match.player1_elo_after - (await database.get(
                'SELECT player1_elo_before FROM matches WHERE id = ?', [matchId]
            )).player1_elo_before;
            
            const player2EloChange = match.player2_elo_after - (await database.get(
                'SELECT player2_elo_before FROM matches WHERE id = ?', [matchId]
            )).player2_elo_before;
            
            await database.run(
                'INSERT INTO elo_history (user_id, league_id, match_id, elo_before, elo_after, elo_change) VALUES (?, ?, ?, ?, ?, ?)',
                [match.player1_id, match.league_id, matchId, match.player1_elo_before, match.player1_elo_after, player1EloChange]
            );
            
            await database.run(
                'INSERT INTO elo_history (user_id, league_id, match_id, elo_before, elo_after, elo_change) VALUES (?, ?, ?, ?, ?, ?)',
                [match.player2_id, match.league_id, matchId, match.player2_elo_before, match.player2_elo_after, player2EloChange]
            );
            
            // Create notifications for both players
            const league = await database.get('SELECT name FROM leagues WHERE id = ?', [match.league_id]);
            
            await database.run(
                'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                [
                    match.player1_id,
                    'match_accepted',
                    'Match Accepted',
                    `Your match result in "${league.name}" has been accepted. ELO change: ${player1EloChange > 0 ? '+' : ''}${player1EloChange}`,
                    matchId
                ]
            );
            
            await database.run(
                'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                [
                    match.player2_id,
                    'match_accepted',
                    'Match Accepted',
                    `Your match result in "${league.name}" has been accepted. ELO change: ${player2EloChange > 0 ? '+' : ''}${player2EloChange}`,
                    matchId
                ]
            );
            
            await database.commit();
            
            res.json({
                message: 'Match accepted successfully',
                elo_changes: {
                    player1_change: player1EloChange,
                    player2_change: player2EloChange
                }
            });
        } catch (error) {
            await database.rollback();
            throw error;
        }
    } catch (error) {
        console.error('Accept match error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Reject match (admin only)
 * POST /api/matches/:id/reject
 */
router.post('/:id/reject', authenticateToken, validateId, async (req, res) => {
    try {
        const matchId = parseInt(req.params.id);
        const { reason } = req.body;
        
        const match = await database.get(
            'SELECT league_id, player1_id, player2_id, is_accepted FROM matches WHERE id = ?',
            [matchId]
        );
        
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        if (match.is_accepted) {
            return res.status(400).json({ error: 'Cannot reject accepted match' });
        }
        
        // Check if user is admin or league admin
        if (!req.user.is_admin) {
            const leagueAdmin = await database.get(
                'SELECT is_admin FROM league_members WHERE league_id = ? AND user_id = ?',
                [match.league_id, req.user.id]
            );
            
            if (!leagueAdmin || !leagueAdmin.is_admin) {
                return res.status(403).json({ error: 'League admin access required' });
            }
        }
        
        // Delete the match
        await database.run('DELETE FROM matches WHERE id = ?', [matchId]);
        
        // Create notifications for both players
        const league = await database.get('SELECT name FROM leagues WHERE id = ?', [match.league_id]);
        const rejectionMessage = `Your match result in "${league.name}" has been rejected${reason ? ': ' + reason : ''}`;
        
        await database.run(
            'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
            [match.player1_id, 'match_rejected', 'Match Rejected', rejectionMessage]
        );
        
        await database.run(
            'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
            [match.player2_id, 'match_rejected', 'Match Rejected', rejectionMessage]
        );
        
        res.json({ message: 'Match rejected successfully' });
    } catch (error) {
        console.error('Reject match error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get pending matches (admin only)
 * GET /api/matches/pending
 */
router.get('/pending', authenticateToken, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
        let whereClause = 'm.is_accepted = ?';
        const params = [false];
        
        // If not global admin, filter by leagues where user is league admin
        if (!req.user.is_admin) {
            whereClause += ' AND EXISTS (SELECT 1 FROM league_members lm WHERE lm.league_id = m.league_id AND lm.user_id = ? AND lm.is_admin = ?)';
            params.push(req.user.id, true);
        }
        
        const matches = await database.all(`
            SELECT 
                m.id, m.league_id, m.player1_sets_won, m.player2_sets_won, 
                m.player1_points_total, m.player2_points_total, m.game_type, 
                m.winner_id, m.played_at, m.created_at,
                m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after,
                l.name as league_name,
                p1.username as player1_username, p1.first_name as player1_first_name, p1.last_name as player1_last_name,
                p2.username as player2_username, p2.first_name as player2_first_name, p2.last_name as player2_last_name
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            JOIN users p1 ON m.player1_id = p1.id
            JOIN users p2 ON m.player2_id = p2.id
            WHERE ${whereClause}
            ORDER BY m.created_at ASC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        
        const totalCount = await database.get(
            `SELECT COUNT(*) as count FROM matches m WHERE ${whereClause}`,
            params
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
        console.error('Get pending matches error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Preview ELO changes for a potential match
 * POST /api/matches/preview-elo
 */
router.post('/preview-elo', authenticateToken, async (req, res) => {
    try {
        const {
            league_id,
            player2_id,
            player1_sets_won,
            player2_sets_won,
            player1_points_total,
            player2_points_total
        } = req.body;
        
        // Get current ELO ratings
        const player1Membership = await database.get(
            'SELECT current_elo FROM league_members WHERE league_id = ? AND user_id = ?',
            [league_id, req.user.id]
        );
        
        const player2Membership = await database.get(
            'SELECT current_elo FROM league_members WHERE league_id = ? AND user_id = ?',
            [league_id, player2_id]
        );
        
        if (!player1Membership || !player2Membership) {
            return res.status(400).json({ error: 'One or both players are not members of this league' });
        }
        
        const eloResult = calculateNewElos(
            player1Membership.current_elo,
            player2Membership.current_elo,
            player1_points_total || 0,
            player2_points_total || 0,
            player1_sets_won > player2_sets_won,
            player1_sets_won,
            player2_sets_won
        );
        
        res.json({
            current_elos: {
                player1: player1Membership.current_elo,
                player2: player2Membership.current_elo
            },
            new_elos: {
                player1: eloResult.newRating1,
                player2: eloResult.newRating2
            },
            changes: {
                player1: eloResult.newRating1 - player1Membership.current_elo,
                player2: eloResult.newRating2 - player2Membership.current_elo
            },
            calculation_details: {
                expected_score_player1: eloResult.expectedScore1,
                points_factor: eloResult.pointsFactor,
                format_multiplier: eloResult.formatMultiplier
            }
        });
    } catch (error) {
        console.error('Preview ELO error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

