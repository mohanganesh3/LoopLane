import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';

const AdminVerifications = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  
  // Document viewer modal
  const [showDocModal, setShowDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  
  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectUserId, setRejectUserId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    let isMounted = true;
    
    const loadVerifications = async () => {
      setLoading(true);
      try {
        const page = searchParams.get('page') || 1;
        const response = await adminService.getPendingVerifications({ page });
        if (isMounted) {
          if (response && response.success) {
            setRequests(response.verifications || response.requests || []);
            setPagination(response.pagination || { page: 1, pages: 1 });
          }
        }
      } catch (err) {
        if (isMounted) {
          // Don't show error for auth issues
          if (err.response?.status !== 401 && err.response?.status !== 403) {
            setError(err.response?.data?.message || err.message || 'Failed to load verifications');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadVerifications();
    
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const page = searchParams.get('page') || 1;
      const response = await adminService.getPendingVerifications({ page });
      if (response && response.success) {
        setRequests(response.verifications || response.requests || []);
        setPagination(response.pagination || { page: 1, pages: 1 });
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError(err.response?.data?.message || err.message || 'Failed to load verifications');
      }
    } finally {
      setLoading(false);
    }
  };

  const viewDocument = (url, name) => {
    console.log('📄 Viewing document:', { name, url });
    setDocUrl(url);
    setDocTitle(name);
    setShowDocModal(true);
  };

  const handleApprove = async (userId) => {
    if (!window.confirm('Are you sure you want to APPROVE this driver verification?')) return;
    
    try {
      const response = await adminService.verifyLicense(userId, { approved: true });
      if (response.success) {
        setSuccess('Driver verification approved successfully!');
        setRequests(requests.filter(r => r._id !== userId));
      }
    } catch (err) {
      setError(err.message || 'Failed to approve verification');
    }
  };

  const openRejectModal = (userId) => {
    setRejectUserId(userId);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }
    
    try {
      const response = await adminService.rejectLicense(rejectUserId, rejectReason);
      if (response.success) {
        setSuccess('Driver verification rejected');
        setRequests(requests.filter(r => r._id !== rejectUserId));
        setShowRejectModal(false);
      }
    } catch (err) {
      setError(err.message || 'Failed to reject verification');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Driver Verifications</h1>
          <p className="text-gray-500 text-sm">Review and approve driver license verifications</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-6" />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess('')} className="mb-6" />}

        {requests.length > 0 ? (
          <div className="space-y-6">
            {requests.map((request) => {
              // Debug: Log request data
              console.log('📋 Verification Request:', {
                id: request._id,
                email: request.email,
                documents: request.documents,
                vehicles: request.vehicles
              });
              
              return (
              <div
                key={request._id}
                className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-indigo-400 hover:shadow-lg transition-all"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    {getUserPhoto(request) ? (
                      <img
                        src={getUserPhoto(request)}
                        alt={getUserDisplayName(request)}
                        className="w-14 h-14 rounded-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div 
                      className={`w-14 h-14 rounded-full ${getAvatarColor(getUserDisplayName(request))} text-white flex items-center justify-center text-xl font-bold`}
                      style={{ display: getUserPhoto(request) ? 'none' : 'flex' }}
                    >
                      {getInitials(getUserDisplayName(request))}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {getUserDisplayName(request)}</h3>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
                        <span><i className="fas fa-envelope mr-1"></i> {request.email}</span>
                        <span><i className="fas fa-phone mr-1"></i> {request.phone}</span>
                        <span><i className="fas fa-calendar mr-1"></i> Applied {new Date(request.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-4 py-2 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
                    <i className="fas fa-hourglass-half mr-1"></i> Pending Review
                  </span>
                </div>

                {/* Documents Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {/* Driver's License */}
                  {(request.documents?.driverLicense?.frontImage || request.documents?.drivingLicense?.url) && (
                    <button
                      onClick={() => viewDocument(
                        request.documents?.driverLicense?.frontImage || request.documents?.drivingLicense?.url, 
                        'Driving License'
                      )}
                      className="p-4 border border-gray-200 rounded-lg text-center hover:border-indigo-400 hover:bg-gray-50 transition"
                    >
                      <div className="text-4xl text-indigo-500 mb-2"><i className="fas fa-id-card"></i></div>
                      <div className="text-sm font-semibold text-gray-700">Driving License</div>
                      <div className="text-xs text-green-600 mt-1"><i className="fas fa-check mr-1"></i>Uploaded</div>
                    </button>
                  )}
                  
                  {/* Aadhar/Government ID */}
                  {(request.documents?.governmentId?.frontImage || request.documents?.aadharCard?.url) && (
                    <button
                      onClick={() => viewDocument(
                        request.documents?.governmentId?.frontImage || request.documents?.aadharCard?.url, 
                        'Aadhar Card'
                      )}
                      className="p-4 border border-gray-200 rounded-lg text-center hover:border-indigo-400 hover:bg-gray-50 transition"
                    >
                      <div className="text-4xl text-indigo-500 mb-2"><i className="fas fa-address-card"></i></div>
                      <div className="text-sm font-semibold text-gray-700">Aadhar Card</div>
                      <div className="text-xs text-green-600 mt-1"><i className="fas fa-check mr-1"></i>Uploaded</div>
                    </button>
                  )}
                  
                  {/* Vehicle RC - check both vehicle and documents */}
                  {(request.vehicles?.[0]?.registrationDocument || request.documents?.vehicleRC?.url) && (
                    <button
                      onClick={() => viewDocument(
                        request.vehicles?.[0]?.registrationDocument || request.documents?.vehicleRC?.url, 
                        'Vehicle RC'
                      )}
                      className="p-4 border border-gray-200 rounded-lg text-center hover:border-indigo-400 hover:bg-gray-50 transition"
                    >
                      <div className="text-4xl text-indigo-500 mb-2"><i className="fas fa-file-alt"></i></div>
                      <div className="text-sm font-semibold text-gray-700">Vehicle RC</div>
                      <div className="text-xs text-green-600 mt-1"><i className="fas fa-check mr-1"></i>Uploaded</div>
                    </button>
                  )}
                  
                  {/* Insurance */}
                  {(request.documents?.insurance?.document || request.documents?.vehicleInsurance?.url) && (
                    <button
                      onClick={() => viewDocument(
                        request.documents?.insurance?.document || request.documents?.vehicleInsurance?.url, 
                        'Insurance'
                      )}
                      className="p-4 border border-gray-200 rounded-lg text-center hover:border-indigo-400 hover:bg-gray-50 transition"
                    >
                      <div className="text-4xl text-indigo-500 mb-2"><i className="fas fa-shield-alt"></i></div>
                      <div className="text-sm font-semibold text-gray-700">Insurance</div>
                      <div className="text-xs text-green-600 mt-1"><i className="fas fa-check mr-1"></i>Uploaded</div>
                    </button>
                  )}
                </div>

                {/* Vehicle Information */}
                {request.vehicles && request.vehicles.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-gray-700 mb-3"><i className="fas fa-car mr-2"></i>Vehicle Details</h4>
                    {request.vehicles.map((vehicle, index) => (
                      <div key={index} className="text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                        <span className="font-medium">{vehicle.make} {vehicle.model}</span>
                        {vehicle.year && <span>({vehicle.year})</span>}
                        {vehicle.licensePlate && <span className="font-mono bg-gray-200 px-2 rounded">{vehicle.licensePlate}</span>}
                        {vehicle.color && <span>• {vehicle.color}</span>}
                        {vehicle.seats && <span>• {vehicle.seats} seats</span>}
                        {vehicle.vehicleType && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            {vehicle.vehicleType}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => handleApprove(request._id)}
                    className="px-6 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition"
                  >
                    <i className="fas fa-check-circle mr-1"></i> Approve
                  </button>
                  <button
                    onClick={() => openRejectModal(request._id)}
                    className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
                  >
                    <i className="fas fa-times-circle mr-1"></i> Reject
                  </button>
                </div>
              </div>
            );
            })}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setSearchParams({ page: page.toString() })}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      page === pagination.page
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl p-16 text-center">
            <div className="text-6xl text-gray-300 mb-4"><i className="fas fa-check-circle"></i></div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Pending Verifications</h3>
            <p className="text-gray-500">All driver verification requests have been processed.</p>
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-bold text-gray-900">{docTitle}</h2>
              <button 
                onClick={() => setShowDocModal(false)} 
                className="text-gray-500 hover:text-gray-700 text-2xl p-2 hover:bg-gray-100 rounded-full"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {docUrl ? (
                <div className="text-center">
                  {/* Check if it's a PDF */}
                  {docUrl.toLowerCase().includes('.pdf') ? (
                    <div className="space-y-4">
                      <iframe 
                        src={docUrl} 
                        className="w-full h-[70vh] border rounded-lg"
                        title={docTitle}
                      />
                      <a 
                        href={docUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                      >
                        <i className="fas fa-external-link-alt mr-2"></i>
                        Open PDF in New Tab
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <img 
                        src={docUrl} 
                        alt={docTitle} 
                        className="max-w-full max-h-[70vh] mx-auto rounded-lg shadow-lg"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'block';
                        }}
                      />
                      <div className="hidden bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                        <i className="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                        <p className="text-red-700 font-semibold mb-2">Failed to load image</p>
                        <p className="text-sm text-gray-600 mb-4 break-all">URL: {docUrl}</p>
                        <a 
                          href={docUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
                        >
                          <i className="fas fa-external-link-alt mr-2"></i>
                          Try Opening in New Tab
                        </a>
                      </div>
                      <div className="flex justify-center gap-3">
                        <a 
                          href={docUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                        >
                          <i className="fas fa-external-link-alt mr-2"></i>
                          Open in New Tab
                        </a>
                        <a 
                          href={docUrl} 
                          download={docTitle}
                          className="inline-flex items-center px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                        >
                          <i className="fas fa-download mr-2"></i>
                          Download
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <i className="fas fa-file-excel text-gray-300 text-6xl mb-4"></i>
                  <p className="text-gray-500 font-semibold">No document URL available</p>
                  <p className="text-sm text-gray-400 mt-2">The document might not have been uploaded correctly</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reject Verification</h2>
            <p className="text-gray-600 mb-4">Please provide a reason for rejection:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
              >
                Reject Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVerifications;
