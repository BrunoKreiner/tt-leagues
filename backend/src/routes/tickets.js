const express = require('express');
const { body } = require('express-validator');

const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateId, validatePagination, handleValidationErrors } = require('../middleware/validation');
const { moderateText, ModerationError } = require('../middleware/contentModeration');
const database = require('../models/database');

const router = express.Router();

const VALID_TICKET_CATEGORIES = new Set([
  'bug_report',
  'feature_request',
  'question',
  'account',
  'other',
]);

const VALID_TICKET_STATUSES = new Set(['open', 'closed']);

/**
 * Create a new ticket (anonymous)
 * POST /api/tickets
 */
router.post(
  '/',
  [
    body('category')
      .isString()
      .custom((v) => VALID_TICKET_CATEGORIES.has(String(v)))
      .withMessage('category is required'),
    body('subject')
      .optional({ nullable: true, checkFalsy: true })
      .isString()
      .isLength({ max: 200 })
      .withMessage('subject must be <= 200 characters')
      .trim(),
    body('email')
      .optional({ nullable: true, checkFalsy: true })
      .isEmail()
      .withMessage('email must be valid')
      .normalizeEmail(),
    body('message')
      .isString()
      .isLength({ min: 1, max: 5000 })
      .withMessage('message is required and must be <= 5000 characters')
      .trim(),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const category = String(req.body.category);
      const subject = req.body.subject != null ? String(req.body.subject).trim() : null;
      const email = req.body.email != null ? String(req.body.email).trim() : null;
      const message = String(req.body.message).trim();

      moderateText({ subject, email, message }, { context: 'ticket submission' });

      const result = await database.run(
        `
          INSERT INTO tickets (category, subject, email, message, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'open', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `,
        [category, subject || null, email || null, message]
      );

      const ticket = await database.get(
        `
          SELECT id, category, subject, email, message, status, created_at, updated_at, closed_at
          FROM tickets
          WHERE id = ?
        `,
        [result.id]
      );

      return res.status(201).json({
        message: 'Ticket submitted',
        ticket,
      });
    } catch (error) {
      if (error instanceof ModerationError) {
        return res.status(error.status || 400).json({ error: error.message, code: error.code });
      }
      console.error('Create ticket error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

/**
 * List tickets (admin only)
 * GET /api/tickets
 */
router.get('/', authenticateToken, requireAdmin, validatePagination, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status != null ? String(req.query.status).trim() : null;

    if (status && !VALID_TICKET_STATUSES.has(status)) {
      return res.status(400).json({ error: "status must be 'open' or 'closed'" });
    }

    const whereParts = [];
    const params = [];

    if (status) {
      whereParts.push('t.status = ?');
      params.push(status);
    }

    const whereClause = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

    const tickets = await database.all(
      `
        SELECT
          t.id, t.category, t.subject, t.email, t.message, t.status,
          t.created_at, t.updated_at, t.closed_at
        FROM tickets t
        ${whereClause}
        ORDER BY t.created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const totalCount = await database.get(
      `SELECT COUNT(*) as count FROM tickets t ${whereClause}`,
      params
    );

    return res.json({
      tickets,
      pagination: {
        page,
        limit,
        total: totalCount.count,
        pages: Math.ceil(totalCount.count / limit),
      },
    });
  } catch (error) {
    console.error('List tickets error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update ticket status (admin only)
 * PATCH /api/tickets/:id
 */
router.patch(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateId,
  [
    body('status')
      .isString()
      .custom((v) => VALID_TICKET_STATUSES.has(String(v)))
      .withMessage("status must be 'open' or 'closed'"),
    handleValidationErrors,
  ],
  async (req, res) => {
    try {
      const ticketId = parseInt(req.params.id);
      const status = String(req.body.status);

      const existing = await database.get(
        'SELECT id, status FROM tickets WHERE id = ?',
        [ticketId]
      );

      if (!existing) {
        return res.status(404).json({ error: 'Ticket not found' });
      }

      const shouldClose = status === 'closed';
      await database.run(
        `
          UPDATE tickets
          SET status = ?,
              updated_at = CURRENT_TIMESTAMP,
              closed_at = ${shouldClose ? 'CURRENT_TIMESTAMP' : 'NULL'}
          WHERE id = ?
        `,
        [status, ticketId]
      );

      const ticket = await database.get(
        `
          SELECT id, category, subject, email, message, status, created_at, updated_at, closed_at
          FROM tickets
          WHERE id = ?
        `,
        [ticketId]
      );

      return res.json({ message: 'Ticket updated', ticket });
    } catch (error) {
      console.error('Update ticket error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;

