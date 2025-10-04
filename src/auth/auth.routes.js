const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { requireAuth } = require('./auth.middleware');

// Public routes
router.get('/login', authController.login);
router.get('/callback', authController.callback);

// Protected routes
router.post('/refresh', requireAuth, authController.refresh);
router.get('/logout', requireAuth, authController.logout);
router.get('/status', authController.status);

module.exports = router;
