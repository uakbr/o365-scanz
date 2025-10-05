const dbConfig = require('../config/database.config');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.dbType = dbConfig.type;

    if (this.dbType === 'sqlite') {
      this._initSQLite();
    } else {
      this._initPostgreSQL();
    }
  }

  _initSQLite() {
    const Database = require('better-sqlite3');
    const path = require('path');
    const fs = require('fs');

    // Ensure data directory exists
    const dbDir = path.dirname(dbConfig.filename);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbConfig.filename);
    this.db.pragma('journal_mode = WAL');
    logger.info(`SQLite database initialized at ${dbConfig.filename}`);
  }

  _initPostgreSQL() {
    const { Pool } = require('pg');
    this.pool = new Pool(dbConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error:', err);
    });

    // Log successful connection
    this.pool.on('connect', () => {
      logger.info('New PostgreSQL connection established');
    });
  }

  /**
   * Execute a query with parameters
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params = []) {
    const start = Date.now();
    try {
      let result;

      if (this.dbType === 'sqlite') {
        // Convert PostgreSQL-style $1, $2 to SQLite-style ?
        const sqliteQuery = text.replace(/\$\d+/g, '?');
        
        if (sqliteQuery.trim().toUpperCase().startsWith('SELECT') || 
            sqliteQuery.trim().toUpperCase().startsWith('WITH')) {
          const stmt = this.db.prepare(sqliteQuery);
          const rows = params ? stmt.all(...params) : stmt.all();
          result = { rows, rowCount: rows.length };
        } else {
          const stmt = this.db.prepare(sqliteQuery);
          const info = params ? stmt.run(...params) : stmt.run();
          result = { rows: [], rowCount: info.changes };
        }
      } else {
        result = await this.pool.query(text, params);
      }

      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: result.rowCount });
      return result;
    } catch (error) {
      logger.error('Database query error:', { text, error: error.message });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   * @returns {Promise<Object>} Database client
   */
  async getClient() {
    if (this.dbType === 'sqlite') {
      // SQLite doesn't use connection pools, return a wrapper
      return {
        query: this.query.bind(this),
        release: () => {},
      };
    } else {
      return await this.pool.connect();
    }
  }

  /**
   * Execute a transaction
   * @param {Function} callback - Transaction callback function
   * @returns {Promise<*>} Transaction result
   */
  async transaction(callback) {
    if (this.dbType === 'sqlite') {
      // SQLite transaction using better-sqlite3
      const transaction = this.db.transaction((cb) => {
        const client = {
          query: async (text, params) => {
            const sqliteQuery = text.replace(/\$\d+/g, '?');
            if (sqliteQuery.trim().toUpperCase().startsWith('SELECT')) {
              const stmt = this.db.prepare(sqliteQuery);
              const rows = params ? stmt.all(...params) : stmt.all();
              return { rows, rowCount: rows.length };
            } else {
              const stmt = this.db.prepare(sqliteQuery);
              const info = params ? stmt.run(...params) : stmt.run();
              return { rows: [], rowCount: info.changes };
            }
          },
          release: () => {},
        };
        return cb(client);
      });

      return await transaction(callback);
    } else {
      const client = await this.getClient();
      try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    }
  }

  /**
   * Check database connection health
   * @returns {Promise<boolean>} Connection status
   */
  async healthCheck() {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Close all connections in the pool
   * @returns {Promise<void>}
   */
  async close() {
    if (this.dbType === 'sqlite') {
      this.db.close();
      logger.info('SQLite database closed');
    } else {
      await this.pool.end();
      logger.info('PostgreSQL pool closed');
    }
  }
}

// Export singleton instance
module.exports = new DatabaseService();
