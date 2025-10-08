const GraphApiService = require('./graph-api.service');
const fileRepository = require('../storage/file.repository');
const userRepository = require('../storage/user.repository');
const concurrencyService = require('./concurrency.service');
const logger = require('../utils/logger');

class FileScannerService {
  constructor() {
    this.graphApi = new GraphApiService();
  }

  /**
   * Scan files for all users
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} Scan results
   */
  async scanAllUserFiles(accessTokenOrProvider) {
    logger.info('Starting file scan for all users');
    const tokenProvider = typeof accessTokenOrProvider === 'function'
      ? accessTokenOrProvider
      : async () => accessTokenOrProvider;

    try {
      // Get all users from database
      const users = await userRepository.getAllUsers();
      logger.info(`Found ${users.length} users to scan`);

      if (users.length === 0) {
        logger.warn('No users found. Please run user scan first.');
        return {
          success: true,
          totalUsers: 0,
          totalFiles: 0,
          message: 'No users found. Please run user scan first.'
        };
      }

      let totalFiles = 0;
      let totalFailures = 0;

      // Scan files for each user concurrently
      const results = await concurrencyService.runConcurrent(
        users,
        async (user) => {
          const summary = await this.scanUserFiles(user.id, tokenProvider);
          totalFiles += summary.filesProcessed;
          totalFailures += summary.filesFailed;
          return summary;
        },
        {
          onProgress: (completed, total) => {
            logger.info(`Progress: ${completed}/${total} users processed`);
          }
        }
      );

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info('File scan completed', {
        totalUsers: users.length,
        successful: successCount,
        failed: failureCount,
        totalFiles,
        failedFiles: totalFailures
      });

      return {
        success: true,
        totalUsers: users.length,
        successfulUsers: successCount,
        failedUsers: failureCount,
        totalFiles,
        failedFiles: totalFailures,
        results
      };
    } catch (error) {
      logger.error('File scan failed:', error.message);
      throw error;
    }
  }

  /**
   * Scan files for a specific user
   * @param {string} userId - User ID
   * @param {string} accessToken - Access token
   * @returns {Promise<Array>} Array of files
   */
  async scanUserFiles(userId, accessTokenOrProvider) {
    logger.debug('Scanning files for user', { userId });
    const tokenProvider = typeof accessTokenOrProvider === 'function'
      ? accessTokenOrProvider
      : async () => accessTokenOrProvider;

    try {
      const summary = await this.scanFolderRecursively(userId, 'root', tokenProvider);

      logger.debug('Completed file scan for user', {
        userId,
        processed: summary.filesProcessed,
        failed: summary.filesFailed
      });

      return summary;
    } catch (error) {
      // Handle case where user doesn't have OneDrive
      if (error.statusCode === 404) {
        logger.debug('User does not have OneDrive', { userId });
        return {
          filesProcessed: 0,
          filesFailed: 0
        };
      }

      logger.error('Error scanning user files:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Recursively scan a folder and all its subfolders
   * @param {string} userId - User ID
   * @param {string} folderId - Folder ID (use 'root' for root folder)
   * @param {string} accessToken - Access token
   * @returns {Promise<Array>} Array of all files in folder and subfolders
   */
  async scanFolderRecursively(userId, folderId, accessTokenOrProvider) {
    let filesProcessed = 0;
    let filesFailed = 0;

    await this.graphApi.fetchWithRetry(() =>
      this.graphApi.fetchAllWithPagination(
        `/users/${userId}/drive/items/${folderId}/children`,
        accessTokenOrProvider,
        {
          onPage: async (items) => {
            for (const item of items) {
              if (item.file) {
                try {
                  await fileRepository.upsertFile(item, userId);
                  filesProcessed++;
                } catch (error) {
                  filesFailed++;
                  logger.error('Error storing file:', {
                    fileId: item.id,
                    userId,
                    error: error.message
                  });
                }
              } else if (item.folder) {
                const nested = await this.scanFolderRecursively(
                  userId,
                  item.id,
                  accessTokenOrProvider
                );
                filesProcessed += nested.filesProcessed;
                filesFailed += nested.filesFailed;
              }
            }
          }
        }
      )
    );

    return { filesProcessed, filesFailed };
  }


  /**
   * Get file statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} File statistics
   */
  async getUserFileStats(userId) {
    const count = await fileRepository.getFilesCountByUser(userId);
    const files = await fileRepository.getFilesByUserId(userId);

    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

    return {
      userId,
      fileCount: count,
      totalSize,
      averageSize: count > 0 ? Math.round(totalSize / count) : 0
    };
  }
}

module.exports = new FileScannerService();
