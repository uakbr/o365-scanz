# Quick Reference Guide

## New User Quick Start

Get started in under 5 minutes with zero database configuration!

### Setup Steps
```bash
# 1. Install dependencies
npm install

# 2. Configure Azure AD credentials
cp .env.example .env
# Edit .env and add: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID

# 3. Create database
npm run migrate

# 4. Start application
npm start
```

That's it! Database is created automatically with no password required.

## Configuration Cheat Sheet

### Minimal Setup (.env)
```env
AZURE_CLIENT_ID=your_client_id
AZURE_CLIENT_SECRET=your_secret
AZURE_TENANT_ID=your_tenant_id
SESSION_SECRET=random_secret_here
```

### Database Options

#### SQLite (Default - No Password)
```env
DB_TYPE=sqlite
# Optional: SQLITE_DB_PATH=./data/office365_scanner.db
```

#### PostgreSQL (Production)
```env
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=office365_scanner
DB_USER=postgres
DB_PASSWORD=your_password
```

### Scanning Modes

#### Organization-Wide (Default)
```env
# No need to set anything - this is the default
# Scans all users in organization
# Requires: User.Read.All, Files.Read.All, Calendars.Read
```

#### User-Only (Privacy-Focused)
```env
SCAN_MODE=user_only
# Scans only authenticated user's data
# Requires: User.Read, Files.Read, Calendars.Read
```

## Azure AD Permission Setup

### Organization-Wide Mode
**API Permissions (Delegated):**
- ✅ User.Read.All
- ✅ Files.Read.All
- ✅ Calendars.Read
- ✅ offline_access

**Requires:** Admin consent

### User-Only Mode
**API Permissions (Delegated):**
- ✅ User.Read
- ✅ Files.Read
- ✅ Calendars.Read
- ✅ offline_access

**Requires:** User consent (no admin needed)

## Common Commands

### Development
```bash
npm run dev          # Start with auto-reload
npm run migrate      # Run database migrations
npm start            # Start production server
```

### Database
```bash
# SQLite (default)
npm run migrate      # Creates ./data/office365_scanner.db

# PostgreSQL
createdb office365_scanner  # Create DB first
npm run migrate             # Run migrations
```

## API Endpoints Quick Reference

### Authentication
- `GET /auth/login` - Start OAuth flow
- `GET /auth/callback` - OAuth callback
- `GET /auth/logout` - Logout
- `GET /auth/status` - Check auth status

### Scanning
- `POST /scan/users` - Scan users
- `POST /scan/files` - Scan files
- `POST /scan/events` - Scan events
- `POST /scan/all` - Scan everything

### Reports
- `GET /reports/summary` - Summary report
- `GET /reports/users` - User report
- `GET /reports/files` - File report
- `GET /reports/events` - Events report

### Export
- `GET /reports/export/all` - Export all data

### Health
- `GET /health` - API health
- `GET /db-health` - Database health

## Troubleshooting Quick Fixes

### Database Issues

**Error: "DB_PASSWORD required"**
```bash
# Solution: Using SQLite? Remove or comment out DB_PASSWORD
# Using PostgreSQL? Ensure DB_TYPE=postgresql and DB_PASSWORD is set
```

**Error: "Database connection failed"**
```bash
# SQLite: Check write permissions for ./data/
# PostgreSQL: Verify DB credentials and service is running
```

### Permission Issues

**Error: "Insufficient permissions"**
```bash
# Check Azure AD app permissions
# Org-wide mode needs: User.Read.All, Files.Read.All
# User-only mode needs: User.Read, Files.Read
```

**Error: "Admin consent required"**
```bash
# Org-wide mode: Admin must grant consent
# User-only mode: Set SCAN_MODE=user_only for user consent
```

### Migration Issues

**Error: "Migration failed"**
```bash
# Check database is accessible
# SQLite: Ensure ./data/ directory exists and is writable
# PostgreSQL: Ensure database exists and credentials correct
```

## Feature Comparison

| Feature | SQLite | PostgreSQL |
|---------|--------|------------|
| Setup Time | 2 min | 15-30 min |
| Password Required | No | Yes |
| Installation | None | PostgreSQL server |
| Production Ready | Development | Yes |
| Multi-user | Limited | Yes |
| Backup | Copy file | pg_dump |

## Environment Variables Summary

### Required (4 variables)
- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `SESSION_SECRET`

### Optional Database
- `DB_TYPE` (default: sqlite)
- `SQLITE_DB_PATH` (default: ./data/office365_scanner.db)
- PostgreSQL vars (only if DB_TYPE=postgresql)

### Optional Scanning
- `SCAN_MODE` (default: org_wide)
- `CONCURRENT_REQUESTS` (default: 5)
- `REQUEST_DELAY` (default: 100)
- `MAX_RETRIES` (default: 3)

## Support

- 📖 Full Documentation: See [README.md](README.md)
- 🔄 Migration Guide: See [MIGRATION_GUIDE.md](MIGRATION_GUIDE.md)
- 📊 Comparison: See [BEFORE_AFTER_COMPARISON.md](BEFORE_AFTER_COMPARISON.md)
- 💡 Improvements: See [PERMISSION_DATABASE_IMPROVEMENTS.md](PERMISSION_DATABASE_IMPROVEMENTS.md)

## Quick Decision Guide

**Choose SQLite if:**
- ✅ Just getting started
- ✅ Development/testing
- ✅ Single user
- ✅ Want simplest setup

**Choose PostgreSQL if:**
- ✅ Production deployment
- ✅ Multiple users
- ✅ High concurrency needed
- ✅ Advanced features required

**Choose Organization-Wide if:**
- ✅ IT administrator
- ✅ Need all org data
- ✅ Have admin privileges

**Choose User-Only if:**
- ✅ Individual user
- ✅ Privacy focused
- ✅ No admin access
- ✅ Personal use only
