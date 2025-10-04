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
   * Execute tasks in batches
   * @param {Array} items - Items to process
   * @param {Function} taskFunction - Function to execute for each item
   * @param {number} batchSize - Batch size
   * @returns {Promise<Array>} Results from all tasks
   */
  async runInBatches(items, taskFunction, batchSize = this.concurrentRequests) {
    const results = [];
    const totalBatches = Math.ceil(items.length / batchSize);

    logger.info('Starting batch processing', {
      totalItems: items.length,
      batchSize,
      totalBatches
    });

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      logger.info(`Processing batch ${batchNumber}/${totalBatches}`, {
        batchSize: batch.length
      });

      const batchPromises = batch.map(item => taskFunction(item));
      const batchResults = await Promise.allSettled(batchPromises);

      results.push(...batchResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return { success: true, data: result.value, item: batch[index] };
        } else {
          return { success: false, error: result.reason.message, item: batch[index] };
        }
      }));
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    logger.info('Batch processing completed', {
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
