const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { requireAuth } = require('./auth.middleware');

// Public routes
router.get('/login', authController.login);
router.get('/callback', authController.callback);
router.get('/logout', authController.logout);

// Protected routes
router.post('/refresh', requireAuth, authController.refresh);
router.get('/status', authController.status);

module.exports = router;
