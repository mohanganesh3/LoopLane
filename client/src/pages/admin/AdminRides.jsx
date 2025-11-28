import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';

const AdminRides = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || 'all',
    date: searchParams.get('date') || ''
  });

  useEffect(() => {
    let isMounted = true;
    
    const loadRides = async () => {
      setLoading(true);
      try {
        const response = await adminService.getRides(filters);
        if (isMounted) {
          if (response && response.success) {
            setRides(response.rides || []);
          }
        }
      } catch (err) {
        if (isMounted) {
          // Don't show error for auth issues
          if (err.response?.status !== 401 && err.response?.status !== 403) {
            setError(err.response?.data?.message || err.message || 'Failed to load rides');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadRides();
    
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const fetchRides = async () => {
    setLoading(true);
    try {
      const response = await adminService.getRides(filters);
      if (response && response.success) {
        setRides(response.rides || []);
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError(err.response?.data?.message || err.message || 'Failed to load rides');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.date) params.set('date', filters.date);
    setSearchParams(params);
  };

  const handleCancelRide = async (rideId) => {
    const reason = prompt('Enter reason for cancellation:');
    if (!reason) return;
    
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;

    try {
      const response = await adminService.cancelRide(rideId, reason);
      if (response.success) {
        setSuccess('Ride cancelled successfully');
        fetchRides();
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel ride');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'ACTIVE': 'bg-blue-100 text-blue-800',
      'SCHEDULED': 'bg-purple-100 text-purple-800',
      'IN_PROGRESS': 'bg-yellow-100 text-yellow-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
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
        <h1 className="text-2xl font-bold text-gray-800"><i className="fas fa-car mr-2"></i>Rides Management</h1>
        <p className="text-gray-600 mt-1">Monitor and manage all rides in the system</p>
      </div>

      {error && <Alert type="error" message={error} className="mb-6" onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} className="mb-6" onClose={() => setSuccess('')} />}

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-md p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder="Origin, destination, rider..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date</label>
            <input
              type="date"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={applyFilters}
              className="w-full bg-indigo-500 text-white px-6 py-2 rounded-lg hover:bg-indigo-600 transition font-semibold"
            >
              <i className="fas fa-search mr-1"></i> Search
            </button>
          </div>
        </div>
      </div>

      {/* Rides Count */}
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        <i className="fas fa-car mr-2"></i>All Rides ({rides.length})
      </h3>

      {/* Rides List */}
      {rides.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl text-gray-300 mb-4"><i className="fas fa-car"></i></div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Rides Found</h3>
          <p className="text-gray-500">No rides match your search criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rides.map((ride) => (
            <div
              key={ride._id}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 border-l-4 border-indigo-500"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-2 text-lg font-semibold text-gray-800">
                  <span className="text-green-500">●</span>
                  <span>{ride.route?.start?.address?.split(',')[0] || ride.from?.address?.split(',')[0] || 'Unknown'}</span>
                  <span className="text-gray-400">→</span>
                  <i className="fas fa-map-marker-alt text-red-500"></i>
                  <span>{ride.route?.destination?.address?.split(',')[0] || ride.to?.address?.split(',')[0] || 'Unknown'}</span>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadge(ride.status)}`}>
                  {ride.status}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg mb-4">
                <div>
                  <p className="text-gray-500 text-sm">Rider</p>
                  <p className="font-semibold text-gray-800">
                    {ride.rider?.profile?.firstName || ride.rider?.name || 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Date & Time</p>
                  <p className="font-semibold text-gray-800">
                    {ride.departureTime
                      ? new Date(ride.departureTime).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })
                      : 'N/A'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Seats</p>
                  <p className="font-semibold text-gray-800">{ride.pricing?.availableSeats || ride.availableSeats || 0} available</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Price/Seat</p>
                  <p className="font-bold text-emerald-600">₹{ride.pricing?.pricePerSeat || ride.pricePerSeat || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Distance</p>
                  <p className="font-semibold text-gray-800">
                    {(ride.route?.distance?.value || ride.distance) ? `${((ride.route?.distance?.value || ride.distance) / 1000).toFixed(1)} km` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-sm">Duration</p>
                  <p className="font-semibold text-gray-800">
                    {(ride.route?.duration?.value || ride.duration) ? `${Math.round((ride.route?.duration?.value || ride.duration) / 60)} min` : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/admin/rides/${ride._id}`)}
                  className="px-4 py-2 bg-indigo-500 text-white rounded-lg font-semibold hover:bg-indigo-600 transition text-sm"
                >
                  <i className="fas fa-eye mr-1"></i> View Details
                </button>
                {ride.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleCancelRide(ride._id)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition text-sm"
                  >
                    <i className="fas fa-times-circle mr-1"></i> Cancel Ride
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminRides;
