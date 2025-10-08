const authService = require('./auth.service');
const logger = require('../utils/logger');
const { AuthenticationError } = require('../utils/error-handler');

/**
 * Middleware to verify authentication
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function requireAuth(req, res, next) {
  try {
    // Check if session exists
    if (!req.session || !req.session.id) {
      throw new AuthenticationError('No session found');
    }

    // Check if user is authenticated
    if (!req.session.authenticated) {
      throw new AuthenticationError('Not authenticated. Please login.');
    }

    const sessionId = req.session.id;

    // Create provider so downstream callers always fetch a fresh token
    const accessTokenProvider = async () => {
      return authService.getValidAccessToken(sessionId);
    };

    // Prime the token to fail fast if refresh is required
    const accessToken = await accessTokenProvider();

    // Attach token helpers to request for use in routes
    req.accessToken = accessToken;
    req.accessTokenProvider = accessTokenProvider;

    next();
  } catch (error) {
    logger.error('Authentication middleware error:', error.message);

    if (error instanceof AuthenticationError) {
      return res.status(401).json({
        success: false,
        error: {
          message: error.message
        }
      });
    }

    next(error);
  }
}

/**
 * Optional authentication middleware
 * Attempts to authenticate but doesn't fail if not authenticated
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
async function optionalAuth(req, res, next) {
  try {
    if (req.session && req.session.authenticated) {
      const sessionId = req.session.id;
      const accessTokenProvider = async () => authService.getValidAccessToken(sessionId);
      req.accessToken = await accessTokenProvider();
      req.accessTokenProvider = accessTokenProvider;
    }
    next();
  } catch (error) {
    // Continue even if authentication fails
    logger.warn('Optional auth failed:', error.message);
    next();
  }
}

/**
 * CSRF protection middleware
 * Requires X-Requested-With header for state-changing requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function csrfProtection(req, res, next) {
  // Skip for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Check for custom header (prevents CSRF from browser forms)
  const requestedWith = req.get('X-Requested-With');

  if (!requestedWith || requestedWith !== 'XMLHttpRequest') {
    logger.warn('CSRF protection: Missing or invalid X-Requested-With header');
    return res.status(403).json({
      success: false,
      error: {
        message: 'CSRF validation failed. Include X-Requested-With: XMLHttpRequest header'
      }
    });
  }

  next();
}

module.exports = {
  requireAuth,
  optionalAuth,
  csrfProtection
};
