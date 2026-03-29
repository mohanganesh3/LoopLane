/**
 * User Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const livenessController = require('../controllers/livenessController'); // Epic 3
const { isAuthenticated, isRider } = require('../middleware/auth');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimiter');
const uploadMiddleware = require('../middleware/upload');
const {
    validateProfileUpdate,
    validateEmergencyContact,
    validateVehicle,
    handleValidationErrors
} = require('../middleware/validation');

// Apply apiLimiter as baseline for all user routes
router.use(apiLimiter);

// Dashboard API

/**
 * @swagger
 * /api/user/dashboard:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get dashboard data
 *     description: Returns personalized dashboard data for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *       401:
 *         description: Not authenticated
 */
router.get('/dashboard', isAuthenticated, userController.getDashboardData);

// Profile APIs

/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get my profile
 *     description: Returns the authenticated user's profile.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Profile
 *       401:
 *         description: Not authenticated
 */
router.get('/profile', isAuthenticated, userController.getProfile);

/**
 * @swagger
 * /api/user/profile-data:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get my profile (extended)
 *     description: Returns an extended profile payload for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Extended profile payload
 */
router.get('/profile-data', isAuthenticated, userController.getProfileData);

/**
 * @swagger
 * /api/user/profile/{userId}:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get a public profile
 *     description: Returns the public-facing profile for a given user ID.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Public profile
 *       404:
 *         description: User not found
 */
router.get('/profile/:userId', isAuthenticated, userController.getPublicProfile);

/**
 * @swagger
 * /api/user/profile:
 *   post:
 *     tags: ['👤 User']
 *     summary: Update my profile
 *     description: Updates profile fields and optionally uploads a profile photo.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/ProfileUpdateRequest'
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.post('/profile',
    isAuthenticated,
    uploadLimiter,
    uploadMiddleware.fields([{ name: 'profilePhoto', maxCount: 1 }]),
    validateProfileUpdate,
    handleValidationErrors,
    userController.updateProfile
);

// Profile picture upload API

/**
 * @swagger
 * /api/user/profile/picture:
 *   post:
 *     tags: ['👤 User']
 *     summary: Update profile picture
 *     description: Uploads and sets a new profile picture for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePhoto:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture updated
 */
router.post('/profile/picture',
    isAuthenticated,
    uploadLimiter,
    uploadMiddleware.profilePhotoFields,
    userController.updateProfilePicture
);

// Complete Profile API (for riders)

/**
 * @swagger
 * /api/user/complete-profile:
 *   post:
 *     tags: ['👤 User']
 *     summary: Complete rider profile
 *     description: RIDER only — completes onboarding details after verification.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Rider profile completed
 *       403:
 *         description: Rider access required
 */
router.post('/complete-profile',
    isAuthenticated,
    isRider,
    userController.completeRiderProfile
);

// Document Upload API

/**
 * @swagger
 * /api/user/documents:
 *   post:
 *     tags: ['👤 User']
 *     summary: Upload rider documents
 *     description: RIDER only — upload identity/vehicle documents for verification.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             description: Multiple document files (fields depend on uploader)
 *     responses:
 *       200:
 *         description: Documents uploaded
 */
router.post('/documents',
    isAuthenticated,
    isRider,
    uploadLimiter,
    uploadMiddleware.riderDocuments,
    userController.uploadDocuments
);


/**
 * @swagger
 * /api/user/documents/upload:
 *   post:
 *     tags: ['👤 User']
 *     summary: Upload rider documents (detailed fields)
 *     description: RIDER only — upload driver license, aadhar, RC, insurance, and vehicle photos.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               driverLicenseFront: { type: string, format: binary }
 *               driverLicenseBack: { type: string, format: binary }
 *               aadharCard: { type: string, format: binary }
 *               rcBook: { type: string, format: binary }
 *               insurance: { type: string, format: binary }
 *               vehiclePhotos:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Documents uploaded
 */
router.post('/documents/upload',
    isAuthenticated,
    isRider,
    uploadLimiter,
    uploadMiddleware.fields([
        { name: 'driverLicenseFront', maxCount: 1 },
        { name: 'driverLicenseBack', maxCount: 1 },
        { name: 'aadharCard', maxCount: 1 },
        { name: 'rcBook', maxCount: 1 },
        { name: 'insurance', maxCount: 1 },
        { name: 'vehiclePhotos', maxCount: 5 }
    ]),
    userController.uploadDocuments
);


/**
 * @swagger
 * /api/user/documents/status:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get document verification status
 *     description: Returns current verification status for the authenticated user's documents.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Document verification status
 */
router.get('/documents/status', isAuthenticated, userController.getDocumentStatus);

// Change password API

/**
 * @swagger
 * /api/user/change-password:
 *   post:
 *     tags: ['👤 User']
 *     summary: Change password
 *     description: Changes the authenticated user's password.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: Password changed
 */
router.post('/change-password', isAuthenticated, userController.changePassword);

// Carbon Report API

/**
 * @swagger
 * /api/user/carbon-report:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get my carbon report
 *     description: Returns CO2 savings and commute impact summary for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Carbon report
 */
router.get('/carbon-report', isAuthenticated, userController.getCarbonReport);

// Emergency Contacts APIs

/**
 * @swagger
 * /api/user/emergency-contacts/list:
 *   get:
 *     tags: ['👤 User']
 *     summary: List emergency contacts
 *     description: Returns the authenticated user's emergency contacts.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Emergency contacts
 */
router.get('/emergency-contacts/list', isAuthenticated, userController.getEmergencyContactsList);

/**
 * @swagger
 * /api/user/emergency-contacts/add:
 *   post:
 *     tags: ['👤 User']
 *     summary: Add emergency contact (new)
 *     description: Adds a new emergency contact for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Contact added
 */
router.post('/emergency-contacts/add', isAuthenticated, userController.addEmergencyContactNew);

/**
 * @swagger
 * /api/user/emergency-contacts/{contactId}/send-verification:
 *   post:
 *     tags: ['👤 User']
 *     summary: Send emergency contact verification
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Verification sent
 */
router.post('/emergency-contacts/:contactId/send-verification', isAuthenticated, userController.sendContactVerification);

/**
 * @swagger
 * /api/user/emergency-contacts/{contactId}/verify:
 *   post:
 *     tags: ['👤 User']
 *     summary: Verify emergency contact
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Contact verified
 */
router.post('/emergency-contacts/:contactId/verify', isAuthenticated, userController.verifyEmergencyContact);

/**
 * @swagger
 * /api/user/emergency-contacts/{contactId}/set-primary:
 *   post:
 *     tags: ['👤 User']
 *     summary: Set primary emergency contact
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Primary contact updated
 */
router.post('/emergency-contacts/:contactId/set-primary', isAuthenticated, userController.setPrimaryContact);

/**
 * @swagger
 * /api/user/emergency-contacts/{contactId}:
 *   delete:
 *     tags: ['👤 User']
 *     summary: Remove emergency contact
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Contact removed
 */
router.delete('/emergency-contacts/:contactId', isAuthenticated, userController.removeEmergencyContact);

/**
 * @swagger
 * /api/user/emergency-contacts:
 *   post:
 *     tags: ['👤 User']
 *     summary: Add emergency contact (legacy)
 *     description: Legacy endpoint for adding an emergency contact.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Contact added
 */
router.post('/emergency-contacts',
    isAuthenticated,
    validateEmergencyContact,
    handleValidationErrors,
    userController.addEmergencyContact
);

// License/Verification APIs

/**
 * @swagger
 * /api/user/license/upload:
 *   post:
 *     tags: ['👤 User']
 *     summary: Upload driver's license
 *     description: RIDER only — uploads license images for verification.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               licenseFront: { type: string, format: binary }
 *               licenseBack: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: License uploaded
 */
router.post('/license/upload',
    isAuthenticated,
    isRider,
    uploadMiddleware.fields([
        { name: 'licenseFront', maxCount: 1 },
        { name: 'licenseBack', maxCount: 1 }
    ]),
    userController.uploadLicense
);

/**
 * @swagger
 * /api/user/license/status:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get license verification status
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: License status
 */
router.get('/license/status', isAuthenticated, userController.getLicenseStatus);

// Vehicle APIs

/**
 * @swagger
 * /api/user/vehicles:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get my vehicles
 *     description: Returns vehicles associated with the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Vehicles list
 */
router.get('/vehicles', isAuthenticated, userController.getVehicles);

/**
 * @swagger
 * /api/user/vehicle:
 *   post:
 *     tags: ['👤 User']
 *     summary: Add vehicle
 *     description: RIDER only — adds a vehicle to the authenticated rider.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/VehicleRequest'
 *     responses:
 *       201:
 *         description: Vehicle added
 */
router.post('/vehicle',
    isAuthenticated,
    isRider,
    uploadMiddleware.fields([{ name: 'vehiclePhoto', maxCount: 3 }]),
    userController.addVehicle
);

/**
 * @swagger
 * /api/user/vehicle/{vehicleId}:
 *   put:
 *     tags: ['👤 User']
 *     summary: Update vehicle
 *     description: RIDER only — updates vehicle details.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             $ref: '#/components/schemas/VehicleRequest'
 *     responses:
 *       200:
 *         description: Vehicle updated
 */
router.put('/vehicle/:vehicleId',
    isAuthenticated,
    isRider,
    uploadMiddleware.fields([{ name: 'vehiclePhoto', maxCount: 3 }]),
    userController.updateVehicle
);

/**
 * @swagger
 * /api/user/vehicle/{vehicleId}:
 *   delete:
 *     tags: ['👤 User']
 *     summary: Remove vehicle
 *     description: RIDER only — removes a vehicle.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: vehicleId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Vehicle removed
 */
router.delete('/vehicle/:vehicleId',
    isAuthenticated,
    isRider,
    userController.removeVehicle
);

// Trip History API

/**
 * @swagger
 * /api/user/trip-history:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get trip history
 *     description: Returns trip history for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Trip history
 */
router.get('/trip-history', isAuthenticated, userController.getTripHistory);

// Notifications API

/**
 * @swagger
 * /api/user/notifications:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get notifications
 *     description: Returns in-app notifications for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Notifications list
 */
router.get('/notifications', isAuthenticated, userController.getNotifications);

// Settings APIs

/**
 * @swagger
 * /api/user/settings:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get user settings
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Settings
 *   put:
 *     tags: ['👤 User']
 *     summary: Update user settings
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Settings payload
 *     responses:
 *       200:
 *         description: Settings updated
 */
router.get('/settings', isAuthenticated, userController.getSettings);
router.put('/settings', isAuthenticated, userController.updateSettings);

// Trust Score & Badges APIs

/**
 * @swagger
 * /api/user/trust-score:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get my trust score
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Trust score
 */
router.get('/trust-score', isAuthenticated, userController.getTrustScore);

/**
 * @swagger
 * /api/user/trust-score/{userId}:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get a user's trust score
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Trust score
 */
router.get('/trust-score/:userId', isAuthenticated, userController.getTrustScore);

/**
 * @swagger
 * /api/user/badges:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get my badges
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Badges
 */
router.get('/badges', isAuthenticated, userController.getUserBadges);

/**
 * @swagger
 * /api/user/badges/{userId}:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get a user's badges
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Badges
 */
router.get('/badges/:userId', isAuthenticated, userController.getUserBadges);

/**
 * @swagger
 * /api/user/badges/check:
 *   post:
 *     tags: ['👤 User']
 *     summary: Check & award badges
 *     description: Evaluates badge rules and awards any newly earned badges.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Badge evaluation result
 */
router.post('/badges/check', isAuthenticated, userController.checkBadges);

/**
 * @swagger
 * /api/user/stats:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get my stats
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: User stats
 */
router.get('/stats', isAuthenticated, userController.getUserStats);

/**
 * @swagger
 * /api/user/stats/{userId}:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get a user's stats
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: User stats
 */
router.get('/stats/:userId', isAuthenticated, userController.getUserStats);

/**
 * @swagger
 * /api/user/recommended-price:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get recommended ride price
 *     description: Suggests a recommended price per seat for a rider.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Recommended price
 */
router.get('/recommended-price', isAuthenticated, userController.getRecommendedPrice);

/**
 * @swagger
 * /api/user/contribution-calculator:
 *   get:
 *     tags: ['👤 User']
 *     summary: Contribution calculator
 *     description: Calculates contribution splits and estimates for a ride.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Contribution calculation
 */
router.get('/contribution-calculator', isAuthenticated, userController.getContributionCalculator);

// Account Management API

/**
 * @swagger
 * /api/user/account:
 *   delete:
 *     tags: ['👤 User']
 *     summary: Delete my account
 *     description: Deletes (or deactivates) the authenticated user's account.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 */
router.delete('/account', isAuthenticated, userController.deleteAccount);

// Wallet APIs (simulated)

/**
 * @swagger
 * /api/user/wallet:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get wallet
 *     description: Returns wallet balance and ledger for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Wallet
 */
router.get('/wallet', isAuthenticated, userController.getWallet);

/**
 * @swagger
 * /api/user/wallet/add:
 *   post:
 *     tags: ['👤 User']
 *     summary: Add wallet funds
 *     description: Simulated wallet add-funds flow.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddFundsRequest'
 *     responses:
 *       200:
 *         description: Funds added
 */
router.post('/wallet/add', isAuthenticated, userController.addWalletFunds);

// Rider Earnings API

/**
 * @swagger
 * /api/user/earnings:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get rider earnings
 *     description: RIDER only — returns earnings summary.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Earnings
 */
router.get('/earnings', isAuthenticated, userController.getEarnings);

// Epic 3: Pre-Ride Liveness Check (Driver Identity)

/**
 * @swagger
 * /api/user/verify-liveness:
 *   post:
 *     tags: ['👤 User']
 *     summary: Verify liveness (driver)
 *     description: RIDER only — runs a liveness verification check.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Liveness verification result
 */
router.post('/verify-liveness', isAuthenticated, isRider, livenessController.verifyLiveness);

// Route Demand Intelligence — Personalized Driver Suggestions

/**
 * @swagger
 * /api/user/route-suggestions:
 *   get:
 *     tags: ['👤 User']
 *     summary: Get route suggestions
 *     description: Returns personalized route suggestions for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Route suggestions
 */
router.get('/route-suggestions', isAuthenticated, userController.getRouteSuggestions);

// Route Alerts — "Notify me when a ride is posted on this route"

/**
 * @swagger
 * /api/user/route-alerts:
 *   get:
 *     tags: ['👤 User']
 *     summary: List route alerts
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Route alerts
 *   post:
 *     tags: ['👤 User']
 *     summary: Create route alert
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Route alert details
 *     responses:
 *       201:
 *         description: Route alert created
 */
router.get('/route-alerts', isAuthenticated, userController.getRouteAlerts);
router.post('/route-alerts', isAuthenticated, userController.createRouteAlert);

/**
 * @swagger
 * /api/user/route-alerts/{alertId}:
 *   delete:
 *     tags: ['👤 User']
 *     summary: Delete route alert
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Route alert deleted
 */
router.delete('/route-alerts/:alertId', isAuthenticated, userController.deleteRouteAlert);

// Promo Code Validation (User-Facing)

/**
 * @swagger
 * /api/user/validate-promo:
 *   post:
 *     tags: ['👤 User']
 *     summary: Validate promo code
 *     description: Validates a promo code for the authenticated user.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               code: { type: string, example: 'GREENRIDE20' }
 *     responses:
 *       200:
 *         description: Promo code validation result
 */
router.post('/validate-promo', isAuthenticated, userController.validatePromoCode);

module.exports = router;
