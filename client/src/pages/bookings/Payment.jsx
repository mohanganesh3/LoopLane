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
    const totalAmount = booking.totalPrice || booking.totalAmount;
    if (couponCode.toUpperCase() === 'FIRST50') {
      setDiscount(50);
      setSuccess('Coupon applied! ₹50 discount');
    } else if (couponCode.toUpperCase() === 'SAVE10') {
      const disc = Math.round(totalAmount * 0.1);
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

    const totalAmount = booking.totalPrice || booking.totalAmount;

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
        amount: totalAmount - discount,
        ...(paymentMethod === 'upi' && { upiId }),
        ...(paymentMethod === 'card' && { cardDetails }),
        ...(discount > 0 && { couponCode, discount })
      };

      const response = await bookingService.completePayment(bookingId, paymentData);
      
      if (response.success) {
        navigate(`/bookings/${bookingId}/success`, { 
          state: { 
            paymentId: response.paymentId,
            amount: totalAmount - discount
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

  const totalAmount = booking.totalPrice || booking.totalAmount || 0;
  const pickupAddress = booking.pickupPoint?.address || booking.ride?.route?.start?.address || 'Pickup';
  const dropoffAddress = booking.dropoffPoint?.address || booking.ride?.route?.destination?.address || 'Dropoff';
  const pricePerSeat = booking.ride?.pricing?.pricePerSeat || 0;
  const rideDate = booking.ride?.schedule?.departureDateTime || booking.ride?.schedule?.date || booking.createdAt;

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
              <p className="text-sm font-medium text-gray-900">{pickupAddress}</p>
              <div className="h-8"></div>
              <p className="text-sm font-medium text-gray-900">{dropoffAddress}</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Date</span>
              <span className="text-gray-900">{new Date(rideDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Seats</span>
              <span className="text-gray-900">{booking.seatsBooked}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Price per seat</span>
              <span className="text-gray-900">₹{pricePerSeat}</span>
            </div>
            <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-200">
              <span className="text-gray-900">Total Amount</span>
              <span className="text-emerald-600">₹{totalAmount}</span>
            </div>
            {discount > 0 && (
              <>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Discount Applied</span>
                  <span>-₹{discount}</span>
                </div>
                <div className="flex justify-between text-base font-semibold">
                  <span className="text-gray-900">Final Amount</span>
                  <span className="text-emerald-600">₹{totalAmount - discount}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Coupon Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Apply Coupon</h2>
          <div className="flex space-x-2">
            <input
              type="text"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="Enter coupon code"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <button
              onClick={handleApplyCoupon}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Apply
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">Try: FIRST50 or SAVE10</p>
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

          {/* UPI Input */}
          {paymentMethod === 'upi' && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">UPI ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="example@upi"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>
          )}

          {/* Card Details Input */}
          {paymentMethod === 'card' && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Card Number</label>
                <input
                  type="text"
                  value={cardDetails.number}
                  onChange={(e) => setCardDetails(prev => ({ ...prev, number: e.target.value }))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Cardholder Name</label>
                <input
                  type="text"
                  value={cardDetails.name}
                  onChange={(e) => setCardDetails(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Name on card"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Expiry</label>
                  <input
                    type="text"
                    value={cardDetails.expiry}
                    onChange={(e) => setCardDetails(prev => ({ ...prev, expiry: e.target.value }))}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">CVV</label>
                  <input
                    type="password"
                    value={cardDetails.cvv}
                    onChange={(e) => setCardDetails(prev => ({ ...prev, cvv: e.target.value }))}
                    placeholder="***"
                    maxLength={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pay Button */}
        <Button
          onClick={handlePayment}
          loading={processing}
          className="w-full"
        >
          Pay ₹{totalAmount - discount}
        </Button>

        <p className="text-xs text-gray-500 text-center mt-4">
          By completing payment, you agree to our refund and cancellation policy
        </p>
      </div>
    </div>
  );
};

export default Payment;
