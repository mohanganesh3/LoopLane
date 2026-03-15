import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LoadingSpinner, Alert, ConfirmModal } from '../../components/common';
import { ClayCard, ClayButton, ClayBadge } from '../../components/clay';
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
  // I6: Date range filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
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
        page: currentPage,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
      setBookings(data.bookings || []);
      setPagination(data.pagination || {});
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load bookings');
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
    const isPaid = ['PAID', 'PAYMENT_CONFIRMED'].includes(booking.payment?.status);

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
      <ClayBadge variant={config.variant}>
        <i className={`fas ${config.icon} mr-1`}></i>
        {config.text}
      </ClayBadge>
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

  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
  const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-12 min-h-screen"
      style={{ background: 'var(--ll-cream, #f5f0e8)' }}
    >
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <ClayCard variant="default" padding="lg" className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h1
                className="text-3xl font-bold text-gray-800"
                style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}
              >
                <i className="fas fa-ticket-alt text-emerald-500 mr-3"></i>
                My Bookings
              </h1>
              <ClayButton variant="primary" as={Link} to="/find-ride">
                <i className="fas fa-plus-circle mr-2"></i>
                Book New Ride
              </ClayButton>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex flex-wrap gap-2">
              {statusTabs.map((tab) => (
                <ClayButton
                  key={tab.key}
                  variant={currentStatus === tab.key ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => handleStatusChange(tab.key)}
                >
                  {tab.icon && <i className={`fas ${tab.icon} mr-2`}></i>}
                  {tab.label}
                </ClayButton>
              ))}
            </div>
          </ClayCard>
        </motion.div>

        {/* I5: Stats Summary Bar */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {(() => {
            const total = bookings.length;
            const confirmed = bookings.filter(b => ['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_PROGRESS'].includes(b.status)).length;
            const completed = bookings.filter(b => ['COMPLETED', 'DROPPED_OFF'].includes(b.status)).length;
            const totalSpent = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
            return [
              { label: 'Total', value: total, icon: 'fa-ticket-alt', color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active', value: confirmed, icon: 'fa-check-circle', color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Completed', value: completed, icon: 'fa-flag-checkered', color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Total Spent', value: `₹${totalSpent.toLocaleString()}`, icon: 'fa-wallet', color: 'text-amber-600', bg: 'bg-amber-50' }
            ];
          })().map((stat, i) => (
            <ClayCard key={i} variant="flat" padding="sm">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 ${stat.bg} rounded-full flex items-center justify-center`}>
                  <i className={`fas ${stat.icon} ${stat.color}`}></i>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-800">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                </div>
              </div>
            </ClayCard>
          ))}
        </motion.div>

        {/* I6: Date Range Filter */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-sm text-gray-500 font-medium"><i className="fas fa-calendar-alt mr-1"></i>Date Range:</span>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white focus:border-emerald-400 outline-none" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white focus:border-emerald-400 outline-none" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-2 py-1 text-xs text-red-500 hover:text-red-700">
              <i className="fas fa-times mr-1"></i>Clear
            </button>
          )}
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError('')} />}

        {/* Bookings List */}
        {loading ? (
          <LoadingSpinner fullScreen={false} size="lg" text="Loading bookings..." />
        ) : bookings.length === 0 ? (
          <motion.div variants={fadeUp} initial="hidden" animate="visible">
            <ClayCard variant="default" padding="xl">
              <div className="flex flex-col items-center text-center max-w-lg mx-auto py-8">
                <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6">
                  <i className="fas fa-ticket-alt text-blue-500 text-4xl transform rotate-[-15deg]"></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                  {currentStatus === 'all' ? "Ready for your next adventure?" : `No ${currentStatus} bookings`}
                </h3>
                <p className="text-gray-600 mb-8 text-lg">
                  {currentStatus === 'all'
                    ? "You haven't booked any rides yet. Thousands of drivers are heading your way—find a ride that fits your schedule."
                    : "Try adjusting your filters or search for a new ride to get started."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-8">
                  <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3 text-left border border-emerald-100">
                    <i className="fas fa-leaf text-emerald-500 text-xl"></i>
                    <div>
                      <h4 className="font-semibold text-emerald-900 text-sm">Eco-friendly</h4>
                      <p className="text-xs text-emerald-700">Reduce carbon footprint</p>
                    </div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 flex items-center gap-3 text-left border border-amber-100">
                    <i className="fas fa-wallet text-amber-500 text-xl"></i>
                    <div>
                      <h4 className="font-semibold text-amber-900 text-sm">Cost-effective</h4>
                      <p className="text-xs text-amber-700">Save up to 40% on travel</p>
                    </div>
                  </div>
                </div>

                <ClayButton variant="primary" size="lg" as={Link} to="/find-ride" className="w-full sm:w-auto px-10">
                  <i className="fas fa-search mr-2"></i>Find a Ride Now
                </ClayButton>
              </div>
            </ClayCard>
          </motion.div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-6">
            {bookings.map((booking) => (
              <motion.div key={booking._id} variants={fadeUp}>
                <ClayCard variant="default" padding="lg" hover>
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
                    <ClayButton variant="ghost" size="sm" as={Link} to={`/bookings/${booking._id}`}>
                      <i className="fas fa-eye mr-2"></i>View Details
                    </ClayButton>

                    {['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'IN_PROGRESS'].includes(booking.status) && (
                      <ClayButton variant="primary" size="sm" as={Link} to={`/tracking/${booking._id}`}>
                        <i className="fas fa-map-marked-alt mr-2"></i>Live Track
                      </ClayButton>
                    )}

                    {['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'IN_PROGRESS'].includes(booking.status) && (
                      <ClayButton variant="outline" size="sm" as={Link} to={`/chat?bookingId=${booking._id}`}>
                        <i className="fas fa-comments mr-2"></i>Chat
                      </ClayButton>
                    )}

                    {['PENDING', 'CONFIRMED'].includes(booking.status) && (
                      <ClayButton variant="outline" size="sm" onClick={() => handleCancelBooking(booking._id)}
                        className="!border-red-300 !text-red-600 hover:!bg-red-50"
                      >
                        <i className="fas fa-times mr-2"></i>Cancel
                      </ClayButton>
                    )}

                    {booking.status === 'COMPLETED' && !booking.reviews?.passengerReviewed && (
                      <ClayButton variant="clay" size="sm" as={Link} to={`/bookings/${booking._id}/rate`}>
                        <i className="fas fa-star mr-2"></i>Write Review
                      </ClayButton>
                    )}

                    {booking.status === 'COMPLETED' && booking.reviews?.passengerReviewed && (
                      <ClayBadge variant="success">
                        <i className="fas fa-check-circle mr-2"></i>Reviewed
                      </ClayBadge>
                    )}
                  </div>

                  {/* Booking Time */}
                  <p className="text-gray-400 text-xs mt-4">
                    <i className="fas fa-clock mr-1"></i>
                    Booked {new Date(booking.createdAt).toLocaleString()}
                  </p>
                </ClayCard>
              </motion.div>
            ))}

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-8">
                {pagination.hasPrevPage && (
                  <ClayButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                  >
                    <i className="fas fa-chevron-left"></i>
                  </ClayButton>
                )}

                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter(i => i === 1 || i === pagination.totalPages ||
                    (i >= currentPage - 1 && i <= currentPage + 1))
                  .map((page, index, arr) => (
                    <span key={page}>
                      {index > 0 && arr[index - 1] !== page - 1 && (
                        <span className="px-2">...</span>
                      )}
                      <ClayButton
                        variant={page === currentPage ? 'primary' : 'ghost'}
                        size="sm"
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </ClayButton>
                    </span>
                  ))}

                {pagination.hasNextPage && (
                  <ClayButton
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                  >
                    <i className="fas fa-chevron-right"></i>
                  </ClayButton>
                )}
              </div>
            )}
          </motion.div>
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
    </motion.div>
  );
};

export default MyBookings;
