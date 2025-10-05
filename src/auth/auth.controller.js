const authService = require('./auth.service');
const logger = require('../utils/logger');
const { asyncHandler } = require('../utils/error-handler');

class AuthController {
  /**
   * Initiate OAuth2 login flow
   * GET /auth/login
   */
  login = asyncHandler(async (req, res) => {
    const { authUrl, state } = authService.getAuthorizationUrl();

    // Store state in session for validation
    req.session.oauthState = state;

    logger.info('Redirecting to Microsoft login');
    res.redirect(authUrl);
  });

  /**
   * OAuth2 callback handler
   * GET /auth/callback
   */
  callback = asyncHandler(async (req, res) => {
    const { code, state, error, error_description } = req.query;

    // Check for errors from OAuth provider
    if (error) {
      logger.error('OAuth error:', { error, error_description });
      return res.status(400).json({
        success: false,
        error: {
          message: error_description || 'Authentication failed'
        }
      });
    }

    // Validate state to prevent CSRF attacks
    if (state !== req.session.oauthState) {
      logger.error('OAuth state mismatch');
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid state parameter'
        }
      });
    }

    // Exchange code for token
    const tokenData = await authService.getTokenFromCode(code);

    // Regenerate session to prevent session fixation
    const oldSessionId = req.session.id;
    req.session.regenerate((err) => {
      if (err) {
        logger.error('Error regenerating session:', err);
      }
    });

    // Store token in new session
    authService.storeToken(req.session.id, tokenData);
    req.session.authenticated = true;

    // Remove old session token if it exists
    if (oldSessionId !== req.session.id) {
      authService.removeToken(oldSessionId);
    }

    // Clean up state
    delete req.session.oauthState;

    logger.info('User authenticated successfully');

    res.json({
      success: true,
      message: 'Authentication successful',
      data: {
        expiresIn: tokenData.expires_in
      }
    });
  });

  /**
   * Refresh access token
   * POST /auth/refresh
   */
  refresh = asyncHandler(async (req, res) => {
    const sessionId = req.session.id;
    const tokenData = authService.getToken(sessionId);

    if (!tokenData || !tokenData.refresh_token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'No refresh token available. Please login again.'
        }
      });
    }

    const newTokenData = await authService.refreshAccessToken(tokenData.refresh_token);
    authService.storeToken(sessionId, newTokenData);

    logger.info('Token refreshed successfully', { sessionId });

    res.json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        expiresIn: newTokenData.expires_in
      }
    });
  });

  /**
   * Logout and clear session
   * GET /auth/logout
   */
  logout = asyncHandler(async (req, res) => {
    // Handle case where there's no session
    if (!req.session) {
      return res.json({
        success: true,
        message: 'Already logged out'
      });
    }

    const sessionId = req.session.id;

    // Remove token if it exists
    if (sessionId) {
      authService.removeToken(sessionId);
    }

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        logger.error('Error destroying session:', err);
      }
    });

    logger.info('User logged out', { sessionId });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });

  /**
   * Get authentication status
   * GET /auth/status
   */
  status = asyncHandler(async (req, res) => {
    const sessionId = req.session.id;
    const tokenData = authService.getToken(sessionId);

    if (!tokenData) {
      return res.json({
        success: true,
        data: {
          authenticated: false
        }
      });
    }

    const isExpired = authService.isTokenExpired(tokenData);

    res.json({
      success: true,
      data: {
        authenticated: true,
        tokenExpired: isExpired,
        expiresAt: tokenData.expiresAt
      }
    });
  });
}

module.exports = new AuthController();
