# Pre-Alpha Launch Checklist

## 🔴 CRITICAL - Must Do Before Launch

### 1. Security Configuration
- [ ] **Generate a strong JWT secret**
  ```bash
  # Run this and copy the output
  openssl rand -base64 64
  ```
  Add to your environment or docker-compose.yml:
  ```yaml
  JWT_SECRET=<your-generated-secret>
  ```

- [ ] **Set admin credentials**
  ```yaml
  ADMIN_USERNAME=<your-admin-username>
  ADMIN_PASSWORD=<strong-password-at-least-12-chars>
  ADMIN_EMAIL=<your-email>
  ```

- [ ] **Configure CORS for your domain**
  ```yaml
  FRONTEND_URL=https://your-domain.com
  ```

### 2. Data Backup Strategy
- [ ] The SQLite database is stored in a Docker volume (`backend_data`)
- [ ] Set up regular backups of this volume:
  ```bash
  # Backup command
  docker cp table-tennis-backend:/app/data/database.db ./backups/database_$(date +%Y%m%d).db
  ```

### 3. Test the Deployment
- [ ] Register a test user
- [ ] Create a test league
- [ ] Record and accept a test match
- [ ] Verify ELO updates correctly
- [ ] Test user can leave and rejoin league

---

## 🟡 RECOMMENDED - Should Do Before Launch

### 4. Monitoring
- [ ] Set up monitoring for the health endpoint: `http://your-domain:3001/health`
- [ ] Check Docker logs regularly: `docker-compose logs -f backend`

### 5. User Communication
- [ ] Prepare a simple guide for kids on how to:
  - Register an account
  - Join a league (invite codes)
  - Record matches
  - Understand their ELO rating

### 6. Admin Preparation
- [ ] Log in as admin and familiarize yourself with:
  - Creating leagues
  - Inviting users to leagues
  - Accepting/rejecting match results
  - Promoting league admins

---

## 🟢 NICE TO HAVE - Can Do Later

### 7. Optional Enhancements
- [ ] Set up HTTPS (use a reverse proxy like Caddy or nginx with Let's Encrypt)
- [ ] Configure email notifications (currently uses in-app notifications only)
- [ ] Add database indexes for performance (already included in schema)
- [ ] Set up automated backups

---

## Deployment Commands

### Start the app
```bash
docker-compose up -d
```

### View logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Restart after config changes
```bash
docker-compose down
docker-compose up -d
```

### Backup database
```bash
docker cp table-tennis-backend:/app/data/database.db ./backup.db
```

### Restore database
```bash
docker cp ./backup.db table-tennis-backend:/app/data/database.db
docker-compose restart backend
```

---

## Known Limitations (Pre-Alpha)

1. **No email verification** - Users can register with any email
2. **No password reset** - If a user forgets password, admin must help
3. **Single server** - Not horizontally scalable (fine for small groups)
4. **SQLite** - Suitable for hundreds of users, not thousands

---

## Support

If issues arise during the pre-alpha:
1. Check backend logs: `docker-compose logs backend`
2. Check health endpoint: `curl http://localhost:3001/health`
3. Restart if needed: `docker-compose restart backend`


