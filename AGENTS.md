# Agent Documentation

This file provides context and guidelines for AI agents working on the Table Tennis League App.

## Project Overview

This is a full-stack web application for managing table tennis leagues, recording matches, and calculating ELO ratings.

- **Frontend**: React 19, Tailwind CSS, shadcn/ui (in `frontend/`)
- **Backend**: Node.js, Express (in `backend/`)
- **Database**: SQLite (local dev), PostgreSQL (production)

## Directory Structure

- `backend/`: API server code.
    - `src/`: Source code (routes, models, controllers).
    - `database/`: SQL schema files (`schema.sql`, `schema.pg.sql`).
    - `tests/`: Jest test files.
- `frontend/`: React client application.
    - `src/`: Components, pages, hooks.
- `docs/`: Detailed documentation and progress logs.
- `docker-compose.yml`: Container orchestration for dev/test.

## Development Workflow

### Backend

- **Directory**: `/workspace/backend`
- **Install**: `npm install`
- **Run**: `npm start` (starts on port 3001)
- **Test**: `npm test`
- **Database Init**: `npm run init-db` (initializes SQLite db)
- **Database Smoke Test**: `npm run db:smoke`

### Frontend

- **Directory**: `/workspace/frontend`
- **Install**: `pnpm install`
- **Run**: `pnpm run dev` (starts on port 5173)
- **Lint**: `npm run lint`

### Database

- **Local**: SQLite file at `backend/database/league.db`.
- **Schema**:
    - `backend/database/schema.sql`: Main SQLite schema.
    - `backend/database/schema.pg.sql`: PostgreSQL schema for production.
- **Migrations**: Check `backend/database/` for migration scripts.

## Common Tasks & Guidelines

### Running Tests
Before marking a task as complete, verify changes with tests:
- **Backend**: `cd backend && npm test`
- **Docker Tests**: `docker compose --profile test run --rm backend-tests`

### Code Style
- **Backend**: Node.js/CommonJS. Follow existing patterns in `backend/src/`.
- **Frontend**: React functional components with Hooks. Use `jsx` extension.
- **Styling**: Tailwind CSS classes.

### Documentation
- **Update Docs**: If you add major features, update `README.md` or create a new doc in `docs/`.
- **Task Tracking**: Check and update `docs/TODO.md` and `docs/DEVELOPMENT_PROGRESS.MD`.

## Key Files
- `README.md`: General setup and feature list.
- `docs/TODO.md`: Pending tasks.
- `backend/src/routes/`: API route definitions.
- `frontend/src/routes/`: Client-side routing (if applicable) or `App.jsx`.
