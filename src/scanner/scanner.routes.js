const express = require('express');
const router = express.Router();
const { requireAuth, csrfProtection } = require('../auth/auth.middleware');
const { asyncHandler } = require('../utils/error-handler');
const userScanner = require('./user-scanner.service');
const fileScanner = require('./file-scanner.service');
const eventScanner = require('./event-scanner.service');
const logger = require('../utils/logger');

// All scanner routes require authentication
router.use(requireAuth);

// CSRF protection for all POST requests
router.use(csrfProtection);

// Add timeout middleware for scanner routes (10 minutes)
router.use((req, res, next) => {
  req.setTimeout(600000); // 10 minutes
  res.setTimeout(600000);
  next();
});

/**
 * Scan all users
 * POST /scan/users
 */
router.post('/users', asyncHandler(async (req, res) => {
  logger.info('Starting user scan via API');

  const result = await userScanner.scanUsers(req.accessToken);

  res.json({
    success: true,
    message: 'User scan completed',
    data: result
  });
}));

/**
 * Scan files for all users
 * POST /scan/files
 */
router.post('/files', asyncHandler(async (req, res) => {
  logger.info('Starting file scan via API');

  const result = await fileScanner.scanAllUserFiles(req.accessToken);

  res.json({
    success: true,
    message: 'File scan completed',
    data: result
  });
}));

/**
 * Scan calendar events for all users
 * POST /scan/events
 */
router.post('/events', asyncHandler(async (req, res) => {
  logger.info('Starting event scan via API');

  const { startDate, endDate } = req.body;
  const options = {};

  // Validate date formats if provided
  if (startDate) {
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid startDate format. Use ISO 8601 format.' }
      });
    }
    options.startDate = start.toISOString();
  }

  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid endDate format. Use ISO 8601 format.' }
      });
    }
    options.endDate = end.toISOString();
  }

  // Validate date range
  if (options.startDate && options.endDate && new Date(options.startDate) > new Date(options.endDate)) {
    return res.status(400).json({
      success: false,
      error: { message: 'startDate must be before endDate' }
    });
  }

  const result = await eventScanner.scanAllUserEvents(req.accessToken, options);

  res.json({
    success: true,
    message: 'Event scan completed',
    data: result
  });
}));

/**
 * Scan everything (users, files, events)
 * POST /scan/all
 */
router.post('/all', asyncHandler(async (req, res) => {
  logger.info('Starting full scan (users, files, events)');

  // Scan users first
  const userResult = await userScanner.scanUsers(req.accessToken);

  // Then scan files
  const fileResult = await fileScanner.scanAllUserFiles(req.accessToken);

  // Then scan events
  const eventResult = await eventScanner.scanAllUserEvents(req.accessToken);

  res.json({
    success: true,
    message: 'Full scan completed',
    data: {
      users: userResult,
      files: fileResult,
      events: eventResult
    }
  });
}));

/**
 * Scan specific user
 * POST /scan/user/:userId
 */
router.post('/user/:userId', asyncHandler(async (req, res) => {
  const { userId } = req.params;
  logger.info('Starting scan for specific user', { userId });

  // Scan user
  const user = await userScanner.scanUserById(userId, req.accessToken);

  // Scan user files
  const files = await fileScanner.scanUserFiles(userId, req.accessToken);

  // Scan user events
  const events = await eventScanner.scanUserEvents(userId, req.accessToken);

  res.json({
    success: true,
    message: 'User scan completed',
    data: {
      user,
      filesCount: files.length,
      eventsCount: events.length
    }
  });
}));

module.exports = router;
