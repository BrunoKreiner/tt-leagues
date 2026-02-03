const express = require('express');
const { authenticateToken, requireLeagueAdmin, optionalAuth } = require('../middleware/auth');
const { validateLeagueCreation, validateId, validatePagination } = require('../middleware/validation');
const { moderateText, ModerationError } = require('../middleware/contentModeration');
const database = require('../models/database');
const crypto = require('crypto');
const { SNAPSHOT_VERSION, getCachedLeagueSnapshot, saveLeagueSnapshot, markLeagueSnapshotDirty } = require('../utils/leagueSnapshots');

const router = express.Router();

const PUBLIC_CACHE_SECONDS = 60 * 60 * 24;
const PUBLIC_CACHE_SWR_SECONDS = 60 * 60;
const SNAPSHOT_LEADERBOARD_LIMIT = 20;
const shouldCachePublic = (req) => !req.user && !req.headers.authorization;
const setPublicCacheHeaders = (req, res) => {
    if (!shouldCachePublic(req)) return;
    res.set('Cache-Control', `public, s-maxage=${PUBLIC_CACHE_SECONDS}, stale-while-revalidate=${PUBLIC_CACHE_SWR_SECONDS}`);
    res.set('Vary', 'Origin');
};

const buildLeagueSnapshot = async (leagueId, leagueRow) => {
    const league = leagueRow || await database.get(`
        SELECT 
            l.id, l.name, l.description, l.is_public, l.season, l.elo_update_mode, l.created_at,
            u.username as created_by_username,
            COUNT(DISTINCT lr.id) as member_count,
            COUNT(DISTINCT m.id) as match_count
        FROM leagues l
        JOIN users u ON l.created_by = u.id
        LEFT JOIN league_roster lr ON l.id = lr.league_id
        LEFT JOIN matches m ON l.id = m.league_id AND m.is_accepted = ?
        WHERE l.id = ? AND l.is_active = ?
        GROUP BY l.id, l.name, l.description, l.is_public, l.season, l.elo_update_mode, l.created_at, u.username
    `, [true, leagueId, true]);

    if (!league) {
        return null;
    }

    const leaderboard = await database.all(`
        SELECT 
            lr.id as roster_id,
            lr.user_id,
            u.username,
            u.first_name,
            u.last_name,
            u.avatar_url,
            lr.display_name,
            lr.current_elo,
            lr.joined_at,
            COUNT(CASE 
                WHEN lr.user_id IS NOT NULL AND (m.player1_id = lr.user_id OR m.player2_id = lr.user_id) THEN m.id
                WHEN lr.user_id IS NULL AND (m.player1_roster_id = lr.id OR m.player2_roster_id = lr.id) THEN m.id
            END) as matches_played,
            COUNT(CASE 
                WHEN lr.user_id IS NOT NULL AND m.winner_id = lr.user_id THEN m.id
                WHEN lr.user_id IS NULL AND m.winner_roster_id = lr.id THEN m.id
            END) as matches_won,
            ROW_NUMBER() OVER (ORDER BY lr.current_elo DESC) as rank
        FROM league_roster lr
        LEFT JOIN users u ON lr.user_id = u.id
        LEFT JOIN matches m ON m.league_id = lr.league_id 
            AND m.is_accepted = ?
            AND (
                (lr.user_id IS NOT NULL AND (m.player1_id = lr.user_id OR m.player2_id = lr.user_id))
                OR (lr.user_id IS NULL AND (m.player1_roster_id = lr.id OR m.player2_roster_id = lr.id))
            )
        WHERE lr.league_id = ? AND lr.is_participating = ?
        GROUP BY lr.id, lr.user_id, u.username, u.first_name, u.last_name, u.avatar_url, lr.display_name, lr.current_elo, lr.joined_at
        ORDER BY lr.current_elo DESC
        LIMIT ? OFFSET ?
    `, [true, leagueId, true, SNAPSHOT_LEADERBOARD_LIMIT, 0]);

    const totalRow = await database.get(
        'SELECT COUNT(*) as count FROM league_roster WHERE league_id = ? AND is_participating = ?',
        [leagueId, true]
    );

    const userIds = Array.from(new Set(
        leaderboard
            .map((player) => player.user_id)
            .filter((userId) => userId != null)
    ));
    let badgesByUser = new Map();
    if (userIds.length > 0) {
        const placeholders = userIds.map(() => '?').join(', ');
        const badgeRows = await database.all(`
            SELECT 
                ub.user_id,
                b.id, b.name, b.description, b.icon, b.badge_type, b.image_url,
                ub.earned_at
            FROM user_badges ub
            JOIN badges b ON ub.badge_id = b.id
            WHERE ub.user_id IN (${placeholders})
            AND (ub.league_id = ? OR ub.league_id IS NULL)
            ORDER BY ub.user_id, ub.earned_at DESC
        `, [...userIds, leagueId]);
        badgesByUser = new Map();
        badgeRows.forEach((row) => {
            const key = String(row.user_id);
            const current = badgesByUser.get(key) || [];
            if (current.length >= 3) {
                return;
            }
            current.push({
                id: row.id,
                name: row.name,
                description: row.description,
                icon: row.icon,
                badge_type: row.badge_type,
                image_url: row.image_url,
                earned_at: row.earned_at,
            });
            badgesByUser.set(key, current);
        });
    }

    const leaderboardWithBadges = leaderboard.map((player) => {
        const winRate = player.matches_played > 0
            ? Math.round((player.matches_won / player.matches_played) * 100)
            : 0;
        const badgeList = player.user_id != null
            ? (badgesByUser.get(String(player.user_id)) || [])
            : [];
        return {
            ...player,
            win_rate: winRate,
            badges: badgeList,
        };
    });

    return {
        version: SNAPSHOT_VERSION,
        generated_at: new Date().toISOString(),
        league,
        leaderboard: leaderboardWithBadges,
        leaderboard_pagination: {
            page: 1,
            limit: SNAPSHOT_LEADERBOARD_LIMIT,
            total: totalRow?.count || 0,
            pages: Math.ceil((totalRow?.count || 0) / SNAPSHOT_LEADERBOARD_LIMIT)
        }
    };
};

/**
 * Get all leagues (public + user's leagues)
 * GET /api/leagues
 */
router.get('/', optionalAuth, validatePagination, async (req, res) => {
    try {
        const pageValue = parseInt(req.query.page);
        const limitValue = parseInt(req.query.limit);
        const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
        const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : 20;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT 
                l.id, l.name, l.description, l.is_public, l.season, l.elo_update_mode, l.created_at, l.updated_at,
                u.username as created_by_username,
                COUNT(DISTINCT lr.id) as member_count,
                COUNT(DISTINCT m.id) as match_count,
                MAX(m.played_at) as last_match_at,
                ${req.user
                    ? 'MAX(CASE WHEN lr.user_id = ? THEN 1 ELSE 0 END) as is_member, MAX(CASE WHEN lr.user_id = ? THEN CASE WHEN lr.is_admin THEN 1 ELSE 0 END ELSE 0 END) as is_league_admin'
                    : '0 as is_member, 0 as is_league_admin'}
            FROM leagues l
            JOIN users u ON l.created_by = u.id
            LEFT JOIN league_roster lr ON l.id = lr.league_id
            LEFT JOIN matches m ON l.id = m.league_id AND m.is_accepted = ?
            WHERE l.is_active = ?
        `;
        
        // Build params in the exact textual order of placeholders in the query string above
        const params = [];
        if (req.user) {
            // For SELECT is_member aggregator
            params.push(req.user.id, req.user.id);
        }
        // For LEFT JOIN matches m.is_accepted = ?
        params.push(true);
        // For WHERE l.is_active = ?
        params.push(true);
        
        // If user is authenticated, show their leagues + public leagues
        // If not authenticated, show only public leagues
        if (req.user) {
            query += ` AND (l.is_public = ? OR lr.user_id = ?)`;
            params.push(true, req.user.id);
        } else {
            query += ` AND l.is_public = ?`;
            params.push(true);
        }
        
        query += `
            GROUP BY l.id, l.name, l.description, l.is_public, l.season, l.elo_update_mode, l.created_at, l.updated_at, u.username
            ORDER BY COALESCE(l.updated_at, l.created_at) DESC
            LIMIT ? OFFSET ?
        `;
        
        params.push(limit, offset);
        
        const leagues = await database.all(query, params);
        
        // Get total count
        let countQuery = `
            SELECT COUNT(DISTINCT l.id) as count
            FROM leagues l
            LEFT JOIN league_roster lr ON l.id = lr.league_id
            WHERE l.is_active = ?
        `;
        
        const countParams = [true];
        
        if (req.user) {
            countQuery += ` AND (l.is_public = ? OR lr.user_id = ?)`;
            countParams.push(true, req.user.id);
        } else {
            countQuery += ` AND l.is_public = ?`;
            countParams.push(true);
        }
        
        const totalCount = await database.get(countQuery, countParams);
        
        setPublicCacheHeaders(req, res);
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
 * Create new league (authenticated)
 * POST /api/leagues
 */
router.post('/', authenticateToken, validateLeagueCreation, async (req, res) => {
    try {
        const { name, description, is_public, season } = req.body;

        moderateText(
            { name, description, season },
            { context: 'league fields' }
        );
        
        // Check if league name already exists
        const existingLeague = await database.get(
            'SELECT id FROM leagues WHERE name = ? AND is_active = ?',
            [name, true]
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
            'INSERT INTO league_roster (league_id, user_id, display_name, is_admin) VALUES (?, ?, ?, ?)',
            [result.id, req.user.id, req.user.username, true]
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
        await markLeagueSnapshotDirty(result.id);
        res.status(201).json({
            message: 'League created successfully',
            league
        });
    } catch (error) {
        if (error instanceof ModerationError) {
            return res.status(error.status || 400).json({ error: error.message, code: error.code });
        }
        console.error('Create league error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get cached league snapshot (public + member access)
 * GET /api/leagues/:id/snapshot
 */
router.get('/:id/snapshot', optionalAuth, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);

        const leagueRow = await database.get(`
            SELECT 
                l.id, l.name, l.description, l.is_public, l.season, l.elo_update_mode, l.created_at,
                u.username as created_by_username,
                COUNT(DISTINCT lr.id) as member_count,
                COUNT(DISTINCT m.id) as match_count
            FROM leagues l
            JOIN users u ON l.created_by = u.id
            LEFT JOIN league_roster lr ON l.id = lr.league_id
            LEFT JOIN matches m ON l.id = m.league_id AND m.is_accepted = ?
            WHERE l.id = ? AND l.is_active = ?
            GROUP BY l.id, l.name, l.description, l.is_public, l.season, l.elo_update_mode, l.created_at, u.username
        `, [true, leagueId, true]);

        if (!leagueRow) {
            return res.status(404).json({ error: 'League not found' });
        }

        if (!leagueRow.is_public && req.user) {
            const membership = await database.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        } else if (!leagueRow.is_public && !req.user) {
            return res.status(403).json({ error: 'Access denied to private league' });
        }

        let userMembership = null;
        if (req.user) {
            userMembership = await database.get(
                'SELECT id as roster_id, current_elo, is_admin, joined_at, display_name FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
        }

        let joinRequest = null;
        if (req.user && !userMembership) {
            joinRequest = await database.get(
                `
                SELECT id, status, created_at
                FROM league_join_requests
                WHERE league_id = ? AND user_id = ? AND status = ?
                ORDER BY created_at DESC
                LIMIT 1
                `,
                [leagueId, req.user.id, 'pending']
            );
        }

        const cached = await getCachedLeagueSnapshot(leagueId);
        if (cached) {
            if (leagueRow.is_public) {
                setPublicCacheHeaders(req, res);
            }
            return res.json({
                ...cached.payload,
                snapshot_updated_at: cached.updated_at,
                user_membership: userMembership,
                join_request: joinRequest
            });
        }

        const snapshot = await buildLeagueSnapshot(leagueId, leagueRow);
        if (!snapshot) {
            return res.status(404).json({ error: 'League not found' });
        }
        await saveLeagueSnapshot(leagueId, snapshot);
        if (leagueRow.is_public) {
            setPublicCacheHeaders(req, res);
        }
        res.json({
            ...snapshot,
            snapshot_updated_at: new Date().toISOString(),
            user_membership: userMembership,
            join_request: joinRequest
        });
    } catch (error) {
        console.error('Get league snapshot error:', error);
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
                l.id, l.name, l.description, l.is_public, l.season, l.elo_update_mode, l.created_at,
                u.username as created_by_username,
                COUNT(DISTINCT lr.id) as member_count,
                COUNT(DISTINCT m.id) as match_count
            FROM leagues l
            JOIN users u ON l.created_by = u.id
            LEFT JOIN league_roster lr ON l.id = lr.league_id
            LEFT JOIN matches m ON l.id = m.league_id AND m.is_accepted = ?
            WHERE l.id = ? AND l.is_active = ?
            GROUP BY l.id, l.name, l.description, l.is_public, l.season, l.elo_update_mode, l.created_at, u.username
        `, [true, leagueId, true]);
        
        // Note: avoid logging membership details in production.
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        // Check if user has access to this league
        if (!league.is_public && req.user) {
            const membership = await database.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
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
                'SELECT id as roster_id, current_elo, is_admin, joined_at, display_name FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
        }
        
        if (league.is_public) {
            setPublicCacheHeaders(req, res);
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
        const { name, description, is_public, season, elo_update_mode } = req.body;

        moderateText(
            { name, description, season, elo_update_mode },
            { context: 'league fields' }
        );
        
        const updates = [];
        const values = [];
        
        if (name !== undefined) {
            // Check if new name already exists
            const existingLeague = await database.get(
                'SELECT id FROM leagues WHERE name = ? AND id != ? AND is_active = ?',
                [name, leagueId, true]
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
        
        if (elo_update_mode !== undefined) {
            console.log(`Updating elo_update_mode to: ${elo_update_mode}`);
            const allowed = ['immediate', 'weekly', 'monthly'];
            if (!allowed.includes(elo_update_mode)) {
                console.log(`Invalid elo_update_mode: ${elo_update_mode}`);
                return res.status(400).json({ error: 'elo_update_mode must be one of: immediate, weekly, monthly' });
            }
            updates.push('elo_update_mode = ?');
            values.push(elo_update_mode);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(leagueId);
        
        console.log(`Executing UPDATE: ${updates.join(', ')} with values:`, values);
        await database.run(
            `UPDATE leagues SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        // Get updated league
        const updatedLeague = await database.get(`
            SELECT 
                l.id, l.name, l.description, l.is_public, l.season, l.elo_update_mode, l.created_at, l.updated_at,
                u.username as created_by_username
            FROM leagues l
            JOIN users u ON l.created_by = u.id
            WHERE l.id = ?
        `, [leagueId]);
        await markLeagueSnapshotDirty(leagueId);
        res.json({
            message: 'League updated successfully',
            league: updatedLeague
        });
    } catch (error) {
        if (error instanceof ModerationError) {
            return res.status(error.status || 400).json({ error: error.message, code: error.code });
        }
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
        await database.run('UPDATE leagues SET is_active = ? WHERE id = ?', [false, leagueId]);
        
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
        const league = await database.get('SELECT is_public FROM leagues WHERE id = ? AND is_active = ?', [leagueId, true]);
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        if (!league.is_public) {
            const membership = await database.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            
            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        }

        const members = await database.all(`
            SELECT
                lr.id as roster_id,
                lr.user_id,
                u.username,
                u.first_name,
                u.last_name,
                CASE
                    WHEN lr.display_name IS NOT NULL AND TRIM(lr.display_name) != '' THEN lr.display_name
                    WHEN lr.user_id IS NOT NULL THEN u.username
                    ELSE 'Placeholder'
                END as display_name,
                lr.current_elo,
                lr.is_admin as is_league_admin,
                lr.is_participating,
                lr.joined_at,
                COUNT(CASE 
                    WHEN lr.user_id IS NOT NULL AND (m.player1_id = lr.user_id OR m.player2_id = lr.user_id) THEN m.id
                    WHEN lr.user_id IS NULL AND (m.player1_roster_id = lr.id OR m.player2_roster_id = lr.id) THEN m.id
                END) as matches_played,
                COUNT(CASE 
                    WHEN lr.user_id IS NOT NULL AND m.winner_id = lr.user_id THEN m.id
                    WHEN lr.user_id IS NULL AND m.winner_roster_id = lr.id THEN m.id
                END) as matches_won
            FROM league_roster lr
            LEFT JOIN users u ON lr.user_id = u.id
            LEFT JOIN matches m ON m.league_id = lr.league_id 
                AND m.is_accepted = ?
                AND (
                    (lr.user_id IS NOT NULL AND (m.player1_id = lr.user_id OR m.player2_id = lr.user_id))
                    OR (lr.user_id IS NULL AND (m.player1_roster_id = lr.id OR m.player2_roster_id = lr.id))
                )
            WHERE lr.league_id = ?
            GROUP BY lr.id, lr.user_id, u.username, u.first_name, u.last_name, lr.display_name, lr.current_elo, lr.is_admin, lr.is_participating, lr.joined_at
            ORDER BY lr.current_elo DESC
        `, [true, leagueId]);
        
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
 * Update participation for current admin (hide/show from leaderboard)
 * POST /api/leagues/:id/participation
 * Body: { is_participating: boolean }
 */
router.post('/:id/participation', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const { is_participating } = req.body || {};

        if (typeof is_participating !== 'boolean') {
            return res.status(400).json({ error: 'is_participating must be a boolean' });
        }

        const roster = await database.get(
            'SELECT id, user_id FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, req.user.id]
        );

        if (!roster) {
            return res.status(404).json({ error: 'Roster membership not found' });
        }

        await database.run(
            'UPDATE league_roster SET is_participating = ? WHERE league_id = ? AND user_id = ?',
            [is_participating, leagueId, req.user.id]
        );
        await markLeagueSnapshotDirty(leagueId);
        res.json({ message: 'Participation updated', is_participating });
    } catch (error) {
        console.error('Update participation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Add a placeholder roster member (league admin only)
 * POST /api/leagues/:id/roster
 * Body: { display_name: string }
 */
router.post('/:id/roster', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const displayName = (req.body?.display_name || '').trim();
        if (!displayName) {
            return res.status(400).json({ error: 'display_name is required' });
        }

        moderateText(
            { display_name: displayName },
            { context: 'roster display name' }
        );

        const result = await database.run(
            'INSERT INTO league_roster (league_id, user_id, display_name) VALUES (?, ?, ?)',
            [leagueId, null, displayName]
        );

        const rosterEntry = await database.get(
            'SELECT id as roster_id, league_id, user_id, display_name, current_elo, is_admin, joined_at FROM league_roster WHERE id = ?',
            [result.id]
        );
        await markLeagueSnapshotDirty(leagueId);
        res.status(201).json({ message: 'Roster placeholder created', roster: rosterEntry });
    } catch (error) {
        if (error instanceof ModerationError) {
            return res.status(error.status || 400).json({ error: error.message, code: error.code });
        }
        console.error('Create roster placeholder error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Assign a user to an existing roster entry (league admin only)
 * POST /api/leagues/:id/roster/:rosterId/assign
 * Body: { user_id: number }
 *
 * Updates display_name to the user's username and links existing ELO history to the user_id.
 */
router.post('/:id/roster/:rosterId/assign', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const rosterId = parseInt(req.params.rosterId);
        const userId = parseInt(req.body?.user_id);

        if (!Number.isInteger(rosterId) || rosterId < 1) {
            return res.status(400).json({ error: 'Valid rosterId is required' });
        }
        if (!Number.isInteger(userId) || userId < 1) {
            return res.status(400).json({ error: 'Valid user_id is required' });
        }

        const roster = await database.get(
            'SELECT id, user_id, display_name FROM league_roster WHERE league_id = ? AND id = ?',
            [leagueId, rosterId]
        );
        if (!roster) {
            return res.status(404).json({ error: 'Roster entry not found' });
        }
        if (roster.user_id) {
            return res.status(400).json({ error: 'Roster entry already assigned' });
        }

        const user = await database.get('SELECT id, username FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const existing = await database.get(
            'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, userId]
        );
        if (existing) {
            return res.status(409).json({ error: 'User is already assigned to a roster entry in this league' });
        }

        // Use username as display name
        const displayName = user.username;

        await database.withTransaction(async (tx) => {
            // Update roster entry with user_id and display_name
            await tx.run(
                'UPDATE league_roster SET user_id = ?, display_name = ? WHERE league_id = ? AND id = ?',
                [userId, displayName, leagueId, rosterId]
            );

            // Update ELO history records to link them to the user_id
            // This ensures the ELO trend line works after assignment
            await tx.run(
                'UPDATE elo_history SET user_id = ? WHERE roster_id = ? AND league_id = ? AND user_id IS NULL',
                [userId, rosterId, leagueId]
            );
        });

        const updated = await database.get(
            'SELECT id as roster_id, league_id, user_id, display_name, current_elo, is_admin, joined_at FROM league_roster WHERE id = ?',
            [rosterId]
        );
        await markLeagueSnapshotDirty(leagueId);
        res.json({ message: 'Roster entry assigned', roster: updated });
    } catch (error) {
        console.error('Assign roster entry error:', error);
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
            'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, targetUserId]
        );
        
        if (existingMember) {
            return res.status(409).json({ error: 'User is already a member of this league' });
        }
        
        // Check if there's already a pending invite
        const existingInvite = await database.get(
            'SELECT id FROM league_invites WHERE league_id = ? AND invited_user_id = ? AND status = ?',
            [leagueId, targetUserId, 'pending']
        );
        
        if (existingInvite) {
            return res.status(409).json({ error: 'User already has a pending invite to this league' });
        }
        
        // Generate invite code
        const inviteCode = crypto.randomBytes(16).toString('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
        
        // Create invite
        let inviteResult;
        try {
            inviteResult = await database.run(
                'INSERT INTO league_invites (league_id, invited_user_id, invited_by, invite_code, expires_at) VALUES (?, ?, ?, ?, ?)',
                [leagueId, targetUserId, req.user.id, inviteCode, expiresAt.toISOString()]
            );
        } catch (insertError) {
            console.error('Failed to insert league invite:', insertError);
            console.error('Insert error details:', {
                leagueId,
                targetUserId,
                invited_by: req.user.id,
                error: insertError.message,
                stack: insertError.stack,
                code: insertError.code
            });
            return res.status(500).json({ 
                error: 'Failed to create invite',
                details: process.env.NODE_ENV === 'development' ? insertError.message : undefined
            });
        }
        
        // Get league name for notification
        const league = await database.get('SELECT name FROM leagues WHERE id = ?', [leagueId]);
        
        // Create notification (non-blocking)
        try {
            await database.run(
                'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                [
                    targetUserId,
                    'league_invite',
                    'League Invitation',
                    `You have been invited to join the league "${league?.name || 'Unknown'}"`,
                    leagueId
                ]
            );
        } catch (notifError) {
            // Notification failure shouldn't block invite creation
            console.warn('Failed to create notification for league invite (non-blocking):', {
                userId: targetUserId,
                leagueId,
                error: notifError.message
            });
        }
        
        res.json({
            message: 'User invited successfully',
            invite_code: inviteCode,
            expires_at: expiresAt.toISOString()
        });
    } catch (error) {
        console.error('Invite user error:', error);
        console.error('Invite user error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            leagueId: req.params.id,
            body: req.body,
            userId: req.user?.id
        });
        res.status(500).json({ 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Request to join league
 * POST /api/leagues/:id/join-requests
 */
router.post('/:id/join-requests', authenticateToken, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);

        const league = await database.get(
            'SELECT id, name, is_public, is_active FROM leagues WHERE id = ? AND is_active = ?',
            [leagueId, true]
        );

        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }

        const membership = await database.get(
            'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, req.user.id]
        );

        if (membership) {
            return res.status(409).json({ error: 'You are already a member of this league' });
        }

        const pendingInvite = await database.get(
            'SELECT id FROM league_invites WHERE league_id = ? AND invited_user_id = ? AND status = ?',
            [leagueId, req.user.id, 'pending']
        );

        if (pendingInvite) {
            return res.status(409).json({ error: 'You already have a pending invite to this league' });
        }

        const existingRequest = await database.get(
            'SELECT id FROM league_join_requests WHERE league_id = ? AND user_id = ? AND status = ?',
            [leagueId, req.user.id, 'pending']
        );

        if (existingRequest) {
            return res.status(409).json({ error: 'You already have a pending join request for this league' });
        }

        await database.run(
            'INSERT INTO league_join_requests (league_id, user_id) VALUES (?, ?)',
            [leagueId, req.user.id]
        );

        const adminRows = await database.all(
            'SELECT user_id FROM league_roster WHERE league_id = ? AND is_admin = ? AND user_id IS NOT NULL',
            [leagueId, true]
        );

        const adminIds = Array.from(new Set(adminRows.map((row) => row.user_id)));
        if (adminIds.length > 0) {
            try {
                const title = 'Join request';
                const message = `${req.user.username} requested to join "${league.name}"`;
                for (const adminId of adminIds) {
                    await database.run(
                        'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                        [adminId, 'league_join_request', title, message, leagueId]
                    );
                }
            } catch (notifError) {
                console.warn('Failed to notify admins about join request (non-blocking):', {
                    leagueId,
                    userId: req.user.id,
                    error: notifError.message
                });
            }
        }

        res.json({ message: 'Join request sent' });
    } catch (error) {
        console.error('Request join error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * List join requests (league admins only)
 * GET /api/leagues/:id/join-requests
 */
router.get('/:id/join-requests', authenticateToken, requireLeagueAdmin, validateId, validatePagination, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const pageValue = parseInt(req.query.page);
        const limitValue = parseInt(req.query.limit);
        const page = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
        const limit = Number.isFinite(limitValue) && limitValue > 0 ? limitValue : 20;
        const offset = (page - 1) * limit;
        const statusFilter = 'pending';

        const requests = await database.all(`
            SELECT 
                jr.id, jr.user_id, jr.status, jr.created_at,
                u.username, u.first_name, u.last_name
            FROM league_join_requests jr
            JOIN users u ON jr.user_id = u.id
            WHERE jr.league_id = ? AND jr.status = ?
            ORDER BY jr.created_at DESC
            LIMIT ? OFFSET ?
        `, [leagueId, statusFilter, limit, offset]);

        const totalCount = await database.get(
            'SELECT COUNT(*) as count FROM league_join_requests WHERE league_id = ? AND status = ?',
            [leagueId, statusFilter]
        );

        res.json({
            requests,
            pagination: {
                page,
                limit,
                total: totalCount.count,
                pages: Math.ceil(totalCount.count / limit)
            }
        });
    } catch (error) {
        console.error('Get join requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Approve join request (league admins only)
 * POST /api/leagues/:id/join-requests/:requestId/approve
 */
router.post('/:id/join-requests/:requestId/approve', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const requestId = parseInt(req.params.requestId);

        if (!Number.isFinite(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }

        const joinRequest = await database.get(
            'SELECT id, user_id, status FROM league_join_requests WHERE id = ? AND league_id = ?',
            [requestId, leagueId]
        );

        if (!joinRequest) {
            return res.status(404).json({ error: 'Join request not found' });
        }

        if (joinRequest.status !== 'pending') {
            return res.status(409).json({ error: 'Join request has already been handled' });
        }

        const membership = await database.get(
            'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, joinRequest.user_id]
        );

        if (membership) {
            return res.status(409).json({ error: 'User is already a member of this league' });
        }

        const lastMatch = await database.get(`
            SELECT 
                CASE 
                    WHEN m.player1_id = ? THEN m.player1_elo_after
                    WHEN m.player2_id = ? THEN m.player2_elo_after
                    ELSE NULL
                END as last_elo
            FROM matches m
            WHERE m.league_id = ? 
            AND (m.player1_id = ? OR m.player2_id = ?)
            AND m.is_accepted = ?
            ORDER BY m.played_at DESC
            LIMIT 1
        `, [joinRequest.user_id, joinRequest.user_id, leagueId, joinRequest.user_id, joinRequest.user_id, true]);

        let initialElo = 1200;
        if (lastMatch && lastMatch.last_elo) {
            initialElo = lastMatch.last_elo;
        }

        const userRow = await database.get('SELECT username FROM users WHERE id = ?', [joinRequest.user_id]);
        const displayName = userRow.username;

        await database.run(
            'INSERT INTO league_roster (league_id, user_id, display_name, current_elo) VALUES (?, ?, ?, ?)',
            [leagueId, joinRequest.user_id, displayName, initialElo]
        );

        await database.run(
            'UPDATE league_join_requests SET status = ?, responded_at = CURRENT_TIMESTAMP, responded_by = ? WHERE id = ?',
            ['approved', req.user.id, requestId]
        );

        const league = await database.get('SELECT name FROM leagues WHERE id = ?', [leagueId]);
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        const leagueName = league.name;
        await markLeagueSnapshotDirty(leagueId);

        try {
            const title = 'Join request approved';
            const message = `Your request to join "${leagueName}" was approved`;
            await database.run(
                'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                [joinRequest.user_id, 'league_join_approved', title, message, leagueId]
            );
        } catch (notifError) {
            console.warn('Failed to notify user about join approval (non-blocking):', {
                leagueId,
                userId: joinRequest.user_id,
                error: notifError.message
            });
        }

        res.json({ message: 'Join request approved' });
    } catch (error) {
        console.error('Approve join request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Decline join request (league admins only)
 * POST /api/leagues/:id/join-requests/:requestId/decline
 */
router.post('/:id/join-requests/:requestId/decline', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const requestId = parseInt(req.params.requestId);

        if (!Number.isFinite(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }

        const joinRequest = await database.get(
            'SELECT id, user_id, status FROM league_join_requests WHERE id = ? AND league_id = ?',
            [requestId, leagueId]
        );

        if (!joinRequest) {
            return res.status(404).json({ error: 'Join request not found' });
        }

        if (joinRequest.status !== 'pending') {
            return res.status(409).json({ error: 'Join request has already been handled' });
        }

        await database.run(
            'UPDATE league_join_requests SET status = ?, responded_at = CURRENT_TIMESTAMP, responded_by = ? WHERE id = ?',
            ['declined', req.user.id, requestId]
        );

        const league = await database.get('SELECT name FROM leagues WHERE id = ?', [leagueId]);
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        const leagueName = league.name;

        try {
            const title = 'Join request declined';
            const message = `Your request to join "${leagueName}" was declined`;
            await database.run(
                'INSERT INTO notifications (user_id, type, title, message, related_id) VALUES (?, ?, ?, ?, ?)',
                [joinRequest.user_id, 'league_join_declined', title, message, leagueId]
            );
        } catch (notifError) {
            console.warn('Failed to notify user about join decline (non-blocking):', {
                leagueId,
                userId: joinRequest.user_id,
                error: notifError.message
            });
        }

        res.json({ message: 'Join request declined' });
    } catch (error) {
        console.error('Decline join request error:', error);
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
        const { invite_code } = req.body || {};
        
        // Check if user is already a member
        const existingMember = await database.get(
            'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, req.user.id]
        );
        
        if (existingMember) {
            return res.status(409).json({ error: 'You are already a member of this league' });
        }
        
        // Find and validate invite
        let invite;
        if (invite_code) {
            // Code-based join (existing flow)
            invite = await database.get(
                'SELECT id, expires_at FROM league_invites WHERE league_id = ? AND invited_user_id = ? AND invite_code = ? AND status = ?',
                [leagueId, req.user.id, invite_code, 'pending']
            );
        } else {
            // Code-less join triggered from notification: use any pending invite for this league and user
            invite = await database.get(
                'SELECT id, expires_at FROM league_invites WHERE league_id = ? AND invited_user_id = ? AND status = ?',
                [leagueId, req.user.id, 'pending']
            );
        }
        
        if (!invite) {
            return res.status(404).json({ error: 'No valid pending invite found for this league' });
        }
        
        // Check if invite has expired
        if (new Date(invite.expires_at) < new Date()) {
            return res.status(400).json({ error: 'Invite has expired' });
        }
        
        // Check if user has match history in this league to restore their ELO
        const lastMatch = await database.get(`
            SELECT 
                CASE 
                    WHEN m.player1_id = ? THEN m.player1_elo_after
                    WHEN m.player2_id = ? THEN m.player2_elo_after
                    ELSE NULL
                END as last_elo
            FROM matches m
            WHERE m.league_id = ? 
            AND (m.player1_id = ? OR m.player2_id = ?)
            AND m.is_accepted = ?
            ORDER BY m.played_at DESC
            LIMIT 1
        `, [req.user.id, req.user.id, leagueId, req.user.id, req.user.id, true]);
        
        const initialElo = lastMatch && lastMatch.last_elo ? lastMatch.last_elo : 1200;
        
        // Add user to league roster (use username as display_name)
        // If they have match history, restore their last ELO; otherwise start at 1200
        await database.run(
            'INSERT INTO league_roster (league_id, user_id, display_name, current_elo) VALUES (?, ?, ?, ?)',
            [leagueId, req.user.id, req.user.username, initialElo]
        );
        
        // Update invite status
        await database.run(
            'UPDATE league_invites SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['accepted', invite.id]
        );
        
        // Get league info and current ELO
        const league = await database.get('SELECT name FROM leagues WHERE id = ?', [leagueId]);
        const rosterEntry = await database.get(
            'SELECT current_elo FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, req.user.id]
        );
        await markLeagueSnapshotDirty(leagueId);
        res.json({
            message: `Successfully joined league "${league.name}"`,
            current_elo: rosterEntry ? rosterEntry.current_elo : initialElo
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
            'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, req.user.id]
        );
        
        if (!membership) {
            return res.status(404).json({ error: 'You are not a member of this league' });
        }
        
        // Hard delete: remove roster entry, but matches retain user_id references
        // Match history will use user_id when roster entry is missing
        await database.run(
            'DELETE FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, req.user.id]
        );
        
        const league = await database.get('SELECT name FROM leagues WHERE id = ?', [leagueId]);
        await markLeagueSnapshotDirty(leagueId);
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
router.get('/:id/leaderboard', optionalAuth, validateId, validatePagination, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const includeBadgesParam = req.query.include_badges;
        const includeBadges = includeBadgesParam == null
            ? true
            : String(includeBadgesParam).toLowerCase() !== 'false';
        
        // Check if user has access to this league
        const league = await database.get('SELECT is_public FROM leagues WHERE id = ? AND is_active = ?', [leagueId, true]);
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        if (!league.is_public && req.user) {
            const membership = await database.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
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
                lr.id as roster_id,
                lr.user_id,
                u.username,
                u.first_name,
                u.last_name,
                u.avatar_url,
                lr.display_name,
                lr.current_elo,
                lr.joined_at,
                COUNT(CASE 
                    WHEN lr.user_id IS NOT NULL AND (m.player1_id = lr.user_id OR m.player2_id = lr.user_id) THEN m.id
                    WHEN lr.user_id IS NULL AND (m.player1_roster_id = lr.id OR m.player2_roster_id = lr.id) THEN m.id
                END) as matches_played,
                COUNT(CASE 
                    WHEN lr.user_id IS NOT NULL AND m.winner_id = lr.user_id THEN m.id
                    WHEN lr.user_id IS NULL AND m.winner_roster_id = lr.id THEN m.id
                END) as matches_won,
                ROW_NUMBER() OVER (ORDER BY lr.current_elo DESC) as rank
            FROM league_roster lr
            LEFT JOIN users u ON lr.user_id = u.id
            LEFT JOIN matches m ON m.league_id = lr.league_id 
                AND m.is_accepted = ?
                AND (
                    (lr.user_id IS NOT NULL AND (m.player1_id = lr.user_id OR m.player2_id = lr.user_id))
                    OR (lr.user_id IS NULL AND (m.player1_roster_id = lr.id OR m.player2_roster_id = lr.id))
                )
            WHERE lr.league_id = ? AND lr.is_participating = ?
            GROUP BY lr.id, lr.user_id, u.username, u.first_name, u.last_name, u.avatar_url, lr.display_name, lr.current_elo, lr.joined_at
            ORDER BY lr.current_elo DESC
            LIMIT ? OFFSET ?
        `, [true, leagueId, true, limit, offset]);

        // Total members for pagination
        const totalRow = await database.get(
            'SELECT COUNT(*) as count FROM league_roster WHERE league_id = ? AND is_participating = ?'
        , [leagueId, true]);
        
        let badgesByUser = new Map();
        if (includeBadges) {
            const userIds = Array.from(new Set(
                leaderboard
                    .map((player) => player.user_id)
                    .filter((userId) => userId != null)
            ));
            if (userIds.length > 0) {
                const placeholders = userIds.map(() => '?').join(', ');
                try {
                    const badgeRows = await database.all(`
                        SELECT 
                            ub.user_id,
                            b.id, b.name, b.description, b.icon, b.badge_type, b.image_url,
                            ub.earned_at
                        FROM user_badges ub
                        JOIN badges b ON ub.badge_id = b.id
                        WHERE ub.user_id IN (${placeholders})
                        AND (ub.league_id = ? OR ub.league_id IS NULL)
                        ORDER BY ub.user_id, ub.earned_at DESC
                    `, [...userIds, leagueId]);
                    badgesByUser = new Map();
                    badgeRows.forEach((row) => {
                        const key = String(row.user_id);
                        const current = badgesByUser.get(key) || [];
                        if (current.length >= 3) {
                            return;
                        }
                        current.push({
                            id: row.id,
                            name: row.name,
                            description: row.description,
                            icon: row.icon,
                            badge_type: row.badge_type,
                            image_url: row.image_url,
                            earned_at: row.earned_at,
                        });
                        badgesByUser.set(key, current);
                    });
                } catch (badgeError) {
                    console.warn('Failed to fetch leaderboard badges:', badgeError.message);
                }
            }
        }

        const leaderboardWithBadges = leaderboard.map((player) => {
            const winRate = player.matches_played > 0
                ? Math.round((player.matches_won / player.matches_played) * 100)
                : 0;
            if (!includeBadges) {
                return {
                    ...player,
                    win_rate: winRate,
                };
            }
            const badgeList = player.user_id != null
                ? (badgesByUser.get(String(player.user_id)) || [])
                : [];
            return {
                ...player,
                win_rate: winRate,
                badges: badgeList,
            };
        });
        
        if (league.is_public) {
            setPublicCacheHeaders(req, res);
        }
        res.json({
            leaderboard: leaderboardWithBadges,
            pagination: {
                page,
                limit,
                total: totalRow?.count || 0,
                pages: Math.ceil((totalRow?.count || 0) / limit)
            }
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get league ELO range
 * GET /api/leagues/:id/elo-range
 */
router.get('/:id/elo-range', optionalAuth, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);

        const league = await database.get('SELECT is_public FROM leagues WHERE id = ? AND is_active = ?', [leagueId, true]);
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }

        if (!league.is_public) {
            if (!req.user) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }

            const membership = await database.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );

            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        }

        const rangeRow = await database.get(
            'SELECT MIN(current_elo) as min_elo, MAX(current_elo) as max_elo FROM league_roster WHERE league_id = ?',
            [leagueId]
        );

        let minElo = null;
        let maxElo = null;
        if (rangeRow) {
            minElo = rangeRow.min_elo;
            maxElo = rangeRow.max_elo;
        }

        if (league.is_public) {
            setPublicCacheHeaders(req, res);
        }

        res.json({ min_elo: minElo, max_elo: maxElo });
    } catch (error) {
        console.error('Get league ELO range error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get league ELO timeline for multiple roster entries
 * GET /api/leagues/:id/elo-timeline?roster_ids=1,2&limit=50
 */
router.get('/:id/elo-timeline', optionalAuth, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const rosterIdsParam = req.query.roster_ids;

        if (!rosterIdsParam || typeof rosterIdsParam !== 'string') {
            return res.status(400).json({ error: 'roster_ids parameter is required' });
        }

        const rosterIds = rosterIdsParam
            .split(',')
            .map((value) => parseInt(value))
            .filter((value) => Number.isFinite(value));

        if (rosterIds.length === 0) {
            return res.status(400).json({ error: 'No valid roster IDs provided' });
        }

        const limitValue = parseInt(req.query.limit);
        let limit = 50;
        if (Number.isFinite(limitValue) && limitValue > 0) {
            limit = limitValue > 200 ? 200 : limitValue;
        }

        const league = await database.get('SELECT is_public FROM leagues WHERE id = ? AND is_active = ?', [leagueId, true]);
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }

        if (!league.is_public) {
            if (!req.user) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }

            const membership = await database.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );

            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        }

        const placeholders = rosterIds.map(() => '?').join(', ');
        const rosterRows = await database.all(`
            SELECT 
                lr.id as roster_id,
                lr.user_id,
                lr.display_name,
                u.username
            FROM league_roster lr
            LEFT JOIN users u ON lr.user_id = u.id
            WHERE lr.league_id = ? AND lr.id IN (${placeholders})
        `, [leagueId, ...rosterIds]);

        if (rosterRows.length === 0) {
            return res.json({ items: [] });
        }

        const rosterMap = new Map();
        rosterRows.forEach((row) => {
            rosterMap.set(row.roster_id, {
                roster_id: row.roster_id,
                user_id: row.user_id,
                display_name: row.display_name,
                username: row.username,
                history: []
            });
        });

        const rosterIdList = rosterRows.map((row) => row.roster_id);
        const historyPlaceholders = rosterIdList.map(() => '?').join(', ');
        const historyRows = await database.all(`
            SELECT 
                eh.roster_id,
                eh.user_id,
                eh.elo_before,
                eh.elo_after,
                eh.recorded_at,
                m.played_at
            FROM elo_history eh
            LEFT JOIN matches m ON eh.match_id = m.id
            WHERE eh.league_id = ? AND eh.roster_id IN (${historyPlaceholders})
            ORDER BY COALESCE(m.played_at, eh.recorded_at) ASC
        `, [leagueId, ...rosterIdList]);

        historyRows.forEach((row) => {
            const entry = rosterMap.get(row.roster_id);
            if (!entry) return;
            let recordedAt = row.recorded_at;
            if (row.played_at) {
                recordedAt = row.played_at;
            }
            entry.history.push({
                recorded_at: recordedAt,
                elo_before: row.elo_before,
                elo_after: row.elo_after
            });
        });

        const items = Array.from(rosterMap.values()).map((entry) => {
            if (entry.history.length > limit) {
                entry.history = entry.history.slice(entry.history.length - limit);
            }
            return entry;
        });

        if (league.is_public) {
            setPublicCacheHeaders(req, res);
        }
        res.json({ items });
    } catch (error) {
        console.error('Get league ELO timeline error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get ELO history by roster ID (for placeholder members)
 * GET /api/leagues/:id/roster/:rosterId/elo-history
 */
router.get('/:id/roster/:rosterId/elo-history', optionalAuth, validateId, validatePagination, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const rosterId = parseInt(req.params.rosterId);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        
        // Check league visibility
        const league = await database.get('SELECT is_public FROM leagues WHERE id = ? AND is_active = ?', [leagueId, true]);
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        if (!league.is_public) {
            if (!req.user) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
            
            const membership = await database.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            
            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        }
        
        // Verify roster exists in this league
        const roster = await database.get('SELECT id FROM league_roster WHERE id = ? AND league_id = ?', [rosterId, leagueId]);
        if (!roster) {
            return res.status(404).json({ error: 'Roster member not found' });
        }
        
        // Build query for ELO history by roster_id
        // Use LEFT JOINs and fallbacks for opponent info (in case opponent roster was deleted)
        let query = `
            SELECT 
                eh.recorded_at, eh.elo_before, eh.elo_after, 
                (eh.elo_after - eh.elo_before) as elo_change,
                eh.match_id, m.played_at,
                COALESCE(opp_roster.display_name, opp_user.username, 'Unknown') as opponent_display_name,
                CASE 
                    WHEN m.player1_roster_id = ? THEN m.player1_sets_won
                    ELSE m.player2_sets_won
                END as user_sets_won,
                CASE 
                    WHEN m.player1_roster_id = ? THEN m.player2_sets_won
                    ELSE m.player1_sets_won
                END as opponent_sets_won,
                CASE 
                    WHEN m.winner_roster_id = ? THEN 'W'
                    WHEN m.winner_roster_id IS NOT NULL THEN 'L'
                    ELSE 'D'
                END as result
            FROM elo_history eh
            JOIN matches m ON eh.match_id = m.id
            LEFT JOIN league_roster opp_roster ON (
                CASE
                    WHEN m.player1_roster_id = ? THEN m.player2_roster_id
                    ELSE m.player1_roster_id
                END = opp_roster.id
            )
            LEFT JOIN users opp_user ON (
                CASE
                    WHEN m.player1_roster_id = ? THEN m.player2_id
                    ELSE m.player1_id
                END = opp_user.id
            )
            WHERE eh.roster_id = ? AND eh.league_id = ?
        `;
        
        const params = [rosterId, rosterId, rosterId, rosterId, rosterId, rosterId, leagueId];
        
        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*) as count
            FROM elo_history eh
            WHERE eh.roster_id = ? AND eh.league_id = ?
        `;
        
        const totalCount = await database.get(countQuery, [rosterId, leagueId]);
        
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
        console.error('Get roster ELO history error:', error);
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
        const league = await database.get('SELECT is_public FROM leagues WHERE id = ? AND is_active = ?', [leagueId, true]);
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        if (!league.is_public && req.user) {
            const membership = await database.get(
                'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            
            if (!membership && !req.user.is_admin) {
                return res.status(403).json({ error: 'Access denied to private league' });
            }
        } else if (!league.is_public && !req.user) {
            return res.status(403).json({ error: 'Access denied to private league' });
        }
        
        // Match visibility:
        // - Site admins and league admins may view all accepted matches in the league.
        // - Regular users may only view matches they participated in.
        //
        // NOTE: We keep this endpoint reachable without auth (public league page),
        // but unauthenticated users will receive an empty list (no match leakage).
        if (!req.user) {
            return res.json({
                matches: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    pages: 0
                }
            });
        }

        const isSiteAdmin = !!req.user.is_admin;
        let isLeagueAdmin = false;
        if (!isSiteAdmin) {
            const adminRow = await database.get(
                'SELECT is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueId, req.user.id]
            );
            isLeagueAdmin = !!adminRow?.is_admin;
        }

        let whereClause = 'm.league_id = ? AND m.is_accepted = ?';
        const params = [leagueId, true];

        if (!isSiteAdmin && !isLeagueAdmin) {
            whereClause += ' AND (m.player1_id = ? OR m.player2_id = ?)';
            params.push(req.user.id, req.user.id);
        }

        const matches = await database.all(`
            SELECT 
                m.id, m.player1_sets_won, m.player2_sets_won, m.player1_points_total, m.player2_points_total,
                m.game_type, m.winner_id, m.is_accepted, m.elo_applied, m.elo_applied_at, m.played_at,
                m.player1_roster_id, m.player2_roster_id, m.winner_roster_id,
                COALESCE(r1.display_name, u1_fallback.username) as player1_display_name,
                COALESCE(r2.display_name, u2_fallback.username) as player2_display_name,
                COALESCE(u1.id, m.player1_id) as player1_user_id, 
                COALESCE(u1.username, u1_fallback.username) as player1_username,
                COALESCE(u2.id, m.player2_id) as player2_user_id, 
                COALESCE(u2.username, u2_fallback.username) as player2_username,
                m.player1_elo_before, m.player2_elo_before, m.player1_elo_after, m.player2_elo_after
            FROM matches m
            LEFT JOIN league_roster r1 ON m.player1_roster_id = r1.id
            LEFT JOIN league_roster r2 ON m.player2_roster_id = r2.id
            LEFT JOIN users u1 ON r1.user_id = u1.id
            LEFT JOIN users u2 ON r2.user_id = u2.id
            LEFT JOIN users u1_fallback ON m.player1_id = u1_fallback.id
            LEFT JOIN users u2_fallback ON m.player2_id = u2_fallback.id
            WHERE ${whereClause}
            ORDER BY m.played_at DESC
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
        console.error('Get league matches error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * List league invites (league admin only)
 * GET /api/leagues/:id/invites?status=pending|accepted|revoked
 */
router.get('/:id/invites', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const { status } = req.query || {};

        const where = ['li.league_id = ?'];
        const params = [leagueId];
        if (status) {
            where.push('li.status = ?');
            params.push(status);
        }

        const invites = await database.all(
            `SELECT 
                li.id, li.invite_code, li.status, li.expires_at, li.created_at, li.responded_at,
                li.invited_user_id, u.username as invited_username,
                li.invited_by, ub.username as invited_by_username
             FROM league_invites li
             JOIN users u ON li.invited_user_id = u.id
             JOIN users ub ON li.invited_by = ub.id
             WHERE ${where.join(' AND ')}
             ORDER BY li.created_at DESC`,
            params
        );

        res.json({ invites });
    } catch (error) {
        console.error('List league invites error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Revoke a pending invite (league admin only)
 * DELETE /api/leagues/:id/invites/:inviteId
 */
router.delete('/:id/invites/:inviteId', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const inviteId = parseInt(req.params.inviteId);

        const invite = await database.get(
            'SELECT id, status FROM league_invites WHERE id = ? AND league_id = ?',
            [inviteId, leagueId]
        );
        if (!invite) {
            return res.status(404).json({ error: 'Invite not found' });
        }
        if (invite.status !== 'pending') {
            return res.status(400).json({ error: 'Only pending invites can be revoked' });
        }

        await database.run(
            'UPDATE league_invites SET status = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?',
            ['revoked', inviteId]
        );

        res.json({ message: 'Invite revoked' });
    } catch (error) {
        console.error('Revoke invite error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Promote a member to league admin (league admin only)
 * POST /api/leagues/:id/members/:userId/promote
 */
router.post('/:id/members/:userId/promote', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);

        const membership = await database.get(
            'SELECT id, is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, userId]
        );
        if (!membership) {
            return res.status(404).json({ error: 'User is not a member of this league' });
        }
        if (membership.is_admin) {
            return res.status(400).json({ error: 'User is already an admin' });
        }

        await database.run(
            'UPDATE league_roster SET is_admin = ? WHERE league_id = ? AND user_id = ?',
            [true, leagueId, userId]
        );

        await markLeagueSnapshotDirty(leagueId);
        res.json({ message: 'Member promoted to admin' });
    } catch (error) {
        console.error('Promote member error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Demote a league admin to member (league admin only)
 * POST /api/leagues/:id/members/:userId/demote
 * Safeguard: cannot demote the last remaining admin.
 */
router.post('/:id/members/:userId/demote', authenticateToken, requireLeagueAdmin, validateId, async (req, res) => {
    try {
        const leagueId = parseInt(req.params.id);
        const userId = parseInt(req.params.userId);

        const membership = await database.get(
            'SELECT id, is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, userId]
        );
        if (!membership) {
            return res.status(404).json({ error: 'User is not a member of this league' });
        }
        if (!membership.is_admin) {
            return res.status(400).json({ error: 'User is not an admin' });
        }

        const adminCount = await database.get(
            'SELECT COUNT(*) as count FROM league_roster WHERE league_id = ? AND is_admin = ?',
            [leagueId, true]
        );
        if (adminCount && adminCount.count <= 1) {
            return res.status(400).json({ error: 'Cannot demote the last remaining admin' });
        }

        await database.run(
            'UPDATE league_roster SET is_admin = ? WHERE league_id = ? AND user_id = ?',
            [false, leagueId, userId]
        );

        await markLeagueSnapshotDirty(leagueId);
        res.json({ message: 'Admin demoted to member' });
    } catch (error) {
        console.error('Demote member error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

