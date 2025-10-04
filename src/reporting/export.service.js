const userRepository = require('../storage/user.repository');
const fileRepository = require('../storage/file.repository');
const eventRepository = require('../storage/event.repository');
const logger = require('../utils/logger');

class ExportService {
  /**
   * Export users as JSON
   * @param {Object} options - Export options
   * @returns {Promise<Object>} JSON export
   */
  async exportUsersAsJSON(options = {}) {
    logger.info('Exporting users as JSON');

    try {
      const users = await userRepository.getAllUsers(options);

      return {
        exportType: 'users',
        exportedAt: new Date().toISOString(),
        count: users.length,
        data: users
      };
    } catch (error) {
      logger.error('Error exporting users:', error.message);
      throw error;
    }
  }

  /**
   * Export files as JSON
   * @param {Object} options - Export options
   * @returns {Promise<Object>} JSON export
   */
  async exportFilesAsJSON(options = {}) {
    logger.info('Exporting files as JSON');

    try {
      const files = await fileRepository.getAllFiles(options);

      return {
        exportType: 'files',
        exportedAt: new Date().toISOString(),
        count: files.length,
        data: files
      };
    } catch (error) {
      logger.error('Error exporting files:', error.message);
      throw error;
    }
  }

  /**
   * Export events as JSON
   * @param {Object} options - Export options
   * @returns {Promise<Object>} JSON export
   */
  async exportEventsAsJSON(options = {}) {
    logger.info('Exporting events as JSON');

    try {
      const events = await eventRepository.getAllEvents(options);

      return {
        exportType: 'events',
        exportedAt: new Date().toISOString(),
        count: events.length,
        data: events
      };
    } catch (error) {
      logger.error('Error exporting events:', error.message);
      throw error;
    }
  }

  /**
   * Export all data as JSON
   * @returns {Promise<Object>} Complete JSON export
   */
  async exportAllAsJSON() {
    logger.info('Exporting all data as JSON');

    try {
      const users = await userRepository.getAllUsers();
      const files = await fileRepository.getAllFiles();
      const events = await eventRepository.getAllEvents();

      return {
        exportType: 'complete',
        exportedAt: new Date().toISOString(),
        summary: {
          totalUsers: users.length,
          totalFiles: files.length,
          totalEvents: events.length
        },
        data: {
          users,
          files,
          events
        }
      };
    } catch (error) {
      logger.error('Error exporting all data:', error.message);
      throw error;
    }
  }

  /**
   * Export user data with related files and events
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User data export
   */
  async exportUserDataAsJSON(userId) {
    logger.info('Exporting user data as JSON', { userId });

    try {
      const user = await userRepository.getUserById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const files = await fileRepository.getFilesByUserId(userId);
      const events = await eventRepository.getEventsByUserId(userId);

      return {
        exportType: 'user_data',
        exportedAt: new Date().toISOString(),
        user,
        statistics: {
          totalFiles: files.length,
          totalEvents: events.length
        },
        data: {
          files,
          events
        }
      };
    } catch (error) {
      logger.error('Error exporting user data:', error.message);
      throw error;
    }
  }

  /**
   * Generate downloadable filename
   * @param {string} type - Export type
   * @returns {string} Filename
   */
  generateFilename(type) {
    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    return `o365-scan-${type}-${timestamp}.json`;
  }
}

module.exports = new ExportService();
