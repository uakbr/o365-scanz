const GraphApiService = require('./graph-api.service');
const eventRepository = require('../storage/event.repository');
const userRepository = require('../storage/user.repository');
const concurrencyService = require('./concurrency.service');
const logger = require('../utils/logger');

class EventScannerService {
  constructor() {
    this.graphApi = new GraphApiService();
  }

  /**
   * Scan calendar events for all users
   * @param {string} accessToken - Access token
   * @param {Object} options - Options (startDate, endDate)
   * @returns {Promise<Object>} Scan results
   */
  async scanAllUserEvents(accessToken, options = {}) {
    logger.info('Starting calendar event scan for all users');

    try {
      // Get all users from database
      const users = await userRepository.getAllUsers();
      logger.info(`Found ${users.length} users to scan`);

      if (users.length === 0) {
        logger.warn('No users found. Please run user scan first.');
        return {
          success: true,
          totalUsers: 0,
          totalEvents: 0,
          message: 'No users found. Please run user scan first.'
        };
      }

      let totalEvents = 0;

      // Scan events for each user concurrently
      const results = await concurrencyService.runConcurrent(
        users,
        async (user) => {
          const userEvents = await this.scanUserEvents(user.id, accessToken, options);
          totalEvents += userEvents.length;
          return userEvents;
        },
        {
          onProgress: (completed, total) => {
            logger.info(`Progress: ${completed}/${total} users processed`);
          }
        }
      );

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info('Event scan completed', {
        totalUsers: users.length,
        successful: successCount,
        failed: failureCount,
        totalEvents
      });

      return {
        success: true,
        totalUsers: users.length,
        successfulUsers: successCount,
        failedUsers: failureCount,
        totalEvents,
        results
      };
    } catch (error) {
      logger.error('Event scan failed:', error.message);
      throw error;
    }
  }

  /**
   * Scan calendar events for a specific user
   * @param {string} userId - User ID
   * @param {string} accessToken - Access token
   * @param {Object} options - Options (startDate, endDate)
   * @returns {Promise<Array>} Array of events
   */
  async scanUserEvents(userId, accessToken, options = {}) {
    logger.debug('Scanning calendar events for user', { userId });

    try {
      // Build endpoint with query parameters
      let endpoint = `/users/${userId}/calendar/events`;
      const queryParams = [];

      if (options.startDate && options.endDate) {
        queryParams.push(`$filter=start/dateTime ge '${options.startDate}' and end/dateTime le '${options.endDate}'`);
      }

      if (queryParams.length > 0) {
        endpoint += '?' + queryParams.join('&');
      }

      // Fetch all events from user's calendar
      const events = await this.graphApi.fetchWithRetry(() =>
        this.graphApi.fetchAllWithPagination(endpoint, accessToken)
      );

      logger.debug(`Fetched ${events.length} events for user`, { userId });

      // Store events in database
      for (const event of events) {
        try {
          await eventRepository.upsertEvent(event, userId);
        } catch (error) {
          logger.error('Error storing event:', {
            eventId: event.id,
            userId,
            error: error.message
          });
        }
      }

      return events;
    } catch (error) {
      // Handle case where user doesn't have calendar access
      if (error.statusCode === 404 || error.statusCode === 403) {
        logger.debug('User calendar not accessible', { userId });
        return [];
      }

      logger.error('Error scanning user events:', {
        userId,
        error: error.message
      });
      throw error;
    }
  }


  /**
   * Get event statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Event statistics
   */
  async getUserEventStats(userId) {
    const count = await eventRepository.getEventsCountByUser(userId);
    const events = await eventRepository.getEventsByUserId(userId);

    const now = new Date();
    const upcomingEvents = events.filter(
      event => new Date(event.start_datetime) >= now
    );
    const pastEvents = events.filter(
      event => new Date(event.start_datetime) < now
    );

    return {
      userId,
      totalEvents: count,
      upcomingEvents: upcomingEvents.length,
      pastEvents: pastEvents.length
    };
  }
}

module.exports = new EventScannerService();
