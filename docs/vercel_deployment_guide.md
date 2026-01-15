# Table Tennis League App - Vercel-only Deployment Guide

This guide explains how to deploy both the frontend and the backend on Vercel. The backend runs as a Vercel Serverless Function, and the frontend is a Vite SPA deployed on Vercel static hosting.

## Overview

- **Frontend (Vite + React)**: Deployed to Vercel from `frontend/` with SPA routing via `frontend/vercel.json`.
- **Backend (Express API)**: Deployed to Vercel from `backend/` as a Serverless Function with `backend/vercel.json` and entry at `backend/api/index.js` exporting the Express app.
- **Database (Neon/Vercel Postgres)**: Managed Postgres. The backend selects Postgres when `DATABASE_URL` is set and uses SSL (`sslmode=require`).

Notes:
- SQLite is not persistent on Vercel Serverless. On Vercel, the backend requires `DATABASE_URL` and will fail fast without it.
- Locally, SQLite is used when `DATABASE_URL` is not set. See `backend/.env.example`.

## Prerequisites

- **Git** repository hosted on GitHub/GitLab/Bitbucket
- **Vercel** account: https://vercel.com/

## Repository Structure

```
table-tennis-league/
├── backend/          # Express backend code
│   ├── api/index.js  # Vercel Function entry (exports Express app)
│   ├── src/app.js    # Express app (listens only locally; not on Vercel)
│   └── vercel.json   # Vercel function routing config
├── frontend/         # Vite frontend code
│   └── vercel.json   # SPA rewrites to /index.html
└── ...
```

## Step 1 — Create Vercel Postgres (Database)

1. In Vercel Dashboard: Storage -> Postgres -> Create Database.
2. Copy the connection string (Database URL). Vercel exposes variables like `POSTGRES_URL` / `DATABASE_URL`.
3. You will set `DATABASE_URL` in the backend project Environment Variables.

Important: Until the backend is migrated from SQLite to Postgres, you cannot persist data on Vercel Serverless. Plan to refactor `backend/src/models/database.js` to use `pg` and SQL migrations.

## Step 2 — Backend on Vercel (Serverless)

1. In Vercel, click "Add New" -> "Project" and import this repo.
2. When prompted for Root Directory, choose `backend`.
3. Ensure these files exist (already added in the repo):
   - `backend/api/index.js`: exports the Express `app`.
   - `backend/vercel.json`: routes `/api/*` and `/health` to `api/index.js` and sets Node.js runtime.
   - `backend/src/app.js`: guarded so it does not call `app.listen()` on Vercel. It exports the `app`.
4. Environment Variables (Project Settings -> Environment Variables):
   - `NODE_ENV=production`
   - `JWT_SECRET=your-strong-secret`
   - `FRONTEND_URL=https://your-frontend-project.vercel.app` (comma-separated origins supported; wildcards `*` allowed)
   - `DATABASE_URL=postgres://...` (Neon/Vercel Postgres). If `sslmode` is missing, the app appends `sslmode=require` automatically and enables TLS on the Pool.
   - Optional: `DB_INIT_SKIP=1` (connect-only; skip schema checks when migrations are run manually)
5. Deploy. After deploy, your backend will be available at `https://your-backend-project.vercel.app`. API base: `https://your-backend-project.vercel.app/api`.

## Step 3 — Frontend on Vercel (SPA)

1. In Vercel, click "Add New" -> "Project" again and import the same repo.
2. Choose Root Directory: `frontend`.
3. The file `frontend/vercel.json` adds a SPA rewrite to `/index.html` for client-side routing.
4. Environment Variables:
   - `VITE_API_URL=https://your-backend-project.vercel.app` (no trailing slash; frontend app will call `${VITE_API_URL}/api/...`)
5. Deploy. After deploy, note the frontend URL (e.g., `https://your-frontend-project.vercel.app`).

## CORS Configuration (Backend)

The backend uses `FRONTEND_URL` to allow origins. Update `backend/src/app.js` accordingly (already handled):

```js
// Example: process.env.FRONTEND_URL may be comma-separated
app.use(cors({
  origin: (origin, cb) => { /* see code */ },
  credentials: true,
}));
```

Set `FRONTEND_URL` to your Vercel frontend domain in the backend project settings. Multiple domains can be comma-separated.

## Database & SSL Notes

- The backend appends `sslmode=require` to `DATABASE_URL` if it is not present and sets `ssl: { rejectUnauthorized: false }` on the `pg` Pool.
- Health route: `/health` is routed in `backend/vercel.json`; ensure it returns 200 after deploy.

## Default Admin Account

- Username: `admin`
- Password: `admin123`

Change the default admin password on first login.

## Notes & Limitations

- SQLite is not suitable for Vercel Serverless persistence. On Vercel, set `DATABASE_URL`; the backend will automatically use Postgres with SSL.
- Schema initialization runs from `backend/database/schema.pg.sql` on Postgres. You may adopt a migration tool (e.g., `knex`, `sequelize`, `drizzle`) if you prefer managed migrations.

## Troubleshooting

- 404 on frontend deep-links: Ensure `frontend/vercel.json` rewrites all to `/index.html`.
- CORS blocked: Confirm `FRONTEND_URL` includes your frontend origin and that frontend uses `VITE_API_URL`.
- API cold starts: First request after idle may be slower due to serverless warmup.

This Vercel-only setup lets you deploy both frontend and backend under Vercel. Complete the DB migration to Postgres to enable production persistence.

