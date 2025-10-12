/**
 * Admin Routes
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(isAuthenticated);
router.use(isAdmin);

// Dashboard
router.get('/dashboard', adminController.showDashboard);

// Financial Dashboard
router.get('/financial-dashboard', adminController.showFinancialDashboard);

// User Management
router.get('/users', adminController.showUsers);
router.get('/users/:id', adminController.getUserDetails);
router.post('/users/:id/suspend', adminController.suspendUser);
router.post('/users/:id/activate', adminController.activateUser);
router.delete('/users/:id', adminController.deleteUser);

// Verification Requests
router.get('/verifications', adminController.showVerificationRequests);
router.get('/verifications/:userId', adminController.showVerificationDetails);
router.post('/verifications/:userId/approve', adminController.approveVerification);
router.post('/verifications/:userId/reject', adminController.rejectVerification);

// Emergency Management
router.get('/emergencies', adminController.showEmergencies);

// SOS Emergency Dashboard
router.get('/sos', adminController.showSOSDashboard);
router.get('/sos/emergencies', adminController.getAllEmergencies);
router.get('/sos/emergencies/:emergencyId', adminController.getEmergencyDetails);
router.post('/sos/emergencies/:emergencyId/respond', adminController.respondToEmergency);
router.post('/sos/emergencies/:emergencyId/resolve', adminController.resolveEmergency);

// Rides Management
router.get('/rides', adminController.showRides);
router.get('/rides/:rideId', adminController.showRideDetails);
router.post('/rides/:rideId/cancel', adminController.cancelRide);

// Bookings Management
router.get('/bookings', adminController.showBookings);
router.get('/bookings/:bookingId', adminController.showBookingDetails);

// Reports
router.get('/reports', adminController.showReports);
router.get('/reports/:reportId', adminController.showReportDetails);
router.post('/reports/:reportId/review', adminController.reviewReport);

// Statistics
router.get('/statistics', adminController.showStatistics);

// Settings
router.get('/settings', adminController.showSettings);
router.post('/settings', adminController.updateSettings);

// Notifications
router.get('/notifications', adminController.getNotifications);
router.post('/notifications/:notificationId/read', adminController.markNotificationAsRead);

module.exports = router;
