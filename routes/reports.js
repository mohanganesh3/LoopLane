/**
 * Report Routes - API Only (React SPA)
 * User report/complaint system
 */

const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { isAuthenticated } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
    validateReport,
    handleValidationErrors
} = require('../middleware/validation');

// Apply apiLimiter as baseline
router.use(apiLimiter);
router.post('/create',
    isAuthenticated,
    validateReport,
    handleValidationErrors,
    reportController.submitReport
);
router.get('/my-reports', isAuthenticated, reportController.getMyReports);
router.get('/my/reports', isAuthenticated, reportController.getMyReports);
router.get('/:reportId', isAuthenticated, reportController.getReportDetails);
router.post('/:reportId/message', isAuthenticated, reportController.addMessage);

module.exports = router;
