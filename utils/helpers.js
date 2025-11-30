/**
 * Helper Utilities
 * General purpose helper functions
 */

const crypto = require('crypto');
const moment = require('moment');

/**
 * Generate random OTP
 * @param {number} length - Length of OTP (default: 6)
 * @returns {string} OTP
 */
exports.generateOTP = (length = 6) => {
    const digits = '0123456789';
    let OTP = '';
    for (let i = 0; i < length; i++) {
        OTP += digits[Math.floor(Math.random() * 10)];
    }
    return OTP;
};

/**
 * Generate random token
 * @param {number} length - Length of token (default: 32)
 * @returns {string} Token
 */
exports.generateToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Format date
 * @param {Date} date - Date to format
 * @param {string} format - Moment.js format string
 * @returns {string} Formatted date
 */
exports.formatDate = (date, format = 'MMMM DD, YYYY') => {
    return moment(date).format(format);
};

/**
 * Format time
 * @param {Date} date - Date to format
 * @returns {string} Formatted time
 */
exports.formatTime = (date) => {
    return moment(date).format('hh:mm A');
};

/**
 * Calculate time ago
 * @param {Date} date - Date to calculate from
 * @returns {string} Time ago string
 */
exports.timeAgo = (date) => {
    return moment(date).fromNow();
};

/**
 * Calculate distance between two coordinates (Haversine formula)
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
exports.calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

/**
 * Format currency
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency symbol (default: ₹)
 * @returns {string} Formatted currency
 */
exports.formatCurrency = (amount, currency = '₹') => {
    return `${currency}${amount.toFixed(2)}`;
};

/**
 * Generate booking reference
 * @returns {string} Booking reference
 */
exports.generateBookingRef = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `BK-${timestamp}-${random}`;
};

/**
 * Generate ride reference
 * @returns {string} Ride reference
 */
exports.generateRideRef = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `RD-${timestamp}-${random}`;
};

/**
 * Sanitize filename
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
exports.sanitizeFilename = (filename) => {
    return filename.replace(/[^a-z0-9.-]/gi, '_').toLowerCase();
};

/**
 * Get file extension
 * @param {string} filename - Filename
 * @returns {string} Extension
 */
exports.getFileExtension = (filename) => {
    return filename.split('.').pop().toLowerCase();
};

/**
 * Check if date is in past
 * @param {Date} date - Date to check
 * @returns {boolean} True if in past
 */
exports.isDateInPast = (date) => {
    return moment(date).isBefore(moment());
};

/**
 * Check if date is today
 * @param {Date} date - Date to check
 * @returns {boolean} True if today
 */
exports.isToday = (date) => {
    return moment(date).isSame(moment(), 'day');
};

/**
 * Get hours until date
 * @param {Date} date - Future date
 * @returns {number} Hours until date
 */
exports.getHoursUntil = (date) => {
    return moment(date).diff(moment(), 'hours');
};

/**
 * Paginate array or calculate pagination
 * @param {Array|number} arrayOrCount - Array to paginate or total count
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {object} Paginated result
 */
exports.paginate = (arrayOrCount, page = 1, limit = 10) => {
    // If it's a number (total count), just return pagination info
    if (typeof arrayOrCount === 'number') {
        const totalPages = Math.ceil(arrayOrCount / limit);
        return {
            items: null, // Items should be fetched separately
            currentPage: page,
            totalPages: totalPages,
            totalItems: arrayOrCount,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        };
    }
    
    // If it's an array, slice it
    const offset = (page - 1) * limit;
    const paginatedItems = arrayOrCount.slice(offset, offset + limit);
    const totalPages = Math.ceil(arrayOrCount.length / limit);
    
    return {
        items: paginatedItems,
        currentPage: page,
        totalPages: totalPages,
        totalItems: arrayOrCount.length,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
    };
};

/**
 * Generate random color
 * @returns {string} Hex color code
 */
exports.generateRandomColor = () => {
    return '#' + Math.floor(Math.random()*16777215).toString(16);
};

/**
 * Truncate text
 * @param {string} text - Text to truncate
 * @param {number} length - Maximum length
 * @returns {string} Truncated text
 */
exports.truncateText = (text, length = 100) => {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
};

/**
 * Get initials from name
 * @param {string} name - Full name
 * @returns {string} Initials
 */
exports.getInitials = (name) => {
    if (!name || typeof name !== 'string') return '';
    return name
        .trim()
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
};

/**
 * Format phone number
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
exports.formatPhoneNumber = (phone) => {
    // Remove all non-numeric characters
    const cleaned = ('' + phone).replace(/\D/g, '');
    
    // Format based on length (10 digits)
    if (cleaned.length === 10) {
        return `${cleaned.substring(0, 5)} ${cleaned.substring(5)}`;
    }
    return phone;
};

/**
 * Mask email
 * @param {string} email - Email to mask
 * @returns {string} Masked email
 */
exports.maskEmail = (email) => {
    if (!email || typeof email !== 'string' || !email.includes('@')) return email;
    const [name, domain] = email.split('@');
    if (name.length < 2) return email;
    const maskedName = name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
    return `${maskedName}@${domain}`;
};

/**
 * Mask phone number
 * @param {string} phone - Phone to mask
 * @returns {string} Masked phone
 */
exports.maskPhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length >= 10) {
        return '*'.repeat(cleaned.length - 4) + cleaned.slice(-4);
    }
    return phone;
};

/**
 * Calculate percentage
 * @param {number} value - Value
 * @param {number} total - Total
 * @returns {number} Percentage
 */
exports.calculatePercentage = (value, total) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
};

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after delay
 */
exports.sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Shuffle array
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
 */
exports.shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

/**
 * Remove duplicates from array
 * @param {Array} array - Array with duplicates
 * @param {string} key - Key to check for duplicates (for objects)
 * @returns {Array} Array without duplicates
 */
exports.removeDuplicates = (array, key = null) => {
    if (key) {
        return array.filter((item, index, self) =>
            index === self.findIndex((t) => t[key] === item[key])
        );
    }
    return [...new Set(array)];
};

/**
 * Group array by key
 * @param {Array} array - Array to group
 * @param {string} key - Key to group by
 * @returns {object} Grouped object
 */
exports.groupBy = (array, key) => {
    return array.reduce((result, item) => {
        (result[item[key]] = result[item[key]] || []).push(item);
        return result;
    }, {});
};

/**
 * Filter user data based on their privacy preferences
 * Used to hide phone/email when user has disabled sharing
 * @param {object} userData - User data object (can be Mongoose doc or plain object)
 * @param {object} options - Options for filtering
 * @param {boolean} options.isConfirmedBooking - If true, show phone for confirmed bookings
 * @param {boolean} options.isRideInProgress - If true, always show contact for safety
 * @returns {object} Filtered user data
 */
exports.filterUserPrivacy = (userData, options = {}) => {
    if (!userData) return userData;
    
    // Convert Mongoose document to plain object if needed
    const user = userData.toObject ? userData.toObject() : { ...userData };
    const prefs = user.preferences?.privacy || {};
    
    // During active rides (CONFIRMED, IN_PROGRESS), always show contact for safety
    if (options.isRideInProgress || options.isConfirmedBooking) {
        return user;
    }
    
    // Hide phone if showPhone is false
    if (prefs.showPhone === false) {
        user.phone = null;
        user.phoneHidden = true;
    }
    
    // Hide email if showEmail is false
    if (prefs.showEmail === false) {
        user.email = null;
        user.emailHidden = true;
    }
    
    return user;
};

/**
 * Check if a user can view another user's profile based on visibility settings
 * @param {object} profileOwner - User whose profile is being viewed
 * @param {object} viewer - User trying to view the profile
 * @param {boolean} hasConfirmedBooking - If there's a confirmed booking between them
 * @returns {object} { canView: boolean, reason: string }
 */
exports.canViewProfile = (profileOwner, viewer, hasConfirmedBooking = false) => {
    if (!profileOwner || !viewer) {
        return { canView: false, reason: 'Invalid users' };
    }
    
    // User can always view their own profile
    if (profileOwner._id?.toString() === viewer._id?.toString()) {
        return { canView: true, reason: 'Own profile' };
    }
    
    // Admins can view any profile
    if (viewer.role === 'ADMIN') {
        return { canView: true, reason: 'Admin access' };
    }
    
    // If there's a confirmed booking, they can view each other
    if (hasConfirmedBooking) {
        return { canView: true, reason: 'Confirmed booking' };
    }
    
    const visibility = profileOwner.preferences?.privacy?.profileVisibility || 'PUBLIC';
    
    switch (visibility) {
        case 'PUBLIC':
            return { canView: true, reason: 'Public profile' };
        
        case 'VERIFIED_ONLY':
            if (viewer.verificationStatus === 'VERIFIED') {
                return { canView: true, reason: 'Verified viewer' };
            }
            return { canView: false, reason: 'This user only shows their profile to verified members' };
        
        case 'PRIVATE':
            return { canView: false, reason: 'This user has a private profile' };
        
        default:
            return { canView: true, reason: 'Default public' };
    }
};

/**
 * Check if location sharing is allowed for a user
 * @param {object} user - User object with preferences
 * @returns {boolean} True if location sharing is allowed
 */
exports.canShareLocation = (user) => {
    if (!user) return false;
    // Default to true if not set
    return user.preferences?.privacy?.shareLocation !== false;
};
