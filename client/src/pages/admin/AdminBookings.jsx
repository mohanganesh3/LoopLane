import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';

const AdminBookings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStatus, setCurrentStatus] = useState(searchParams.get('status') || 'all');
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0
  });
  const [stats, setStats] = useState({
    all: 0,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0
  });

  useEffect(() => {
    let isMounted = true;
    
    const loadBookings = async () => {
      setLoading(true);
      try {
        const page = searchParams.get('page') || 1;
        const status = searchParams.get('status') || 'all';
        setCurrentStatus(status);
        
        const response = await adminService.getBookings({ page, status });
        if (isMounted) {
          if (response && response.success) {
            setBookings(response.bookings || []);
            setPagination(response.pagination || { page: 1, pages: 1, total: 0 });
            if (response.stats) {
              setStats(response.stats);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          // Don't show error for auth issues
          if (err.response?.status !== 401 && err.response?.status !== 403) {
            setError(err.response?.data?.message || err.message || 'Failed to load bookings');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadBookings();
    
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const page = searchParams.get('page') || 1;
      const status = searchParams.get('status') || 'all';
      setCurrentStatus(status);
      
      const response = await adminService.getBookings({ page, status });
      if (response && response.success) {
        setBookings(response.bookings || []);
        setPagination(response.pagination || { page: 1, pages: 1, total: 0 });
        if (response.stats) {
          setStats(response.stats);
        }
      }
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError(err.response?.data?.message || err.message || 'Failed to load bookings');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStatusFilter = (status) => {
    setSearchParams({ status, page: '1' });
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'CONFIRMED': 'bg-green-100 text-green-800',
      'ACCEPTED': 'bg-blue-100 text-blue-800',
      'CANCELLED': 'bg-red-100 text-red-800',
      'COMPLETED': 'bg-emerald-100 text-emerald-800',
      'IN_PROGRESS': 'bg-purple-100 text-purple-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentBadgeClass = (status) => {
    const classes = {
      'PAID': 'bg-green-100 text-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'REFUNDED': 'bg-blue-100 text-blue-800',
      'FAILED': 'bg-red-100 text-red-800'
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          📚 Bookings Management
        </h1>
        <p className="text-gray-600 mt-1">Monitor and manage all ride bookings</p>
      </div>

      {error && <Alert type="error" message={error} className="mb-6" onClose={() => setError('')} />}

      {/* Filter Tabs */}
      <div className="bg-white rounded-xl shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          {[
            { key: 'all', label: <><i className="fas fa-chart-bar mr-1"></i> All Bookings</>, count: stats.all || pagination.total },
            { key: 'PENDING', label: <><i className="fas fa-clock mr-1"></i> Pending</>, count: stats.pending },
            { key: 'CONFIRMED', label: <><i className="fas fa-check-circle mr-1"></i> Confirmed</>, count: stats.confirmed },
            { key: 'COMPLETED', label: <><i className="fas fa-flag-checkered mr-1"></i> Completed</>, count: stats.completed },
            { key: 'CANCELLED', label: <><i className="fas fa-times-circle mr-1"></i> Cancelled</>, count: stats.cancelled }
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
              {label}
              {count !== undefined && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  currentStatus === key ? 'bg-white text-indigo-500' : 'bg-gray-200'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="text-6xl text-gray-300 mb-4"><i className="fas fa-file-alt"></i></div>
          <h3 className="text-xl font-semibold text-gray-600 mb-2">No Bookings Found</h3>
          <p className="text-gray-500">No bookings match your filter criteria.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking._id}
              className="bg-white rounded-xl shadow-md hover:shadow-lg transition p-6 border-l-4 border-indigo-500"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">
                    Booking #{booking._id.toString().slice(-8).toUpperCase()}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Created on {new Date(booking.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeClass(booking.status)}`}>
                  {booking.status}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-gray-500 text-sm">Passenger</p>
                  <p className="font-semibold text-gray-800">
                    {booking.passenger?.profile?.firstName || 'Unknown'} {booking.passenger?.profile?.lastName || ''}
                  </p>
                  <p className="text-sm text-gray-500">{booking.passenger?.email}</p>
                </div>

                <div>
                  <p className="text-gray-500 text-sm">Route</p>
                  <p className="font-semibold text-gray-800 text-sm">
                    <i className="fas fa-map-marker-alt text-green-500 mr-1"></i> {(booking.ride?.route?.start?.address || booking.ride?.from?.address)?.substring(0, 25) || 'Unknown'}...
                  </p>
                  <p className="font-semibold text-gray-800 text-sm">
                    <i className="fas fa-flag-checkered text-red-500 mr-1"></i> {(booking.ride?.route?.destination?.address || booking.ride?.to?.address)?.substring(0, 25) || 'Unknown'}...
                  </p>
                </div>

                <div>
                  <p className="text-gray-500 text-sm">Seats</p>
                  <p className="font-semibold text-gray-800">{booking.seatsBooked || 1} seat(s)</p>
                </div>

                <div>
                  <p className="text-gray-500 text-sm">Price</p>
                  <p className="font-bold text-emerald-600 text-lg">
                    ₹{booking.totalPrice || booking.totalAmount || booking.pricing?.total || 0}
                  </p>
                </div>

                <div>
                  <p className="text-gray-500 text-sm">Payment Status</p>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getPaymentBadgeClass(booking.payment?.status || 'PENDING')}`}>
                    {booking.payment?.status || 'PENDING'}
                  </span>
                </div>

                <div>
                  <p className="text-gray-500 text-sm">Ride Date</p>
                  <p className="font-semibold text-gray-800">
                    {booking.ride?.departureTime
                      ? new Date(booking.ride.departureTime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>

              {/* Driver Info */}
              {booking.ride?.rider && (
                <div className="mt-4 pt-4 border-t flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={booking.ride.rider.profile?.photo || booking.ride.rider.profilePhoto || '/images/default-avatar.png'}
                      className="w-10 h-10 rounded-full object-cover"
                      alt="Driver"
                    />
                    <div>
                      <p className="text-sm text-gray-500">Driver</p>
                      <p className="font-semibold text-gray-800">
                        {booking.ride.rider.profile?.firstName || booking.ride.rider.firstName || booking.ride.rider.name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/admin/bookings/${booking._id}`)}
                    className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg font-semibold hover:bg-indigo-200 transition text-sm"
                  >
                    View Details →
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex justify-center items-center space-x-2 mt-8">
              {pagination.page > 1 && (
                <button
                  onClick={() => setSearchParams({ status: currentStatus, page: (pagination.page - 1).toString() })}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  ← Previous
                </button>
              )}

              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                let page;
                if (pagination.pages <= 5) {
                  page = i + 1;
                } else if (pagination.page <= 3) {
                  page = i + 1;
                } else if (pagination.page >= pagination.pages - 2) {
                  page = pagination.pages - 4 + i;
                } else {
                  page = pagination.page - 2 + i;
                }
                return (
                  <button
                    key={page}
                    onClick={() => setSearchParams({ status: currentStatus, page: page.toString() })}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${
                      page === pagination.page
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}

              {pagination.page < pagination.pages && (
                <button
                  onClick={() => setSearchParams({ status: currentStatus, page: (pagination.page + 1).toString() })}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Next →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminBookings;
