import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';

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
    fetchVerifications();
  }, [searchParams]);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const page = searchParams.get('page') || 1;
      const response = await adminService.getPendingVerifications({ page });
      if (response.success) {
        setRequests(response.requests || []);
        setPagination(response.pagination || { page: 1, pages: 1 });
      }
    } catch (err) {
      setError(err.message || 'Failed to load verifications');
    } finally {
      setLoading(false);
    }
  };

  const viewDocument = (url, name) => {
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
            {requests.map((request) => (
              <div
                key={request._id}
                className="bg-white rounded-xl p-6 border-2 border-gray-200 hover:border-indigo-400 hover:shadow-lg transition-all"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-4">
                    <img
                      src={request.profile?.photo || '/images/default-avatar.png'}
                      alt={request.profile?.firstName}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {request.profile?.firstName} {request.profile?.lastName}
                      </h3>
                      <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
                        <span>📧 {request.email}</span>
                        <span>📱 {request.phone}</span>
                        <span>📅 Applied {new Date(request.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <span className="px-4 py-2 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">
                    ⏳ Pending Review
                  </span>
                </div>

                {/* Documents Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {request.documents?.drivingLicense && (
                    <button
                      onClick={() => viewDocument(request.documents.drivingLicense.url, 'Driving License')}
                      className="p-4 border border-gray-200 rounded-lg text-center hover:border-indigo-400 hover:bg-gray-50 transition"
                    >
                      <div className="text-4xl text-indigo-500 mb-2">🪪</div>
                      <div className="text-sm font-semibold text-gray-700">Driving License</div>
                    </button>
                  )}
                  
                  {request.documents?.aadharCard && (
                    <button
                      onClick={() => viewDocument(request.documents.aadharCard.url, 'Aadhar Card')}
                      className="p-4 border border-gray-200 rounded-lg text-center hover:border-indigo-400 hover:bg-gray-50 transition"
                    >
                      <div className="text-4xl text-indigo-500 mb-2">🆔</div>
                      <div className="text-sm font-semibold text-gray-700">Aadhar Card</div>
                    </button>
                  )}
                  
                  {request.documents?.vehicleRC && (
                    <button
                      onClick={() => viewDocument(request.documents.vehicleRC.url, 'Vehicle RC')}
                      className="p-4 border border-gray-200 rounded-lg text-center hover:border-indigo-400 hover:bg-gray-50 transition"
                    >
                      <div className="text-4xl text-indigo-500 mb-2">📄</div>
                      <div className="text-sm font-semibold text-gray-700">Vehicle RC</div>
                    </button>
                  )}
                  
                  {request.documents?.vehicleInsurance && (
                    <button
                      onClick={() => viewDocument(request.documents.vehicleInsurance.url, 'Insurance')}
                      className="p-4 border border-gray-200 rounded-lg text-center hover:border-indigo-400 hover:bg-gray-50 transition"
                    >
                      <div className="text-4xl text-indigo-500 mb-2">🛡️</div>
                      <div className="text-sm font-semibold text-gray-700">Insurance</div>
                    </button>
                  )}
                </div>

                {/* Vehicle Information */}
                {request.vehicles && request.vehicles.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-gray-700 mb-3">🚗 Vehicle Details</h4>
                    {request.vehicles.map((vehicle, index) => (
                      <div key={index} className="text-gray-600">
                        <span className="font-medium">{vehicle.make} {vehicle.model}</span>
                        {' '}({vehicle.year}) - {vehicle.registrationNumber} - {vehicle.seats} seats
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
                    ✅ Approve
                  </button>
                  <button
                    onClick={() => openRejectModal(request._id)}
                    className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
                  >
                    ❌ Reject
                  </button>
                </div>
              </div>
            ))}

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
            <div className="text-6xl text-gray-300 mb-4">✅</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No Pending Verifications</h3>
            <p className="text-gray-500">All driver verification requests have been processed.</p>
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">{docTitle}</h2>
              <button onClick={() => setShowDocModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>
            <div className="text-center">
              <img src={docUrl} alt={docTitle} className="max-w-full rounded-lg" />
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
