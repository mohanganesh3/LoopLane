import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';

const Profile = () => {
  const navigate = useNavigate();
  const { user, refreshUser, logout } = useAuth();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  // Vehicle management state
  const [vehicles, setVehicles] = useState([]);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleLoading, setVehicleLoading] = useState(false);
  const [vehicleError, setVehicleError] = useState('');
  const [vehicleData, setVehicleData] = useState({
    make: '',
    model: '',
    year: '',
    color: '',
    registrationNumber: '',
    type: 'CAR',
    seatingCapacity: 4
  });
  
  // Document uploads state for vehicle verification
  const [documentFiles, setDocumentFiles] = useState({
    rcBook: null,
    insurance: null
  });
  const [documentPreviews, setDocumentPreviews] = useState({
    rcBook: null,
    insurance: null
  });
  
  // Delete account modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  
  // Change password modal state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    gender: '',
    dateOfBirth: ''
  });

  // Avatar state
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.profile?.firstName || user.name?.split(' ')[0] || '',
        lastName: user.profile?.lastName || user.name?.split(' ').slice(1).join(' ') || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.profile?.bio || user.bio || '',
        gender: user.profile?.gender || '',
        dateOfBirth: user.profile?.dateOfBirth ? user.profile.dateOfBirth.split('T')[0] : ''
      });
      
      // Profile photo is stored at user.profile.photo
      const photoUrl = user.profile?.photo;
      if (photoUrl && !photoUrl.includes('default-avatar')) {
        setAvatarPreview(photoUrl);
      } else {
        setAvatarPreview(null);
      }
      
      // Load user's vehicles
      setVehicles(user.vehicles || []);
    }
  }, [user]);

  // Fetch vehicles separately to ensure fresh data
  const fetchVehicles = async () => {
    try {
      const data = await userService.getProfile();
      setVehicles(data.user?.vehicles || []);
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
    }
  };

  const handleVehicleInputChange = (e) => {
    const { name, value } = e.target;
    setVehicleData(prev => ({ ...prev, [name]: value }));
  };

  // Handle document file selection
  const handleDocumentSelect = (field, e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setVehicleError('Please upload a valid file (JPEG, PNG, or PDF)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setVehicleError('File size must not exceed 5MB');
      return;
    }

    setDocumentFiles(prev => ({ ...prev, [field]: file }));
    setVehicleError('');

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setDocumentPreviews(prev => ({ ...prev, [field]: e.target.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setDocumentPreviews(prev => ({ ...prev, [field]: 'pdf' }));
    }
  };

  // Remove document
  const removeDocument = (field) => {
    setDocumentFiles(prev => ({ ...prev, [field]: null }));
    setDocumentPreviews(prev => ({ ...prev, [field]: null }));
  };

  const handleAddVehicle = async () => {
    setVehicleError('');
    
    // Validation - vehicle details
    if (!vehicleData.make || !vehicleData.model || !vehicleData.registrationNumber || !vehicleData.year) {
      setVehicleError('Make, Model, Year, and Registration Number are required');
      return;
    }
    
    // Validation - RC Book required for vehicle
    if (!documentFiles.rcBook) {
      setVehicleError('Vehicle RC Book is required');
      return;
    }
    
    setVehicleLoading(true);
    try {
      // First add the vehicle
      await userService.addVehicle(vehicleData);
      
      // Then upload the vehicle documents (RC and Insurance)
      const formData = new FormData();
      formData.append('rcBook', documentFiles.rcBook);
      if (documentFiles.insurance) {
        formData.append('insurance', documentFiles.insurance);
      }
      
      await userService.uploadDocuments(formData);
      
      await refreshUser();
      await fetchVehicles();
      setShowVehicleModal(false);
      
      // Reset form
      setVehicleData({
        make: '',
        model: '',
        year: '',
        color: '',
        registrationNumber: '',
        type: 'CAR',
        seatingCapacity: 4
      });
      setDocumentFiles({
        rcBook: null,
        insurance: null
      });
      setDocumentPreviews({
        rcBook: null,
        insurance: null
      });
      
      setSuccess('Vehicle added successfully! It will be reviewed by admin.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setVehicleError(err.response?.data?.message || err.message || 'Failed to add vehicle');
    } finally {
      setVehicleLoading(false);
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (!window.confirm('Are you sure you want to delete this vehicle?')) {
      return;
    }
    
    try {
      await userService.deleteVehicle(vehicleId);
      await refreshUser();
      await fetchVehicles();
      setSuccess('Vehicle deleted successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete vehicle');
    }
  };

  const getVehicleStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <i className="fas fa-check-circle mr-1"></i>Approved
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <i className="fas fa-clock mr-1"></i>Pending Review
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <i className="fas fa-times-circle mr-1"></i>Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }

      // Show preview immediately
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);

      // Upload immediately
      setError('');
      setUploadingPhoto(true);
      try {
        const formData = new FormData();
        formData.append('profilePhoto', file);
        
        console.log('Uploading image...', file.name, file.type, file.size);
        
        const response = await userService.updateProfilePicture(formData);
        console.log('Upload response:', response);
        
        if (response.success && response.profilePhoto) {
          setAvatarPreview(response.profilePhoto);
          await refreshUser();
          setSuccess('Profile photo updated successfully!');
          setTimeout(() => setSuccess(''), 3000);
        }
      } catch (err) {
        console.error('Image upload error:', err);
        setError(err.response?.data?.message || 'Failed to upload image');
        // Revert preview to original
        const originalPhoto = user?.profile?.photo;
        if (originalPhoto && !originalPhoto.includes('default-avatar')) {
          setAvatarPreview(originalPhoto);
        } else {
          setAvatarPreview(null);
        }
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      // Prepare profile data - structure it as the backend expects
      const updateData = {
        bio: profileData.bio || '',
        phone: profileData.phone || '',
        profile: {
          firstName: profileData.firstName || '',
          lastName: profileData.lastName || '',
          gender: profileData.gender || '',
          dateOfBirth: profileData.dateOfBirth || '',
          bio: profileData.bio || ''
        }
      };

      console.log('Sending profile update:', updateData);

      // Update profile
      const response = await userService.updateProfile(updateData);
      console.log('Profile update response:', response);
      
      // Refresh user data from server to get the latest state
      const updatedUser = await refreshUser();
      console.log('Refreshed user:', updatedUser);
      
      // Update avatar preview with the new photo URL if available
      if (updatedUser?.profile?.photo && !updatedUser.profile.photo.includes('default-avatar')) {
        setAvatarPreview(updatedUser.profile.photo);
      }
      
      setSuccess('Profile updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('All fields are required');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }
    
    setPasswordLoading(true);
    try {
      await userService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword
      });
      
      setPasswordSuccess('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (err) {
      setPasswordError(err.response?.data?.message || err.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm');
      return;
    }
    
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await userService.deleteAccount({ reason: deleteReason });
      setSuccess('Account deleted successfully');
      setShowDeleteModal(false);
      setTimeout(() => {
        logout();
        navigate('/');
      }, 2000);
    } catch (err) {
      console.error('Delete account error:', err);
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete account');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">My Profile</h1>
        
        {/* Content Area */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="space-y-6">
            {/* Success/Error Messages */}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
                <i className="fas fa-check-circle mr-2"></i>
                {success}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
                <i className="fas fa-exclamation-circle mr-2"></i>
                {error}
              </div>
            )}

            {/* Avatar Section */}
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 ring-4 ring-emerald-100">
                  {uploadingPhoto ? (
                    <div className="w-full h-full flex items-center justify-center bg-emerald-50">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-500 border-t-transparent"></div>
                    </div>
                  ) : avatarPreview ? (
                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gradient-to-br from-emerald-100 to-teal-100">
                      <i className="fas fa-user text-4xl text-emerald-300"></i>
                    </div>
                  )}
                </div>
                <label className={`absolute bottom-0 right-0 bg-emerald-500 text-white p-2 rounded-full cursor-pointer hover:bg-emerald-600 transition-colors shadow-lg ${uploadingPhoto ? 'opacity-50 pointer-events-none' : ''}`}>
                  <i className="fas fa-camera text-sm"></i>
                  <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} disabled={uploadingPhoto} />
                </label>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {profileData.firstName} {profileData.lastName}
                </h3>
                <p className="text-sm text-gray-500">{profileData.email}</p>
                <p className="text-xs text-emerald-600 mt-1">
                  <i className="fas fa-check-circle mr-1"></i>
                  {user?.role === 'RIDER' ? 'Rider' : 'Passenger'}
                </p>
              </div>
            </div>

            {/* Personal Information Form */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i className="fas fa-user-edit text-emerald-500 mr-2"></i>
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    name="firstName"
                    value={profileData.firstName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    placeholder="Enter first name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    name="lastName"
                    value={profileData.lastName}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    placeholder="Enter last name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={profileData.email}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={profileData.phone}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    name="gender"
                    value={profileData.gender}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  >
                    <option value="">Select Gender</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date"
                    name="dateOfBirth"
                    value={profileData.dateOfBirth}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
                  <textarea
                    name="bio"
                    value={profileData.bio}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
                    placeholder="Tell others about yourself..."
                  />
                  <p className="text-xs text-gray-400 mt-1">{profileData.bio.length}/500 characters</p>
                </div>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-6 border-t border-gray-200">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="px-8 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="fas fa-save mr-2"></i>
                    Save Changes
                  </>
                )}
              </button>
            </div>

            {/* Vehicle Management Section */}
            {user?.role === 'RIDER' && (
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <i className="fas fa-car text-emerald-500 mr-2"></i>
                    My Vehicles
                  </h3>
                  <button
                    onClick={() => setShowVehicleModal(true)}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition font-medium text-sm"
                  >
                    <i className="fas fa-plus mr-2"></i>Add Vehicle
                  </button>
                </div>
                
                {vehicles.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-8 text-center">
                    <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                      <i className="fas fa-car text-gray-400 text-2xl"></i>
                    </div>
                    <h4 className="font-medium text-gray-800 mb-2">No Vehicles Added</h4>
                    <p className="text-sm text-gray-500 mb-4">
                      Add your vehicle to start posting rides
                    </p>
                    <button
                      onClick={() => setShowVehicleModal(true)}
                      className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition font-medium text-sm"
                    >
                      <i className="fas fa-plus mr-2"></i>Add Your First Vehicle
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {vehicles.map((vehicle, index) => (
                      <div 
                        key={vehicle._id || index} 
                        className={`p-4 rounded-xl border ${
                          vehicle.status === 'APPROVED' 
                            ? 'bg-green-50 border-green-200' 
                            : vehicle.status === 'PENDING' 
                            ? 'bg-yellow-50 border-yellow-200' 
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                              vehicle.status === 'APPROVED' 
                                ? 'bg-green-200' 
                                : vehicle.status === 'PENDING' 
                                ? 'bg-yellow-200' 
                                : 'bg-red-200'
                            }`}>
                              <i className={`fas fa-car text-xl ${
                                vehicle.status === 'APPROVED' 
                                  ? 'text-green-700' 
                                  : vehicle.status === 'PENDING' 
                                  ? 'text-yellow-700' 
                                  : 'text-red-700'
                              }`}></i>
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {vehicle.make} {vehicle.model}
                                {vehicle.year && <span className="text-gray-500 font-normal ml-1">({vehicle.year})</span>}
                              </h4>
                              <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                                <span><i className="fas fa-hashtag mr-1"></i>{vehicle.vehicleNumber || vehicle.licensePlate || 'N/A'}</span>
                                {vehicle.color && <span><i className="fas fa-palette mr-1"></i>{vehicle.color}</span>}
                                {vehicle.capacity && <span><i className="fas fa-users mr-1"></i>{vehicle.capacity} seats</span>}
                              </div>
                              {vehicle.status === 'REJECTED' && vehicle.rejectionReason && (
                                <p className="text-sm text-red-600 mt-2">
                                  <i className="fas fa-info-circle mr-1"></i>
                                  Reason: {vehicle.rejectionReason}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getVehicleStatusBadge(vehicle.status)}
                            {vehicle.status !== 'APPROVED' && (
                              <button
                                onClick={() => handleDeleteVehicle(vehicle._id)}
                                className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition"
                                title="Delete vehicle"
                              >
                                <i className="fas fa-trash"></i>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-4">
                  <i className="fas fa-info-circle mr-1"></i>
                  Vehicles need to be approved by admin before you can post rides. Approval usually takes 24-48 hours.
                </p>
              </div>
            )}

            {/* Account Actions Section */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <i className="fas fa-shield-alt text-emerald-500 mr-2"></i>
                Account Security
              </h3>
              
              <div className="space-y-4">
                {/* Change Password */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-gray-900">Change Password</h4>
                    <p className="text-sm text-gray-500">Update your account password</p>
                  </div>
                  <button
                    onClick={() => setShowPasswordModal(true)}
                    className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition font-medium"
                  >
                    <i className="fas fa-key mr-2"></i>Change
                  </button>
                </div>

                {/* Delete Account */}
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200">
                  <div>
                    <h4 className="font-medium text-red-800">Delete Account</h4>
                    <p className="text-sm text-red-600">Permanently delete your account and all data</p>
                  </div>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
                  >
                    <i className="fas fa-trash-alt mr-2"></i>Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mr-4">
                <i className="fas fa-key text-2xl text-emerald-500"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Change Password</h3>
                <p className="text-sm text-gray-500">Enter your current and new password</p>
              </div>
            </div>

            {passwordError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center">
                <i className="fas fa-exclamation-circle mr-2"></i>
                {passwordError}
              </div>
            )}

            {passwordSuccess && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center">
                <i className="fas fa-check-circle mr-2"></i>
                {passwordSuccess}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter new password (min 6 characters)"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  setPasswordError('');
                  setPasswordSuccess('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
              >
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <p className="text-sm text-gray-500">This action is permanent</p>
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
                onChange={(e) => {
                  setDeleteConfirmText(e.target.value);
                  setDeleteError('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                placeholder="Type DELETE"
              />
            </div>

            {deleteError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {deleteError}
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for leaving (optional):
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
                rows={3}
                placeholder="Help us improve..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText('');
                  setDeleteReason('');
                  setDeleteError('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleteLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? 'Deleting...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mr-4">
                <i className="fas fa-car text-2xl text-emerald-500"></i>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Add Vehicle & Documents</h3>
                <p className="text-sm text-gray-500">Enter vehicle details and upload verification documents</p>
              </div>
            </div>

            {vehicleError && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center">
                <i className="fas fa-exclamation-circle mr-2"></i>
                {vehicleError}
              </div>
            )}

            {/* Vehicle Details Section */}
            <div className="mb-6">
              <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                <i className="fas fa-car-side text-emerald-500 mr-2"></i>
                Vehicle Details
              </h4>
              <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Make <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="make"
                      value={vehicleData.make}
                      onChange={handleVehicleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="e.g., Toyota"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Model <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="model"
                      value={vehicleData.model}
                      onChange={handleVehicleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="e.g., Camry"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      name="year"
                      value={vehicleData.year}
                      onChange={handleVehicleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="e.g., 2022"
                      min="1990"
                      max={new Date().getFullYear() + 1}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                    <input
                      type="text"
                      name="color"
                      value={vehicleData.color}
                      onChange={handleVehicleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="e.g., White"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Registration Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="registrationNumber"
                    value={vehicleData.registrationNumber}
                    onChange={handleVehicleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent uppercase"
                    placeholder="e.g., TN01AB1234"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
                    <select
                      name="type"
                      value={vehicleData.type}
                      onChange={handleVehicleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="CAR">Car</option>
                      <option value="SUV">SUV</option>
                      <option value="HATCHBACK">Hatchback</option>
                      <option value="SEDAN">Sedan</option>
                      <option value="VAN">Van</option>
                      <option value="BIKE">Bike</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Seating Capacity <span className="text-red-500">*</span></label>
                    <select
                      name="seatingCapacity"
                      value={vehicleData.seatingCapacity}
                      onChange={handleVehicleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value={2}>2 seats</option>
                      <option value={3}>3 seats</option>
                      <option value={4}>4 seats</option>
                      <option value={5}>5 seats</option>
                      <option value={6}>6 seats</option>
                      <option value={7}>7 seats</option>
                      <option value={8}>8+ seats</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Document Upload Section */}
            <div className="mb-6">
              <h4 className="text-md font-semibold text-gray-800 mb-3 flex items-center">
                <i className="fas fa-file-alt text-emerald-500 mr-2"></i>
                Vehicle Documents
              </h4>
              
              <div className="grid grid-cols-2 gap-4">
                {/* RC Book */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-emerald-400 transition">
                  <div className="text-center">
                    <i className="fas fa-file-alt text-3xl text-gray-400 mb-2"></i>
                    <p className="text-sm font-medium text-gray-700">Vehicle RC <span className="text-red-500">*</span></p>
                    {documentPreviews.rcBook ? (
                      <div className="mt-2 relative">
                        {documentPreviews.rcBook === 'pdf' ? (
                          <div className="bg-red-100 text-red-600 py-2 px-3 rounded text-sm">
                            <i className="fas fa-file-pdf mr-1"></i> PDF Uploaded
                          </div>
                        ) : (
                          <img src={documentPreviews.rcBook} alt="RC" className="w-full h-20 object-cover rounded" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeDocument('rcBook')}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label className="mt-2 cursor-pointer inline-block">
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded text-sm hover:bg-emerald-200">
                          <i className="fas fa-upload mr-1"></i> Upload
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => handleDocumentSelect('rcBook', e)}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Insurance */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-emerald-400 transition">
                  <div className="text-center">
                    <i className="fas fa-shield-alt text-3xl text-gray-400 mb-2"></i>
                    <p className="text-sm font-medium text-gray-700">Insurance <span className="text-gray-400">(Optional)</span></p>
                    {documentPreviews.insurance ? (
                      <div className="mt-2 relative">
                        {documentPreviews.insurance === 'pdf' ? (
                          <div className="bg-red-100 text-red-600 py-2 px-3 rounded text-sm">
                            <i className="fas fa-file-pdf mr-1"></i> PDF Uploaded
                          </div>
                        ) : (
                          <img src={documentPreviews.insurance} alt="Insurance" className="w-full h-20 object-cover rounded" />
                        )}
                        <button
                          type="button"
                          onClick={() => removeDocument('insurance')}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <label className="mt-2 cursor-pointer inline-block">
                        <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded text-sm hover:bg-emerald-200">
                          <i className="fas fa-upload mr-1"></i> Upload
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => handleDocumentSelect('insurance', e)}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-700">
                <i className="fas fa-info-circle mr-2"></i>
                Your vehicle and documents will be reviewed by our admin team. This usually takes 24-48 hours.
              </p>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowVehicleModal(false);
                  setVehicleError('');
                  setVehicleData({
                    make: '',
                    model: '',
                    year: '',
                    color: '',
                    registrationNumber: '',
                    type: 'CAR',
                    seatingCapacity: 4
                  });
                  setDocumentFiles({
                    rcBook: null,
                    insurance: null
                  });
                  setDocumentPreviews({
                    rcBook: null,
                    insurance: null
                  });
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleAddVehicle}
                disabled={vehicleLoading}
                className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium flex items-center"
              >
                {vehicleLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    Add Vehicle
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
