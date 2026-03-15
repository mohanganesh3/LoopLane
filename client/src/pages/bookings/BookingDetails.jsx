import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { LoadingSpinner, Alert, Badge, BookingProgressStepper, SkeletonCard, SkeletonProfile } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import bookingService from '../../services/bookingService';
import ReportModal from '../../components/common/ReportModal';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';
import { getRating, formatRating } from '../../utils/helpers';
import { motion } from 'framer-motion';

const BookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [notification, setNotification] = useState(null);

  // OTP Verification State
  const [otpInput, setOtpInput] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpType, setOtpType] = useState(null); // 'pickup' or 'dropoff'
  const [showReportModal, setShowReportModal] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [bidLoading, setBidLoading] = useState(false);

  useEffect(() => {
    fetchBooking();
  }, [id]);

  useEffect(() => {
    if (booking?.totalPrice) {
      const nextAmount = booking.bidding?.proposedPrice || booking.totalPrice;
      setBidAmount(String(Math.round(nextAmount)));
    }
  }, [booking?.totalPrice, booking?.bidding?.proposedPrice]);

  // Listen for real-time booking updates
  useEffect(() => {
    if (socket && isConnected && id) {
      // Listen for booking status changes
      const handleBookingConfirmed = (data) => {
        if (data.bookingId === id) {
          setNotification({ type: 'success', message: 'Booking has been confirmed!' });
          fetchBooking();
        }
      };

      const handleBookingRejected = (data) => {
        if (data.bookingId === id) {
          setNotification({ type: 'error', message: 'Booking has been rejected.' });
          fetchBooking();
        }
      };

      const handleBookingCancelled = (data) => {
        if (data.bookingId === id) {
          setNotification({ type: 'warning', message: 'Booking has been cancelled.' });
          fetchBooking();
        }
      };

      const handlePickupConfirmed = (data) => {
        if (data.bookingId === id) {
          setNotification({ type: 'success', message: 'Pickup verified! Passenger is on board.' });
          fetchBooking();
        }
      };

      const handleDropoffConfirmed = (data) => {
        if (data.bookingId === id) {
          setNotification({ type: 'success', message: 'Journey completed! Great job.' });
          fetchBooking();
        }
      };

      socket.on('booking-confirmed', handleBookingConfirmed);
      socket.on('booking-rejected', handleBookingRejected);
      socket.on('booking-cancelled', handleBookingCancelled);
      socket.on('pickup-confirmed', handlePickupConfirmed);
      socket.on('dropoff-confirmed', handleDropoffConfirmed);

      return () => {
        socket.off('booking-confirmed', handleBookingConfirmed);
        socket.off('booking-rejected', handleBookingRejected);
        socket.off('booking-cancelled', handleBookingCancelled);
        socket.off('pickup-confirmed', handlePickupConfirmed);
        socket.off('dropoff-confirmed', handleDropoffConfirmed);
      };
    }
  }, [socket, isConnected, id]);

  const fetchBooking = async () => {
    try {
      const data = await bookingService.getBookingById(id);
      setBooking(data.booking);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load booking details');
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

  // Accept booking handler (for rider)
  const handleAcceptBooking = async () => {
    setActionLoading(true);
    try {
      await bookingService.acceptBooking(id);
      fetchBooking(); // Refresh booking data
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to accept booking');
    } finally {
      setActionLoading(false);
    }
  };

  // Reject booking handler (for rider)
  const handleRejectBooking = async () => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setActionLoading(true);
    try {
      await bookingService.rejectBooking(id, rejectReason);
      setShowRejectModal(false);
      fetchBooking(); // Refresh booking data
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to reject booking');
    } finally {
      setActionLoading(false);
    }
  };

  // OTP Verification Handler (for rider)
  const handleVerifyOTP = async () => {
    if (otpInput.length !== 4) {
      setNotification({ type: 'error', message: 'Please enter a 4-digit OTP' });
      return;
    }

    setOtpVerifying(true);
    try {
      if (otpType === 'pickup') {
        await bookingService.confirmPickup(id, otpInput);
        setNotification({ type: 'success', message: 'Pickup verified successfully!' });
      } else {
        await bookingService.confirmDropoff(id, otpInput);
        setNotification({ type: 'success', message: 'Dropoff verified! Journey complete.' });
      }
      setShowOtpModal(false);
      setOtpInput('');
      fetchBooking();
    } catch (err) {
      setNotification({ type: 'error', message: err.response?.data?.message || 'Invalid OTP. Please try again.' });
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleProposeBid = async () => {
    const amount = Number(bidAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotification({ type: 'error', message: 'Enter a valid counter-offer amount.' });
      return;
    }

    setBidLoading(true);
    try {
      await bookingService.proposeBid(id, {
        amount,
        message: bidMessage.trim() || undefined
      });
      setBidMessage('');
      setNotification({ type: 'success', message: 'Counter-offer sent successfully.' });
      await fetchBooking();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to send counter-offer.'
      });
    } finally {
      setBidLoading(false);
    }
  };

  const handleResolveBid = async (action) => {
    setBidLoading(true);
    try {
      await bookingService.resolveBid(id, action);
      setNotification({
        type: action === 'ACCEPT' ? 'success' : 'warning',
        message: action === 'ACCEPT' ? 'Offer accepted.' : 'Offer rejected.'
      });
      await fetchBooking();
    } catch (err) {
      setNotification({
        type: 'error',
        message: err.response?.data?.message || err.message || 'Failed to resolve offer.'
      });
    } finally {
      setBidLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="pb-12 min-h-screen" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
        <div className="container mx-auto px-4 max-w-4xl pt-8">
          <div className="animate-pulse flex items-center mb-6">
            <div className="h-4 w-24 bg-emerald-200 rounded"></div>
          </div>
          <SkeletonCard className="mb-6" />
          <SkeletonCard className="mb-6 h-28" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SkeletonProfile />
            <SkeletonCard className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="pb-12 min-h-screen" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
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

  // Check if current user is the rider (owner of the ride)
  const isRider = user?._id === booking.ride?.rider?._id;
  const isPassenger = user?._id === booking.passenger?._id;
  const hasCurrentUserReviewed = isPassenger
    ? booking.reviews?.passengerReviewed
    : isRider
      ? booking.reviews?.riderReviewed
      : false;

  // Rider can accept/reject PENDING bookings
  const canAcceptReject = isRider && booking.status === 'PENDING';
  const canBid = booking.status === 'PENDING' && (isPassenger || isRider);
  const biddingStatus = booking.bidding?.biddingStatus || 'NONE';
  const waitingForCurrentUser = isPassenger
    ? biddingStatus === 'AWAITING_PASSENGER'
    : isRider
      ? biddingStatus === 'AWAITING_RIDER'
      : false;
  const biddingHistory = booking.bidding?.biddingHistory || [];
  const latestBid = biddingHistory[biddingHistory.length - 1];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pb-12 min-h-screen" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Real-time notification */}
        {notification && (
          <div className={`mb-4 p-4 rounded-lg ${notification.type === 'success' ? 'bg-green-100 text-green-800' :
            notification.type === 'error' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
            <div className="flex items-center justify-between">
              <span>
                <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' :
                  notification.type === 'error' ? 'fa-times-circle' :
                    'fa-exclamation-circle'
                  } mr-2`}></i>
                {notification.message}
              </span>
              <button onClick={() => setNotification(null)} className="text-gray-500 hover:text-gray-700">
                <i className="fas fa-times"></i>
              </button>
            </div>
          </div>
        )}

        {/* Back Button */}
        <Link
          to={isRider ? `/rides/${booking.ride?._id}` : "/bookings"}
          className="inline-flex items-center text-emerald-500 hover:text-emerald-700 mb-6"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          {isRider ? 'Back to Ride Details' : 'Back to My Bookings'}
        </Link>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <BookingHeader booking={booking} />
        </div>

        {/* Journey Progress Stepper */}
        <div className="mb-6">
          <BookingProgressStepper booking={booking} />
        </div>

        {/* Rider Action Panel - Accept/Reject for PENDING bookings */}
        {canAcceptReject && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
              <i className="fas fa-user-check text-yellow-600 mr-2"></i>
              Booking Request
            </h3>

            {/* Passenger Info Summary */}
            <PassengerSummary passenger={booking.passenger} booking={booking} />

            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={handleAcceptBooking}
                disabled={actionLoading}
                className="flex-1 min-w-[150px] px-6 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition flex items-center justify-center font-semibold text-lg disabled:opacity-50"
              >
                {actionLoading ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Processing...</>
                ) : (
                  <><i className="fas fa-check-circle mr-2"></i>Accept Booking</>
                )}
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={actionLoading}
                className="flex-1 min-w-[150px] px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-lg transition flex items-center justify-center font-semibold text-lg disabled:opacity-50"
              >
                <i className="fas fa-times-circle mr-2"></i>Reject
              </button>
              <Link
                to={`/chat?bookingId=${booking._id}`}
                className="px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition flex items-center justify-center font-semibold"
              >
                <i className="fas fa-comments mr-2"></i>Chat with Passenger
              </Link>
            </div>
          </div>
        )}

        {canBid && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-emerald-100">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-5">
              <div>
                <h3 className="font-semibold text-gray-800 text-lg">
                  <i className="fas fa-comments-dollar text-emerald-500 mr-2"></i>Price Negotiation
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Counter-offer on pending bookings without leaving this conversation.
                </p>
              </div>
              <div className="text-sm text-right">
                <p className="text-gray-500">Current booking price</p>
                <p className="text-2xl font-bold text-gray-800">₹{Math.round(booking.totalPrice || 0)}</p>
              </div>
            </div>

            {biddingStatus !== 'NONE' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-5">
                <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-emerald-800">
                      Active offer: ₹{Math.round(booking.bidding?.proposedPrice || 0)}
                    </p>
                    <p className="text-sm text-emerald-700">
                      {waitingForCurrentUser ? 'Your response is needed.' : 'Waiting on the other party.'}
                    </p>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Original: ₹{Math.round(booking.bidding?.originalPrice || booking.totalPrice || 0)}
                  </p>
                </div>
                {latestBid && (
                  <p className="text-sm text-gray-700 mt-3">
                    <span className="font-medium">{latestBid.proposedBy}</span>
                    {' '}said: {latestBid.message || 'No message added.'}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-[180px,1fr] gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Counter-offer</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  value={bidMessage}
                  onChange={(e) => setBidMessage(e.target.value)}
                  rows={3}
                  placeholder="Explain the offer or add context for the other party."
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none resize-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 mt-5">
              <button
                type="button"
                onClick={handleProposeBid}
                disabled={bidLoading}
                className="px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition font-semibold disabled:opacity-50"
              >
                {bidLoading ? <><i className="fas fa-spinner fa-spin mr-2"></i>Sending...</> : <><i className="fas fa-paper-plane mr-2"></i>Send Counter-offer</>}
              </button>
              {waitingForCurrentUser && (
                <>
                  <button
                    type="button"
                    onClick={() => handleResolveBid('ACCEPT')}
                    disabled={bidLoading}
                    className="px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition font-semibold disabled:opacity-50"
                  >
                    <i className="fas fa-check mr-2"></i>Accept Offer
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveBid('REJECT')}
                    disabled={bidLoading}
                    className="px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-semibold disabled:opacity-50"
                  >
                    <i className="fas fa-times mr-2"></i>Reject Offer
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* OTP Section (for Passengers) */}
        {isPassenger && <OTPSection booking={booking} />}

        {/* Rider OTP Verification Section (for Drivers) */}
        {isRider && (
          <RiderOTPSection
            booking={booking}
            onVerify={(type) => { setOtpType(type); setShowOtpModal(true); }}
          />
        )}

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
        <PersonInfo booking={booking} isRider={isRider} />

        {/* Cancellation Info */}
        {booking.status === 'CANCELLED' && booking.cancellation && (
          <CancellationInfo cancellation={booking.cancellation} />
        )}

        {/* Rejection Info */}
        {booking.status === 'REJECTED' && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <h3 className="font-semibold text-gray-700 mb-2">
              <i className="fas fa-ban text-red-500 mr-2"></i>Booking Rejected
            </h3>
            <p className="text-gray-700">This booking was rejected by the rider.</p>
            {booking.cancellation?.reason && (
              <p className="text-gray-600 mt-1"><strong>Reason:</strong> {booking.cancellation.reason}</p>
            )}
          </div>
        )}

        {/* Action Buttons for Passengers */}
        {isPassenger && canCancel && (
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
                to={`/chat?bookingId=${booking._id}`}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition flex items-center"
              >
                <i className="fas fa-comment mr-2"></i>Contact Driver
              </Link>
            </div>
          </div>
        )}

        {/* Ride Receipt (for Completed Journeys) */}
        {(booking.status === 'COMPLETED' || booking.status === 'DROPPED_OFF') && (
          <RideReceipt booking={booking} />
        )}

        {/* Rate Experience Button (for completed bookings) */}
        {(booking.status === 'COMPLETED' || booking.status === 'DROPPED_OFF') && !hasCurrentUserReviewed && (isPassenger || isRider) && (
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

        {/* Report Button */}
        {booking.status !== 'PENDING' && booking.status !== 'CANCELLED' && booking.status !== 'REJECTED' && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-700">
                  <i className="fas fa-flag text-red-400 mr-2"></i>Having an issue?
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Report inappropriate behavior or safety concerns
                </p>
              </div>
              <button
                onClick={() => setShowReportModal(true)}
                className="px-5 py-2.5 border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-semibold"
              >
                <i className="fas fa-flag mr-2"></i>Report
              </button>
            </div>
          </div>
        )}

        {/* Report Modal */}
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUser={isRider ? booking.passenger?._id : booking.ride?.rider?._id}
          rideId={booking.ride?._id}
          bookingId={booking._id}
        />

        {/* OTP Verification Modal (for Rider) */}
        {showOtpModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${otpType === 'pickup' ? 'bg-blue-100' : 'bg-purple-100'
                }`}>
                <i className={`fas ${otpType === 'pickup' ? 'fa-key text-blue-600' : 'fa-flag-checkered text-purple-600'} text-2xl`}></i>
              </div>
              <h3 className="text-xl font-bold text-center text-gray-800 mb-2">
                Verify {otpType === 'pickup' ? 'Pickup' : 'Dropoff'} OTP
              </h3>
              <p className="text-gray-600 text-center mb-6">
                Ask the passenger for their 4-digit OTP
              </p>
              <input
                type="text"
                maxLength={4}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter OTP"
                className="w-full px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] border-2 border-gray-300 rounded-xl focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                autoFocus
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setShowOtpModal(false); setOtpInput(''); }}
                  className="flex-1 px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyOTP}
                  disabled={otpVerifying || otpInput.length !== 4}
                  className={`flex-1 px-4 py-3 rounded-xl font-semibold text-white transition ${otpType === 'pickup' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'
                    } disabled:opacity-50`}
                >
                  {otpVerifying ? <><i className="fas fa-spinner fa-spin mr-2"></i>Verifying...</> : 'Verify OTP'}
                </button>
              </div>
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

        {/* Reject Modal */}
        {showRejectModal && (
          <RejectModal
            onClose={() => setShowRejectModal(false)}
            onConfirm={handleRejectBooking}
            loading={actionLoading}
            reason={rejectReason}
            setReason={setRejectReason}
            passenger={booking.passenger}
          />
        )}
      </div>
    </motion.div>
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

// Reject Booking Modal (for riders)
const RejectModal = ({ onClose, onConfirm, loading, reason, setReason, passenger }) => {
  const displayName = getUserDisplayName(passenger);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-user-times text-red-500 text-3xl"></i>
          </div>
          <h3 className="text-xl font-bold text-gray-800">Reject Booking?</h3>
          <p className="text-gray-600 mt-2">
            Are you sure you want to reject {displayName}'s booking request?
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Reason for rejection <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Please provide a reason (e.g., schedule conflict, already full, etc.)..."
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
            Go Back
          </button>
          <button
            onClick={onConfirm}
            disabled={loading || !reason.trim()}
            className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin mr-2"></i>Rejecting...
              </>
            ) : (
              <>
                <i className="fas fa-times mr-2"></i>Reject Booking
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Passenger Summary for Rider to review
const PassengerSummary = ({ passenger, booking }) => {
  const [imgError, setImgError] = useState(false);
  const displayName = getUserDisplayName(passenger);
  const photoUrl = getUserPhoto(passenger);
  const passengerRating = getRating(passenger?.rating);

  return (
    <div className="bg-white rounded-lg p-4">
      <div className="flex items-start space-x-4">
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={displayName}
            className="w-16 h-16 rounded-full object-cover border-2 border-emerald-200"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-16 h-16 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white text-xl font-bold border-2 border-emerald-200`}>
            {getInitials(displayName)}
          </div>
        )}
        <div className="flex-1">
          <h4 className="text-lg font-semibold text-gray-800">{displayName}</h4>

          {/* Rating */}
          <div className="flex items-center mt-1">
            <div className="flex text-yellow-400 text-sm">
              {[1, 2, 3, 4, 5].map(i => (
                <i key={i} className={`fas fa-star ${i <= Math.round(passengerRating) ? '' : 'text-gray-300'}`}></i>
              ))}
            </div>
            <span className="ml-2 text-gray-600 text-sm">
              {formatRating(passenger?.rating)} ({passenger?.statistics?.completedRides || 0} rides)
            </span>
          </div>

          {/* Booking Details */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="bg-gray-50 rounded p-2">
              <span className="text-xs text-gray-500">Seats</span>
              <p className="font-semibold text-gray-800">{booking.seatsBooked} seat{booking.seatsBooked > 1 ? 's' : ''}</p>
            </div>
            <div className="bg-gray-50 rounded p-2">
              <span className="text-xs text-gray-500">Amount</span>
              <p className="font-semibold text-emerald-600">₹{booking.totalPrice || booking.payment?.total || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pickup & Dropoff */}
      <div className="mt-4 space-y-2">
        <div className="flex items-start">
          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="fas fa-map-marker-alt text-white text-xs"></i>
          </div>
          <div className="ml-3">
            <p className="text-xs text-gray-500">PICKUP</p>
            <p className="text-sm text-gray-800">{booking.pickupPoint?.address || booking.pickupPoint?.name || 'Same as ride start'}</p>
          </div>
        </div>
        <div className="flex items-start">
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="fas fa-map-marker-alt text-white text-xs"></i>
          </div>
          <div className="ml-3">
            <p className="text-xs text-gray-500">DROPOFF</p>
            <p className="text-sm text-gray-800">{booking.dropoffPoint?.address || booking.dropoffPoint?.name || 'Same as ride end'}</p>
          </div>
        </div>
      </div>

      {/* Special Request */}
      {booking.specialRequests && (
        <div className="mt-3 bg-blue-50 rounded p-3">
          <p className="text-xs text-blue-600 font-medium">
            <i className="fas fa-comment-dots mr-1"></i>Special Request
          </p>
          <p className="text-sm text-blue-800 mt-1">{booking.specialRequests}</p>
        </div>
      )}
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
  const isPaid = ['PAID', 'PAYMENT_CONFIRMED'].includes(booking.payment?.status);

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
          <span className={`px-3 py-1 ${isPaid
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
const PersonInfo = ({ booking, isRider }) => {
  const [imgError, setImgError] = useState(false);
  const rider = booking.ride?.rider;
  const passenger = booking.passenger;

  // Show passenger info for riders
  if (isRider && passenger) {
    const displayName = getUserDisplayName(passenger);
    const photoUrl = getUserPhoto(passenger);
    const passengerRating = getRating(passenger?.rating);

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="font-semibold text-gray-700 mb-4">
          <i className="fas fa-user text-emerald-500 mr-2"></i>Passenger
        </h3>
        <div className="flex items-start space-x-4">
          {photoUrl && !imgError ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-16 h-16 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white text-xl font-bold`}>
              {getInitials(displayName)}
            </div>
          )}
          <div className="flex-1">
            <h4 className="text-lg font-semibold">{displayName}</h4>
            <div className="flex items-center text-yellow-500 mb-2">
              {[1, 2, 3, 4, 5].map(i => (
                <i key={i} className={`fas fa-star ${i <= passengerRating ? '' : 'text-gray-300'}`}></i>
              ))}
              <span className="text-gray-600 ml-2">{Number(passengerRating).toFixed(1)}</span>
            </div>
            <div className="flex gap-4 text-sm text-gray-600">
              <span><i className="fas fa-route mr-1"></i>{passenger?.statistics?.completedRides || passenger?.statistics?.totalRidesTaken || 0} rides</span>
              {passenger?.phone && <span><i className="fas fa-phone mr-1"></i>{passenger.phone}</span>}
            </div>
            {['CONFIRMED', 'IN_PROGRESS', 'PICKUP_PENDING', 'PICKED_UP', 'PENDING'].includes(booking.status) && (
              <div className="mt-3 flex gap-2">
                <Link
                  to={`/chat?bookingId=${booking._id}`}
                  className="inline-flex items-center px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition"
                >
                  <i className="fas fa-comment mr-2"></i>Chat
                </Link>
                {passenger?.phone && (
                  <a
                    href={`tel:${passenger.phone}`}
                    className="inline-flex items-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition"
                  >
                    <i className="fas fa-phone mr-2"></i>Call
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show driver info for passengers
  if (rider) {
    const displayName = getUserDisplayName(rider);
    const photoUrl = getUserPhoto(rider);
    const riderRating = getRating(rider.rating);
    const vehicle = rider.vehicles?.[0] || rider.vehicle;

    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h3 className="font-semibold text-gray-700 mb-4">
          <i className="fas fa-user text-emerald-500 mr-2"></i>Your Driver
        </h3>
        <div className="flex items-start space-x-4">
          {photoUrl && !imgError ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-16 h-16 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white text-xl font-bold`}>
              {getInitials(displayName)}
            </div>
          )}
          <div className="flex-1">
            <h4 className="text-lg font-semibold">{displayName}</h4>
            <div className="flex items-center text-yellow-500 mb-2">
              {[1, 2, 3, 4, 5].map(i => (
                <i key={i} className={`fas fa-star ${i <= riderRating ? '' : 'text-gray-300'}`}></i>
              ))}
              <span className="text-gray-600 ml-2">{Number(riderRating).toFixed(1)}</span>
            </div>
            <div className="flex gap-4 text-sm text-gray-600">
              <span><i className="fas fa-car mr-1"></i>{rider.statistics?.completedRides || rider.statistics?.totalRidesCompleted || 0} rides</span>
              {rider.phone && <span><i className="fas fa-phone mr-1"></i>{rider.phone}</span>}
            </div>
            {vehicle && (
              <div className="mt-2 text-sm text-gray-600">
                <i className="fas fa-car text-emerald-500 mr-1"></i>
                {vehicle.make} {vehicle.model} ({vehicle.color}) - {vehicle.licensePlate || vehicle.registrationNumber}
              </div>
            )}
            {(booking.status === 'CONFIRMED' || booking.status === 'IN_PROGRESS' || booking.status === 'PICKUP_PENDING' || booking.status === 'PICKED_UP') && (
              <div className="mt-3">
                <Link
                  to={`/chat?bookingId=${booking._id}`}
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
              <li>Keep it ready until the driver verifies your pickup</li>
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
              <li>Keep it ready until the driver verifies your dropoff</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// Rider OTP Verification Section (for Drivers)
const RiderOTPSection = ({ booking, onVerify }) => {
  // Show pickup verification when status is CONFIRMED or PICKUP_PENDING
  if (['CONFIRMED', 'PICKUP_PENDING'].includes(booking.status)) {
    return (
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-blue-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
            <i className="fas fa-user-check text-2xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Verify Pickup</h3>
            <p className="text-gray-600">Ask the passenger for their 4-digit pickup OTP</p>
          </div>
        </div>

        <div className="bg-white/70 rounded-lg p-4 mb-4">
          <div className="flex items-center text-sm text-gray-600 mb-3">
            <i className="fas fa-info-circle text-blue-500 mr-2"></i>
            <span>Verify the passenger's identity before starting the journey</span>
          </div>
          <ul className="text-sm text-gray-500 space-y-1 ml-6">
            <li>• Confirm the passenger's name matches the booking</li>
            <li>• Ask for the 4-digit OTP they received</li>
            <li>• Enter the OTP to mark pickup as complete</li>
          </ul>
        </div>

        <button
          onClick={() => onVerify('pickup')}
          className="w-full py-4 bg-blue-500 text-white rounded-xl font-semibold text-lg hover:bg-blue-600 transition flex items-center justify-center gap-2 shadow-lg"
        >
          <i className="fas fa-key"></i>
          Enter Pickup OTP
        </button>
      </div>
    );
  }

  // Show dropoff verification when status is PICKED_UP or IN_TRANSIT
  if (['PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING'].includes(booking.status)) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 bg-purple-500 text-white rounded-full flex items-center justify-center flex-shrink-0">
            <i className="fas fa-flag-checkered text-2xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Complete Journey</h3>
            <p className="text-gray-600">Ask passenger for dropoff OTP at destination</p>
          </div>
        </div>

        <div className="bg-white/70 rounded-lg p-4 mb-4">
          <div className="flex items-center text-sm text-gray-600 mb-3">
            <i className="fas fa-info-circle text-purple-500 mr-2"></i>
            <span>Verify dropoff to complete the journey</span>
          </div>
          <ul className="text-sm text-gray-500 space-y-1 ml-6">
            <li>• Ensure passenger has reached their destination safely</li>
            <li>• Ask for the 4-digit dropoff OTP</li>
            <li>• Journey will be marked complete after verification</li>
          </ul>
        </div>

        <button
          onClick={() => onVerify('dropoff')}
          className="w-full py-4 bg-purple-500 text-white rounded-xl font-semibold text-lg hover:bg-purple-600 transition flex items-center justify-center gap-2 shadow-lg"
        >
          <i className="fas fa-check-circle"></i>
          Enter Dropoff OTP
        </button>
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
    const isPaid = ['PAID', 'PAYMENT_CONFIRMED'].includes(payment?.status);

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

  // Progress stepper configuration
  const bookingSteps = [
    { key: 'PENDING', label: 'Requested', icon: 'fa-clock' },
    { key: 'CONFIRMED', label: 'Confirmed', icon: 'fa-check' },
    { key: 'PICKUP_PENDING', label: 'Pickup', icon: 'fa-map-marker-alt' },
    { key: 'PICKED_UP', label: 'Picked Up', icon: 'fa-car-side' },
    { key: 'IN_TRANSIT', label: 'In Transit', icon: 'fa-road' },
    { key: 'DROPPED_OFF', label: 'Dropped Off', icon: 'fa-map-pin' },
    { key: 'COMPLETED', label: 'Completed', icon: 'fa-check-double' }
  ];

  const statusOrder = bookingSteps.map(s => s.key);
  const currentStepIndex = statusOrder.indexOf(booking.status);
  const isCancelled = booking.status === 'CANCELLED';
  const isRejected = booking.status === 'REJECTED';

  return (
    <div className="flex justify-between items-start">
      <div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
          <i className="fas fa-ticket-alt text-emerald-500 mr-2"></i>Booking Details
        </h1>
        <p className="text-gray-600">
          Booking ID: <span className="font-mono font-semibold">#{booking._id.slice(-8).toUpperCase()}</span>
        </p>
        <span className={`${statusConfig.class} px-4 py-2 rounded-full text-sm font-semibold inline-block mt-2`}>
          <i className={`fas ${statusConfig.icon} mr-2`}></i>
          {statusConfig.text}
        </span>

        {/* ═══════ BOOKING PROGRESS STEPPER ═══════ */}
        {!isCancelled && !isRejected && (
          <div className="mt-6 mb-2">
            <div className="flex items-center justify-between w-full max-w-2xl">
              {bookingSteps.map((step, index) => {
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;
                const isFuture = index > currentStepIndex;

                return (
                  <div key={step.key} className="flex flex-col items-center flex-1 relative">
                    {/* Connector line */}
                    {index > 0 && (
                      <div
                        className={`absolute top-4 right-1/2 w-full h-0.5 -z-10 ${isCompleted ? 'bg-emerald-400' : 'bg-gray-200'
                          }`}
                      ></div>
                    )}
                    {/* Step circle */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${isActive
                        ? 'bg-emerald-500 text-white ring-4 ring-emerald-100 scale-110'
                        : isCompleted
                          ? 'bg-emerald-400 text-white'
                          : 'bg-gray-200 text-gray-400'
                        }`}
                    >
                      <i className={`fas ${isCompleted ? 'fa-check' : step.icon} text-xs`}></i>
                    </div>
                    {/* Step label */}
                    <span
                      className={`text-xs mt-1 text-center ${isActive ? 'font-semibold text-emerald-700' : isFuture ? 'text-gray-400' : 'text-gray-600'
                        }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Cancelled/Rejected visual indicator */}
        {(isCancelled || isRejected) && (
          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="flex items-center text-red-700">
              <i className={`fas ${isCancelled ? 'fa-ban' : 'fa-times-circle'} mr-2`}></i>
              <span className="text-sm font-medium">
                {isCancelled ? 'This booking was cancelled' : 'This booking was rejected'}
              </span>
            </div>
            {booking.cancellation?.reason && (
              <p className="text-xs text-red-600 mt-1">Reason: {booking.cancellation.reason}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════
// RIDE RECEIPT COMPONENT (For Completed Rides)
// ════════════════════════════════════════════════════
const RideReceipt = ({ booking }) => {
  const ride = booking.ride;
  const originalPrice = ride?.pricing?.pricePerSeat || ride?.pricePerSeat || 0;
  const finalPrice = booking.pricingBreakdown?.totalPrice || booking.totalPrice || originalPrice;
  const platformFee = booking.pricingBreakdown?.platformFee || (finalPrice * 0.05);
  const taxes = booking.pricingBreakdown?.taxes || (finalPrice * 0.05);
  const baseFare = finalPrice - platformFee - taxes;

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden mb-6 relative">
      {/* Ticket Header styling */}
      <div className="bg-gray-800 text-white p-6 relative">
        <div className="absolute top-1/2 -left-3 w-6 h-6 bg-[var(--ll-cream,#f5f0e8)] rounded-full -translate-y-1/2 shadow-inner"></div>
        <div className="absolute top-1/2 -right-3 w-6 h-6 bg-[var(--ll-cream,#f5f0e8)] rounded-full -translate-y-1/2 shadow-inner"></div>

        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-bold font-display tracking-wide uppercase">Ride Receipt</h3>
            <p className="text-gray-400 text-sm mt-1">{formatDate(booking.updatedAt || booking.createdAt)}</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-bold text-emerald-400">₹{finalPrice.toFixed(2)}</span>
            <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Total Paid</p>
          </div>
        </div>
      </div>

      {/* Zigzag separator */}
      <div className="w-full h-3 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIxMCI+PHBvbHlnb24gcG9pbnRzPSIwLDEwIDEwLDAgMjAsMTAiIGZpbGw9IiMzNzQxNTEiLz48L3N2Zz4=')] absolute top-[102px] left-0 right-0 z-10 rotate-180"></div>

      <div className="p-6 pt-8 bg-gray-50">
        <div className="flex justify-between items-center mb-6 pb-6 border-b border-dashed border-gray-300">
          <div className="flex-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">From</p>
            <p className="font-semibold text-gray-800 line-clamp-2">{ride?.route?.start?.address?.split(',')[0] || 'Origin'}</p>
          </div>
          <div className="px-4 text-emerald-500"><i className="fas fa-arrow-right"></i></div>
          <div className="flex-1 text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">To</p>
            <p className="font-semibold text-gray-800 line-clamp-2">{ride?.route?.destination?.address?.split(',')[0] || 'Destination'}</p>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Base Fare ({booking.seatsBooked || 1} seat{booking.seatsBooked > 1 ? 's' : ''})</span>
            <span>₹{baseFare.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Platform Fee (5%)</span>
            <span>₹{platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>Taxes & GST (5%)</span>
            <span>₹{taxes.toFixed(2)}</span>
          </div>
          <div className="pt-3 mt-3 border-t border-gray-200 flex justify-between font-bold text-gray-800 text-base">
            <span>Total Amount</span>
            <span>₹{finalPrice.toFixed(2)}</span>
          </div>
        </div>

        {/* Environmental Impact highlight */}
        {ride?.distance && (
          <div className="mt-8 bg-emerald-50 rounded-lg p-4 flex items-center border border-emerald-100 mb-6">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 mr-3 shrink-0">
              <i className="fas fa-leaf"></i>
            </div>
            <div>
              <p className="text-emerald-800 text-sm font-medium">Eco-friendly journey</p>
              <p className="text-emerald-600 text-xs mt-0.5">
                By carpooling this {(ride.distance / 1000).toFixed(1)} km trip, you helped save approx. {((ride.distance / 1000) * 0.12).toFixed(1)} kg of CO₂ emissions.
              </p>
            </div>
          </div>
        )}

        {/* Actions: Book Again & Share */}
        <div className="flex gap-3">
          <Link
            to={`/search-rides?origin=${encodeURIComponent(ride?.route?.start?.address || '')}&destination=${encodeURIComponent(ride?.route?.destination?.address || '')}`}
            className="flex-1 flex items-center justify-center py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg transition font-medium"
          >
            <i className="fas fa-redo-alt mr-2"></i> Book Again
          </Link>

          <button
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: 'My LoopLane Journey',
                  text: `I just completed an eco-friendly carpool from ${ride?.route?.start?.name || 'my origin'} to ${ride?.route?.destination?.name || 'my destination'} on LoopLane! I saved ${((ride?.distance / 1000) * 0.12).toFixed(1)} kg of CO₂. Join the green movement! 🌿🚗`,
                  url: window.location.origin
                }).catch(console.error);
              } else {
                alert('Sharing is not supported on this browser.');
              }
            }}
            className="flex-1 flex items-center justify-center py-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 rounded-lg transition font-medium"
          >
            <i className="fas fa-share-alt mr-2"></i> Share Trip
          </button>
        </div>
      </div>
    </div>
  );
};

export default BookingDetails;
