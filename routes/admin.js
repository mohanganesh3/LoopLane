/**
 * Admin Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const RouteDeviation = require('../models/RouteDeviation');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// All routes require admin authentication
router.use(isAuthenticated);
router.use(isAdmin);

// Middleware to count unresolved deviations for admin endpoints
router.use(async (req, res, next) => {
    try {
        const unresolvedDeviations = await RouteDeviation.countDocuments({ 
            status: { $in: ['ACTIVE', 'ESCALATED'] } 
        });
        req.unresolvedDeviations = unresolvedDeviations;
    } catch (error) {
        console.error('Error fetching unresolved deviations:', error);
        req.unresolvedDeviations = 0;
    }
    next();
});

// ========== API ROUTES (JSON responses for React frontend) ==========

// Dashboard Stats API
router.get('/stats', adminController.getDashboardStats);

// User Management API
router.get('/users', adminController.getUsers);
router.get('/users/:id', adminController.getUserDetails);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.post('/users/:id/suspend', adminController.suspendUser);
router.post('/users/:id/activate', adminController.activateUser);
router.delete('/users/:id', adminController.deleteUser);

// Verification API
router.get('/verifications/pending', adminController.getPendingVerifications);
router.post('/verifications/:userId/verify', adminController.approveVerification);
router.post('/verifications/:userId/reject', adminController.rejectVerification);

// Rides Management API
router.get('/rides', adminController.getRides);
router.get('/rides/:rideId', adminController.getRideDetails);
router.post('/rides/:rideId/cancel', adminController.cancelRide);

// Bookings Management API
router.get('/bookings', adminController.getBookings);
router.get('/bookings/:bookingId', adminController.getBookingDetails);
router.post('/bookings/:bookingId/refund', adminController.refundBooking);

// Reports API - User Reports (complaints/issues)
router.get('/reports', adminController.getReports);
router.get('/reports/:reportId', adminController.getReportDetails);
router.post('/reports/:reportId/action', adminController.takeReportAction);

// Analytics API
router.get('/analytics/revenue', adminController.getRevenueReport);
router.get('/analytics/activity', adminController.getActivityReport);
router.get('/analytics/rides', adminController.getRideAnalytics);

// Emergency API
router.get('/emergencies', adminController.getEmergencies);
router.post('/emergencies/:emergencyId/resolve', adminController.resolveEmergency);

// Settings API
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);

// Notifications API
router.get('/notifications', adminController.getNotifications);
router.post('/notifications/:notificationId/read', adminController.markNotificationAsRead);

module.exports = router;
