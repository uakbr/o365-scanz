require('dotenv').config();

// Database type: 'sqlite' (default, zero-config) or 'postgresql' (production)
const dbType = process.env.DB_TYPE || 'sqlite';

// SQLite configuration (default - no setup required)
const sqliteConfig = {
  type: 'sqlite',
  filename: process.env.SQLITE_DB_PATH || './data/office365_scanner.db'
};

// PostgreSQL configuration (optional - for production use)
const postgresConfig = {
  type: 'postgresql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'office365_scanner',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
};

// Validate PostgreSQL configuration if selected
if (dbType === 'postgresql') {
  if (!process.env.DB_PASSWORD) {
    throw new Error('DB_PASSWORD environment variable is required for PostgreSQL. Configure DB_PASSWORD in your .env file or use SQLite by removing DB_TYPE or setting DB_TYPE=sqlite.');
  }
}

module.exports = dbType === 'sqlite' ? sqliteConfig : postgresConfig;
