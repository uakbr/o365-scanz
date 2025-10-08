const db = require('./database.service');
const logger = require('../utils/logger');

class FileRepository {
  /**
   * Upsert a file (insert or update if exists)
   * @param {Object} fileData - File data from Microsoft Graph
   * @param {string} userId - User ID who owns the file
   * @returns {Promise<Object>} Inserted/updated file
   */
  async upsertFile(fileData, userId) {
    const query = `
      INSERT INTO files (
        id, user_id, name, size, web_url,
        created_datetime, last_modified_datetime, mime_type,
        last_scanned_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        size = EXCLUDED.size,
        web_url = EXCLUDED.web_url,
        last_modified_datetime = EXCLUDED.last_modified_datetime,
        mime_type = EXCLUDED.mime_type,
        last_scanned_at = EXCLUDED.last_scanned_at,
        updated_at = EXCLUDED.updated_at
    `;

    const timestamp = new Date().toISOString();
    const values = [
      fileData.id,
      userId,
      fileData.name,
      fileData.size || 0,
      fileData.webUrl,
      fileData.createdDateTime ? new Date(fileData.createdDateTime).toISOString() : null,
      fileData.lastModifiedDateTime ? new Date(fileData.lastModifiedDateTime).toISOString() : null,
      fileData.file?.mimeType || null,
      timestamp,
      timestamp
    ];

    try {
      await db.query(query, values);
      return true;
    } catch (error) {
      logger.error('Error upserting file:', { fileId: fileData.id, error: error.message });
      throw error;
    }
  }

  /**
   * Bulk upsert files for a user
   * @param {Array<Object>} files - Array of file data
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of files upserted
   */
  async bulkUpsertFiles(files, userId) {
    if (!files || files.length === 0) return 0;

    const values = [];
    const placeholders = [];

    files.forEach((file, idx) => {
      const base = idx * 10;
      const timestamp = new Date().toISOString();
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${base + 10})`
      );
      values.push(
        file.id,
        userId,
        file.name,
        file.size || 0,
        file.webUrl,
        file.createdDateTime ? new Date(file.createdDateTime).toISOString() : null,
        file.lastModifiedDateTime ? new Date(file.lastModifiedDateTime).toISOString() : null,
        file.file?.mimeType || null,
        timestamp,
        timestamp
      );
    });

    const query = `
      INSERT INTO files (
        id, user_id, name, size, web_url,
        created_datetime, last_modified_datetime, mime_type,
        last_scanned_at, updated_at
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id)
      DO UPDATE SET
        name = EXCLUDED.name,
        size = EXCLUDED.size,
        web_url = EXCLUDED.web_url,
        last_modified_datetime = EXCLUDED.last_modified_datetime,
        mime_type = EXCLUDED.mime_type,
        last_scanned_at = EXCLUDED.last_scanned_at,
        updated_at = EXCLUDED.updated_at
    `;

    try {
      await db.query(query, values);
      return files.length;
    } catch (error) {
      logger.error('Error bulk upserting files:', error.message);
      throw error;
    }
  }

  /**
   * Get all files
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array>} Array of files
   */
  async getAllFiles(options = {}) {
    const { limit, offset } = options;
    let query = 'SELECT * FROM files ORDER BY last_modified_datetime DESC';
    const params = [];

    if (limit) {
      params.push(parseInt(limit));
      query += ` LIMIT $${params.length}`;
    }
    if (offset) {
      params.push(parseInt(offset));
      query += ` OFFSET $${params.length}`;
    }

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get files by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of files
   */
  async getFilesByUserId(userId) {
    const query = 'SELECT * FROM files WHERE user_id = $1 ORDER BY last_modified_datetime DESC';
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  /**
   * Get file by ID
   * @param {string} fileId - File ID
   * @returns {Promise<Object|null>} File object or null
   */
  async getFileById(fileId) {
    const query = 'SELECT * FROM files WHERE id = $1';
    const result = await db.query(query, [fileId]);
    return result.rows[0] || null;
  }

  /**
   * Get files count
   * @returns {Promise<number>} Total number of files
   */
  async getFilesCount() {
    const query = 'SELECT COUNT(*) as count FROM files';
    const result = await db.query(query);
    return parseInt(result.rows[0].count);
  }

  /**
   * Get files count by user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of files for user
   */
  async getFilesCountByUser(userId) {
    const query = 'SELECT COUNT(*) as count FROM files WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return parseInt(result.rows[0].count);
  }

  /**
   * Delete file by ID
   * @param {string} fileId - File ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteFile(fileId) {
    const query = 'DELETE FROM files WHERE id = $1';
    const result = await db.query(query, [fileId]);
    return result.rowCount > 0;
  }

  /**
   * Delete all files for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of files deleted
   */
  async deleteFilesByUserId(userId) {
    const query = 'DELETE FROM files WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return result.rowCount;
  }

  /**
   * Get file statistics
   * @returns {Promise<Object>} File statistics
   */
  async getFileStats() {
    const query = `
      SELECT
        COUNT(*) as total_files,
        SUM(size) as total_size,
        AVG(size) as avg_size,
        MAX(size) as max_size,
        MIN(size) as min_size
      FROM files
    `;
    const result = await db.query(query);
    return result.rows[0];
  }
}

module.exports = new FileRepository();
