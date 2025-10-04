const { Pool } = require('pg');
const dbConfig = require('../config/database.config');
const logger = require('../utils/logger');

class DatabaseService {
  constructor() {
    this.pool = new Pool(dbConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error:', err);
    });

    // Log successful connection
    this.pool.on('connect', () => {
      logger.info('New database connection established');
    });
  }

  /**
   * Execute a query with parameters
   * @param {string} text - SQL query text
   * @param {Array} params - Query parameters
   * @returns {Promise<Object>} Query result
   */
  async query(text, params) {
    const start = Date.now();
    try {
      const result = await this.pool.query(text, params);
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
    return await this.pool.connect();
  }

  /**
   * Execute a transaction
   * @param {Function} callback - Transaction callback function
   * @returns {Promise<*>} Transaction result
   */
  async transaction(callback) {
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
    await this.pool.end();
    logger.info('Database pool closed');
  }
}

// Export singleton instance
module.exports = new DatabaseService();
