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
  async scanAllUserFiles(accessToken) {
    logger.info('Starting file scan for all users');

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

      // Scan files for each user concurrently
      const results = await concurrencyService.runConcurrent(
        users,
        async (user) => {
          const userFiles = await this.scanUserFiles(user.id, accessToken);
          totalFiles += userFiles.length;
          return userFiles;
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
        totalFiles
      });

      return {
        success: true,
        totalUsers: users.length,
        successfulUsers: successCount,
        failedUsers: failureCount,
        totalFiles,
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
  async scanUserFiles(userId, accessToken) {
    logger.debug('Scanning files for user', { userId });

    try {
      // Recursively scan all files from user's OneDrive starting at root
      const allFiles = await this.scanFolderRecursively(userId, 'root', accessToken);

      logger.debug(`Fetched ${allFiles.length} files for user`, { userId });

      // Store files in database
      for (const file of allFiles) {
        try {
          await fileRepository.upsertFile(file, userId);
        } catch (error) {
          logger.error('Error storing file:', {
            fileId: file.id,
            userId,
            error: error.message
          });
        }
      }

      return allFiles;
    } catch (error) {
      // Handle case where user doesn't have OneDrive
      if (error.statusCode === 404) {
        logger.debug('User does not have OneDrive', { userId });
        return [];
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
  async scanFolderRecursively(userId, folderId, accessToken) {
    const items = await this.graphApi.fetchWithRetry(() =>
      this.graphApi.fetchAllWithPagination(
        `/users/${userId}/drive/items/${folderId}/children`,
        accessToken
      )
    );

    let allFiles = [];

    for (const item of items) {
      if (item.file) {
        // This is a file, add it to the list
        allFiles.push(item);
      } else if (item.folder) {
        // This is a folder, recursively scan it
        const subFiles = await this.scanFolderRecursively(
          userId,
          item.id,
          accessToken
        );
        allFiles = allFiles.concat(subFiles);
      }
    }

    return allFiles;
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
