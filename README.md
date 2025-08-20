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
- **Backend**: Node.js, Express, SQLite
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
docker-compose up --build
```

### Run in background:
```bash
docker-compose up -d
```

### Stop services:
```bash
docker-compose down
```

### View logs:
```bash
docker-compose logs -f
```

### Rebuild specific service:
```bash
docker-compose build backend
docker-compose build frontend
```

## Environment Variables

### Backend (.env)
```
NODE_ENV=production
DATABASE_PATH=/app/data/database.db
JWT_SECRET=your-super-secret-jwt-key
PORT=3001
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001/api
```

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

