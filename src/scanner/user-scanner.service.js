const GraphApiService = require('./graph-api.service');
const userRepository = require('../storage/user.repository');
const logger = require('../utils/logger');

class UserScannerService {
  constructor() {
    this.graphApi = new GraphApiService();
  }

  /**
   * Scan all users from Azure AD
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} Scan results
   */
  async scanUsers(accessToken) {
    logger.info('Starting user scan');

    try {
      // Fetch all users with pagination
      const users = await this.graphApi.fetchWithRetry(() =>
        this.graphApi.fetchAllWithPagination('/users', accessToken)
      );

      logger.info(`Fetched ${users.length} users from Microsoft Graph API`);

      // Store users in database
      let storedCount = 0;
      for (const user of users) {
        try {
          await userRepository.upsertUser(user);
          storedCount++;
        } catch (error) {
          logger.error('Error storing user:', {
            userId: user.id,
            error: error.message
          });
        }
      }

      logger.info('User scan completed', {
        fetched: users.length,
        stored: storedCount
      });

      return {
        success: true,
        totalFetched: users.length,
        totalStored: storedCount,
        users: users
      };
    } catch (error) {
      logger.error('User scan failed:', error.message);
      throw error;
    }
  }

  /**
   * Scan a specific user by ID
   * @param {string} userId - User ID
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User data
   */
  async scanUserById(userId, accessToken) {
    logger.info('Scanning specific user', { userId });

    try {
      const user = await this.graphApi.get(`/users/${userId}`, accessToken);
      await userRepository.upsertUser(user);

      logger.info('User scanned successfully', { userId });
      return user;
    } catch (error) {
      logger.error('Error scanning user:', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get user count from API
   * @param {string} accessToken - Access token
   * @returns {Promise<number>} User count
   */
  async getUserCount(accessToken) {
    try {
      const response = await this.graphApi.get('/users/$count', accessToken);
      return parseInt(response);
    } catch (error) {
      logger.error('Error getting user count:', error.message);
      throw error;
    }
  }
}

module.exports = new UserScannerService();
