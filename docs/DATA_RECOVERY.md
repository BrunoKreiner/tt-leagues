# Data Recovery Guide

## What Happened

During testing of the database migration fix on January 5, 2026, the Docker volume `tt-leagues_backend_data` was removed, which deleted all local database data.

## Recovery Options

### 1. Check for Windows File Recovery
Windows may have shadow copies or file history:
- Check File History: Settings → Update & Security → Backup
- Check Previous Versions: Right-click on Docker volume mount point
- Use Windows File Recovery tool (if available)

### 2. Check Docker Volume Snapshots
Docker doesn't automatically create volume snapshots, but check:
```powershell
docker volume ls
docker volume inspect tt-leagues_backend_data
```

### 3. Manual Recreation from Screenshots
If you have screenshots of your leagues, you can manually recreate:
- League names
- Member lists
- Match results (if visible)

### 4. Check Production Database
If you were using Neon Postgres in production (DATABASE_URL), your production data should be safe and unaffected.

## Prevention for Future

### Set Up Regular Backups

Create a backup script (`backup-db.ps1`):
```powershell
# Backup Docker volume
$backupDir = ".\backups"
New-Item -ItemType Directory -Force -Path $backupDir
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
docker run --rm -v tt-leagues_backend_data:/data -v ${PWD}\backups:/backup alpine tar czf /backup/db-backup-$timestamp.tar.gz -C /data .
```

### Add to docker-compose.yml
Consider adding a backup service or scheduled task.

### Use Production Database
For important data, always use Neon Postgres (DATABASE_URL) instead of local SQLite.

## Current Status

- Local Docker database: Empty (recreated during testing)
- Migration code: Fixed to be safer (won't delete valid data)
- Recommendation: Use Neon Postgres for production data

