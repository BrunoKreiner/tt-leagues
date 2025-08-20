const jwt = require('jsonwebtoken');

// Use environment variable or default secret (change in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 * @param {Object} user - User object
 * @returns {string} JWT token
 */
function generateToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        isAdmin: user.is_admin || false
    };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {Object} Decoded token payload
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
function extractTokenFromHeader(authHeader) {
    if (!authHeader) return null;
    
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
        return null;
    }
    
    return parts[1];
}

/**
 * Generate refresh token (for future use)
 * @param {Object} user - User object
 * @returns {string} Refresh token
 */
function generateRefreshToken(user) {
    const payload = {
        id: user.id,
        type: 'refresh'
    };
    
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

module.exports = {
    generateToken,
    verifyToken,
    extractTokenFromHeader,
    generateRefreshToken,
    JWT_SECRET
};

