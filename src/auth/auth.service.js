const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const oauthConfig = require('../config/oauth.config');
const logger = require('../utils/logger');
const { AuthenticationError } = require('../utils/error-handler');

class AuthService {
  constructor() {
    this.tokenStore = new Map(); // In-memory token storage (use Redis in production)
    this.refreshPromises = new Map(); // Track ongoing refresh operations
  }

  /**
   * Generate authorization URL for OAuth2 flow
   * @returns {Object} Authorization URL and state
   */
  getAuthorizationUrl() {
    const state = uuidv4();
    const scope = oauthConfig.scopes.join(' ');

    const params = new URLSearchParams({
      client_id: oauthConfig.clientId,
      response_type: 'code',
      redirect_uri: oauthConfig.redirectUri,
      response_mode: 'query',
      scope: scope,
      state: state
    });

    const authUrl = `${oauthConfig.authorizeEndpoint}?${params.toString()}`;

    return { authUrl, state };
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code
   * @returns {Promise<Object>} Token response
   */
  async getTokenFromCode(code) {
    try {
      const params = new URLSearchParams({
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret,
        code: code,
        redirect_uri: oauthConfig.redirectUri,
        grant_type: 'authorization_code'
      });

      const response = await axios.post(
        oauthConfig.tokenEndpoint,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      logger.info('Successfully obtained access token');
      return response.data;
    } catch (error) {
      logger.error('Error getting token from code:', error.response?.data || error.message);
      throw new AuthenticationError('Failed to obtain access token');
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} New token response
   */
  async refreshAccessToken(refreshToken) {
    try {
      const params = new URLSearchParams({
        client_id: oauthConfig.clientId,
        client_secret: oauthConfig.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      });

      const response = await axios.post(
        oauthConfig.tokenEndpoint,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      logger.info('Successfully refreshed access token');
      return response.data;
    } catch (error) {
      logger.error('Error refreshing token:', error.response?.data || error.message);
      throw new AuthenticationError('Failed to refresh access token');
    }
  }

  /**
   * Store token in memory (or database/Redis in production)
   * @param {string} sessionId - Session ID
   * @param {Object} tokenData - Token data
   */
  storeToken(sessionId, tokenData) {
    this.tokenStore.set(sessionId, {
      ...tokenData,
      expiresAt: Date.now() + (tokenData.expires_in * 1000)
    });
    logger.debug('Token stored', { sessionId });
  }

  /**
   * Get token from storage
   * @param {string} sessionId - Session ID
   * @returns {Object|null} Token data or null
   */
  getToken(sessionId) {
    return this.tokenStore.get(sessionId) || null;
  }

  /**
   * Remove token from storage
   * @param {string} sessionId - Session ID
   */
  removeToken(sessionId) {
    this.tokenStore.delete(sessionId);
    this.refreshPromises.delete(sessionId);
    logger.debug('Token removed', { sessionId });
  }

  /**
   * Clean up expired tokens (prevents memory leak)
   * Should be called periodically
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, tokenData] of this.tokenStore.entries()) {
      // Remove tokens expired for more than 1 hour
      if (tokenData.expiresAt && now > tokenData.expiresAt + 3600000) {
        this.tokenStore.delete(sessionId);
        this.refreshPromises.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Cleaned up expired tokens', { count: cleanedCount });
    }
  }

  /**
   * Check if token is expired
   * @param {Object} tokenData - Token data
   * @returns {boolean} True if expired
   */
  isTokenExpired(tokenData) {
    if (!tokenData || !tokenData.expiresAt) {
      return true;
    }
    // Add 5 minute buffer
    return Date.now() >= (tokenData.expiresAt - 5 * 60 * 1000);
  }

  /**
   * Get valid access token (refresh if needed)
   * @param {string} sessionId - Session ID
   * @returns {Promise<string>} Valid access token
   */
  async getValidAccessToken(sessionId) {
    const tokenData = this.getToken(sessionId);

    if (!tokenData) {
      throw new AuthenticationError('No token found. Please login again.');
    }

    if (this.isTokenExpired(tokenData)) {
      if (!tokenData.refresh_token) {
        throw new AuthenticationError('Token expired and no refresh token available.');
      }

      // Check if refresh is already in progress for this session
      if (this.refreshPromises.has(sessionId)) {
        logger.debug('Waiting for ongoing token refresh', { sessionId });
        return this.refreshPromises.get(sessionId);
      }

      // Start new refresh operation
      const refreshPromise = this.refreshAccessToken(tokenData.refresh_token)
        .then((newTokenData) => {
          this.storeToken(sessionId, newTokenData);
          this.refreshPromises.delete(sessionId);
          return newTokenData.access_token;
        })
        .catch((error) => {
          this.refreshPromises.delete(sessionId);
          throw error;
        });

      this.refreshPromises.set(sessionId, refreshPromise);
      return refreshPromise;
    }

    return tokenData.access_token;
  }

  /**
   * Validate token by calling Microsoft Graph API
   * @param {string} accessToken - Access token
   * @returns {Promise<Object>} User info
   */
  async validateToken(accessToken) {
    try {
      const response = await axios.get(`${oauthConfig.graphApiEndpoint}/me`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Token validation failed:', error.message);
      throw new AuthenticationError('Invalid or expired token');
    }
  }
}

module.exports = new AuthService();
