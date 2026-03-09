/**
 * Image Helper Utilities
 * Handles image URLs, fallbacks, and common image operations
 */

// Default placeholder images
export const DEFAULT_AVATAR = null; // We'll use initials instead
export const DEFAULT_CAR = null; // We'll use emoji placeholder

/** Only allow http(s) photo URLs — block javascript: / data: URIs */
const isSafeUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch { return false; }
};

/**
 * Get user's display photo with proper fallback
 * @param {Object} user - User object (can have profile.photo or profilePhoto)
 * @returns {string|null} Photo URL or null for initials fallback
 */
export const getUserPhoto = (user) => {
  if (!user) return null;
  
  const photo = user.profile?.photo || user.profilePhoto || user.avatar;
  
  // Return null if it's a default placeholder or invalid
  if (!photo || 
      photo === '/images/default-avatar.png' || 
      photo === '' ||
      photo === 'undefined') {
    return null;
  }
  
  // Reject non-HTTP URLs (javascript:, data:, etc.)
  if (!isSafeUrl(photo)) return null;
  
  return photo;
};

/**
 * Get user's display name
 * @param {Object} user - User object
 * @returns {string} Display name
 */
export const getUserDisplayName = (user) => {
  if (!user) return 'User';
  
  // Try profile.firstName first (most common pattern)
  if (user.profile?.firstName) {
    const lastName = user.profile.lastName || '';
    return lastName ? `${user.profile.firstName} ${lastName.charAt(0)}.` : user.profile.firstName;
  }
  
  // Try direct firstName
  if (user.firstName) {
    const lastName = user.lastName || '';
    return lastName ? `${user.firstName} ${lastName.charAt(0)}.` : user.firstName;
  }
  
  // Try name
  if (user.name) return user.name;
  
  // Try email prefix
  if (user.email) return user.email.split('@')[0];
  
  return 'User';
};

/**
 * Get initials from a name
 * @param {string} name - Full name
 * @returns {string} Initials (1-2 characters)
 */
export const getInitials = (name) => {
  if (!name || typeof name !== 'string') return 'U';
  
  const cleaned = name.trim();
  if (!cleaned) return 'U';
  
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

/**
 * Generate a consistent background color based on string
 * @param {string} str - String to generate color from
 * @returns {string} Tailwind color class
 */
export const getAvatarColor = (str) => {
  const colors = [
    'bg-emerald-500',
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-teal-500',
    'bg-cyan-500',
    'bg-rose-500',
    'bg-amber-500',
    'bg-lime-500'
  ];
  
  if (!str) return colors[0];
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

/**
 * Handle image load error - use for img onError
 * @param {Event} e - Error event
 * @param {Function} setError - State setter function
 */
export const handleImageError = (e, setError) => {
  if (setError) {
    setError(true);
  }
  // Hide the broken image
  e.target.style.display = 'none';
};

/**
 * Get vehicle icon based on type
 * @param {string} type - Vehicle type
 * @returns {string} Emoji icon
 */
export const getVehicleIcon = (type) => {
  const icons = {
    'SEDAN': '🚗',
    'SUV': '🚙',
    'HATCHBACK': '🚗',
    'MPV': '🚐',
    'VAN': '🚐',
    'LUXURY': '🚘',
    'MOTORCYCLE': '🏍️',
    'AUTO': '🛺',
    'CAR': '🚗'
  };
  
  return icons[type?.toUpperCase()] || '🚗';
};

/**
 * Format distance for display
 * @param {number} km - Distance in kilometers
 * @returns {string} Formatted distance
 */
export const formatDistance = (km) => {
  if (!km && km !== 0) return 'N/A';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
};

/**
 * Format duration for display
 * @param {number} minutes - Duration in minutes
 * @returns {string} Formatted duration
 */
export const formatDuration = (minutes) => {
  if (!minutes && minutes !== 0) return 'N/A';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

/**
 * Format price for display
 * @param {number} amount - Amount in rupees
 * @returns {string} Formatted price
 */
export const formatPrice = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  return `₹${amount.toLocaleString('en-IN')}`;
};

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date
 */
export const formatDate = (date, options = {}) => {
  if (!date) return 'N/A';
  
  const defaultOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options
  };
  
  try {
    return new Date(date).toLocaleDateString('en-IN', defaultOptions);
  } catch {
    return 'Invalid Date';
  }
};

/**
 * Format time for display
 * @param {string|Date} date - Date/time to format
 * @returns {string} Formatted time
 */
export const formatTime = (date) => {
  if (!date) return 'N/A';
  
  try {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid Time';
  }
};

/**
 * Format date and time together
 * @param {string|Date} date - Date/time to format
 * @returns {string} Formatted date and time
 */
export const formatDateTime = (date) => {
  if (!date) return 'N/A';
  
  try {
    return new Date(date).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return 'Invalid Date';
  }
};

/**
 * Get relative time (e.g., "2 hours ago")
 * @param {string|Date} date - Date to compare
 * @returns {string} Relative time string
 */
export const getRelativeTime = (date) => {
  if (!date) return '';
  
  try {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return formatDate(date);
  } catch {
    return '';
  }
};
