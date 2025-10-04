const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../utils/error-handler');
const { requireAuth } = require('../auth/auth.middleware');
const reportService = require('./report.service');
const exportService = require('./export.service');

// All reporting routes require authentication
router.use(requireAuth);

/**
 * Get summary report
 * GET /reports/summary
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const report = await reportService.generateSummaryReport();

  res.json({
    success: true,
    data: report
  });
}));

/**
 * Generate user report
 * GET /reports/users
 */
router.get('/users', asyncHandler(async (req, res) => {
  const report = await reportService.generateUserReport();

  res.json({
    success: true,
    data: report
  });
}));

/**
 * Generate file report
 * GET /reports/files
 */
router.get('/files', asyncHandler(async (req, res) => {
  const report = await reportService.generateFileReport();

  res.json({
    success: true,
    data: report
  });
}));

/**
 * Generate events report
 * GET /reports/events
 */
router.get('/events', asyncHandler(async (req, res) => {
  const report = await reportService.generateEventsReport();

  res.json({
    success: true,
    data: report
  });
}));

/**
 * Generate report for specific user
 * GET /reports/user/:id
 */
router.get('/user/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const report = await reportService.generateUserDetailsReport(id);

  res.json({
    success: true,
    data: report
  });
}));

/**
 * Export users as JSON
 * GET /reports/export/users
 */
router.get('/export/users', asyncHandler(async (req, res) => {
  const exportData = await exportService.exportUsersAsJSON();
  const filename = exportService.generateFilename('users');

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(exportData);
}));

/**
 * Export files as JSON
 * GET /reports/export/files
 */
router.get('/export/files', asyncHandler(async (req, res) => {
  const exportData = await exportService.exportFilesAsJSON();
  const filename = exportService.generateFilename('files');

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(exportData);
}));

/**
 * Export events as JSON
 * GET /reports/export/events
 */
router.get('/export/events', asyncHandler(async (req, res) => {
  const exportData = await exportService.exportEventsAsJSON();
  const filename = exportService.generateFilename('events');

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(exportData);
}));

/**
 * Export all data as JSON
 * GET /reports/export/all
 */
router.get('/export/all', asyncHandler(async (req, res) => {
  const exportData = await exportService.exportAllAsJSON();
  const filename = exportService.generateFilename('complete');

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(exportData);
}));

/**
 * Export specific user data as JSON
 * GET /reports/export/user/:id
 */
router.get('/export/user/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const exportData = await exportService.exportUserDataAsJSON(id);
  const filename = exportService.generateFilename(`user-${id}`);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.json(exportData);
}));

module.exports = router;
