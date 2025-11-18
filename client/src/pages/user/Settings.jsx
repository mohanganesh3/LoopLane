import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import { Alert } from '../../components/common';

const Settings = () => {
  const navigate = useNavigate();
  const { user, logout, checkAuth } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // ✅ Security settings
  const [security, setSecurity] = useState({
    twoFactorEnabled: false
  });

  // ✅ UPDATED: All notification settings
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    pushNotifications: true,
    rideAlerts: true
  });

  // ✅ UPDATED: Privacy settings
  const [privacy, setPrivacy] = useState({
    profileVisibility: 'PUBLIC',
    shareLocation: true,
    showPhone: false,
    showEmail: false
  });

  // ✅ NEW: Ride comfort preferences
  const [rideComfort, setRideComfort] = useState({
    musicPreference: 'OPEN_TO_REQUESTS',
    smokingAllowed: false,
    petsAllowed: false,
    conversationPreference: 'DEPENDS_ON_MOOD'
  });

  // ✅ NEW: Booking preferences (for riders)
  const [bookingPrefs, setBookingPrefs] = useState({
    instantBooking: false,
    verifiedUsersOnly: false,
    maxDetourKm: 10,
    preferredCoRiderGender: 'ANY'
  });

  // Load user preferences on mount
  useEffect(() => {
    if (user?.preferences) {
      const prefs = user.preferences;
      setNotifications({
        emailNotifications: prefs.notifications?.email !== false,
        pushNotifications: prefs.notifications?.push !== false,
        rideAlerts: prefs.notifications?.rideAlerts !== false
      });
      setPrivacy({
        profileVisibility: prefs.privacy?.profileVisibility || 'PUBLIC',
        shareLocation: prefs.privacy?.shareLocation !== false,
        showPhone: prefs.privacy?.showPhone || false,
        showEmail: prefs.privacy?.showEmail || false
      });
      setSecurity({
        twoFactorEnabled: prefs.security?.twoFactorEnabled || false
      });
      setRideComfort({
        musicPreference: prefs.rideComfort?.musicPreference || 'OPEN_TO_REQUESTS',
        smokingAllowed: prefs.rideComfort?.smokingAllowed || false,
        petsAllowed: prefs.rideComfort?.petsAllowed || false,
        conversationPreference: prefs.rideComfort?.conversationPreference || 'DEPENDS_ON_MOOD'
      });
      setBookingPrefs({
        instantBooking: prefs.booking?.instantBooking || false,
        verifiedUsersOnly: prefs.booking?.verifiedUsersOnly || false,
        maxDetourKm: prefs.booking?.maxDetourKm || 10,
        preferredCoRiderGender: prefs.booking?.preferredCoRiderGender || 'ANY'
      });
    }
  }, [user]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await userService.changePassword(passwordForm);
      setSuccess('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATED: Save all settings at once
  const handleSaveSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await userService.updateSettings({
        ...notifications,
        ...privacy,
        ...security,
        ...rideComfort,
        ...bookingPrefs
      });
      
      // ✅ REFRESH USER DATA IN CONTEXT TO REFLECT CHANGES
      await checkAuth(); // This will reload the user from the server
      
      setSuccess('Settings saved successfully!');
    } catch (err) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setError('Please type DELETE to confirm');
      return;
    }

    setLoading(true);
    try {
      await userService.deleteAccount({ reason: deleteReason });
      setSuccess('Account deleted successfully');
      setTimeout(() => {
        logout();
        navigate('/');
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'account', icon: 'fa-user', label: 'Account' },
    { id: 'notifications', icon: 'fa-bell', label: 'Notifications' },
    { id: 'privacy', icon: 'fa-shield-alt', label: 'Privacy & Safety' },
    { id: 'preferences', icon: 'fa-sliders-h', label: 'Ride Preferences' },
    ...(user?.role === 'RIDER' ? [{ id: 'booking', icon: 'fa-clipboard-list', label: 'Booking Settings' }] : [])
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-8 flex items-center">
          <i className="fas fa-cog text-emerald-500 mr-3"></i> Settings
        </h1>

        {error && <Alert type="error" message={error} className="mb-6" onClose={() => setError('')} />}
        {success && <Alert type="success" message={success} className="mb-6" onClose={() => setSuccess('')} />}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <nav className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-4 py-3 rounded-lg font-semibold transition ${
                      activeTab === tab.id
                        ? 'text-emerald-600 bg-emerald-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <i className={`fas ${tab.icon} mr-3 w-5`}></i>
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Account Settings */}
            {activeTab === 'account' && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Account Settings</h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Phone</label>
                    <input
                      type="tel"
                      value={user?.phone || ''}
                      disabled
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50"
                    />
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-gray-800 mb-4">Change Password</h3>
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div>
                        <label className="block text-gray-700 font-medium mb-2">Current Password</label>
                        <input
                          type="password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-medium mb-2">New Password</label>
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-gray-700 font-medium mb-2">Confirm New Password</label>
                        <input
                          type="password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={loading}
                          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-semibold disabled:opacity-50"
                        >
                          <i className="fas fa-save mr-2"></i> Save Changes
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Two-Factor Authentication */}
                  <div className="border-t pt-6">
                    <h3 className="font-semibold text-gray-800 mb-4"><i className="fas fa-shield-alt text-emerald-500 mr-2"></i>Security</h3>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-semibold text-gray-800"><i className="fas fa-lock text-blue-500 mr-2"></i>Two-Factor Authentication</h4>
                        <p className="text-sm text-gray-600">Add extra security with OTP verification on login</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={security.twoFactorEnabled}
                          onChange={(e) => setSecurity({ ...security, twoFactorEnabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                    <div className="flex justify-end pt-4">
                      <button
                        onClick={handleSaveSettings}
                        disabled={loading}
                        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-semibold disabled:opacity-50"
                      >
                        <i className="fas fa-save mr-2"></i>Save Security Settings
                      </button>
                    </div>
                  </div>

                  {/* Danger Zone - Delete Account */}
                  <div className="border-t pt-6 mt-6">
                    <h3 className="font-semibold text-red-600 mb-4 flex items-center">
                      <i className="fas fa-exclamation-triangle mr-2"></i> Danger Zone
                    </h3>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-gray-600 mb-4">
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </p>
                      <button
                        onClick={() => setShowDeleteModal(true)}
                        className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold flex items-center"
                      >
                        <i className="fas fa-trash-alt mr-2"></i> Delete My Account
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Notification Settings */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Notification Preferences</h2>

                <div className="space-y-6">
                  {[
                    { key: 'emailNotifications', title: 'Email Notifications', icon: 'fa-envelope', desc: 'Receive booking updates, ride reminders via email' },
                    { key: 'pushNotifications', title: 'Push Notifications', icon: 'fa-bell', desc: 'Get instant alerts on your device' },
                    { key: 'rideAlerts', title: 'Ride Alerts', icon: 'fa-car', desc: 'Get notified when new rides match your saved routes' }
                  ].map(({ key, title, icon, desc }) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-semibold text-gray-800"><i className={`fas ${icon} text-emerald-500 mr-2`}></i>{title}</h4>
                        <p className="text-sm text-gray-600">{desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={notifications[key]}
                          onChange={(e) => setNotifications({ ...notifications, [key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>
                  ))}

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handleSaveSettings}
                      disabled={loading}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-semibold disabled:opacity-50"
                    >
                      <i className="fas fa-save mr-2"></i>Save Preferences
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Privacy Settings */}
            {activeTab === 'privacy' && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">Privacy & Safety</h2>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-globe text-emerald-500 mr-2"></i>Profile Visibility</h4>
                      <p className="text-sm text-gray-600">Who can see your full profile details</p>
                    </div>
                    <select
                      value={privacy.profileVisibility}
                      onChange={(e) => setPrivacy({ ...privacy, profileVisibility: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="PUBLIC">Everyone</option>
                      <option value="VERIFIED_ONLY">Verified Users Only</option>
                      <option value="PRIVATE">Only After Booking</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-map-marker-alt text-emerald-500 mr-2"></i>Share Location</h4>
                      <p className="text-sm text-gray-600">Allow live location sharing during rides</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={privacy.shareLocation}
                        onChange={(e) => setPrivacy({ ...privacy, shareLocation: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-phone text-emerald-500 mr-2"></i>Show Phone Number</h4>
                      <p className="text-sm text-gray-600">Display phone to other users (always shown during active bookings for safety)</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={privacy.showPhone}
                        onChange={(e) => setPrivacy({ ...privacy, showPhone: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-envelope text-emerald-500 mr-2"></i>Show Email</h4>
                      <p className="text-sm text-gray-600">Display email to other users (always shown during active bookings for safety)</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={privacy.showEmail}
                        onChange={(e) => setPrivacy({ ...privacy, showEmail: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handleSaveSettings}
                      disabled={loading}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-semibold disabled:opacity-50"
                    >
                      <i className="fas fa-save mr-2"></i>Save Privacy Settings
                    </button>
                  </div>

                  {/* Danger Zone */}
                  <div className="border-t pt-6 mt-6">
                    <h3 className="font-semibold text-red-600 mb-4 flex items-center">
                      <i className="fas fa-exclamation-triangle mr-2"></i> Danger Zone
                    </h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold flex items-center justify-center"
                    >
                      <i className="fas fa-trash-alt mr-2"></i> Delete My Account
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Ride Preferences */}
            {activeTab === 'preferences' && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6"><i className="fas fa-car text-emerald-500 mr-2"></i>Ride Comfort Preferences</h2>
                <p className="text-gray-600 mb-6">Set your comfort preferences. These will be visible to other users and help find compatible ride partners.</p>

                <div className="space-y-6">
                  {/* Music Preference */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-music text-purple-500 mr-2"></i>Music Preference</h4>
                      <p className="text-sm text-gray-600">Your preference for music during rides</p>
                    </div>
                    <select
                      value={rideComfort.musicPreference}
                      onChange={(e) => setRideComfort({ ...rideComfort, musicPreference: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="NO_MUSIC">No Music</option>
                      <option value="SOFT_MUSIC">Soft Music</option>
                      <option value="ANY_MUSIC">Any Music</option>
                      <option value="OPEN_TO_REQUESTS">Open to Requests</option>
                    </select>
                  </div>

                  {/* Conversation Preference */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-comments text-blue-500 mr-2"></i>Conversation Preference</h4>
                      <p className="text-sm text-gray-600">How chatty do you prefer rides?</p>
                    </div>
                    <select
                      value={rideComfort.conversationPreference}
                      onChange={(e) => setRideComfort({ ...rideComfort, conversationPreference: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="QUIET">Prefer Quiet</option>
                      <option value="SOME_CHAT">Some Chat</option>
                      <option value="CHATTY">Love to Chat</option>
                      <option value="DEPENDS_ON_MOOD">Depends on Mood</option>
                    </select>
                  </div>

                  {/* Smoking */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-smoking-ban text-red-500 mr-2"></i>Smoking Allowed</h4>
                      <p className="text-sm text-gray-600">Allow smoking in your rides</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rideComfort.smokingAllowed}
                        onChange={(e) => setRideComfort({ ...rideComfort, smokingAllowed: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Pets */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-paw text-amber-500 mr-2"></i>Pets Allowed</h4>
                      <p className="text-sm text-gray-600">Allow pets in your rides</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rideComfort.petsAllowed}
                        onChange={(e) => setRideComfort({ ...rideComfort, petsAllowed: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handleSaveSettings}
                      disabled={loading}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-semibold disabled:opacity-50"
                    >
                      <i className="fas fa-save mr-2"></i>Save Preferences
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Booking Settings (Riders Only) */}
            {activeTab === 'booking' && user?.role === 'RIDER' && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6"><i className="fas fa-clipboard-list text-emerald-500 mr-2"></i>Booking Settings</h2>
                <p className="text-gray-600 mb-6">Configure how passengers can book your rides.</p>

                <div className="space-y-6">
                  {/* Instant Booking */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-bolt text-yellow-500 mr-2"></i>Instant Booking</h4>
                      <p className="text-sm text-gray-600">Allow passengers to book without your approval</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bookingPrefs.instantBooking}
                        onChange={(e) => setBookingPrefs({ ...bookingPrefs, instantBooking: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Verified Users Only */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-check-circle text-green-500 mr-2"></i>Verified Users Only</h4>
                      <p className="text-sm text-gray-600">Only accept bookings from verified passengers</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={bookingPrefs.verifiedUsersOnly}
                        onChange={(e) => setBookingPrefs({ ...bookingPrefs, verifiedUsersOnly: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {/* Max Detour */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-ruler text-indigo-500 mr-2"></i>Maximum Detour</h4>
                      <p className="text-sm text-gray-600">Maximum km you're willing to detour for pickups</p>
                    </div>
                    <div className="flex items-center">
                      <input
                        type="range"
                        min="1"
                        max="30"
                        value={bookingPrefs.maxDetourKm}
                        onChange={(e) => setBookingPrefs({ ...bookingPrefs, maxDetourKm: parseInt(e.target.value) })}
                        className="w-24 mr-3"
                      />
                      <span className="font-semibold text-emerald-600 w-16">{bookingPrefs.maxDetourKm} km</span>
                    </div>
                  </div>

                  {/* Gender Preference */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-semibold text-gray-800"><i className="fas fa-users text-teal-500 mr-2"></i>Preferred Co-rider Gender</h4>
                      <p className="text-sm text-gray-600">Filter who can book your rides</p>
                    </div>
                    <select
                      value={bookingPrefs.preferredCoRiderGender}
                      onChange={(e) => setBookingPrefs({ ...bookingPrefs, preferredCoRiderGender: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="ANY">Any Gender</option>
                      <option value="MALE_ONLY">Male Only</option>
                      <option value="FEMALE_ONLY">Female Only</option>
                      <option value="SAME_GENDER">Same Gender Only</option>
                    </select>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handleSaveSettings}
                      disabled={loading}
                      className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-semibold disabled:opacity-50"
                    >
                      <i className="fas fa-save mr-2"></i>Save Booking Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <i className="fas fa-trash-alt text-2xl text-red-500"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Delete Account</h3>
                <p className="text-sm text-gray-500">Permanent action</p>
              </div>
            </div>

            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <p className="text-sm text-red-800 font-semibold">
                <i className="fas fa-exclamation-triangle mr-1"></i>This action CANNOT be undone!
              </p>
            </div>

            <div className="space-y-3 mb-6">
              <h4 className="font-semibold text-gray-700 text-sm">What will be deleted:</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start"><span className="text-red-500 mr-2">✗</span>Your profile and personal information</li>
                <li className="flex items-start"><span className="text-red-500 mr-2">✗</span>All rides and booking history</li>
                <li className="flex items-start"><span className="text-red-500 mr-2">✗</span>Reviews and ratings</li>
                <li className="flex items-start"><span className="text-red-500 mr-2">✗</span>Chat messages and notifications</li>
              </ul>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="Type DELETE here"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Why are you leaving? (Optional)
              </label>
              <select
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              >
                <option value="">Select a reason...</option>
                <option value="found_alternative">Found an alternative</option>
                <option value="bad_experience">Bad experience</option>
                <option value="privacy_concerns">Privacy concerns</option>
                <option value="not_using">Not using the app anymore</option>
                <option value="other">Other reason</option>
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setDeleteReason('');
                }}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || loading}
                className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
