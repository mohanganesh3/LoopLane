/**
 * Authentication Routes - API Only (React SPA)
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const {
    validateRegistration,
    validateLogin,
    validateOTP,
    validatePasswordChange,
    validateForgotPassword,
    validateResetPassword,
    handleValidationErrors
} = require('../middleware/validation');
const { isAuthenticated } = require('../middleware/auth');
const { registerLimiter, otpLimiter, otpVerifyLimiter } = require('../middleware/rateLimiter');

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: ['🔐 Auth']
 *     summary: Register a new user
 *     description: Creates a new PASSENGER or RIDER account. An OTP is sent to the provided email for verification. Rate limited to 5 requests per hour per IP.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *     responses:
 *       200:
 *         description: Registration successful. OTP sent to email.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: 'OTP sent to your email' }
 *                 userId: { type: string, example: '64a1b2c3d4e5f6g7h8i9j0k1' }
 *                 redirectUrl: { type: string, example: '/verify-otp' }
 *       400:
 *         description: Validation error (missing fields, invalid phone, etc.)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email or phone already registered
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/register',
    registerLimiter,
    validateRegistration,
    handleValidationErrors,
    authController.register
);

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     tags: ['🔐 Auth']
 *     summary: Verify phone OTP after registration
 *     description: Verifies the 6-digit OTP sent to the user's phone during registration. Activates the account on success. Rate limited to prevent brute-force.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/OTPRequest'
 *     responses:
 *       200:
 *         description: OTP verified. Account activated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Invalid or expired OTP
 *       429:
 *         description: Too many OTP attempts
 */
router.post('/verify-otp',
    otpVerifyLimiter,
    validateOTP,
    handleValidationErrors,
    authController.verifyOTP
);

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     tags: ['🔐 Auth']
 *     summary: Resend OTP to phone
 *     description: Resends a fresh OTP to the user's registered phone. Rate limited to prevent spam.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone]
 *             properties:
 *               phone:
 *                 type: string
 *                 example: '+919876543210'
 *     responses:
 *       200:
 *         description: OTP resent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/resend-otp', otpLimiter, authController.resendOTP);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: ['🔐 Auth']
 *     summary: Login and receive JWT tokens
 *     description: |
 *       Authenticates a user and returns JWT access and refresh tokens.
 *       
 *       **After calling this endpoint:**
 *       1. Copy the `accessToken` from the response
 *       2. Click the **Authorize 🔓** button at the top of this page
 *       3. Paste as `Bearer <token>` in the BearerAuth field
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             passenger:
 *               summary: Passenger login
 *               value: { email: 'passenger@example.com', password: 'Test@123' }
 *             rider:
 *               summary: Rider login
 *               value: { email: 'rider@example.com', password: 'Test@123' }
 *             admin:
 *               summary: Admin login
 *               value: { email: 'admin@looplane.in', password: 'Admin@123' }
 *     responses:
 *       200:
 *         description: Login successful. Returns accessToken and refreshToken.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account suspended or deleted
 */
router.post('/login',
    validateLogin,
    handleValidationErrors,
    authController.login
);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: ['🔐 Auth']
 *     summary: Logout (clears auth cookies)
 *     description: Clears the `accessToken` and `refreshToken` HTTP-only cookies. The tokens themselves are not blacklisted — use `POST /api/token/revoke` to also invalidate the refresh token in the database.
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: ['🔐 Auth']
 *     summary: Request OTP for password reset
 *     description: Sends a password-reset OTP to the user's registered email. Rate limited to prevent abuse.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordRequest'
 *     responses:
 *       200:
 *         description: OTP sent to email
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Email not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/forgot-password',
    otpLimiter,
    validateForgotPassword,
    handleValidationErrors,
    authController.forgotPassword
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: ['🔐 Auth']
 *     summary: Reset password using OTP
 *     description: Resets the user's password using the OTP sent to their email via `POST /api/auth/forgot-password`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordRequest'
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid or expired OTP
 *       429:
 *         description: Too many attempts
 */
router.post('/reset-password',
    otpVerifyLimiter,
    validateResetPassword,
    handleValidationErrors,
    authController.resetPassword
);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     tags: ['🔐 Auth']
 *     summary: Change password (while logged in)
 *     description: Allows authenticated users to change their password. Requires verifying current password.
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
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Not authenticated or wrong current password
 */
router.post('/change-password',
    isAuthenticated,
    validatePasswordChange,
    handleValidationErrors,
    authController.changePassword
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: ['🔐 Auth']
 *     summary: Get current authenticated user
 *     description: Returns the full profile of the currently authenticated user based on their JWT token.
 *     security:
 *       - BearerAuth: []
 *       - CookieAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 user:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: Not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/me', isAuthenticated, authController.getCurrentUser);

module.exports = router;
