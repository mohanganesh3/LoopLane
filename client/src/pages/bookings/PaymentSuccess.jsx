import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';
import bookingService from '../../services/bookingService';

const PaymentSuccess = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  const paymentInfo = location.state || {};

  useEffect(() => {
    fetchBooking();
  }, [bookingId]);

  const fetchBooking = async () => {
    try {
      const response = await bookingService.getBookingById(bookingId);
      if (response.success) {
        setBooking(response.booking);
      }
    } catch (err) {
      console.error('Failed to fetch booking:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Success Animation */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h1>
          <p className="text-gray-600 mb-6">Your booking has been confirmed</p>

          {/* Payment Details */}
          <div className="bg-emerald-50 rounded-lg p-4 mb-6 text-left">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment ID</span>
                <span className="font-mono text-gray-900">{paymentInfo.paymentId || 'PAY123456'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Amount Paid</span>
                <span className="font-semibold text-emerald-600">₹{paymentInfo.amount || booking?.totalAmount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Booking ID</span>
                <span className="font-mono text-gray-900">{bookingId?.slice(-8)}</span>
              </div>
            </div>
          </div>

          {/* Ride Info */}
          {booking && (
            <div className="border border-gray-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-3">Ride Details</h3>
              <div className="flex items-start mb-3">
                <div className="flex flex-col items-center mr-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <div className="w-0.5 h-6 bg-gray-300 my-1"></div>
                  <div className="w-2 h-2 rounded-full bg-red-500"></div>
                </div>
                <div className="flex-1 text-sm">
                  <p className="text-gray-900 mb-4">{booking.ride?.source?.address || 'Pickup Location'}</p>
                  <p className="text-gray-900">{booking.ride?.destination?.address || 'Drop Location'}</p>
                </div>
              </div>
              <div className="flex justify-between text-sm text-gray-600 pt-3 border-t border-gray-200">
                <span>{new Date(booking.ride?.date).toLocaleDateString()}</span>
                <span>{booking.seatsBooked} seat(s)</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link 
              to={`/bookings/${bookingId}`}
              className="block w-full py-3 px-4 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition"
            >
              View Booking Details
            </Link>
            <Link 
              to="/bookings"
              className="block w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              My Bookings
            </Link>
            <Link 
              to="/"
              className="block w-full py-3 px-4 text-emerald-500 font-medium hover:text-emerald-600 transition"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            A confirmation email has been sent to your registered email address
          </p>
          <div className="mt-4 flex justify-center space-x-4">
            <button className="text-sm text-emerald-500 hover:text-emerald-600 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Receipt
            </button>
            <button className="text-sm text-emerald-500 hover:text-emerald-600 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
