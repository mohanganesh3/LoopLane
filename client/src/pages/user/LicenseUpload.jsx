import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import { LoadingSpinner, Alert } from '../../components/common';

const LicenseUpload = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    licenseNumber: '',
    licenseExpiry: '',
    licenseType: 'LMV', // Light Motor Vehicle
    licenseState: ''
  });
  const [licenseImage, setLicenseImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: Upload, 2: Details, 3: Success

  // Indian states for dropdown
  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Puducherry'
  ];

  const licenseTypes = [
    { value: 'LMV', label: 'LMV - Light Motor Vehicle' },
    { value: 'MCWG', label: 'MCWG - Motorcycle with Gear' },
    { value: 'MCWOG', label: 'MCWOG - Motorcycle without Gear' },
    { value: 'HMV', label: 'HMV - Heavy Motor Vehicle' },
    { value: 'TRANS', label: 'TRANS - Transport Vehicle' }
  ];

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg'];
      if (!validTypes.includes(file.type)) {
        setError('Please upload a valid image file (JPEG or PNG)');
        return;
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size should be less than 5MB');
        return;
      }

      setLicenseImage(file);
      setError('');

      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Validate license number format
  const validateLicenseNumber = (number) => {
    // Indian DL format: STATE CODE + RTO CODE + YEAR + NUMBER
    // Example: KA01 20210012345
    const pattern = /^[A-Z]{2}[0-9]{2}\s?[0-9]{4}[0-9]{7}$/;
    return pattern.test(number.replace(/\s/g, ''));
  };

  // Handle step 1: Upload image
  const handleUploadNext = () => {
    if (!licenseImage) {
      setError('Please upload your driving license image');
      return;
    }
    setStep(2);
    setError('');
  };

  // Handle step 2: Submit details
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate all fields
    if (!formData.licenseNumber || !formData.licenseExpiry || !formData.licenseState) {
      setError('Please fill in all required fields');
      return;
    }

    // Validate license number format
    if (!validateLicenseNumber(formData.licenseNumber)) {
      setError('Invalid license number format. Example: KA01 20210012345');
      return;
    }

    // Validate expiry date
    const expiryDate = new Date(formData.licenseExpiry);
    if (expiryDate <= new Date()) {
      setError('License has expired. Please provide a valid license');
      return;
    }

    setLoading(true);

    try {
      // Create form data for upload
      const uploadData = new FormData();
      uploadData.append('licenseImage', licenseImage);
      uploadData.append('licenseNumber', formData.licenseNumber.replace(/\s/g, ''));
      uploadData.append('licenseExpiry', formData.licenseExpiry);
      uploadData.append('licenseType', formData.licenseType);
      uploadData.append('licenseState', formData.licenseState);

      await userService.uploadLicense(uploadData);
      
      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }
      
      setStep(3);
    } catch (err) {
      setError(err.message || 'Failed to upload license. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle skip
  const handleSkip = () => {
    navigate('/user/dashboard');
  };

  // Handle completion
  const handleComplete = () => {
    navigate('/user/dashboard');
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-12">
      <div className="container mx-auto px-4 max-w-2xl">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition ${
                  step >= s 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s ? <i className="fas fa-check"></i> : s}
                </div>
                {s < 3 && (
                  <div className={`w-16 h-1 mx-2 ${
                    step > s ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 px-4">
            <span className="text-sm text-gray-600">Upload</span>
            <span className="text-sm text-gray-600">Details</span>
            <span className="text-sm text-gray-600">Done</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-emerald-500 text-white p-6">
            <h1 className="text-2xl font-bold flex items-center">
              <i className="fas fa-id-card mr-3"></i>
              {step === 1 && 'Upload Driving License'}
              {step === 2 && 'License Details'}
              {step === 3 && 'Verification Submitted'}
            </h1>
            <p className="text-emerald-100 mt-1">
              {step === 1 && 'Required to post rides and become a verified driver'}
              {step === 2 && 'Please enter your license information'}
              {step === 3 && 'Your license is under review'}
            </p>
          </div>

          {/* Content */}
          <div className="p-6">
            {error && <Alert type="error" message={error} className="mb-6" />}

            {/* Step 1: Upload Image */}
            {step === 1 && (
              <div>
                {/* Upload Area */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${
                    imagePreview 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : 'border-gray-300 hover:border-emerald-500 hover:bg-gray-50'
                  }`}
                >
                  {imagePreview ? (
                    <div>
                      <img 
                        src={imagePreview} 
                        alt="License Preview" 
                        className="max-h-64 mx-auto rounded-lg shadow-md mb-4"
                      />
                      <p className="text-emerald-600 font-medium">
                        <i className="fas fa-check-circle mr-2"></i>
                        Image uploaded successfully
                      </p>
                      <p className="text-sm text-gray-500 mt-1">Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i className="fas fa-cloud-upload-alt text-gray-400 text-3xl"></i>
                      </div>
                      <p className="text-gray-700 font-medium mb-1">
                        Click to upload your driving license
                      </p>
                      <p className="text-sm text-gray-500">
                        JPEG or PNG, max 5MB
                      </p>
                    </div>
                  )}
                </div>

                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept="image/jpeg,image/png,image/jpg"
                  className="hidden"
                />

                {/* Guidelines */}
                <div className="mt-6 bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-800 mb-2">
                    <i className="fas fa-info-circle mr-2"></i>Upload Guidelines
                  </h3>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• Upload a clear photo of your driving license</li>
                    <li>• Both front and back should be visible (if combined)</li>
                    <li>• Ensure all text is readable</li>
                    <li>• Avoid glare or shadows on the image</li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={handleSkip}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    Skip for Now
                  </button>
                  <button
                    onClick={handleUploadNext}
                    disabled={!licenseImage}
                    className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue <i className="fas fa-arrow-right ml-2"></i>
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: License Details */}
            {step === 2 && (
              <form onSubmit={handleSubmit}>
                {/* License Preview */}
                {imagePreview && (
                  <div className="mb-6">
                    <img 
                      src={imagePreview} 
                      alt="License" 
                      className="h-40 mx-auto rounded-lg shadow-md"
                    />
                  </div>
                )}

                <div className="space-y-4">
                  {/* License Number */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={handleInputChange}
                      placeholder="e.g., KA01 20210012345"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Enter as shown on your license
                    </p>
                  </div>

                  {/* License Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      License Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="licenseType"
                      value={formData.licenseType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      {licenseTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* License State */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Issuing State <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="licenseState"
                      value={formData.licenseState}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    >
                      <option value="">Select State</option>
                      {indianStates.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </div>

                  {/* Expiry Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Expiry Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="licenseExpiry"
                      value={formData.licenseExpiry}
                      onChange={handleInputChange}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                  >
                    <i className="fas fa-arrow-left mr-2"></i>Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {loading ? (
                      <>
                        <i className="fas fa-spinner fa-spin mr-2"></i>Submitting...
                      </>
                    ) : (
                      <>
                        Submit for Verification <i className="fas fa-check ml-2"></i>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Success */}
            {step === 3 && (
              <div className="text-center py-8">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <i className="fas fa-check-circle text-green-500 text-5xl"></i>
                </div>
                
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  License Submitted Successfully!
                </h2>
                <p className="text-gray-600 mb-6">
                  Your driving license has been submitted for verification. 
                  We'll notify you once it's approved (usually within 24-48 hours).
                </p>

                <div className="bg-yellow-50 rounded-lg p-4 mb-6 text-left">
                  <h3 className="font-semibold text-yellow-800 mb-2">
                    <i className="fas fa-clock mr-2"></i>What's Next?
                  </h3>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    <li>• Our team will verify your license details</li>
                    <li>• You'll receive an email notification on approval</li>
                    <li>• Once verified, you can post rides as a driver</li>
                    <li>• Your profile will show a verified badge</li>
                  </ul>
                </div>

                <button
                  onClick={handleComplete}
                  className="px-8 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition"
                >
                  Go to Dashboard <i className="fas fa-arrow-right ml-2"></i>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LicenseUpload;
