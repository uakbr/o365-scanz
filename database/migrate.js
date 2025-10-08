const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = require('../src/config/database.config');

async function runSQLiteMigrations() {
  const Database = require('better-sqlite3');

  // Ensure data directory exists
  const dbDir = path.dirname(dbConfig.filename);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbConfig.filename);
  db.pragma('journal_mode = WAL');

  console.log(`Running SQLite migrations on ${dbConfig.filename}...\n`);

  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sqlite.sql'))
    .sort();

  const appliedStmt = db.prepare('SELECT filename FROM schema_migrations');
  const appliedMigrations = new Set(appliedStmt.all().map(row => row.filename));

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
    if (appliedMigrations.has(file)) {
      console.log(`⊙ ${file} already applied (skipping)`);
      skippedCount++;
      continue;
    }

    console.log(`Running migration: ${file}`);
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf8');

    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(file);
      console.log(`✓ ${file} completed successfully\n`);
      appliedCount++;
    } catch (error) {
      console.error(`✗ Error running ${file}:`, error.message);
      db.close();
      process.exit(1);
    }
  }

  console.log(`\nMigrations complete: ${appliedCount} applied, ${skippedCount} skipped`);
  db.close();
}

async function runPostgreSQLMigrations() {
  const { Pool } = require('pg');

  const pool = new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.user,
    password: dbConfig.password,
  });

  console.log('Running PostgreSQL migrations...\n');

  // Ensure migrations tracking table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename VARCHAR(255) UNIQUE NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Get already applied migrations
  const result = await pool.query('SELECT filename FROM schema_migrations');
  const appliedMigrations = new Set(result.rows.map(row => row.filename));

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql') && !f.endsWith('.sqlite.sql'))
    .sort();

  let appliedCount = 0;
  let skippedCount = 0;

  for (const file of files) {
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
      await pool.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING',
        [file]
      );
      console.log(`✓ ${file} completed successfully\n`);
      appliedCount++;
    } catch (error) {
      console.error(`✗ Error running ${file}:`, error.message);
      await pool.end();
      process.exit(1);
    }
  }

  console.log(`\nMigrations complete: ${appliedCount} applied, ${skippedCount} skipped`);
  await pool.end();
}

async function runMigrations() {
  try {
    if (dbConfig.type === 'sqlite') {
      await runSQLiteMigrations();
    } else {
      await runPostgreSQLMigrations();
    }
  } catch (error) {
    console.error('Migration failed:', error);
    if (require.main === module) {
      process.exit(1);
    }
    throw error;
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = {
  runMigrations
};
