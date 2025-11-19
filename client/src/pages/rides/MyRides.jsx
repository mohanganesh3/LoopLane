import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, LoadingSpinner, Badge } from '../../components/common';
import rideService from '../../services/rideService';

const MyRides = () => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStatus, setCurrentStatus] = useState('all');
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });

  const statusFilters = [
    { key: 'all', label: 'All Rides', color: 'bg-emerald-500' },
    { key: 'active', label: 'Active', color: 'bg-green-500', icon: 'fa-check-circle' },
    { key: 'in-progress', label: 'In Progress', color: 'bg-blue-500', icon: 'fa-route' },
    { key: 'completed', label: 'Completed', color: 'bg-purple-500', icon: 'fa-flag-checkered' },
    { key: 'cancelled', label: 'Cancelled', color: 'bg-red-500', icon: 'fa-times-circle' }
  ];

  useEffect(() => {
    fetchRides();
  }, [currentStatus, pagination.currentPage]);

  const fetchRides = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.currentPage };
      if (currentStatus !== 'all') params.status = currentStatus.toUpperCase().replace('-', '_');
      
      const data = await rideService.getMyRides(params);
      setRides(data.rides || []);
      setPagination(data.pagination || { currentPage: 1, totalPages: 1 });
    } catch (err) {
      setError('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      'ACTIVE': { color: 'green', icon: 'fa-check-circle' },
      'IN_PROGRESS': { color: 'blue', icon: 'fa-route' },
      'COMPLETED': { color: 'purple', icon: 'fa-flag-checkered' },
      'CANCELLED': { color: 'red', icon: 'fa-times-circle' }
    };
    const { color, icon } = config[status] || { color: 'gray', icon: 'fa-question-circle' };
    return (
      <Badge variant={color}>
        <i className={`fas ${icon} mr-1`}></i>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  if (loading && rides.length === 0) {
    return <LoadingSpinner fullScreen text="Loading rides..." />;
  }

  return (
    <div className="pb-12 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">
              <i className="fas fa-car text-emerald-500 mr-3"></i>My Rides
            </h1>
            <Link to="/post-ride" className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition">
              <i className="fas fa-plus-circle mr-2"></i>Post New Ride
            </Link>
          </div>

          {/* Status Filters */}
          <div className="flex flex-wrap gap-2">
            {statusFilters.map(filter => (
              <button
                key={filter.key}
                onClick={() => { setCurrentStatus(filter.key); setPagination(p => ({ ...p, currentPage: 1 })); }}
                className={`px-6 py-2 rounded-lg font-semibold transition ${
                  currentStatus === filter.key 
                    ? `${filter.color} text-white` 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {filter.icon && <i className={`fas ${filter.icon} mr-2`}></i>}
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError('')} />}

        {/* Rides List */}
        <div className="space-y-6">
          {rides.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <i className="fas fa-car-side text-gray-300 text-6xl mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No rides found</h3>
              <p className="text-gray-500 mb-6">
                {currentStatus === 'all' ? "You haven't posted any rides yet" : `No ${currentStatus} rides`}
              </p>
              <Link to="/post-ride" className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition">
                <i className="fas fa-plus-circle mr-2"></i>Post Your First Ride
              </Link>
            </div>
          ) : (
            rides.map(ride => (
              <RideCard key={ride._id} ride={ride} getStatusBadge={getStatusBadge} formatDate={formatDate} onRefresh={fetchRides} />
            ))
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-8">
              {pagination.currentPage > 1 && (
                <button onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage - 1 }))} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  <i className="fas fa-chevron-left"></i>
                </button>
              )}
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setPagination(p => ({ ...p, currentPage: page }))}
                  className={`px-4 py-2 rounded-lg font-semibold ${page === pagination.currentPage ? 'bg-emerald-500 text-white' : 'bg-white border border-gray-300 hover:bg-gray-50'}`}
                >
                  {page}
                </button>
              ))}
              {pagination.currentPage < pagination.totalPages && (
                <button onClick={() => setPagination(p => ({ ...p, currentPage: p.currentPage + 1 }))} className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                  <i className="fas fa-chevron-right"></i>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Ride Card Component
const RideCard = ({ ride, getStatusBadge, formatDate, onRefresh }) => {
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  
  const confirmedBookings = (ride.bookings || []).filter(b => ['CONFIRMED', 'COMPLETED'].includes(b.status));
  const pendingBookings = (ride.bookings || []).filter(b => b.status === 'PENDING');
  const allBookings = ride.bookings || [];
  
  // Can delete only if no bookings and ride is ACTIVE
  const canDelete = allBookings.length === 0 && ride.status === 'ACTIVE';
  // Can edit only if no bookings and ride is ACTIVE  
  const canEdit = allBookings.length === 0 && ride.status === 'ACTIVE';
  // Can cancel only if ride is ACTIVE and HAS bookings (need to notify passengers)
  const canCancel = ride.status === 'ACTIVE' && allBookings.length > 0;

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await rideService.deleteRide(ride._id);
      setShowDeleteModal(false);
      onRefresh(); // Refresh the list
    } catch (err) {
      setDeleteError(err.response?.data?.message || err.message || 'Failed to delete ride');
    } finally {
      setDeleting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      await rideService.cancelRide(ride._id, cancelReason || 'Cancelled by rider');
      setShowCancelModal(false);
      onRefresh(); // Refresh the list
    } catch (err) {
      setCancelError(err.response?.data?.message || err.message || 'Failed to cancel ride');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          {getStatusBadge(ride.status)}
          <div className="flex flex-wrap gap-2 mt-2">
            {ride.preferences?.autoAcceptBookings && (
              <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                <i className="fas fa-bolt mr-1"></i>Auto-Approve
              </span>
            )}
            {ride.preferences?.gender === 'FEMALE_ONLY' && (
              <span className="bg-pink-100 text-pink-700 px-3 py-1 rounded-full text-xs font-semibold">
                <i className="fas fa-female mr-1"></i>Ladies Only
              </span>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-2">
            {formatDate(ride.schedule?.departureDateTime || ride.schedule?.date)}
          </p>
          {ride.vehicle?.make && (
            <p className="text-gray-700 text-sm mt-2 font-medium">
              <i className="fas fa-car text-emerald-500 mr-1"></i>
              {ride.vehicle.make} {ride.vehicle.model}
              {ride.vehicle.licensePlate && <span className="text-gray-500 ml-1">({ride.vehicle.licensePlate})</span>}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-500">₹{ride.pricing?.totalEarnings || 0}</div>
          <p className="text-gray-600 text-sm">
            {confirmedBookings.length} / {ride.pricing?.totalSeats || 0} seats booked
          </p>
        </div>
      </div>

      {/* Route */}
      <div className="border-t border-b py-4 mb-4">
        <div className="space-y-2">
          <div className="flex items-center text-gray-700">
            <i className="fas fa-map-marker-alt text-green-600 w-6"></i>
            <span className="ml-2 font-medium">{ride.route?.start?.name || ride.route?.start?.address || 'N/A'}</span>
          </div>
          <div className="flex items-center text-gray-400 ml-6">
            <i className="fas fa-ellipsis-v"></i>
            <span className="ml-3 text-sm">
              {ride.route?.distance ? `${ride.route.distance.toFixed(1)} km` : 'Calculating...'}
              {ride.route?.duration && ` • ${Math.round(ride.route.duration)} mins`}
            </span>
          </div>
          <div className="flex items-center text-gray-700">
            <i className="fas fa-map-marker-alt text-red-600 w-6"></i>
            <span className="ml-2 font-medium">{ride.route?.destination?.name || ride.route?.destination?.address || 'N/A'}</span>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 text-sm">
        <div className="text-gray-600">
          <i className="fas fa-users text-emerald-500 mr-2"></i>
          {ride.pricing?.availableSeats || 0} seats available
        </div>
        <div className="text-gray-600">
          <i className="fas fa-rupee-sign text-emerald-500 mr-2"></i>
          ₹{ride.pricing?.pricePerSeat || 0} per seat
        </div>
        {ride.vehicle?.make && (
          <div className="text-gray-800 font-semibold">
            <i className="fas fa-car text-emerald-500 mr-2"></i>
            {ride.vehicle.make} {ride.vehicle.model}
          </div>
        )}
        {ride.carbon?.carbonSaved > 0 && (
          <div className="text-green-600">
            <i className="fas fa-leaf mr-2"></i>
            {ride.carbon.carbonSaved.toFixed(1)} kg CO₂
          </div>
        )}
      </div>

      {/* Pending Requests Count */}
      {pendingBookings.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
          <span className="text-orange-700 font-semibold">
            <i className="fas fa-user-clock mr-2"></i>
            {pendingBookings.length} pending request{pendingBookings.length > 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Primary Actions - Start Ride / Track Ride */}
      {ride.status === 'ACTIVE' && confirmedBookings.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mr-4">
                <i className="fas fa-play text-white text-lg"></i>
              </div>
              <div>
                <h4 className="font-bold text-blue-900">Ready to Start!</h4>
                <p className="text-sm text-blue-700">{confirmedBookings.length} passenger{confirmedBookings.length > 1 ? 's' : ''} confirmed</p>
              </div>
            </div>
            <Link 
              to={`/rides/${ride._id}`}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-bold transition shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <i className="fas fa-play-circle mr-2"></i>Start Ride
            </Link>
          </div>
        </div>
      )}

      {ride.status === 'IN_PROGRESS' && (
        <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mr-4 animate-pulse">
                <i className="fas fa-car text-white text-lg"></i>
              </div>
              <div>
                <h4 className="font-bold text-green-900">Ride In Progress</h4>
                <p className="text-sm text-green-700">Manage pickups & dropoffs</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link 
                to={`/tracking/${ride._id}`}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-lg font-bold transition"
              >
                <i className="fas fa-map-marked-alt mr-2"></i>Track
              </Link>
              <Link 
                to={`/rides/${ride._id}`}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-3 rounded-lg font-bold transition"
              >
                <i className="fas fa-tasks mr-2"></i>Manage
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="border-t pt-4 flex flex-wrap gap-3">
        <Link to={`/rides/${ride._id}`} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition">
          <i className="fas fa-eye mr-2"></i>View Details
        </Link>
        
        {/* Tracking Link - For IN_PROGRESS rides */}
        {ride.status === 'IN_PROGRESS' && (
          <Link 
            to={`/tracking/${ride._id}`} 
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition"
          >
            <i className="fas fa-map-marked-alt mr-2"></i>Live Tracking
          </Link>
        )}
        
        {/* Edit Button - Only if no bookings */}
        {canEdit && (
          <Link 
            to={`/edit-ride/${ride._id}`} 
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition"
          >
            <i className="fas fa-edit mr-2"></i>Edit
          </Link>
        )}
        
        {/* Delete Button - Only if no bookings (just remove it, no need to keep) */}
        {canDelete && (
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition"
          >
            <i className="fas fa-trash mr-2"></i>Delete
          </button>
        )}
        
        {/* Cancel Button - Only if HAS bookings (need to notify passengers & keep record) */}
        {canCancel && (
          <button 
            onClick={() => setShowCancelModal(true)}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition"
          >
            <i className="fas fa-ban mr-2"></i>Cancel Ride
          </button>
        )}
        
        {confirmedBookings.length > 0 && (
          <Link to={`/chat?rideId=${ride._id}`} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition">
            <i className="fas fa-comments mr-2"></i>Chat ({confirmedBookings.length})
          </Link>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              <i className="fas fa-ban text-yellow-500 mr-2"></i>
              Cancel Ride?
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel this ride? {allBookings.length > 0 && 'All passengers will be notified and refunded.'}
            </p>
            
            {/* Ride summary */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div className="flex items-center text-gray-700 mb-1">
                <i className="fas fa-map-marker-alt text-green-600 mr-2"></i>
                {ride.route?.start?.name || ride.route?.start?.address}
              </div>
              <div className="flex items-center text-gray-700">
                <i className="fas fa-map-marker-alt text-red-600 mr-2"></i>
                {ride.route?.destination?.name || ride.route?.destination?.address}
              </div>
              <div className="text-gray-500 mt-2">
                <i className="fas fa-calendar mr-1"></i>
                {formatDate(ride.schedule?.departureDateTime)}
              </div>
            </div>
            
            {/* Cancel Reason */}
            <div className="mb-4">
              <label className="block text-gray-700 font-medium mb-2">Reason (optional)</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Why are you cancelling this ride?"
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              />
            </div>
            
            {cancelError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
                <i className="fas fa-exclamation-circle mr-1"></i>
                {cancelError}
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition"
              >
                Go Back
              </button>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition disabled:opacity-50"
              >
                {cancelling ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>Cancelling...
                  </>
                ) : (
                  <>
                    <i className="fas fa-ban mr-2"></i>Cancel Ride
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
              <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
              Delete Ride?
            </h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this ride? This action cannot be undone.
            </p>
            
            {/* Ride summary */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div className="flex items-center text-gray-700 mb-1">
                <i className="fas fa-map-marker-alt text-green-600 mr-2"></i>
                {ride.route?.start?.name || ride.route?.start?.address}
              </div>
              <div className="flex items-center text-gray-700">
                <i className="fas fa-map-marker-alt text-red-600 mr-2"></i>
                {ride.route?.destination?.name || ride.route?.destination?.address}
              </div>
              <div className="text-gray-500 mt-2">
                <i className="fas fa-calendar mr-1"></i>
                {formatDate(ride.schedule?.departureDateTime)}
              </div>
            </div>
            
            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
                <i className="fas fa-exclamation-circle mr-1"></i>
                {deleteError}
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>Deleting...
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash mr-2"></i>Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-gray-400 text-xs mt-4">
        <i className="fas fa-clock mr-1"></i>Posted {new Date(ride.createdAt).toLocaleString()}
      </p>
    </div>
  );
};

export default MyRides;
