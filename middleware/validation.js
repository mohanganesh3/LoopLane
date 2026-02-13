/**
 * Validation Middleware
 * Input validation using express-validator
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Handle validation errors with ultra-specific formatting
 */
exports.handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorArray = errors.array();
        
        // Enhanced logging with context
        console.log('\n' + '='.repeat(80));
        console.log('🚨 VALIDATION ERRORS DETECTED');
        console.log('='.repeat(80));
        console.log(`📍 Route: ${req.method} ${req.originalUrl}`);
        console.log(`👤 User: ${req.user ? req.user._id : 'Not authenticated'}`);
        console.log(`🕐 Time: ${new Date().toISOString()}`);
        console.log(`📊 Total Errors: ${errorArray.length}`);
        console.log('-'.repeat(80));
        
        errorArray.forEach((err, index) => {
            console.log(`\n❌ Error #${index + 1}:`);
            console.log(`   Field: ${err.param || err.path || 'unknown'}`);
            console.log(`   Location: ${err.location || 'body'}`);
            console.log(`   Value: ${JSON.stringify(err.value)}`);
            console.log(`   Message: ${err.msg}`);
        });
        
        console.log('\n' + '='.repeat(80) + '\n');
        
        // Check if JSON response is expected
        const expectsJson = req.xhr || 
                          req.headers.accept?.indexOf('json') > -1 || 
                          req.headers['content-type']?.indexOf('json') > -1 ||
                          req.is('json');
        
        if (expectsJson) {
            // Group errors by field for better structure
            const errorsByField = {};
            const generalErrors = [];
            
            errorArray.forEach(err => {
                const field = err.param || err.path || 'general';
                const errorMessage = err.msg;
                
                if (field === 'general' || !field) {
                    generalErrors.push(errorMessage);
                } else {
                    if (!errorsByField[field]) {
                        errorsByField[field] = [];
                    }
                    errorsByField[field].push(errorMessage);
                }
            });
            
            // Create a user-friendly summary message
            let summaryMessage = '';
            
            // If single error, show it directly
            if (errorArray.length === 1) {
                summaryMessage = errorArray[0].msg;
            } else {
                // Multiple errors - create a clear list
                summaryMessage = '⚠️ Please fix the following:\n\n';
                
                if (Object.keys(errorsByField).length > 0) {
                    Object.entries(errorsByField).forEach(([field, msgs]) => {
                        const fieldName = field
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, str => str.toUpperCase())
                            .trim();
                        summaryMessage += `• ${fieldName}: ${msgs[0]}\n`;
                    });
                }
                
                if (generalErrors.length > 0) {
                    generalErrors.forEach(msg => {
                        summaryMessage += `• ${msg}\n`;
                    });
                }
            }
            
            return res.status(400).json({
                success: false,
                message: summaryMessage.trim(),
                errors: errorArray,
                errorsByField,
                totalErrors: errorArray.length,
                timestamp: new Date().toISOString(),
                requestId: req.id || Math.random().toString(36).substring(7)
            });
        }
        
        // Fallback for non-JSON form submissions
        if (req.flash) {
            const errorMessages = errorArray.map(err => err.msg);
            errorMessages.forEach(msg => req.flash('error', msg));
        }
        
        // Redirect back to the form
        return res.redirect('back');
    }
    
    next();
};

/**
 * Registration validation rules
 */
exports.validateRegistration = [
    body('email')
        .trim()
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('phone')
        .trim()
        .matches(/^[0-9]{10}$/)
        .withMessage('Please provide a valid 10-digit phone number'),
    
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    
    body('confirmPassword')
        .custom((value, { req }) => value === req.body.password)
        .withMessage('Passwords do not match'),
    
    body('name')
        .trim()
        .isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
        .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters'),
    
    body('role')
        .optional()
        .isIn(['RIDER', 'PASSENGER']).withMessage('Invalid role selected')
];

/**
 * Login validation rules
 */
exports.validateLogin = [
    body('email')
        .trim()
        .isEmail().withMessage('Please provide a valid email')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required')
];

/**
 * OTP validation rules
 */
exports.validateOTP = [
    body('otp')
        .trim()
        .isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits')
        .isNumeric().withMessage('OTP must contain only numbers')
];

/**
 * Ride posting validation rules
 */
exports.validateRidePost = [
    body('fromLocation')
        .notEmpty().withMessage('Pick-up location is required'),
    
    body('toLocation')
        .notEmpty().withMessage('Drop-off location is required'),
    
    body('originCoordinates')
        .notEmpty().withMessage('Origin coordinates are required')
        .custom((value) => {
            if (typeof value === 'string') {
                try {
                    JSON.parse(value);
                    return true;
                } catch (e) {
                    return false;
                }
            }
            return value && value.coordinates && value.coordinates.length === 2;
        }).withMessage('Invalid origin coordinates'),
    
    body('destinationCoordinates')
        .notEmpty().withMessage('Destination coordinates are required')
        .custom((value) => {
            if (typeof value === 'string') {
                try {
                    JSON.parse(value);
                    return true;
                } catch (e) {
                    return false;
                }
            }
            return value && value.coordinates && value.coordinates.length === 2;
        }).withMessage('Invalid destination coordinates'),
    
    body('departureTime')
        .notEmpty().withMessage('Departure time is required')
        .custom((value) => {
            const rideDate = new Date(value);
            const now = new Date();
            return rideDate >= now;
        }).withMessage('Departure time cannot be in the past'),
    
    body('pricePerSeat')
        .isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    
    body('availableSeats')
        .isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
    
    body('vehicleId')
        .notEmpty().withMessage('Please select a vehicle')
];

/**
 * Ride update validation rules
 */
exports.validateRideUpdate = [
    body('departureTime')
        .optional()
        .isISO8601().withMessage('Invalid departure time format'),
    
    body('date')
        .optional()
        .isISO8601().withMessage('Invalid date format')
        .custom((value) => {
            const rideDate = new Date(value);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return rideDate >= today;
        }).withMessage('Ride date cannot be in the past'),
    
    body('time')
        .optional()
        .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format'),
    
    body('pricePerSeat')
        .optional()
        .isFloat({ min: 1 }).withMessage('Price must be at least ₹1'),
    
    body('availableSeats')
        .optional()
        .isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
    
    body('totalSeats')
        .optional()
        .isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
    
    body('preferences')
        .optional()
        .custom((value) => {
            if (typeof value === 'string') {
                try {
                    JSON.parse(value);
                    return true;
                } catch (e) {
                    return false;
                }
            }
            return typeof value === 'object';
        }).withMessage('Invalid preferences format')
];

/**
 * Booking validation rules
 */
exports.validateBooking = [
    // rideId comes from URL params, not body - validate it there
    param('rideId')
        .notEmpty().withMessage('Ride ID is required')
        .isMongoId().withMessage('Invalid ride ID'),
    
    // Accept both 'seats' and 'seatsBooked' field names
    body('seatsBooked')
        .optional()
        .isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
    body('seats')
        .optional()
        .isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
    
    body('pickupLocation')
        .optional()
        .custom((value) => {
            if (!value) return true;
            try {
                const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                // Coordinates are optional - backend will use ride's coordinates as fallback
                return true;
            } catch (error) {
                throw new Error('Invalid pickup location JSON');
            }
        }),
    
    body('dropoffLocation')
        .optional()
        .custom((value) => {
            if (!value) return true;
            try {
                const parsed = typeof value === 'string' ? JSON.parse(value) : value;
                // Coordinates are optional - backend will use ride's coordinates as fallback
                return true;
            } catch (error) {
                throw new Error('Invalid dropoff location JSON');
            }
        }),
    
    body('paymentMethod')
        .optional()
        .isIn(['CASH', 'UPI', 'CARD']).withMessage('Invalid payment method')
];

/**
 * Review validation rules (aligned with Review schema and controller)
 * ULTRA-SPECIFIC validation with detailed user-friendly error messages
 */
exports.validateReview = [
    // ============================================
    // BOOKING ID VALIDATION (Route Parameter)
    // ============================================
    param('bookingId')
        .exists().withMessage('❌ Critical Error: Booking ID is missing from the request URL. Please refresh the page and try again.')
        .notEmpty().withMessage('❌ Booking ID cannot be empty. This might be a technical issue - please contact support if this persists.')
        .isMongoId().withMessage('❌ Invalid Booking ID Format: The booking ID provided is not in the correct format. It should be a 24-character hexadecimal string. Please refresh the page and try again.')
        .isLength({ min: 24, max: 24 }).withMessage('❌ Booking ID Length Error: The booking ID must be exactly 24 characters long. The provided ID has an incorrect length.'),

    // ============================================
    // REVIEWEE ID VALIDATION (Who is being reviewed)
    // ============================================
    body('revieweeId')
        .exists().withMessage('❌ Reviewee ID Missing: We couldn\'t identify who you\'re reviewing. This is a technical error. Please refresh the page and try again.')
        .notEmpty().withMessage('❌ Reviewee ID is Empty: The system couldn\'t determine whether you\'re reviewing the driver or passenger. Please reload the page.')
        .isMongoId().withMessage('❌ Invalid Reviewee ID Format: The person you\'re trying to review has an invalid ID format. This shouldn\'t happen - please contact support.')
        .isLength({ min: 24, max: 24 }).withMessage('❌ Reviewee ID Length Error: The reviewee\'s ID must be exactly 24 characters. System detected an incorrect ID length.')
        .custom((value, { req }) => {
            // Additional validation: ensure revieweeId is not the same as the reviewer
            if (req.user && value === req.user._id.toString()) {
                throw new Error('❌ Self-Review Not Allowed: You cannot review yourself. Please ensure you\'re reviewing the correct person (driver or passenger).');
            }
            return true;
        }),

    // ============================================
    // OVERALL RATING VALIDATION (Required 1-5 stars)
    // ============================================
    body('rating')
        .exists().withMessage('⭐ Rating Required: Please select a star rating before submitting your review. Click on the stars above to rate your experience from 1 to 5 stars.')
        .notEmpty().withMessage('⭐ Rating Cannot Be Empty: You must select at least 1 star to submit a review. Please rate your experience by clicking on the stars.')
        .custom((val, { req }) => {
            // Check if value exists and is not zero
            if (val === 0 || val === '0') {
                throw new Error('⭐ Zero Stars Not Allowed: Please select at least 1 star. If you had a very poor experience, select 1 star and explain in your comment.');
            }
            
            // Check if it's a valid number
            const n = Number(val);
            if (isNaN(n)) {
                throw new Error(`⭐ Invalid Rating Format: The rating "${val}" is not a valid number. Please select a star rating from 1 to 5 stars.`);
            }
            
            if (!Number.isFinite(n)) {
                throw new Error('⭐ Invalid Rating Value: The rating must be a finite number between 1 and 5. Please select stars from 1 to 5.');
            }
            
            // Check range with specific messages
            if (n < 1) {
                throw new Error(`⭐ Rating Too Low: You entered ${n} stars, but the minimum is 1 star. Please select between 1 and 5 stars.`);
            }
            
            if (n > 5) {
                throw new Error(`⭐ Rating Too High: You entered ${n} stars, but the maximum is 5 stars. Please select between 1 and 5 stars.`);
            }
            
            // Check if it's a reasonable decimal (no weird values like 3.7777777)
            const decimalPlaces = (n.toString().split('.')[1] || '').length;
            if (decimalPlaces > 1) {
                throw new Error(`⭐ Rating Precision Error: Rating ${n} has too many decimal places. Please select whole star values (1, 2, 3, 4, or 5) or half stars (1.5, 2.5, etc).`);
            }
            
            return true;
        }),

    // ============================================
    // PUNCTUALITY RATING (Optional 1-5)
    // ============================================
    body('punctuality')
        .optional({ nullable: true, checkFalsy: true })
        .custom((val, { req }) => {
            if (val === undefined || val === null || val === '') return true;
            
            const n = Number(val);
            
            if (isNaN(n)) {
                throw new Error(`⏰ Invalid Punctuality Rating: "${val}" is not a valid number. Punctuality rating must be between 1 and 5 stars, or leave it empty.`);
            }
            
            if (!Number.isFinite(n)) {
                throw new Error('⏰ Punctuality Rating Error: The punctuality rating must be a finite number between 1 and 5.');
            }
            
            if (n < 1) {
                throw new Error(`⏰ Punctuality Rating Too Low: You entered ${n}, but the minimum is 1 star. Rate punctuality from 1 to 5 stars, or leave it empty.`);
            }
            
            if (n > 5) {
                throw new Error(`⏰ Punctuality Rating Too High: You entered ${n}, but the maximum is 5 stars. Rate punctuality from 1 to 5 stars.`);
            }
            
            return true;
        }),

    // ============================================
    // COMMUNICATION RATING (Optional 1-5)
    // ============================================
    body('communication')
        .optional({ nullable: true, checkFalsy: true })
        .custom((val, { req }) => {
            if (val === undefined || val === null || val === '') return true;
            
            const n = Number(val);
            
            if (isNaN(n)) {
                throw new Error(`💬 Invalid Communication Rating: "${val}" is not a valid number. Communication rating must be between 1 and 5 stars, or leave it empty.`);
            }
            
            if (!Number.isFinite(n)) {
                throw new Error('💬 Communication Rating Error: The communication rating must be a finite number between 1 and 5.');
            }
            
            if (n < 1) {
                throw new Error(`💬 Communication Rating Too Low: You entered ${n}, but the minimum is 1 star. Rate communication from 1 to 5 stars, or leave it empty.`);
            }
            
            if (n > 5) {
                throw new Error(`💬 Communication Rating Too High: You entered ${n}, but the maximum is 5 stars. Rate communication from 1 to 5 stars.`);
            }
            
            return true;
        }),

    // ============================================
    // CLEANLINESS RATING (Optional 1-5, for drivers)
    // ============================================
    body('cleanliness')
        .optional({ nullable: true, checkFalsy: true })
        .custom((val, { req }) => {
            if (val === undefined || val === null || val === '') return true;
            
            const n = Number(val);
            
            if (isNaN(n)) {
                throw new Error(`✨ Invalid Cleanliness Rating: "${val}" is not a valid number. Cleanliness rating must be between 1 and 5 stars, or leave it empty.`);
            }
            
            if (!Number.isFinite(n)) {
                throw new Error('✨ Cleanliness Rating Error: The cleanliness rating must be a finite number between 1 and 5.');
            }
            
            if (n < 1) {
                throw new Error(`✨ Cleanliness Rating Too Low: You entered ${n}, but the minimum is 1 star. Rate vehicle cleanliness from 1 to 5 stars, or leave it empty.`);
            }
            
            if (n > 5) {
                throw new Error(`✨ Cleanliness Rating Too High: You entered ${n}, but the maximum is 5 stars. Rate vehicle cleanliness from 1 to 5 stars.`);
            }
            
            return true;
        }),

    // ============================================
    // DRIVING RATING (Optional 1-5, for drivers)
    // ============================================
    body('driving')
        .optional({ nullable: true, checkFalsy: true })
        .custom((val, { req }) => {
            if (val === undefined || val === null || val === '') return true;
            
            const n = Number(val);
            
            if (isNaN(n)) {
                throw new Error(`🚗 Invalid Driving Rating: "${val}" is not a valid number. Driving rating must be between 1 and 5 stars, or leave it empty.`);
            }
            
            if (!Number.isFinite(n)) {
                throw new Error('🚗 Driving Rating Error: The driving rating must be a finite number between 1 and 5.');
            }
            
            if (n < 1) {
                throw new Error(`🚗 Driving Rating Too Low: You entered ${n}, but the minimum is 1 star. Rate driving quality from 1 to 5 stars, or leave it empty.`);
            }
            
            if (n > 5) {
                throw new Error(`🚗 Driving Rating Too High: You entered ${n}, but the maximum is 5 stars. Rate driving quality from 1 to 5 stars.`);
            }
            
            return true;
        }),

    // ============================================
    // TAGS VALIDATION (Optional array of predefined tags)
    // ============================================
    body('tags')
        .optional({ nullable: true, checkFalsy: true })
        .customSanitizer((value, { req }) => {
            // If empty/null/undefined, return empty array
            if (!value) return [];
            
            try {
                let arr = value;
                
                // Parse if it's a JSON string
                if (typeof value === 'string') {
                    // Check for common JSON errors before parsing
                    if (value.trim() === '') return [];
                    
                    try {
                        arr = JSON.parse(value);
                    } catch (parseError) {
                        // Store the error for the validator to catch
                        req._tagParseError = `🏷️ Tag Format Error: Unable to parse tags. Received invalid JSON: "${value.substring(0, 50)}${value.length > 50 ? '...' : ''}". Error: ${parseError.message}`;
                        return null; // Signal error
                    }
                }
                
                // Check if it's an array
                if (!Array.isArray(arr)) {
                    req._tagParseError = `🏷️ Tags Must Be An Array: Expected an array of tags, but received ${typeof arr}. Example: ["FRIENDLY", "ON_TIME"]`;
                    return null;
                }
                
                // Check array length limits
                if (arr.length > 20) {
                    req._tagParseError = `🏷️ Too Many Tags: You selected ${arr.length} tags, but the maximum is 20 tags. Please select only the most relevant tags.`;
                    return null;
                }
                
                // Filter and normalize tags
                const normalized = arr
                    .filter(t => {
                        if (typeof t !== 'string') {
                            req._tagWarning = `🏷️ Tag Type Warning: Ignoring non-string tag value: ${JSON.stringify(t)}`;
                            return false;
                        }
                        if (t.trim() === '') {
                            return false;
                        }
                        if (t.length > 50) {
                            req._tagWarning = `🏷️ Tag Too Long: Ignoring tag "${t.substring(0, 30)}..." as it exceeds 50 characters.`;
                            return false;
                        }
                        return true;
                    })
                    .map(t => t.toUpperCase().replace(/\s+/g, '_'));
                
                return normalized;
            } catch (e) {
                req._tagParseError = `🏷️ Unexpected Tag Processing Error: ${e.message}`;
                return null;
            }
        })
        .custom((arr, { req }) => {
            // Check for parsing errors
            if (req._tagParseError) {
                throw new Error(req._tagParseError);
            }
            
            // If array is null (from sanitizer error), fail
            if (arr === null) {
                throw new Error('🏷️ Tag Validation Failed: Unable to process tags.');
            }
            
            // Allow empty array
            if (!arr || arr.length === 0) return true;
            
            // Define allowed tags with user-friendly names for error messages
            const ALLOWED_TAGS = {
                'GREAT_CONVERSATION': 'Great Conversation',
                'SMOOTH_DRIVER': 'Smooth Driver',
                'CLEAN_CAR': 'Clean Car',
                'ON_TIME': 'On Time',
                'SAFE_DRIVER': 'Safe Driver',
                'FLEXIBLE': 'Flexible',
                'FRIENDLY': 'Friendly',
                'RESPECTFUL': 'Respectful',
                'QUIET': 'Quiet',
                'GOOD_COMPANY': 'Good Company',
                'LATE_PICKUP': 'Late Pickup',
                'RECKLESS_DRIVING': 'Reckless Driving',
                'UNCOMFORTABLE': 'Uncomfortable',
                'ROUTE_ISSUES': 'Route Issues',
                'RUDE_BEHAVIOR': 'Rude Behavior',
                'NO_SHOW': 'No Show',
                'LATE_ARRIVAL': 'Late Arrival'
            };
            
            const ALLOWED_SET = new Set(Object.keys(ALLOWED_TAGS));
            
            // Check each tag
            const invalidTags = arr.filter(t => !ALLOWED_SET.has(t));
            
            if (invalidTags.length > 0) {
                const invalidList = invalidTags.slice(0, 5).join('", "');
                const moreCount = invalidTags.length > 5 ? ` and ${invalidTags.length - 5} more` : '';
                
                throw new Error(
                    `🏷️ Invalid Tags Detected: The following tag(s) are not recognized: "${invalidList}"${moreCount}. ` +
                    `\n\n✅ Valid tags are: ${Object.values(ALLOWED_TAGS).join(', ')}. ` +
                    `\n\nPlease only select from the predefined tag buttons or ensure tag names match exactly.`
                );
            }
            
            // Check for duplicate tags
            const uniqueTags = new Set(arr);
            if (uniqueTags.size !== arr.length) {
                const duplicates = arr.filter((tag, index) => arr.indexOf(tag) !== index);
                throw new Error(`🏷️ Duplicate Tags: You've selected the same tag multiple times: "${duplicates[0]}". Please remove duplicate tags.`);
            }
            
            return true;
        }),

    // ============================================
    // COMMENT VALIDATION (Optional text feedback)
    // ============================================
    body('comment')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .custom((val, { req }) => {
            if (!val || val === '') return true;
            
            // Check length with specific message
            if (val.length > 500) {
                throw new Error(`📝 Comment Too Long: Your comment is ${val.length} characters, but the maximum allowed is 500 characters. Please shorten your comment by ${val.length - 500} characters.`);
            }
            
            // Check minimum meaningful length (if provided)
            if (val.length < 3) {
                throw new Error(`📝 Comment Too Short: Your comment "${val}" is only ${val.length} character(s). If you want to leave a comment, please write at least 3 characters. Otherwise, you can leave the comment field empty.`);
            }
            
            // Check for suspicious patterns (all caps, excessive punctuation)
            const capsRatio = (val.match(/[A-Z]/g) || []).length / val.length;
            if (val.length > 10 && capsRatio > 0.7) {
                throw new Error('📝 Comment Formatting: Your comment appears to be in ALL CAPS. Please use normal capitalization for better readability.');
            }
            
            // Check for excessive special characters
            const specialChars = (val.match(/[!?]{3,}/g) || []).length;
            if (specialChars > 0) {
                throw new Error('📝 Comment Formatting: Please avoid using excessive exclamation marks (!!!) or question marks (???). Use normal punctuation.');
            }
            
            // Check for profanity placeholder (you can implement actual profanity filter)
            const suspiciousWords = ['test123', 'asdf', 'qwerty'];
            const lowerComment = val.toLowerCase();
            const foundSuspicious = suspiciousWords.find(word => lowerComment.includes(word));
            if (foundSuspicious) {
                throw new Error(`📝 Comment Quality: Your comment appears to contain test text ("${foundSuspicious}"). Please provide genuine feedback about your ride experience.`);
            }
            
            return true;
        })
        .isLength({ max: 500 }).withMessage('📝 Comment Length Error: Comments must not exceed 500 characters. Current length: {{value.length}} characters.')
];

/**
 * Profile update validation rules with ultra-specific error messages
 */
exports.validateProfileUpdate = [
    // ============================================
    // NAME VALIDATION
    // ============================================
    body('name')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .custom((val) => {
            if (!val || val === '') return true;
            
            if (val.length < 2) {
                throw new Error(`👤 Name Too Short: Your name "${val}" is only ${val.length} character(s). Please provide a name with at least 2 characters.`);
            }
            
            if (val.length > 100) {
                throw new Error(`👤 Name Too Long: Your name is ${val.length} characters, but maximum is 100. Please shorten by ${val.length - 100} characters.`);
            }
            
            // Check for valid characters (letters, spaces, hyphens, apostrophes)
            if (!/^[a-zA-Z\s\-'\.]+$/.test(val)) {
                throw new Error(`👤 Invalid Name Characters: Name can only contain letters, spaces, hyphens, and apostrophes. Found invalid characters in "${val}".`);
            }
            
            return true;
        }),
    
    body('firstName')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .custom((val) => {
            if (!val || val === '') return true;
            
            if (val.length < 2) {
                throw new Error(`👤 First Name Too Short: "${val}" is only ${val.length} character(s). Minimum is 2 characters.`);
            }
            
            if (val.length > 50) {
                throw new Error(`👤 First Name Too Long: ${val.length} characters, maximum is 50.`);
            }
            
            if (!/^[a-zA-Z\s\-'\.]+$/.test(val)) {
                throw new Error(`👤 Invalid First Name: Can only contain letters, spaces, hyphens, and apostrophes.`);
            }
            
            return true;
        }),
    
    body('lastName')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .custom((val) => {
            if (!val || val === '') return true;
            
            if (val.length < 2) {
                throw new Error(`👤 Last Name Too Short: "${val}" is only ${val.length} character(s). Minimum is 2 characters.`);
            }
            
            if (val.length > 50) {
                throw new Error(`👤 Last Name Too Long: ${val.length} characters, maximum is 50.`);
            }
            
            if (!/^[a-zA-Z\s\-'\.]+$/.test(val)) {
                throw new Error(`👤 Invalid Last Name: Can only contain letters, spaces, hyphens, and apostrophes.`);
            }
            
            return true;
        }),
    
    // ============================================
    // PHONE VALIDATION
    // ============================================
    body('phone')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .custom((val) => {
            if (!val || val === '') return true;
            
            // Remove all non-digit characters for validation
            const digitsOnly = val.replace(/\D/g, '');
            
            if (digitsOnly.length < 10) {
                throw new Error(`📱 Phone Number Too Short: "${val}" has only ${digitsOnly.length} digits. Please provide at least 10 digits.`);
            }
            
            if (digitsOnly.length > 15) {
                throw new Error(`📱 Phone Number Too Long: "${val}" has ${digitsOnly.length} digits, maximum is 15. Please provide a valid phone number.`);
            }
            
            // Check format
            if (!/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(val)) {
                throw new Error(`📱 Invalid Phone Format: "${val}" is not a valid phone number format. Examples: +1-234-567-8900, (123) 456-7890, or 1234567890`);
            }
            
            return true;
        }),
    
    // ============================================
    // BIO VALIDATION
    // ============================================
    body('bio')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .custom((val) => {
            if (!val || val === '') return true;
            
            if (val.length > 500) {
                throw new Error(`📝 Bio Too Long: Your bio is ${val.length} characters, but maximum is 500. Please shorten by ${val.length - 500} characters.`);
            }
            
            // Check for excessive special characters
            const specialChars = (val.match(/[!@#$%^&*()]{3,}/g) || []).length;
            if (specialChars > 0) {
                throw new Error('📝 Bio Formatting: Please avoid using excessive special characters (!!!, @@@, etc.). Keep your bio natural and readable.');
            }
            
            return true;
        }),
    
    // ============================================
    // GENDER VALIDATION
    // ============================================
    body('gender')
        .optional({ nullable: true, checkFalsy: true })
        .trim()
        .customSanitizer((val) => {
            // Normalize to uppercase
            return val ? val.toUpperCase() : val;
        })
        .custom((val) => {
            if (!val || val === '') return true;
            
            const validGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
            
            if (!validGenders.includes(val)) {
                throw new Error(
                    `👤 Invalid Gender: "${val}" is not a valid option. ` +
                    `✅ Please select from: Male, Female, Other, or Prefer Not to Say.`
                );
            }
            
            return true;
        }),
    
    // ============================================
    // ADDRESS VALIDATION (can be string or object)
    // ============================================
    body('address')
        .optional({ nullable: true, checkFalsy: true })
        .custom((val) => {
            if (!val) return true;
            
            // Allow string addresses (will be parsed by controller)
            if (typeof val === 'string') {
                if (val.trim().length < 5) {
                    throw new Error(`🏠 Address Too Short: "${val}" is only ${val.trim().length} characters. Please provide a complete address (minimum 5 characters).`);
                }
                
                if (val.length > 200) {
                    throw new Error(`🏠 Address Too Long: Your address is ${val.length} characters, maximum is 200. Please shorten it.`);
                }
                
                return true;
            }
            
            // Validate object addresses
            if (typeof val === 'object') {
                if (val.street && typeof val.street !== 'string') {
                    throw new Error('🏠 Invalid Street: Street must be text.');
                }
                if (val.city && typeof val.city !== 'string') {
                    throw new Error('🏠 Invalid City: City must be text.');
                }
                if (val.state && typeof val.state !== 'string') {
                    throw new Error('🏠 Invalid State: State must be text.');
                }
                if (val.zipCode && typeof val.zipCode !== 'string' && typeof val.zipCode !== 'number') {
                    throw new Error('🏠 Invalid ZIP Code: ZIP code must be text or number.');
                }
                
                return true;
            }
            
            throw new Error('🏠 Invalid Address Format: Address must be either a text string or an address object.');
        }),
    
    // ============================================
    // PROFILE OBJECT VALIDATION (if sent as complete object)
    // ============================================
    body('profile')
        .optional({ nullable: true, checkFalsy: true })
        .custom((val, { req }) => {
            if (!val) return true;
            
            let profileData;
            try {
                profileData = typeof val === 'string' ? JSON.parse(val) : val;
            } catch (e) {
                throw new Error(`📋 Invalid Profile Data: Unable to parse profile information. Error: ${e.message}`);
            }
            
            if (typeof profileData !== 'object') {
                throw new Error('📋 Invalid Profile Format: Profile must be an object with firstName, lastName, etc.');
            }
            
            // Validate nested fields
            if (profileData.firstName && profileData.firstName.length < 2) {
                throw new Error('👤 First Name Too Short: Minimum 2 characters required.');
            }
            
            if (profileData.lastName && profileData.lastName.length < 2) {
                throw new Error('👤 Last Name Too Short: Minimum 2 characters required.');
            }
            
            if (profileData.gender) {
                const genderUpper = profileData.gender.toUpperCase();
                const validGenders = ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'];
                if (!validGenders.includes(genderUpper)) {
                    throw new Error(`👤 Invalid Gender in Profile: "${profileData.gender}" is not valid. Choose from: Male, Female, Other, Prefer Not to Say.`);
                }
            }
            
            return true;
        })
];

/**
 * Emergency contact validation rules
 */
exports.validateEmergencyContact = [
    body('name')
        .trim()
        .notEmpty().withMessage('Contact name is required')
        .isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
    
    body('relationship')
        .trim()
        .notEmpty().withMessage('Relationship is required'),
    
    body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/)
        .withMessage('Please provide a valid phone number')
];

/**
 * Search ride validation rules
 */
exports.validateRideSearch = [
    query('origin')
        .notEmpty().withMessage('Starting location is required')
        .custom((value) => {
            try {
                const parsed = JSON.parse(value);
                if (!parsed.coordinates || !Array.isArray(parsed.coordinates) || parsed.coordinates.length !== 2) {
                    throw new Error('Invalid coordinates format');
                }
                return true;
            } catch (error) {
                throw new Error('Invalid origin coordinates');
            }
        }),
    
    query('destination')
        .notEmpty().withMessage('Destination is required')
        .custom((value) => {
            try {
                const parsed = JSON.parse(value);
                if (!parsed.coordinates || !Array.isArray(parsed.coordinates) || parsed.coordinates.length !== 2) {
                    throw new Error('Invalid coordinates format');
                }
                return true;
            } catch (error) {
                throw new Error('Invalid destination coordinates');
            }
        }),
    
    query('date')
        .optional()
        .isISO8601().withMessage('Invalid date format'),
    
    query('seats')
        .optional()
        .isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7')
];

/**
 * Report validation rules
 */
exports.validateReport = [
    body('reportedUserId')
        .notEmpty().withMessage('Reported user ID is required')
        .isMongoId().withMessage('Invalid user ID'),
    
    body('category')
        .notEmpty().withMessage('Report category is required'),
    
    body('description')
        .trim()
        .isLength({ min: 50, max: 1000 })
        .withMessage('Description must be between 50 and 1000 characters'),
    
    body('severity')
        .isIn(['LOW', 'MEDIUM', 'HIGH']).withMessage('Invalid severity level')
];

/**
 * Password change validation rules
 */
exports.validatePasswordChange = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required'),
    
    body('newPassword')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character')
        .custom((value, { req }) => value !== req.body.currentPassword)
        .withMessage('New password must be different from current password'),
    
    body('confirmNewPassword')
        .custom((value, { req }) => value === req.body.newPassword)
        .withMessage('Passwords do not match')
];

/**
 * Forgot password validation rules
 */
exports.validateForgotPassword = [
    body('email')
        .trim()
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail()
];

/**
 * Reset password validation rules
 */
exports.validateResetPassword = [
    body('otp')
        .trim()
        .notEmpty().withMessage('Reset code is required')
        .isLength({ min: 6, max: 6 }).withMessage('Reset code must be 6 digits')
        .isNumeric().withMessage('Reset code must contain only numbers'),
    
    body('newPassword')
        .notEmpty().withMessage('New password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number'),
    
    body('confirmPassword')
        .notEmpty().withMessage('Please confirm your password')
        .custom((value, { req }) => value === req.body.newPassword)
        .withMessage('Passwords do not match')
];

/**
 * Vehicle validation rules
 */
exports.validateVehicle = [
    body('vehicleType')
        .notEmpty().withMessage('Vehicle type is required')
        .isIn(['SEDAN', 'SUV', 'HATCHBACK', 'MPV', 'VAN', 'LUXURY', 'MOTORCYCLE', 'AUTO']).withMessage('Invalid vehicle type'),
    
    body('make')
        .trim()
        .notEmpty().withMessage('Vehicle make is required'),
    
    body('model')
        .trim()
        .notEmpty().withMessage('Vehicle model is required'),
    
    body('year')
        .isInt({ min: 1990, max: new Date().getFullYear() + 1 })
        .withMessage('Invalid vehicle year'),
    
    body('licensePlate')
        .trim()
        .notEmpty().withMessage('License plate number is required'),
    
    body('color')
        .trim()
        .notEmpty().withMessage('Vehicle color is required'),
    
    body('capacity')
        .isInt({ min: 1, max: 8 })
        .withMessage('Seating capacity must be between 1 and 8'),
    
    body('licenseNumber')
        .trim()
        .notEmpty().withMessage('Driver license number is required'),
    
    body('licenseExpiry')
        .notEmpty().withMessage('License expiry date is required')
        .isISO8601().withMessage('Invalid date format')
];

/**
 * MongoDB ObjectId validation
 */
exports.validateObjectId = (paramName) => [
    param(paramName)
        .isMongoId().withMessage(`Invalid ${paramName}`)
];
