const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateId, validatePagination } = require('../middleware/validation');
const { moderateText, ModerationError } = require('../middleware/contentModeration');
const database = require('../models/database');

const router = express.Router();

const VALID_BADGE_VISIBILITIES = new Set(['public', 'private']);

/**
 * Get all badges (authenticated)
 * GET /api/badges
 */
router.get('/', authenticateToken, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const sort = String(req.query.sort || 'created_desc');
        
        // Check if badges table exists first
        try {
            await database.get('SELECT 1 FROM badges LIMIT 1');
        } catch (tableError) {
            console.warn('Badges table might not exist yet:', tableError.message);
            // Return empty result if table doesn't exist
            return res.json({
                badges: [],
                pagination: {
                    page,
                    limit,
                    total: 0,
                    pages: 0
                }
            });
        }
        
        // List only:
        // - public (global) badges
        // - private badges created by the requesting user
        //
        // NOTE: `badges.visibility` / `badges.created_by` are ensured by DB startup migration.
        let badges;
        let totalCount;
        try {
            const orderBy = (() => {
                switch (sort) {
                    case 'created_desc':
                        return 'b.created_at DESC';
                    case 'created_asc':
                        return 'b.created_at ASC';
                    case 'awarded_desc':
                        return 'times_awarded DESC, b.created_at DESC';
                    case 'awarded_asc':
                        return 'times_awarded ASC, b.created_at DESC';
                    case 'last_awarded_desc':
                        return 'last_awarded_at DESC, b.created_at DESC';
                    case 'last_awarded_asc':
                        return 'last_awarded_at ASC, b.created_at DESC';
                    default:
                        return 'b.created_at DESC';
                }
            })();

            // Use subqueries for aggregates to avoid GROUP BY issues in PostgreSQL
            badges = await database.all(`
                SELECT 
                    b.id, b.name, b.description, b.icon, b.badge_type, b.image_url, b.created_at,
                    b.visibility, b.created_by,
                    COALESCE((SELECT COUNT(*) FROM user_badges ub WHERE ub.badge_id = b.id), 0) as times_awarded,
                    (SELECT MAX(ub.earned_at) FROM user_badges ub WHERE ub.badge_id = b.id) as last_awarded_at
                FROM badges b
                WHERE b.visibility = 'public' OR (b.visibility = 'private' AND b.created_by = ?)
                ORDER BY ${orderBy}
                LIMIT ? OFFSET ?
            `, [req.user.id, limit, offset]);

            
            totalCount = await database.get(
                `SELECT COUNT(*) as count
                 FROM badges b
                 WHERE b.visibility = 'public' OR (b.visibility = 'private' AND b.created_by = ?)`,
                [req.user.id]
            );
        } catch (queryError) {
            // If image_url column doesn't exist, try without it
            if (queryError.message && queryError.message.includes('image_url')) {
                console.warn('image_url column not found, querying without it:', queryError.message);
                const orderBy = (() => {
                    switch (sort) {
                        case 'created_desc':
                            return 'b.created_at DESC';
                        case 'created_asc':
                            return 'b.created_at ASC';
                        case 'awarded_desc':
                            return 'times_awarded DESC, b.created_at DESC';
                        case 'awarded_asc':
                            return 'times_awarded ASC, b.created_at DESC';
                        case 'last_awarded_desc':
                            return 'last_awarded_at DESC, b.created_at DESC';
                        case 'last_awarded_asc':
                            return 'last_awarded_at ASC, b.created_at DESC';
                        default:
                            return 'b.created_at DESC';
                    }
                })();
                badges = await database.all(`
                    SELECT 
                        b.id, b.name, b.description, b.icon, b.badge_type, b.created_at,
                        b.visibility, b.created_by,
                        COALESCE((SELECT COUNT(*) FROM user_badges ub WHERE ub.badge_id = b.id), 0) as times_awarded,
                        (SELECT MAX(ub.earned_at) FROM user_badges ub WHERE ub.badge_id = b.id) as last_awarded_at
                    FROM badges b
                  WHERE b.visibility = 'public' OR (b.visibility = 'private' AND b.created_by = ?)
                  ORDER BY ${orderBy}
                  LIMIT ? OFFSET ?
                `, [req.user.id, limit, offset]);
                // Add null image_url for compatibility
                badges = badges.map(b => ({ ...b, image_url: null }));
                totalCount = await database.get(
                    `SELECT COUNT(*) as count
                     FROM badges b
                     WHERE b.visibility = 'public' OR (b.visibility = 'private' AND b.created_by = ?)`,
                    [req.user.id]
                );
            } else {
                throw queryError;
            }
        }
        
        res.json({
            badges,
            pagination: {
                page,
                limit,
                total: totalCount.count,
                pages: Math.ceil(totalCount.count / limit)
            }
        });
    } catch (error) {
        console.error('Get badges error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({ error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
});

/**
 * Create a new badge (site admin only)
 * POST /api/badges
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, icon, badge_type, image_url, visibility } = req.body;

        moderateText(
            { name, description, icon, badge_type },
            { context: 'badge fields' }
        );
        
        // Validate required fields
        if (!name || !badge_type) {
            return res.status(400).json({ error: 'Name and badge_type are required' });
        }
        
        // Check if badges table exists
        try {
            await database.get('SELECT 1 FROM badges LIMIT 1');
        } catch (tableError) {
            console.error('Badges table does not exist:', tableError.message);
            return res.status(500).json({ error: 'Badges table not found. Please ensure database is initialized.' });
        }
        
        const requestedVisibility = (visibility || '').trim() || (req.user.is_admin ? 'public' : 'private');
        if (!VALID_BADGE_VISIBILITIES.has(requestedVisibility)) {
            return res.status(400).json({ error: "visibility must be 'public' or 'private'" });
        }

        const isPublic = requestedVisibility === 'public';
        if (isPublic && !req.user.is_admin) {
            return res.status(403).json({ error: 'Admin access required to create public badges' });
        }

        const ownerId = isPublic ? null : req.user.id;

        // Check name conflicts (public global uniqueness; private per-owner uniqueness)
        const existingBadge = isPublic
            ? await database.get('SELECT id FROM badges WHERE visibility = ? AND name = ?', ['public', name])
            : await database.get('SELECT id FROM badges WHERE visibility = ? AND created_by = ? AND name = ?', ['private', ownerId, name]);

        if (existingBadge) {
            return res.status(409).json({ error: 'Badge with this name already exists' });
        }
        
        // Insert new badge (handle image_url column potentially not existing)
        const result = await database.run(`
            INSERT INTO badges (name, description, icon, badge_type, image_url, visibility, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [name, description || null, icon || null, badge_type, image_url || null, requestedVisibility, ownerId]);
        
        // Get the created badge
        const newBadge = await database.get(
            'SELECT * FROM badges WHERE id = ?',
            [result.id]
        );
        
        res.status(201).json({
            message: 'Badge created successfully',
            badge: newBadge
        });
    } catch (error) {
        if (error instanceof ModerationError) {
            return res.status(error.status || 400).json({ error: error.message, code: error.code });
        }
        console.error('Create badge error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({ error: 'Internal server error', details: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
});

/**
 * Update a badge (site admin only)
 * PUT /api/badges/:id
 */
router.put('/:id', authenticateToken, requireAdmin, validateId, async (req, res) => {
    try {
        const badgeId = parseInt(req.params.id);
        const { name, description, icon, badge_type, image_url, visibility } = req.body;

        if (visibility !== undefined) {
            return res.status(400).json({ error: 'visibility cannot be changed after creation' });
        }

        moderateText(
            { name, description, icon, badge_type },
            { context: 'badge fields' }
        );
        
        // Check if badge exists
        const existingBadge = await database.get(
            'SELECT id, visibility, created_by FROM badges WHERE id = ?',
            [badgeId]
        );
        
        if (!existingBadge) {
            return res.status(404).json({ error: 'Badge not found' });
        }

        // Authorization:
        // - public badges: site admin only
        // - private badges: owner only
        if (existingBadge.visibility === 'public') {
            if (!req.user.is_admin) {
                return res.status(403).json({ error: 'Admin access required to edit public badges' });
            }
        } else if (existingBadge.visibility === 'private') {
            if (existingBadge.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Only the badge owner may edit this badge' });
            }
        } else {
            return res.status(500).json({ error: 'Invalid badge visibility state' });
        }
        
        // Check if name is being changed and if it conflicts
        if (name) {
            const nameConflict = existingBadge.visibility === 'public'
                ? await database.get(
                    'SELECT id FROM badges WHERE visibility = ? AND name = ? AND id != ?',
                    ['public', name, badgeId]
                )
                : await database.get(
                    'SELECT id FROM badges WHERE visibility = ? AND created_by = ? AND name = ? AND id != ?',
                    ['private', existingBadge.created_by, name, badgeId]
                );
            
            if (nameConflict) {
                return res.status(409).json({ error: 'Badge with this name already exists' });
            }
        }
        
        // Build update query
        const updates = [];
        const values = [];
        
        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        
        if (description !== undefined) {
            updates.push('description = ?');
            values.push(description);
        }
        
        if (icon !== undefined) {
            updates.push('icon = ?');
            values.push(icon);
        }
        
        if (badge_type !== undefined) {
            updates.push('badge_type = ?');
            values.push(badge_type);
        }
        
        if (image_url !== undefined) {
            updates.push('image_url = ?');
            values.push(image_url || null);
        }
        
        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        values.push(badgeId);
        
        await database.run(
            `UPDATE badges SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        // Get updated badge
        const updatedBadge = await database.get(
            'SELECT * FROM badges WHERE id = ?',
            [badgeId]
        );
        
        res.json({
            message: 'Badge updated successfully',
            badge: updatedBadge
        });
    } catch (error) {
        if (error instanceof ModerationError) {
            return res.status(error.status || 400).json({ error: error.message, code: error.code });
        }
        console.error('Update badge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Delete a badge (site admin only)
 * DELETE /api/badges/:id
 */
router.delete('/:id', authenticateToken, requireAdmin, validateId, async (req, res) => {
    try {
        const badgeId = parseInt(req.params.id);
        
        // Check if badge exists
        const badge = await database.get(
            'SELECT name, visibility, created_by FROM badges WHERE id = ?',
            [badgeId]
        );
        
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }

        // Authorization:
        // - public badges: site admin only
        // - private badges: owner only
        if (badge.visibility === 'public') {
            if (!req.user.is_admin) {
                return res.status(403).json({ error: 'Admin access required to delete public badges' });
            }
        } else if (badge.visibility === 'private') {
            if (badge.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Only the badge owner may delete this badge' });
            }
        } else {
            return res.status(500).json({ error: 'Invalid badge visibility state' });
        }
        
        // Check if badge is awarded to any users
        const awardedCount = await database.get(
            'SELECT COUNT(*) as count FROM user_badges WHERE badge_id = ?',
            [badgeId]
        );
        
        if (awardedCount.count > 0) {
            return res.status(400).json({ 
                error: `Cannot delete badge. It has been awarded to ${awardedCount.count} user(s).` 
            });
        }
        
        // Delete the badge
        await database.run('DELETE FROM badges WHERE id = ?', [badgeId]);
        
        res.json({ message: `Badge "${badge.name}" deleted successfully` });
    } catch (error) {
        console.error('Delete badge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Award a badge to a user (site admin OR league admin for the specified league)
 *
 * Notes:
 * - `league_id` is REQUIRED for all awards (no global awards).
 * - A league admin of that league may award.
 * - Site admins may award in any league.
 * POST /api/users/:id/badges
 */
router.post('/users/:id/badges', authenticateToken, validateId, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { badge_id, league_id, season } = req.body;

        if (!league_id) {
            return res.status(400).json({ error: 'league_id is required' });
        }

        const leagueIdInt = parseInt(league_id);
        if (Number.isNaN(leagueIdInt)) {
            return res.status(400).json({ error: 'league_id must be a number' });
        }

        // Authorization:
        // - site admins may award in any league
        // - league admins may award in their league
        if (!req.user.is_admin) {
            const awardingMembership = await database.get(
                'SELECT is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
                [leagueIdInt, req.user.id]
            );

            if (!awardingMembership || !awardingMembership.is_admin) {
                return res.status(403).json({ error: 'League admin access required' });
            }
        }
        
        // Validate required fields
        if (!badge_id) {
            return res.status(400).json({ error: 'badge_id is required' });
        }
        
        // Check if user exists
        const user = await database.get(
            'SELECT username FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if badge exists
        const badge = await database.get(
            'SELECT id, name, visibility, created_by FROM badges WHERE id = ?',
            [badge_id]
        );
        
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }

        // Private badges can only be awarded by their owner (and only in leagues they admin).
        // Public badges can be awarded by any league admin (or site admin).
        if (badge.visibility === 'private') {
            if (badge.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Only the badge owner may award this private badge' });
            }
        } else if (badge.visibility !== 'public') {
            return res.status(500).json({ error: 'Invalid badge visibility state' });
        }
        
        // Check if league exists (if provided) and validate membership
        const league = await database.get(
            'SELECT name FROM leagues WHERE id = ? AND is_active = ?',
            [leagueIdInt, true]
        );
        
        if (!league) {
            return res.status(404).json({ error: 'League not found' });
        }
        
        // Validate user is a member of the league
        const membership = await database.get(
            'SELECT id FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueIdInt, userId]
        );
        
        if (!membership) {
            return res.status(400).json({ 
                error: 'User is not a member of the specified league' 
            });
        }
        
        // Check if user already has this badge (for the same league/season if applicable)
        let existingAward;
        try {
            existingAward = await database.get(`
                SELECT id FROM user_badges 
                WHERE user_id = ? AND badge_id = ? 
                AND league_id = ?
                AND (season = ? OR (season IS NULL AND ? IS NULL))
            `, [userId, badge_id, leagueIdInt, season || null, season || null]);
        } catch (checkError) {
            console.error('Failed to check existing badge award:', checkError);
            console.error('Check error details:', {
                userId,
                badge_id,
                league_id: leagueIdInt,
                error: checkError.message
            });
        }
        
        if (existingAward) {
            return res.status(409).json({ error: 'User already has this badge' });
        }
        
        // Award the badge
        let result;
        try {
            result = await database.run(`
                INSERT INTO user_badges (user_id, badge_id, league_id, season)
                VALUES (?, ?, ?, ?)
            `, [userId, badge_id, leagueIdInt, season || null]);
        } catch (insertError) {
            console.error('Failed to insert badge award:', insertError);
            console.error('Insert error details:', {
                userId,
                badge_id,
                league_id: leagueIdInt,
                season,
                error: insertError.message,
                stack: insertError.stack,
                code: insertError.code,
                constraint: insertError.constraint
            });
            // Check if it's a foreign key constraint error
            if (insertError.code === '23503' || insertError.message?.includes('FOREIGN KEY')) {
                return res.status(400).json({ 
                    error: 'Invalid user, badge, or league ID',
                    details: process.env.NODE_ENV === 'development' ? insertError.message : undefined
                });
            }
            return res.status(500).json({ 
                error: 'Failed to award badge',
                details: process.env.NODE_ENV === 'development' ? insertError.message : undefined
            });
        }
        
        // Get the awarded badge details
        const awardedBadgeId = result.id;
        if (!awardedBadgeId) {
            console.error('Badge award result missing ID:', {
                result,
                userId,
                badge_id,
                league_id,
                isPg: database.isPg
            });
            return res.status(500).json({ 
                error: 'Failed to get badge award ID',
                details: process.env.NODE_ENV === 'development' ? 'Result ID was undefined after insert' : undefined
            });
        }
        
        const awardedBadge = await database.get(`
            SELECT 
                ub.id, ub.earned_at, ub.league_id, ub.season,
                b.name, b.description, b.icon, b.badge_type,
                l.name as league_name
            FROM user_badges ub
            JOIN badges b ON ub.badge_id = b.id
            LEFT JOIN leagues l ON ub.league_id = l.id
            WHERE ub.id = ?
        `, [awardedBadgeId]);
        
        if (!awardedBadge) {
            console.error('Failed to retrieve awarded badge after insert:', {
                awardedBadgeId,
                userId,
                badge_id
            });
            return res.status(500).json({ 
                error: 'Failed to retrieve awarded badge',
                details: process.env.NODE_ENV === 'development' ? `Could not find badge award with ID ${awardedBadgeId}` : undefined
            });
        }
        
        // Create notification for the user (non-blocking)
        try {
            await database.run(`
                INSERT INTO notifications (user_id, type, title, message, related_id)
                VALUES (?, 'badge_earned', ?, ?, ?)
            `, [
                userId,
                'Badge Earned!',
                `Congratulations! You've earned the "${badge.name}" badge.`,
                awardedBadge.id
            ]);
        } catch (notifError) {
            // Notification failure shouldn't block badge award
            console.warn('Failed to create notification for badge award (non-blocking):', {
                userId,
                badgeId: badge_id,
                error: notifError.message
            });
        }
        
        res.status(201).json({
            message: `Badge "${badge.name}" awarded successfully to ${user.username}`,
            awarded_badge: awardedBadge
        });
    } catch (error) {
        console.error('Award badge error:', error);
        console.error('Award badge error details:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            userId: req.params.id,
            body: req.body
        });
        res.status(500).json({ 
            error: 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * Get users with a specific badge (admin only)
 * GET /api/badges/:id/users
 */
router.get('/:id/users', authenticateToken, validateId, async (req, res) => {
    try {
        const badgeId = parseInt(req.params.id);
        
        // Check if badge exists
        const badge = await database.get(
            'SELECT id, name, visibility, created_by FROM badges WHERE id = ?',
            [badgeId]
        );
        
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }

        // Authorization:
        // - site admins may view any badge usage
        // - private badge owners may view usage of their own private badges
        if (!req.user.is_admin) {
            const isOwnerOfPrivate = badge.visibility === 'private' && badge.created_by === req.user.id;
            if (!isOwnerOfPrivate) {
                return res.status(403).json({ error: 'Admin access required' });
            }
        }
        
        // Get all users with this badge
        const users = await database.all(`
            SELECT 
                u.id, u.username, u.first_name, u.last_name,
                ub.id as user_badge_id, ub.earned_at, ub.league_id, ub.season,
                l.name as league_name
            FROM user_badges ub
            JOIN users u ON ub.user_id = u.id
            LEFT JOIN leagues l ON ub.league_id = l.id
            WHERE ub.badge_id = ?
            ORDER BY ub.earned_at DESC
        `, [badgeId]);
        
        res.json({ users });
    } catch (error) {
        console.error('Get badge users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Remove a badge from a user (admin only)
 * DELETE /api/users/:id/badges/:badgeId
 */
router.delete('/users/:id/badges/:badgeId', authenticateToken, requireAdmin, validateId, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const badgeId = parseInt(req.params.badgeId);
        
        // Check if user exists
        const user = await database.get(
            'SELECT username FROM users WHERE id = ?',
            [userId]
        );
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Check if badge exists
        const badge = await database.get(
            'SELECT name FROM badges WHERE id = ?',
            [badgeId]
        );
        
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }
        
        // Check if user has this badge
        const userBadge = await database.get(
            'SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?',
            [userId, badgeId]
        );
        
        if (!userBadge) {
            return res.status(404).json({ error: 'User does not have this badge' });
        }
        
        // Remove the badge
        await database.run(
            'DELETE FROM user_badges WHERE user_id = ? AND badge_id = ?',
            [userId, badgeId]
        );
        
        res.json({ 
            message: `Badge "${badge.name}" removed from ${user.username}` 
        });
    } catch (error) {
        console.error('Remove badge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
