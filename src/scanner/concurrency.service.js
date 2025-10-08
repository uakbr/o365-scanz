const pLimit = require('p-limit');
const oauthConfig = require('../config/oauth.config');
const logger = require('../utils/logger');

class ConcurrencyService {
  constructor() {
    this.concurrentRequests = oauthConfig.concurrentRequests;
    this.limiter = pLimit(this.concurrentRequests);
  }

  /**
   * Execute tasks with concurrency control
   * @param {Array} items - Items to process
   * @param {Function} taskFunction - Function to execute for each item
   * @param {Object} options - Options (onProgress callback)
   * @returns {Promise<Array>} Results from all tasks
   */
  async runConcurrent(items, taskFunction, options = {}) {
    const { onProgress } = options;
    let completed = 0;

    logger.info('Starting concurrent processing', {
      totalItems: items.length,
      concurrency: this.concurrentRequests
    });

    const promises = items.map((item, index) =>
      this.limiter(async () => {
        try {
          const result = await taskFunction(item, index);
          completed++;

          if (onProgress) {
            onProgress(completed, items.length);
          }

          logger.debug('Task completed', {
            completed,
            total: items.length,
            percentage: Math.round((completed / items.length) * 100)
          });

          return { success: true, data: result, item };
        } catch (error) {
          completed++;
          logger.error('Task failed', {
            item,
            error: error.message,
            completed,
            total: items.length
          });

          if (onProgress) {
            onProgress(completed, items.length);
          }

          return { success: false, error: error.message, item };
        }
      })
    );

    const results = await Promise.all(promises);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logger.info('Concurrent processing completed', {
      total: items.length,
      successful: successCount,
      failed: failureCount
    });

    return results;
  }

  /**
   * Set concurrency limit
   * @param {number} limit - New concurrency limit
   */
  setConcurrency(limit) {
    this.concurrentRequests = limit;
    this.limiter = pLimit(limit);
    logger.info('Concurrency limit updated', { limit });
  }

  /**
   * Get current concurrency limit
   * @returns {number} Current limit
   */
  getConcurrency() {
    return this.concurrentRequests;
  }
}

module.exports = new ConcurrencyService();
