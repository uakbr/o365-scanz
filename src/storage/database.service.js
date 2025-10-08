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
        result = this._runSqliteQuery(text, params);
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
        query: async (text, params = []) => this._runSqliteQuery(text, params),
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
      const begin = this.db.prepare('BEGIN');
      const commit = this.db.prepare('COMMIT');
      const rollback = this.db.prepare('ROLLBACK');
      begin.run();

      const client = {
        query: async (text, params = []) => this._runSqliteQuery(text, params),
        release: () => {},
      };

      try {
        const result = await callback(client);
        commit.run();
        return result;
      } catch (error) {
        rollback.run();
        throw error;
      }
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

  /**
   * Execute a SQLite query with positional parameter conversion
   * @param {string} text - SQL query text with $1 placeholders
   * @param {Array} params - Parameters to bind
   * @returns {{rows: Array, rowCount: number}} Execution result
   * @private
   */
  _runSqliteQuery(text, params = []) {
    const sqliteQuery = text.replace(/\$\d+/g, '?');
    const trimmed = sqliteQuery.trim().toUpperCase();
    const stmt = this.db.prepare(sqliteQuery);
    const normalizedParams = params.map(param => this._normalizeSqliteParam(param));

    if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
      const rows = normalizedParams.length > 0 ? stmt.all(...normalizedParams) : stmt.all();
      return { rows, rowCount: rows.length };
    }

    const info = normalizedParams.length > 0 ? stmt.run(...normalizedParams) : stmt.run();
    return { rows: [], rowCount: info.changes };
  }

  /**
   * Normalize parameter types for SQLite bindings
   * @param {*} value - Raw parameter value
   * @returns {*} Normalized value
   * @private
   */
  _normalizeSqliteParam(value) {
    if (value === undefined) {
      return null;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    if (typeof value === 'object' && value !== null && typeof value.toISOString === 'function') {
      return value.toISOString();
    }

    return value;
  }
}

// Export singleton instance
module.exports = new DatabaseService();
