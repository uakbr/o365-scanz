/**
 * Simple logger utility for the application
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

const currentLogLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;

class Logger {
  /**
   * Redact sensitive information from metadata
   * @param {Object} meta - Metadata to redact
   * @returns {Object} Redacted metadata
   */
  redactSensitiveData(meta) {
    if (!meta || typeof meta !== 'object') return meta;

    const redacted = { ...meta };
    const sensitiveKeys = ['sessionId', 'password', 'token', 'secret', 'authorization', 'cookie'];

    for (const key of Object.keys(redacted)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        redacted[key] = '[REDACTED]';
      }
    }

    return redacted;
  }

  /**
   * Format log message
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   * @returns {string} Formatted log message
   */
  formatMessage(level, message, meta) {
    const timestamp = new Date().toISOString();
    const redactedMeta = this.redactSensitiveData(meta);
    const metaStr = redactedMeta ? ` ${JSON.stringify(redactedMeta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  debug(message, meta) {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.log(this.formatMessage('DEBUG', message, meta));
    }
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  info(message, meta) {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.log(this.formatMessage('INFO', message, meta));
    }
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  warn(message, meta) {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message, meta));
    }
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Object} meta - Additional metadata
   */
  error(message, meta) {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message, meta));
    }
  }
}

module.exports = new Logger();
