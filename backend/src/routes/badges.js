const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateId, validatePagination } = require('../middleware/validation');
const database = require('../models/database');

const router = express.Router();

/**
 * Get all badges (admin only)
 * GET /api/badges
 */
router.get('/', authenticateToken, requireAdmin, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        
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
        
        // Try to get badges with image_url, fallback if column doesn't exist
        let badges;
        let totalCount;
        try {
            // Use subquery for times_awarded to avoid GROUP BY issues in PostgreSQL
            badges = await database.all(`
                SELECT 
                    b.id, b.name, b.description, b.icon, b.badge_type, b.image_url, b.created_at,
                    COALESCE((SELECT COUNT(*) FROM user_badges ub WHERE ub.badge_id = b.id), 0) as times_awarded
                FROM badges b
                ORDER BY b.created_at DESC
                LIMIT ? OFFSET ?
            `, [limit, offset]);
            
            totalCount = await database.get('SELECT COUNT(*) as count FROM badges');
        } catch (queryError) {
            // If image_url column doesn't exist, try without it
            if (queryError.message && queryError.message.includes('image_url')) {
                console.warn('image_url column not found, querying without it:', queryError.message);
                badges = await database.all(`
                    SELECT 
                        b.id, b.name, b.description, b.icon, b.badge_type, b.created_at,
                        COALESCE((SELECT COUNT(*) FROM user_badges ub WHERE ub.badge_id = b.id), 0) as times_awarded
                    FROM badges b
                    ORDER BY b.created_at DESC
                    LIMIT ? OFFSET ?
                `, [limit, offset]);
                // Add null image_url for compatibility
                badges = badges.map(b => ({ ...b, image_url: null }));
                totalCount = await database.get('SELECT COUNT(*) as count FROM badges');
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
 * Create a new badge (admin only)
 * POST /api/badges
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, icon, badge_type, image_url } = req.body;
        
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
        
        // Check if badge with same name already exists
        const existingBadge = await database.get(
            'SELECT id FROM badges WHERE name = ?',
            [name]
        );
        
        if (existingBadge) {
            return res.status(409).json({ error: 'Badge with this name already exists' });
        }
        
        // Insert new badge (handle image_url column potentially not existing)
        const result = await database.run(`
            INSERT INTO badges (name, description, icon, badge_type, image_url)
            VALUES (?, ?, ?, ?, ?)
        `, [name, description || null, icon || null, badge_type, image_url || null]);
        
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
 * Update a badge (admin only)
 * PUT /api/badges/:id
 */
router.put('/:id', authenticateToken, requireAdmin, validateId, async (req, res) => {
    try {
        const badgeId = parseInt(req.params.id);
        const { name, description, icon, badge_type, image_url } = req.body;
        
        // Check if badge exists
        const existingBadge = await database.get(
            'SELECT id FROM badges WHERE id = ?',
            [badgeId]
        );
        
        if (!existingBadge) {
            return res.status(404).json({ error: 'Badge not found' });
        }
        
        // Check if name is being changed and if it conflicts
        if (name) {
            const nameConflict = await database.get(
                'SELECT id FROM badges WHERE name = ? AND id != ?',
                [name, badgeId]
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
        console.error('Update badge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Delete a badge (admin only)
 * DELETE /api/badges/:id
 */
router.delete('/:id', authenticateToken, requireAdmin, validateId, async (req, res) => {
    try {
        const badgeId = parseInt(req.params.id);
        
        // Check if badge exists
        const badge = await database.get(
            'SELECT name FROM badges WHERE id = ?',
            [badgeId]
        );
        
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
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
 * Award a badge to a user (admin only)
 * POST /api/users/:id/badges
 */
router.post('/users/:id/badges', authenticateToken, requireAdmin, validateId, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const { badge_id, league_id, season } = req.body;
        
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
            'SELECT name FROM badges WHERE id = ?',
            [badge_id]
        );
        
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
        }
        
        // Check if league exists (if provided) and validate membership
        if (league_id) {
            const league = await database.get(
                'SELECT name FROM leagues WHERE id = ? AND is_active = ?',
                [league_id, true]
            );
            
            if (!league) {
                return res.status(404).json({ error: 'League not found' });
            }
            
            // Validate user is a member of the league
            const membership = await database.get(
                'SELECT id FROM league_members WHERE league_id = ? AND user_id = ?',
                [league_id, userId]
            );
            
            if (!membership) {
                return res.status(400).json({ 
                    error: 'User is not a member of the specified league' 
                });
            }
        }
        
        // Check if user already has this badge (for the same league/season if applicable)
        let existingAward;
        try {
            existingAward = await database.get(`
                SELECT id FROM user_badges 
                WHERE user_id = ? AND badge_id = ? 
                AND (league_id = ? OR (league_id IS NULL AND ? IS NULL))
                AND (season = ? OR (season IS NULL AND ? IS NULL))
            `, [userId, badge_id, league_id || null, league_id || null, season || null, season || null]);
        } catch (checkError) {
            console.error('Failed to check existing badge award:', checkError);
            console.error('Check error details:', {
                userId,
                badge_id,
                league_id,
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
            `, [userId, badge_id, league_id || null, season || null]);
        } catch (insertError) {
            console.error('Failed to insert badge award:', insertError);
            console.error('Insert error details:', {
                userId,
                badge_id,
                league_id,
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
router.get('/:id/users', authenticateToken, requireAdmin, validateId, async (req, res) => {
    try {
        const badgeId = parseInt(req.params.id);
        
        // Check if badge exists
        const badge = await database.get(
            'SELECT name FROM badges WHERE id = ?',
            [badgeId]
        );
        
        if (!badge) {
            return res.status(404).json({ error: 'Badge not found' });
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
