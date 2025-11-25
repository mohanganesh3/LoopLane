import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, Badge, LoadingSpinner, Alert, ConfirmModal } from '../../components/common';
import { useToast } from '../../components/common/Toast';
import { useSocket } from '../../context/SocketContext';
import bookingService from '../../services/bookingService';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';
import { getRating, formatRating } from '../../utils/helpers';

// Rider avatar component with fallback
const RiderAvatar = ({ rider }) => {
  const [imgError, setImgError] = useState(false);
  const photoUrl = getUserPhoto(rider);
  const displayName = getUserDisplayName(rider);
  
  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        className="w-12 h-12 rounded-full mr-4 object-cover"
        alt={displayName}
        onError={() => setImgError(true)}
      />
    );
  }
  
  return (
    <div className={`w-12 h-12 rounded-full mr-4 ${getAvatarColor(displayName)} flex items-center justify-center text-white font-bold text-lg`}>
      {getInitials(displayName)}
    </div>
  );
};

const MyBookings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { socket, isConnected } = useSocket();
  const toast = useToast();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelBookingId, setCancelBookingId] = useState(null);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false
  });

  const currentStatus = searchParams.get('status') || 'all';
  const currentPage = parseInt(searchParams.get('page') || '1');

  const statusTabs = [
    { key: 'all', label: 'All Bookings', icon: null, color: 'primary' },
    { key: 'pending', label: 'Pending', icon: 'fa-clock', color: 'yellow' },
    { key: 'confirmed', label: 'Confirmed', icon: 'fa-check-circle', color: 'blue' },
    { key: 'in-progress', label: 'In Progress', icon: 'fa-route', color: 'green' },
    { key: 'completed', label: 'Completed', icon: 'fa-flag-checkered', color: 'purple' },
    { key: 'cancelled', label: 'Cancelled', icon: 'fa-times-circle', color: 'red' }
  ];

  useEffect(() => {
    fetchBookings();
  }, [currentStatus, currentPage]);
  
  // Listen for real-time booking updates
  useEffect(() => {
    if (socket && isConnected) {
      const handleBookingConfirmed = (data) => {
        toast?.success('Your booking has been confirmed!');
        fetchBookings();
      };
      
      const handleBookingRejected = (data) => {
        toast?.error('Your booking request was rejected.');
        fetchBookings();
      };
      
      const handleBookingCancelled = (data) => {
        toast?.warning('A booking has been cancelled.');
        fetchBookings();
      };
      
      socket.on('booking-confirmed', handleBookingConfirmed);
      socket.on('booking-rejected', handleBookingRejected);
      socket.on('booking-cancelled', handleBookingCancelled);
      
      return () => {
        socket.off('booking-confirmed', handleBookingConfirmed);
        socket.off('booking-rejected', handleBookingRejected);
        socket.off('booking-cancelled', handleBookingCancelled);
      };
    }
  }, [socket, isConnected]);

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await bookingService.getMyBookings({ 
        status: currentStatus !== 'all' ? currentStatus.toUpperCase().replace('-', '_') : undefined,
        page: currentPage 
      });
      setBookings(data.bookings || []);
      setPagination(data.pagination || {});
    } catch (err) {
      setError(err.message || 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status) => {
    setSearchParams({ status, page: '1' });
  };

  const handlePageChange = (page) => {
    setSearchParams({ status: currentStatus, page: page.toString() });
  };

  const handleCancelBooking = (bookingId) => {
    setCancelBookingId(bookingId);
  };

  const confirmCancelBooking = async () => {
    if (!cancelBookingId) return;
    
    try {
      await bookingService.cancelBooking(cancelBookingId);
      setCancelBookingId(null);
      fetchBookings();
    } catch (err) {
      setError(err.message || 'Failed to cancel booking');
      setCancelBookingId(null);
    }
  };

  const getStatusBadge = (booking) => {
    const status = booking.status;
    const isPaid = booking.payment?.status === 'PAID';
    
    const statusConfig = {
      'PENDING': { variant: 'warning', icon: 'fa-clock', text: 'Pending' },
      'CONFIRMED': { variant: 'info', icon: 'fa-check-circle', text: 'Confirmed' },
      'PICKUP_PENDING': { variant: 'info', icon: 'fa-hourglass-half', text: 'Ready for Pickup' },
      'PICKED_UP': { variant: 'primary', icon: 'fa-user-check', text: 'On Board' },
      'IN_PROGRESS': { variant: 'success', icon: 'fa-route', text: 'In Progress' },
      'DROPPED_OFF': isPaid 
        ? { variant: 'success', icon: 'fa-check-circle', text: 'Completed' }
        : { variant: 'warning', icon: 'fa-clock', text: 'Payment Pending' },
      'COMPLETED': { variant: 'success', icon: 'fa-check-circle', text: 'Completed' },
      'CANCELLED': { variant: 'danger', icon: 'fa-times-circle', text: 'Cancelled' }
    };

    const config = statusConfig[status] || { variant: 'default', icon: 'fa-question', text: status };
    
    return (
      <Badge variant={config.variant}>
        <i className={`fas ${config.icon} mr-1`}></i>
        {config.text}
      </Badge>
    );
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (time) => time || 'N/A';

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating)) {
        stars.push(<i key={i} className="fas fa-star text-yellow-400"></i>);
      } else if (i - 0.5 <= rating) {
        stars.push(<i key={i} className="fas fa-star-half-alt text-yellow-400"></i>);
      } else {
        stars.push(<i key={i} className="far fa-star text-yellow-400"></i>);
      }
    }
    return stars;
  };

  return (
    <div className="pb-12 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-800">
              <i className="fas fa-ticket-alt text-emerald-500 mr-3"></i>
              My Bookings
            </h1>
            <Link
              to="/find-ride"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              <i className="fas fa-plus-circle mr-2"></i>
              Book New Ride
            </Link>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleStatusChange(tab.key)}
                className={`px-6 py-2 rounded-lg font-semibold transition ${
                  currentStatus === tab.key
                    ? `bg-emerald-500 text-white`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tab.icon && <i className={`fas ${tab.icon} mr-2`}></i>}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError('')} />}

        {/* Bookings List */}
        {loading ? (
          <LoadingSpinner fullScreen={false} size="lg" text="Loading bookings..." />
        ) : bookings.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <i className="fas fa-inbox text-gray-300 text-6xl mb-4"></i>
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No bookings found</h3>
              <p className="text-gray-500 mb-6">
                {currentStatus === 'all'
                  ? "You haven't booked any rides yet"
                  : `No ${currentStatus} bookings at the moment`}
              </p>
              <Link
                to="/find-ride"
                className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition"
              >
                <i className="fas fa-search mr-2"></i>Find Rides
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking) => (
              <Card key={booking._id} hover className="p-6">
                <div className="flex items-start justify-between mb-4">
                  {/* Status Badge */}
                  <div>
                    {getStatusBadge(booking)}
                    <p className="text-gray-500 text-sm mt-2">
                      Booking ID: #{booking._id?.toString().slice(-8).toUpperCase()}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <div className="text-3xl font-bold text-emerald-500 mb-1">
                      ₹{booking.totalPrice || booking.totalAmount}
                    </div>
                    <p className="text-gray-600 text-sm">{booking.seatsBooked} seat(s)</p>
                  </div>
                </div>

                {/* Ride Details */}
                {booking.ride && (
                  <div className="border-t pt-4 mb-4">
                    {/* Driver Info */}
                    <div className="flex items-center mb-4">
                      <RiderAvatar rider={booking.ride.rider} />
                      <div>
                        <h3 className="font-semibold text-gray-800">
                          {getUserDisplayName(booking.ride.rider)}
                        </h3>
                        <div className="flex items-center text-sm text-gray-600">
                          <div className="mr-2">
                            {renderStars(getRating(booking.ride.rider?.rating))}
                          </div>
                          <span>{formatRating(booking.ride.rider?.rating)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-gray-700">
                        <i className="fas fa-map-marker-alt text-green-600 w-6"></i>
                        <span className="ml-2">
                          {booking.pickupPoint?.address ||
                            booking.ride?.route?.start?.address ||
                            'Pickup Location'}
                        </span>
                      </div>
                      <div className="flex items-center text-gray-400 ml-6">
                        <i className="fas fa-ellipsis-v"></i>
                      </div>
                      <div className="flex items-center text-gray-700">
                        <i className="fas fa-map-marker-alt text-red-600 w-6"></i>
                        <span className="ml-2">
                          {booking.dropoffPoint?.address ||
                            booking.ride?.route?.destination?.address ||
                            'Drop-off Location'}
                        </span>
                      </div>
                    </div>

                    {/* Ride Info Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <i className="fas fa-calendar text-emerald-500 mr-2"></i>
                        {formatDate(booking.ride.schedule?.departureDateTime)}
                      </div>
                      <div>
                        <i className="fas fa-clock text-emerald-500 mr-2"></i>
                        {formatTime(booking.ride.schedule?.time)}
                      </div>
                      {(booking.ride.rider?.vehicles?.[0] || booking.ride.rider?.vehicle) && (
                        <div>
                          <i className="fas fa-car text-emerald-500 mr-2"></i>
                          {(booking.ride.rider.vehicles?.[0] || booking.ride.rider.vehicle)?.make} {(booking.ride.rider.vehicles?.[0] || booking.ride.rider.vehicle)?.model} ({(booking.ride.rider.vehicles?.[0] || booking.ride.rider.vehicle)?.color})
                        </div>
                      )}
                      {(booking.ride.rider?.vehicles?.[0]?.licensePlate || booking.ride.rider?.vehicle?.registrationNumber) && (
                        <div>
                          <i className="fas fa-id-card text-emerald-500 mr-2"></i>
                          {booking.ride.rider.vehicles?.[0]?.licensePlate || booking.ride.rider.vehicle?.registrationNumber}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* OTP Display Section - Show prominently when needed */}
                {booking.status === 'PICKUP_PENDING' && booking.verification?.pickup?.code && (
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-4 mb-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                          <i className="fas fa-key text-2xl"></i>
                        </div>
                        <div>
                          <h4 className="font-bold">Pickup OTP</h4>
                          <p className="text-sm text-blue-100">Show to driver at pickup</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-4xl font-mono font-bold tracking-[0.3em]">{booking.verification.pickup.code}</p>
                      </div>
                    </div>
                  </div>
                )}

                {(booking.status === 'PICKED_UP' || booking.status === 'IN_TRANSIT') && booking.verification?.dropoff?.code && (
                  <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-4 mb-4 text-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                          <i className="fas fa-flag-checkered text-2xl"></i>
                        </div>
                        <div>
                          <h4 className="font-bold">Dropoff OTP</h4>
                          <p className="text-sm text-purple-100">Show to driver at destination</p>
                        </div>
                      </div>
                      <div className="text-center">
                        <p className="text-4xl font-mono font-bold tracking-[0.3em]">{booking.verification.dropoff.code}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="border-t pt-4 flex flex-wrap gap-3">
                  <Link
                    to={`/bookings/${booking._id}`}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition"
                  >
                    <i className="fas fa-eye mr-2"></i>View Details
                  </Link>

                  {['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'IN_PROGRESS'].includes(booking.status) && (
                    <Link
                      to={`/tracking/${booking._id}`}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-semibold transition"
                    >
                      <i className="fas fa-map-marked-alt mr-2"></i>Live Track
                    </Link>
                  )}

                  {['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'IN_PROGRESS'].includes(booking.status) && (
                    <Link
                      to={`/chat?bookingId=${booking._id}`}
                      className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition"
                    >
                      <i className="fas fa-comments mr-2"></i>Chat
                    </Link>
                  )}

                  {booking.status === 'PENDING' && (
                    <button
                      onClick={() => handleCancelBooking(booking._id)}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition"
                    >
                      <i className="fas fa-times mr-2"></i>Cancel
                    </button>
                  )}

                  {booking.status === 'COMPLETED' && !booking.reviews?.passengerReviewed && (
                    <Link
                      to={`/bookings/${booking._id}/rate`}
                      className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition"
                    >
                      <i className="fas fa-star mr-2"></i>Write Review
                    </Link>
                  )}

                  {booking.status === 'COMPLETED' && booking.reviews?.passengerReviewed && (
                    <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-semibold">
                      <i className="fas fa-check-circle mr-2"></i>Reviewed
                    </span>
                  )}
                </div>

                {/* Booking Time */}
                <p className="text-gray-400 text-xs mt-4">
                  <i className="fas fa-clock mr-1"></i>
                  Booked {new Date(booking.createdAt).toLocaleString()}
                </p>
              </Card>
            ))}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-8">
                {pagination.hasPrevPage && (
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    <i className="fas fa-chevron-left"></i>
                  </button>
                )}

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(i => i === 1 || i === pagination.totalPages || 
                    (i >= currentPage - 1 && i <= currentPage + 1))
                  .map((page, index, arr) => (
                    <span key={page}>
                      {index > 0 && arr[index - 1] !== page - 1 && (
                        <span className="px-2">...</span>
                      )}
                      <button
                        onClick={() => handlePageChange(page)}
                        className={`px-4 py-2 rounded-lg font-semibold transition ${
                          page === currentPage
                            ? 'bg-emerald-500 text-white'
                            : 'bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    </span>
                  ))}

                {pagination.hasNextPage && (
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    <i className="fas fa-chevron-right"></i>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cancel Booking Confirmation Modal */}
      <ConfirmModal
        isOpen={!!cancelBookingId}
        onClose={() => setCancelBookingId(null)}
        onConfirm={confirmCancelBooking}
        title="Cancel Booking"
        message="Are you sure you want to cancel this booking? This action cannot be undone."
        confirmText="Cancel Booking"
        cancelText="Keep Booking"
        variant="danger"
      />
    </div>
  );
};

export default MyBookings;
