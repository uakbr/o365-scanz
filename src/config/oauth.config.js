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
  scopes: [
    'User.Read.All',
    'Files.Read.All',
    'Calendars.Read',
    'offline_access'
  ],

  // Graph API configuration
  graphApiEndpoint: 'https://graph.microsoft.com/v1.0',

  // Rate limiting configuration
  concurrentRequests: parseInt(process.env.CONCURRENT_REQUESTS || '5'),
  requestDelay: parseInt(process.env.REQUEST_DELAY || '100'),
  maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
};
