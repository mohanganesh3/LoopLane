import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import bookingService from '../../services/bookingService';
import { Button, Alert } from '../../components/common';

const Payment = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [cardDetails, setCardDetails] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });
  const [couponCode, setCouponCode] = useState('');
  const [discount, setDiscount] = useState(0);

  useEffect(() => {
    fetchBooking();
  }, [bookingId]);

  const fetchBooking = async () => {
    try {
      const response = await bookingService.getBookingById(bookingId);
      if (response.success) {
        setBooking(response.booking);
      } else {
        setError('Booking not found');
      }
    } catch (err) {
      setError(err.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyCoupon = () => {
    // Mock coupon validation
    if (couponCode.toUpperCase() === 'FIRST50') {
      setDiscount(50);
      setSuccess('Coupon applied! ₹50 discount');
    } else if (couponCode.toUpperCase() === 'SAVE10') {
      const disc = Math.round(booking.totalAmount * 0.1);
      setDiscount(disc);
      setSuccess(`Coupon applied! ₹${disc} discount (10% off)`);
    } else {
      setError('Invalid coupon code');
      setDiscount(0);
    }
  };

  const handlePayment = async () => {
    setProcessing(true);
    setError('');

    // Validate payment method specific fields
    if (paymentMethod === 'upi' && !upiId) {
      setError('Please enter your UPI ID');
      setProcessing(false);
      return;
    }

    if (paymentMethod === 'card') {
      if (!cardDetails.number || !cardDetails.expiry || !cardDetails.cvv || !cardDetails.name) {
        setError('Please fill all card details');
        setProcessing(false);
        return;
      }
    }

    try {
      const paymentData = {
        bookingId,
        method: paymentMethod,
        amount: booking.totalAmount - discount,
        ...(paymentMethod === 'upi' && { upiId }),
        ...(paymentMethod === 'card' && { cardDetails }),
        ...(discount > 0 && { couponCode, discount })
      };

      const response = await bookingService.processPayment(paymentData);
      
      if (response.success) {
        navigate(`/bookings/${bookingId}/success`, { 
          state: { 
            paymentId: response.paymentId,
            amount: booking.totalAmount - discount
          } 
        });
      } else {
        setError(response.message || 'Payment failed');
      }
    } catch (err) {
      setError(err.message || 'Payment processing failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-lg mx-auto px-4">
          <Alert type="error" message={error || 'Booking not found'} />
          <button
            onClick={() => navigate('/bookings')}
            className="mt-4 text-emerald-500 hover:text-emerald-600"
          >
            ← Back to Bookings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Complete Payment</h1>

        {/* Booking Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h2>
          
          <div className="flex items-start mb-4">
            <div className="flex flex-col items-center mr-4">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <div className="w-0.5 h-8 bg-gray-300 my-1"></div>
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{booking.ride?.source?.address}</p>
              <div className="h-8"></div>
              <p className="text-sm font-medium text-gray-900">{booking.ride?.destination?.address}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Date</span>
              <span className="text-gray-900">{new Date(booking.ride?.date).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Seats</span>
              <span className="text-gray-900">{booking.seatsBooked}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Price per seat</span>
              <span className="text-gray-900">₹{booking.ride?.pricePerSeat}</span>
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
              <span className="text-gray-900">Total Amount</span>
              <span className="text-emerald-600">₹{booking.totalAmount}</span>
            </div>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment Method</h2>
          
          <div className="space-y-3">
            <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
              paymentMethod === 'upi' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-400'
            }`}>
              <input
                type="radio"
                name="paymentMethod"
                value="upi"
                checked={paymentMethod === 'upi'}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="text-emerald-500 focus:ring-emerald-500"
              />
              <div className="ml-3 flex-1">
                <p className="font-medium text-gray-900">UPI</p>
                <p className="text-xs text-gray-500">Pay using Google Pay, PhonePe, Paytm</p>
              </div>
              <div className="flex space-x-2">
                <img src="/images/gpay.png" alt="GPay" className="h-6 w-6 object-contain" />
                <img src="/images/phonepe.png" alt="PhonePe" className="h-6 w-6 object-contain" />
              </div>
            </label>

            <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
              paymentMethod === 'card' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-400'
            }`}>
              <input
                type="radio"
                name="paymentMethod"
                value="card"
                checked={paymentMethod === 'card'}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="text-emerald-500 focus:ring-emerald-500"
              />
              <div className="ml-3 flex-1">
                <p className="font-medium text-gray-900">Credit/Debit Card</p>
                <p className="text-xs text-gray-500">Visa, Mastercard, RuPay</p>
              </div>
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </label>

            <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
              paymentMethod === 'wallet' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-400'
            }`}>
              <input
                type="radio"
                name="paymentMethod"
                value="wallet"
                checked={paymentMethod === 'wallet'}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="text-emerald-500 focus:ring-emerald-500"
              />
              <div className="ml-3 flex-1">
                <p className="font-medium text-gray-900">LOOPLANE Wallet</p>
                <p className="text-xs text-gray-500">Balance: ₹500</p>
              </div>
              <svg className="w-8 h-8 text-emerald-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 18v1a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1" />
                <path d="M21 12H8" />
              </svg>
            </label>

            <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
              paymentMethod === 'cash' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-emerald-400'
            }`}>
              <input
                type="radio"
                name="paymentMethod"
                value="cash"
                checked={paymentMethod === 'cash'}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="text-emerald-500 focus:ring-emerald-500"
              />
              <div className="ml-3 flex-1">
                <p className="font-medium text-gray-900">Cash</p>
                <p className="text-xs text-gray-500">Pay driver directly after ride</p>
              </div>
              <span className="text-xl">💵</span>
            </label>
          </div>
        </div>

        {/* Pay Button */}
        <Button
          onClick={() => {}}
          loading={processing}
          className="w-full"
        >
          Pay ₹{booking.totalAmount}
        </Button>

        <p className="text-xs text-gray-500 text-center mt-4">
          By completing payment, you agree to our refund and cancellation policy
        </p>
      </div>
    </div>
  );
};

export default Payment;
