import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import { Alert, LoadingSpinner } from '../../components/common';

const CompleteProfile = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: Vehicle Info, 2: Preferences, 3: License Info
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Vehicle form state
  const [vehicleData, setVehicleData] = useState({
    vehicleType: '',
    make: '',
    model: '',
    year: '',
    color: '',
    licensePlate: '',
    seats: '',
    acAvailable: false
  });

  // Preferences form state
  const [preferences, setPreferences] = useState({
    genderPreference: 'ANY',
    musicPreference: 'OPEN_TO_REQUESTS',
    smokingAllowed: false,
    petsAllowed: false
  });

  // License form state
  const [licenseData, setLicenseData] = useState({
    licenseNumber: '',
    licenseExpiry: ''
  });

  // Bio
  const [bio, setBio] = useState('');

  // Vehicle types as per model
  const vehicleTypes = [
    { value: 'SEDAN', label: 'Sedan' },
    { value: 'SUV', label: 'SUV' },
    { value: 'HATCHBACK', label: 'Hatchback' },
    { value: 'MPV', label: 'MPV (Multi-Purpose Vehicle)' },
    { value: 'VAN', label: 'Van' },
    { value: 'LUXURY', label: 'Luxury Car' },
    { value: 'MOTORCYCLE', label: 'Motorcycle' },
    { value: 'AUTO', label: 'Auto/Rickshaw' }
  ];

  // Popular car makes in India
  const carMakes = [
    'Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Honda', 'Toyota',
    'Kia', 'MG', 'Volkswagen', 'Skoda', 'Renault', 'Nissan', 'Ford',
    'Jeep', 'BMW', 'Mercedes-Benz', 'Audi', 'Other'
  ];

  const handleVehicleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setVehicleData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handlePreferenceChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPreferences(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleLicenseChange = (e) => {
    const { name, value } = e.target;
    setLicenseData(prev => ({
      ...prev,
      [name]: value.toUpperCase()
    }));
  };

  const validateStep1 = () => {
    if (!vehicleData.vehicleType) {
      setError('Please select vehicle type');
      return false;
    }
    if (!vehicleData.make) {
      setError('Please enter vehicle make/brand');
      return false;
    }
    if (!vehicleData.model) {
      setError('Please enter vehicle model');
      return false;
    }
    if (!vehicleData.year || vehicleData.year < 1990 || vehicleData.year > 2025) {
      setError('Please enter a valid year (1990-2025)');
      return false;
    }
    if (!vehicleData.color) {
      setError('Please enter vehicle color');
      return false;
    }
    if (!vehicleData.licensePlate) {
      setError('Please enter license plate number');
      return false;
    }
    if (!vehicleData.seats || vehicleData.seats < 1 || vehicleData.seats > 8) {
      setError('Please enter valid seating capacity (1-8)');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    // License number validation
    const cleanLicense = licenseData.licenseNumber.replace(/[\s-]/g, '');
    if (!cleanLicense || cleanLicense.length < 10) {
      setError('Please enter a valid license number (min 10 characters)');
      return false;
    }
    if (!licenseData.licenseExpiry) {
      setError('Please enter license expiry date');
      return false;
    }
    const expiryDate = new Date(licenseData.licenseExpiry);
    if (expiryDate <= new Date()) {
      setError('License has expired. Please use a valid license');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    setError('');
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    }
  };

  const handleBack = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateStep3()) return;

    setLoading(true);

    try {
      // Prepare complete profile data
      const profileData = {
        vehicle: {
          vehicleType: vehicleData.vehicleType,
          make: vehicleData.make,
          model: vehicleData.model,
          year: parseInt(vehicleData.year),
          color: vehicleData.color,
          licensePlate: vehicleData.licensePlate.toUpperCase(),
          seats: parseInt(vehicleData.seats),
          acAvailable: vehicleData.acAvailable,
          isDefault: true
        },
        preferences: {
          preferredCoRiderGender: preferences.genderPreference,
          rideComfort: {
            musicPreference: preferences.musicPreference,
            smokingAllowed: preferences.smokingAllowed,
            petsAllowed: preferences.petsAllowed
          }
        },
        license: {
          number: licenseData.licenseNumber.replace(/[\s-]/g, ''),
          expiryDate: licenseData.licenseExpiry
        },
        bio: bio
      };

      await userService.completeRiderProfile(profileData);

      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }

      // Navigate to document upload
      navigate('/user/documents', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  // Redirect if not a rider
  useEffect(() => {
    if (user && user.role !== 'RIDER') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Complete Your Rider Profile</h1>
          <p className="text-lg text-gray-600">Let's get your vehicle details to start offering rides</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {/* Step 1 */}
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= 1 ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                {step > 1 ? '✓' : '1'}
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">Vehicle Details</span>
            </div>
            <div className={`w-16 h-1 ${step > 1 ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>

            {/* Step 2 */}
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= 2 ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                {step > 2 ? '✓' : '2'}
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">Preferences</span>
            </div>
            <div className={`w-16 h-1 ${step > 2 ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>

            {/* Step 3 */}
            <div className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= 3 ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-600'
              }`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">License</span>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && <Alert type="error" message={error} className="mb-6" />}

          {/* Step 1: Vehicle Information */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <i className="fas fa-car-side text-emerald-500 mr-3"></i>
                Vehicle Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vehicle Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vehicle Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="vehicleType"
                    value={vehicleData.vehicleType}
                    onChange={handleVehicleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select vehicle type</option>
                    {vehicleTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Vehicle Make */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Make (Brand) <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="make"
                    value={vehicleData.make}
                    onChange={handleVehicleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Select or type make</option>
                    {carMakes.map(make => (
                      <option key={make} value={make}>{make}</option>
                    ))}
                  </select>
                </div>

                {/* Vehicle Model */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="model"
                    value={vehicleData.model}
                    onChange={handleVehicleChange}
                    required
                    placeholder="e.g., Camry, City, Swift"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* Year */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="year"
                    value={vehicleData.year}
                    onChange={handleVehicleChange}
                    required
                    min="1990"
                    max="2025"
                    placeholder="2020"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* Color */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="color"
                    value={vehicleData.color}
                    onChange={handleVehicleChange}
                    required
                    placeholder="e.g., White, Black, Silver"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>

                {/* License Plate */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    License Plate Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="licensePlate"
                    value={vehicleData.licensePlate}
                    onChange={(e) => setVehicleData(prev => ({ ...prev, licensePlate: e.target.value.toUpperCase() }))}
                    required
                    placeholder="KA01AB1234"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent uppercase"
                  />
                </div>

                {/* Seating Capacity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seating Capacity <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="seats"
                    value={vehicleData.seats}
                    onChange={handleVehicleChange}
                    required
                    min="1"
                    max="8"
                    placeholder="4"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Total seats available for passengers</p>
                </div>

                {/* AC Available */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="acAvailable"
                    id="acAvailable"
                    checked={vehicleData.acAvailable}
                    onChange={handleVehicleChange}
                    className="w-5 h-5 text-emerald-500 focus:ring-emerald-500 border-gray-300 rounded"
                  />
                  <label htmlFor="acAvailable" className="ml-3 text-sm font-medium text-gray-700">
                    Air Conditioning Available
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Riding Preferences */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="text-emerald-500 mr-3">⚙️</span>
                Riding Preferences
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Gender Preference */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Passenger Gender Preference
                  </label>
                  <select
                    name="genderPreference"
                    value={preferences.genderPreference}
                    onChange={handlePreferenceChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="ANY">Any</option>
                    <option value="MALE_ONLY">Male Only</option>
                    <option value="FEMALE_ONLY">Female Only</option>
                    <option value="SAME_GENDER">Same Gender Only</option>
                  </select>
                </div>

                {/* Music Preference */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Music Preference
                  </label>
                  <select
                    name="musicPreference"
                    value={preferences.musicPreference}
                    onChange={handlePreferenceChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="NO_MUSIC">No Music</option>
                    <option value="SOFT_MUSIC">Soft Music</option>
                    <option value="ANY_MUSIC">Any Music</option>
                    <option value="OPEN_TO_REQUESTS">Open to Requests</option>
                  </select>
                </div>

                {/* Smoking */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="smokingAllowed"
                    id="smokingAllowed"
                    checked={preferences.smokingAllowed}
                    onChange={handlePreferenceChange}
                    className="w-5 h-5 text-emerald-500 focus:ring-emerald-500 border-gray-300 rounded"
                  />
                  <label htmlFor="smokingAllowed" className="ml-3 text-sm font-medium text-gray-700">
                    Smoking Allowed
                  </label>
                </div>

                {/* Pets */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="petsAllowed"
                    id="petsAllowed"
                    checked={preferences.petsAllowed}
                    onChange={handlePreferenceChange}
                    className="w-5 h-5 text-emerald-500 focus:ring-emerald-500 border-gray-300 rounded"
                  />
                  <label htmlFor="petsAllowed" className="ml-3 text-sm font-medium text-gray-700">
                    Pets Allowed
                  </label>
                </div>
              </div>

              {/* Bio */}
              <div className="mt-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                  <span className="text-emerald-500 mr-3">ℹ️</span>
                  About You
                </h3>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio / Description
                </label>
                <textarea
                  name="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows="4"
                  placeholder="Tell passengers a bit about yourself and your riding style..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  maxLength={500}
                />
                <p className="mt-2 text-sm text-gray-500">
                  {bio.length}/500 characters • This helps passengers feel comfortable riding with you.
                </p>
              </div>
            </div>
          )}

          {/* Step 3: License Information */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <span className="text-emerald-500 mr-3">🪪</span>
                Driver's License Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* License Number */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    License Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="licenseNumber"
                    value={licenseData.licenseNumber}
                    onChange={handleLicenseChange}
                    required
                    placeholder="DL1420110012345 or KA0120210012345"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent uppercase"
                  />
                  <p className="text-xs text-gray-500 mt-1">Enter as shown on your license</p>
                </div>

                {/* License Expiry */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    License Expiry Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="licenseExpiry"
                    value={licenseData.licenseExpiry}
                    onChange={(e) => setLicenseData(prev => ({ ...prev, licenseExpiry: e.target.value }))}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Important Note */}
              <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <span className="text-blue-500 text-xl">ℹ️</span>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Next Step:</strong> After completing this form, you'll need to upload your 
                      verification documents (Driver's License, Aadhar Card, RC Book, Insurance) before 
                      you can start offering rides.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-8 mt-8 border-t border-gray-200">
            {step === 1 ? (
              <button
                onClick={handleSkip}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                ← Skip for Now
              </button>
            ) : (
              <button
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                ← Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={handleNext}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition flex items-center"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    Continue to Documents →
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Need help? <a href="mailto:support@looplane.com" className="text-emerald-500 hover:underline font-medium">Contact Support</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;
