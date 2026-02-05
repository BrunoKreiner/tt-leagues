# Table Tennis League App

A full-stack table tennis league management application with ELO rating system, built with React frontend and Express backend.

## Features

- **User Authentication**: Secure login and registration system
- **League Management**: Create and manage table tennis leagues
- **Match Recording**: Record match results with detailed scoring
- **ELO Rating System**: Advanced ELO calculation with match format considerations
- **Admin Panel**: Administrative tools for managing users and approving matches
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React 19, Tailwind CSS, shadcn/ui components
- **Backend**: Node.js, Express, SQLite (local) / Postgres (production)
- **Authentication**: JWT tokens
- **Deployment**: Docker & Docker Compose

## Quick Start with Docker

### Prerequisites

- Docker Desktop installed on your system
- Git (to clone the repository)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd table-tennis-league
   ```

2. Start the application:
   ```bash
   docker-compose up -d
   ```

3. Access the application:
   - Frontend: http://localhost
   - Backend API: http://localhost:3001

### Default Admin Account

- **Username**: `admin`
- **Password**: `admin123`

## Development Setup

### Backend Development

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start development server:
   ```bash
   npm start
   ```

The backend will run on http://localhost:3001

### Frontend Development

1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start development server:
   ```bash
   pnpm run dev
   ```

The frontend will run on http://localhost:5173

## Database Schema

The application uses SQLite with the following main tables:

- **users**: User accounts and authentication
- **leagues**: League information and settings
- **league_members**: User memberships in leagues
- **matches**: Match results and ELO calculations
- **notifications**: User notifications
- **badges**: Achievement system (future feature)

## ELO Rating System

The app implements a sophisticated ELO rating system that considers:

- **Match Format**: Different multipliers for Best of 1, 3, 5, and 7
- **Point Differential**: Bonus/penalty based on points won/lost
- **Expected Score**: Traditional ELO expected outcome calculation
- **K-Factor**: Fixed at 46 for consistent rating changes

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info

### Leagues
- `GET /api/leagues` - List leagues
- `POST /api/leagues` - Create league (admin)
- `GET /api/leagues/:id` - Get league details
- `POST /api/leagues/:id/join` - Join league

### Matches
- `GET /api/matches` - List user matches
- `POST /api/matches` - Record new match
- `POST /api/matches/:id/accept` - Accept match (admin)
- `GET /api/matches/pending` - List pending matches (admin)

## Docker Commands

### Build and run:
```bash
docker compose up --build
```

### Run in background:
```bash
docker compose up -d
```

### Stop services:
```bash
docker compose down
```

### View logs:
```bash
docker compose logs -f
```

### Rebuild specific service:
```bash
docker compose build backend
docker compose build frontend
```

## Running Tests

### Backend (local)
```bash
cd backend
npm install
npm test
```

### Backend (Docker)
Run the test service using the test profile:
```bash
docker compose --profile test up --build backend-tests
```

Or a one-off run:
```bash
docker compose --profile test run --rm backend-tests
```

Notes:
- The test container uses `backend/Dockerfile.test`, installs dev dependencies, and runs `npm test` against a SQLite test DB at `/app/data/test.db`.
- App containers are separate; tests do not require bringing up the full stack.

## Environment Variables

### Backend (.env)
```
# Server
PORT=3001
FRONTEND_URL=http://localhost,http://localhost:5173

# Database selection
# Use Postgres when DATABASE_URL is set (e.g., on Vercel). Otherwise SQLite is used via DATABASE_PATH.
# If sslmode is missing from DATABASE_URL, the backend appends `sslmode=require` automatically.
# DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
# Optional: skip runtime schema/migration checks (connect-only).
# Set to 1 on serverless production if you run migrations manually.
# DB_INIT_SKIP=1
# SQLite path is resolved relative to the backend working directory.
# If you run from `backend/`, use:
DATABASE_PATH=database/league.db

# Auth
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Cloudflare Turnstile CAPTCHA (optional but recommended)
# Get keys from: https://dash.cloudflare.com/?to=/:account/turnstile
# For development/testing, you can use the test keys:
# Site key: 1x00000000000000000000AA
# Secret key: 1x0000000000000000000000000000000AA
TURNSTILE_SECRET_KEY=your-turnstile-secret-key-here

# Admin seeding (created/updated on startup; ADMIN_PASSWORD required in production)
ADMIN_USERNAME=admin
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=User
ADMIN_EMAIL=admin@tabletennis.local
# ADMIN_PASSWORD=change-me
```

Notes:
- Database selection: `backend/src/models/database.js` uses Postgres when `DATABASE_URL` is set; otherwise SQLite at `DATABASE_PATH`. On Vercel, the app requires `DATABASE_URL` to avoid ephemeral SQLite.
- SSL: If `sslmode` is not present in `DATABASE_URL`, the app adds `sslmode=require` and sets `ssl: { rejectUnauthorized: false }` on the PG Pool.

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001/api

# Cloudflare Turnstile CAPTCHA (optional but recommended)
# Get site key from: https://dash.cloudflare.com/?to=/:account/turnstile
# For development/testing, you can use the test site key: 1x00000000000000000000AA
VITE_TURNSTILE_SITE_KEY=your-turnstile-site-key-here
```

## CORS Configuration

The backend supports flexible CORS configuration via the `FRONTEND_URL` environment variable. This variable defines which frontend origins are allowed to make API requests.

### Configuration Format

- **Comma-separated**: Multiple origins separated by commas
- **Wildcard support**: Use `*` for pattern matching (e.g., `https://*.vercel.app`)
- **No value**: If `FRONTEND_URL` is not set, all origins are allowed

### Examples

#### Local Development
```bash
# Single local origin
FRONTEND_URL=http://localhost:5173

# Multiple local origins (different ports)
FRONTEND_URL=http://localhost:5173,http://localhost:3000
```

#### Production (Vercel)
```bash
# Single production domain
FRONTEND_URL=https://leagues.lol

# Production + preview deployments with wildcard
FRONTEND_URL=https://leagues.lol,https://tt-league-frontend-*.vercel.app

# Multiple production domains + preview
FRONTEND_URL=https://leagues.lol,https://www.leagues.lol,https://tt-league-frontend-*.vercel.app
```

#### Mixed Environments
```bash
# Local development + staging
FRONTEND_URL=http://localhost:5173,https://staging.leagues.lol
```

### Default Behavior

The backend automatically includes these origins regardless of `FRONTEND_URL`:
- `https://leagues.lol`
- `https://www.leagues.lol`
- All Vercel preview URLs matching `https://tt-league-frontend*.vercel.app`

### Wildcard Pattern Matching

Wildcards (`*`) are converted to regex patterns for flexible matching:
- `https://*.vercel.app` matches any subdomain on `vercel.app`
- `https://preview-*.example.com` matches any preview domain
- Pattern matching is case-sensitive and requires exact protocol match

## Developer Workflows

### Local Development (SQLite)

The default local development workflow uses SQLite for simplicity:

1. **Database location**: `backend/database/league.db` (created automatically)
2. **Initialize database**:
   ```bash
   cd backend
   npm run init-db
   ```
3. **Start backend**:
   ```bash
   npm start
   ```
4. **Environment**: SQLite is used when `DATABASE_URL` is not set

**Advantages**:
- No external database required
- Simple setup for new developers
- Fast local testing
- Database file can be easily reset by deleting `league.db`

**File locations**:
- Schema: `backend/database/schema.sql`
- Database file: `backend/database/league.db` (gitignored)

### Docker Development (SQLite)

Using Docker Compose with SQLite:

```bash
# Start all services
docker-compose up -d

# Database is persisted in Docker volume
docker-compose down -v  # Remove -v to keep database
```

The database is stored in a Docker volume and persists across container restarts unless explicitly removed with `docker-compose down -v`.

### Production (Vercel + Neon/Postgres)

For serverless production deployments:

1. **Database**: Use a managed Postgres service like Neon or Vercel Postgres
2. **Environment**: Set `DATABASE_URL` in Vercel environment variables
3. **SSL**: Automatically enforced (sslmode=require) if not in URL
4. **Migrations**: Schema is applied automatically on first connection
5. **Optional**: Set `DB_INIT_SKIP=1` to skip automatic schema initialization

**Example Neon setup**:
```bash
# In Vercel environment variables
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
FRONTEND_URL=https://leagues.lol,https://tt-league-frontend-*.vercel.app
DB_INIT_SKIP=1  # Optional: disable auto-init on serverless
```

**Schema parity**:
- SQLite schema: `backend/database/schema.sql`
- Postgres schema: `backend/database/schema.pg.sql`
- Both schemas are kept in sync for feature parity

### Testing Against Local Postgres (Optional)

To test Postgres behavior locally without deploying:

1. **Start local Postgres** (Docker or native):
   ```bash
   docker run -d -p 5432:5432 \
     -e POSTGRES_PASSWORD=test \
     -e POSTGRES_DB=ttleague \
     postgres:16
   ```

2. **Set DATABASE_URL in backend/.env**:
   ```bash
   DATABASE_URL=postgresql://postgres:test@localhost:5432/ttleague
   ```

3. **Run backend**:
   ```bash
   cd backend
   npm start
   ```

The backend will use Postgres instead of SQLite when `DATABASE_URL` is set.

## Troubleshooting

### Common Issues

1. **Port conflicts**: Make sure ports 80 and 3001 are available
2. **Database issues**: Delete the Docker volume to reset: `docker-compose down -v`
3. **Build failures**: Clear Docker cache: `docker system prune -a`

### Logs

Check application logs:
```bash
docker-compose logs backend
docker-compose logs frontend
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please create an issue in the repository.

