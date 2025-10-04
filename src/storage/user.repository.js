const db = require('./database.service');
const logger = require('../utils/logger');

class UserRepository {
  /**
   * Upsert a user (insert or update if exists)
   * @param {Object} userData - User data from Microsoft Graph
   * @returns {Promise<Object>} Inserted/updated user
   */
  async upsertUser(userData) {
    const query = `
      INSERT INTO users (
        id, user_principal_name, display_name, mail,
        job_title, department, office_location,
        last_scanned_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      ON CONFLICT (id)
      DO UPDATE SET
        user_principal_name = EXCLUDED.user_principal_name,
        display_name = EXCLUDED.display_name,
        mail = EXCLUDED.mail,
        job_title = EXCLUDED.job_title,
        department = EXCLUDED.department,
        office_location = EXCLUDED.office_location,
        last_scanned_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      userData.id,
      userData.userPrincipalName,
      userData.displayName,
      userData.mail,
      userData.jobTitle,
      userData.department,
      userData.officeLocation
    ];

    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      logger.error('Error upserting user:', { userId: userData.id, error: error.message });
      throw error;
    }
  }

  /**
   * Bulk upsert users
   * @param {Array<Object>} users - Array of user data
   * @returns {Promise<number>} Number of users upserted
   */
  async bulkUpsertUsers(users) {
    if (!users || users.length === 0) return 0;

    const values = [];
    const placeholders = [];

    users.forEach((user, idx) => {
      const base = idx * 7;
      placeholders.push(
        `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, NOW(), NOW())`
      );
      values.push(
        user.id,
        user.userPrincipalName,
        user.displayName,
        user.mail,
        user.jobTitle,
        user.department,
        user.officeLocation
      );
    });

    const query = `
      INSERT INTO users (
        id, user_principal_name, display_name, mail,
        job_title, department, office_location,
        last_scanned_at, updated_at
      )
      VALUES ${placeholders.join(', ')}
      ON CONFLICT (id)
      DO UPDATE SET
        user_principal_name = EXCLUDED.user_principal_name,
        display_name = EXCLUDED.display_name,
        mail = EXCLUDED.mail,
        job_title = EXCLUDED.job_title,
        department = EXCLUDED.department,
        office_location = EXCLUDED.office_location,
        last_scanned_at = NOW(),
        updated_at = NOW()
    `;

    try {
      await db.query(query, values);
      return users.length;
    } catch (error) {
      logger.error('Error bulk upserting users:', error.message);
      throw error;
    }
  }

  /**
   * Get all users
   * @param {Object} options - Query options (limit, offset)
   * @returns {Promise<Array>} Array of users
   */
  async getAllUsers(options = {}) {
    const { limit, offset } = options;
    let query = 'SELECT * FROM users ORDER BY display_name';
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
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} User object or null
   */
  async getUserById(userId) {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  /**
   * Get user by user principal name
   * @param {string} upn - User principal name
   * @returns {Promise<Object|null>} User object or null
   */
  async getUserByUPN(upn) {
    const query = 'SELECT * FROM users WHERE user_principal_name = $1';
    const result = await db.query(query, [upn]);
    return result.rows[0] || null;
  }

  /**
   * Get users count
   * @returns {Promise<number>} Total number of users
   */
  async getUsersCount() {
    const query = 'SELECT COUNT(*) as count FROM users';
    const result = await db.query(query);
    return parseInt(result.rows[0].count);
  }

  /**
   * Delete user by ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteUser(userId) {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await db.query(query, [userId]);
    return result.rowCount > 0;
  }

  /**
   * Get users by department
   * @param {string} department - Department name
   * @returns {Promise<Array>} Array of users
   */
  async getUsersByDepartment(department) {
    const query = 'SELECT * FROM users WHERE department = $1 ORDER BY display_name';
    const result = await db.query(query, [department]);
    return result.rows;
  }
}

module.exports = new UserRepository();
