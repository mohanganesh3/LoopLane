/**
 * Permission Manager
 * Handles requesting and managing browser permissions
 */

class PermissionManager {
    constructor() {
        this.permissions = {
            location: { granted: false, required: true },
            notifications: { granted: false, required: false },
            camera: { granted: false, required: false },
            microphone: { granted: false, required: false }
        };
    }

    /**
     * Request all permissions at once with a nice UI
     */
    async requestAllPermissions() {
        return new Promise((resolve) => {
            this.showPermissionModal(resolve);
        });
    }

    /**
     * Show permission request modal
     */
    showPermissionModal(callback) {
        const modal = document.createElement('div');
        modal.id = 'permissionModal';
        modal.className = 'fixed inset-0 bg-black bg-opacity-75 z-[9999] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-2xl max-w-md w-full p-8">
                <div class="text-center mb-6">
                    <div class="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fas fa-shield-alt text-blue-600 text-4xl"></i>
                    </div>
                    <h2 class="text-2xl font-bold text-gray-800 mb-2">Permission Required</h2>
                    <p class="text-gray-600">
                        For the best experience, please allow the following permissions:
                    </p>
                </div>

                <div class="space-y-4 mb-6">
                    <!-- Location Permission -->
                    <div class="flex items-start p-4 bg-red-50 border border-red-200 rounded-lg">
                        <i class="fas fa-map-marker-alt text-red-600 text-xl mr-3 mt-1"></i>
                        <div class="flex-1">
                            <p class="font-semibold text-gray-800">Location Access</p>
                            <p class="text-sm text-gray-600">Required for live tracking and SOS emergency alerts</p>
                            <span class="inline-block mt-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-semibold rounded">REQUIRED</span>
                        </div>
                        <div id="locationStatus" class="ml-2">
                            <i class="fas fa-circle text-gray-400"></i>
                        </div>
                    </div>

                    <!-- Notifications Permission -->
                    <div class="flex items-start p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <i class="fas fa-bell text-blue-600 text-xl mr-3 mt-1"></i>
                        <div class="flex-1">
                            <p class="font-semibold text-gray-800">Notifications</p>
                            <p class="text-sm text-gray-600">Get alerts for ride updates and messages</p>
                            <span class="inline-block mt-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded">RECOMMENDED</span>
                        </div>
                        <div id="notificationStatus" class="ml-2">
                            <i class="fas fa-circle text-gray-400"></i>
                        </div>
                    </div>

                    <!-- Camera Permission (for SOS evidence) -->
                    <div class="flex items-start p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <i class="fas fa-camera text-yellow-600 text-xl mr-3 mt-1"></i>
                        <div class="flex-1">
                            <p class="font-semibold text-gray-800">Camera Access</p>
                            <p class="text-sm text-gray-600">For capturing evidence during emergencies</p>
                            <span class="inline-block mt-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded">OPTIONAL</span>
                        </div>
                        <div id="cameraStatus" class="ml-2">
                            <i class="fas fa-circle text-gray-400"></i>
                        </div>
                    </div>

                    <!-- Microphone Permission (for SOS audio recording) -->
                    <div class="flex items-start p-4 bg-purple-50 border border-purple-200 rounded-lg">
                        <i class="fas fa-microphone text-purple-600 text-xl mr-3 mt-1"></i>
                        <div class="flex-1">
                            <p class="font-semibold text-gray-800">Microphone Access</p>
                            <p class="text-sm text-gray-600">For audio recording during emergencies</p>
                            <span class="inline-block mt-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">OPTIONAL</span>
                        </div>
                        <div id="microphoneStatus" class="ml-2">
                            <i class="fas fa-circle text-gray-400"></i>
                        </div>
                    </div>
                </div>

                <div id="permissionMessage" class="hidden mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p class="text-sm text-yellow-800">
                        <i class="fas fa-info-circle mr-2"></i>
                        <span id="messageText"></span>
                    </p>
                </div>

                <div class="flex space-x-3">
                    <button id="grantPermissionsBtn" class="flex-1 bg-primary hover:bg-primary-dark text-white font-semibold py-3 px-6 rounded-lg transition">
                        <i class="fas fa-check mr-2"></i>
                        Grant Permissions
                    </button>
                    <button id="skipPermissionsBtn" class="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition">
                        Skip for Now
                    </button>
                </div>

                <p class="text-xs text-gray-500 text-center mt-4">
                    <i class="fas fa-lock mr-1"></i>
                    Your privacy is important. Permissions can be revoked anytime in browser settings.
                </p>
            </div>
        `;

        document.body.appendChild(modal);

        // Grant permissions button
        document.getElementById('grantPermissionsBtn').addEventListener('click', async () => {
            await this.requestPermissionsSequentially(callback);
        });

        // Skip button
        document.getElementById('skipPermissionsBtn').addEventListener('click', () => {
            this.showMessage('Some features may not work without required permissions', 'warning');
            setTimeout(() => {
                modal.remove();
                callback(this.permissions);
            }, 2000);
        });
    }

    /**
     * Request permissions one by one
     */
    async requestPermissionsSequentially(callback) {
        const grantBtn = document.getElementById('grantPermissionsBtn');
        grantBtn.disabled = true;
        grantBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Requesting...';

        // 1. Location (REQUIRED)
        await this.requestLocation();

        // 2. Notifications
        await this.requestNotifications();

        // 3. Camera (if available)
        await this.requestCamera();

        // 4. Microphone (if available)
        await this.requestMicrophone();

        // Check if required permissions granted
        if (this.permissions.location.granted) {
            this.showMessage('✅ All permissions granted! You\'re all set.', 'success');
            grantBtn.innerHTML = '<i class="fas fa-check mr-2"></i>Success!';
            grantBtn.className = 'flex-1 bg-green-600 text-white font-semibold py-3 px-6 rounded-lg';
            
            setTimeout(() => {
                document.getElementById('permissionModal').remove();
                callback(this.permissions);
            }, 1500);
        } else {
            this.showMessage('❌ Location permission is required for tracking. Please enable it in browser settings.', 'error');
            grantBtn.disabled = false;
            grantBtn.innerHTML = '<i class="fas fa-redo mr-2"></i>Try Again';
        }
    }

    /**
     * Request Location Permission
     */
    async requestLocation() {
        try {
            const result = await new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error('Geolocation not supported'));
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        console.log('✅ Location permission granted:', position.coords);
                        resolve(true);
                    },
                    (error) => {
                        console.error('❌ Location permission denied:', error);
                        reject(error);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            });

            this.permissions.location.granted = true;
            this.updatePermissionStatus('locationStatus', true);
            return true;
        } catch (error) {
            console.error('Location request failed:', error);
            this.permissions.location.granted = false;
            this.updatePermissionStatus('locationStatus', false);
            return false;
        }
    }

    /**
     * Request Notification Permission
     */
    async requestNotifications() {
        try {
            if (!('Notification' in window)) {
                console.log('Notifications not supported');
                return false;
            }

            if (Notification.permission === 'granted') {
                this.permissions.notifications.granted = true;
                this.updatePermissionStatus('notificationStatus', true);
                return true;
            }

            const permission = await Notification.requestPermission();
            const granted = permission === 'granted';
            
            this.permissions.notifications.granted = granted;
            this.updatePermissionStatus('notificationStatus', granted);
            
            if (granted) {
                console.log('✅ Notification permission granted');
            }
            
            return granted;
        } catch (error) {
            console.error('Notification request failed:', error);
            this.updatePermissionStatus('notificationStatus', false);
            return false;
        }
    }

    /**
     * Request Camera Permission
     */
    async requestCamera() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.log('Camera not supported');
                return false;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            // Stop the stream immediately (we just needed permission)
            stream.getTracks().forEach(track => track.stop());
            
            this.permissions.camera.granted = true;
            this.updatePermissionStatus('cameraStatus', true);
            console.log('✅ Camera permission granted');
            return true;
        } catch (error) {
            console.log('Camera permission denied or not available:', error.message);
            this.updatePermissionStatus('cameraStatus', false);
            return false;
        }
    }

    /**
     * Request Microphone Permission
     */
    async requestMicrophone() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.log('Microphone not supported');
                return false;
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Stop the stream immediately
            stream.getTracks().forEach(track => track.stop());
            
            this.permissions.microphone.granted = true;
            this.updatePermissionStatus('microphoneStatus', true);
            console.log('✅ Microphone permission granted');
            return true;
        } catch (error) {
            console.log('Microphone permission denied or not available:', error.message);
            this.updatePermissionStatus('microphoneStatus', false);
            return false;
        }
    }

    /**
     * Update permission status UI
     */
    updatePermissionStatus(elementId, granted) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = granted 
                ? '<i class="fas fa-check-circle text-green-500 text-xl"></i>'
                : '<i class="fas fa-times-circle text-red-500 text-xl"></i>';
        }
    }

    /**
     * Show message in modal
     */
    showMessage(text, type = 'info') {
        const messageDiv = document.getElementById('permissionMessage');
        const messageText = document.getElementById('messageText');
        
        if (messageDiv && messageText) {
            messageText.textContent = text;
            messageDiv.className = `mb-4 p-3 rounded-lg border ${
                type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
                type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
                type === 'warning' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' :
                'bg-blue-50 border-blue-200 text-blue-800'
            }`;
            messageDiv.classList.remove('hidden');
        }
    }

    /**
     * Check if all required permissions are granted
     */
    hasRequiredPermissions() {
        return this.permissions.location.granted;
    }

    /**
     * Check current permission status (without requesting)
     */
    async checkPermissionStatus() {
        // Check location permission
        if ('permissions' in navigator) {
            try {
                const locationPerm = await navigator.permissions.query({ name: 'geolocation' });
                this.permissions.location.granted = locationPerm.state === 'granted';
            } catch (err) {
                console.log('Could not check location permission');
            }

            try {
                const notificationPerm = await navigator.permissions.query({ name: 'notifications' });
                this.permissions.notifications.granted = notificationPerm.state === 'granted';
            } catch (err) {
                console.log('Could not check notification permission');
            }
        }

        return this.permissions;
    }
}

// Export for use in other scripts
window.PermissionManager = PermissionManager;
