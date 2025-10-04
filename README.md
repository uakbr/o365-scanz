# Office 365 Scanner

A comprehensive Office 365 Scanner that authenticates with Microsoft Graph API, scans organizational data (users, OneDrive files, calendar events), stores the data in a PostgreSQL database, and provides reporting and export capabilities.

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
- PostgreSQL 14 or higher
- An Azure AD application with appropriate permissions

## Azure AD Application Setup

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
10. Add the following permissions:
    - `User.Read.All`
    - `Files.Read.All`
    - `Calendars.Read`
    - `offline_access`
11. Click **Grant admin consent**

## Installation

1. Clone or navigate to the project directory:
```bash
cd o365-scan
```

2. Install dependencies:
```bash
npm install
```

3. Create a PostgreSQL database:
```bash
createdb office365_scanner
```

4. Configure environment variables:
```bash
cp .env.example .env
```

5. Edit `.env` and fill in your credentials:
```env
# Azure AD Configuration
AZURE_CLIENT_ID=your_client_id_here
AZURE_CLIENT_SECRET=your_client_secret_here
AZURE_TENANT_ID=your_tenant_id_here
REDIRECT_URI=http://localhost:3000/auth/callback

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=office365_scanner
DB_USER=postgres
DB_PASSWORD=your_database_password

# Session Configuration
SESSION_SECRET=generate_a_random_secret_key

# Scanning Configuration
CONCURRENT_REQUESTS=5
REQUEST_DELAY=100
MAX_RETRIES=3
```

6. Run database migrations:
```bash
npm run migrate
```

7. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
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

The application uses PostgreSQL with the following tables:

- **users** - Office 365 user information
- **files** - OneDrive file metadata
- **calendar_events** - Calendar events
- **event_attendees** - Event attendee information
- **scan_history** - Scan operation history

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (DEBUG/INFO/WARN/ERROR)
- `AZURE_CLIENT_ID` - Azure AD Application ID
- `AZURE_CLIENT_SECRET` - Azure AD Application Secret
- `AZURE_TENANT_ID` - Azure AD Tenant ID
- `REDIRECT_URI` - OAuth2 redirect URI
- `DB_HOST` - Database host
- `DB_PORT` - Database port
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `SESSION_SECRET` - Session encryption secret
- `CONCURRENT_REQUESTS` - Concurrent API requests (default: 5)
- `REQUEST_DELAY` - Delay between requests in ms (default: 100)
- `MAX_RETRIES` - Maximum retry attempts (default: 3)

## Security Considerations

- Never commit `.env` file to version control
- Use strong `SESSION_SECRET` in production
- Enable HTTPS in production
- Store tokens securely
- Follow principle of least privilege for Azure AD permissions
- Use connection pooling for database
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
