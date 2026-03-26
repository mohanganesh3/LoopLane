import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Search, Users, Car, User, ShieldCheck, Mail, Phone,
  Calendar, Star, Eye, Ban, CheckCircle, Trash2, X, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '../../components/ui/AlertDialog';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';
import { formatRating } from '../../utils/helpers';

const UserAvatar = ({ user, size = 'md' }) => {
  const [imgError, setImgError] = useState(false);
  const photoUrl = getUserPhoto(user);
  const displayName = getUserDisplayName(user);
  const sizeClasses = { sm: 'w-10 h-10 text-sm', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-xl' };

  if (photoUrl && !imgError) {
    return <img src={photoUrl} alt={displayName} className={`${sizeClasses[size]} rounded-full object-cover`} onError={() => setImgError(true)} />;
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-medium`}>
      {getInitials(displayName)}
    </div>
  );
};

const RoleBadge = ({ role }) => (
  <span className={cn(
    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset',
    role === 'RIDER'
      ? 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800'
      : 'bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700'
  )}>
    {role === 'RIDER' ? <Car size={10} /> : <User size={10} />}
    {role === 'RIDER' ? 'Rider' : 'Passenger'}
  </span>
);

const StatusBadge = ({ status }) => {
  const map = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
    SUSPENDED: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
    DELETED: 'bg-zinc-50 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:ring-zinc-700',
  };
  return <span className={cn('px-2 py-0.5 rounded-md text-[11px] font-medium ring-1 ring-inset', map[status] || map.ACTIVE)}>{status?.charAt(0) + status?.slice(1).toLowerCase()}</span>;
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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState(null);

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
    setDeleteUserId(userId);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    try {
      const response = await adminService.deleteUser(deleteUserId);
      if (response.success) {
        setSuccess('User deleted successfully');
        fetchUsers();
      }
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setShowDeleteDialog(false);
      setDeleteUserId(null);
    }
  };

  if (loading && users.length === 0) {
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
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Users</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Manage all registered users</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-4" />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess('')} className="mb-4" />}

        {/* Filter Bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Search</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Name, email, phone..."
                className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Role</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Roles</option>
                <option value="RIDER">Riders</option>
                <option value="PASSENGER">Passengers</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                <Search size={14} /> Search
              </button>
            </div>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <Users size={14} className="text-zinc-400" />
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">All Users ({pagination.total || users.length})</h3>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((user) => {
              const completedRides = user.statistics?.completedRides || 0;
              const totalRides = (user.statistics?.totalRidesPosted || 0) + (user.statistics?.totalRidesTaken || 0);
              const ratingVal = user.rating?.overall || user.rating?.average || 0;
              const totalRatings = user.rating?.totalRatings || 0;
              return (
                <div
                  key={user._id}
                  className="flex items-center gap-4 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/admin/users/${user._id}`)}
                >
                  <UserAvatar user={user} size="md" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-zinc-900 dark:text-zinc-100 truncate">{getUserDisplayName(user)}</span>
                      <RoleBadge role={user.role} />
                      <StatusBadge status={user.accountStatus} />
                      {user.role === 'RIDER' && user.verificationStatus === 'VERIFIED' && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800">
                          <ShieldCheck size={10} /> Verified
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      <span className="flex items-center gap-1"><Mail size={10} /> {user.email}</span>
                      <span className="flex items-center gap-1"><Phone size={10} /> {user.phone}</span>
                      <span className="flex items-center gap-1"><Calendar size={10} /> Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Quick Metrics */}
                  <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
                    <div className="text-center px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700 min-w-[50px]">
                      <div className="flex items-center justify-center gap-0.5">
                        <Star size={10} className="text-yellow-500" />
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 text-xs">{ratingVal > 0 ? ratingVal.toFixed(1) : '—'}</span>
                      </div>
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500">{totalRatings}</p>
                    </div>
                    <div className="text-center px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700 min-w-[50px]">
                      <span className="font-medium text-zinc-800 dark:text-zinc-200 text-xs">{completedRides}</span>
                      <p className="text-[9px] text-zinc-400 dark:text-zinc-500">Done</p>
                    </div>
                    {totalRides > 0 && (
                      <div className="text-center px-2.5 py-1 bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700 min-w-[50px]">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200 text-xs">{totalRides}</span>
                        <p className="text-[9px] text-zinc-400 dark:text-zinc-500">Total</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <button onClick={() => navigate(`/admin/users/${user._id}`)} className="p-2 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors" title="View">
                      <Eye size={14} />
                    </button>
                    {user.accountStatus === 'ACTIVE' && (
                      <button onClick={() => openSuspendModal(user._id)} className="p-2 rounded-md border border-yellow-200 dark:border-yellow-900/30 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/10 transition-colors" title="Suspend">
                        <Ban size={14} />
                      </button>
                    )}
                    {user.accountStatus === 'SUSPENDED' && (
                      <button onClick={() => openActivateModal(user._id)} className="p-2 rounded-md border border-emerald-200 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors" title="Activate">
                        <CheckCircle size={14} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(user._id)} className="p-2 rounded-md border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {users.length === 0 && (
              <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
                <Users size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm">No users found matching your criteria</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center gap-1 p-4 border-t border-zinc-100 dark:border-zinc-800">
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => {
                    const params = new URLSearchParams(searchParams);
                    params.set('page', page.toString());
                    setSearchParams(params);
                  }}
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
      </div>

      {/* User Details Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">User Details</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            {modalLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={20} className="animate-spin text-zinc-400" />
              </div>
            ) : selectedUser ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                  <UserAvatar user={selectedUser} size="lg" />
                  <div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{getUserDisplayName(selectedUser)}</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">{selectedUser.email}</p>
                  </div>
                </div>

                {[
                  { label: 'Phone', value: selectedUser.phone },
                  { label: 'Role', value: selectedUser.role },
                  { label: 'Status', value: selectedUser.accountStatus },
                  { label: 'Joined', value: new Date(selectedUser.createdAt).toLocaleDateString() },
                  { label: 'Total Rides', value: selectedUser.stats?.totalRides || 0 },
                  { label: 'Rating', value: <span className="flex items-center gap-1">{formatRating(selectedUser.rating)} <Star size={12} className="text-yellow-500" /></span> }
                ].map((item, index) => (
                  <div key={index} className="flex py-2 border-b border-zinc-50 dark:border-zinc-800/50">
                    <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 w-28">{item.label}</span>
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 flex-1">{item.value}</span>
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
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full mx-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Suspend User</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Provide a reason for suspending this user:</p>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Reason for suspension..."
              className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              rows={4}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowSuspendModal(false)} className="flex-1 px-4 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={handleSuspend} className="flex-1 px-4 py-2 text-sm rounded-md bg-yellow-500 text-white font-medium hover:bg-yellow-600 transition-colors">Suspend</button>
            </div>
          </div>
        </div>
      )}

      {/* Activate Modal */}
      {showActivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full mx-4">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Reactivate User</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Provide notes about why you are reactivating this account:</p>
            <textarea
              value={activateNotes}
              onChange={(e) => setActivateNotes(e.target.value)}
              placeholder="Notes for reactivation..."
              className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              rows={4}
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowActivateModal(false)} className="flex-1 px-4 py-2 text-sm rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
              <button onClick={handleActivate} className="flex-1 px-4 py-2 text-sm rounded-md bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors">Reactivate</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this user account and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 focus:ring-red-600">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
