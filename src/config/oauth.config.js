require('dotenv').config();

// Validate required environment variables
const requiredVars = ['AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET', 'AZURE_TENANT_ID'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('FATAL: Missing required environment variables:', missingVars.join(', '));
  console.error('Please configure these variables in your .env file');
  process.exit(1);
}

const tenantId = process.env.AZURE_TENANT_ID;

module.exports = {
  clientId: process.env.AZURE_CLIENT_ID,
  clientSecret: process.env.AZURE_CLIENT_SECRET,
  tenantId: tenantId,
  redirectUri: process.env.REDIRECT_URI || 'http://localhost:3000/auth/callback',

  // Microsoft Identity Platform endpoints
  authorizeEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,

  // Required scopes for Office 365 scanning
  // Using minimal read-only permissions
  // Set SCAN_MODE=user_only for single-user scanning with reduced permissions
  scopes: process.env.SCAN_MODE === 'user_only' 
    ? [
        'User.Read',          // Read signed-in user profile only
        'Files.Read',         // Read user's own files only
        'Calendars.Read',     // Read user's own calendars only
        'offline_access'      // Maintain access to data (for token refresh)
      ]
    : [
        'User.Read.All',      // Read all user profiles (required for org-wide scanning)
        'Files.Read.All',     // Read files in all site collections
        'Calendars.Read',     // Read calendars (works for all users in org-wide mode)
        'offline_access'      // Maintain access to data (for token refresh)
      ],

  // Graph API configuration
  graphApiEndpoint: 'https://graph.microsoft.com/v1.0',

  // Rate limiting configuration
  concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS || '5'),
  requestDelay: parseInt(process.env.REQUEST_DELAY || '100'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
};
