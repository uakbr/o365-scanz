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
  async scanUsers(accessTokenOrProvider) {
    logger.info('Starting user scan');
    const tokenProvider = typeof accessTokenOrProvider === 'function'
      ? accessTokenOrProvider
      : async () => accessTokenOrProvider;

    try {
      let fetchedCount = 0;
      let storedCount = 0;
      let failedCount = 0;

      // Fetch all users with pagination
      await this.graphApi.fetchWithRetry(() =>
        this.graphApi.fetchAllWithPagination('/users', tokenProvider, {
          onPage: async (usersPage) => {
            fetchedCount += usersPage.length;

            for (const user of usersPage) {
              try {
                await userRepository.upsertUser(user);
                storedCount++;
              } catch (error) {
                failedCount++;
                logger.error('Error storing user:', {
                  userId: user.id,
                  error: error.message
                });
              }
            }
          }
        })
      );

      logger.info('User scan completed', {
        fetched: fetchedCount,
        stored: storedCount,
        failed: failedCount
      });

      return {
        success: true,
        totalFetched: fetchedCount,
        totalStored: storedCount,
        failedUsers: failedCount
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
  async scanUserById(userId, accessTokenOrProvider) {
    logger.info('Scanning specific user', { userId });
    const tokenProvider = typeof accessTokenOrProvider === 'function'
      ? accessTokenOrProvider
      : async () => accessTokenOrProvider;

    try {
      const user = await this.graphApi.get(`/users/${userId}`, tokenProvider);
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
  async getUserCount(accessTokenOrProvider) {
    const tokenProvider = typeof accessTokenOrProvider === 'function'
      ? accessTokenOrProvider
      : async () => accessTokenOrProvider;
    try {
      const response = await this.graphApi.get('/users/$count', tokenProvider);
      return parseInt(response);
    } catch (error) {
      logger.error('Error getting user count:', error.message);
      throw error;
    }
  }
}

module.exports = new UserScannerService();
