const express = require('express');
const database = require('../models/database');

const router = express.Router();

// Public platform-wide counters for the marketing page.
// No auth required; cached on the edge for ~24h with stale-while-revalidate.
router.get('/public', async (req, res) => {
    try {
        const [playersRow, leaguesRow, matchesRow] = await Promise.all([
            database.get(
                'SELECT COUNT(DISTINCT user_id) as count FROM league_roster WHERE user_id IS NOT NULL'
            ),
            database.get('SELECT COUNT(*) as count FROM leagues WHERE is_active = ?', [true]),
            database.get('SELECT COUNT(*) as count FROM matches WHERE is_accepted = ?', [true])
        ]);

        res.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400');
        res.set('Vary', 'Origin');

        res.json({
            active_players: Number(playersRow?.count) || 0,
            leagues: Number(leaguesRow?.count) || 0,
            matches: Number(matchesRow?.count) || 0,
        });
    } catch (err) {
        console.error('Failed to compute public stats:', err);
        res.status(500).json({ error: 'Failed to compute public stats' });
    }
});

module.exports = router;
