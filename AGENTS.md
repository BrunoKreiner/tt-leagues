# AGENTS.md - AI Agent Instructions

This file provides context and guidelines for AI agents working on the Table Tennis League App codebase.

## Project Overview

A full-stack table tennis league management application with ELO rating system. Users can create/join leagues, record matches, view leaderboards, and earn badges.

## Tech Stack

### Backend (`/backend`)
- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: SQLite (local/dev) or PostgreSQL/Neon (production)
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcryptjs (NOT bcrypt)
- **Testing**: Jest + Supertest

### Frontend (`/frontend`)
- **Framework**: React 19 with Vite
- **Package Manager**: pnpm
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix primitives)
- **Routing**: react-router-dom v7
- **i18n**: react-i18next (EN/DE)
- **Forms**: react-hook-form + zod

## Project Structure

```
/workspace
├── backend/
│   ├── api/index.js           # Vercel serverless entry point
│   ├── src/
│   │   ├── app.js             # Express app setup
│   │   ├── middleware/        # Auth, validation middleware
│   │   ├── models/database.js # DB connection (SQLite/Postgres)
│   │   ├── routes/            # API route handlers
│   │   └── utils/             # ELO calculator, JWT utilities
│   ├── database/
│   │   ├── schema.sql         # SQLite schema
│   │   └── schema.pg.sql      # PostgreSQL schema
│   └── tests/                 # Jest test files
├── frontend/
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── ui/            # shadcn/ui components
│   │   │   └── layout/        # Layout components
│   │   ├── pages/             # Page components
│   │   ├── contexts/          # React contexts (Auth)
│   │   ├── services/api.js    # API client (axios)
│   │   └── i18n/              # i18n configuration
│   └── public/locales/        # Translation files (en, de)
└── docs/                      # Project documentation
```

## Development Setup

### Backend
```bash
cd backend
npm install
npm start          # Production mode
npm run dev        # Development with nodemon
```

### Frontend
```bash
cd frontend
pnpm install
pnpm run dev       # Development server at localhost:5173
pnpm run build     # Production build
pnpm run lint      # ESLint
```

## Running Tests

### Backend Tests (Required before completing tasks)
```bash
cd backend
npm test                    # Run all tests
npm run test:watch          # Watch mode
```

Tests use Jest with SQLite test database. Test files are in `backend/tests/`.

### CI Pipeline
Backend tests run automatically on push/PR via `.github/workflows/backend-tests.yml`.

## Shell Command Guidelines

**Important**: Use `;` instead of `&&` to chain shell commands (PowerShell compatibility).

```bash
# Correct
cd backend; npm test

# Incorrect (avoid)
cd backend && npm test
```

## Database Considerations

### Dual Database Support
- **SQLite**: Used locally when `DATABASE_URL` is not set
- **PostgreSQL**: Used in production when `DATABASE_URL` is set

### Boolean Compatibility
Use parameterized booleans in queries (not `0/1` literals):
```javascript
// Correct
db.all('SELECT * FROM matches WHERE is_accepted = ?', [true])

// Avoid
db.all('SELECT * FROM matches WHERE is_accepted = 1')
```

### Schema Files
- SQLite: `backend/database/schema.sql`
- PostgreSQL: `backend/database/schema.pg.sql`

Keep both schemas in sync when making changes.

## Code Conventions

### Backend
- Use CommonJS (`require`/`module.exports`)
- Async route handlers with try/catch
- Return consistent JSON responses: `{ success: true, data: ... }` or `{ success: false, error: ... }`
- Use express-validator for input validation
- Password hashing via `bcryptjs` (NOT `bcrypt`)

### Frontend
- Use ES Modules
- Functional components with hooks
- Use `t()` from react-i18next for all user-facing strings
- Follow shadcn/ui patterns for UI components
- Use react-hook-form + zod for forms
- API calls go through `frontend/src/services/api.js`

### Styling
- Dark theme is the default (video game aesthetic)
- Use Tailwind CSS utility classes
- Custom CSS variables defined in `frontend/src/index.css`
- Components use class-variance-authority for variants

## Translation (i18n)

All user-facing strings must be translated:
- Add keys to `frontend/public/locales/en/common.json`
- Add German translations to `frontend/public/locales/de/common.json`
- Use `const { t } = useTranslation()` and `t('key.path')` in components

## Key Files Reference

| Purpose | File |
|---------|------|
| Express app entry | `backend/src/app.js` |
| Database connection | `backend/src/models/database.js` |
| Auth middleware | `backend/src/middleware/auth.js` |
| ELO calculation | `backend/src/utils/eloCalculator.js` |
| API routes | `backend/src/routes/*.js` |
| Frontend API client | `frontend/src/services/api.js` |
| Auth context | `frontend/src/contexts/AuthContext.jsx` |
| Main layout | `frontend/src/components/layout/Layout.jsx` |
| Global styles | `frontend/src/index.css` |
| Vite config | `frontend/vite.config.js` |

## Environment Variables

### Backend (`.env`)
```
PORT=3001
DATABASE_PATH=backend/database/league.db  # SQLite path
# DATABASE_URL=postgresql://...           # Postgres (production)
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
FRONTEND_URL=http://localhost,http://localhost:5173
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

### Frontend (`.env`)
```
VITE_API_URL=http://localhost:3001/api
```

## Common Tasks

### Adding a New API Endpoint
1. Create/update route file in `backend/src/routes/`
2. Register route in `backend/src/app.js`
3. Add input validation using express-validator
4. Write tests in `backend/tests/`
5. Update `frontend/src/services/api.js` if needed

### Adding a New Page
1. Create page component in `frontend/src/pages/`
2. Add route in `frontend/src/App.jsx`
3. Add translations to locale files
4. Update navigation if needed

### Modifying Database Schema
1. Update BOTH `schema.sql` (SQLite) AND `schema.pg.sql` (Postgres)
2. Keep column names, types, and indexes consistent
3. Test with both SQLite and Postgres if possible

### Adding UI Components
- Check if shadcn/ui has the component first
- Follow existing component patterns in `frontend/src/components/ui/`
- Use Tailwind CSS for styling

## Don't Do

- Don't use `bcrypt` - use `bcryptjs`
- Don't use `&&` in shell commands - use `;`
- Don't hardcode strings - use i18n `t()` function
- Don't add fallbacks when implementing new functionality
- Don't commit directly to main branch
- Don't run long-lived/watch processes (dev servers, etc.)
- Don't use interactive git commands (`git rebase -i`, `git add -i`)

## Testing Checklist

Before completing any task:
1. Run backend tests: `cd backend; npm test`
2. Run frontend lint: `cd frontend; pnpm run lint`
3. Verify no TypeScript/ESLint errors
4. Test affected functionality manually if possible

## Documentation

- `README.md` - Project overview and setup
- `docs/TODO.md` - Current roadmap and task tracking
- `docs/FEATURES.md` - Feature documentation
- `DEPLOYMENT.md` - Deployment instructions
