# AGENTS.md

This repo is a full-stack **Table Tennis League** app:

- **Backend**: Express (`backend/`) with SQLite for local/dev and Postgres for production (Vercel/Neon).
- **Frontend**: React + Vite (`frontend/`) using an Axios client to call the backend API.

Use this as the quick “how to work on this repo” guide for humans and automated agents.

## Project map (where to look)

- **Backend entrypoint**: `backend/src/app.js`
- **DB wrapper / initialization**: `backend/src/models/database.js`
  - Uses Postgres when `DATABASE_URL` is set, otherwise SQLite at `DATABASE_PATH`.
  - Runs schema from `backend/database/schema.pg.sql` (PG) or `backend/database/schema.sql` (SQLite).
- **Backend routes**: `backend/src/routes/*`
- **Frontend API client**: `frontend/src/services/api.js`
- **CI backend tests workflow**: `.github/workflows/backend-tests.yml`

## Local development

### Backend

- **Install deps**:

```bash
cd backend; npm install
```

- **Run dev server**:

```bash
cd backend; npm run dev
```

The API serves at `http://localhost:3001` and has a health check at `/health`.

### Frontend

- **Install deps**:

```bash
cd frontend; pnpm install
```

- **Run dev server**:

```bash
cd frontend; pnpm run dev
```

## Environment & configuration

### Backend `.env`

Copy `backend/.env.example` to `backend/.env` and edit.

Key variables:

- **`PORT`**: API port (default 3001)
- **`FRONTEND_URL`**: comma-separated allowed origins for CORS
- **`DATABASE_URL`**: when set, the backend uses Postgres
- **`DATABASE_PATH`**: SQLite file path when `DATABASE_URL` is not set
- **`JWT_SECRET`**: required for auth
- **Admin seeding**: `ADMIN_*` variables are used to create/update the admin user on startup

Vercel behavior (important):

- If `VERCEL=1`, the backend **requires** `DATABASE_URL` (no SQLite in serverless runtime).

### Frontend `.env`

- **`VITE_API_URL`**: backend API base URL (e.g. `http://localhost:3001/api`)

## Tests, lint, and CI parity

### Backend tests (Jest)

```bash
cd backend; npm ci; npm test
```

CI runs backend tests with:

- `NODE_ENV=test`
- `DATABASE_PATH=./database/test.db`
- `npm test -- --runInBand`

If you need to match CI locally:

```bash
cd backend; NODE_ENV=test DATABASE_PATH=./database/test.db npm test -- --runInBand
```

### Frontend lint (ESLint)

```bash
cd frontend; pnpm run lint
```

## Database notes (SQLite + Postgres)

- Prefer writing SQL with **SQLite-style `?` placeholders** when using `database.get/run/all(...)`.
  - The DB layer converts `?` to `$1, $2, ...` for Postgres.
- For multi-step updates, prefer `database.withTransaction(...)` so the same code works for both DBs.
- Schema files live in `backend/database/`:
  - `schema.sql` (SQLite)
  - `schema.pg.sql` (Postgres)

## Contribution guidelines (repo-specific)

- **No silent fallbacks for new functionality**: if new behavior needs config, make it explicit (clear env var/parameter requirements) rather than silently “doing something else”.
- **Command examples**: use `;` to separate commands (avoid `&&` in docs/examples).
- **Keep dev/test stable**: don’t start long-running servers inside test paths (backend already avoids starting the HTTP server when `NODE_ENV=test`).

