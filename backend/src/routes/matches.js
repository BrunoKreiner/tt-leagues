const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateMatchCreation, validateId, validatePagination } = require('../middleware/validation');
const { calculateNewElos, validateMatchResult } = require('../utils/eloCalculator');
const database = require('../models/database');

const router = express.Router();

async function getRosterByUser(leagueId, userId, tx = database) {
    return tx.get(
        'SELECT id, user_id, display_name, current_elo, is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
        [leagueId, userId]
    );
}

async function getRosterById(leagueId, rosterId, tx = database) {
    return tx.get(
        'SELECT id, user_id, display_name, current_elo, is_admin FROM league_roster WHERE league_id = ? AND id = ?',
        [leagueId, rosterId]
    );
}

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

        // Visibility rules:
        // - Any user may see their own matches.
        // - League admins may also see matches in leagues they admin.
        // - Site admins may see all matches.
        //
        // We use match-level player IDs which are always populated for user-owned visibility.
        let whereClause = '(m.player1_id = ? OR m.player2_id = ?)';
        const params = [req.user.id, req.user.id];

        if (req.user.is_admin) {
            whereClause = '1 = 1';
            params.length = 0;
        } else {
            // Add league-admin visibility
            whereClause = `(${whereClause} OR EXISTS (
                SELECT 1 FROM league_roster lr
                WHERE lr.league_id = m.league_id AND lr.user_id = ? AND lr.is_admin = ?
            ))`;
            params.push(req.user.id, true);
        }

        if (status === 'pending') {
            whereClause += ' AND m.is_accepted = ?';
            params.push(false);
        } else if (status === 'accepted') {
            whereClause += ' AND m.is_accepted = ?';
            params.push(true);
        }

        const matches = await database.all(`
            SELECT 
                m.id, m.league_id,
                m.player1_roster_id, m.player2_roster_id, m.winner_roster_id,
                m.player1_id, m.player2_id, m.winner_id,
                m.player1_sets_won, m.player2_sets_won,
                m.player1_points_total, m.player2_points_total,
                m.game_type, m.is_accepted, m.elo_applied, m.elo_applied_at, m.played_at, m.created_at,
                m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after,
                l.name as league_name,
                COALESCE(r1.display_name, u1_fallback.username) as player1_display_name,
                COALESCE(r2.display_name, u2_fallback.username) as player2_display_name,
                COALESCE(u1.id, m.player1_id) as player1_user_id, 
                COALESCE(u1.username, u1_fallback.username) as player1_username,
                COALESCE(u2.id, m.player2_id) as player2_user_id, 
                COALESCE(u2.username, u2_fallback.username) as player2_username,
                accepter.username as accepted_by_username
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            LEFT JOIN league_roster r1 ON m.player1_roster_id = r1.id
            LEFT JOIN league_roster r2 ON m.player2_roster_id = r2.id
            LEFT JOIN users u1 ON r1.user_id = u1.id
            LEFT JOIN users u2 ON r2.user_id = u2.id
            LEFT JOIN users u1_fallback ON m.player1_id = u1_fallback.id
            LEFT JOIN users u2_fallback ON m.player2_id = u2_fallback.id
            LEFT JOIN users accepter ON m.accepted_by = accepter.id
            WHERE ${whereClause}
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        const totalCount = await database.get(
            `SELECT COUNT(*) as count
             FROM matches m
             WHERE ${whereClause}`,
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
            player2_roster_id,
            player1_sets_won,
            player2_sets_won,
            player1_points_total,
            player2_points_total,
            game_type,
            sets,
            played_at
        } = req.body;

        const player1Roster = await getRosterByUser(league_id, req.user.id);
        if (!player1Roster) {
            return res.status(403).json({ error: 'You are not a member of this league' });
        }

        const player2Roster = await getRosterById(league_id, player2_roster_id);
        if (!player2Roster) {
            return res.status(400).json({ error: 'Opponent is not a roster member of this league' });
        }

        // Validate match result
        const validation = validateMatchResult(player1_sets_won, player2_sets_won, game_type);
        if (!validation.isValid) {
            return res.status(400).json({ error: validation.error });
        }

        // Determine winner (roster)
        const didP1Win = player1_sets_won > player2_sets_won;
        const winnerRosterId = didP1Win ? player1Roster.id : player2Roster.id;
        const winnerUserId = didP1Win ? req.user.id : (player2Roster.user_id || null);

        // Current ELO ratings
        const player1Elo = player1Roster.current_elo;
        const player2Elo = player2Roster.current_elo;

        const eloResult = calculateNewElos(
            player1Elo,
            player2Elo,
            player1_points_total,
            player2_points_total,
            didP1Win,
            player1_sets_won,
            player2_sets_won
        );

        const txResult = await database.withTransaction(async (tx) => {
            const columns = [
                'league_id',
                'player1_id',
                'player2_id',
                'player1_roster_id',
                'player2_roster_id',
                'winner_id',
                'winner_roster_id',
                'player1_sets_won',
                'player2_sets_won',
                'player1_points_total',
                'player2_points_total',
                'game_type',
                'player1_elo_before',
                'player2_elo_before',
                'player1_elo_after',
                'player2_elo_after'
            ];
            const values = [
                league_id,
                req.user.id,
                player2Roster.user_id || null,
                player1Roster.id,
                player2Roster.id,
                winnerUserId,
                winnerRosterId,
                player1_sets_won,
                player2_sets_won,
                player1_points_total,
                player2_points_total,
                game_type,
                player1Elo,
                player2Elo,
                eloResult.newRating1,
                eloResult.newRating2
            ];

            if (played_at) {
                columns.push('played_at');
                values.push(played_at);
            }

            const placeholders = columns.map(() => '?').join(', ');
            const matchResult = await tx.run(
                `INSERT INTO matches (${columns.join(', ')}) VALUES (${placeholders})`,
                values
            );

            if (sets && sets.length > 0) {
                for (let i = 0; i < sets.length; i++) {
                    await tx.run(
                        'INSERT INTO match_sets (match_id, set_number, player1_score, player2_score) VALUES (?, ?, ?, ?)',
                        [matchResult.id, i + 1, sets[i].player1_score, sets[i].player2_score]
                    );
                }
            }

            // Notification only for assigned opponent users
            if (player2Roster.user_id) {
                const league = await tx.get('SELECT name FROM leagues WHERE id = ?', [league_id]);
                await tx.run(
                    'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                    [
                        player2Roster.user_id,
                        'match_request',
                        'New Match Result',
                        `${req.user.username} has submitted a match result in "${league.name}"`,
                        matchResult.id
                    ]
                );
            }

            return { matchId: matchResult.id };
        });

        const match = await database.get(`
            SELECT 
                m.id, m.league_id,
                m.player1_roster_id, m.player2_roster_id, m.winner_roster_id,
                m.player1_id, m.player2_id, m.winner_id,
                m.player1_sets_won, m.player2_sets_won, 
                m.player1_points_total, m.player2_points_total, m.game_type, 
                m.is_accepted, m.played_at, m.created_at,
                m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after,
                l.name as league_name,
                COALESCE(r1.display_name, u1_fallback.username) as player1_display_name,
                COALESCE(r2.display_name, u2_fallback.username) as player2_display_name,
                COALESCE(u1.username, u1_fallback.username) as player1_username,
                COALESCE(u2.username, u2_fallback.username) as player2_username
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            LEFT JOIN league_roster r1 ON m.player1_roster_id = r1.id
            LEFT JOIN league_roster r2 ON m.player2_roster_id = r2.id
            LEFT JOIN users u1 ON r1.user_id = u1.id
            LEFT JOIN users u2 ON r2.user_id = u2.id
            LEFT JOIN users u1_fallback ON m.player1_id = u1_fallback.id
            LEFT JOIN users u2_fallback ON m.player2_id = u2_fallback.id
            WHERE m.id = ?
        `, [txResult.matchId]);

        res.status(201).json({
            message: 'Match created successfully. Waiting for admin approval.',
            match,
            elo_preview: {
                player1_change: eloResult.newRating1 - player1Elo,
                player2_change: eloResult.newRating2 - player2Elo
            }
        });
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
            whereClause += ' AND EXISTS (SELECT 1 FROM league_roster lr WHERE lr.league_id = m.league_id AND lr.user_id = ? AND lr.is_admin = ?)';
            params.push(req.user.id, true);
        }
        
        const matches = await database.all(`
            SELECT 
                m.id, m.league_id, m.player1_sets_won, m.player2_sets_won, 
                m.player1_points_total, m.player2_points_total, m.game_type, 
                m.winner_id, m.winner_roster_id, m.played_at, m.created_at,
                m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after,
                l.name as league_name,
                COALESCE(r1.display_name, u1_fallback.username) as player1_display_name,
                COALESCE(r2.display_name, u2_fallback.username) as player2_display_name,
                COALESCE(u1.username, u1_fallback.username) as player1_username,
                COALESCE(u2.username, u2_fallback.username) as player2_username
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            LEFT JOIN league_roster r1 ON m.player1_roster_id = r1.id
            LEFT JOIN league_roster r2 ON m.player2_roster_id = r2.id
            LEFT JOIN users u1 ON r1.user_id = u1.id
            LEFT JOIN users u2 ON r2.user_id = u2.id
            LEFT JOIN users u1_fallback ON m.player1_id = u1_fallback.id
            LEFT JOIN users u2_fallback ON m.player2_id = u2_fallback.id
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
            player2_roster_id,
            player1_sets_won,
            player2_sets_won,
            player1_points_total,
            player2_points_total
        } = req.body;
        
        // Get current ELO ratings
        const player1Roster = await getRosterByUser(league_id, req.user.id);
        const player2Roster = await getRosterById(league_id, player2_roster_id);

        if (!player1Roster || !player2Roster) {
            return res.status(400).json({ error: 'One or both players are not roster members of this league' });
        }
        
        const eloResult = calculateNewElos(
            player1Roster.current_elo,
            player2Roster.current_elo,
            player1_points_total || 0,
            player2_points_total || 0,
            player1_sets_won > player2_sets_won,
            player1_sets_won,
            player2_sets_won
        );
        
        res.json({
            current_elos: {
                player1: player1Roster.current_elo,
                player2: player2Roster.current_elo
            },
            new_elos: {
                player1: eloResult.newRating1,
                player2: eloResult.newRating2
            },
            changes: {
                player1: eloResult.newRating1 - player1Roster.current_elo,
                player2: eloResult.newRating2 - player2Roster.current_elo
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
                m.winner_id, m.winner_roster_id, m.is_accepted, m.elo_applied, m.elo_applied_at, m.played_at, m.created_at,
                m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after,
                l.name as league_name,
                m.player1_roster_id, m.player2_roster_id,
                COALESCE(r1.display_name, u1_fallback.username) as player1_display_name,
                COALESCE(r2.display_name, u2_fallback.username) as player2_display_name,
                COALESCE(u1.id, m.player1_id) as player1_user_id, 
                COALESCE(u1.username, u1_fallback.username) as player1_username,
                COALESCE(u2.id, m.player2_id) as player2_user_id, 
                COALESCE(u2.username, u2_fallback.username) as player2_username,
                accepter.username as accepted_by_username
            FROM matches m
            JOIN leagues l ON m.league_id = l.id
            LEFT JOIN league_roster r1 ON m.player1_roster_id = r1.id
            LEFT JOIN league_roster r2 ON m.player2_roster_id = r2.id
            LEFT JOIN users u1 ON r1.user_id = u1.id
            LEFT JOIN users u2 ON r2.user_id = u2.id
            LEFT JOIN users u1_fallback ON m.player1_id = u1_fallback.id
            LEFT JOIN users u2_fallback ON m.player2_id = u2_fallback.id
            LEFT JOIN users accepter ON m.accepted_by = accepter.id
            WHERE m.id = ?
        `, [matchId]);
        
        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }
        
        // Check if user has access to this match
        const isParticipant = match.player1_user_id === req.user.id || match.player2_user_id === req.user.id;
        if (!isParticipant && !req.user.is_admin) {
            // Check if user is league admin
            const leagueAdmin = await database.get(
                'SELECT is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
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
            'SELECT player1_id, player2_id, player1_roster_id, player2_roster_id, is_accepted, league_id FROM matches WHERE id = ?',
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
            const didP1Win = player1_sets_won > player2_sets_won;
            const winnerRosterId = didP1Win ? match.player1_roster_id : match.player2_roster_id;
            updates.push('winner_roster_id = ?');
            values.push(winnerRosterId);
            
            // Get current ELO ratings and recalculate
            const player1Membership = await database.get(
                'SELECT current_elo FROM league_roster WHERE league_id = ? AND id = ?',
                [match.league_id, match.player1_roster_id]
            );
            const player2Membership = await database.get(
                'SELECT current_elo FROM league_roster WHERE league_id = ? AND id = ?',
                [match.league_id, match.player2_roster_id]
            );
            
            const eloResult = calculateNewElos(
                player1Membership.current_elo,
                player2Membership.current_elo,
                player1_points_total || 0,
                player2_points_total || 0,
                didP1Win,
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
                m.player1_roster_id, m.player2_roster_id, m.winner_roster_id,
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
                'SELECT is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
                [match.league_id, req.user.id]
            );
            
            if (!leagueAdmin || !leagueAdmin.is_admin) {
                return res.status(403).json({ error: 'League admin access required' });
            }
        }
        
        // Check league elo update mode
        const league = await database.get('SELECT name, elo_update_mode FROM leagues WHERE id = ?', [match.league_id]);
        const mode = league && league.elo_update_mode ? league.elo_update_mode : 'immediate';

        if (mode === 'immediate') {
            const result = await database.withTransaction(async (tx) => {
                // Accept match and mark elo_applied
                await tx.run(
                    'UPDATE matches SET is_accepted = ?, accepted_by = ?, accepted_at = CURRENT_TIMESTAMP, elo_applied = ?, elo_applied_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [true, req.user.id, true, matchId]
                );

                // Update player ELO ratings
                await tx.run(
                    'UPDATE league_roster SET current_elo = ? WHERE league_id = ? AND id = ?',
                    [match.player1_elo_after, match.league_id, match.player1_roster_id]
                );

                await tx.run(
                    'UPDATE league_roster SET current_elo = ? WHERE league_id = ? AND id = ?',
                    [match.player2_elo_after, match.league_id, match.player2_roster_id]
                );

                // Record ELO history
                const before = await tx.get(
                    'SELECT player1_elo_before, player2_elo_before FROM matches WHERE id = ?',
                    [matchId]
                );

                const player1EloChange = match.player1_elo_after - before.player1_elo_before;
                const player2EloChange = match.player2_elo_after - before.player2_elo_before;

                const p1User = await tx.get('SELECT user_id FROM league_roster WHERE id = ?', [match.player1_roster_id]);
                const p2User = await tx.get('SELECT user_id FROM league_roster WHERE id = ?', [match.player2_roster_id]);

                await tx.run(
                    'INSERT INTO elo_history (user_id, league_id, roster_id, match_id, elo_before, elo_after, elo_change, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [p1User?.user_id || null, match.league_id, match.player1_roster_id, matchId, before.player1_elo_before, match.player1_elo_after, player1EloChange]
                );

                await tx.run(
                    'INSERT INTO elo_history (user_id, league_id, roster_id, match_id, elo_before, elo_after, elo_change, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
                    [p2User?.user_id || null, match.league_id, match.player2_roster_id, matchId, before.player2_elo_before, match.player2_elo_after, player2EloChange]
                );

                // Notifications
                if (p1User?.user_id) {
                    await tx.run(
                        'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                        [
                            p1User.user_id,
                            'match_accepted',
                            'Match Accepted',
                            `Your match result in "${league.name}" has been accepted. ELO change: ${player1EloChange > 0 ? '+' : ''}${player1EloChange}`,
                            matchId
                        ]
                    );
                }

                if (p2User?.user_id) {
                    await tx.run(
                        'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                        [
                            p2User.user_id,
                            'match_accepted',
                            'Match Accepted',
                            `Your match result in "${league.name}" has been accepted. ELO change: ${player2EloChange > 0 ? '+' : ''}${player2EloChange}`,
                            matchId
                        ]
                    );
                }

                return { player1EloChange, player2EloChange };
            });

            res.json({
                message: 'Match accepted successfully',
                elo_changes: {
                    player1_change: result.player1EloChange,
                    player2_change: result.player2EloChange
                }
            });
        } else {
            // Deferred: mark accepted but do not apply ELO yet
            await database.run(
                'UPDATE matches SET is_accepted = ?, accepted_by = ?, accepted_at = CURRENT_TIMESTAMP, elo_applied = ? WHERE id = ?',
                [true, req.user.id, false, matchId]
            );

            // Notify players of acceptance with deferred application
            const p1User = await database.get('SELECT user_id FROM league_roster WHERE id = ?', [match.player1_roster_id]);
            const p2User = await database.get('SELECT user_id FROM league_roster WHERE id = ?', [match.player2_roster_id]);
            if (p1User?.user_id) {
                await database.run(
                    'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                    [
                        p1User.user_id,
                        'match_accepted_deferred',
                        'Match Accepted (Deferred ELO)',
                        `Your match in "${league.name}" was accepted. ELO will be applied during ${mode} consolidation.`,
                        matchId
                    ]
                );
            }
            if (p2User?.user_id) {
                await database.run(
                    'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                    [
                        p2User.user_id,
                        'match_accepted_deferred',
                        'Match Accepted (Deferred ELO)',
                        `Your match in "${league.name}" was accepted. ELO will be applied during ${mode} consolidation.`,
                        matchId
                    ]
                );
            }

            res.json({ message: 'Match accepted. ELO update deferred to consolidation.' });
        }
    } catch (error) {
        console.error('Accept match error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Consolidate deferred ELO updates for a league (league admin or system admin)
 * POST /api/leagues/:leagueId/consolidate?force=true
 */
router.post('/leagues/:leagueId/consolidate', authenticateToken, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.leagueId);
        console.log(`Consolidation requested for league ${leagueId} by user ${req.user.id}`);

        // Authorization: system admin or league admin
        if (!req.user.is_admin) {
            const adminRow = await database.get(
                'SELECT is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            if (!adminRow || !adminRow.is_admin) {
                return res.status(403).json({ error: 'League admin access required' });
            }
        }

        const league = await database.get('SELECT elo_update_mode FROM leagues WHERE id = ?', [leagueId]);
        if (!league) {
            console.log(`League ${leagueId} not found`);
            return res.status(404).json({ error: 'League not found' });
        }
        const mode = league.elo_update_mode || 'immediate';
        console.log(`League ${leagueId} ELO mode: ${mode}`);
        
        // For immediate mode, there's nothing to consolidate
        if (mode === 'immediate') {
            console.log(`League ${leagueId} is in immediate mode - no consolidation needed`);
            return res.status(400).json({ error: 'League is set to immediate ELO updates - no consolidation needed' });
        }
        
        console.log(`League ${leagueId} is in ${mode} mode - proceeding with consolidation`);

        // For weekly/monthly modes, process all accepted matches that haven't had ELO applied yet
        // (No time restrictions - admins can consolidate whenever they want)

        // Fetch all accepted matches that haven't had ELO applied yet
        console.log(`Fetching matches for league ${leagueId}...`);
        const matches = await database.all(
            'SELECT id, player1_roster_id, player2_roster_id FROM matches WHERE league_id = ? AND is_accepted = ? AND (elo_applied = ? OR elo_applied IS NULL) ORDER BY accepted_at ASC',
            [leagueId, true, false]
        );

        console.log(`Found ${matches.length} matches to consolidate for league ${leagueId}`);
        if (matches.length > 0) {
            console.log('Match IDs:', matches.map(m => m.id));
        }

        if (matches.length === 0) {
            console.log(`No matches to consolidate for league ${leagueId}`);
            return res.status(400).json({ error: 'No matches to consolidate' });
        }

        let appliedCount = 0;
        for (const m of matches) {
            console.log(`Processing match ${m.id}...`);
            try {
                await database.withTransaction(async (tx) => {
                    console.log(`Getting ELO data for match ${m.id}...`);
                    // Get current ELOs as of now
                    const p1 = await tx.get('SELECT user_id, current_elo FROM league_roster WHERE league_id = ? AND id = ?', [leagueId, m.player1_roster_id]);
                    const p2 = await tx.get('SELECT user_id, current_elo FROM league_roster WHERE league_id = ? AND id = ?', [leagueId, m.player2_roster_id]);

                    console.log(`Match ${m.id} ELO data: p1=${p1?.current_elo}, p2=${p2?.current_elo}`);

                    if (!p1 || !p2) {
                        throw new Error(`Missing ELO data for match ${m.id}: p1=${!!p1}, p2=${!!p2}`);
                    }

                    // Get match details needed to compute
                    console.log(`Getting match details for match ${m.id}...`);
                    const details = await tx.get('SELECT player1_points_total, player2_points_total, player1_sets_won, player2_sets_won FROM matches WHERE id = ?', [m.id]);

                    if (!details) {
                        throw new Error(`Missing match details for match ${m.id}`);
                    }

                    console.log(`Match ${m.id} details:`, details);

                    const didP1Win = details.player1_sets_won > details.player2_sets_won;
                    console.log(`Match ${m.id} winner: player1=${didP1Win}, sets: ${details.player1_sets_won}-${details.player2_sets_won}`);

                    const eloResult = calculateNewElos(
                        p1.current_elo,
                        p2.current_elo,
                        details.player1_points_total || 0,
                        details.player2_points_total || 0,
                        didP1Win,
                        details.player1_sets_won,
                        details.player2_sets_won
                    );

                    console.log(`Match ${m.id} ELO result:`, eloResult);

                    // Update match with before/after at application time and mark applied
                    console.log(`Updating match ${m.id} with ELO data...`);
                    const winnerRosterId = didP1Win ? m.player1_roster_id : m.player2_roster_id;
                    await tx.run(
                        'UPDATE matches SET player1_elo_before = ?, player2_elo_before = ?, player1_elo_after = ?, player2_elo_after = ?, winner_roster_id = ?, elo_applied = ?, elo_applied_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [p1.current_elo, p2.current_elo, eloResult.newRating1, eloResult.newRating2, winnerRosterId, true, m.id]
                    );

                    // Update league member elos
                    console.log(`Updating league member ELOs for match ${m.id}...`);
                    await tx.run('UPDATE league_roster SET current_elo = ? WHERE league_id = ? AND id = ?', [eloResult.newRating1, leagueId, m.player1_roster_id]);
                    await tx.run('UPDATE league_roster SET current_elo = ? WHERE league_id = ? AND id = ?', [eloResult.newRating2, leagueId, m.player2_roster_id]);

                    // Insert history
                    console.log(`Inserting ELO history for match ${m.id}...`);
                    await tx.run('INSERT INTO elo_history (user_id, league_id, roster_id, match_id, elo_before, elo_after, elo_change, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', [p1.user_id || null, leagueId, m.player1_roster_id, m.id, p1.current_elo, eloResult.newRating1, eloResult.newRating1 - p1.current_elo]);
                    await tx.run('INSERT INTO elo_history (user_id, league_id, roster_id, match_id, elo_before, elo_after, elo_change, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)', [p2.user_id || null, leagueId, m.player2_roster_id, m.id, p2.current_elo, eloResult.newRating2, eloResult.newRating2 - p2.current_elo]);
                    
                    console.log(`Transaction completed successfully for match ${m.id}`);
                });
                appliedCount += 1;
                console.log(`Successfully consolidated match ${m.id}`);
            } catch (error) {
                console.error(`Failed to consolidate match ${m.id}:`, error);
                console.error('Error details:', error.message, error.stack);
                throw error; // Re-throw to stop the entire consolidation
            }
        }

        console.log(`Consolidation completed successfully. Applied to ${appliedCount} matches.`);
        res.json({ message: 'Consolidation complete', applied: appliedCount });
    } catch (error) {
        console.error('Consolidate ELO error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

/**
 * Debug endpoint to check consolidation status
 * GET /api/matches/debug/consolidation/:leagueId
 */
router.get('/debug/consolidation/:leagueId', authenticateToken, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.leagueId);
        
        // Check if user is admin or league admin
        if (!req.user.is_admin) {
            const adminRow = await database.get(
                'SELECT is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            if (!adminRow || !adminRow.is_admin) {
                return res.status(403).json({ error: 'League admin access required' });
            }
        }

        // Get league info
        const league = await database.get('SELECT id, name, elo_update_mode FROM leagues WHERE id = ?', [leagueId]);
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }

        // Get matches that need consolidation
        const matches = await database.all(
            'SELECT id, player1_roster_id, player2_roster_id, is_accepted, elo_applied, accepted_at FROM matches WHERE league_id = ? AND is_accepted = ? AND (elo_applied = ? OR elo_applied IS NULL) ORDER BY accepted_at ASC',
            [leagueId, true, false]
        );

        // Get league members with ELO
        const members = await database.all(
            'SELECT id as roster_id, user_id, display_name, current_elo FROM league_roster WHERE league_id = ?',
            [leagueId]
        );

        res.json({
            league,
            matchesToConsolidate: matches.length,
            matches: matches,
            members: members.length,
            debug: {
                leagueId,
                userId: req.user.id,
                isAdmin: req.user.is_admin
            }
        });
    } catch (error) {
        console.error('Debug consolidation error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
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
            'SELECT league_id, player1_roster_id, player2_roster_id, is_accepted FROM matches WHERE id = ?',
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
                'SELECT is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
                [match.league_id, req.user.id]
            );
            
            if (!leagueAdmin || !leagueAdmin.is_admin) {
                return res.status(403).json({ error: 'League admin access required' });
            }
        }
        
        await database.withTransaction(async (tx) => {
            // Delete the match
            await tx.run('DELETE FROM matches WHERE id = ?', [matchId]);

            // Create notifications for both players
            const league = await tx.get('SELECT name FROM leagues WHERE id = ?', [match.league_id]);
            const rejectionMessage = `Your match result in "${league.name}" has been rejected${reason ? ': ' + reason : ''}`;

            const p1 = await tx.get('SELECT user_id FROM league_roster WHERE id = ?', [match.player1_roster_id]);
            const p2 = await tx.get('SELECT user_id FROM league_roster WHERE id = ?', [match.player2_roster_id]);

            if (p1?.user_id) {
                await tx.run(
                    'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
                    [p1.user_id, 'match_rejected', 'Match Rejected', rejectionMessage]
                );
            }

            if (p2?.user_id) {
                await tx.run(
                    'INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)',
                    [p2.user_id, 'match_rejected', 'Match Rejected', rejectionMessage]
                );
            }
        });

        res.json({ message: 'Match rejected successfully' });
    } catch (error) {
        console.error('Reject match error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cleanup: Removed duplicate route definitions for '/pending' and '/preview-elo'.

module.exports = router;
