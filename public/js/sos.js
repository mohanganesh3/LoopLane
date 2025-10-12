/**
 * SOS Emergency System
 * Handles emergency alerts with location tracking
 */

let sosActive = false;
let watchId = null;
let emergencyId = null;

// Get Current Location Helper
function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported by your browser'));
            return;
        }
        
        console.log('🔍 Requesting geolocation permission...');
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('✅ Geolocation permission granted:', {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
                resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
            },
            (error) => {
                console.error('❌ Geolocation error:', error);
                let errorMessage = 'Failed to get your location. ';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'Location permission denied. Please enable location access in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'Location request timed out.';
                        break;
                    default:
                        errorMessage += 'An unknown error occurred.';
                }
                
                reject(new Error(errorMessage));
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    });
}

// Trigger SOS Alert
async function triggerSOSAlert(rideId = null, bookingId = null) {
    if (sosActive) {
        showAlert('SOS already active', 'warning');
        return;
    }
    
    // Confirm action
    const confirmed = confirm('⚠️ EMERGENCY ALERT\n\nThis will notify:\n• Your emergency contacts\n• Platform administrators\n• Other ride participants\n\nContinue?');
    
    if (!confirmed) return;
    
    try {
        // Get current location
        console.log('🔍 Getting current location...');
        const location = await getCurrentLocation();
        console.log('📍 Location obtained:', location);
        
        if (!location || !location.latitude || !location.longitude) {
            throw new Error('Failed to get valid location coordinates');
        }
        
        console.log('📤 Sending SOS request with:', {
            rideId,
            bookingId,
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy
        });
        
        const response = await fetch('/sos/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rideId,
                bookingId,
                latitude: location.latitude,
                longitude: location.longitude,
                accuracy: location.accuracy,
                notes: 'Emergency assistance required',
                type: 'SOS'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            sosActive = true;
            emergencyId = result.emergency.id;
            
            // Show success
            showAlert('🚨 SOS ALERT SENT! Help is on the way.', 'success');
            
            // Show SOS modal
            showSOSModal(result.emergency);
            
            // Start location tracking
            startLocationTracking();
            
            // Emit socket event
            socket.emit('sos-alert', {
                emergencyId: result.emergency.id,
                location
            });
            
            // Update UI
            updateSOSButton(true);
        } else {
            showAlert(result.message || 'Failed to send SOS alert', 'error');
        }
    } catch (error) {
        console.error('❌ SOS Error:', error);
        
        // Show user-friendly error message
        let errorMessage = 'Failed to send SOS alert. ';
        
        if (error.message && error.message.includes('permission')) {
            errorMessage = '⚠️ Location permission required! Please enable location access in your browser and try again.';
        } else if (error.message && error.message.includes('timeout')) {
            errorMessage = '⚠️ Location request timed out. Please try again or call emergency services directly.';
        } else {
            errorMessage = '⚠️ Failed to send SOS alert. Please call emergency services: 112';
        }
        
        showAlert(errorMessage, 'error');
        
        // Offer to call emergency directly
        if (confirm(errorMessage + '\n\nWould you like to call emergency services now?')) {
            window.location.href = 'tel:112';
        }
    }
}

// Show SOS Modal
function showSOSModal(emergency) {
    const modal = document.createElement('div');
    modal.id = 'sosModal';
    modal.className = 'fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl max-w-md w-full p-8 animate-pulse">
            <div class="text-center">
                <div class="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
                    <i class="fas fa-exclamation-triangle text-white text-5xl"></i>
                </div>
                <h2 class="text-3xl font-bold text-red-600 mb-4">🚨 SOS ACTIVE</h2>
                <p class="text-gray-600 mb-6">
                    Emergency ID: <span class="font-mono font-bold">${emergency.emergencyId}</span>
                </p>
                <div class="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                    <p class="text-sm text-gray-700">
                        <i class="fas fa-check-circle text-green-600 mr-2"></i>
                        Emergency contacts notified
                    </p>
                    <p class="text-sm text-gray-700 mt-2">
                        <i class="fas fa-check-circle text-green-600 mr-2"></i>
                        Admin team alerted
                    </p>
                    <p class="text-sm text-gray-700 mt-2">
                        <i class="fas fa-map-marker-alt text-blue-600 mr-2"></i>
                        Location tracking active
                    </p>
                </div>
                <div class="space-y-3">
                    <button onclick="callEmergency()" 
                        class="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-semibold transition">
                        <i class="fas fa-phone mr-2"></i> Call Emergency Services
                    </button>
                    <button onclick="resolveEmergency()" 
                        class="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-semibold transition">
                        <i class="fas fa-check mr-2"></i> I'm Safe Now
                    </button>
                    <button onclick="closeSOSModal()" 
                        class="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 py-3 rounded-lg font-semibold transition">
                        Close (Keep Alert Active)
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Start Location Tracking
function startLocationTracking() {
    if (!navigator.geolocation) {
        console.error('Geolocation not supported');
        return;
    }
    
    if (!emergencyId) {
        console.error('No active emergency to track');
        return;
    }
    
    if (watchId !== null) {
        console.warn('Location tracking already active');
        return;
    }
    
    watchId = navigator.geolocation.watchPosition(
        async (position) => {
            const location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };
            
            // Update location on server
            try {
                await fetch(`/sos/${emergencyId}/location`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(location)
                });
                
                // Emit socket event for real-time updates (only if socket available)
                if (typeof socket !== 'undefined' && socket && socket.connected) {
                    socket.emit('sos-location-update', {
                        emergencyId,
                        location
                    });
                }
            } catch (error) {
                console.error('Failed to update location:', error);
            }
        },
        (error) => {
            console.error('Location tracking error:', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
}

// Stop Location Tracking
function stopLocationTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

// Resolve Emergency
async function resolveEmergency() {
    if (!emergencyId) return;
    
    const confirmed = confirm('Are you sure you are safe? This will deactivate the emergency alert.');
    if (!confirmed) return;
    
    try {
        const response = await fetch(`/sos/${emergencyId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resolution: 'User confirmed safety'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            sosActive = false;
            emergencyId = null;
            
            stopLocationTracking();
            closeSOSModal();
            updateSOSButton(false);
            
            showAlert('Emergency resolved. Stay safe! 🙏', 'success');
        }
    } catch (error) {
        console.error('Failed to resolve emergency:', error);
    }
}

// Close SOS Modal
function closeSOSModal() {
    const modal = document.getElementById('sosModal');
    if (modal) {
        modal.remove();
    }
}

// Call Emergency Services
function callEmergency() {
    const confirmed = confirm('This will call local emergency services (112). Continue?');
    if (confirmed) {
        window.location.href = 'tel:112';
    }
}

// Update SOS Button UI
function updateSOSButton(active) {
    const btns = document.querySelectorAll('[onclick*="triggerSOSAlert"]');
    btns.forEach(btn => {
        if (active) {
            btn.classList.add('animate-pulse');
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>SOS ACTIVE</span>';
        } else {
            btn.classList.remove('animate-pulse');
            btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span>SOS</span>';
        }
    });
}

// Listen for SOS events from socket (only if socket available)
if (typeof socket !== 'undefined' && socket) {
    socket.on('sos-alert', (data) => {
        console.log('SOS alert received:', data);
        // Show alert notification
        if (typeof showAlert === 'function') {
            showAlert(`🚨 Emergency Alert from ${data.userName}`, 'error');
        }
    });
}

// Helper function for showing alerts (fallback if LANEApp not available)
function showAlert(message, type = 'info') {
    if (typeof LANEApp !== 'undefined' && LANEApp.showAlert) {
        LANEApp.showAlert(message, type);
    } else {
        alert(message);
    }
}

if (typeof socket !== 'undefined' && socket) {
    socket.on('sos-alert', (data) => {
        // Admin or other users receive this
        console.log('SOS Alert received:', data);
        
        // Show notification
        const userName = data.userName || 'Someone';
        showAlert(`🚨 Emergency Alert: ${userName} needs help!`, 'error');
        
        // Play alert sound (optional)
        playAlertSound();
    });
}

// Play Alert Sound
function playAlertSound() {
    const audio = new Audio('/sounds/alert.mp3');
    audio.play().catch(err => console.log('Could not play alert sound'));
}

// Export functions
window.triggerSOSAlert = triggerSOSAlert;
window.resolveEmergency = resolveEmergency;
window.closeSOSModal = closeSOSModal;
window.callEmergency = callEmergency;
