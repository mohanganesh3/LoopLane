/**
 * User Controller
 * Handles user dashboard, profile management, emergency contacts, preferences
 */

const User = require('../models/User');
const Ride = require('../models/Ride');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Notification = require('../models/Notification');
const carbonCalculator = require('../utils/carbonCalculator');
const trustScoreCalculator = require('../utils/trustScoreCalculator');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const helpers = require('../utils/helpers');
const { sendEmail } = require('../config/email');

const VEHICLE_TYPE_ALIASES = {
    CAR: 'SEDAN',
    BIKE: 'MOTORCYCLE',
    SCOOTER: 'MOTORCYCLE'
};

const toPlainObject = (value) => {
    if (!value) return {};
    return typeof value.toObject === 'function' ? value.toObject() : value;
};

const mergeObjects = (base, updates) => ({
    ...toPlainObject(base),
    ...updates
});

const normalizeVehicleType = (value) => {
    if (!value) return undefined;

    const normalized = String(value).trim().toUpperCase();
    return VEHICLE_TYPE_ALIASES[normalized] || normalized;
};

const normalizeVehiclePayload = (payload = {}) => {
    const vehicleType = normalizeVehicleType(payload.vehicleType || payload.type);
    const licensePlate = payload.licensePlate || payload.registrationNumber || payload.vehicleNumber;
    const seats = payload.seats || payload.seatingCapacity || payload.capacity;

    return {
        vehicleType,
        make: payload.make ? String(payload.make).trim() : undefined,
        model: payload.model ? String(payload.model).trim() : undefined,
        year: payload.year !== undefined ? parseInt(payload.year, 10) : undefined,
        color: payload.color ? String(payload.color).trim() : undefined,
        licensePlate: licensePlate ? String(licensePlate).trim().toUpperCase() : undefined,
        seats: seats !== undefined ? parseInt(seats, 10) : undefined
    };
};

const preventConditionalProfileCaching = (req, res) => {
    // Authenticated profile payloads must always return fresh JSON, not 304 responses.
    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];

    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        Pragma: 'no-cache',
        Expires: '0',
        'Surrogate-Control': 'no-store'
    });
};

/**
 * Show user dashboard
 */
exports.showDashboard = asyncHandler(async (req, res) => {
    const now = new Date();


    // Re-fetch user with complete data including vehicles and documents
    const user = await User.findById(req.user._id)
        .select('role vehicles documents verificationStatus profile email rating statistics')
        .lean();

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found'
        });
    }

    // Check if RIDER needs to complete profile - return JSON for React frontend
    if (user.role === 'RIDER') {
        // Check if vehicles array is empty or doesn't exist OR no approved vehicles
        const hasApprovedVehicle = user.vehicles && user.vehicles.some(v => v.status === 'APPROVED');
        const hasAnyVehicle = user.vehicles && user.vehicles.length > 0;

        if (!hasAnyVehicle) {
            return res.json({
                success: true,
                requiresProfileCompletion: true,
                redirectUrl: '/complete-profile',
                message: 'Please complete your profile and add vehicle details'
            });
        }

        // Check if documents are not uploaded AND status is UNVERIFIED (not PENDING or VERIFIED)
        const hasLicense = user.documents?.driverLicense?.frontImage;
        const verificationPending = user.verificationStatus === 'PENDING' ||
            user.verificationStatus === 'UNDER_REVIEW' ||
            user.verificationStatus === 'VERIFIED';

        if (!hasLicense && !verificationPending) {
            return res.json({
                success: true,
                requiresDocuments: true,
                redirectUrl: '/user/documents',
                message: 'Please upload your driving license for verification'
            });
        }
    }

    // Get upcoming rides/bookings
    let upcomingTrips = [];
    let stats = {};

    if (user.role === 'RIDER') {
        // Get rider's upcoming rides
        const rides = await Ride.find({
            rider: user._id,
            'schedule.departureDateTime': { $gte: now },
            status: { $in: ['ACTIVE', 'IN_PROGRESS'] }
        })
            .populate({
                path: 'bookings',
                populate: {
                    path: 'passenger',
                    select: 'profile.firstName profile.lastName profile.photo rating'
                }
            })
            .sort({ 'schedule.departureDateTime': 1 })
            .limit(5);

        upcomingTrips = rides;

        // Calculate rider stats
        const totalRides = await Ride.countDocuments({ rider: user._id });
        const completedRides = await Ride.countDocuments({
            rider: user._id,
            status: 'COMPLETED'
        });
        const cancelledRides = await Ride.countDocuments({
            rider: user._id,
            status: 'CANCELLED'
        });
        const pendingBookings = await Booking.countDocuments({
            ride: { $in: await Ride.find({ rider: user._id }).distinct('_id') },
            status: 'PENDING'
        });
        const totalEarnings = await Booking.aggregate([
            {
                $match: {
                    rider: user._id,
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: { $ifNull: ['$payment.rideFare', '$payment.amount'] } }
                }
            }
        ]);

        stats = {
            totalRides,
            completedRides,
            cancelledRides,
            pendingBookings,
            activeRides: totalRides - completedRides - cancelledRides,
            totalEarnings: totalEarnings[0]?.total || 0,
            carbonSaved: user.statistics?.carbonSaved || 0,
            rating: user.rating?.overall || 0
        };
    } else {
        // Get passenger's upcoming bookings
        const bookings = await Booking.find({
            passenger: user._id,
            status: { $in: ['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING'] }
        })
            .populate({
                path: 'ride',
                populate: { path: 'rider', select: 'profile.firstName profile.lastName profile.photo rating vehicles' }
            })
            .sort({ createdAt: 1 });

        upcomingTrips = bookings
            .filter((booking) => booking.ride?.schedule?.departureDateTime && new Date(booking.ride.schedule.departureDateTime) >= now)
            .sort((a, b) => new Date(a.ride.schedule.departureDateTime) - new Date(b.ride.schedule.departureDateTime))
            .slice(0, 5);

        // Calculate passenger stats
        const totalBookings = await Booking.countDocuments({ passenger: user._id });
        const completedBookings = await Booking.countDocuments({
            passenger: user._id,
            status: 'COMPLETED'
        });
        const cancelledBookings = await Booking.countDocuments({
            passenger: user._id,
            status: 'CANCELLED'
        });
        const pendingBookingsCount = await Booking.countDocuments({
            passenger: user._id,
            status: 'PENDING'
        });
        const totalSpent = await Booking.aggregate([
            {
                $match: {
                    passenger: user._id,
                    status: 'COMPLETED'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$payment.amount' }
                }
            }
        ]);

        stats = {
            totalBookings,
            completedBookings,
            cancelledBookings,
            pendingBookings: pendingBookingsCount,
            activeBookings: totalBookings - completedBookings - cancelledBookings,
            totalSpent: totalSpent[0]?.total || 0,
            carbonSaved: user.statistics?.carbonSaved || 0,
            rating: user.rating?.overall || 0
        };
    }

    // Get carbon report using new method
    const carbonReport = await carbonCalculator.generateUserCarbonReport(user._id);

    res.json({
        success: true,
        user,
        upcomingTrips,
        stats,
        carbonReport
    });
});

/**
 * Show complete profile page (for riders after registration)
 */
exports.showCompleteProfilePage = asyncHandler(async (req, res) => {
    if (req.user.role !== 'RIDER') {
        return res.status(400).json({ success: false, message: 'Only riders need to complete profile', redirectUrl: '/dashboard' });
    }

    res.json({
        success: true,
        message: 'Complete profile page',
        user: req.user
    });
});

/**
 * Handle profile completion (for riders)
 */
exports.completeProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user.role !== 'RIDER') {
        throw new AppError('Only riders need to complete profile', 400);
    }

    const {
        vehicleType,
        make,
        model,
        year,
        color,
        licensePlate,
        capacity,
        acAvailable,
        genderPreference,
        musicPreference,
        smokingAllowed,
        petsAllowed,
        licenseNumber,
        licenseExpiry,
        bio
    } = req.body;

    // Add vehicle to vehicles array
    const vehicle = {
        vehicleType: vehicleType,
        make: make,
        model: model,
        year: parseInt(year),
        licensePlate: licensePlate.toUpperCase(),
        color: color,
        seats: parseInt(capacity),
        photos: [],
        isDefault: true,
        status: 'PENDING'
    };

    // Initialize vehicles array if it doesn't exist
    if (!user.vehicles) {
        user.vehicles = [];
    }

    // Add vehicle (or update if exists)
    if (user.vehicles.length === 0) {
        user.vehicles.push(vehicle);
    } else {
        // Update the first vehicle
        user.vehicles[0] = { ...user.vehicles[0], ...vehicle };
    }

    // Store license info in documents
    if (!user.documents.driverLicense) {
        user.documents.driverLicense = {};
    }
    user.documents.driverLicense.number = licenseNumber.toUpperCase();
    user.documents.driverLicense.expiryDate = new Date(licenseExpiry);

    // Update preferences (store at user level or in a preferences object)
    if (!user.preferences) {
        user.preferences = {};
    }

    user.preferences.genderPreference = genderPreference || 'ANY';
    user.preferences.musicPreference = musicPreference || 'OPEN_TO_REQUESTS';
    user.preferences.smokingAllowed = smokingAllowed === 'on';
    user.preferences.petsAllowed = petsAllowed === 'on';

    // Update bio
    if (bio) {
        user.profile.bio = bio;
    }

    // Verification is only needed for RIDERS, not PASSENGERS
    if (user.role === 'RIDER') {
        // Set verification status to PENDING (will be updated after document upload)
        user.verificationStatus = 'PENDING';
        await user.save();
        if (req.flash) req.flash('success', 'Profile completed successfully! Please upload your documents for verification.');
        res.redirect('/user/upload-documents');
    } else {
        // PASSENGERS don't need verification - auto-verify them
        user.verificationStatus = 'VERIFIED';
        await user.save();
        if (req.flash) req.flash('success', '✅ Profile completed successfully! You can now start booking rides.');
        res.redirect('/user/dashboard');
    }
});

/**
 * Show upload documents page
 */
exports.showUploadDocumentsPage = asyncHandler(async (req, res) => {
    if (req.user.role !== 'RIDER') {
        return res.status(400).json({ success: false, message: 'Only riders can upload documents', redirectUrl: '/dashboard' });
    }

    res.json({
        success: true,
        message: 'Upload documents page',
        user: req.user
    });
});

/**
 * Handle document upload (EJS legacy - redirects to new API handler)
 * @deprecated Use POST /user/documents/upload for React frontend
 */
exports.uploadDocumentsLegacy = asyncHandler(async (req, res) => {
    // Redirect legacy calls to the new API or handle EJS form submission
    if (req.accepts('json')) {
        // Forward to modern handler
        return exports.uploadDocumentsAPI(req, res);
    }

    // Legacy EJS handling
    const user = await User.findById(req.user._id);

    if (user.role !== 'RIDER') {
        if (req.flash) req.flash('error', 'Only riders can upload documents');
        return res.redirect('/user/dashboard');
    }

    if (!req.files || Object.keys(req.files).length === 0) {
        if (req.flash) req.flash('error', 'Please upload at least the required documents');
        return res.redirect('/user/upload-documents');
    }

    // Process files and update user
    await processDocumentUpload(user, req.files);

    if (req.flash) req.flash('success', 'Documents uploaded successfully! Admin will verify within 24-48 hours.');
    res.redirect('/user/dashboard');
});

/**
 * Show profile page
 */
exports.showProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
        .populate('emergencyContacts');

    // Get user's recent reviews
    const reviews = await Review.find({
        reviewee: user._id
    })
        .populate('reviewer', 'name profilePhoto')
        .sort({ createdAt: -1 })
        .limit(10);

    res.json({
        success: true,
        user,
        reviews
    });
});

/**
 * Get profile API (JSON response for frontend)
 * ✅ RESPECTS: Profile visibility preferences
 * ✅ CHECKS: Account suspension status
 */
exports.getProfileAPI = asyncHandler(async (req, res) => {
    preventConditionalProfileCaching(req, res);

    const user = await User.findById(req.user._id)
        .populate('emergencyContacts')
        .select('-password -resetPasswordToken -resetPasswordExpires');

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'User not found',
            forceLogout: true
        });
    }

    // Check if account is suspended
    if (user.accountStatus === 'SUSPENDED' || user.isSuspended) {
        return res.status(403).json({
            success: false,
            message: `Your account has been suspended. Reason: ${user.suspensionReason || 'Policy violation'}. Please check your email for details.`,
            accountSuspended: true,
            forceLogout: true
        });
    }

    // Check if account is deleted
    if (user.accountStatus === 'DELETED') {
        return res.status(403).json({
            success: false,
            message: 'This account has been deleted.',
            accountDeleted: true,
            forceLogout: true
        });
    }

    // Get user's recent reviews
    const reviews = await Review.find({
        reviewee: user._id
    })
        .populate('reviewer', 'name profilePhoto')
        .sort({ createdAt: -1 })
        .limit(10);

    res.status(200).json({
        success: true,
        user,
        reviews
    });
});

/**
 * Get public profile of another user
 * ✅ RESPECTS: Profile visibility preferences
 */
exports.getPublicProfile = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    const targetUser = await User.findById(userId)
        .select('profile rating statistics verificationStatus createdAt preferences.privacy.profileVisibility preferences.rideComfort');

    if (!targetUser) {
        throw new AppError('User not found', 404);
    }

    // ✅ CHECK PROFILE VISIBILITY
    const visibility = targetUser.preferences?.privacy?.profileVisibility || 'PUBLIC';

    if (visibility === 'PRIVATE') {
        // Check if there's a confirmed booking between these users
        const hasBookingRelation = await Booking.findOne({
            $or: [
                { passenger: req.user._id, rider: userId, status: { $in: ['CONFIRMED', 'COMPLETED'] } },
                { passenger: userId, rider: req.user._id, status: { $in: ['CONFIRMED', 'COMPLETED'] } }
            ]
        });

        if (!hasBookingRelation) {
            return res.status(200).json({
                success: true,
                user: {
                    _id: targetUser._id,
                    profile: {
                        firstName: targetUser.profile?.firstName,
                        photo: targetUser.profile?.photo
                    },
                    rating: targetUser.rating,
                    verificationStatus: targetUser.verificationStatus,
                    isPrivate: true,
                    message: 'This profile is private'
                }
            });
        }
    }

    if (visibility === 'VERIFIED_ONLY' && req.user.verificationStatus !== 'VERIFIED') {
        return res.status(200).json({
            success: true,
            user: {
                _id: targetUser._id,
                profile: {
                    firstName: targetUser.profile?.firstName,
                    photo: targetUser.profile?.photo
                },
                rating: targetUser.rating,
                verificationStatus: targetUser.verificationStatus,
                isRestricted: true,
                message: 'This profile is only visible to verified users'
            }
        });
    }

    // Get user's recent reviews
    const reviews = await Review.find({ reviewee: userId })
        .populate('reviewer', 'profile.firstName profile.photo')
        .sort({ createdAt: -1 })
        .limit(5);

    res.status(200).json({
        success: true,
        user: {
            _id: targetUser._id,
            profile: targetUser.profile,
            rating: targetUser.rating,
            statistics: targetUser.statistics,
            verificationStatus: targetUser.verificationStatus,
            createdAt: targetUser.createdAt,
            rideComfort: targetUser.preferences?.rideComfort
        },
        reviews
    });
});

/**
 * Get profile data (for SOS page and other components)
 */
exports.getProfileData = asyncHandler(async (req, res) => {
    preventConditionalProfileCaching(req, res);

    const user = await User.findById(req.user._id)
        .select('profile email phone emergencyContacts');

    res.status(200).json({
        success: true,
        profile: user.profile,
        email: user.email,
        phone: user.phone,
        emergencyContacts: user.emergencyContacts || []
    });
});

/**
 * Update profile with comprehensive validation and normalization
 */
exports.updateProfile = asyncHandler(async (req, res) => {

    const user = await User.findById(req.user._id);
    const { name, bio, preferences, profile, address, gender, phone } = req.body;

    if (!user.profile) {
        user.profile = {};
    }

    // ============================================
    // NORMALIZE AND VALIDATE INPUT DATA
    // ============================================

    // Update basic info
    if (name) {
        if (typeof name !== 'string' || name.trim().length < 2) {
            throw new AppError('Invalid Name: Name must be at least 2 characters long.', 400);
        }
        const [firstName, ...rest] = name.trim().split(/\s+/);
        user.profile.firstName = firstName;
        if (rest.length > 0) {
            user.profile.lastName = rest.join(' ');
        }
    }

    // Update phone number
    if (phone !== undefined) {
        user.phone = phone.trim();
    }

    if (bio !== undefined) {
        if (typeof bio !== 'string') {
            throw new AppError('Invalid Bio: Bio must be a string.', 400);
        }
        if (bio.length > 500) {
            throw new AppError(`Bio Too Long: Your bio is ${bio.length} characters, but maximum is 500. Please shorten by ${bio.length - 500} characters.`, 400);
        }
        user.profile.bio = bio.trim();
    }

    // ============================================
    // HANDLE PROFILE UPDATES WITH VALIDATION
    // ============================================
    if (profile) {
        let profileData = typeof profile === 'string' ? JSON.parse(profile) : profile;

        // Update the main name field if firstName/lastName are provided
        if (profileData.firstName || profileData.lastName) {
            profileData.firstName = profileData.firstName || user.profile?.firstName || '';
            profileData.lastName = profileData.lastName || user.profile?.lastName || '';
        }

        // Normalize gender to uppercase enum values
        if (profileData.gender) {
            const genderUpper = profileData.gender.toUpperCase();
            const validGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];

            if (!validGenders.includes(genderUpper)) {
                throw new AppError(
                    `Invalid Gender: "${profileData.gender}" is not valid. Please select from: Male, Female, Other, or Prefer Not to Say.`,
                    400
                );
            }
            profileData.gender = genderUpper;
        }

        // Handle address - convert string to object if needed
        if (profileData.address) {
            if (typeof profileData.address === 'string') {
                // Parse string address into structured format
                const addressStr = profileData.address.trim();
                profileData.address = {
                    street: addressStr,
                    city: '',
                    state: '',
                    zipCode: '',
                    country: 'India'
                };

                // Try to extract city/state from comma-separated string
                const parts = addressStr.split(',').map(p => p.trim()).filter(p => p);
                if (parts.length >= 2) {
                    profileData.address.street = parts.slice(0, -1).join(', ');
                    profileData.address.city = parts[parts.length - 1];
                }
            } else if (typeof profileData.address === 'object') {
                // Ensure all required address fields exist
                profileData.address = {
                    street: profileData.address.street || '',
                    city: profileData.address.city || '',
                    state: profileData.address.state || '',
                    zipCode: profileData.address.zipCode || '',
                    country: profileData.address.country || 'India'
                };
            }
        }

        // Merge with existing profile
        user.profile = mergeObjects(user.profile, profileData);
    }

    // ============================================
    // HANDLE STANDALONE GENDER UPDATE
    // ============================================
    if (gender && !profile) {
        const genderUpper = gender.toUpperCase();
        const validGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];

        if (!validGenders.includes(genderUpper)) {
            throw new AppError(
                `Invalid Gender: "${gender}" is not valid. Valid options: Male, Female, Other, Prefer Not to Say.`,
                400
            );
        }

        user.profile.gender = genderUpper;
    }

    // ============================================
    // HANDLE STANDALONE ADDRESS UPDATE
    // ============================================
    if (address && !profile) {
        if (typeof address === 'string') {
            const addressStr = address.trim();
            user.profile.address = {
                street: addressStr,
                city: '',
                state: '',
                zipCode: '',
                country: 'India'
            };

            // Try to parse comma-separated address
            const parts = addressStr.split(',').map(p => p.trim()).filter(p => p);
            if (parts.length >= 2) {
                user.profile.address.street = parts.slice(0, -1).join(', ');
                user.profile.address.city = parts[parts.length - 1];
            }
        } else if (typeof address === 'object') {
            user.profile.address = {
                street: address.street || '',
                city: address.city || '',
                state: address.state || '',
                zipCode: address.zipCode || '',
                country: address.country || 'India'
            };
        }
    }

    // ============================================
    // UPDATE PREFERENCES
    // ============================================
    if (preferences) {
        try {
            const prefsData = typeof preferences === 'string' ? JSON.parse(preferences) : preferences;
            user.preferences = mergeObjects(user.preferences, prefsData);
        } catch (e) {
            throw new AppError('Invalid Preferences: Unable to parse preferences data.', 400);
        }
    }

    // ============================================
    // UPDATE PROFILE PHOTO
    // ============================================
    if (req.files && req.files.profilePhoto) {
        const photoPath = req.files.profilePhoto[0].path;
        if (!photoPath || !photoPath.match(/\.(jpg|jpeg|png|gif)$/i)) {
            throw new AppError('Invalid Image: Profile photo must be JPG, PNG, or GIF format.', 400);
        }
        user.profile.photo = photoPath;
    }

    // ============================================
    // SAVE WITH ERROR HANDLING
    // ============================================
    try {
        await user.save();
    } catch (saveError) {
        console.error('Profile save error:', saveError);

        // Handle specific mongoose validation errors
        if (saveError.name === 'ValidationError') {
            const errorMessages = Object.values(saveError.errors).map(err => {
                if (err.kind === 'enum') {
                    return `❌ Invalid ${err.path}: "${err.value}" is not a valid option.`;
                }
                return err.message;
            });
            throw new AppError(`Validation Error: ${errorMessages.join(', ')}`, 400);
        }

        throw saveError;
    }

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        user: {
            _id: user._id,
            email: user.email,
            phone: user.phone,
            profile: user.profile,
            profilePhoto: user.profile?.photo,
            bio: user.profile?.bio,
            preferences: user.preferences
        }
    });
});

/**
 * Add emergency contact
 */
exports.addEmergencyContact = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { name, phone, relation } = req.body;

    if (user.emergencyContacts.length >= 3) {
        throw new AppError('Maximum 3 emergency contacts allowed', 400);
    }

    user.emergencyContacts.push({
        name,
        phone,
        relation
    });

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Emergency contact added',
        emergencyContacts: user.emergencyContacts
    });
});

/**
 * Remove emergency contact
 */
exports.removeEmergencyContact = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { contactId } = req.params;

    user.emergencyContacts.pull(contactId);
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Emergency contact removed',
        emergencyContacts: user.emergencyContacts
    });
});

/**
 * Add vehicle
 */
exports.addVehicle = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user.role !== 'RIDER') {
        throw new AppError('Only riders can add vehicles', 400);
    }

    const normalizedVehicle = normalizeVehiclePayload(req.body);
    const { vehicleType, make, model, year, licensePlate, color, seats } = normalizedVehicle;

    // Validate required fields
    if (!vehicleType || !make || !model || !year || !licensePlate || !seats) {
        throw new AppError('All vehicle fields are required', 400);
    }

    // Validate field formats
    if (typeof vehicleType !== 'string' || vehicleType.trim().length === 0) {
        throw new AppError('Vehicle type is required', 400);
    }

    if (typeof make !== 'string' || make.trim().length === 0) {
        throw new AppError('Vehicle make is required', 400);
    }

    if (typeof model !== 'string' || model.trim().length === 0) {
        throw new AppError('Vehicle model is required', 400);
    }

    // Validate year
    const vehicleYear = parseInt(year);
    const currentYear = new Date().getFullYear();
    if (isNaN(vehicleYear) || vehicleYear < 1900 || vehicleYear > currentYear + 1) {
        throw new AppError(`Year must be between 1900 and ${currentYear + 1}`, 400);
    }

    // Validate registration number
    if (licensePlate.length === 0) {
        throw new AppError('Registration number is required', 400);
    }

    // Validate seating capacity
    if (isNaN(seats) || seats < 1 || seats > 15) {
        throw new AppError('Seating capacity must be between 1 and 15', 400);
    }

    const existingVehicle = await User.findOne({
        _id: { $ne: user._id },
        'vehicles.licensePlate': licensePlate
    });

    if (existingVehicle) {
        throw new AppError('A vehicle with this registration number already exists', 400);
    }

    const vehicle = {
        vehicleType,
        make,
        model,
        year: vehicleYear,
        licensePlate,
        color: color || '',
        seats,
        isDefault: !user.vehicles || user.vehicles.length === 0,
        status: 'PENDING'
    };

    if (req.files && req.files.vehiclePhoto && req.files.vehiclePhoto.length > 0) {
        vehicle.photos = req.files.vehiclePhoto.map(file => file.path);
    }

    user.vehicles.push(vehicle);
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Vehicle added successfully',
        vehicles: user.vehicles
    });
});

/**
 * Remove vehicle
 */
exports.removeVehicle = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { vehicleId } = req.params;

    // Check if vehicle is being used in any active ride
    const activeRide = await Ride.findOne({
        rider: user._id,
        vehicle: vehicleId,
        status: { $in: ['ACTIVE', 'IN_PROGRESS'] }
    });

    if (activeRide) {
        throw new AppError('Cannot remove vehicle with active rides', 400);
    }

    user.vehicles.pull(vehicleId);
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Vehicle removed',
        vehicles: user.vehicles
    });
});

/**
 * Show trip history
 */
exports.showTripHistory = asyncHandler(async (req, res) => {
    const user = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    const statusFilter = req.query.status; // optional status filter
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;

    let trips, totalTrips;

    if (user.role === 'RIDER') {
        // For riders, fetch rides
        const rideQuery = { rider: user._id };
        if (statusFilter) {
            rideQuery.status = statusFilter;
        } else {
            rideQuery.status = 'COMPLETED';
        }

        // Date range filter
        if (dateFrom || dateTo) {
            rideQuery['schedule.departureDateTime'] = {};
            if (dateFrom) rideQuery['schedule.departureDateTime'].$gte = new Date(dateFrom);
            if (dateTo) rideQuery['schedule.departureDateTime'].$lte = new Date(dateTo + 'T23:59:59.999Z');
        }

        totalTrips = await Ride.countDocuments(rideQuery);

        const rides = await Ride.find(rideQuery)
            .populate({
                path: 'bookings',
                populate: {
                    path: 'passenger',
                    select: 'name profilePhoto rating'
                }
            })
            .sort({ 'schedule.departureDateTime': -1 })
            .skip(skip)
            .limit(limit);

        // Transform rides to include expected properties and carbon calculations
        trips = rides.map(ride => {
            const rideObj = ride.toObject();

            // Calculate carbon savings for this ride
            let carbonSaved = 0;
            const distance = rideObj.route?.distance || 0;
            const completedBookings = (rideObj.bookings || []).filter(b => b.status === 'COMPLETED');
            const totalPassengers = completedBookings.length;

            if (distance > 0 && totalPassengers > 0) {
                const vehicle = user.vehicles?.find(v => v._id.toString() === rideObj.vehicle?.toString());
                const vehicleType = vehicle?.vehicleType || vehicle?.type || 'SEDAN';
                const fuelType = vehicle?.fuelType || 'PETROL';

                const savings = carbonCalculator.calculateCarbonSaved(
                    distance,
                    vehicleType,
                    totalPassengers,
                    fuelType
                );
                carbonSaved = savings.totalSaved;
            }

            return {
                ...rideObj,
                // Map route.start to from for template compatibility
                from: {
                    address: rideObj.route?.start?.address || rideObj.route?.start?.name || 'Not available',
                    coordinates: rideObj.route?.start?.coordinates
                },
                // Map route.destination to to for template compatibility
                to: {
                    address: rideObj.route?.destination?.address || rideObj.route?.destination?.name || 'Not available',
                    coordinates: rideObj.route?.destination?.coordinates
                },
                distance: distance,
                departureTime: rideObj.schedule?.departureDateTime,
                totalEarnings: rideObj.pricing?.totalEarnings || 0,
                completedAt: rideObj.tracking?.completedAt || rideObj.updatedAt,
                carbonSaved: parseFloat(carbonSaved.toFixed(2))
            };
        });
    } else {
        // For passengers, fetch bookings
        const bookingQuery = { passenger: user._id };
        if (statusFilter) {
            const statusUpper = String(statusFilter).toUpperCase();

            if (statusUpper === 'COMPLETED') {
                bookingQuery.$or = [
                    { status: 'COMPLETED' },
                    {
                        status: 'DROPPED_OFF',
                        'payment.status': { $in: ['PAID', 'PAYMENT_CONFIRMED'] }
                    }
                ];
            } else if (statusUpper === 'IN_PROGRESS') {
                bookingQuery.status = { $in: ['PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING', 'DROPPED_OFF'] };
            } else if (statusUpper === 'CANCELLED') {
                bookingQuery.status = { $in: ['CANCELLED', 'REJECTED', 'EXPIRED'] };
            } else {
                bookingQuery.status = statusUpper;
            }
        } else {
            bookingQuery.status = 'COMPLETED';
        }

        // Date range filter
        if (dateFrom || dateTo) {
            bookingQuery.createdAt = {};
            if (dateFrom) bookingQuery.createdAt.$gte = new Date(dateFrom);
            if (dateTo) bookingQuery.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
        }

        totalTrips = await Booking.countDocuments(bookingQuery);

        trips = await Booking.find(bookingQuery)
            .populate({
                path: 'ride',
                populate: [
                    { path: 'rider', select: 'name profile profilePhoto rating vehicles' },
                    { path: 'bookings', select: 'status seatsBooked' }
                ]
            })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Transform bookings to include expected properties from ride and carbon calculations
        trips = trips.map(booking => {
            const bookingObj = booking.toObject();

            // Ensure totalAmount is available at top level
            if (!bookingObj.totalAmount && bookingObj.payment?.totalAmount) {
                bookingObj.totalAmount = bookingObj.payment.totalAmount;
            }

            // Add completion date
            bookingObj.completedAt = bookingObj.journey?.completedAt || bookingObj.updatedAt;

            // Calculate carbon savings for passenger
            let carbonSaved = 0;
            if (bookingObj.ride) {
                const distance = bookingObj.ride.route?.distance || 0;
                const totalPassengers = (bookingObj.ride.bookings || []).filter(b => b.status === 'COMPLETED').length;

                if (distance > 0 && totalPassengers > 0) {
                    const rider = bookingObj.ride.rider;
                    const vehicle = rider?.vehicles?.find(v => v._id.toString() === bookingObj.ride.vehicle?.toString());
                    const vehicleType = vehicle?.vehicleType || vehicle?.type || 'SEDAN';
                    const fuelType = vehicle?.fuelType || 'PETROL';

                    const savings = carbonCalculator.calculateCarbonSaved(
                        distance,
                        vehicleType,
                        totalPassengers,
                        fuelType
                    );
                    // Passenger's share of savings
                    carbonSaved = savings.savedPerPerson;
                }

                // Add ride data at booking level for easier access
                bookingObj.ride.from = {
                    address: bookingObj.ride.route?.start?.address || bookingObj.ride.route?.start?.name || 'Not available',
                    coordinates: bookingObj.ride.route?.start?.coordinates
                };
                bookingObj.ride.to = {
                    address: bookingObj.ride.route?.destination?.address || bookingObj.ride.route?.destination?.name || 'Not available',
                    coordinates: bookingObj.ride.route?.destination?.coordinates
                };
                bookingObj.ride.distance = bookingObj.ride.route?.distance;
                bookingObj.ride.departureTime = bookingObj.ride.schedule?.departureDateTime;
                bookingObj.ride.vehicle = bookingObj.ride.vehicle || null;
            }

            bookingObj.carbonSaved = parseFloat(carbonSaved.toFixed(2));
            return bookingObj;
        });
    }

    const pagination = helpers.paginate(totalTrips, page, limit);

    res.json({
        success: true,
        user,
        trips,
        pagination
    });
});

/**
 * Show notifications page
 */
exports.showNotifications = asyncHandler(async (req, res) => {
    res.json({
        success: true,
        message: 'Notifications page',
        user: req.user
    });
});

/**
 * Show settings page
 */
exports.showSettings = (req, res) => {
    res.json({
        success: true,
        message: 'Settings page',
        user: req.user
    });
};

/**
 * Update settings
 * ✅ HANDLES ALL PREFERENCE SETTINGS
 */
exports.updateSettings = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const {
        // Notification Preferences
        emailNotifications,
        pushNotifications,
        rideAlerts,
        // Privacy Settings
        shareLocation,
        profileVisibility,
        showPhone,
        showEmail,
        // Security
        twoFactorEnabled,
        // Ride Comfort Preferences
        musicPreference,
        smokingAllowed,
        petsAllowed,
        conversationPreference,
        // Booking Preferences
        instantBooking,
        verifiedUsersOnly,
        maxDetourKm,
        preferredCoRiderGender
    } = req.body;

    // ✅ UPDATE NOTIFICATION PREFERENCES
    if (!user.preferences) user.preferences = {};
    if (!user.preferences.notifications) user.preferences.notifications = {};

    if (emailNotifications !== undefined) {
        user.preferences.notifications.email = emailNotifications === 'true' || emailNotifications === true;
    }
    if (pushNotifications !== undefined) {
        user.preferences.notifications.push = pushNotifications === 'true' || pushNotifications === true;
    }
    if (rideAlerts !== undefined) {
        user.preferences.notifications.rideAlerts = rideAlerts === 'true' || rideAlerts === true;
    }

    // ✅ UPDATE PRIVACY SETTINGS
    if (!user.preferences.privacy) user.preferences.privacy = {};

    if (shareLocation !== undefined) {
        user.preferences.privacy.shareLocation = shareLocation === 'true' || shareLocation === true;
    }
    if (profileVisibility !== undefined) {
        const validVisibilities = ['PUBLIC', 'VERIFIED_ONLY', 'PRIVATE'];
        if (validVisibilities.includes(profileVisibility)) {
            user.preferences.privacy.profileVisibility = profileVisibility;
        }
    }
    if (showPhone !== undefined) {
        user.preferences.privacy.showPhone = showPhone === 'true' || showPhone === true;
    }
    if (showEmail !== undefined) {
        user.preferences.privacy.showEmail = showEmail === 'true' || showEmail === true;
    }

    // ✅ UPDATE SECURITY SETTINGS
    if (!user.preferences.security) user.preferences.security = {};

    if (twoFactorEnabled !== undefined) {
        user.preferences.security.twoFactorEnabled = twoFactorEnabled === 'true' || twoFactorEnabled === true;
    }

    // ✅ UPDATE RIDE COMFORT PREFERENCES
    if (!user.preferences.rideComfort) user.preferences.rideComfort = {};

    if (musicPreference !== undefined) {
        const validMusic = ['NO_MUSIC', 'SOFT_MUSIC', 'ANY_MUSIC', 'OPEN_TO_REQUESTS'];
        if (validMusic.includes(musicPreference)) {
            user.preferences.rideComfort.musicPreference = musicPreference;
        }
    }
    if (smokingAllowed !== undefined) {
        user.preferences.rideComfort.smokingAllowed = smokingAllowed === 'true' || smokingAllowed === true;
    }
    if (petsAllowed !== undefined) {
        user.preferences.rideComfort.petsAllowed = petsAllowed === 'true' || petsAllowed === true;
    }
    if (conversationPreference !== undefined) {
        const validConversation = ['QUIET', 'SOME_CHAT', 'CHATTY', 'DEPENDS_ON_MOOD'];
        if (validConversation.includes(conversationPreference)) {
            user.preferences.rideComfort.conversationPreference = conversationPreference;
        }
    }

    // ✅ UPDATE BOOKING PREFERENCES
    if (!user.preferences.booking) user.preferences.booking = {};

    if (instantBooking !== undefined) {
        user.preferences.booking.instantBooking = instantBooking === 'true' || instantBooking === true;
    }
    if (verifiedUsersOnly !== undefined) {
        user.preferences.booking.verifiedUsersOnly = verifiedUsersOnly === 'true' || verifiedUsersOnly === true;
    }
    if (maxDetourKm !== undefined) {
        const detour = parseFloat(maxDetourKm);
        if (!isNaN(detour) && detour >= 0 && detour <= 50) {
            user.preferences.booking.maxDetourKm = detour;
        }
    }
    if (preferredCoRiderGender !== undefined) {
        const validGenders = ['ANY', 'MALE_ONLY', 'FEMALE_ONLY', 'SAME_GENDER'];
        if (validGenders.includes(preferredCoRiderGender)) {
            user.preferences.booking.preferredCoRiderGender = preferredCoRiderGender;
        }
    }

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Settings updated successfully',
        preferences: user.preferences
    });
});

/**
 * Deactivate account (temporary - can be reactivated)
 */
exports.deactivateAccount = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { reason } = req.body;

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Check if already deactivated
    if (!user.isActive) {
        throw new AppError('Account is already deactivated', 400);
    }

    // Cancel active rides/bookings
    if (user.role === 'RIDER') {
        const activeRides = await Ride.find({
            rider: user._id,
            status: { $in: ['ACTIVE', 'IN_PROGRESS'] }
        });

        for (const ride of activeRides) {
            ride.status = 'CANCELLED';
            ride.cancellationReason = 'Rider deactivated account';
            await ride.save();

            // Notify passengers
            const bookings = await Booking.find({ ride: ride._id, status: { $in: ['CONFIRMED', 'PENDING'] } });
            for (const booking of bookings) {
                await Notification.create({
                    user: booking.passenger,
                    type: 'RIDE_CANCELLED',
                    title: 'Ride Cancelled',
                    message: `The ride you booked has been cancelled because the rider deactivated their account.`,
                    priority: 'HIGH'
                });
            }
        }
    } else {
        const activeBookings = await Booking.find({
            passenger: user._id,
            status: { $in: ['CONFIRMED', 'PENDING'] }
        }).populate('ride', 'rider');

        for (const booking of activeBookings) {
            booking.status = 'CANCELLED';
            booking.cancellationReason = 'Passenger deactivated account';
            await booking.save();

            // Notify rider (booking.ride is now populated)
            const riderId = booking.ride?.rider;
            if (riderId) {
                await Notification.create({
                    user: riderId,
                    type: 'BOOKING_CANCELLED',
                    title: 'Booking Cancelled',
                    message: `A passenger cancelled their booking because they deactivated their account.`,
                    priority: 'NORMAL'
                });
            }
        }
    }

    // Deactivate account
    user.isActive = false;
    user.accountStatus = 'INACTIVE';
    user.deactivatedAt = new Date();
    user.deactivationReason = reason || 'User requested';

    await user.save();

    // Send confirmation email
    if (user.email) {
        try {
            await sendEmail({
                to: user.email,
                subject: 'Account Deactivated - LANE Carpool',
                text: `Hi ${user.profile?.firstName || 'User'},\n\nYour account has been temporarily deactivated. You can reactivate it anytime by logging back in.\n\nIf you didn't request this, please contact support immediately.\n\nBest regards,\nLANE Carpool Team`,
                html: `
                    <h2>Account Deactivated</h2>
                    <p>Hi ${user.profile?.firstName || 'User'},</p>
                    <p>Your account has been temporarily deactivated. You can reactivate it anytime by logging back in.</p>
                    <p><strong>What happens next:</strong></p>
                    <ul>
                        <li>Your profile is hidden</li>
                        <li>Active rides/bookings have been cancelled</li>
                        <li>Your data is safely preserved</li>
                    </ul>
                    <p>If you didn't request this, please contact support immediately.</p>
                    <p>Best regards,<br>LANE Carpool Team</p>
                `
            });
        } catch (emailError) {
            console.error('Failed to send deactivation email:', emailError);
        }
    }

    // Clear auth cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({
        success: true,
        message: 'Account deactivated successfully. You can reactivate anytime by logging in.',
        redirectUrl: '/auth/login'
    });
});

/**
 * Reactivate account
 */
exports.reactivateAccount = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Check if already active
    if (user.isActive) {
        throw new AppError('Account is already active', 400);
    }

    // Reactivate account
    user.isActive = true;
    user.accountStatus = 'ACTIVE';
    user.reactivatedAt = new Date();

    await user.save();

    // Send confirmation email
    if (user.email) {
        try {
            await sendEmail({
                to: user.email,
                subject: 'Welcome Back! - LANE Carpool',
                text: `Hi ${user.profile?.firstName || 'User'},\n\nYour account has been reactivated. Welcome back to LANE Carpool!\n\nBest regards,\nLANE Carpool Team`,
                html: `
                    <h2>Welcome Back!</h2>
                    <p>Hi ${user.profile?.firstName || 'User'},</p>
                    <p>Your account has been successfully reactivated. Welcome back to LANE Carpool!</p>
                    <p>You can now:</p>
                    <ul>
                        <li>Create or book rides</li>
                        <li>Connect with other users</li>
                        <li>Access all your previous data</li>
                    </ul>
                    <p>Best regards,<br>LANE Carpool Team</p>
                `
            });
        } catch (emailError) {
            console.error('Failed to send reactivation email:', emailError);
        }
    }

    res.status(200).json({
        success: true,
        message: 'Account reactivated successfully. Welcome back!'
    });
});

/**
 * Update profile picture
 */
exports.updateProfilePicture = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (!req.files || !req.files.profilePhoto) {
        throw new AppError('Please upload a profile photo', 400);
    }

    const photoPath = req.files.profilePhoto[0].path;

    // Save to profile.photo (correct field in User model)
    if (!user.profile) {
        user.profile = {};
    }
    user.profile.photo = photoPath;
    await user.save();


    res.status(200).json({
        success: true,
        message: 'Profile picture updated successfully',
        profilePhoto: user.profile.photo
    });
});

/**
 * Change password
 */
exports.changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
        throw new AppError('All password fields are required', 400);
    }

    if (newPassword !== confirmPassword) {
        throw new AppError('New passwords do not match', 400);
    }

    if (newPassword.length < 6) {
        throw new AppError('Password must be at least 6 characters long', 400);
    }

    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
        throw new AppError('Current password is incorrect', 400);
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Password changed successfully'
    });
});

/**
 * Get carbon report
 */
exports.getCarbonReport = asyncHandler(async (req, res) => {
    const user = req.user;
    const report = await carbonCalculator.generateUserCarbonReport(user._id);

    res.status(200).json({
        success: true,
        report: {
            totalSaved: report.totalSaved || 0,
            totalTrips: report.totalTrips || 0,
            totalDistance: report.totalDistance || 0,
            passengersHelped: report.passengersHelped || 0
        }
    });
});

/**
 * Get emergency contacts list
 */
exports.getEmergencyContactsList = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    res.status(200).json({
        success: true,
        contacts: user.emergencyContacts || []
    });
});

/**
 * Add emergency contact (new version for React frontend)
 */
exports.addEmergencyContactNew = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { name, phone, relationship, email, isPrimary } = req.body;

    if (!name || !phone || !relationship) {
        throw new AppError('Name, phone, and relationship are required', 400);
    }

    if (user.emergencyContacts && user.emergencyContacts.length >= 5) {
        throw new AppError('Maximum 5 emergency contacts allowed', 400);
    }

    // If isPrimary, unset all other primary contacts
    if (isPrimary && user.emergencyContacts) {
        user.emergencyContacts.forEach(contact => {
            contact.isPrimary = false;
        });
    }

    const newContact = {
        name,
        phone,
        relationship: relationship,
        email: email || '',
        isPrimary: isPrimary || false,
        verified: false
    };

    if (!user.emergencyContacts) {
        user.emergencyContacts = [];
    }

    user.emergencyContacts.push(newContact);
    await user.save();

    // Get the newly added contact
    const addedContact = user.emergencyContacts[user.emergencyContacts.length - 1];

    res.status(200).json({
        success: true,
        message: 'Emergency contact added',
        contact: addedContact
    });
});

/**
 * Send verification OTP to emergency contact
 */
exports.sendContactVerification = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { contactId } = req.params;

    const contact = user.emergencyContacts.id(contactId);
    if (!contact) {
        throw new AppError('Contact not found', 404);
    }

    // Generate OTP
    const otp = require('crypto').randomInt(100000, 1000000).toString();

    // Store OTP in Redis (auto-expires in 10 minutes) or fall back to in-memory
    const { getRedisClient } = require('../config/redis');
    const redis = getRedisClient();
    const redisKey = `ec-otp:${req.user._id}:${contactId}`;

    if (redis) {
        await redis.set(redisKey, otp, 'EX', 600); // 10 min TTL
    } else {
        // Fallback: store on subdocument (development / no Redis)
        contact.verificationOtp = otp;
        contact.verificationOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();
    }

    // Send OTP via SMS (mock for now)

    // In production, use SMS service
    // await smsService.send(contact.phone, `Your LANE verification code: ${otp}`);

    res.status(200).json({
        success: true,
        message: 'Verification code sent'
    });
});

/**
 * Verify emergency contact with OTP
 */
exports.verifyEmergencyContact = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { contactId } = req.params;
    const { otp } = req.body;

    const contact = user.emergencyContacts.id(contactId);
    if (!contact) {
        throw new AppError('Contact not found', 404);
    }

    // Check OTP — try Redis first, fall back to subdocument field
    const { getRedisClient } = require('../config/redis');
    const redis = getRedisClient();
    const redisKey = `ec-otp:${req.user._id}:${contactId}`;
    let storedOtp = null;

    if (redis) {
        storedOtp = await redis.get(redisKey);
    } else {
        storedOtp = contact.verificationOtp;
    }

    if (process.env.NODE_ENV === 'development' || otp === storedOtp) {
        contact.verified = true;
        contact.verificationOtp = undefined;
        contact.verificationOtpExpiry = undefined;
        await user.save();

        // Clean up Redis key
        if (redis) await redis.del(redisKey);

        res.status(200).json({
            success: true,
            message: 'Contact verified successfully'
        });
    } else {
        throw new AppError('Invalid verification code', 400);
    }
});

/**
 * Set primary emergency contact
 */
exports.setPrimaryContact = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { contactId } = req.params;

    const contact = user.emergencyContacts.id(contactId);
    if (!contact) {
        throw new AppError('Contact not found', 404);
    }

    // Unset all other primary contacts
    user.emergencyContacts.forEach(c => {
        c.isPrimary = c._id.toString() === contactId;
    });

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Primary contact updated'
    });
});

/**
 * Upload driving license
 */
exports.uploadLicense = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { licenseNumber, licenseExpiry } = req.body;

    if (!req.files || (!req.files.licenseFront && !req.files.licenseBack)) {
        throw new AppError('Please upload license images', 400);
    }

    if (!user.documents) {
        user.documents = {};
    }
    if (!user.documents.driverLicense) {
        user.documents.driverLicense = {};
    }

    if (req.files.licenseFront) {
        user.documents.driverLicense.frontImage = req.files.licenseFront[0].path;
    }
    if (req.files.licenseBack) {
        user.documents.driverLicense.backImage = req.files.licenseBack[0].path;
    }
    if (licenseNumber) {
        user.documents.driverLicense.number = String(licenseNumber).trim().toUpperCase();
    }
    if (licenseExpiry) {
        user.documents.driverLicense.expiryDate = new Date(licenseExpiry);
    }

    user.documents.driverLicense.status = 'PENDING';
    user.verificationStatus = 'PENDING';
    await user.save();

    res.status(200).json({
        success: true,
        message: 'License uploaded successfully. Pending verification.',
        status: 'PENDING'
    });
});

/**
 * Get license verification status
 */
exports.getLicenseStatus = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    const status = user.documents?.driverLicense?.status || 'NOT_UPLOADED';
    const verificationStatus = user.verificationStatus || 'UNVERIFIED';

    res.status(200).json({
        success: true,
        status,
        verificationStatus,
        hasLicense: !!user.documents?.driverLicense?.frontImage
    });
});

/**
 * Get user vehicles
 */
exports.getVehicles = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    res.status(200).json({
        success: true,
        vehicles: user.vehicles || []
    });
});

/**
 * Update vehicle
 */
exports.updateVehicle = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { vehicleId } = req.params;

    const vehicle = user.vehicles.id(vehicleId);
    if (!vehicle) {
        throw new AppError('Vehicle not found', 404);
    }

    const normalizedVehicle = normalizeVehiclePayload(req.body);

    if (normalizedVehicle.licensePlate && normalizedVehicle.licensePlate !== vehicle.licensePlate) {
        const existingVehicle = await User.findOne({
            _id: { $ne: user._id },
            'vehicles.licensePlate': normalizedVehicle.licensePlate
        });

        if (existingVehicle) {
            throw new AppError('A vehicle with this registration number already exists', 400);
        }
    }

    if (normalizedVehicle.vehicleType) vehicle.vehicleType = normalizedVehicle.vehicleType;
    if (normalizedVehicle.make) vehicle.make = normalizedVehicle.make;
    if (normalizedVehicle.model) vehicle.model = normalizedVehicle.model;
    if (normalizedVehicle.year) vehicle.year = normalizedVehicle.year;
    if (normalizedVehicle.licensePlate) vehicle.licensePlate = normalizedVehicle.licensePlate;
    if (normalizedVehicle.color) vehicle.color = normalizedVehicle.color;
    if (normalizedVehicle.seats) vehicle.seats = normalizedVehicle.seats;

    if (req.files && req.files.vehiclePhoto && req.files.vehiclePhoto.length > 0) {
        vehicle.photos = req.files.vehiclePhoto.map(file => file.path);
    }

    await user.save();

    res.status(200).json({
        success: true,
        message: 'Vehicle updated successfully',
        vehicle
    });
});

/**
 * Delete account (permanent)
 */
exports.deleteAccount = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
    const { reason } = req.body;

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Check for active rides/bookings
    if (user.role === 'RIDER') {
        const activeRides = await Ride.countDocuments({
            rider: user._id,
            status: { $in: ['ACTIVE', 'IN_PROGRESS'] }
        });

        if (activeRides > 0) {
            throw new AppError(
                '❌ Cannot delete account with active rides. Please cancel all active rides first or contact support.',
                400
            );
        }
    } else {
        const activeBookings = await Booking.countDocuments({
            passenger: user._id,
            status: { $in: ['CONFIRMED', 'IN_PROGRESS'] }
        });

        if (activeBookings > 0) {
            throw new AppError(
                '❌ Cannot delete account with active bookings. Please cancel all active bookings first or contact support.',
                400
            );
        }
    }

    // Store user info for email before deletion
    const userEmail = user.email;
    const userName = user.profile?.firstName || 'User';

    // Soft delete - mark as deleted but keep data for legal/audit purposes
    user.accountStatus = 'DELETED';
    user.isActive = false;
    user.deletedAt = new Date();
    user.deletionReason = reason || 'User requested';

    // Anonymize sensitive data
    user.email = `deleted_${user._id}@deleted.com`;
    user.phone = `DELETED_${Date.now()}`;
    user.password = require('crypto').randomBytes(32).toString('hex'); // Cryptographically invalidate password

    await user.save();

    // Send farewell email before anonymization
    if (userEmail) {
        try {
            await sendEmail({
                to: userEmail,
                subject: 'Account Deleted - LANE Carpool',
                text: `Hi ${userName},\n\nYour account has been permanently deleted as requested.\n\nWe're sorry to see you go. Your data will be retained for legal purposes but anonymized.\n\nIf you change your mind, you can create a new account anytime.\n\nBest regards,\nLANE Carpool Team`,
                html: `
                    <h2>Account Deleted</h2>
                    <p>Hi ${userName},</p>
                    <p>Your account has been permanently deleted as requested.</p>
                    <p><strong>What was deleted:</strong></p>
                    <ul>
                        <li>Your profile and personal information</li>
                        <li>Access to all features</li>
                        <li>Your login credentials</li>
                    </ul>
                    <p><strong>Data Retention:</strong> Some anonymized data may be retained for legal and audit purposes.</p>
                    <p>We're sorry to see you go. If you change your mind, you can create a new account anytime.</p>
                    <p>Best regards,<br>LANE Carpool Team</p>
                `
            });
        } catch (emailError) {
            console.error('Failed to send deletion email:', emailError);
        }
    }

    // Clear auth cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    res.status(200).json({
        success: true,
        message: 'Account deleted successfully. We\'re sorry to see you go.',
        redirectUrl: '/'
    });
});

/**
 * ✅ GET TRUST SCORE
 * Calculate and return user's trust score with breakdown
 */
exports.getTrustScore = asyncHandler(async (req, res) => {
    const userId = req.params.userId || req.user._id;

    const trustScore = await trustScoreCalculator.calculateTrustScore(userId);

    if (!trustScore) {
        throw new AppError('User not found', 404);
    }

    res.status(200).json({
        success: true,
        trustScore
    });
});

/**
 * ✅ GET USER BADGES
 * Return all badges for a user
 */
exports.getUserBadges = asyncHandler(async (req, res) => {
    const userId = req.params.userId || req.user._id;

    const user = await User.findById(userId).select('badges verificationStatus createdAt role rating statistics');

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Calculate earned badges based on current user state
    const earnedBadges = [];

    // Add verification badges
    if (user.verificationStatus === 'VERIFIED') {
        earnedBadges.push('ID_VERIFIED');
    }

    // Email/Phone verified (we'll assume verified if they registered)
    earnedBadges.push('EMAIL_VERIFIED');
    earnedBadges.push('PHONE_VERIFIED');

    // Profile badges
    if (user.statistics?.completedRides >= 1) earnedBadges.push('FIRST_RIDE');
    if (user.statistics?.completedRides >= 10) earnedBadges.push('FREQUENT_RIDER');
    if (user.statistics?.carbonSaved >= 50) earnedBadges.push('ECO_WARRIOR');
    if (user.rating?.overall >= 4.8 && user.rating?.totalRatings >= 10) earnedBadges.push('FIVE_STAR_DRIVER');
    if (user.statistics?.completedRides >= 50 && user.rating?.overall >= 4.5) earnedBadges.push('SUPER_HOST');

    // Check if early adopter (within first year of platform launch)
    const launchDate = new Date('2024-01-01'); // Adjust this
    if (user.createdAt < new Date(launchDate.getTime() + 365 * 24 * 60 * 60 * 1000)) {
        earnedBadges.push('EARLY_ADOPTER');
    }

    // Get trust level
    const trustScore = await trustScoreCalculator.calculateTrustScore(userId);
    const trustLevel = trustScore?.level || 'NEWCOMER';

    // Available badges user can still earn
    const allBadges = [
        'EMAIL_VERIFIED', 'PHONE_VERIFIED', 'ID_VERIFIED', 'LICENSE_VERIFIED',
        'PROFILE_COMPLETE', 'FIRST_RIDE', 'FIVE_STAR_DRIVER', 'FREQUENT_RIDER',
        'ECO_WARRIOR', 'SUPER_HOST', 'EARLY_ADOPTER', 'COMMUNITY_HELPER'
    ];

    const availableBadges = allBadges.filter(b => !earnedBadges.includes(b));

    // Format member since
    const memberSince = user.createdAt.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long'
    });

    res.status(200).json({
        success: true,
        badges: {
            earnedBadges,
            availableBadges,
            trustLevel,
            memberSince,
            totalBadges: earnedBadges.length
        }
    });
});

/**
 * ✅ GET CONTRIBUTION CALCULATOR
 * BlaBlaCar-style cost sharing calculator
 */
exports.getContributionCalculator = asyncHandler(async (req, res) => {
    const { distanceKm, passengers = 1 } = req.query;

    if (!distanceKm) {
        throw new AppError('Distance is required', 400);
    }

    const distance = parseFloat(distanceKm);
    const numPassengers = Math.max(1, parseInt(passengers) || 1);

    // Fair Cost calculation parameters (BlaBlaCar-style)
    // Based on: Petrol ₹105/L ÷ 15 km/L mileage = ₹7/km fuel + ₹1/km maintenance = ₹8/km
    const PETROL_PRICE = 105;           // ₹ per litre (current average in India)
    const AVERAGE_MILEAGE = 15;         // km per litre (average car)
    const MAINTENANCE_PER_KM = 1;       // ₹ for wear & tear
    const RUNNING_COST_PER_KM = Math.round(PETROL_PRICE / AVERAGE_MILEAGE) + MAINTENANCE_PER_KM; // ≈ ₹8/km

    const totalTripCost = Math.round(distance * RUNNING_COST_PER_KM);
    const fuelCostOnly = Math.round(distance * (PETROL_PRICE / AVERAGE_MILEAGE));
    const maintenanceCost = Math.round(distance * MAINTENANCE_PER_KM);

    // Split between driver and passengers (BlaBlaCar model - driver shares the cost)
    const totalPeople = numPassengers + 1; // passengers + driver
    const suggestedPrice = Math.round(totalTripCost / totalPeople);

    // Calculate price range: Min 70%, Max 140% of suggested price
    const minPrice = Math.round(suggestedPrice * 0.7);
    const maxPrice = Math.round(suggestedPrice * 1.4);

    // Carbon savings calculation
    const CO2_PER_KM_CAR = 0.12; // kg CO2 per km for average car
    const carbonSaved = (distance * CO2_PER_KM_CAR * numPassengers).toFixed(2);

    res.status(200).json({
        success: true,
        calculation: {
            distanceKm: distance,
            passengers: numPassengers,
            // Cost breakdown
            petrolPrice: PETROL_PRICE,
            averageMileage: AVERAGE_MILEAGE,
            runningCostPerKm: RUNNING_COST_PER_KM,
            fuelCostPerKm: Math.round(PETROL_PRICE / AVERAGE_MILEAGE),
            maintenancePerKm: MAINTENANCE_PER_KM,
            // Trip costs
            fuelCost: fuelCostOnly,
            maintenanceCost: maintenanceCost,
            totalTripCost: totalTripCost,
            // Per seat pricing
            suggestedPrice,
            priceRange: {
                min: minPrice,
                max: maxPrice
            },
            // Environmental impact
            carbonSaved,
            // Info
            note: 'Fair cost-sharing: Petrol ₹105/L ÷ 15 km/L + ₹1 maintenance = ₹8/km. Split equally between driver and passengers.'
        }
    });
});

/**
 * ✅ CHECK AND AWARD BADGES
 * Check if user qualifies for any new badges
 */
exports.checkBadges = asyncHandler(async (req, res) => {
    const awardedBadges = await trustScoreCalculator.checkAndAwardBadges(req.user._id);

    res.status(200).json({
        success: true,
        awardedBadges,
        message: awardedBadges.length > 0
            ? `Congratulations! You earned ${awardedBadges.length} new badge(s)!`
            : 'No new badges at this time. Keep riding!'
    });
});

/**
 * ✅ GET RECOMMENDED PRICE
 * Calculate recommended price for a ride based on distance
 */
exports.getRecommendedPrice = asyncHandler(async (req, res) => {
    const { distanceKm, vehicleType } = req.query;

    if (!distanceKm) {
        throw new AppError('Distance is required', 400);
    }

    const pricing = trustScoreCalculator.calculateRecommendedPrice(
        parseFloat(distanceKm),
        vehicleType || 'SEDAN'
    );

    res.status(200).json({
        success: true,
        pricing
    });
});

/**
 * ✅ GET USER STATISTICS
 * Return detailed user statistics including trust score
 */
exports.getUserStats = asyncHandler(async (req, res) => {
    const userId = req.params.userId || req.user._id;

    const user = await User.findById(userId).select(
        'statistics rating trustScore badges cancellationRate responseMetrics createdAt'
    );

    if (!user) {
        throw new AppError('User not found', 404);
    }

    // Calculate trust score if needed
    let trustScore = user.trustScore;
    if (!trustScore?.score ||
        (Date.now() - new Date(trustScore?.lastCalculated).getTime()) > 24 * 60 * 60 * 1000) {
        // Recalculate if older than 24 hours
        trustScore = await trustScoreCalculator.calculateTrustScore(userId);
    }

    res.status(200).json({
        success: true,
        stats: {
            ...user.statistics?.toObject(),
            rating: user.rating,
            trustScore,
            badges: user.badges?.length || 0,
            cancellationRate: user.cancellationRate?.rate || 0,
            averageResponseTime: user.responseMetrics?.averageResponseTime || 0,
            quickResponder: user.responseMetrics?.quickResponder || false,
            memberSince: user.createdAt
        }
    });
});

/**
 * ✅ COMPLETE RIDER PROFILE
 * Add vehicle, preferences, and license info for riders
 */
exports.completeRiderProfile = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user.role !== 'RIDER') {
        throw new AppError('Only riders can complete this profile', 403);
    }

    const { vehicle, preferences, license, bio } = req.body;

    // Validate required vehicle fields
    if (!vehicle || !vehicle.make || !vehicle.model || !vehicle.licensePlate) {
        throw new AppError('Vehicle make, model, and license plate are required', 400);
    }

    // Check if license plate already exists for another user
    const existingVehicle = await User.findOne({
        _id: { $ne: user._id },
        'vehicles.licensePlate': vehicle.licensePlate.toUpperCase()
    });

    if (existingVehicle) {
        throw new AppError('This license plate is already registered to another user', 400);
    }

    // Create vehicle object
    const vehicleData = {
        vehicleType: vehicle.vehicleType || 'SEDAN',
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year || new Date().getFullYear(),
        color: vehicle.color || 'Unknown',
        licensePlate: vehicle.licensePlate.toUpperCase(),
        seats: vehicle.seats || 4,
        acAvailable: vehicle.acAvailable || false,
        isDefault: true,
        status: 'PENDING'
    };

    // Update user
    if (!user.vehicles) {
        user.vehicles = [];
    }

    const defaultVehicleIndex = user.vehicles.findIndex((existingVehicle) => existingVehicle.isDefault);
    if (defaultVehicleIndex >= 0) {
        user.vehicles[defaultVehicleIndex] = {
            ...toPlainObject(user.vehicles[defaultVehicleIndex]),
            ...vehicleData,
            isDefault: true
        };
    } else if (user.vehicles.length > 0) {
        user.vehicles[0] = {
            ...toPlainObject(user.vehicles[0]),
            ...vehicleData,
            isDefault: true
        };
    } else {
        user.vehicles.push(vehicleData);
    }

    user.preferences = mergeObjects(user.preferences, {});
    user.preferences.booking = mergeObjects(user.preferences.booking, {
        preferredCoRiderGender: preferences?.preferredCoRiderGender || 'ANY'
    });

    if (preferences?.rideComfort) {
        user.preferences.rideComfort = mergeObjects(user.preferences.rideComfort, {
            musicPreference: preferences.rideComfort.musicPreference || 'OPEN_TO_REQUESTS',
            smokingAllowed: preferences.rideComfort.smokingAllowed || false,
            petsAllowed: preferences.rideComfort.petsAllowed || false
        });
    }

    user.documents = mergeObjects(user.documents, {});
    user.documents.driverLicense = mergeObjects(user.documents.driverLicense, {});
    if (license && license.number) {
        user.documents.driverLicense.number = license.number;
        user.documents.driverLicense.expiryDate = license.expiryDate;
        user.documents.driverLicense.status = 'PENDING';
    }

    if (bio) {
        user.profile = mergeObjects(user.profile, { bio });
    }

    user.verificationStatus = 'PENDING';
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Profile completed successfully. Please upload your documents.',
        redirectUrl: '/user/documents',
        user: {
            id: user._id,
            vehicles: user.vehicles,
            preferences: user.preferences
        }
    });
});

/**
 * ✅ UPLOAD VERIFICATION DOCUMENTS
 * Upload driver license, aadhar, RC, insurance, vehicle photos
 */
exports.uploadDocuments = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);

    if (user.role !== 'RIDER') {
        throw new AppError('Only riders can upload documents', 403);
    }

    if (!req.files || Object.keys(req.files).length === 0) {
        throw new AppError('No files uploaded', 400);
    }

    const documents = mergeObjects(user.documents, {});
    const defaultVehicleIndex = user.vehicles?.findIndex((vehicle) => vehicle.isDefault) ?? -1;
    const targetVehicleIndex = defaultVehicleIndex >= 0 ? defaultVehicleIndex : ((user.vehicles?.length || 0) - 1);
    const targetVehicle = targetVehicleIndex >= 0 ? user.vehicles[targetVehicleIndex] : null;

    // Handle driver license front
    if (req.files.driverLicenseFront) {
        const file = req.files.driverLicenseFront[0];
        documents.driverLicense = mergeObjects(documents.driverLicense, {
            frontImage: file.path || file.filename,
            status: 'PENDING'
        });
    }

    // Handle driver license back
    if (req.files.driverLicenseBack) {
        const file = req.files.driverLicenseBack[0];
        documents.driverLicense = mergeObjects(documents.driverLicense, {
            backImage: file.path || file.filename
        });
    }

    // Handle Aadhar card
    if (req.files.aadharCard) {
        const file = req.files.aadharCard[0];
        documents.governmentId = mergeObjects(documents.governmentId, {
            type: 'AADHAAR',
            frontImage: file.path || file.filename,
            status: 'PENDING'
        });
    }

    // Handle RC Book (registration certificate)
    if (req.files.rcBook) {
        const file = req.files.rcBook[0];
        if (targetVehicle) {
            targetVehicle.registrationDocument = file.path || file.filename;
            targetVehicle.status = 'PENDING';
        }
    }

    // Handle Insurance
    if (req.files.insurance) {
        const file = req.files.insurance[0];
        documents.insurance = mergeObjects(documents.insurance, {
            document: file.path || file.filename,
            status: 'PENDING'
        });
    }

    // Handle vehicle photos (multiple)
    if (req.files.vehiclePhotos) {
        const photoPaths = req.files.vehiclePhotos.map(f => f.path || f.filename);
        if (targetVehicle) {
            targetVehicle.photos = photoPaths;
        }
    }

    user.documents = documents;
    user.verificationStatus = 'PENDING';
    await user.save();

    res.status(200).json({
        success: true,
        message: 'Documents uploaded successfully. Verification in progress.',
        verificationStatus: 'PENDING',
        documentsUploaded: Object.keys(req.files)
    });
});

/**
 * ✅ GET DOCUMENT VERIFICATION STATUS
 * Check status of all uploaded documents
 */
exports.getDocumentStatus = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select(
        'documents vehicles verificationStatus'
    );

    if (!user) {
        throw new AppError('User not found', 404);
    }

    const defaultVehicle = user.vehicles?.find(v => v.isDefault) || user.vehicles?.[0];

    res.status(200).json({
        success: true,
        overallStatus: user.verificationStatus,
        documents: {
            driverLicense: {
                uploaded: !!user.documents?.driverLicense?.frontImage,
                status: user.documents?.driverLicense?.status || 'NOT_UPLOADED',
                hasBackImage: !!user.documents?.driverLicense?.backImage
            },
            governmentId: {
                type: user.documents?.governmentId?.type || null,
                uploaded: !!user.documents?.governmentId?.frontImage,
                status: user.documents?.governmentId?.status || 'NOT_UPLOADED'
            },
            insurance: {
                uploaded: !!user.documents?.insurance?.document,
                status: user.documents?.insurance?.status || 'NOT_UPLOADED'
            },
            vehicle: {
                hasRC: !!defaultVehicle?.registrationDocument,
                hasPhotos: defaultVehicle?.photos?.length > 0,
                photoCount: defaultVehicle?.photos?.length || 0,
                status: defaultVehicle?.status || 'NOT_UPLOADED'
            }
        }
    });
});

// ============================================
// API FUNCTION ALIASES (for route compatibility)
// ============================================

// Alias for getDashboardData
exports.getDashboardData = exports.showDashboard;

// Alias for getProfile
exports.getProfile = exports.getProfileAPI;

// Alias for getTripHistory
exports.getTripHistory = exports.showTripHistory;

// Alias for getNotifications
exports.getNotifications = exports.showNotifications;

// Alias for getSettings
exports.getSettings = exports.showSettings;

// ============================================
// WALLET & EARNINGS
// ============================================

/**
 * Get wallet data (simulated)
 */
exports.getWallet = asyncHandler(async (req, res) => {
    const Transaction = require('../models/Transaction');

    // Get wallet transactions for this user (both as passenger spending and rider receiving)
    const walletTransactions = await Transaction.find({
        $or: [
            { passenger: req.user._id },
            { rider: req.user._id }
        ]
    })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();

    const mapped = walletTransactions.map(t => ({
        _id: t._id,
        type: t.passenger?.toString() === req.user._id.toString() ? 'DEBIT' : 'CREDIT',
        amount: t.amounts?.passengerPaid || t.amounts?.total || 0,
        description: t.description || (t.type === 'BOOKING_PAYMENT' ? 'Ride payment' : t.type),
        method: t.payment?.method || 'CASH',
        createdAt: t.createdAt
    }));

    const stats = req.user.statistics || {};

    res.json({
        success: true,
        wallet: {
            balance: 500, // Simulated starting balance
            totalAdded: 500,
            totalSpent: stats.totalSpent || 0
        },
        transactions: mapped
    });
});

/**
 * Add funds to wallet (simulated)
 */
exports.addWalletFunds = asyncHandler(async (req, res) => {
    const { amount } = req.body;
    if (!amount || amount < 100 || amount > 10000) {
        throw new AppError('Amount must be between ₹100 and ₹10,000', 400);
    }

    // In simulation mode, just acknowledge the addition
    res.json({
        success: true,
        message: `₹${amount} added to wallet (simulated)`,
        wallet: {
            balance: 500 + amount,
            totalAdded: 500 + amount
        }
    });
});

/**
 * Get rider earnings
 */
exports.getEarnings = asyncHandler(async (req, res) => {
    const Transaction = require('../models/Transaction');
    const { period } = req.query;

    let startDate = new Date();
    if (period === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
    else startDate.setMonth(startDate.getMonth() - 1); // default month

    const riderTransactions = await Transaction.find({
        rider: req.user._id,
        createdAt: { $gte: startDate }
    })
        .sort({ createdAt: -1 })
        .populate('booking', 'seatsBooked')
        .lean();

    const totalEarnings = riderTransactions.reduce((sum, t) => sum + (t.amounts?.rideFare || 0), 0);
    const totalCommission = riderTransactions.reduce((sum, t) => sum + (t.amounts?.platformCommission || 0), 0);
    const pendingPayout = riderTransactions
        .filter(t => !t.riderPayout?.settled)
        .reduce((sum, t) => sum + (t.amounts?.rideFare || 0), 0);

    const mapped = riderTransactions.map(t => ({
        _id: t._id,
        amount: t.amounts?.rideFare || 0,
        commission: t.amounts?.platformCommission || 0,
        passengers: t.booking?.seatsBooked || 1,
        description: t.description || 'Ride earnings',
        createdAt: t.createdAt
    }));

    res.json({
        success: true,
        earnings: {
            totalEarnings,
            netEarnings: totalEarnings - totalCommission,
            commission: totalCommission,
            pendingPayout,
            totalRides: riderTransactions.length,
            avgPerRide: riderTransactions.length > 0 ? Math.round(totalEarnings / riderTransactions.length) : 0
        },
        transactions: mapped
    });
});

/**
 * Get personalized route suggestions for drivers
 * Uses demand analysis to suggest high-demand routes
 */
exports.getRouteSuggestions = asyncHandler(async (req, res) => {
    if (req.user.role !== 'RIDER') {
        return res.json({ success: true, suggestions: [], message: 'Route suggestions are for drivers only' });
    }

    const { generateDriverSuggestions } = require('../utils/routeSuggestionEngine');
    const suggestions = await generateDriverSuggestions(req.user._id);

    res.json({
        success: true,
        suggestions,
        message: suggestions.length > 0
            ? `Found ${suggestions.length} high-demand routes for you`
            : 'No route suggestions available right now. Check back later!'
    });
});

// ============================================
// ROUTE ALERTS — "Notify me when a ride is posted"
// ============================================

/**
 * Get user's route alerts
 */
exports.getRouteAlerts = asyncHandler(async (req, res) => {
    const RouteAlert = require('../models/RouteAlert');

    const alerts = await RouteAlert.find({
        user: req.user._id,
        active: true,
        expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.json({
        success: true,
        alerts,
        count: alerts.length
    });
});

/**
 * Create a new route alert
 */
exports.createRouteAlert = asyncHandler(async (req, res) => {
    const RouteAlert = require('../models/RouteAlert');

    const { origin, destination, radiusKm, schedule, minSeats, maxPricePerSeat } = req.body;

    if (!origin?.address || !origin?.coordinates || !destination?.address || !destination?.coordinates) {
        throw new AppError('Origin and destination with coordinates are required', 400);
    }

    // Check if a similar alert already exists
    const existing = await RouteAlert.findOne({
        user: req.user._id,
        active: true,
        'origin.address': origin.address,
        'destination.address': destination.address
    });

    if (existing) {
        return res.status(200).json({
            success: true,
            message: 'You already have an alert for this route',
            alert: existing,
            duplicate: true
        });
    }

    // Limit to 10 active alerts per user
    const activeCount = await RouteAlert.countDocuments({
        user: req.user._id,
        active: true,
        expiresAt: { $gt: new Date() }
    });

    if (activeCount >= 10) {
        throw new AppError('Maximum 10 active route alerts allowed. Delete an old one first.', 400);
    }

    const alert = await RouteAlert.create({
        user: req.user._id,
        origin: {
            address: origin.address,
            coordinates: {
                type: 'Point',
                coordinates: origin.coordinates
            }
        },
        destination: {
            address: destination.address,
            coordinates: {
                type: 'Point',
                coordinates: destination.coordinates
            }
        },
        radiusKm: radiusKm || 5,
        schedule: schedule || {},
        minSeats: minSeats || 1,
        maxPricePerSeat: maxPricePerSeat || null
    });

    res.status(201).json({
        success: true,
        message: 'Route alert created! We\'ll notify you when a matching ride is posted.',
        alert
    });
});

/**
 * Delete a route alert
 */
exports.deleteRouteAlert = asyncHandler(async (req, res) => {
    const RouteAlert = require('../models/RouteAlert');

    const alert = await RouteAlert.findOneAndDelete({
        _id: req.params.alertId,
        user: req.user._id
    });

    if (!alert) {
        throw new AppError('Route alert not found', 404);
    }

    res.json({
        success: true,
        message: 'Route alert deleted'
    });
});

// ============================================================
// Promo Code Validation (User-Facing) — uses standalone PromoCode collection
// ============================================================
exports.validatePromoCode = asyncHandler(async (req, res) => {
    const PromoCode = require('../models/PromoCode');
    const { code, bookingAmount } = req.body;

    if (!code) {
        throw new AppError('Promo code is required', 400);
    }

    const promo = await PromoCode.findOne({ code: code.toUpperCase(), isActive: true }).lean();

    if (!promo) {
        return res.status(404).json({ success: false, message: 'Invalid promo code' });
    }

    // Check expiry
    if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        return res.status(400).json({ success: false, message: 'This promo code has expired' });
    }

    // Check usage limit
    if (promo.maxUses && promo.currentUses >= promo.maxUses) {
        return res.status(400).json({ success: false, message: 'This promo code has reached its usage limit' });
    }

    // Check minimum booking amount
    const amount = bookingAmount || 0;
    if (promo.minBookingAmount && amount < promo.minBookingAmount) {
        return res.status(400).json({
            success: false,
            message: `Minimum booking amount of ₹${promo.minBookingAmount} required`
        });
    }

    // Calculate discount
    let discountAmount = 0;
    if (promo.discountType === 'PERCENTAGE') {
        discountAmount = Math.round(amount * (promo.discountValue / 100));
    } else {
        discountAmount = promo.discountValue;
    }

    // NOTE: Usage is NOT incremented here — only during actual booking creation.
    // This endpoint only validates whether the code can be applied.

    res.json({
        success: true,
        message: `Promo code applied! ₹${discountAmount} discount`,
        discount: discountAmount,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        code: promo.code
    });
});
