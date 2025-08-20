const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { validateId, validatePagination } = require('../middleware/validation');
const database = require('../models/database');

const router = express.Router();

/**
 * Get user notifications
 * GET /api/notifications
 */
router.get('/', authenticateToken, validatePagination, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const unreadOnly = req.query.unread_only === 'true';
        
        let whereClause = 'user_id = ?';
        const params = [req.user.id];
        
        if (unreadOnly) {
            whereClause += ' AND is_read = 0';
        }
        
        const notifications = await database.all(`
            SELECT 
                id, type, title, message, is_read, related_id, created_at
            FROM notifications
            WHERE ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);
        
        const totalCount = await database.get(
            `SELECT COUNT(*) as count FROM notifications WHERE ${whereClause}`,
            params
        );
        
        const unreadCount = await database.get(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
            [req.user.id]
        );
        
        res.json({
            notifications,
            pagination: {
                page,
                limit,
                total: totalCount.count,
                pages: Math.ceil(totalCount.count / limit)
            },
            unread_count: unreadCount.count
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
router.put('/:id/read', authenticateToken, validateId, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);
        
        const notification = await database.get(
            'SELECT user_id FROM notifications WHERE id = ?',
            [notificationId]
        );
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        if (notification.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await database.run(
            'UPDATE notifications SET is_read = 1 WHERE id = ?',
            [notificationId]
        );
        
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
router.delete('/:id', authenticateToken, validateId, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);
        
        const notification = await database.get(
            'SELECT user_id FROM notifications WHERE id = ?',
            [notificationId]
        );
        
        if (!notification) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        if (notification.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        await database.run('DELETE FROM notifications WHERE id = ?', [notificationId]);
        
        res.json({ message: 'Notification deleted' });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Mark all notifications as read
 * POST /api/notifications/mark-all-read
 */
router.post('/mark-all-read', authenticateToken, async (req, res) => {
    try {
        const result = await database.run(
            'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
            [req.user.id]
        );
        
        res.json({ 
            message: 'All notifications marked as read',
            updated_count: result.changes
        });
    } catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get notification statistics
 * GET /api/notifications/stats
 */
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const stats = await database.get(`
            SELECT 
                COUNT(*) as total_notifications,
                COUNT(CASE WHEN is_read = 0 THEN 1 END) as unread_notifications,
                COUNT(CASE WHEN type = 'league_invite' THEN 1 END) as league_invites,
                COUNT(CASE WHEN type = 'match_request' THEN 1 END) as match_requests,
                COUNT(CASE WHEN type = 'match_accepted' THEN 1 END) as match_accepted,
                COUNT(CASE WHEN type = 'badge_earned' THEN 1 END) as badges_earned
            FROM notifications
            WHERE user_id = ?
        `, [req.user.id]);
        
        res.json({ stats });
    } catch (error) {
        console.error('Get notification stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

