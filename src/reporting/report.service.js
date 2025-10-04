const userRepository = require('../storage/user.repository');
const fileRepository = require('../storage/file.repository');
const eventRepository = require('../storage/event.repository');
const logger = require('../utils/logger');

class ReportService {
  /**
   * Generate user report
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} User report
   */
  async generateUserReport(filters = {}) {
    logger.info('Generating user report', { filters });

    try {
      const users = await userRepository.getAllUsers();
      const totalUsers = await userRepository.getUsersCount();

      // Group by department
      const departments = {};
      users.forEach(user => {
        const dept = user.department || 'Unassigned';
        if (!departments[dept]) {
          departments[dept] = [];
        }
        departments[dept].push(user);
      });

      const departmentStats = Object.keys(departments).map(dept => ({
        department: dept,
        userCount: departments[dept].length
      }));

      return {
        totalUsers,
        users,
        departmentStats,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating user report:', error.message);
      throw error;
    }
  }

  /**
   * Generate file report
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} File report
   */
  async generateFileReport(filters = {}) {
    logger.info('Generating file report', { filters });

    try {
      const files = await fileRepository.getAllFiles();
      const totalFiles = await fileRepository.getFilesCount();
      const stats = await fileRepository.getFileStats();

      // Group by user
      const filesByUser = {};
      files.forEach(file => {
        if (!filesByUser[file.user_id]) {
          filesByUser[file.user_id] = [];
        }
        filesByUser[file.user_id].push(file);
      });

      const userFileStats = Object.keys(filesByUser).map(userId => ({
        userId,
        fileCount: filesByUser[userId].length,
        totalSize: filesByUser[userId].reduce((sum, f) => sum + (f.size || 0), 0)
      }));

      return {
        totalFiles,
        statistics: {
          totalSize: parseInt(stats.total_size) || 0,
          averageSize: parseInt(stats.avg_size) || 0,
          maxSize: parseInt(stats.max_size) || 0,
          minSize: parseInt(stats.min_size) || 0
        },
        userFileStats,
        files,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating file report:', error.message);
      throw error;
    }
  }

  /**
   * Generate events report
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Events report
   */
  async generateEventsReport(filters = {}) {
    logger.info('Generating events report', { filters });

    try {
      const events = await eventRepository.getAllEvents();
      const totalEvents = await eventRepository.getEventsCount();

      const now = new Date();
      const upcomingEvents = events.filter(
        event => new Date(event.start_datetime) >= now
      );
      const pastEvents = events.filter(
        event => new Date(event.start_datetime) < now
      );

      // Group by user
      const eventsByUser = {};
      events.forEach(event => {
        if (!eventsByUser[event.user_id]) {
          eventsByUser[event.user_id] = [];
        }
        eventsByUser[event.user_id].push(event);
      });

      const userEventStats = Object.keys(eventsByUser).map(userId => ({
        userId,
        eventCount: eventsByUser[userId].length,
        upcomingCount: eventsByUser[userId].filter(
          e => new Date(e.start_datetime) >= now
        ).length
      }));

      return {
        totalEvents,
        upcomingEventsCount: upcomingEvents.length,
        pastEventsCount: pastEvents.length,
        userEventStats,
        events,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating events report:', error.message);
      throw error;
    }
  }

  /**
   * Generate comprehensive report for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} User comprehensive report
   */
  async generateUserDetailsReport(userId) {
    logger.info('Generating user details report', { userId });

    try {
      const user = await userRepository.getUserById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      const files = await fileRepository.getFilesByUserId(userId);
      const events = await eventRepository.getEventsByUserId(userId);

      const totalFileSize = files.reduce((sum, f) => sum + (f.size || 0), 0);

      const now = new Date();
      const upcomingEvents = events.filter(
        event => new Date(event.start_datetime) >= now
      );

      return {
        user,
        statistics: {
          totalFiles: files.length,
          totalFileSize,
          totalEvents: events.length,
          upcomingEvents: upcomingEvents.length
        },
        files,
        events,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating user details report:', error.message);
      throw error;
    }
  }

  /**
   * Generate summary report
   * @returns {Promise<Object>} Summary report
   */
  async generateSummaryReport() {
    logger.info('Generating summary report');

    try {
      const totalUsers = await userRepository.getUsersCount();
      const totalFiles = await fileRepository.getFilesCount();
      const totalEvents = await eventRepository.getEventsCount();
      const fileStats = await fileRepository.getFileStats();

      return {
        summary: {
          totalUsers,
          totalFiles,
          totalEvents,
          totalStorageSize: parseInt(fileStats.total_size) || 0
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Error generating summary report:', error.message);
      throw error;
    }
  }
}

module.exports = new ReportService();
