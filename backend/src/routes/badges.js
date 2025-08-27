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
        
        const badges = await database.all(`
            SELECT 
                b.id, b.name, b.description, b.icon, b.badge_type, b.created_at,
                COUNT(ub.id) as times_awarded
            FROM badges b
            LEFT JOIN user_badges ub ON b.id = ub.badge_id
            GROUP BY b.id
            ORDER BY b.created_at DESC
            LIMIT ? OFFSET ?
        `, [limit, offset]);
        
        const totalCount = await database.get('SELECT COUNT(*) as count FROM badges');
        
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
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Create a new badge (admin only)
 * POST /api/badges
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { name, description, icon, badge_type } = req.body;
        
        // Validate required fields
        if (!name || !badge_type) {
            return res.status(400).json({ error: 'Name and badge_type are required' });
        }
        
        // Check if badge with same name already exists
        const existingBadge = await database.get(
            'SELECT id FROM badges WHERE name = ?',
            [name]
        );
        
        if (existingBadge) {
            return res.status(409).json({ error: 'Badge with this name already exists' });
        }
        
        // Insert new badge
        const result = await database.run(`
            INSERT INTO badges (name, description, icon, badge_type)
            VALUES (?, ?, ?, ?)
        `, [name, description || null, icon || null, badge_type]);
        
        // Get the created badge
        const newBadge = await database.get(
            'SELECT * FROM badges WHERE id = ?',
            [result.lastID]
        );
        
        res.status(201).json({
            message: 'Badge created successfully',
            badge: newBadge
        });
    } catch (error) {
        console.error('Create badge error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Update a badge (admin only)
 * PUT /api/badges/:id
 */
router.put('/:id', authenticateToken, requireAdmin, validateId, async (req, res) => {
    try {
        const badgeId = parseInt(req.params.id);
        const { name, description, icon, badge_type } = req.body;
        
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
        
        // Check if league exists (if provided)
        if (league_id) {
            const league = await database.get(
                'SELECT name FROM leagues WHERE id = ?',
                [league_id]
            );
            
            if (!league) {
                return res.status(404).json({ error: 'League not found' });
            }
        }
        
        // Check if user already has this badge (for the same league/season if applicable)
        const existingAward = await database.get(`
            SELECT id FROM user_badges 
            WHERE user_id = ? AND badge_id = ? 
            AND (league_id = ? OR (league_id IS NULL AND ? IS NULL))
            AND (season = ? OR (season IS NULL AND ? IS NULL))
        `, [userId, badge_id, league_id, league_id, season, season]);
        
        if (existingAward) {
            return res.status(409).json({ error: 'User already has this badge' });
        }
        
        // Award the badge
        const result = await database.run(`
            INSERT INTO user_badges (user_id, badge_id, league_id, season)
            VALUES (?, ?, ?, ?)
        `, [userId, badge_id, league_id || null, season || null]);
        
        // Get the awarded badge details
        const awardedBadge = await database.get(`
            SELECT 
                ub.id, ub.earned_at, ub.league_id, ub.season,
                b.name, b.description, b.icon, b.badge_type,
                l.name as league_name
            FROM user_badges ub
            JOIN badges b ON ub.badge_id = b.id
            LEFT JOIN leagues l ON ub.league_id = l.id
            WHERE ub.id = ?
        `, [result.lastID]);
        
        // Create notification for the user
        await database.run(`
            INSERT INTO notifications (user_id, type, title, message, related_id)
            VALUES (?, 'badge_earned', ?, ?, ?)
        `, [
            userId,
            'Badge Earned!',
            `Congratulations! You've earned the "${badge.name}" badge.`,
            awardedBadge.id
        ]);
        
        res.status(201).json({
            message: `Badge "${badge.name}" awarded successfully to ${user.username}`,
            awarded_badge: awardedBadge
        });
    } catch (error) {
        console.error('Award badge error:', error);
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
