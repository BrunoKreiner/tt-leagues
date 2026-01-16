const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const database = require('./models/database');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const leagueRoutes = require('./routes/leagues');
const matchRoutes = require('./routes/matches');
const notificationRoutes = require('./routes/notifications');
const badgeRoutes = require('./routes/badges');
const ticketRoutes = require('./routes/tickets');
const adminRoutes = require('./routes/admin');
const { moderationErrorHandler } = require('./middleware/contentModeration');

const app = express();
const PORT = process.env.PORT || 3001;
// When running on Vercel, initialize the DB on cold start and await before handling requests
let dbReady = null;
if (process.env.VERCEL) {
    try {
        console.log('Initializing database on Vercel cold start...');
        dbReady = database.initialize();
    } catch (e) {
        console.error('Failed to kick off DB initialization:', e);
    }
}

// Rate limiting - More generous for better UX
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs (much more generous)
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Allow bursts of requests
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
});

// Stricter rate limiting for auth endpoints to prevent brute force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 auth requests per windowMs
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Middleware
app.use(helmet());
app.use(compression());

// CORS configuration: allow specific origins from FRONTEND_URL (comma-separated)
// Supports wildcards like https://tt-league-frontend-git-*.vercel.app
const allowedOriginPatterns = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean)
  .map(pattern => {
    if (pattern.includes('*')) {
      // Escape dots and replace '*' with '.*' for regex
      const regexStr = '^' + pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\\\*/g, '.*') + '$';
      return new RegExp(regexStr);
    }
    return pattern;
  });

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);
    if (allowedOriginPatterns.length === 0) {
      // No explicit origins configured: reflect request origin (use env FRONTEND_URL in production)
      return callback(null, true);
    }
    const allowed = allowedOriginPatterns.some(entry =>
      typeof entry === 'string' ? entry === origin : entry.test(origin)
    );
    if (allowed) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

// Apply CORS and ensure preflight requests are handled
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
// Ensure DB is ready before proceeding (no-op locally since startServer awaited it)
app.use(async (req, res, next) => {
    try {
        if (dbReady) await dbReady;
        return next();
    } catch (e) {
        return next(e);
    }
});
app.use('/api/', limiter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        git: process.env.VERCEL_GIT_COMMIT_SHA || null
    });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes); // Stricter rate limiting for auth
app.use('/api/users', userRoutes);
app.use('/api/leagues', leagueRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl 
    });
});

// Content moderation errors (fail-closed, explicit)
app.use(moderationErrorHandler);

// Global error handler
app.use((err, req, res, next) => {
    console.error('Error:', err);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.message
        });
    }
    
    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token'
        });
    }
    
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            error: 'Token expired'
        });
    }
    
    // Default error
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
});

// Initialize database and start server
async function startServer() {
    try {
        await database.initialize();
        
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Table Tennis League API server running on port ${PORT}`);
            console.log(`📊 Health check: http://localhost:${PORT}/health`);
            console.log(`🏓 API base URL: http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down server...');
    try {
        await database.close();
        console.log('✅ Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

// Start the server
// Only start the HTTP server when not running on Vercel serverless and not in test mode
// Vercel sets VERCEL=1 in the environment; in that case we export the app and let the platform handle requests
// Jest tests set NODE_ENV=test, so we avoid starting the long-running server in tests
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
    startServer();
}

module.exports = app;

