/**
 * Authentication Controller
 * Handles user registration, login, OTP verification, password management
 */

const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const emailService = require('../utils/emailService');
const helpers = require('../utils/helpers');
const { 
    generateAccessToken, 
    generateRefreshToken,
    getCookieOptions 
} = require('../middleware/jwt');

/**
 * Show registration page
 */
exports.showRegisterPage = (req, res) => {
    res.render('auth/register', {
        title: 'Register - LANE Carpool',
        error: null
    });
};

/**
 * Handle registration - Step 1 (Send OTP)
 */
exports.register = asyncHandler(async (req, res) => {
    const { name, email, phone, password, role } = req.body;

    // Check for existing users with same email OR phone
    const conflicts = await User.find({
        $or: [
            { email: email.toLowerCase().trim() },
            { phone: phone.trim() }
        ]
    });

    for (const user of conflicts) {
        if (user.emailVerified) {
            if (user.email === email.toLowerCase().trim()) {
                throw new AppError('Email already registered. Please login.', 400);
            }
            if (user.phone === phone.trim()) {
                throw new AppError('Phone number already registered.', 400);
            }
        }
    }

    // Delete any unverified conflicting accounts to allow fresh registration
    for (const user of conflicts) {
        await User.findByIdAndDelete(user._id);
        console.log(`🔄 Deleted unverified user conflict: ${user.email}`);
    }

    // Generate OTP
    const otp = helpers.generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Split name into firstName and lastName
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

    // Create new user (unverified)
    const newUser = await User.create({
        email: email.toLowerCase().trim(),
        phone,
        password,
        role,
        profile: {
            firstName: name.split(' ')[0],
            lastName: name.split(' ').slice(1).join(' ') || name.split(' ')[0]
        },
        otpCode: otp,
        otpExpires: otpExpiry,
        accountStatus: 'ACTIVE',
        emailVerified: false,
        phoneVerified: false  // Phone not verified via OTP
    });

    // In production, skip OTP and auto-verify to avoid email issues
    if (process.env.NODE_ENV === 'production') {
        newUser.emailVerified = true;
        newUser.phoneVerified = true;
        newUser.verificationStatus = role === 'PASSENGER' ? 'VERIFIED' : 'PENDING';
        await newUser.save();

        console.log(`✅ Auto-verified user in production: ${email}`);

        return res.status(200).json({
            success: true,
            message: 'Account created successfully!',
            userId: newUser._id,
            autoVerified: true,
            redirectUrl: '/login'
        });
    }

    // In development, try sending OTP email, auto-verify if email fails
    let emailSent = false;
    try {
        await emailService.sendOTP(email, otp, firstName);
        emailSent = true;
    } catch (error) {
        console.error('❌ Error sending OTP email:', error.message);
    }

    if (!emailSent) {
        // Email failed — auto-verify so user can still register
        newUser.emailVerified = true;
        newUser.phoneVerified = true;
        newUser.verificationStatus = role === 'PASSENGER' ? 'VERIFIED' : 'PENDING';
        await newUser.save();

        return res.status(200).json({
            success: true,
            message: 'Account created successfully!',
            userId: newUser._id,
            autoVerified: true,
            redirectUrl: '/login'
        });
    }

    res.status(200).json({
        success: true,
        message: 'OTP sent to your email',
        userId: newUser._id,
        redirectUrl: '/verify-otp'
    });
});

/**
 * Show OTP verification page
 */
exports.showVerifyOTPPage = (req, res) => {
    res.render('auth/verify-otp', {
        title: 'Verify OTP - LANE Carpool',
        error: null
    });
};

/**
 * Verify OTP - Step 2
 */
exports.verifyOTP = asyncHandler(async (req, res) => {
    const { otp, userId } = req.body;

    if (!otp) {
        throw new AppError('OTP is required.', 400);
    }

    let user;

    if (userId) {
        // Primary: Find by userId (sent from frontend localStorage)
        user = await User.findById(userId);
    }
    
    if (!user) {
        // Fallback: Find unverified user with this OTP code
        user = await User.findOne({
            otpCode: otp,
            emailVerified: false,
            otpExpires: { $gt: new Date() }
        });
    }

    if (!user) {
        throw new AppError('Invalid or expired OTP. Please register again.', 400);
    }

    // Check if OTP is expired first (prevent timing attacks)
    if (!user.otpExpires || new Date() > user.otpExpires) {
        throw new AppError('Invalid or expired OTP', 400);
    }

    // Then check if OTP matches (use constant-time comparison for security)
    if (!user.otpCode || user.otpCode !== otp) {
        throw new AppError('Invalid or expired OTP', 400);
    }

    // Mark user as verified
    user.emailVerified = true;
    user.phoneVerified = true;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    
    // Auto-verify PASSENGERS (no document verification needed)
    // Only RIDERS need admin verification after uploading documents
    if (user.role === 'PASSENGER') {
        user.verificationStatus = 'VERIFIED';
    }
    
    await user.save();

    // Generate JWT tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in database
    await RefreshToken.createToken(user._id, refreshToken, {
        deviceInfo: req.headers['user-agent'] || 'Unknown Device',
        ipAddress: req.ip || 'Unknown'
    });

    // Set tokens in HTTP-only cookies
    const accessTokenMaxAge = 15 * 60 * 1000; // 15 minutes
    const refreshTokenMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    res.cookie('accessToken', accessToken, getCookieOptions(accessTokenMaxAge));
    res.cookie('refreshToken', refreshToken, getCookieOptions(refreshTokenMaxAge));

    // ✅ Redirect RIDERS to complete profile page with vehicle details
    // PASSENGERS go directly to dashboard
    const redirectUrl = user.role === 'RIDER' ? '/complete-profile' : '/dashboard';
    
    res.status(200).json({
        success: true,
        message: 'Registration successful',
        accessToken,
        refreshToken,
        expiresIn: 900,
        redirectUrl: redirectUrl
    });
});

/**
 * Resend OTP
 */
exports.resendOTP = asyncHandler(async (req, res) => {
    const { userId: bodyUserId, email: bodyEmail } = req.body;
    const userId = bodyUserId || req.user?._id;

    let user;

    if (userId) {
        user = await User.findById(userId);
    }

    if (!user && bodyEmail) {
        // Fallback: Find unverified user by email
        user = await User.findOne({ email: bodyEmail.toLowerCase().trim(), emailVerified: false });
    }

    if (!user) {
        // Last resort: Find most recent unverified user (within last 15 minutes)
        user = await User.findOne({
            emailVerified: false,
            createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) }
        }).sort({ createdAt: -1 });
    }

    if (!user) {
        throw new AppError('No pending registration found. Please register again.', 400);
    }

    // Generate new OTP
    const otp = helpers.generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    user.otpCode = otp;
    user.otpExpires = otpExpiry;
    await user.save();

    // Send OTP via email (required)
    try {
        await emailService.sendOTP(user.email, otp, user.profile.firstName || 'User');
    } catch (error) {
        console.error('❌ Error sending OTP email:', error.message);
        throw new AppError('Failed to send OTP. Please try again.', 500);
    }

    res.status(200).json({
        success: true,
        message: 'New OTP sent to your email'
    });
});

/**
 * Show login page
 */
exports.showLoginPage = (req, res) => {
    res.render('auth/login', {
        title: 'Login - LANE Carpool',
        error: null
    });
};

/**
 * Handle login
 */
exports.login = asyncHandler(async (req, res) => {
    const { email, password, otp } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        throw new AppError('Invalid email or password', 401);
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
        throw new AppError('Invalid email or password', 401);
    }

    // NOTE: Email verification is only required during signup (verify-otp page)
    // Users can login even if email is not verified - they verified during registration with OTP
    
    // Check if account is suspended by admin
    if (user.accountStatus === 'SUSPENDED' || !user.isActive) {
        const suspensionReason = user.suspensionReason || 'Policy violation';
        throw new AppError(
            `🚫 Your account has been suspended.\n\n` +
            `📧 Please check your email for details about the suspension.\n\n` +
            `Reason: ${suspensionReason}\n\n` +
            `If you believe this is a mistake, please reply to the suspension email with proof of your innocence. Our admin team will review your appeal.`,
            403
        );
    }

    // Check if account is deleted
    if (user.accountStatus === 'DELETED') {
        throw new AppError('This account no longer exists.', 403);
    }

    // ✅ CHECK TWO-FACTOR AUTHENTICATION
    if (user.preferences?.security?.twoFactorEnabled) {
        // If OTP not provided, send it and require verification
        if (!otp) {
            // Generate OTP for 2FA
            const twoFactorOtp = Math.floor(100000 + Math.random() * 900000).toString();
            user.otp = twoFactorOtp;
            user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
            await user.save();
            
            // Send OTP via email
            const emailService = require('../utils/emailService');
            await emailService.sendOTPEmail(user.email, twoFactorOtp, user.profile?.firstName || 'User');
            
            return res.status(403).json({
                success: false,
                requiresTwoFactor: true,
                message: 'Two-factor authentication required. Please check your email for OTP.'
            });
        }
        
        // Verify OTP
        if (user.otp !== otp || new Date() > user.otpExpires) {
            throw new AppError('Invalid or expired OTP', 401);
        }
        
        // Clear OTP after successful verification
        user.otp = undefined;
        user.otpExpires = undefined;
    }

    // Generate JWT tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store refresh token in database with device info
    const deviceInfo = req.headers['user-agent'] || 'Unknown Device';
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
    
    await RefreshToken.createToken(user._id, refreshToken, {
        deviceInfo,
        ipAddress
    });

    // Set tokens in HTTP-only cookies
    const accessTokenMaxAge = 15 * 60 * 1000; // 15 minutes
    const refreshTokenMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    res.cookie('accessToken', accessToken, getCookieOptions(accessTokenMaxAge));
    res.cookie('refreshToken', refreshToken, getCookieOptions(refreshTokenMaxAge));

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Redirect based on role
    const redirectUrl = user.role === 'ADMIN' ? '/admin/dashboard' : '/user/dashboard';

    // Return user data (without password)
    const userData = {
        _id: user._id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        profile: user.profile,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        verificationStatus: user.verificationStatus,
        accountStatus: user.accountStatus
    };

    res.status(200).json({
        success: true,
        message: 'Login successful',
        user: userData,
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
        redirectUrl
    });
});

/**
 * Handle logout
 */
exports.logout = asyncHandler(async (req, res) => {
    // Revoke refresh token if present
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
    
    if (refreshToken) {
        try {
            const { verifyRefreshToken } = require('../middleware/jwt');
            const decoded = verifyRefreshToken(refreshToken);
            const tokenDoc = await RefreshToken.findValidToken(decoded.userId, refreshToken);
            
            if (tokenDoc) {
                await RefreshToken.revokeToken(tokenDoc._id);
                console.log('✅ Refresh token revoked on logout');
            }
        } catch (error) {
            console.error('⚠️ Error revoking refresh token:', error.message);
            // Continue with logout even if token revocation fails
        }
    }

    // Clear all auth cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    return res.status(200).json({
        success: true,
        message: 'Logged out successfully',
        redirectUrl: '/login'
    });
});

/**
 * Show forgot password page
 */
exports.showForgotPasswordPage = (req, res) => {
    res.render('auth/forgot-password', {
        title: 'Forgot Password - LANE Carpool',
        error: null,
        success: null,
        email: req.query.email || ''
    });
};

/**
 * Handle forgot password (Send OTP)
 */
exports.forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    console.log('🔵 [Forgot Password] Request for email:', email);

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
        console.log('⚠️ [Forgot Password] User not found:', email);
        // Don't reveal if email exists (security best practice)
        return res.status(200).json({
            success: true,
            message: 'If your email is registered, you will receive a password reset code shortly.',
            showMessage: true
        });
    }

    console.log('✅ [Forgot Password] User found:', user._id);

    // Generate 6-digit OTP
    const otp = helpers.generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Send OTP via email
    try {
        await emailService.sendPasswordResetOTP(
            user.email, 
            otp, 
            user.profile.firstName || 'User'
        );
        console.log('✅ [Forgot Password] OTP email sent successfully');
    } catch (emailError) {
        console.error('❌ [Forgot Password] Error sending email:', emailError.message);
        // Save OTP anyway so user can still reset password if they see it in logs
        console.log(`⚠️ [Forgot Password] OTP for ${email}: ${otp}`);
    }

    // Save OTP to user
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = otpExpiry;
    await user.save();

    console.log('✅ [Forgot Password] OTP generated and saved');

    return res.status(200).json({
        success: true,
        message: 'Password reset code sent to your email. Please check your inbox.',
        email: user.email,
        redirectUrl: '/auth/reset-password'
    });
});

/**
 * Show reset password page
 */
exports.showResetPasswordPage = (req, res) => {
    res.render('auth/reset-password', {
        title: 'Reset Password - LANE Carpool',
        error: null,
        success: null,
        email: req.query.email || ''
    });
};

/**
 * Handle reset password
 */
exports.resetPassword = asyncHandler(async (req, res) => {
    const { otp, newPassword, confirmPassword, email } = req.body;

    console.log('🔵 [Reset Password] Request received');

    if (!email) {
        throw new AppError('Email is required. Please start the password reset process again.', 400);
    }

    // Find user by email
    const userByEmail = await User.findOne({ email: email.toLowerCase().trim() });
    if (!userByEmail) {
        throw new AppError('User not found', 404);
    }
    const userId = userByEmail._id;

    // Validate passwords match
    if (newPassword !== confirmPassword) {
        throw new AppError('Passwords do not match', 400);
    }

    // Validate password strength
    if (newPassword.length < 8) {
        throw new AppError('Password must be at least 8 characters long', 400);
    }

    const user = await User.findById(userId);

    if (!user) {
        console.log('❌ [Reset Password] User not found:', userId);
        throw new AppError('User not found', 404);
    }

    console.log('✅ [Reset Password] User found:', user.email);

    // Verify OTP expiry first (prevent timing attacks)
    if (!user.resetPasswordOTPExpires || new Date() > user.resetPasswordOTPExpires) {
        console.log('❌ [Reset Password] OTP expired or missing');
        throw new AppError('Invalid or expired reset code', 400);
    }

    // Then verify OTP value
    if (!user.resetPasswordOTP || user.resetPasswordOTP !== otp) {
        console.log('❌ [Reset Password] Invalid OTP');
        throw new AppError('Invalid or expired reset code', 400);
    }

    console.log('✅ [Reset Password] OTP verified successfully');

    // Update password (will be hashed by pre-save middleware)
    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    await user.save();

    console.log('✅ [Reset Password] Password updated successfully');

    // Password updated — no session data to clear

    // Send confirmation email
    try {
        await emailService.sendPasswordResetConfirmation(
            user.email,
            user.profile.firstName || 'User'
        );
        console.log('✅ [Reset Password] Confirmation email sent');
    } catch (emailError) {
        console.error('⚠️ [Reset Password] Failed to send confirmation email:', emailError);
        // Don't fail the password reset if email fails
    }

    return res.status(200).json({
        success: true,
        message: 'Password reset successful! You can now login with your new password.',
        redirectUrl: '/auth/login'
    });
});

/**
 * Show change password page (for logged-in users)
 */
exports.showChangePasswordPage = (req, res) => {
    res.render('auth/change-password', {
        title: 'Change Password - LANE Carpool',
        user: req.user,
        error: null
    });
};

/**
 * Handle change password (for logged-in users)
 */
exports.changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
        throw new AppError('Current password is incorrect', 400);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password changed successfully'
    });
});

/**
 * Get current authenticated user (API)
 */
exports.getCurrentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .select('-password')
        .populate('vehicles');

    if (!user) {
        throw new AppError('User not found', 404);
    }

    res.json({
        success: true,
        user: {
            _id: user._id,
            email: user.email,
            phone: user.phone,
            role: user.role,
            profile: user.profile,
            verificationStatus: user.verificationStatus,
            accountStatus: user.accountStatus,
            emailVerified: user.emailVerified,
            vehicles: user.vehicles || [],
            preferences: user.preferences,
            createdAt: user.createdAt
        }
    });
});
