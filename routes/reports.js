/**
 * Report Routes - API Only (React SPA)
 * User report/complaint system
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { isAuthenticated } = require('../middleware/auth');
const {
    validateReport,
    handleValidationErrors
} = require('../middleware/validation');

// Submit Report API
router.post('/create',
    isAuthenticated,
    validateReport,
    handleValidationErrors,
    reportController.submitReport
);

// My Reports API
router.get('/my-reports', isAuthenticated, reportController.getMyReports);
router.get('/my/reports', isAuthenticated, reportController.getMyReports);

// Report Details API
router.get('/:reportId', isAuthenticated, reportController.getReportDetails);

module.exports = router;
