import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { LoadingSpinner, Alert, Badge } from '../../components/common';
import bookingService from '../../services/bookingService';

const BookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchBooking();
  }, [id]);

  const fetchBooking = async () => {
    try {
      const data = await bookingService.getBookingById(id);
      setBooking(data.booking);
    } catch (err) {
      setError('Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  // Cancel booking handler
  const handleCancelBooking = async () => {
    if (!cancelReason.trim()) {
      alert('Please provide a reason for cancellation');
      return;
    }

    setActionLoading(true);
    try {
      await bookingService.cancelBooking(id, cancelReason);
      setShowCancelModal(false);
      fetchBooking(); // Refresh booking data
    } catch (err) {
      alert(err.message || 'Failed to cancel booking');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading booking..." />;
  }

  if (error || !booking) {
    return (
      <div className="pt-20 pb-12 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <Alert type="error" message={error || 'Booking not found'} />
          <Link to="/bookings" className="text-emerald-500 hover:underline mt-4 inline-block">
            ← Back to My Bookings
          </Link>
        </div>
      </div>
    );
  }

  // Check if booking can be cancelled
  const canCancel = ['PENDING', 'CONFIRMED'].includes(booking.status);

  return (
    <div className="pt-20 pb-12 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Back Button */}
        <Link to="/bookings" className="inline-flex items-center text-emerald-500 hover:text-emerald-700 mb-6">
          <i className="fas fa-arrow-left mr-2"></i>Back to My Bookings
        </Link>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <BookingHeader booking={booking} />
        </div>

        {/* OTP Section */}
        <OTPSection booking={booking} />

        {/* Journey Status */}
        <JourneyStatus booking={booking} />

        {/* Journey Details */}
        <JourneyDetails booking={booking} />

        {/* Special Requests */}
        {booking.specialRequests && (
          <SpecialRequests requests={booking.specialRequests} />
        )}

        {/* Payment Details */}
        <PaymentDetails booking={booking} />

        {/* Driver/Passenger Info */}
        <PersonInfo booking={booking} />

        {/* Cancellation Info */}
        {booking.status === 'CANCELLED' && booking.cancellation && (
          <CancellationInfo cancellation={booking.cancellation} />
        )}

        {/* Action Buttons */}
        {canCancel && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="font-semibold text-gray-700 mb-4">
              <i className="fas fa-cog text-emerald-500 mr-2"></i>Actions
            </h3>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowCancelModal(true)}
                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition flex items-center"
              >
                <i className="fas fa-times-circle mr-2"></i>Cancel Booking
              </button>
              <Link
                to={`/chat?userId=${booking.ride?.rider?._id}`}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition flex items-center"
              >
                <i className="fas fa-comment mr-2"></i>Contact Driver
              </Link>
            </div>
          </div>
        )}

        {/* Rate Experience Button (for completed bookings) */}
        {(booking.status === 'COMPLETED' || booking.status === 'DROPPED_OFF') && !booking.rating && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-yellow-800">
                  <i className="fas fa-star text-yellow-500 mr-2"></i>Rate your experience
                </h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Help other passengers by sharing your feedback
                </p>
              </div>
              <Link
                to={`/bookings/${id}/rate`}
                className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg transition"
              >
                Rate Now
              </Link>
            </div>
          </div>
        )}

        {/* Cancel Modal */}
        {showCancelModal && (
          <CancelModal
            onClose={() => setShowCancelModal(false)}
            onConfirm={handleCancelBooking}
            loading={actionLoading}
            reason={cancelReason}
            setReason={setCancelReason}
          />
        )}
      </div>
    </div>
  );
};

// Cancel Booking Modal
const CancelModal = ({ onClose, onConfirm, loading, reason, setReason }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-800">Cancel Booking?</h3>
          <p className="text-gray-600 mt-2">
            Are you sure you want to cancel this booking? This action cannot be undone.
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for cancellation <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please provide a reason..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            rows={3}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Keep Booking
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !reason.trim()}
            className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>Cancelling...
              </>
            ) : (
              <>
                <i className="fas fa-times mr-2"></i>Cancel Booking
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Special Requests Component
const SpecialRequests = ({ requests }) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h3 className="font-semibold text-gray-700 mb-3">
        <i className="fas fa-sticky-note text-emerald-500 mr-2"></i>Special Requests
      </h3>
      <p className="text-gray-600 bg-gray-50 rounded-lg p-4 italic">
        "{requests}"
      </p>
    </div>
  );
};

// Journey Details Component
const JourneyDetails = ({ booking }) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        <i className="fas fa-route text-emerald-500 mr-2"></i>Journey Details
      </h2>
      
      <div className="space-y-4">
        <div className="flex items-center">
          <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <i className="fas fa-map-marker-alt text-green-600 text-xl"></i>
          </div>
          <div className="ml-4 flex-1">
            <p className="text-sm text-gray-500">Pickup</p>
            <p className="text-lg font-semibold text-gray-800">
              {booking.pickupPoint?.name || booking.pickupPoint?.address || 'Pickup location'}
            </p>
          </div>
        </div>

        <div className="ml-6 border-l-2 border-gray-300 pl-6 py-2">
          <div className="text-gray-600 flex items-center gap-4">
            <span><i className="fas fa-road mr-2"></i>
              {booking.ride?.route?.distance ? `${booking.ride.route.distance.toFixed(1)} km` : 'N/A'}
            </span>
            <span><i className="fas fa-clock mr-2"></i>
              {booking.ride?.route?.duration ? `${Math.round(booking.ride.route.duration)} mins` : 'N/A'}
            </span>
          </div>
        </div>

        <div className="flex items-center">
          <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <i className="fas fa-map-marker-alt text-red-600 text-xl"></i>
          </div>
          <div className="ml-4 flex-1">
            <p className="text-sm text-gray-500">Dropoff</p>
            <p className="text-lg font-semibold text-gray-800">
              {booking.dropoffPoint?.name || booking.dropoffPoint?.address || 'Dropoff location'}
            </p>
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t">
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-2">
            <i className="fas fa-calendar-alt text-emerald-500 mr-2"></i>Departure Time
          </h3>
          <p className="text-lg">
            {formatDate(booking.ride?.schedule?.departureDateTime || booking.createdAt)}
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-2">
            <i className="fas fa-users text-emerald-500 mr-2"></i>Seats Booked
          </h3>
          <p className="text-lg">{booking.seatsBooked || 1} seat(s)</p>
        </div>
      </div>
    </div>
  );
};

// Payment Details Component
const PaymentDetails = ({ booking }) => {
  return (
    <div className="bg-emerald-50 rounded-lg p-6 mb-6">
      <h3 className="font-semibold text-gray-700 mb-3">
        <i className="fas fa-credit-card text-emerald-500 mr-2"></i>Payment Details
      </h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Subtotal:</span>
          <span className="font-semibold">₹{booking.totalPrice || 0}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Payment Method:</span>
          <span className="font-semibold">{booking.payment?.method || 'CASH'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Payment Status:</span>
          <span className={`px-3 py-1 ${
            booking.payment?.status === 'PAID' 
              ? 'bg-green-100 text-green-800' 
              : 'bg-yellow-100 text-yellow-800'
          } rounded-full text-sm font-semibold`}>
            {booking.payment?.status || 'PENDING'}
          </span>
        </div>
        <div className="border-t pt-2 mt-2 flex justify-between text-lg">
          <span className="font-bold">Total:</span>
          <span className="font-bold text-emerald-600">₹{booking.totalPrice || 0}</span>
        </div>
      </div>
    </div>
  );
};

// Person Info (Driver for passengers, Passenger for drivers)
const PersonInfo = ({ booking }) => {
  const rider = booking.ride?.rider;
  const passenger = booking.passenger;

  // Show driver info for passengers
  if (rider) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="font-semibold text-gray-700 mb-4">
          <i className="fas fa-user text-emerald-500 mr-2"></i>Your Driver
        </h3>
        <div className="flex items-start space-x-4">
          <img 
            src={rider.profilePhoto || '/images/default-avatar.png'} 
            alt={rider.firstName}
            className="w-16 h-16 rounded-full object-cover"
          />
          <div className="flex-1">
            <h4 className="text-lg font-semibold">{rider.firstName} {rider.lastName}</h4>
            <div className="flex items-center text-yellow-500 mb-2">
              {[1,2,3,4,5].map(i => (
                <i key={i} className={`fas fa-star ${i <= (rider.rating?.overall || 0) ? '' : 'text-gray-300'}`}></i>
              ))}
              <span className="text-gray-600 ml-2">{(rider.rating?.overall || 0).toFixed(1)}</span>
            </div>
            <div className="flex gap-4 text-sm text-gray-600">
              <span><i className="fas fa-car mr-1"></i>{rider.statistics?.totalRidesCompleted || 0} rides</span>
              {rider.phone && <span><i className="fas fa-phone mr-1"></i>{rider.phone}</span>}
            </div>
            {(booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS') && (
              <div className="mt-3">
                <Link
                  to={`/chat?userId=${rider._id}`}
                  className="inline-flex items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition"
                >
                  <i className="fas fa-comment mr-2"></i>Chat with Driver
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Cancellation Info
const CancellationInfo = ({ cancellation }) => {
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
      <h3 className="font-semibold text-gray-700 mb-2">
        <i className="fas fa-times-circle text-red-500 mr-2"></i>Cancellation Details
      </h3>
      <p className="text-gray-700"><strong>Cancelled by:</strong> {cancellation.cancelledBy}</p>
      <p className="text-gray-700"><strong>Reason:</strong> {cancellation.reason || 'No reason provided'}</p>
      <p className="text-gray-600 text-sm">
        <strong>Date:</strong> {new Date(cancellation.cancelledAt).toLocaleString()}
      </p>
    </div>
  );
};

// OTP Section for Passengers
const OTPSection = ({ booking }) => {
  const copyOTP = (otp, type) => {
    navigator.clipboard.writeText(otp);
    alert(`${type} OTP copied!`);
  };

  // Pickup OTP
  if ((booking.status === 'CONFIRMED' || booking.status === 'PICKUP_PENDING') && 
      booking.verification?.pickup?.code) {
    return (
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 mb-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3">
              <i className="fas fa-key text-2xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-bold">Pickup OTP</h3>
              <p className="text-sm text-blue-100">Show this to your driver at pickup</p>
            </div>
          </div>
        </div>

        <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <p className="text-6xl font-bold tracking-wider">
                {booking.verification.pickup.code}
              </p>
            </div>
            <button
              onClick={() => copyOTP(booking.verification.pickup.code, 'Pickup')}
              className="ml-4 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition"
            >
              <i className="fas fa-copy text-xl"></i>
            </button>
          </div>
        </div>

        <div className="flex items-start space-x-2 text-sm text-blue-100">
          <i className="fas fa-info-circle mt-0.5"></i>
          <div>
            <p className="font-semibold">Important:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Share this OTP with driver when they arrive</li>
              <li>Don't share with anyone else</li>
              <li>OTP will expire in 30 minutes</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Dropoff OTP
  if (booking.status === 'PICKED_UP' && booking.verification?.dropoff?.code) {
    return (
      <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 mb-6 text-white shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center mr-3">
              <i className="fas fa-flag-checkered text-2xl"></i>
            </div>
            <div>
              <h3 className="text-xl font-bold">Dropoff OTP</h3>
              <p className="text-sm text-purple-100">Show this to your driver at destination</p>
            </div>
          </div>
        </div>

        <div className="bg-white bg-opacity-20 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <p className="text-6xl font-bold tracking-wider">
                {booking.verification.dropoff.code}
              </p>
            </div>
            <button
              onClick={() => copyOTP(booking.verification.dropoff.code, 'Dropoff')}
              className="ml-4 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-lg transition"
            >
              <i className="fas fa-copy text-xl"></i>
            </button>
          </div>
        </div>

        <div className="flex items-start space-x-2 text-sm text-purple-100">
          <i className="fas fa-info-circle mt-0.5"></i>
          <div>
            <p className="font-semibold">Important:</p>
            <ul className="list-disc list-inside ml-2 space-y-1">
              <li>Share this OTP when you reach your destination</li>
              <li>Driver will verify before marking dropoff complete</li>
              <li>OTP will expire in 60 minutes</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Journey Status Component
const JourneyStatus = ({ booking }) => {
  if (booking.status === 'PICKUP_PENDING') {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <div className="flex items-center">
          <i className="fas fa-car text-blue-500 text-2xl mr-3 animate-bounce"></i>
          <div>
            <h3 className="font-semibold text-blue-800">Driver is on the way!</h3>
            <p className="text-sm text-blue-600">Get ready with your pickup OTP</p>
          </div>
        </div>
      </div>
    );
  }

  if (booking.status === 'PICKED_UP') {
    return (
      <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mb-6">
        <div className="flex items-center">
          <i className="fas fa-route text-purple-500 text-2xl mr-3 animate-pulse"></i>
          <div>
            <h3 className="font-semibold text-purple-800">Journey in progress</h3>
            <p className="text-sm text-purple-600">You'll need your dropoff OTP when you reach destination</p>
          </div>
        </div>
      </div>
    );
  }

  if (booking.status === 'DROPPED_OFF' || booking.status === 'COMPLETED') {
    return (
      <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
        <div className="flex items-center">
          <i className="fas fa-check-circle text-green-500 text-2xl mr-3"></i>
          <div>
            <h3 className="font-semibold text-green-800">Journey completed!</h3>
            <p className="text-sm text-green-600">Hope you had a great ride. Please rate your experience.</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Booking Header Component
const BookingHeader = ({ booking }) => {
  const getStatusConfig = (status, payment) => {
    const isPaid = payment?.status === 'PAID';
    
    if ((status === 'DROPPED_OFF' || status === 'PICKED_UP') && isPaid) {
      return { class: 'bg-green-100 text-green-800', icon: 'fa-check-circle', text: 'Completed' };
    }
    if (status === 'DROPPED_OFF' && !isPaid) {
      return { class: 'bg-yellow-100 text-yellow-800', icon: 'fa-clock', text: 'Payment Pending' };
    }
    
    const configs = {
      'PENDING': { class: 'bg-yellow-100 text-yellow-800', icon: 'fa-clock', text: 'Pending' },
      'CONFIRMED': { class: 'bg-blue-100 text-blue-800', icon: 'fa-check-circle', text: 'Confirmed' },
      'PICKUP_PENDING': { class: 'bg-blue-100 text-blue-800', icon: 'fa-hourglass-half', text: 'Ready for Pickup' },
      'PICKED_UP': { class: 'bg-purple-100 text-purple-800', icon: 'fa-user-check', text: 'On Board' },
      'IN_PROGRESS': { class: 'bg-blue-100 text-blue-800', icon: 'fa-car', text: 'In Progress' },
      'COMPLETED': { class: 'bg-green-100 text-green-800', icon: 'fa-check-circle', text: 'Completed' },
      'CANCELLED': { class: 'bg-red-100 text-red-800', icon: 'fa-times-circle', text: 'Cancelled' },
      'REJECTED': { class: 'bg-red-100 text-red-800', icon: 'fa-ban', text: 'Rejected' }
    };
    return configs[status] || { class: 'bg-gray-100 text-gray-800', icon: 'fa-question', text: status };
  };

  const statusConfig = getStatusConfig(booking.status, booking.payment);

  return (
    <div className="flex justify-between items-start">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          <i className="fas fa-ticket-alt text-emerald-500 mr-2"></i>Booking Details
        </h1>
        <p className="text-gray-600">
          Booking ID: <span className="font-mono font-semibold">#{booking._id.slice(-8).toUpperCase()}</span>
        </p>
        <span className={`${statusConfig.class} px-4 py-2 rounded-full text-sm font-semibold inline-block mt-2`}>
          <i className={`fas ${statusConfig.icon} mr-2`}></i>
          {statusConfig.text}
        </span>
      </div>
    </div>
  );
};

export default BookingDetails;
