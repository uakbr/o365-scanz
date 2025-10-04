require('dotenv').config();
const express = require('express');
const session = require('express-session');
const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./utils/error-handler');
const db = require('./storage/database.service');

// Import routes
const authRoutes = require('./auth/auth.routes');
const scannerRoutes = require('./scanner/scanner.routes');
const reportRoutes = require('./reporting/report.routes');
const authService = require('./auth/auth.service');

// Start periodic token cleanup (every 30 minutes)
setInterval(() => {
  authService.cleanupExpiredTokens();
}, 30 * 60 * 1000);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    ip: req.ip
  });
  next();
});

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Office 365 Scanner API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/db-health', async (req, res) => {
  try {
    const isHealthy = await db.healthCheck();
    res.json({
      success: true,
      database: isHealthy ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      database: 'error',
      error: error.message
    });
  }
});

// API routes
app.use('/auth', authRoutes);
app.use('/scan', scannerRoutes);
app.use('/reports', reportRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Office 365 Scanner API',
    version: '1.0.0',
    endpoints: {
      authentication: {
        login: 'GET /auth/login',
        callback: 'GET /auth/callback',
        logout: 'GET /auth/logout',
        status: 'GET /auth/status'
      },
      scanning: {
        scanUsers: 'POST /scan/users',
        scanFiles: 'POST /scan/files',
        scanEvents: 'POST /scan/events',
        scanAll: 'POST /scan/all',
        scanUser: 'POST /scan/user/:userId'
      },
      reporting: {
        summary: 'GET /reports/summary',
        users: 'GET /reports/users',
        files: 'GET /reports/files',
        events: 'GET /reports/events',
        userDetails: 'GET /reports/user/:id'
      },
      export: {
        exportUsers: 'GET /reports/export/users',
        exportFiles: 'GET /reports/export/files',
        exportEvents: 'GET /reports/export/events',
        exportAll: 'GET /reports/export/all',
        exportUser: 'GET /reports/export/user/:id'
      }
    }
  });
});

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Office 365 Scanner API running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing server gracefully');
  server.close(async () => {
    logger.info('Server closed, closing database connection');
    await db.close();
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing server gracefully');
  server.close(async () => {
    logger.info('Server closed, closing database connection');
    await db.close();
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

module.exports = app;
