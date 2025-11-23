/**
 * ReassignmentAlert Component
 * Shows a prominent modal when a passenger's ride is reassigned or cancelled
 * Part of the Smart Auto-Reassignment system
 */

import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';

const ReassignmentAlert = () => {
  const navigate = useNavigate();
  const { reassignmentAlert, clearReassignmentAlert } = useNotifications();

  if (!reassignmentAlert) return null;

  const handleViewBooking = () => {
    if (reassignmentAlert.newBooking?.id) {
      navigate(`/bookings/${reassignmentAlert.newBooking.id}`);
    } else if (reassignmentAlert.booking?.id) {
      navigate(`/bookings/${reassignmentAlert.booking.id}`);
    } else {
      navigate('/my-bookings');
    }
    clearReassignmentAlert();
  };

  const handleSearchNewRide = () => {
    navigate('/search');
    clearReassignmentAlert();
  };

  const handleClose = () => {
    clearReassignmentAlert();
  };

  // Different layouts based on alert type
  const renderContent = () => {
    switch (reassignmentAlert.type) {
      case 'REASSIGNED':
        return (
          <>
            {/* Success Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
              <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {reassignmentAlert.title}
            </h3>
            
            <p className="text-gray-600 mb-4">
              {reassignmentAlert.message}
            </p>
            
            {/* New Booking Details */}
            {reassignmentAlert.newBooking && (
              <div className="bg-green-50 rounded-lg p-4 mb-4 text-left">
                <h4 className="font-semibold text-green-800 mb-2">New Ride Details:</h4>
                <div className="space-y-1 text-sm text-green-700">
                  {reassignmentAlert.newBooking.riderName && (
                    <p><i className="fas fa-user mr-2"></i>Rider: {reassignmentAlert.newBooking.riderName}</p>
                  )}
                  {reassignmentAlert.newBooking.departureTime && (
                    <p><i className="fas fa-clock mr-2"></i>
                      Departure: {new Date(reassignmentAlert.newBooking.departureTime).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short'
                      })}
                    </p>
                  )}
                  {reassignmentAlert.matchScore && (
                    <p><i className="fas fa-star mr-2"></i>Match Quality: {reassignmentAlert.matchScore >= 80 ? 'Excellent' : reassignmentAlert.matchScore >= 60 ? 'Good' : 'Fair'}</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleViewBooking}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                View New Booking
              </button>
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </>
        );

      case 'CANCELLED_NO_ALTERNATIVE':
        return (
          <>
            {/* Warning Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-4">
              <svg className="h-10 w-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {reassignmentAlert.title}
            </h3>
            
            <p className="text-gray-600 mb-4">
              {reassignmentAlert.message}
            </p>
            
            {/* Refund Info */}
            {reassignmentAlert.refundAmount > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-blue-800 font-semibold">
                  <i className="fas fa-money-bill-wave mr-2"></i>
                  Refund: ₹{reassignmentAlert.refundAmount}
                </p>
                <p className="text-sm text-blue-600 mt-1">
                  A full refund has been initiated and will be processed within 5-7 business days.
                </p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSearchNewRide}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                <i className="fas fa-search mr-2"></i>
                Search New Ride
              </button>
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </>
        );

      case 'CANCELLED':
        return (
          <>
            {/* Cancel Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-orange-100 mb-4">
              <svg className="h-10 w-10 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {reassignmentAlert.title}
            </h3>
            
            <p className="text-gray-600 mb-4">
              {reassignmentAlert.message}
            </p>
            
            {reassignmentAlert.refundAmount > 0 && (
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <p className="text-blue-800 font-semibold">
                  <i className="fas fa-money-bill-wave mr-2"></i>
                  Refund: ₹{reassignmentAlert.refundAmount}
                </p>
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSearchNewRide}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                <i className="fas fa-search mr-2"></i>
                Find Another Ride
              </button>
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </>
        );

      case 'NEW_PASSENGER_REASSIGNED':
        return (
          <>
            {/* Info Icon */}
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <svg className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {reassignmentAlert.title}
            </h3>
            
            <p className="text-gray-600 mb-4">
              {reassignmentAlert.message}
            </p>
            
            <div className="bg-blue-50 rounded-lg p-4 mb-4 text-left">
              <p className="text-sm text-blue-700">
                <i className="fas fa-info-circle mr-2"></i>
                This passenger was reassigned from a cancelled ride. Please treat them with care!
              </p>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleViewBooking}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                View Booking
              </button>
              <button
                onClick={handleClose}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      ></div>
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center transform transition-all animate-bounce-in">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default ReassignmentAlert;
