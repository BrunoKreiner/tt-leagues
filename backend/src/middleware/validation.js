const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors
 */
function handleValidationErrors(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
}

/**
 * User registration validation
 */
const validateRegistration = [
    body('username')
        .isLength({ min: 3, max: 50 })
        .withMessage('Username must be between 3 and 50 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long'),
    body('first_name')
        .isLength({ min: 1, max: 100 })
        .withMessage('First name is required and must be less than 100 characters')
        .trim(),
    body('last_name')
        .isLength({ min: 1, max: 100 })
        .withMessage('Last name is required and must be less than 100 characters')
        .trim(),
    body('email')
        .optional({ nullable: true, checkFalsy: true })
        .isEmail()
        .withMessage('Must be a valid email address')
        .normalizeEmail(),
    handleValidationErrors
];

/**
 * User login validation
 */
const validateLogin = [
    body('username')
        .notEmpty()
        .withMessage('Username is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required'),
    handleValidationErrors
];

/**
 * League creation validation
 */
const validateLeagueCreation = [
    body('name')
        .isLength({ min: 1, max: 200 })
        .withMessage('League name is required and must be less than 200 characters')
        .trim(),
    body('description')
        .optional()
        .isLength({ max: 1000 })
        .withMessage('Description must be less than 1000 characters')
        .trim(),
    body('is_public')
        .optional()
        .isBoolean()
        .withMessage('is_public must be a boolean'),
    body('season')
        .optional()
        .isLength({ max: 100 })
        .withMessage('Season must be less than 100 characters')
        .trim(),
    handleValidationErrors
];

/**
 * Match creation validation
 */
const validateMatchCreation = [
    body('league_id')
        .isInt({ min: 1 })
        .withMessage('Valid league ID is required'),
    body('player2_roster_id')
        .isInt({ min: 1 })
        .withMessage('Valid opponent roster ID is required'),
    body('player1_sets_won')
        .isInt({ min: 0, max: 4 })
        .withMessage('Player 1 sets won must be between 0 and 4'),
    body('player2_sets_won')
        .isInt({ min: 0, max: 4 })
        .withMessage('Player 2 sets won must be between 0 and 4'),
    body('player1_points_total')
        .isInt({ min: 0 })
        .withMessage('Player 1 total points must be a positive integer'),
    body('player2_points_total')
        .isInt({ min: 0 })
        .withMessage('Player 2 total points must be a positive integer'),
    body('game_type')
        .isIn(['best_of_1', 'best_of_3', 'best_of_5', 'best_of_7'])
        .withMessage('Game type must be one of: best_of_1, best_of_3, best_of_5, best_of_7'),
    body('sets')
        .optional()
        .isArray()
        .withMessage('Sets must be an array'),
    body('sets.*.player1_score')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Set scores must be positive integers'),
    body('sets.*.player2_score')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Set scores must be positive integers'),
    handleValidationErrors
];

/**
 * ID parameter validation
 */
const validateId = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('Valid ID is required'),
    handleValidationErrors
];

/**
 * Pagination validation
 */
const validatePagination = [
    query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
    handleValidationErrors
];

module.exports = {
    validateRegistration,
    validateLogin,
    validateLeagueCreation,
    validateMatchCreation,
    validateId,
    validatePagination,
    handleValidationErrors
};

