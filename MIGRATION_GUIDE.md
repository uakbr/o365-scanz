# Migration Guide for Existing Users

This guide helps existing Office 365 Scanner users understand the changes and, if desired, migrate to the new zero-configuration setup.

## Good News: No Action Required!

**Your existing PostgreSQL setup continues to work without any changes.**

All modifications are backward compatible. Your current configuration will continue functioning exactly as before.

## What Changed?

### New Default: SQLite (Optional)
- SQLite is now the default database for new installations
- Existing PostgreSQL users are unaffected
- You can continue using PostgreSQL (recommended for production)

### New Option: User-Only Scanning Mode
- New `SCAN_MODE=user_only` option for privacy-focused scanning
- Your existing org-wide scanning continues to work as-is
- Only affects new configurations that explicitly set this variable

## For Existing PostgreSQL Users

### No Migration Needed
Your `.env` file already contains:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=office365_scanner
DB_USER=postgres
DB_PASSWORD=your_password
```

The system automatically detects PostgreSQL configuration and continues using it.

### Optional: Explicitly Set DB_TYPE
If you want to be explicit, add to your `.env`:
```env
DB_TYPE=postgresql
```

This is optional - the system auto-detects PostgreSQL when `DB_PASSWORD` is present.

## For Users Who Want to Switch to SQLite

### Why Switch?
- Simpler local development setup
- No database password to manage
- Smaller resource footprint
- Easier backup (single file)

### How to Switch

1. **Backup your existing data** (if needed):
```bash
pg_dump office365_scanner > backup.sql
```

2. **Update your `.env` file**:
```env
# Comment out or remove PostgreSQL settings
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=office365_scanner
# DB_USER=postgres
# DB_PASSWORD=your_password

# Add SQLite configuration (or leave default)
DB_TYPE=sqlite
SQLITE_DB_PATH=./data/office365_scanner.db
```

3. **Run migrations**:
```bash
npm run migrate
```

4. **Restart the application**:
```bash
npm start
```

Your application now uses SQLite! Note that you'll need to re-scan your data.

## For New Features

### Using User-Only Scanning Mode

If you want to use the new privacy-focused user-only mode:

1. **Update Azure AD permissions**:
   - Remove: `User.Read.All`, `Files.Read.All`
   - Add: `User.Read`, `Files.Read`
   - Keep: `Calendars.Read`, `offline_access`

2. **Add to your `.env`**:
```env
SCAN_MODE=user_only
```

3. **Restart the application**:
```bash
npm start
```

Now the application will only scan the authenticated user's data.

## Database Comparison

### PostgreSQL (Your Current Setup)
✅ Production-grade reliability
✅ Supports high concurrency
✅ Advanced query optimization
✅ Suitable for multi-user environments
❌ Requires separate installation
❌ Requires password management

### SQLite (New Default)
✅ Zero configuration
✅ No password needed
✅ Single file database
✅ Perfect for development/testing
❌ Not ideal for high concurrency
❌ Limited for multi-user scenarios

### Recommendation
- **Development/Testing**: SQLite
- **Production/Multi-user**: PostgreSQL (your current setup)

## Environment Variable Changes

### New Optional Variables
```env
# Database type selection (optional)
DB_TYPE=sqlite  # or 'postgresql'

# SQLite configuration (optional)
SQLITE_DB_PATH=./data/office365_scanner.db

# Scanning mode (optional)
SCAN_MODE=user_only  # or leave empty for org_wide (default)
```

### Unchanged Variables (Still Required)
```env
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=...
SESSION_SECRET=...
```

## Troubleshooting

### "Database connection failed"
- If you see this after updating, check that your `DB_TYPE` matches your setup
- PostgreSQL users should have `DB_TYPE=postgresql` (or just leave it unset)
- SQLite users should have `DB_TYPE=sqlite`

### "Permission denied" errors after update
- Your Azure AD permissions are unchanged
- The update only adds new optional permission modes
- Existing org-wide scanning works as before

### Migration runs but database isn't created
- SQLite: Check that the `data/` directory is writable
- PostgreSQL: Check that your database credentials are correct

## Getting Help

If you encounter issues:

1. Check that your `.env` file contains valid configuration
2. Verify database credentials (PostgreSQL users)
3. Check the application logs for specific error messages
4. File an issue on GitHub with your (sanitized) configuration

## Summary

**For Existing Users:**
- ✅ No action required - everything works as before
- ✅ New features are opt-in
- ✅ Full backward compatibility
- ✅ Can continue with PostgreSQL or try SQLite

**For New Users:**
- ✅ Zero-configuration with SQLite
- ✅ No database password needed
- ✅ Optional privacy-focused scanning mode
- ✅ Can upgrade to PostgreSQL when needed
