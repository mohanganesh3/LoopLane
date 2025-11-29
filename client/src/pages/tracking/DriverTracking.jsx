import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDriverTracking } from './trackingUtils';
import { Alert, Button } from '../../components/common';
import rideService from '../../services/rideService';

const DriverTracking = () => {
  const { rideId } = useParams();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const { 
    isSharing, 
    error: trackingError, 
    startSharing, 
    stopSharing, 
    updateRideStatus 
  } = useDriverTracking(rideId);

  const [currentStatus, setCurrentStatus] = useState('not_started');

  const statusOptions = [
    { value: 'not_started', label: 'Not Started', iconClass: 'fa-pause' },
    { value: 'on_way_to_pickup', label: 'On Way to Pickup', iconClass: 'fa-car-side' },
    { value: 'arrived_at_pickup', label: 'Arrived at Pickup', iconClass: 'fa-map-marker-alt' },
    { value: 'ride_started', label: 'Ride Started', iconClass: 'fa-road' },
    { value: 'completed', label: 'Completed', iconClass: 'fa-check-circle' }
  ];

  useEffect(() => {
    fetchRide();
  }, [rideId]);

  const fetchRide = async () => {
    try {
      const response = await rideService.getRideById(rideId);
      if (response.success) {
        setRide(response.ride);
        setCurrentStatus(response.ride.trackingStatus || 'not_started');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (status) => {
    setCurrentStatus(status);
    updateRideStatus(status);
  };

  const handleToggleTracking = () => {
    if (isSharing) {
      stopSharing();
    } else {
      startSharing();
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Driver Tracking Panel</h1>

        {(error || trackingError) && (
          <Alert type="error" message={error || trackingError} className="mb-6" />
        )}

        {/* Tracking Status */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Location Sharing</h2>
            <div className={`flex items-center ${isSharing ? 'text-emerald-500' : 'text-gray-400'}`}>
              <div className={`w-3 h-3 rounded-full mr-2 ${isSharing ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`}></div>
              {isSharing ? 'Active' : 'Inactive'}
            </div>
          </div>

          <button
            onClick={handleToggleTracking}
            className={`w-full py-4 rounded-lg font-semibold transition ${
              isSharing 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            {isSharing ? 'Stop Sharing Location' : 'Start Sharing Location'}
          </button>

          {isSharing && (
            <p className="text-sm text-gray-500 text-center mt-3">
              Your location is being shared with passengers in real-time
            </p>
          )}
        </div>

        {/* Ride Status Update */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Update Ride Status</h2>
          
          <div className="space-y-2">
            {statusOptions.map((status, index) => {
              const isActive = currentStatus === status.value;
              const isPast = statusOptions.findIndex(s => s.value === currentStatus) > index;
              
              return (
                <button
                  key={status.value}
                  onClick={() => handleStatusChange(status.value)}
                  disabled={!isSharing && status.value !== 'not_started'}
                  className={`w-full flex items-center p-4 rounded-lg border-2 transition ${
                    isActive 
                      ? 'border-emerald-500 bg-emerald-50' 
                      : isPast
                        ? 'border-gray-200 bg-gray-50'
                        : 'border-gray-200 hover:border-emerald-400'
                  } ${!isSharing && status.value !== 'not_started' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <i className={`fas ${status.iconClass} text-2xl mr-4`}></i>
                  <span className={`font-medium ${isActive ? 'text-emerald-700' : 'text-gray-700'}`}>
                    {status.label}
                  </span>
                  {isActive && (
                    <span className="ml-auto text-emerald-500">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                  {isPast && !isActive && (
                    <span className="ml-auto text-gray-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ride Info */}
        {ride && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Ride Details</h2>
            
            <div className="flex items-start mb-4">
              <div className="flex flex-col items-center mr-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <div className="w-0.5 h-10 bg-gray-300 my-1"></div>
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900 mb-6">{ride.route?.start?.address || ride.source?.address}</p>
                <p className="text-sm font-medium text-gray-900">{ride.route?.destination?.address || ride.destination?.address}</p>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Passengers</span>
                <span className="text-gray-900">{ride.pricing?.bookedSeats || ride.bookedSeats || 0} booked</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverTracking;
