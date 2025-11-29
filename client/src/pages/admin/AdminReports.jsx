import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';

const AdminReports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentStatus, setCurrentStatus] = useState(searchParams.get('status') || 'PENDING');
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    let isMounted = true;
    
    const loadReports = async () => {
      setLoading(true);
      try {
        const status = searchParams.get('status') || 'PENDING';
        setCurrentStatus(status);
        const response = await adminService.getReports({ status });
        if (isMounted) {
          if (response && response.success) {
            setReports(response.reports || []);
          }
        }
      } catch (err) {
        if (isMounted) {
          // Don't show error for auth issues
          if (err.response?.status !== 401 && err.response?.status !== 403) {
            setError(err.response?.data?.message || err.message || 'Failed to load reports');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadReports();
    
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const status = searchParams.get('status') || 'PENDING';
      setCurrentStatus(status);
      const response = await adminService.getReports({ status });
      if (response && response.success) {
        setReports(response.reports || []);
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError(err.response?.data?.message || err.message || 'Failed to load reports');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (status) => {
    setSearchParams({ status });
  };

  const handleAction = async (reportId, actionType, notes) => {
    try {
      const response = await adminService.reviewReport(reportId, {
        actionType,
        notes,
        status: actionType === 'NO_ACTION' && notes === 'Moved to review' ? 'UNDER_REVIEW' : 'RESOLVED'
      });
      if (response.success) {
        setSuccess(`Action completed successfully`);
        fetchReports();
      }
    } catch (err) {
      setError(err.message || 'Action failed');
    }
  };

  const promptAndAction = (reportId, actionType, promptText) => {
    const reason = prompt(promptText);
    if (!reason) return;
    if (actionType !== 'NO_ACTION' && !window.confirm(`Are you sure you want to proceed?`)) return;
    handleAction(reportId, actionType, reason);
  };

  const getCategoryBadge = (category) => {
    const styles = {
      'HARASSMENT': 'bg-red-100 text-red-800',
      'SAFETY': 'bg-yellow-100 text-yellow-800',
      'PAYMENT': 'bg-blue-100 text-blue-800',
      'SPAM': 'bg-purple-100 text-purple-800',
      'OTHER': 'bg-gray-100 text-gray-800'
    };
    return styles[category] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityBorder = (severity) => {
    const borders = {
      'high': 'border-l-red-500',
      'medium': 'border-l-yellow-500',
      'low': 'border-l-blue-500'
    };
    return borders[severity] || 'border-l-yellow-500';
  };

  const stats = {
    pending: reports.filter(r => r.status === 'PENDING').length,
    inReview: reports.filter(r => r.status === 'UNDER_REVIEW').length,
    resolved: reports.filter(r => r.status === 'RESOLVED').length,
    all: reports.length
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800"><i className="fas fa-clipboard mr-2"></i>Reports Management</h1>
        <p className="text-gray-600 mt-1">Review and handle user reports</p>
      </div>

      {error && <Alert type="error" message={error} className="mb-6" onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} className="mb-6" onClose={() => setSuccess('')} />}

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          {[
            { key: 'PENDING', label: <><i className="fas fa-circle text-red-500 mr-1"></i> Pending</>, count: stats.pending },
            { key: 'UNDER_REVIEW', label: <><i className="fas fa-search mr-1"></i> In Review</>, count: stats.inReview },
            { key: 'RESOLVED', label: <><i className="fas fa-check-circle mr-1"></i> Resolved</>, count: stats.resolved },
            { key: 'all', label: <><i className="fas fa-chart-bar mr-1"></i> All Reports</>, count: stats.all }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => handleStatusFilter(key)}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                currentStatus === key
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label} ({count})
            </button>
          ))}
        </div>
      </div>

      {/* Reports List */}
      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl text-gray-300 mb-4"><i className="fas fa-check-circle"></i></div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Reports Found</h3>
          <p className="text-gray-500">All reports have been handled!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {reports.map((report) => (
            <div
              key={report._id}
              className={`bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 border-l-4 ${getSeverityBorder(report.severity)}`}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getCategoryBadge(report.category)}`}>
                    {report.category?.replace('_', ' ')}
                  </span>
                  <span className="text-gray-500 text-sm">
                    <i className="fas fa-calendar mr-1"></i> {new Date(report.createdAt).toLocaleString()}
                  </span>
                </div>
                <span className="text-gray-400 text-xs">ID: #{report._id.toString().slice(-6)}</span>
              </div>

              {/* Reporter */}
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg mb-3">
                <img
                  src={report.reporter?.profile?.photo || '/images/default-avatar.png'}
                  className="w-10 h-10 rounded-full object-cover"
                  alt="Reporter"
                />
                <div>
                  <p className="text-sm text-gray-500">Reporter:</p>
                  <p className="font-semibold text-gray-800">
                    {report.reporter?.profile?.firstName} {report.reporter?.profile?.lastName}
                  </p>
                </div>
              </div>

              {/* Reported User */}
              <div className="flex items-center space-x-3 p-3 bg-red-50 rounded-lg mb-4">
                <img
                  src={report.reportedUser?.profile?.photo || '/images/default-avatar.png'}
                  className="w-10 h-10 rounded-full object-cover"
                  alt="Reported"
                />
                <div>
                  <p className="text-sm text-red-500">Reported:</p>
                  <p className="font-semibold text-red-800">
                    {report.reportedUser?.profile?.firstName} {report.reportedUser?.profile?.lastName}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2"><i className="fas fa-pen mr-1"></i> Description:</p>
                <p className="text-gray-700">{report.description}</p>
              </div>

              {/* Evidence */}
              {report.evidence && report.evidence.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    <i className="fas fa-paperclip mr-1"></i> Evidence ({report.evidence.length} items):
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {report.evidence.map((ev, idx) => (
                      <img
                        key={idx}
                        src={typeof ev === 'string' ? ev : ev.url}
                        className="w-20 h-20 rounded-lg object-cover cursor-pointer border-2 border-gray-200 hover:border-indigo-500 transition"
                        onClick={() => setSelectedImage(typeof ev === 'string' ? ev : ev.url)}
                        alt="Evidence"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => promptAndAction(report._id, 'NO_ACTION', 'Add investigation notes:')}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition text-sm"
                >
                  <i className="fas fa-search mr-1"></i> Investigate
                </button>
                <button
                  onClick={() => promptAndAction(report._id, 'WARNING', 'Enter warning reason:')}
                  className="px-4 py-2 bg-yellow-400 text-yellow-900 rounded-lg font-semibold hover:bg-yellow-500 transition text-sm"
                >
                  <i className="fas fa-exclamation-triangle mr-1"></i> Warn
                </button>
                <button
                  onClick={() => promptAndAction(report._id, 'SUSPENSION', 'Enter suspension reason:')}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition text-sm"
                >
                  <i className="fas fa-ban mr-1"></i> Suspend
                </button>
                <button
                  onClick={() => promptAndAction(report._id, 'BAN', 'Enter ban reason:')}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition text-sm"
                >
                  <i className="fas fa-hand-paper mr-1"></i> Ban
                </button>
                <button
                  onClick={() => promptAndAction(report._id, 'DISMISSED', 'Enter dismissal reason:')}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition text-sm"
                >
                  <i className="fas fa-times-circle mr-1"></i> Dismiss
                </button>
              </div>

              {/* Status */}
              <div className="mt-4 pt-4 border-t text-sm text-gray-500">
                <span className="font-semibold">Status:</span>{' '}
                <span className={`${
                  report.status === 'RESOLVED' ? 'text-green-600' :
                  report.status === 'UNDER_REVIEW' ? 'text-yellow-600' : 'text-gray-600'
                }`}>
                  {report.status}
                </span>
                {report.resolution && (
                  <span className="ml-3">| <span className="font-semibold">Resolution:</span> {report.resolution}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="bg-white rounded-xl p-4 max-w-3xl max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-800">Evidence Image</h3>
              <button
                onClick={() => setSelectedImage(null)}
                className="text-gray-500 hover:text-gray-800 text-2xl"
              >
                ×
              </button>
            </div>
            <img src={selectedImage} className="max-w-full max-h-[70vh] rounded-lg" alt="Evidence" />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReports;
