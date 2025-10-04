const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function ensureMigrationsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await pool.query(query);
}

async function getAppliedMigrations() {
  const result = await pool.query('SELECT filename FROM schema_migrations');
  return new Set(result.rows.map(row => row.filename));
}

async function recordMigration(filename) {
  await pool.query(
    'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
    [filename]
  );
}

async function runMigrations() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).sort();

  console.log('Starting database migrations...\n');

  // Ensure migrations tracking table exists
  await ensureMigrationsTable();

  // Get already applied migrations
  const appliedMigrations = await getAppliedMigrations();

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (file.endsWith('.sql')) {
      if (appliedMigrations.has(file)) {
        console.log(`⊙ ${file} already applied (skipping)`);
        skippedCount++;
        continue;
      }

      console.log(`Running migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await pool.query(sql);
        await recordMigration(file);
        console.log(`✓ ${file} completed successfully\n`);
        appliedCount++;
      } catch (error) {
        console.error(`✗ Error running ${file}:`, error.message);
        process.exit(1);
      }
    }
  }

  console.log(`\nMigrations complete: ${appliedCount} applied, ${skippedCount} skipped`);
  await pool.end();
}

runMigrations().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
