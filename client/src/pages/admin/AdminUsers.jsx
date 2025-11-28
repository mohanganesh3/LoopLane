import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert, Button } from '../../components/common';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';
import { formatRating } from '../../utils/helpers';

// Avatar component with fallback for admin pages
const UserAvatar = ({ user, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);
  const photoUrl = getUserPhoto(user);
  const displayName = getUserDisplayName(user);
  
  const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-14 h-14 text-lg',
    lg: 'w-20 h-20 text-2xl'
  };
  
  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={displayName}
        className={`${sizeClasses[size]} rounded-full object-cover`}
        onError={() => setImgError(true)}
      />
    );
  }
  
  return (
    <div className={`${sizeClasses[size]} rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-bold`}>
      {getInitials(displayName)}
    </div>
  );
};

const AdminUsers = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  
  // Pagination
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  
  // Modal
  const [selectedUser, setSelectedUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  
  // Action modals
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [actionUserId, setActionUserId] = useState(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [activateNotes, setActivateNotes] = useState('');

  useEffect(() => {
    let isMounted = true;
    
    const loadUsers = async () => {
      setLoading(true);
      try {
        const params = {
          search: searchParams.get('search') || '',
          role: searchParams.get('role') || 'all',
          status: searchParams.get('status') || 'all',
          page: searchParams.get('page') || 1
        };
        
        const response = await adminService.getAllUsers(params);
        if (isMounted) {
          if (response && response.success) {
            setUsers(response.users || []);
            setPagination(response.pagination || { page: 1, pages: 1, total: response.users?.length || 0 });
          }
        }
      } catch (err) {
        if (isMounted) {
          // Don't show error for auth issues - let the route guard handle it
          if (err.response?.status !== 401 && err.response?.status !== 403) {
            setError(err.response?.data?.message || err.message || 'Failed to load users');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadUsers();
    
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = {
        search: searchParams.get('search') || '',
        role: searchParams.get('role') || 'all',
        status: searchParams.get('status') || 'all',
        page: searchParams.get('page') || 1
      };
      
      const response = await adminService.getAllUsers(params);
      if (response && response.success) {
        setUsers(response.users || []);
        setPagination(response.pagination || { page: 1, pages: 1, total: response.users?.length || 0 });
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError(err.response?.data?.message || err.message || 'Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    params.set('page', '1');
    setSearchParams(params);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      applyFilters();
    }
  };

  const viewUser = async (userId) => {
    setModalLoading(true);
    setShowModal(true);
    try {
      const response = await adminService.getUserById(userId);
      if (response.success) {
        setSelectedUser(response.user);
      }
    } catch (err) {
      setError('Failed to load user details');
      setShowModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  const openSuspendModal = (userId) => {
    setActionUserId(userId);
    setSuspendReason('');
    setShowSuspendModal(true);
  };

  const openActivateModal = (userId) => {
    setActionUserId(userId);
    setActivateNotes('');
    setShowActivateModal(true);
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) {
      setError('Please provide a reason for suspension');
      return;
    }
    
    try {
      const response = await adminService.updateUserStatus(actionUserId, 'suspend', { reason: suspendReason });
      if (response.success) {
        setSuccess('User suspended successfully');
        setShowSuspendModal(false);
        fetchUsers();
      }
    } catch (err) {
      setError(err.message || 'Failed to suspend user');
    }
  };

  const handleActivate = async () => {
    if (!activateNotes.trim()) {
      setError('Please provide notes for reactivation');
      return;
    }
    
    try {
      const response = await adminService.updateUserStatus(actionUserId, 'activate', { appealNotes: activateNotes });
      if (response.success) {
        setSuccess('User reactivated successfully');
        setShowActivateModal(false);
        fetchUsers();
      }
    } catch (err) {
      setError(err.message || 'Failed to activate user');
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Are you sure you want to DELETE this user? This action cannot be undone!')) {
      return;
    }
    
    try {
      const response = await adminService.deleteUser(userId);
      if (response.success) {
        setSuccess('User deleted successfully');
        fetchUsers();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const getRoleBadge = (role) => {
    if (role === 'RIDER') {
      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800"><i className="fas fa-car mr-1"></i> Rider</span>;
    }
    return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800"><i className="fas fa-user mr-1"></i> Passenger</span>;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Active</span>;
      case 'SUSPENDED':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Suspended</span>;
      case 'DELETED':
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">Deleted</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">{status}</span>;
    }
  };

  if (loading && users.length === 0) {
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
          <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
          <p className="text-gray-500 text-sm">Manage all registered users</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-6" />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess('')} className="mb-6" />}

        {/* Filter Bar */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Name, email, phone..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="RIDER">Riders</option>
                <option value="PASSENGER">Passengers</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="DELETED">Deleted</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={applyFilters}
                className="w-full px-6 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition"
              >
                <i className="fas fa-search mr-1"></i> Search
              </button>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            <i className="fas fa-users mr-2"></i>All Users ({pagination.total || users.length})
          </h3>

          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user._id}
                className="flex items-center gap-5 p-5 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <UserAvatar user={user} size="md" />
                
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 text-lg">
                    {getUserDisplayName(user)}
                  </div>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-1">
                    <span><i className="fas fa-envelope mr-1"></i> {user.email}</span>
                    <span><i className="fas fa-phone mr-1"></i> {user.phone}</span>
                    {getRoleBadge(user.role)}
                    {getStatusBadge(user.accountStatus)}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/admin/users/${user._id}`)}
                    className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg font-semibold hover:bg-blue-600 transition"
                  >
                    <i className="fas fa-eye mr-1"></i> View
                  </button>
                  
                  {user.accountStatus === 'ACTIVE' && (
                    <button
                      onClick={() => openSuspendModal(user._id)}
                      className="px-4 py-2 bg-yellow-500 text-white text-sm rounded-lg font-semibold hover:bg-yellow-600 transition"
                    >
                      <i className="fas fa-ban mr-1"></i> Suspend
                    </button>
                  )}
                  
                  {user.accountStatus === 'SUSPENDED' && (
                    <button
                      onClick={() => openActivateModal(user._id)}
                      className="px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg font-semibold hover:bg-emerald-600 transition"
                    >
                      <i className="fas fa-check-circle mr-1"></i> Activate
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDelete(user._id)}
                    className="px-4 py-2 bg-red-500 text-white text-sm rounded-lg font-semibold hover:bg-red-600 transition"
                  >
                    <i className="fas fa-trash mr-1"></i> Delete
                  </button>
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4"><i className="fas fa-users"></i></div>
                <p>No users found matching your criteria</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set('page', page.toString());
                    setSearchParams(params);
                  }}
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
      </div>

      {/* User Details Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">User Details</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl">
                ×
              </button>
            </div>
            
            {modalLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
              </div>
            ) : selectedUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b border-gray-200">
                  <UserAvatar user={selectedUser} size="lg" />
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {getUserDisplayName(selectedUser)}
                    </h3>
                    <p className="text-gray-500">{selectedUser.email}</p>
                  </div>
                </div>
                
                {[
                  { label: 'Phone', value: selectedUser.phone },
                  { label: 'Role', value: selectedUser.role },
                  { label: 'Status', value: selectedUser.accountStatus },
                  { label: 'Joined', value: new Date(selectedUser.createdAt).toLocaleDateString() },
                  { label: 'Total Rides', value: selectedUser.stats?.totalRides || 0 },
                  { label: 'Rating', value: <><span>{formatRating(selectedUser.rating)}</span> <i className="fas fa-star text-yellow-400"></i></> }
                ].map((item, index) => (
                  <div key={index} className="flex py-3 border-b border-gray-100">
                    <span className="font-semibold text-gray-700 w-32">{item.label}:</span>
                    <span className="text-gray-600 flex-1">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

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

export default AdminUsers;
