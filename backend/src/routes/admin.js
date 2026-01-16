const express = require('express');
const { requireAdmin, authenticateToken } = require('../middleware/auth');
const database = require('../models/database');

const router = express.Router();

/**
 * Run schema maintenance tasks (site admin only)
 * POST /api/admin/migrations/roster-participation
 */
router.post('/migrations/roster-participation', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await database.ensureRosterParticipationColumn();
        res.json({ message: 'Roster participation migration applied' });
    } catch (error) {
        console.error('Roster participation migration error:', error);
        res.status(500).json({ error: 'Failed to apply roster participation migration' });
    }
});

module.exports = router;
