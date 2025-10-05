# Office 365 Scanner

A comprehensive Office 365 Scanner that authenticates with Microsoft Graph API, scans organizational data (users, OneDrive files, calendar events), stores the data in a database, and provides reporting and export capabilities.

## Quick Start

**New in this version:** 
- **Zero-configuration database setup!** No PostgreSQL installation or password required.
- **Flexible permission model:** Choose between organization-wide or user-only scanning.

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure environment variables
cp .env.example .env
# Edit .env and add your Azure AD credentials (see Azure AD Application Setup below)

# 3. Run migrations (creates SQLite database automatically)
npm run migrate

# 4. Start the server
npm start
```

That's it! The application will use SQLite by default with zero configuration.

### Scanning Modes

The application supports two scanning modes:

1. **Organization-Wide Mode** (default)
   - Scans all users, files, and calendars in your organization
   - Requires admin consent for `User.Read.All` and `Files.Read.All` permissions
   - Ideal for IT administrators and compliance teams

2. **User-Only Mode** (privacy-focused)
   - Scans only the authenticated user's own data
   - Requires minimal permissions: `User.Read`, `Files.Read`, `Calendars.Read`
   - No admin consent needed
   - Perfect for individual users or privacy-sensitive environments
   - Enable by setting `SCAN_MODE=user_only` in your `.env` file

## Features

- **OAuth2 Authentication** - Secure authentication with Microsoft Identity Platform
- **Comprehensive Scanning**
  - Scan all users from Azure Active Directory
  - Scan OneDrive files for all users
  - Scan calendar events for all users
- **Recursive Pagination** - Automatically handles API pagination
- **Concurrent Processing** - Configurable concurrent requests for performance
- **Token Management** - Automatic token refresh mechanism
- **Rate Limiting Protection** - Exponential backoff and retry logic
- **PostgreSQL Storage** - Normalized database schema
- **Reporting** - Generate comprehensive reports in JSON format
- **Data Export** - Export data to JSON files

## Technology Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: PostgreSQL 14+
- **HTTP Client**: axios
- **Concurrency**: p-limit
- **Authentication**: OAuth2 with Microsoft Identity Platform

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js 18 or higher
- An Azure AD application with appropriate permissions

**Note:** PostgreSQL is optional. The application uses SQLite by default (zero-configuration embedded database).

## Azure AD Application Setup

### For Organization-Wide Scanning (Default)

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure:
   - Name: `Office 365 Scanner`
   - Supported account types: `Accounts in this organizational directory only`
   - Redirect URI: `http://localhost:3000/auth/callback` (Web)
5. Click **Register**
6. Note the **Application (client) ID** and **Directory (tenant) ID**
7. Go to **Certificates & secrets** > **New client secret**
8. Create a secret and note the **Value** (you won't be able to see it again)
9. Go to **API permissions** > **Add a permission** > **Microsoft Graph** > **Delegated permissions**
10. Add the following **read-only** permissions:
    - `User.Read.All` - Read all user profiles
    - `Files.Read.All` - Read files in OneDrive for all users
    - `Calendars.Read` - Read calendar events for all users
    - `offline_access` - Maintain access to data
11. Click **Grant admin consent** (requires admin privileges)

### For User-Only Scanning (Privacy-Focused)

For a more restrictive setup that only scans the authenticated user's own data:

1. Follow steps 1-9 above
2. In step 10, add these **reduced** permissions instead:
   - `User.Read` - Read the signed-in user's profile only
   - `Files.Read` - Read the user's own files only
   - `Calendars.Read` - Read the user's own calendars only
   - `offline_access` - Maintain access to data
3. **No admin consent required** - users can consent for themselves
4. Set `SCAN_MODE=user_only` in your `.env` file

**Note on Permissions:** All permissions are read-only. The application never modifies any data in your Office 365 tenant.

## Installation

1. Clone or navigate to the project directory:
```bash
cd o365-scan
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` and fill in your Azure AD credentials:
```env
# Azure AD Configuration
AZURE_CLIENT_ID=your_client_id_here
AZURE_CLIENT_SECRET=your_client_secret_here
AZURE_TENANT_ID=your_tenant_id_here
REDIRECT_URI=http://localhost:3000/auth/callback

# Database - SQLite (default, no configuration needed)
DB_TYPE=sqlite

# Session Configuration
SESSION_SECRET=generate_a_random_secret_key
```

5. Run database migrations:
```bash
npm run migrate
```

This will automatically create the SQLite database file at `./data/office365_scanner.db`.

6. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

### Optional: PostgreSQL Setup (for production)

If you prefer PostgreSQL for production use:

1. Install and create a PostgreSQL database:
```bash
createdb office365_scanner
```

2. Update your `.env`:
```env
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=office365_scanner
DB_USER=postgres
DB_PASSWORD=your_database_password
```

3. Run migrations:
```bash
npm run migrate
```

## API Endpoints

### Authentication

- `GET /auth/login` - Initiate OAuth2 login flow
- `GET /auth/callback` - OAuth2 callback handler
- `GET /auth/logout` - Logout and clear session
- `GET /auth/status` - Check authentication status

### Scanning

- `POST /scan/users` - Scan all users from Azure AD
- `POST /scan/files` - Scan files for all users
- `POST /scan/events` - Scan calendar events for all users
- `POST /scan/all` - Scan everything (users, files, events)
- `POST /scan/user/:userId` - Scan specific user

### Reporting

- `GET /reports/summary` - Get summary report
- `GET /reports/users` - Generate user report
- `GET /reports/files` - Generate file report
- `GET /reports/events` - Generate events report
- `GET /reports/user/:id` - Generate report for specific user

### Export

- `GET /reports/export/users` - Export users as JSON
- `GET /reports/export/files` - Export files as JSON
- `GET /reports/export/events` - Export events as JSON
- `GET /reports/export/all` - Export all data as JSON
- `GET /reports/export/user/:id` - Export specific user data

### Health Check

- `GET /health` - API health check
- `GET /db-health` - Database connection check

## Usage Example

1. **Authenticate**:
   - Navigate to `http://localhost:3000/auth/login`
   - Login with your Microsoft account
   - You'll be redirected back to the application

2. **Scan Users**:
```bash
curl -X POST http://localhost:3000/scan/users \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

3. **Scan Files**:
```bash
curl -X POST http://localhost:3000/scan/files \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

4. **Generate Report**:
```bash
curl http://localhost:3000/reports/summary \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"
```

5. **Export Data**:
```bash
curl http://localhost:3000/reports/export/all \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE" \
  -o export.json
```

## Project Structure

```
office365-scanner/
├── src/
│   ├── auth/                 # Authentication module
│   │   ├── auth.controller.js
│   │   ├── auth.service.js
│   │   ├── auth.middleware.js
│   │   └── auth.routes.js
│   ├── scanner/              # Scanner module
│   │   ├── graph-api.service.js
│   │   ├── user-scanner.service.js
│   │   ├── file-scanner.service.js
│   │   ├── event-scanner.service.js
│   │   ├── concurrency.service.js
│   │   └── scanner.routes.js
│   ├── storage/              # Database layer
│   │   ├── database.service.js
│   │   ├── user.repository.js
│   │   ├── file.repository.js
│   │   └── event.repository.js
│   ├── reporting/            # Reporting module
│   │   ├── report.service.js
│   │   ├── export.service.js
│   │   └── report.routes.js
│   ├── config/               # Configuration
│   │   ├── database.config.js
│   │   └── oauth.config.js
│   ├── utils/                # Utilities
│   │   ├── logger.js
│   │   └── error-handler.js
│   └── app.js                # Main application
├── database/
│   ├── migrations/           # Database migrations
│   │   └── 001_initial_schema.sql
│   └── migrate.js            # Migration runner
├── .env.example              # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Database Schema

The application supports two database backends:

### SQLite (Default)
- **Zero-configuration embedded database**
- Perfect for development and single-user scenarios
- No separate database server required
- Data stored in `./data/office365_scanner.db`

### PostgreSQL (Optional)
- **Production-grade relational database**
- Recommended for multi-user production environments
- Requires PostgreSQL 14 or higher

Both databases use the same schema with the following tables:

- **users** - Office 365 user information
- **files** - OneDrive file metadata
- **calendar_events** - Calendar events
- **event_attendees** - Event attendee information
- **scan_history** - Scan operation history

## Configuration

### Environment Variables

#### Required
- `AZURE_CLIENT_ID` - Azure AD Application ID
- `AZURE_CLIENT_SECRET` - Azure AD Application Secret
- `AZURE_TENANT_ID` - Azure AD Tenant ID
- `SESSION_SECRET` - Session encryption secret (generate a random string)

#### Scanning Configuration
- `SCAN_MODE` - Scanning mode: 'org_wide' (default) or 'user_only'
  - `org_wide`: Scans all users in organization (requires admin consent)
  - `user_only`: Scans only authenticated user's data (no admin consent needed)

#### Optional Server Configuration
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (DEBUG/INFO/WARN/ERROR)
- `REDIRECT_URI` - OAuth2 redirect URI (default: http://localhost:3000/auth/callback)

#### Optional Database Configuration
- `DB_TYPE` - Database type: 'sqlite' (default) or 'postgresql'
- `SQLITE_DB_PATH` - SQLite database file path (default: ./data/office365_scanner.db)

#### PostgreSQL Configuration (only if DB_TYPE=postgresql)
- `DB_HOST` - Database host (default: localhost)
- `DB_PORT` - Database port (default: 5432)
- `DB_NAME` - Database name (default: office365_scanner)
- `DB_USER` - Database user (default: postgres)
- `DB_PASSWORD` - Database password (required for PostgreSQL)

#### Optional Performance Configuration
- `CONCURRENT_REQUESTS` - Concurrent API requests (default: 5)
- `REQUEST_DELAY` - Delay between requests in ms (default: 100)
- `MAX_RETRIES` - Maximum retry attempts (default: 3)

## Security Considerations

- Never commit `.env` file to version control
- Use strong `SESSION_SECRET` in production
- Enable HTTPS in production
- Store tokens securely
- **Minimal permissions:** The application uses read-only permissions and never modifies data in your Office 365 tenant
- **Zero-password default:** SQLite requires no database password, reducing the attack surface for local development
- Use connection pooling for database (PostgreSQL)
- Implement rate limiting for API endpoints

## Error Handling

The application includes comprehensive error handling:

- Authentication errors (401, 403)
- Rate limiting errors (429) with automatic retry
- API errors with exponential backoff
- Database errors
- Network errors

## Performance

- Configurable concurrency level (default: 5 concurrent requests)
- Automatic pagination handling
- Connection pooling for database
- Token caching and refresh
- Request delay to avoid rate limiting

## License

MIT

## Support

For issues and questions, please open an issue on the repository.
