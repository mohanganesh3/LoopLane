import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';
import { cn } from '@/lib/utils';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';
import {
  Loader2, Mail, Phone, Calendar, Clock, CheckCircle, XCircle,
  CreditCard, IdCard, FileText, Shield, Car, ExternalLink, Download,
  AlertTriangle, X, FileX2
} from 'lucide-react';

const AdminVerifications = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1 });
  
  const [showDocModal, setShowDocModal] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docUrl, setDocUrl] = useState('');
  
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
        if (isMounted && response?.success) {
          setRequests(response.verifications || response.requests || []);
          setPagination(response.pagination || { page: 1, pages: 1 });
        }
      } catch (err) {
        if (isMounted && err.response?.status !== 401 && err.response?.status !== 403) {
          setError(err.response?.data?.message || err.message || 'Failed to load verifications');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadVerifications();
    return () => { isMounted = false; };
  }, [searchParams]);

  const fetchVerifications = async () => {
    setLoading(true);
    try {
      const page = searchParams.get('page') || 1;
      const response = await adminService.getPendingVerifications({ page });
      if (response?.success) {
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
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Driver Verifications</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Review and approve driver license verifications</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-4" />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess('')} className="mb-4" />}

        {requests.length > 0 ? (
          <div className="space-y-4">
            {requests.map((request) => (
              <div
                key={request._id}
                className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    {getUserPhoto(request) ? (
                      <img
                        src={getUserPhoto(request)}
                        alt={getUserDisplayName(request)}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div 
                      className={`w-10 h-10 rounded-full ${getAvatarColor(getUserDisplayName(request))} text-white flex items-center justify-center text-sm font-medium`}
                      style={{ display: getUserPhoto(request) ? 'none' : 'flex' }}
                    >
                      {getInitials(getUserDisplayName(request))}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{getUserDisplayName(request)}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        <span className="flex items-center gap-1"><Mail size={10} /> {request.email}</span>
                        <span className="flex items-center gap-1"><Phone size={10} /> {request.phone}</span>
                        <span className="flex items-center gap-1"><Calendar size={10} /> Applied {new Date(request.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-800">
                    <Clock size={10} /> Pending Review
                  </span>
                </div>

                {/* Documents Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                  {(request.documents?.driverLicense?.frontImage || request.documents?.drivingLicense?.url) && (
                    <button
                      onClick={() => viewDocument(request.documents?.driverLicense?.frontImage || request.documents?.drivingLicense?.url, 'Driving License')}
                      className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-md text-center hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <CreditCard size={18} className="mx-auto mb-1.5 text-zinc-400" />
                      <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Driving License</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center justify-center gap-0.5"><CheckCircle size={9} />Uploaded</div>
                    </button>
                  )}
                  
                  {(request.documents?.governmentId?.frontImage || request.documents?.aadharCard?.url) && (
                    <button
                      onClick={() => viewDocument(request.documents?.governmentId?.frontImage || request.documents?.aadharCard?.url, 'Aadhar Card')}
                      className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-md text-center hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <IdCard size={18} className="mx-auto mb-1.5 text-zinc-400" />
                      <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Aadhar Card</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center justify-center gap-0.5"><CheckCircle size={9} />Uploaded</div>
                    </button>
                  )}
                  
                  {(request.vehicles?.[0]?.registrationDocument || request.documents?.vehicleRC?.url) && (
                    <button
                      onClick={() => viewDocument(request.vehicles?.[0]?.registrationDocument || request.documents?.vehicleRC?.url, 'Vehicle RC')}
                      className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-md text-center hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <FileText size={18} className="mx-auto mb-1.5 text-zinc-400" />
                      <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Vehicle RC</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center justify-center gap-0.5"><CheckCircle size={9} />Uploaded</div>
                    </button>
                  )}
                  
                  {(request.documents?.insurance?.document || request.documents?.vehicleInsurance?.url) && (
                    <button
                      onClick={() => viewDocument(request.documents?.insurance?.document || request.documents?.vehicleInsurance?.url, 'Insurance')}
                      className="p-3 border border-zinc-200 dark:border-zinc-700 rounded-md text-center hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Shield size={18} className="mx-auto mb-1.5 text-zinc-400" />
                      <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Insurance</div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center justify-center gap-0.5"><CheckCircle size={9} />Uploaded</div>
                    </button>
                  )}
                </div>

                {/* Vehicle Information */}
                {request.vehicles && request.vehicles.length > 0 && (
                  <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-100 dark:border-zinc-800 p-3 mb-4">
                    <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1"><Car size={12} />Vehicle Details</h4>
                    {request.vehicles.map((vehicle, index) => (
                      <div key={index} className="text-xs text-zinc-700 dark:text-zinc-300 flex flex-wrap gap-x-3 gap-y-1">
                        <span className="font-medium">{vehicle.make} {vehicle.model}</span>
                        {vehicle.year && <span>({vehicle.year})</span>}
                        {vehicle.licensePlate && <span className="font-mono bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded text-[10px]">{vehicle.licensePlate}</span>}
                        {vehicle.color && <span>· {vehicle.color}</span>}
                        {vehicle.seats && <span>· {vehicle.seats} seats</span>}
                        {vehicle.vehicleType && (
                          <span className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700">
                            {vehicle.vehicleType}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => handleApprove(request._id)}
                    className="flex items-center gap-1 px-4 py-2 bg-emerald-600 text-white rounded-md text-xs font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button
                    onClick={() => openRejectModal(request._id)}
                    className="flex items-center gap-1 px-4 py-2 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-md text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-center gap-1 mt-6">
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setSearchParams({ page: page.toString() })}
                    className={cn(
                      'px-2.5 py-1 rounded-md text-sm transition-colors',
                      page === pagination.page
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                        : 'border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    )}
                  >
                    {page}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <CheckCircle size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1">No Pending Verifications</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">All driver verification requests have been processed.</p>
          </div>
        )}
      </div>

      {/* Document Viewer Modal */}
      {showDocModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{docTitle}</h2>
              <button onClick={() => setShowDocModal(false)} className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-56px)]">
              {docUrl ? (
                <div className="text-center">
                  {docUrl.toLowerCase().includes('.pdf') ? (
                    <div className="space-y-3">
                      <iframe src={docUrl} className="w-full h-[70vh] border border-zinc-200 dark:border-zinc-700 rounded-md" title={docTitle} />
                      <a href={docUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                        <ExternalLink size={12} /> Open in New Tab
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <img src={docUrl} alt={docTitle} className="max-w-full max-h-[70vh] mx-auto rounded-md border border-zinc-200 dark:border-zinc-700"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }} />
                      <div className="hidden bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-md p-4 text-center">
                        <AlertTriangle size={24} className="mx-auto mb-2 text-red-500" />
                        <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Failed to load image</p>
                        <p className="text-[10px] text-zinc-500 mb-3 break-all">URL: {docUrl}</p>
                        <a href={docUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                          <ExternalLink size={12} /> Try Opening in New Tab
                        </a>
                      </div>
                      <div className="flex justify-center gap-2">
                        <a href={docUrl} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                          <ExternalLink size={12} /> Open in New Tab
                        </a>
                        <a href={docUrl} download={docTitle}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
                          <Download size={12} /> Download
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileX2 size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-xs font-medium text-zinc-500">No document URL available</p>
                  <p className="text-[10px] text-zinc-400 mt-1">The document might not have been uploaded correctly</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full mx-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Reject Verification</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Please provide a reason for rejection:</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              rows={4}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowRejectModal(false)} className="flex-1 px-4 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={handleReject} className="flex-1 px-4 py-2 text-sm rounded-md bg-red-600 text-white font-medium hover:bg-red-700 transition-colors">Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVerifications;
