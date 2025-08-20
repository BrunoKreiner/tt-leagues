# Table Tennis League App - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Table Tennis League application using Docker on Windows with WSL issues.

## Prerequisites

### Required Software
- **Docker Desktop for Windows** (latest version)
- **Git for Windows** (to clone the repository)
- **Web Browser** (Chrome, Firefox, Edge, or Safari)

### System Requirements
- Windows 10/11 with Docker Desktop support
- At least 4GB RAM available for Docker
- 2GB free disk space
- Ports 80 and 3001 available

## Installation Steps

### 1. Install Docker Desktop

1. Download Docker Desktop from: https://www.docker.com/products/docker-desktop/
2. Run the installer and follow the setup wizard
3. Start Docker Desktop and wait for it to fully initialize
4. Verify installation by opening Command Prompt and running:
   ```cmd
   docker --version
   docker-compose --version
   ```

### 2. Get the Application Code

Option A - If you have the source code:
```cmd
cd C:\
mkdir Projects
cd Projects
# Copy the table-tennis-league folder here
```

Option B - If cloning from repository:
```cmd
cd C:\Projects
git clone <repository-url> table-tennis-league
cd table-tennis-league
```

### 3. Deploy the Application

1. Open Command Prompt as Administrator
2. Navigate to the project directory:
   ```cmd
   cd C:\Projects\table-tennis-league
   ```

3. Start the application:
   ```cmd
   docker-compose up -d
   ```

4. Wait for the build and startup process (first time may take 5-10 minutes)

5. Verify the services are running:
   ```cmd
   docker-compose ps
   ```

### 4. Access the Application

- **Frontend**: Open your browser and go to http://localhost
- **Backend API**: http://localhost:3001
- **Health Check**: http://localhost:3001/health

### 5. Login with Admin Account

- **Username**: `admin`
- **Password**: `admin123`

## Managing the Application

### Start the Application
```cmd
docker-compose up -d
```

### Stop the Application
```cmd
docker-compose down
```

### View Logs
```cmd
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restart Services
```cmd
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart backend
```

### Update the Application
```cmd
# Stop services
docker-compose down

# Rebuild and start
docker-compose up --build -d
```

## Troubleshooting

### Common Issues

#### Port Already in Use
If you get "port already in use" errors:

1. Check what's using the ports:
   ```cmd
   netstat -ano | findstr :80
   netstat -ano | findstr :3001
   ```

2. Stop the conflicting service or change ports in `docker-compose.yml`

#### Docker Desktop Not Running
- Make sure Docker Desktop is started and running
- Check the system tray for the Docker whale icon
- Restart Docker Desktop if needed

#### Build Failures
```cmd
# Clean Docker cache
docker system prune -a

# Remove old containers and volumes
docker-compose down -v

# Rebuild from scratch
docker-compose up --build
```

#### Database Issues
```cmd
# Reset database (WARNING: This deletes all data)
docker-compose down -v
docker-compose up -d
```

#### Permission Issues
- Run Command Prompt as Administrator
- Make sure Docker Desktop has proper permissions

### Performance Issues

#### Slow Performance
- Allocate more resources to Docker Desktop:
  - Open Docker Desktop Settings
  - Go to Resources → Advanced
  - Increase Memory to 4GB+
  - Increase CPU cores to 2+

#### Disk Space
- Clean up unused Docker resources:
  ```cmd
  docker system prune -a --volumes
  ```

## Advanced Configuration

### Environment Variables

Create `.env` files for custom configuration:

**Backend (.env in backend folder):**
```env
NODE_ENV=production
DATABASE_PATH=/app/data/database.db
JWT_SECRET=your-custom-secret-key-here
PORT=3001
```

**Frontend (.env in frontend folder):**
```env
VITE_API_URL=http://localhost:3001/api
```

### Custom Ports

Edit `docker-compose.yml` to change ports:

```yaml
services:
  frontend:
    ports:
      - "8080:80"  # Change from 80 to 8080
  backend:
    ports:
      - "3002:3001"  # Change from 3001 to 3002
```

### Data Persistence

The database is automatically persisted in a Docker volume. To backup:

```cmd
# Create backup
docker run --rm -v table-tennis-league_backend_data:/data -v C:\backup:/backup alpine tar czf /backup/database-backup.tar.gz -C /data .

# Restore backup
docker run --rm -v table-tennis-league_backend_data:/data -v C:\backup:/backup alpine tar xzf /backup/database-backup.tar.gz -C /data
```

## Security Considerations

### Production Deployment

For production use, update these settings:

1. **Change JWT Secret**: Update `JWT_SECRET` in backend environment
2. **Use HTTPS**: Configure reverse proxy with SSL certificates
3. **Database Security**: Use PostgreSQL or MySQL instead of SQLite
4. **Admin Password**: Change the default admin password immediately
5. **Network Security**: Restrict access using firewall rules

### User Management

1. Login as admin (admin/admin123)
2. Change the admin password immediately
3. Create additional admin users if needed
4. Regular users can register themselves

## Monitoring and Maintenance

### Health Checks

The application includes built-in health checks:
- Frontend: http://localhost/
- Backend: http://localhost:3001/health

### Log Management

Logs are automatically managed by Docker. To view:
```cmd
# Recent logs
docker-compose logs --tail=100

# Follow logs in real-time
docker-compose logs -f
```

### Updates

To update the application:
1. Get the latest code
2. Stop the current deployment: `docker-compose down`
3. Rebuild and start: `docker-compose up --build -d`

## Support

### Getting Help

1. Check the logs for error messages
2. Verify Docker Desktop is running properly
3. Ensure ports are not blocked by firewall
4. Check system resources (RAM, disk space)

### Common Commands Reference

```cmd
# Start application
docker-compose up -d

# Stop application
docker-compose down

# View status
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Update application
docker-compose up --build -d

# Clean up
docker system prune -a
```

This deployment guide should help you successfully run the Table Tennis League application on Windows using Docker!

