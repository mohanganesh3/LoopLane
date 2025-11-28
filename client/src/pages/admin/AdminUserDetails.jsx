import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';
import { formatRating } from '../../utils/helpers';

const AdminUserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [activateNotes, setActivateNotes] = useState('');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    fetchUserDetails();
  }, [id]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const response = await adminService.getUserById(id);
      if (response.success) {
        setUser(response.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      setError('Please provide a reason for suspension');
      return;
    }
    
    try {
      const response = await adminService.updateUserStatus(id, 'suspend', { reason: suspendReason });
      if (response.success) {
        setSuccess('User suspended successfully');
        setShowSuspendModal(false);
        setSuspendReason('');
        fetchUserDetails();
      }
    } catch (err) {
      setError(err.message || 'Failed to suspend user');
    }
  };

  const handleActivate = async () => {
    try {
      const response = await adminService.updateUserStatus(id, 'activate', { appealNotes: activateNotes });
      if (response.success) {
        setSuccess('User reactivated successfully');
        setShowActivateModal(false);
        setActivateNotes('');
        fetchUserDetails();
      }
    } catch (err) {
      setError(err.message || 'Failed to activate user');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to DELETE this user? This action cannot be undone!')) {
      return;
    }
    
    try {
      const response = await adminService.deleteUser(id);
      if (response.success) {
        setSuccess('User deleted successfully');
        setTimeout(() => navigate('/admin/users'), 1500);
      }
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-800">Active</span>;
      case 'SUSPENDED':
        return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-800">Suspended</span>;
      case 'DELETED':
        return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-gray-100 text-gray-800">Deleted</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-yellow-100 text-yellow-800">{status}</span>;
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'RIDER') {
      return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800"><i className="fas fa-car mr-1"></i> Rider</span>;
    }
    return <span className="px-3 py-1 rounded-full text-sm font-semibold bg-emerald-100 text-emerald-800"><i className="fas fa-user mr-1"></i> Passenger</span>;
  };

  const getVerificationBadge = (status) => {
    const styles = {
      'VERIFIED': 'bg-green-100 text-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'NOT_SUBMITTED': 'bg-gray-100 text-gray-800'
    };
    return <span className={`px-3 py-1 rounded-full text-sm font-semibold ${styles[status] || styles['NOT_SUBMITTED']}`}>
      {status || 'Not Submitted'}
    </span>;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Alert type="error" message="User not found" />
        <button
          onClick={() => navigate('/admin/users')}
          className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg"
        >
          ← Back to Users
        </button>
      </div>
    );
  }

  const photoUrl = getUserPhoto(user);
  const displayName = getUserDisplayName(user);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/admin/users')}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-gray-800">
          <i className="fas fa-user mr-2"></i>User Details
        </h1>
      </div>

      {error && <Alert type="error" message={error} className="mb-6" onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} className="mb-6" onClose={() => setSuccess('')} />}

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
        <div className="flex items-start gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {photoUrl && !imgError ? (
              <img
                src={photoUrl}
                alt={displayName}
                className="w-24 h-24 rounded-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className={`w-24 h-24 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white text-3xl font-bold`}>
                {getInitials(displayName)}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-bold text-gray-900">{displayName}</h2>
              {getStatusBadge(user.accountStatus)}
            </div>
            
            <div className="flex flex-wrap gap-3 mb-4">
              {getRoleBadge(user.role)}
              {user.role === 'RIDER' && getVerificationBadge(user.verificationStatus)}
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-gray-600">
              <div className="flex items-center gap-2">
                <i className="fas fa-envelope text-gray-400"></i>
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-phone text-gray-400"></i>
                <span>{user.phone || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-calendar text-gray-400"></i>
                <span>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-star text-yellow-400"></i>
                <span>{formatRating(user.rating)} rating</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          <i className="fas fa-chart-bar mr-2 text-indigo-500"></i>Statistics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-blue-600">{user.stats?.totalRides || 0}</p>
            <p className="text-sm text-gray-500">Total Rides</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-600">{user.stats?.completedRides || 0}</p>
            <p className="text-sm text-gray-500">Completed</p>
          </div>
          <div className="bg-red-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-600">{user.stats?.cancelledRides || 0}</p>
            <p className="text-sm text-gray-500">Cancelled</p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg text-center">
            <p className="text-2xl font-bold text-yellow-600">{user.stats?.reviewsCount || 0}</p>
            <p className="text-sm text-gray-500">Reviews</p>
          </div>
        </div>
      </div>

      {/* Vehicle Info (for Riders) */}
      {user.role === 'RIDER' && user.vehicles && user.vehicles.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            <i className="fas fa-car mr-2 text-indigo-500"></i>Vehicles
          </h3>
          <div className="space-y-4">
            {user.vehicles.map((vehicle, index) => (
              <div key={index} className="p-4 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-gray-800">
                      {vehicle.make} {vehicle.model} ({vehicle.year})
                    </p>
                    <p className="text-sm text-gray-500">
                      {vehicle.color} • {vehicle.licensePlate}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    vehicle.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                    vehicle.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {vehicle.status || 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Documents (for Riders) */}
      {user.role === 'RIDER' && user.documents && (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            <i className="fas fa-file-alt mr-2 text-indigo-500"></i>Documents
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { key: 'driverLicense', label: 'Driver License' },
              { key: 'governmentId', label: 'Government ID' },
              { key: 'insurance', label: 'Insurance' }
            ].map(({ key, label }) => (
              <div key={key} className="p-4 bg-gray-50 rounded-lg border">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">{label}</span>
                  {user.documents[key] ? (
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      user.documents[key].status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      user.documents[key].status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {user.documents[key].status || 'Pending'}
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-600">
                      Not Uploaded
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suspension Info */}
      {user.accountStatus === 'SUSPENDED' && user.suspensionReason && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold text-red-800 mb-2">
            <i className="fas fa-ban mr-2"></i>Suspension Details
          </h3>
          <p className="text-red-700">{user.suspensionReason}</p>
          {user.suspendedAt && (
            <p className="text-sm text-red-500 mt-2">
              Suspended on {new Date(user.suspendedAt).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Admin Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Admin Actions</h3>
        <div className="flex flex-wrap gap-3">
          {user.accountStatus === 'ACTIVE' && (
            <button
              onClick={() => setShowSuspendModal(true)}
              className="px-6 py-3 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition"
            >
              <i className="fas fa-ban mr-2"></i>Suspend User
            </button>
          )}
          
          {user.accountStatus === 'SUSPENDED' && (
            <button
              onClick={() => setShowActivateModal(true)}
              className="px-6 py-3 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition"
            >
              <i className="fas fa-check-circle mr-2"></i>Reactivate User
            </button>
          )}
          
          <button
            onClick={handleDelete}
            className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
          >
            <i className="fas fa-trash mr-2"></i>Delete User
          </button>
        </div>
      </div>

      {/* Suspend Modal */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Suspend User</h2>
            <p className="text-gray-600 mb-4">Please provide a reason for suspending this user:</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowSuspendModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspend}
                className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg font-semibold hover:bg-yellow-600 transition"
              >
                Suspend User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activate Modal */}
      {showActivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reactivate User</h2>
            <p className="text-gray-600 mb-4">Please provide notes about why you are reactivating this account:</p>
            <textarea
              value={activateNotes}
              onChange={(e) => setActivateNotes(e.target.value)}
              placeholder="Notes for reactivation..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              rows={4}
            />
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowActivateModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg font-semibold hover:bg-emerald-600 transition"
              >
                Reactivate User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserDetails;
