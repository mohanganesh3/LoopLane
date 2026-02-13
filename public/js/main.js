/**
 * Main JavaScript - Global Utilities
 */

// Initialize Socket.IO connection
const socket = io();

// Global Alert Function
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    const colors = {
        success: 'bg-green-100 border-green-500 text-green-700',
        error: 'bg-red-100 border-red-500 text-red-700',
        warning: 'bg-yellow-100 border-yellow-500 text-yellow-700',
        info: 'bg-blue-100 border-blue-500 text-blue-700'
    };
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };
    
    alertDiv.className = `fixed top-20 right-4 z-50 max-w-md ${colors[type]} border-l-4 p-4 rounded shadow-lg`;
    alertDiv.innerHTML = `
        <div class="flex items-center">
            <i class="fas ${icons[type]} mr-2"></i>
            <p>${message}</p>
        </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.style.transition = 'opacity 0.5s';
        alertDiv.style.opacity = '0';
        setTimeout(() => alertDiv.remove(), 500);
    }, 5000);
}

// Format Currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount);
}

// Format Date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// Format Time
function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Time Ago
function timeAgo(dateString) {
    const now = new Date();
    const past = new Date(dateString);
    const diff = Math.floor((now - past) / 1000);
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
    return formatDate(dateString);
}

// Calculate Distance
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance.toFixed(1);
}

// Get Current Location
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(
            position => resolve({
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            }),
            error => reject(error),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// Loading Spinner
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<i class="fas fa-spinner fa-spin text-primary text-2xl"></i>';
    }
}

function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '';
    }
}

// Copy to Clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showAlert('Copied to clipboard!', 'success');
    } catch (error) {
        showAlert('Failed to copy', 'error');
    }
}

// Share
async function shareContent(title, text, url) {
    if (navigator.share) {
        try {
            await navigator.share({ title, text, url });
        } catch (error) {
            console.log('Share cancelled');
        }
    } else {
        copyToClipboard(url);
    }
}

// Debounce Function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Validate Phone Number
function validatePhone(phone) {
    const phoneRegex = /^\+91[0-9]{10}$/;
    return phoneRegex.test(phone);
}

// Validate Email
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Star Rating Component
function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star text-yellow-400"></i>';
    }
    if (hasHalfStar) {
        stars += '<i class="fas fa-star-half-alt text-yellow-400"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star text-yellow-400"></i>';
    }
    
    return stars;
}

// Image Preview
function previewImage(input, previewId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById(previewId).src = e.target.result;
        };
        reader.readAsDataURL(input.files[0]);
    }
}

// Initialize tooltips (if using Bootstrap)
document.addEventListener('DOMContentLoaded', function() {
    // Auto-resize textareas
    const textareas = document.querySelectorAll('textarea[data-auto-resize]');
    textareas.forEach(textarea => {
        textarea.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';
        });
    });
    
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
});

// Socket.IO Events
socket.on('connect', () => {
    console.log('✅ Connected to server');
});

socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
});

socket.on('notification', (data) => {
    showAlert(data.message, data.type || 'info');
    
    // Update notification badge
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        const count = parseInt(badge.textContent) + 1;
        badge.textContent = count;
        badge.style.display = 'flex';
    }
});

// Update Chat Unread Count Badge
function updateChatUnreadCount() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/api/chat/unread-count', true);
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const data = JSON.parse(xhr.responseText);
                console.log('🔵 [Badge] Unread count:', data.unreadCount);

                const badge = document.getElementById('unreadCount');
                if (badge) {
                    if (data.unreadCount > 0) {
                        badge.textContent = data.unreadCount > 9 ? '9+' : data.unreadCount;
                        badge.style.display = 'flex';
                        console.log('✅ [Badge] Showing badge with count:', badge.textContent);
                    } else {
                        badge.style.display = 'none';
                        console.log('✅ [Badge] Hiding badge (no unread)');
                    }
                } else {
                    console.log('⚠️ [Badge] Badge element not found!');
                }
            } catch (err) {
                console.error('❌ [Badge] Invalid JSON for unread count', err);
            }
        } else {
            console.error('❌ [Badge] Failed to fetch unread count, status:', xhr.status);
        }
    };

    xhr.onerror = function () {
        console.error('❌ [Badge] XHR error while fetching unread count');
    };

    xhr.send();
}

// Update chat badge on page load - use DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
    const badge = document.getElementById('unreadCount');
    if (badge) {
        console.log('✅ [Badge] Found badge element, starting updates');
        updateChatUnreadCount();
        // Refresh every 30 seconds
        setInterval(updateChatUnreadCount, 30000);
    } else {
        console.log('⚠️ [Badge] Badge element not found in DOM');
    }
});

// Listen for new message notifications via socket
socket.on('chat-notification', (data) => {
    console.log('🔔 [Socket] Chat notification received:', data);
    // Update the badge immediately
    updateChatUnreadCount();
});

// Export functions for use in other files
window.LANEApp = {
    showAlert,
    formatCurrency,
    formatDate,
    formatTime,
    timeAgo,
    calculateDistance,
    getCurrentLocation,
    showLoading,
    hideLoading,
    copyToClipboard,
    shareContent,
    debounce,
    validatePhone,
    validateEmail,
    renderStars,
    previewImage,
    updateChatUnreadCount,
    socket
};
