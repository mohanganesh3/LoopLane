import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import { Alert } from '../../components/common';

const DocumentUpload = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // File refs
  const driverLicenseFrontRef = useRef(null);
  const driverLicenseBackRef = useRef(null);
  const aadharCardRef = useRef(null);
  const rcBookRef = useRef(null);
  const insuranceRef = useRef(null);
  const vehiclePhotosRef = useRef(null);

  // File states
  const [files, setFiles] = useState({
    driverLicenseFront: null,
    driverLicenseBack: null,
    aadharCard: null,
    rcBook: null,
    insurance: null
  });

  const [previews, setPreviews] = useState({
    driverLicenseFront: null,
    driverLicenseBack: null,
    aadharCard: null,
    rcBook: null,
    insurance: null
  });

  const [vehiclePhotos, setVehiclePhotos] = useState([]);
  const [vehiclePhotoPreviews, setVehiclePhotoPreviews] = useState([]);

  // Handle single file selection
  const handleFileSelect = (field, refEl) => {
    const file = refEl.current?.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a valid file (JPEG, PNG, or PDF)');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size must not exceed 5MB');
      return;
    }

    setFiles(prev => ({ ...prev, [field]: file }));
    setError('');

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviews(prev => ({ ...prev, [field]: e.target.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setPreviews(prev => ({ ...prev, [field]: 'pdf' }));
    }
  };

  // Handle multiple vehicle photos
  const handleVehiclePhotos = () => {
    const newFiles = Array.from(vehiclePhotosRef.current?.files || []);

    // Validate each file
    for (const file of newFiles) {
      if (!file.type.startsWith('image/')) {
        setError('Vehicle photos must be images only');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Each photo must be less than 5MB');
        return;
      }
    }

    // Limit to 5 photos total
    const combinedPhotos = [...vehiclePhotos, ...newFiles].slice(0, 5);
    setVehiclePhotos(combinedPhotos);
    setError('');

    // Create previews
    const newPreviews = [];
    combinedPhotos.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        newPreviews.push(e.target.result);
        if (newPreviews.length === combinedPhotos.length) {
          setVehiclePhotoPreviews([...newPreviews]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove a vehicle photo
  const removeVehiclePhoto = (index) => {
    setVehiclePhotos(prev => prev.filter((_, i) => i !== index));
    setVehiclePhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate required documents
    if (!files.driverLicenseFront) {
      setError('Driver\'s License (Front) is required');
      return;
    }
    if (!files.aadharCard) {
      setError('Aadhar Card is required');
      return;
    }
    if (!files.rcBook) {
      setError('Vehicle RC (Registration Certificate) is required');
      return;
    }
    if (!files.insurance) {
      setError('Vehicle Insurance is required');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();

      // Add required documents
      formData.append('driverLicenseFront', files.driverLicenseFront);
      if (files.driverLicenseBack) {
        formData.append('driverLicenseBack', files.driverLicenseBack);
      }
      formData.append('aadharCard', files.aadharCard);
      formData.append('rcBook', files.rcBook);
      formData.append('insurance', files.insurance);

      // Add vehicle photos
      vehiclePhotos.forEach(photo => {
        formData.append('vehiclePhotos', photo);
      });

      await userService.uploadDocuments(formData);

      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }

      setSuccess('Documents uploaded successfully! Your profile is under review.');

      // Navigate to dashboard after delay
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);

    } catch (err) {
      setError(err.message || 'Failed to upload documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle skip
  const handleSkip = () => {
    navigate('/dashboard');
  };

  // Redirect if not a rider
  useEffect(() => {
    if (user && user.role !== 'RIDER') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Document upload card component
  const DocumentCard = ({ title, description, field, required, refEl, iconClass }) => (
    <div className="mb-8">
      <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
        <i className={`fas ${iconClass} text-emerald-500 mr-3`}></i>
        {title}
        {required && <span className="ml-2 text-sm text-red-500">*Required</span>}
      </h3>
      <p className="text-sm text-gray-600 mb-4">{description}</p>

      <div
        onClick={() => refEl.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${previews[field]
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-gray-300 hover:border-emerald-500 hover:bg-gray-50'
          }`}
      >
        <input
          type="file"
          ref={refEl}
          onChange={() => handleFileSelect(field, refEl)}
          accept="image/*,.pdf"
          className="hidden"
        />

        {previews[field] ? (
          <div>
            {previews[field] === 'pdf' ? (
              <div className="flex items-center justify-center">
                <i className="fas fa-file-pdf text-4xl text-red-500"></i>
                <span className="ml-2 text-gray-600">{files[field]?.name}</span>
              </div>
            ) : (
              <img
                src={previews[field]}
                alt={title}
                className="max-h-48 mx-auto rounded-lg shadow-md"
              />
            )}
            <p className="text-emerald-600 font-medium mt-2">
              ✓ Uploaded • Click to change
            </p>
          </div>
        ) : (
          <div>
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-cloud-upload-alt text-gray-400 text-2xl"></i>
            </div>
            <p className="text-gray-600">Click to upload or drag and drop</p>
            <p className="text-sm text-gray-500 mt-1">PNG, JPG, PDF up to 5MB</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-12 px-4" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-500 rounded-full mb-4">
            <i className="fas fa-folder-open text-3xl text-white"></i>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>Upload Verification Documents</h1>
          <p className="text-lg text-gray-600">Upload your documents to get verified and start offering rides</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">Account Created</span>
            </div>
            <div className="w-16 h-1 bg-emerald-500"></div>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                ✓
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">Vehicle Details</span>
            </div>
            <div className="w-16 h-1 bg-emerald-500"></div>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">
                3
              </div>
              <span className="ml-2 text-sm font-medium text-gray-700">Documents</span>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && <Alert type="error" message={error} className="mb-6" />}
          {success && <Alert type="success" message={success} className="mb-6" />}

          <form onSubmit={handleSubmit}>
            {/* Driver's License Front */}
            <DocumentCard
              title="Driver's License (Front)"
              description="Upload a clear photo of the front side of your driver's license"
              field="driverLicenseFront"
              required={true}
              refEl={driverLicenseFrontRef}
              icon="🪪"
            />

            {/* Driver's License Back */}
            <DocumentCard
              title="Driver's License (Back)"
              description="Upload a clear photo of the back side of your driver's license"
              field="driverLicenseBack"
              required={false}
              refEl={driverLicenseBackRef}
              icon="🪪"
            />

            {/* Aadhar Card */}
            <DocumentCard
              title="Aadhar Card"
              description="Upload a clear photo of your Aadhar card (front or both sides)"
              field="aadharCard"
              required={true}
              refEl={aadharCardRef}
              icon="🆔"
            />

            {/* Vehicle RC */}
            <DocumentCard
              title="Vehicle RC (Registration Certificate)"
              description="Upload your vehicle registration certificate"
              field="rcBook"
              required={true}
              refEl={rcBookRef}
              iconClass="fa-file-alt"
            />

            {/* Vehicle Insurance */}
            <DocumentCard
              title="Vehicle Insurance"
              description="Upload your valid vehicle insurance document"
              field="insurance"
              required={true}
              refEl={insuranceRef}
              iconClass="fa-shield-alt"
            />

            {/* Vehicle Photos */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center">
                <i className="fas fa-camera text-emerald-500 mr-3"></i>
                Vehicle Photos
                <span className="ml-2 text-sm text-gray-500">(Optional but recommended)</span>
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Upload clear photos of your vehicle - front, side, interior (Maximum 5 photos)
              </p>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-emerald-500 transition">
                <input
                  type="file"
                  ref={vehiclePhotosRef}
                  onChange={handleVehiclePhotos}
                  accept="image/*"
                  multiple
                  className="hidden"
                />

                {vehiclePhotoPreviews.length > 0 ? (
                  <div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                      {vehiclePhotoPreviews.map((preview, index) => (
                        <div key={index} className="relative group">
                          <img
                            src={preview}
                            alt={`Vehicle ${index + 1}`}
                            className="w-full h-40 object-cover rounded-lg shadow-md border-2 border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeVehiclePhoto(index)}
                            className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-lg"
                          >
                            ✕
                          </button>
                          <div className="absolute bottom-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                            Photo {index + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
                        <span className="font-semibold">{vehiclePhotos.length}</span> of <span className="font-semibold">5</span> photos
                      </div>
                      {vehiclePhotos.length < 5 && (
                        <button
                          type="button"
                          onClick={() => vehiclePhotosRef.current?.click()}
                          className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                        >
                          + Add More Photos
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => vehiclePhotosRef.current?.click()}
                    className="text-center cursor-pointer"
                  >
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <i className="fas fa-camera text-gray-400 text-2xl"></i>
                    </div>
                    <p className="text-gray-600">Click to upload multiple photos</p>
                    <p className="text-sm text-gray-500 mt-1">PNG, JPG up to 5MB each • Maximum 5 photos</p>
                  </div>
                )}
              </div>
            </div>

            {/* Important Notes */}
            <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <div className="flex">
                <span className="text-yellow-500 text-xl mr-3"><i className="fas fa-exclamation-triangle"></i></span>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800 mb-2">Important Guidelines:</h4>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    <li>All documents must be valid and not expired</li>
                    <li>Photos should be clear and readable</li>
                    <li>File size should not exceed 5MB per file</li>
                    <li>Accepted formats: JPG, PNG, PDF</li>
                    <li>Verification usually takes 24-48 hours</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={handleSkip}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                ← Upload Later
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading...
                  </>
                ) : (
                  <>
                    Submit for Verification ✓
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Having trouble uploading? <a href="mailto:support@looplane.in" className="text-emerald-500 hover:underline font-medium">Get Help</a>
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default DocumentUpload;
