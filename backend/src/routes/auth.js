const express = require('express');
const bcrypt = require('bcryptjs');
const { generateToken } = require('../utils/jwt');
const { authenticateToken } = require('../middleware/auth');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { moderateText, moderateImage, ModerationError } = require('../middleware/contentModeration');
const database = require('../models/database');

const router = express.Router();

/**
 * Register new user
 * POST /api/auth/register
 */
router.post('/register', validateRegistration, async (req, res) => {
    try {
        const { username, password, first_name, last_name, email } = req.body;

        moderateText(
            { username, first_name, last_name },
            { context: 'registration fields' }
        );
        
        // Check if username already exists
        const existingUser = await database.get(
            'SELECT id FROM users WHERE username = ?',
            [username]
        );
        
        if (existingUser) {
            return res.status(409).json({ error: 'Username already exists' });
        }
        
        // Check if email already exists (if provided)
        if (email) {
            const existingEmail = await database.get(
                'SELECT id FROM users WHERE email = ?',
                [email]
            );
            
            if (existingEmail) {
                return res.status(409).json({ error: 'Email already exists' });
            }
        }
        
        // Hash password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);
        
        // Create user
        const result = await database.run(
            'INSERT INTO users (username, password_hash, first_name, last_name, email) VALUES (?, ?, ?, ?, ?)',
            [username, passwordHash, first_name, last_name, email || null]
        );
        
        // Get created user
        const user = await database.get(
            'SELECT id, username, first_name, last_name, email, is_admin, created_at, avatar_url FROM users WHERE id = ?',
            [result.id]
        );
        
        // Generate token
        const token = generateToken(user);
        
        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                is_admin: user.is_admin,
                created_at: user.created_at,
                avatar_url: user.avatar_url || null
            },
            token
        });
    } catch (error) {
        if (error instanceof ModerationError) {
            return res.status(error.status || 400).json({ error: error.message, code: error.code });
        }
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Login user
 * POST /api/auth/login
 */
router.post('/login', validateLogin, async (req, res) => {
    try {
        const { username, password } = req.body;
        
        // Get user by username
        const user = await database.get(
            'SELECT id, username, password_hash, first_name, last_name, email, is_admin, avatar_url FROM users WHERE username = ?',
            [username]
        );
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }
        
        // Generate token
        const token = generateToken(user);
        
        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                username: user.username,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                is_admin: user.is_admin,
                avatar_url: user.avatar_url || null
            },
            token
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Get current user info
 * GET /api/auth/me
 */
router.get('/me', authenticateToken, async (req, res) => {
    try {
        // Get user stats
        const stats = await database.get(`
            SELECT 
                COALESCE((SELECT COUNT(DISTINCT lr2.league_id) FROM league_roster lr2 WHERE lr2.user_id = u.id), 0) as leagues_count,
                COALESCE((
                    SELECT COUNT(DISTINCT m2.id)
                    FROM matches m2
                    JOIN league_roster r1 ON m2.player1_roster_id = r1.id
                    JOIN league_roster r2 ON m2.player2_roster_id = r2.id
                    WHERE m2.is_accepted = ? AND (r1.user_id = u.id OR r2.user_id = u.id)
                ), 0) as matches_played,
                COALESCE((
                    SELECT COUNT(DISTINCT m3.id)
                    FROM matches m3
                    JOIN league_roster me ON me.user_id = u.id AND me.league_id = m3.league_id
                    WHERE m3.is_accepted = ? AND m3.winner_roster_id = me.id
                ), 0) as matches_won
            FROM users u
            WHERE u.id = ?
        `, [true, true, req.user.id]);
        
        res.json({
            user: {
                id: req.user.id,
                username: req.user.username,
                first_name: req.user.first_name,
                last_name: req.user.last_name,
                email: req.user.email,
                is_admin: req.user.is_admin,
                avatar_url: req.user.avatar_url || null
            },
            stats: {
                leagues_count: stats.leagues_count || 0,
                matches_played: stats.matches_played || 0,
                matches_won: stats.matches_won || 0,
                win_rate: stats.matches_played > 0 ? 
                    Math.round((stats.matches_won / stats.matches_played) * 100) : 0
            }
        });
    } catch (error) {
        console.error('Get user info error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Update user profile
 * PUT /api/auth/profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { first_name, last_name, email, avatar_url } = req.body;

        moderateText(
            { first_name, last_name },
            { context: 'profile fields' }
        );
        await moderateImage(avatar_url, { context: 'avatar' });

        const updates = [];
        const values = [];
        
        if (first_name !== undefined) {
            updates.push('first_name = ?');
            values.push(first_name.trim());
        }
        
        if (last_name !== undefined) {
            updates.push('last_name = ?');
            values.push(last_name.trim());
        }
        
        if (email !== undefined) {
            // Check if email already exists for another user
            if (email) {
                const existingEmail = await database.get(
                    'SELECT id FROM users WHERE email = ? AND id != ?',
                    [email, req.user.id]
                );
                
                if (existingEmail) {
                    return res.status(409).json({ error: 'Email already exists' });
                }
            }
            
            updates.push('email = ?');
            values.push(email || null);
        }
        
        if (avatar_url !== undefined) {
            updates.push('avatar_url = ?');
            values.push(avatar_url || null);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        
        updates.push('updated_at = CURRENT_TIMESTAMP');
        values.push(req.user.id);
        
        await database.run(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            values
        );
        
        // Get updated user
        const updatedUser = await database.get(
            'SELECT id, username, first_name, last_name, email, is_admin, avatar_url FROM users WHERE id = ?',
            [req.user.id]
        );
        
        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (error) {
        if (error instanceof ModerationError) {
            return res.status(error.status || 400).json({ error: error.message, code: error.code });
        }
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * Logout user (client-side token removal)
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
    res.json({ message: 'Logout successful. Please remove token from client.' });
});

module.exports = router;

