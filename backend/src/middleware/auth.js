const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const database = require('../models/database');

/**
 * Middleware to authenticate JWT tokens
 */
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = extractTokenFromHeader(authHeader);
        
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        
        const decoded = verifyToken(token);
        
        // Get fresh user data from database
        const user = await database.get(
            'SELECT id, username, first_name, last_name, email, is_admin, avatar_url FROM users WHERE id = ?',
            [decoded.id]
        );
        
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        req.user = user;
        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

/**
 * Middleware to check if user is admin
 */
function requireAdmin(req, res, next) {
    if (!req.user || !req.user.is_admin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

/**
 * Middleware to check if user is league admin or global admin
 */
async function requireLeagueAdmin(req, res, next) {
    try {
        const leagueId = req.params.id || req.body.league_id;
        
        if (!leagueId) {
            return res.status(400).json({ error: 'League ID required' });
        }
        
        // Check if user is global admin
        if (req.user.is_admin) {
            return next();
        }
        
        // Check if user is league admin
        const membership = await database.get(
            'SELECT is_admin FROM league_roster WHERE league_id = ? AND user_id = ?',
            [leagueId, req.user.id]
        );
        
        if (!membership || !membership.is_admin) {
            return res.status(403).json({ error: 'League admin access required' });
        }
        
        next();
    } catch (error) {
        console.error('League admin check error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Optional authentication - sets req.user if token is valid, but doesn't require it
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        const token = extractTokenFromHeader(authHeader);
        
        if (token) {
            const decoded = verifyToken(token);
            const user = await database.get(
                'SELECT id, username, first_name, last_name, email, is_admin, avatar_url FROM users WHERE id = ?',
                [decoded.id]
            );
            
            if (user) {
                req.user = user;
            }
        }
        
        next();
    } catch (error) {
        // Ignore authentication errors for optional auth
        next();
    }
}

module.exports = {
    authenticateToken,
    requireAdmin,
    requireLeagueAdmin,
    optionalAuth
};

