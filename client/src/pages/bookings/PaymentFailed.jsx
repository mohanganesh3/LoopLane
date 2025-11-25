import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Link } from 'react-router-dom';

const PaymentFailed = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const errorInfo = location.state || {};

  const handleRetry = () => {
    navigate(`/bookings/${bookingId}/payment`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full">
        {/* Error Icon */}
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h1>
          <p className="text-gray-600 mb-6">
            {errorInfo.message || 'Something went wrong with your payment. Please try again.'}
          </p>

          {/* Error Details */}
          <div className="bg-red-50 rounded-lg p-4 mb-6 text-left">
            <h3 className="font-medium text-red-800 mb-2">Possible reasons:</h3>
            <ul className="text-sm text-red-700 space-y-1">
              <li>• Insufficient funds in your account</li>
              <li>• Card expired or blocked</li>
              <li>• Network timeout during transaction</li>
              <li>• Bank server unavailable</li>
            </ul>
          </div>

          {/* Transaction Info */}
          {errorInfo.transactionId && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Transaction ID</span>
                <span className="font-mono text-gray-900">{errorInfo.transactionId}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                If amount was debited, it will be refunded within 5-7 business days
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              onClick={handleRetry}
              className="block w-full py-3 px-4 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600 transition"
            >
              Try Again
            </button>
            <Link 
              to={`/bookings/${bookingId}`}
              className="block w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              View Booking
            </Link>
            <a 
              href="mailto:support@looplane.com?subject=Payment%20Issue%20-%20Booking%20ID%20"
              className="block w-full py-3 px-4 text-emerald-500 font-medium hover:text-emerald-600 transition text-center"
            >
              Contact Support
            </a>
          </div>
        </div>

        {/* Help Section */}
        <div className="mt-6 bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-medium text-gray-900 mb-3">Need help?</h3>
          <div className="space-y-2">
            <a href="tel:+918001234567" className="flex items-center text-sm text-gray-600 hover:text-emerald-500">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Call: 1800-123-4567
            </a>
            <a href="mailto:support@looplane.com" className="flex items-center text-sm text-gray-600 hover:text-emerald-500">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Email: support@looplane.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailed;
