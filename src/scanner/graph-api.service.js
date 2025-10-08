const axios = require('axios');
const oauthConfig = require('../config/oauth.config');
const logger = require('../utils/logger');
const { RateLimitError, AppError } = require('../utils/error-handler');

class GraphApiService {
  constructor() {
    this.baseUrl = oauthConfig.graphApiEndpoint;
    this.maxRetries = oauthConfig.maxRetries;
    this.requestDelay = oauthConfig.requestDelay;
  }

  /**
   * Make a GET request to Microsoft Graph API
   * @param {string} endpoint - API endpoint
   * @param {string|Function} accessToken - Access token or provider function
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} Response data
   */
  async get(endpoint, accessToken, params = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const token = await this.resolveAccessToken(accessToken);

    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params
      });

      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetch all data with automatic pagination (iterative)
   * @param {string} endpoint - API endpoint
   * @param {string|Function} accessToken - Access token or provider function
   * @param {Object} options - Additional options (onPage callback)
   * @returns {Promise<Array|undefined>} All data from all pages (unless streaming)
   */
  async fetchAllWithPagination(endpoint, accessToken, options = {}) {
    const { onPage } = options;
    const collectResults = !onPage;
    const allData = collectResults ? [] : null;
    let currentEndpoint = endpoint;
    let pageCount = 0;
    let itemCount = 0;

    try {
      while (currentEndpoint) {
        pageCount++;
        logger.debug('Fetching page', {
          page: pageCount,
          mode: collectResults ? 'collect' : 'stream'
        });

        const response = await this.get(currentEndpoint, accessToken);

        // Add current page data
        if (response.value) {
          itemCount += response.value.length;
          if (onPage) {
            await onPage(response.value);
          } else {
            allData.push(...response.value);
          }
        }

        // Check for next page
        currentEndpoint = response['@odata.nextLink'] || null;

        // Add delay to avoid rate limiting if there's a next page
        if (currentEndpoint) {
          await this.delay(this.requestDelay);
        }
      }

      logger.debug('Pagination complete', {
        pages: pageCount,
        items: itemCount
      });

      return collectResults ? allData : undefined;
    } catch (error) {
      logger.error('Error in pagination:', error.message);
      throw error;
    }
  }

  /**
   * Resolve access token whether provided as string or async factory
   * @param {string|Function} accessToken - Raw token or provider
   * @returns {Promise<string>} Access token string
   */
  async resolveAccessToken(accessToken) {
    if (typeof accessToken === 'function') {
      return await accessToken();
    }
    return accessToken;
  }

  /**
   * Fetch data with retry logic
   * @param {Function} fetchFunction - Function to execute
   * @param {number} retryCount - Current retry count
   * @returns {Promise<*>} Result from fetch function
   */
  async fetchWithRetry(fetchFunction, retryCount = 0) {
    try {
      return await fetchFunction();
    } catch (error) {
      // Handle rate limiting (429 status)
      if (error.statusCode === 429 && retryCount < this.maxRetries) {
        const retryAfter = error.retryAfter || Math.pow(2, retryCount) * 1000;
        logger.warn(`Rate limited. Retrying after ${retryAfter}ms`, {
          retryCount: retryCount + 1
        });

        await this.delay(retryAfter);
        return await this.fetchWithRetry(fetchFunction, retryCount + 1);
      }

      // Handle other transient errors
      if (this.isTransientError(error) && retryCount < this.maxRetries) {
        const delayTime = Math.pow(2, retryCount) * 1000;
        logger.warn(`Transient error. Retrying after ${delayTime}ms`, {
          retryCount: retryCount + 1,
          error: error.message
        });

        await this.delay(delayTime);
        return await this.fetchWithRetry(fetchFunction, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Check if error is transient (should retry)
   * @param {Error} error - Error object
   * @returns {boolean} True if transient error
   */
  isTransientError(error) {
    const transientStatusCodes = [408, 500, 502, 503, 504];
    return transientStatusCodes.includes(error.statusCode);
  }

  /**
   * Handle API errors
   * @param {Error} error - Error object
   * @returns {Error} Formatted error
   */
  handleError(error) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.error?.message || error.message;

      logger.error('Graph API error', {
        status,
        message,
        endpoint: error.config?.url
      });

      if (status === 429) {
        const retryAfter = error.response.headers['retry-after']
          ? parseInt(error.response.headers['retry-after']) * 1000
          : 60000;

        const rateLimitError = new RateLimitError(message);
        rateLimitError.retryAfter = retryAfter;
        return rateLimitError;
      }

      const appError = new AppError(message, status);
      appError.retryAfter = error.response.headers['retry-after'];
      return appError;
    }

    return new AppError(error.message);
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = GraphApiService;
