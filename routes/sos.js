/**
 * SOS Emergency Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const sosController = require('../controllers/sosController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Trigger Emergency Alert API
router.post('/trigger', isAuthenticated, sosController.triggerEmergency);

// Get User's Active Emergency Status API
router.get('/status', isAuthenticated, sosController.getEmergencyStatus);

// Cancel Emergency API (False Alarm)
router.post('/:emergencyId/cancel', isAuthenticated, sosController.cancelEmergency);

// Get Emergency Details API
router.get('/:emergencyId', isAuthenticated, sosController.getEmergencyDetails);

// Admin APIs
router.get('/admin/all', isAuthenticated, isAdmin, sosController.getAllEmergencies);
router.get('/admin/active', isAuthenticated, isAdmin, sosController.getActiveEmergencies);
router.get('/admin/stats', isAuthenticated, isAdmin, sosController.getEmergencyStats);
router.post('/admin/:emergencyId/update', isAuthenticated, isAdmin, sosController.updateEmergencyStatus);

module.exports = router;
