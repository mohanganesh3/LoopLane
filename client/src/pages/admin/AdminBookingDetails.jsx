import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';

const AdminBookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);

  useEffect(() => {
    fetchBookingDetails();
  }, [id]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    try {
      const response = await adminService.getBookingById(id);
      if (response.success) {
        setBooking(response.booking);
        setRefundAmount(response.booking.totalPrice?.toString() || '');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      setError('Please enter a valid refund amount');
      return;
    }
    
    if (!window.confirm(`Are you sure you want to refund ₹${refundAmount}?`)) return;

    try {
      const response = await adminService.refundBooking(id, parseFloat(refundAmount));
      if (response.success) {
        setSuccess('Refund processed successfully');
        setShowRefundModal(false);
        fetchBookingDetails();
      }
    } catch (err) {
      setError(err.message || 'Failed to process refund');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'CONFIRMED': 'bg-green-100 text-green-800',
      'ACCEPTED': 'bg-blue-100 text-blue-800',
      'CANCELLED': 'bg-red-100 text-red-800',
      'COMPLETED': 'bg-emerald-100 text-emerald-800',
      'IN_PROGRESS': 'bg-purple-100 text-purple-800',
      'DROPPED_OFF': 'bg-teal-100 text-teal-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentBadge = (status) => {
    const styles = {
      'PAID': 'bg-green-100 text-green-800',
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'REFUNDED': 'bg-blue-100 text-blue-800',
      'FAILED': 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="p-6">
        <Alert type="error" message="Booking not found" />
        <button
          onClick={() => navigate('/admin/bookings')}
          className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg"
        >
          ← Back to Bookings
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/bookings')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            <i className="fas fa-ticket-alt mr-2"></i>Booking Details
          </h1>
        </div>
        <span className={`px-4 py-2 rounded-full font-semibold ${getStatusBadge(booking.status)}`}>
          {booking.status}
        </span>
      </div>

      {error && <Alert type="error" message={error} className="mb-6" onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} className="mb-6" onClose={() => setSuccess('')} />}

      {/* Booking ID */}
      <div className="bg-indigo-50 rounded-xl p-4 mb-6">
        <p className="text-sm text-indigo-600">Booking ID</p>
        <p className="font-mono font-bold text-indigo-800">{booking._id}</p>
      </div>

      {/* Passenger Info */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-user mr-2 text-indigo-500"></i>Passenger Information
        </h2>
        
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
            {(booking.passenger?.profile?.firstName?.[0] || 'P').toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-lg">
              {booking.passenger?.profile?.firstName || ''} {booking.passenger?.profile?.lastName || 'Unknown'}
            </p>
            <p className="text-gray-500">{booking.passenger?.email}</p>
            <p className="text-gray-500">{booking.passenger?.phone}</p>
          </div>
          <button
            onClick={() => navigate(`/admin/users/${booking.passenger?._id}`)}
            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"
          >
            View Profile →
          </button>
        </div>
      </div>

      {/* Ride Info */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-car mr-2 text-indigo-500"></i>Ride Information
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5"></div>
            <div>
              <p className="text-sm text-gray-500">From</p>
              <p className="font-semibold text-gray-800">
                {booking.ride?.route?.start?.address || booking.ride?.from?.address || 'Unknown'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5"></div>
            <div>
              <p className="text-sm text-gray-500">To</p>
              <p className="font-semibold text-gray-800">
                {booking.ride?.route?.destination?.address || booking.ride?.to?.address || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 pt-4 border-t">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Date & Time</p>
            <p className="font-semibold text-gray-800">
              {booking.ride?.departureTime 
                ? new Date(booking.ride.departureTime).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })
                : 'N/A'}
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Driver</p>
            <p className="font-semibold text-gray-800">
              {booking.ride?.rider?.profile?.firstName || booking.ride?.rider?.name || 'Unknown'}
            </p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Ride Status</p>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(booking.ride?.status)}`}>
              {booking.ride?.status || 'N/A'}
            </span>
          </div>
        </div>

        {booking.ride?._id && (
          <div className="mt-4">
            <button
              onClick={() => navigate(`/admin/rides/${booking.ride._id}`)}
              className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"
            >
              View Ride Details →
            </button>
          </div>
        )}
      </div>

      {/* Payment Info */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-credit-card mr-2 text-indigo-500"></i>Payment Information
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-emerald-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Total Amount</p>
            <p className="text-2xl font-bold text-emerald-600">
              ₹{booking.totalPrice || booking.totalAmount || booking.pricing?.total || 0}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Seats Booked</p>
            <p className="text-2xl font-bold text-blue-600">
              {booking.seatsBooked || 1}
            </p>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Payment Status</p>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getPaymentBadge(booking.payment?.status || 'PENDING')}`}>
              {booking.payment?.status || 'PENDING'}
            </span>
          </div>
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500">Payment Method</p>
            <p className="font-semibold text-gray-800">
              {booking.payment?.method || 'Cash'}
            </p>
          </div>
        </div>

        {booking.payment?.status === 'REFUNDED' && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-600">Refunded Amount: <strong>₹{booking.payment.refundAmount || booking.totalPrice}</strong></p>
            {booking.payment.refundedAt && (
              <p className="text-sm text-blue-500">Refunded on: {new Date(booking.payment.refundedAt).toLocaleString()}</p>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-history mr-2 text-indigo-500"></i>Timeline
        </h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <i className="fas fa-plus text-green-600"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Booking Created</p>
              <p className="text-sm text-gray-500">{new Date(booking.createdAt).toLocaleString()}</p>
            </div>
          </div>
          
          {booking.confirmedAt && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <i className="fas fa-check text-blue-600"></i>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Booking Confirmed</p>
                <p className="text-sm text-gray-500">{new Date(booking.confirmedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
          
          {booking.journey?.startedAt && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <i className="fas fa-play text-purple-600"></i>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Journey Started</p>
                <p className="text-sm text-gray-500">{new Date(booking.journey.startedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
          
          {booking.journey?.droppedOffAt && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                <i className="fas fa-flag-checkered text-teal-600"></i>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Dropped Off</p>
                <p className="text-sm text-gray-500">{new Date(booking.journey.droppedOffAt).toLocaleString()}</p>
              </div>
            </div>
          )}
          
          {booking.cancelledAt && (
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <i className="fas fa-times text-red-600"></i>
              </div>
              <div>
                <p className="font-semibold text-gray-800">Booking Cancelled</p>
                <p className="text-sm text-gray-500">{new Date(booking.cancelledAt).toLocaleString()}</p>
                {booking.cancellationReason && (
                  <p className="text-sm text-red-500">Reason: {booking.cancellationReason}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Admin Actions */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Admin Actions</h2>
        <div className="flex flex-wrap gap-3">
          {booking.payment?.status !== 'REFUNDED' && booking.status !== 'PENDING' && (
            <button
              onClick={() => setShowRefundModal(true)}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
            >
              <i className="fas fa-undo mr-2"></i>Process Refund
            </button>
          )}
        </div>
      </div>

      {/* Refund Modal */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Process Refund</h2>
            <p className="text-gray-600 mb-4">Enter the amount to refund:</p>
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Amount"
                className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                max={booking.totalPrice}
              />
            </div>
            <p className="text-sm text-gray-500 mb-4">Maximum refund: ₹{booking.totalPrice}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRefundModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRefund}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition"
              >
                Process Refund
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBookingDetails;
