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

/**
 * Show user dashboard
 */
exports.showDashboard = asyncHandler(async (req, res) => {
    const now = new Date();
    
    console.log('📊 [Dashboard] Request from user:', req.user?._id);
    
    // Re-fetch user with complete data including vehicles and documents
    const user = await User.findById(req.user._id)
        .select('role vehicles documents verificationStatus profile email rating statistics')
        .lean();
    
    console.log('📊 [Dashboard] User fetched:', user ? {
        _id: user._id,
        email: user.email,
        role: user.role,
        vehiclesCount: user.vehicles?.length || 0,
        vehicles: user.vehicles?.map(v => ({ licensePlate: v.licensePlate, status: v.status }))
    } : 'NOT FOUND');
    
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
        
        console.log('📊 [Dashboard] Profile check:', { 
            role: user.role, 
            hasAnyVehicle, 
            hasApprovedVehicle,
            vehiclesArray: user.vehicles
        });
        
        if (!hasAnyVehicle) {
            console.log('📊 [Dashboard] ⚠️ Returning requiresProfileCompletion=true (no vehicles)');
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
            departureTime: { $gte: now },
            status: { $in: ['ACTIVE', 'IN_PROGRESS'] }
        })
        .populate('bookings.passenger', 'name profilePhoto rating')
        .sort({ departureTime: 1 })
        .limit(5);

        upcomingTrips = rides;

        // Calculate rider stats
        const totalRides = await Ride.countDocuments({ rider: user._id });
        const completedRides = await Ride.countDocuments({ 
            rider: user._id, 
            status: 'COMPLETED' 
        });
        const totalEarnings = await Booking.aggregate([
            {
                $lookup: {
                    from: 'rides',
                    localField: 'ride',
                    foreignField: '_id',
                    as: 'rideInfo'
                }
            },
            {
                $match: {
                    'rideInfo.rider': user._id,
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
            totalRides,
            completedRides,
            activeRides: totalRides - completedRides,
            totalEarnings: totalEarnings[0]?.total || 0,
            carbonSaved: user.statistics?.carbonSaved || 0,
            rating: user.rating?.overall || 0
        };
    } else {
        // Get passenger's upcoming bookings
        const bookings = await Booking.find({
            passenger: user._id,
            'journeyDetails.actualPickupTime': { $gte: now },
            status: { $in: ['CONFIRMED', 'IN_PROGRESS'] }
        })
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'name profilePhoto rating vehicles' }
        })
        .sort({ 'journeyDetails.actualPickupTime': 1 })
        .limit(5);

        upcomingTrips = bookings;

        // Calculate passenger stats
        const totalBookings = await Booking.countDocuments({ passenger: user._id });
        const completedBookings = await Booking.countDocuments({
            passenger: user._id,
            status: 'COMPLETED'
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
            activeBookings: totalBookings - completedBookings,
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
    console.log('📝 [Profile Update] Request:', { userId: req.user._id, body: req.body });
    
    const user = await User.findById(req.user._id);
    const { name, bio, preferences, profile, address, gender, phone } = req.body;

    // ============================================
    // NORMALIZE AND VALIDATE INPUT DATA
    // ============================================
    
    // Update basic info
    if (name) {
        if (typeof name !== 'string' || name.trim().length < 2) {
            throw new AppError('❌ Invalid Name: Name must be at least 2 characters long.', 400);
        }
        user.name = name.trim();
    }
    
    // Update phone number
    if (phone !== undefined) {
        user.phone = phone.trim();
        console.log('📱 [Profile Update] Phone updated to:', user.phone);
    }
    
    if (bio !== undefined) {
        if (typeof bio !== 'string') {
            throw new AppError('❌ Invalid Bio: Bio must be a string.', 400);
        }
        if (bio.length > 500) {
            throw new AppError(`📝 Bio Too Long: Your bio is ${bio.length} characters, but maximum is 500. Please shorten by ${bio.length - 500} characters.`, 400);
        }
        user.bio = bio.trim();
    }

    // ============================================
    // HANDLE PROFILE UPDATES WITH VALIDATION
    // ============================================
    if (profile) {
        let profileData = typeof profile === 'string' ? JSON.parse(profile) : profile;
        
        // Update the main name field if firstName/lastName are provided
        if (profileData.firstName || profileData.lastName) {
            const firstName = profileData.firstName || user.profile?.firstName || '';
            const lastName = profileData.lastName || user.profile?.lastName || '';
            user.name = `${firstName} ${lastName}`.trim();
        }
        
        // Normalize gender to uppercase enum values
        if (profileData.gender) {
            const genderUpper = profileData.gender.toUpperCase();
            const validGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
            
            if (!validGenders.includes(genderUpper)) {
                throw new AppError(
                    `👤 Invalid Gender: "${profileData.gender}" is not valid. Please select from: Male, Female, Other, or Prefer Not to Say.`,
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
        user.profile = {
            ...user.profile.toObject(),
            ...profileData
        };
    }

    // ============================================
    // HANDLE STANDALONE GENDER UPDATE
    // ============================================
    if (gender && !profile) {
        const genderUpper = gender.toUpperCase();
        const validGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
        
        if (!validGenders.includes(genderUpper)) {
            throw new AppError(
                `👤 Invalid Gender: "${gender}" is not valid. ✅ Valid options: Male, Female, Other, Prefer Not to Say.`,
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
            user.preferences = {
                ...user.preferences.toObject(),
                ...prefsData
            };
        } catch (e) {
            throw new AppError('❌ Invalid Preferences: Unable to parse preferences data.', 400);
        }
    }

    // ============================================
    // UPDATE PROFILE PHOTO
    // ============================================
    if (req.files && req.files.profilePhoto) {
        const photoPath = req.files.profilePhoto[0].path;
        if (!photoPath || !photoPath.match(/\.(jpg|jpeg|png|gif)$/i)) {
            throw new AppError('❌ Invalid Image: Profile photo must be JPG, PNG, or GIF format.', 400);
        }
        user.profilePhoto = photoPath;
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
        message: '✅ Profile updated successfully!',
        user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            profile: user.profile,
            profilePhoto: user.profilePhoto,
            bio: user.bio,
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

    const { type, make, model, year, registrationNumber, color, seatingCapacity } = req.body;

    // Validate required fields
    if (!type || !make || !model || !year || !registrationNumber || !seatingCapacity) {
        throw new AppError('All vehicle fields are required', 400);
    }

    // Validate field formats
    if (typeof type !== 'string' || type.trim().length === 0) {
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
    const cleanRegistrationNumber = registrationNumber.trim().toUpperCase();
    if (cleanRegistrationNumber.length === 0) {
        throw new AppError('Registration number is required', 400);
    }

    // Validate seating capacity
    const capacity = parseInt(seatingCapacity);
    if (isNaN(capacity) || capacity < 1 || capacity > 15) {
        throw new AppError('Seating capacity must be between 1 and 15', 400);
    }

    const vehicle = {
        type: type.trim(),
        make: make.trim(),
        model: model.trim(),
        year: vehicleYear,
        registrationNumber: cleanRegistrationNumber,
        color: color ? color.trim() : '',
        seatingCapacity: capacity,
        isVerified: false
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

    let trips, totalTrips;

    if (user.role === 'RIDER') {
        // For riders, fetch completed rides
        totalTrips = await Ride.countDocuments({
            rider: user._id,
            status: 'COMPLETED'
        });

        const rides = await Ride.find({
            rider: user._id,
            status: 'COMPLETED'
        })
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
                const vehicleType = vehicle?.type || 'SEDAN';
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
        // For passengers, fetch completed bookings
        totalTrips = await Booking.countDocuments({
            passenger: user._id,
            status: 'COMPLETED'
        });

        trips = await Booking.find({
            passenger: user._id,
            status: 'COMPLETED'
        })
        .populate({
            path: 'ride',
            populate: { path: 'rider', select: 'name profilePhoto rating vehicles' }
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
                    const vehicleType = vehicle?.type || 'SEDAN';
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
        });

        for (const booking of activeBookings) {
            booking.status = 'CANCELLED';
            booking.cancellationReason = 'Passenger deactivated account';
            await booking.save();

            // Notify rider
            await Notification.create({
                user: booking.ride.rider,
                type: 'BOOKING_CANCELLED',
                title: 'Booking Cancelled',
                message: `A passenger cancelled their booking because they deactivated their account.`,
                priority: 'MEDIUM'
            });
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
    console.log('📸 [Profile Picture] Upload request:', {
        userId: req.user._id,
        files: req.files,
        hasProfilePhoto: req.files?.profilePhoto ? 'yes' : 'no'
    });

    const user = await User.findById(req.user._id);

    if (!req.files || !req.files.profilePhoto) {
        console.log('❌ [Profile Picture] No file received');
        throw new AppError('Please upload a profile photo', 400);
    }

    const photoPath = req.files.profilePhoto[0].path;
    console.log('📸 [Profile Picture] File path:', photoPath);
    
    // Save to profile.photo (correct field in User model)
    if (!user.profile) {
        user.profile = {};
    }
    user.profile.photo = photoPath;
    await user.save();

    console.log('✅ [Profile Picture] Saved successfully:', user.profile.photo);

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
        relation: relationship,
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
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store OTP (in production, use Redis or similar with expiry)
    contact.verificationOtp = otp;
    contact.verificationOtpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    // Send OTP via SMS (mock for now)
    console.log(`[DEBUG] Verification OTP for ${contact.phone}: ${otp}`);

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

    // Check OTP (in development, accept any 6-digit code)
    if (process.env.NODE_ENV === 'development' || otp === contact.verificationOtp) {
        contact.verified = true;
        contact.verificationOtp = undefined;
        contact.verificationOtpExpiry = undefined;
        await user.save();

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

    const { type, make, model, year, registrationNumber, color, seatingCapacity } = req.body;

    if (type) vehicle.type = type.trim();
    if (make) vehicle.make = make.trim();
    if (model) vehicle.model = model.trim();
    if (year) vehicle.year = parseInt(year);
    if (registrationNumber) vehicle.registrationNumber = registrationNumber.trim().toUpperCase();
    if (color) vehicle.color = color.trim();
    if (seatingCapacity) vehicle.seatingCapacity = parseInt(seatingCapacity);

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
    user.password = Math.random().toString(36); // Invalidate password
    
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
    const user = req.user;
    
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
    const updateData = {
        $push: { vehicles: vehicleData }
    };
    
    // Update preferences if provided
    if (preferences) {
        updateData['preferences.booking.preferredCoRiderGender'] = preferences.preferredCoRiderGender || 'ANY';
        if (preferences.rideComfort) {
            updateData['preferences.rideComfort'] = {
                musicPreference: preferences.rideComfort.musicPreference || 'OPEN_TO_REQUESTS',
                smokingAllowed: preferences.rideComfort.smokingAllowed || false,
                petsAllowed: preferences.rideComfort.petsAllowed || false
            };
        }
    }
    
    // Update license info if provided
    if (license && license.number) {
        updateData['documents.driverLicense.number'] = license.number;
        updateData['documents.driverLicense.expiryDate'] = license.expiryDate;
        updateData['documents.driverLicense.status'] = 'PENDING';
    }
    
    // Update bio if provided
    if (bio) {
        updateData['profile.bio'] = bio;
    }
    
    const updatedUser = await User.findByIdAndUpdate(
        user._id,
        updateData,
        { new: true, runValidators: true }
    );
    
    res.status(200).json({
        success: true,
        message: 'Profile completed successfully. Please upload your documents.',
        redirectUrl: '/user/documents',
        user: {
            id: updatedUser._id,
            vehicles: updatedUser.vehicles,
            preferences: updatedUser.preferences
        }
    });
});

/**
 * ✅ UPLOAD VERIFICATION DOCUMENTS
 * Upload driver license, aadhar, RC, insurance, vehicle photos
 */
exports.uploadDocuments = asyncHandler(async (req, res) => {
    const user = req.user;
    
    if (user.role !== 'RIDER') {
        throw new AppError('Only riders can upload documents', 403);
    }
    
    if (!req.files || Object.keys(req.files).length === 0) {
        throw new AppError('No files uploaded', 400);
    }
    
    const updateData = {};
    
    // Handle driver license front
    if (req.files.driverLicenseFront) {
        const file = req.files.driverLicenseFront[0];
        updateData['documents.driverLicense.frontImage'] = file.path || file.filename;
        updateData['documents.driverLicense.status'] = 'PENDING';
    }
    
    // Handle driver license back
    if (req.files.driverLicenseBack) {
        const file = req.files.driverLicenseBack[0];
        updateData['documents.driverLicense.backImage'] = file.path || file.filename;
    }
    
    // Handle Aadhar card
    if (req.files.aadharCard) {
        const file = req.files.aadharCard[0];
        updateData['documents.governmentId.type'] = 'AADHAAR';
        updateData['documents.governmentId.frontImage'] = file.path || file.filename;
        updateData['documents.governmentId.status'] = 'PENDING';
    }
    
    // Handle RC Book (registration certificate)
    if (req.files.rcBook) {
        const file = req.files.rcBook[0];
        // Store RC in first vehicle's registration document
        if (user.vehicles && user.vehicles.length > 0) {
            updateData['vehicles.0.registrationDocument'] = file.path || file.filename;
            updateData['vehicles.0.status'] = 'PENDING';
        }
    }
    
    // Handle Insurance
    if (req.files.insurance) {
        const file = req.files.insurance[0];
        updateData['documents.insurance.document'] = file.path || file.filename;
        updateData['documents.insurance.status'] = 'PENDING';
    }
    
    // Handle vehicle photos (multiple)
    if (req.files.vehiclePhotos) {
        const photoPaths = req.files.vehiclePhotos.map(f => f.path || f.filename);
        if (user.vehicles && user.vehicles.length > 0) {
            updateData['vehicles.0.photos'] = photoPaths;
        }
    }
    
    // Update verification status to PENDING
    updateData['verificationStatus'] = 'PENDING';
    
    const updatedUser = await User.findByIdAndUpdate(
        user._id,
        updateData,
        { new: true }
    );
    
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
