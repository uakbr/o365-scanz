require('dotenv').config();

// Validate required database environment variables
if (!process.env.DB_PASSWORD) {
  console.error('FATAL: DB_PASSWORD environment variable is required');
  console.error('Please configure DB_PASSWORD in your .env file');
  process.exit(1);
}

module.exports = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'office365_scanner',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle before being closed
  connectionTimeoutMillis: 2000, // How long to wait when connecting a new client
};
