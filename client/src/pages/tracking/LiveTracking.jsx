import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import bookingService from '../../services/bookingService';
import { Alert } from '../../components/common';

const LiveTracking = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const socketRef = useRef(null);
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [rideStatus, setRideStatus] = useState('waiting'); // waiting, driver_on_way, picked_up, in_transit, arrived

  useEffect(() => {
    fetchBooking();
    initializeSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [bookingId]);

  const fetchBooking = async () => {
    try {
      const response = await bookingService.getBookingById(bookingId);
      if (response.success) {
        setBooking(response.booking);
        setRideStatus(response.booking.trackingStatus || 'waiting');
      } else {
        setError('Booking not found');
      }
    } catch (err) {
      setError(err.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const initializeSocket = () => {
    socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      withCredentials: true
    });

    socketRef.current.emit('join-tracking', { bookingId });

    socketRef.current.on('driver-location', (data) => {
      setDriverLocation(data.location);
      setEta(data.eta);
    });

    socketRef.current.on('ride-status-update', (data) => {
      setRideStatus(data.status);
    });
  };

  const getStatusInfo = () => {
    const statuses = {
      waiting: { title: 'Waiting for driver', color: 'yellow', icon: '⏳' },
      driver_on_way: { title: 'Driver on the way', color: 'blue', icon: '🚗' },
      picked_up: { title: 'You have been picked up', color: 'emerald', icon: '✅' },
      in_transit: { title: 'En route to destination', color: 'emerald', icon: '🛣️' },
      arrived: { title: 'Arrived at destination', color: 'green', icon: '🎉' }
    };
    return statuses[rideStatus] || statuses.waiting;
  };

  const handleSOS = () => {
    navigate('/sos', { state: { bookingId, driverLocation } });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-lg mx-auto px-4">
          <Alert type="error" message={error} />
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

  const statusInfo = getStatusInfo();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Map Container */}
      <div className="relative h-[60vh] bg-gray-300">
        <div 
          ref={mapRef} 
          className="w-full h-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #e0f2fe 0%, #dcfce7 100%)' }}
        >
          <div className="text-center">
            <div className="text-6xl mb-4">🗺️</div>
            <p className="text-gray-600">Map view loading...</p>
            {driverLocation && (
              <p className="text-sm text-gray-500 mt-2">
                Driver: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
              </p>
            )}
          </div>
        </div>

        {/* SOS Button */}
        <button
          onClick={handleSOS}
          className="absolute top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-full shadow-lg hover:bg-red-600 transition font-bold flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>SOS</span>
        </button>

        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 bg-white p-3 rounded-full shadow-lg hover:bg-gray-50 transition"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Status Card */}
      <div className="px-4 -mt-10 relative z-10">
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {/* Status Badge */}
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-4 bg-${statusInfo.color}-100 text-${statusInfo.color}-700`}>
            <span className="mr-2">{statusInfo.icon}</span>
            {statusInfo.title}
          </div>

          {/* ETA */}
          {eta && rideStatus !== 'arrived' && (
            <div className="mb-4">
              <p className="text-gray-600 text-sm">Estimated arrival</p>
              <p className="text-2xl font-bold text-gray-900">{eta} mins</p>
            </div>
          )}

          {/* Driver Info */}
          {booking?.ride?.driver && (
            <div className="flex items-center p-4 bg-gray-50 rounded-lg mb-4">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center text-2xl mr-4">
                {booking.ride.driver.profilePic ? (
                  <img src={booking.ride.driver.profilePic} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  '👤'
                )}
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900">{booking.ride.driver.name}</p>
                <p className="text-sm text-gray-500">{booking.ride.vehicle?.model} • {booking.ride.vehicle?.number}</p>
                <div className="flex items-center mt-1">
                  <span className="text-yellow-500 mr-1">★</span>
                  <span className="text-sm text-gray-600">{booking.ride.driver.rating || 4.5}</span>
                </div>
              </div>
              <div className="flex space-x-2">
                <button className="p-3 bg-emerald-100 rounded-full text-emerald-600 hover:bg-emerald-200 transition">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </button>
                <button 
                  onClick={() => navigate(`/chat/${booking.ride.driver._id}`)}
                  className="p-3 bg-emerald-100 rounded-full text-emerald-600 hover:bg-emerald-200 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Route Info */}
          <div className="border-t border-gray-200 pt-4">
            <div className="flex items-start">
              <div className="flex flex-col items-center mr-4">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <div className="w-0.5 h-12 bg-gray-300 my-1"></div>
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
              </div>
              <div className="flex-1">
                <div className="mb-6">
                  <p className="text-xs text-gray-500 mb-1">PICKUP</p>
                  <p className="text-sm font-medium text-gray-900">{booking?.ride?.source?.address}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">DROP</p>
                  <p className="text-sm font-medium text-gray-900">{booking?.ride?.destination?.address}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;
