import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import bookingService from '../../services/bookingService';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';
import { getRating } from '../../utils/helpers';

// Fix for default markers
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons factory
const createIcon = (color) => new L.Icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
});

const pickupIcon = createIcon('green');
const dropoffIcon = createIcon('red');
const userIcon = createIcon('orange');

// Custom car icon for driver/rider location
const carIcon = L.divIcon({
  html: `<div class="car-icon-container">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" width="24" height="24">
      <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
    </svg>
  </div>
  <style>
    .car-icon-container {
      background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
      border-radius: 50%;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.6);
      border: 3px solid white;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
    .car-marker {
      background: transparent !important;
      border: none !important;
    }
  </style>`,
  className: 'car-marker',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
  popupAnchor: [0, -22]
});

// Alias for backward compatibility
const driverIcon = carIcon;

// Auto-fit map to show all points
const FitBounds = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points && points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [60, 60] });
    }
  }, [points, map]);
  return null;
};

// ============ MAIN COMPONENT ============
const LiveTracking = () => {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const pollRef = useRef(null);
  
  // Core state
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Location state
  const [driverLocation, setDriverLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [routeInfo, setRouteInfo] = useState({ distance: null, duration: null });
  
  // UI state
  const [notification, setNotification] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpType, setOtpType] = useState(null); // 'pickup' or 'dropoff'
  const [lastUpdate, setLastUpdate] = useState(null);

  // Derived state
  const isPassenger = user?._id === booking?.passenger?._id;
  const isRider = user?._id === booking?.ride?.rider?._id;

  // ============ DATA FETCHING ============
  const fetchBooking = useCallback(async () => {
    try {
      const response = await bookingService.getBookingById(bookingId);
      if (response.success) {
        setBooking(response.booking);
        
        // Fetch route
        const pickup = response.booking?.pickupPoint?.coordinates || 
                      response.booking?.ride?.route?.start?.coordinates;
        const dropoff = response.booking?.dropoffPoint?.coordinates || 
                       response.booking?.ride?.route?.destination?.coordinates;
        if (pickup && dropoff) {
          fetchRoute(pickup, dropoff);
        }
        
        // Set initial driver location from ride start if not already set
        // This shows the car on the map even before real-time updates
        if (!driverLocation && response.booking?.ride?.route?.start?.coordinates) {
          const startCoords = response.booking.ride.route.start.coordinates;
          setDriverLocation({ lat: startCoords[1], lng: startCoords[0] });
        }
      } else {
        setError('Booking not found');
      }
    } catch (err) {
      setError(err.message || 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }, [bookingId, driverLocation]);

  // Fetch actual road route from OSRM
  const fetchRoute = async (start, end) => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      if (data.routes?.[0]) {
        const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
        setRouteCoords(coords);
        setRouteInfo({
          distance: (data.routes[0].distance / 1000).toFixed(1),
          duration: Math.round(data.routes[0].duration / 60)
        });
      }
    } catch (err) {
      console.error('Route fetch failed:', err);
    }
  };

  // Get user's current location
  const getUserLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.warn('Geolocation error:', err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  // ============ EFFECTS ============
  useEffect(() => {
    fetchBooking();
    getUserLocation();
  }, [fetchBooking, getUserLocation]);

  // Socket event listeners using global socket context
  useEffect(() => {
    if (!socket || !isConnected || !booking) return;

    // Join tracking room
    socket.emit('join-tracking', { bookingId, rideId: booking?.ride?._id });

    // Driver location updates
    const handleDriverLocation = (data) => {
      if (data.location) {
        setDriverLocation(data.location);
        setLastUpdate(new Date());
      }
    };

    const handleLocationUpdate = (data) => {
      if (data.location) {
        setDriverLocation({ lat: data.location.latitude, lng: data.location.longitude });
        setLastUpdate(new Date());
      }
    };

    // Booking status updates
    const handleBookingStatusUpdated = (data) => {
      if (data.bookingId === bookingId) {
        showNotification(`Status updated: ${formatStatus(data.status)}`, 'info');
        fetchBooking();
      }
    };

    const handlePickupConfirmed = (data) => {
      if (data.bookingId === bookingId) {
        showNotification('✅ Pickup verified! You are now on board.', 'success');
        fetchBooking();
      }
    };

    const handleDropoffConfirmed = (data) => {
      if (data.bookingId === bookingId) {
        showNotification('🎉 Journey completed! Please rate your experience.', 'success');
        fetchBooking();
      }
    };

    const handleRideStarted = (data) => {
      if (data.rideId === booking?.ride?._id || data.bookingId === bookingId) {
        showNotification('🚗 Ride has started! Driver is on the way.', 'info');
        fetchBooking();
      }
    };

    socket.on('driver-location', handleDriverLocation);
    socket.on('location-update', handleLocationUpdate);
    socket.on('booking-status-updated', handleBookingStatusUpdated);
    socket.on('pickup-confirmed', handlePickupConfirmed);
    socket.on('dropoff-confirmed', handleDropoffConfirmed);
    socket.on('ride-started', handleRideStarted);

    return () => {
      socket.emit('leave-tracking', { bookingId });
      socket.off('driver-location', handleDriverLocation);
      socket.off('location-update', handleLocationUpdate);
      socket.off('booking-status-updated', handleBookingStatusUpdated);
      socket.off('pickup-confirmed', handlePickupConfirmed);
      socket.off('dropoff-confirmed', handleDropoffConfirmed);
      socket.off('ride-started', handleRideStarted);
    };
  }, [socket, isConnected, booking, bookingId, fetchBooking]);

  // Polling fallback for data refresh
  useEffect(() => {
    if (booking) {
      pollRef.current = setInterval(fetchBooking, 15000);
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }
  }, [booking, fetchBooking]);

  // ============ HANDLERS ============
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showNotification(`${label} copied to clipboard!`, 'success');
  };

  const handleVerifyOTP = async () => {
    if (otpInput.length !== 4) {
      showNotification('Please enter a 4-digit OTP', 'error');
      return;
    }

    setVerifying(true);
    try {
      if (otpType === 'pickup') {
        await bookingService.confirmPickup(bookingId, otpInput);
        showNotification('✅ Pickup verified successfully!', 'success');
      } else {
        await bookingService.confirmDropoff(bookingId, otpInput);
        showNotification('🎉 Dropoff verified! Journey complete.', 'success');
      }
      setShowOtpModal(false);
      setOtpInput('');
      fetchBooking();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Invalid OTP. Please try again.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleSafety = () => {
    navigate(`/tracking/${bookingId}/safety`, { 
      state: { booking, driverLocation, userLocation } 
    });
  };

  // ============ HELPERS ============
  const formatStatus = (status) => {
    const statusMap = {
      'PENDING': 'Waiting for Confirmation',
      'CONFIRMED': 'Booking Confirmed',
      'PICKUP_PENDING': 'Ready for Pickup',
      'PICKED_UP': 'On Board',
      'IN_TRANSIT': 'En Route',
      'DROPOFF_PENDING': 'Arriving Soon',
      'DROPPED_OFF': 'Arrived',
      'COMPLETED': 'Completed',
      'CANCELLED': 'Cancelled'
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status) => {
    const colors = {
      'PENDING': 'yellow',
      'CONFIRMED': 'blue',
      'PICKUP_PENDING': 'blue',
      'PICKED_UP': 'purple',
      'IN_TRANSIT': 'purple',
      'DROPOFF_PENDING': 'orange',
      'DROPPED_OFF': 'green',
      'COMPLETED': 'green',
      'CANCELLED': 'red'
    };
    return colors[status] || 'gray';
  };

  const getStatusStep = (status) => {
    const steps = ['PENDING', 'CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'DROPPED_OFF', 'COMPLETED'];
    return steps.indexOf(status);
  };

  // ============ RENDER ============
  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading your journey...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-lg mx-auto px-4 text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-exclamation-triangle text-red-500 text-3xl"></i>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Unable to Load Journey</h2>
            <p className="text-gray-600 mb-6">{error || 'Booking not found'}</p>
            <button onClick={() => navigate('/bookings')} className="px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition">
              <i className="fas fa-arrow-left mr-2"></i>Back to Bookings
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Map coordinates
  const pickupCoords = booking?.pickupPoint?.coordinates || booking?.ride?.route?.start?.coordinates;
  const dropoffCoords = booking?.dropoffPoint?.coordinates || booking?.ride?.route?.destination?.coordinates;
  const defaultCenter = [14.7502, 78.5480]; // Fallback center (AP, India)
  
  const mapCenter = driverLocation ? [driverLocation.lat, driverLocation.lng] :
                    pickupCoords ? [pickupCoords[1], pickupCoords[0]] : defaultCenter;
  const pickupLatLng = pickupCoords ? [pickupCoords[1], pickupCoords[0]] : null;
  const dropoffLatLng = dropoffCoords ? [dropoffCoords[1], dropoffCoords[0]] : null;

  const mapPoints = [pickupLatLng, dropoffLatLng, driverLocation && [driverLocation.lat, driverLocation.lng]].filter(Boolean);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-gray-100">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-[2000] px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-down ${
          notification.type === 'success' ? 'bg-green-500 text-white' :
          notification.type === 'error' ? 'bg-red-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' : notification.type === 'error' ? 'fa-times-circle' : 'fa-info-circle'}`}></i>
          <span className="font-medium">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 opacity-70 hover:opacity-100">
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* OTP Verification Modal */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black/50 z-[3000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
              otpType === 'pickup' ? 'bg-blue-100' : 'bg-purple-100'
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
                disabled={verifying || otpInput.length !== 4}
                className={`flex-1 px-4 py-3 rounded-xl font-semibold text-white transition ${
                  otpType === 'pickup' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-purple-500 hover:bg-purple-600'
                } disabled:opacity-50`}
              >
                {verifying ? <><i className="fas fa-spinner fa-spin mr-2"></i>Verifying...</> : 'Verify OTP'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT: Map Section */}
      <div className="relative h-[40vh] lg:h-full lg:flex-1">
        <MapContainer center={mapCenter} zoom={12} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {pickupLatLng && <Marker position={pickupLatLng} icon={pickupIcon}><Popup><b>Pickup:</b><br/>{booking?.pickupPoint?.address || 'Pickup Point'}</Popup></Marker>}
          {dropoffLatLng && <Marker position={dropoffLatLng} icon={dropoffIcon}><Popup><b>Drop-off:</b><br/>{booking?.dropoffPoint?.address || 'Destination'}</Popup></Marker>}
          {driverLocation && <Marker position={[driverLocation.lat, driverLocation.lng]} icon={driverIcon}><Popup><b>Driver</b><br/>Last update: {lastUpdate?.toLocaleTimeString() || 'Now'}</Popup></Marker>}
          {userLocation && <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}><Popup><b>Your Location</b></Popup></Marker>}
          
          {routeCoords.length > 0 && <Polyline positions={routeCoords} color="#10b981" weight={5} opacity={0.8} />}
          {mapPoints.length >= 2 && <FitBounds points={mapPoints} />}
        </MapContainer>

        {/* Back Button */}
        <button onClick={() => navigate(-1)} className="absolute top-4 left-4 z-[1000] w-10 h-10 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition">
          <i className="fas fa-arrow-left text-gray-700"></i>
        </button>

        {/* Connection Status */}
        <div className={`absolute top-4 right-4 z-[1000] px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 ${
          isConnected ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500 animate-pulse'}`}></span>
          {isConnected ? 'Live' : 'Connecting...'}
        </div>

        {/* Safety Button - Always visible */}
        <button onClick={handleSafety} className="absolute bottom-4 right-4 z-[1000] px-4 py-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition flex items-center gap-2 font-semibold lg:hidden">
          <i className="fas fa-exclamation-triangle"></i>
          Safety
        </button>
      </div>

      {/* RIGHT: Info Panel */}
      <div className="flex-1 lg:w-2/5 lg:max-w-md overflow-y-auto bg-white">
        {/* Header with Status */}
        <div className="sticky top-0 bg-white border-b z-10">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-lg font-bold text-gray-800">Live Tracking</h1>
              <button onClick={handleSafety} className="hidden lg:flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm font-semibold">
                <i className="fas fa-exclamation-triangle"></i>Safety
              </button>
            </div>
            
            {/* Status Badge */}
            <StatusBadge status={booking.status} formatStatus={formatStatus} getStatusColor={getStatusColor} />
          </div>

          {/* Progress Steps */}
          <ProgressSteps currentStep={getStatusStep(booking.status)} />
        </div>

        {/* OTP Section for Passenger */}
        {isPassenger && <PassengerOTPSection booking={booking} onCopy={copyToClipboard} />}

        {/* OTP Verification for Rider/Driver */}
        {isRider && <RiderOTPSection booking={booking} onVerify={(type) => { setOtpType(type); setShowOtpModal(true); }} />}

        {/* Journey Status Message */}
        <JourneyStatusMessage booking={booking} isPassenger={isPassenger} />

        {/* Driver/Passenger Info */}
        <div className="p-4 border-b">
          {isPassenger ? (
            <DriverCard rider={booking.ride?.rider} bookingId={booking._id} navigate={navigate} />
          ) : (
            <PassengerCard passenger={booking.passenger} bookingId={booking._id} navigate={navigate} />
          )}
        </div>

        {/* Route Details */}
        <div className="p-4 border-b">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Trip Route</h3>
          <RouteDisplay booking={booking} />
        </div>

        {/* Trip Info */}
        <div className="p-4 bg-gray-50">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500 mb-1">Distance</p>
              <p className="text-lg font-bold text-gray-800">{routeInfo.distance || booking.ride?.route?.distance?.toFixed(1) || '--'} km</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Fare</p>
              <p className="text-lg font-bold text-emerald-600">₹{booking.totalPrice || (booking.ride?.pricing?.pricePerSeat * (booking.seatsBooked || 1)) || '--'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Seats</p>
              <p className="text-lg font-bold text-gray-800">{booking.seatsBooked || 1}</p>
            </div>
          </div>
        </div>

        {/* ETA Display */}
        {routeInfo.duration && ['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT'].includes(booking.status) && (
          <div className="mx-4 my-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                  <i className="fas fa-clock text-white"></i>
                </div>
                <div>
                  <p className="text-xs text-emerald-600 font-medium">Estimated Time</p>
                  <p className="text-lg font-bold text-emerald-800">{routeInfo.duration} min</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Last updated</p>
                <p className="text-sm text-gray-700">{lastUpdate?.toLocaleTimeString() || 'Just now'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="p-4 space-y-3">
          <Link to={`/bookings/${booking._id}`} className="block w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-center hover:bg-gray-200 transition">
            <i className="fas fa-info-circle mr-2"></i>View Full Details
          </Link>
          
          {(booking.status === 'COMPLETED' || booking.status === 'DROPPED_OFF') && !booking.reviews?.passengerReviewed && (
            <Link to={`/bookings/${booking._id}/rate`} className="block w-full py-3 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl font-semibold text-center hover:opacity-90 transition">
              <i className="fas fa-star mr-2"></i>Rate Your Experience
            </Link>
          )}
          
          {(booking.status === 'COMPLETED' || booking.status === 'DROPPED_OFF') && booking.reviews?.passengerReviewed && (
            <div className="w-full py-3 bg-green-100 text-green-700 rounded-xl font-semibold text-center">
              <i className="fas fa-check-circle mr-2"></i>Review Submitted
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ SUB-COMPONENTS ============

// Status Badge
const StatusBadge = ({ status, formatStatus, getStatusColor }) => {
  const color = getStatusColor(status);
  const colorClasses = {
    yellow: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
    gray: 'bg-gray-100 text-gray-800'
  };
  const dotClasses = {
    yellow: 'bg-amber-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
    gray: 'bg-gray-500'
  };
  
  return (
    <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${colorClasses[color]}`}>
      <span className={`w-2 h-2 rounded-full ${dotClasses[color]} mr-2 ${['PICKUP_PENDING', 'IN_TRANSIT'].includes(status) ? 'animate-pulse' : ''}`}></span>
      {formatStatus(status)}
    </div>
  );
};

// Progress Steps
const ProgressSteps = ({ currentStep }) => {
  const steps = [
    { label: 'Confirmed', icon: 'fa-check' },
    { label: 'Pickup', icon: 'fa-map-marker-alt' },
    { label: 'On Board', icon: 'fa-car' },
    { label: 'Arrived', icon: 'fa-flag-checkered' },
  ];

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between relative">
        {steps.map((step, idx) => {
          const isActive = idx <= currentStep - 1;
          const isCurrent = idx === currentStep - 1;
          return (
            <div key={idx} className="flex flex-col items-center flex-1 relative z-10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                isActive ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-emerald-100 text-emerald-600 ring-2 ring-emerald-500' : 'bg-gray-200 text-gray-400'
              }`}>
                <i className={`fas ${step.icon}`}></i>
              </div>
              <span className={`text-[10px] mt-1 text-center ${isActive ? 'text-emerald-600 font-semibold' : 'text-gray-400'}`}>{step.label}</span>
            </div>
          );
        })}
        {/* Connector lines */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 -z-0" style={{ left: '12.5%', right: '12.5%' }}></div>
        <div className="absolute top-4 h-0.5 bg-emerald-500 -z-0 transition-all" style={{ left: '12.5%', width: `${Math.max(0, (currentStep - 1) / 3) * 75}%` }}></div>
      </div>
    </div>
  );
};

// Passenger OTP Display
const PassengerOTPSection = ({ booking, onCopy }) => {
  // Pickup OTP
  if (['CONFIRMED', 'PICKUP_PENDING'].includes(booking.status) && booking.verification?.pickup?.code) {
    return (
      <div className="m-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <i className="fas fa-key text-2xl"></i>
          </div>
          <div>
            <h3 className="font-bold text-lg">Pickup OTP</h3>
            <p className="text-blue-100 text-sm">Show this to your driver</p>
          </div>
        </div>
        <div className="bg-white/20 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-bold tracking-[0.3em]">{booking.verification.pickup.code}</span>
            <button onClick={() => onCopy(booking.verification.pickup.code, 'Pickup OTP')} className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition">
              <i className="fas fa-copy text-xl"></i>
            </button>
          </div>
        </div>
        <p className="text-blue-100 text-sm flex items-start gap-2">
          <i className="fas fa-shield-alt mt-0.5"></i>
          <span>Keep this OTP private. Only share with your verified driver when they arrive.</span>
        </p>
      </div>
    );
  }

  // Dropoff OTP
  if (['PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING'].includes(booking.status) && booking.verification?.dropoff?.code) {
    return (
      <div className="m-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <i className="fas fa-flag-checkered text-2xl"></i>
          </div>
          <div>
            <h3 className="font-bold text-lg">Dropoff OTP</h3>
            <p className="text-purple-100 text-sm">Share at destination</p>
          </div>
        </div>
        <div className="bg-white/20 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-center gap-3">
            <span className="text-5xl font-bold tracking-[0.3em]">{booking.verification.dropoff.code}</span>
            <button onClick={() => onCopy(booking.verification.dropoff.code, 'Dropoff OTP')} className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition">
              <i className="fas fa-copy text-xl"></i>
            </button>
          </div>
        </div>
        <p className="text-purple-100 text-sm flex items-start gap-2">
          <i className="fas fa-info-circle mt-0.5"></i>
          <span>Share this OTP when you reach your destination to complete the journey.</span>
        </p>
      </div>
    );
  }

  return null;
};

// Rider OTP Verification
const RiderOTPSection = ({ booking, onVerify }) => {
  // Pickup verification needed
  if (['CONFIRMED', 'PICKUP_PENDING'].includes(booking.status)) {
    return (
      <div className="m-4 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center">
            <i className="fas fa-user-check text-xl"></i>
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Verify Pickup</h3>
            <p className="text-gray-600 text-sm">Ask passenger for their OTP</p>
          </div>
        </div>
        <button onClick={() => onVerify('pickup')} className="w-full py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition flex items-center justify-center gap-2">
          <i className="fas fa-key"></i>
          Enter Pickup OTP
        </button>
      </div>
    );
  }

  // Dropoff verification needed
  if (['PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING'].includes(booking.status)) {
    return (
      <div className="m-4 bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center">
            <i className="fas fa-flag-checkered text-xl"></i>
          </div>
          <div>
            <h3 className="font-bold text-gray-800">Verify Dropoff</h3>
            <p className="text-gray-600 text-sm">Complete the journey</p>
          </div>
        </div>
        <button onClick={() => onVerify('dropoff')} className="w-full py-3 bg-purple-500 text-white rounded-xl font-semibold hover:bg-purple-600 transition flex items-center justify-center gap-2">
          <i className="fas fa-check-circle"></i>
          Enter Dropoff OTP
        </button>
      </div>
    );
  }

  return null;
};

// Journey Status Message
const JourneyStatusMessage = ({ booking, isPassenger }) => {
  const messages = {
    PENDING: { icon: 'fa-clock', bg: 'amber', text: 'Waiting for driver to accept your booking...' },
    CONFIRMED: { icon: 'fa-check-circle', bg: 'blue', text: isPassenger ? 'Booking confirmed! Driver will start the ride soon.' : 'Booking confirmed. Start the ride when ready.' },
    PICKUP_PENDING: { icon: 'fa-car', bg: 'blue', text: isPassenger ? '🚗 Driver is on the way! Get ready with your pickup OTP.' : 'Navigate to pickup location and verify OTP.' },
    PICKED_UP: { icon: 'fa-route', bg: 'purple', text: '🛣️ Journey in progress. Sit back and enjoy the ride!' },
    IN_TRANSIT: { icon: 'fa-route', bg: 'purple', text: '🛣️ On the way to destination.' },
    DROPOFF_PENDING: { icon: 'fa-location-arrow', bg: 'orange', text: '📍 Almost there! Get ready to exit.' },
    DROPPED_OFF: { icon: 'fa-check-double', bg: 'green', text: '🎉 You have arrived! Please rate your experience.' },
    COMPLETED: { icon: 'fa-trophy', bg: 'green', text: '✨ Journey completed successfully!' },
    CANCELLED: { icon: 'fa-times-circle', bg: 'red', text: 'This booking has been cancelled.' }
  };

  const msg = messages[booking.status];
  if (!msg) return null;

  const bgClasses = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    red: 'bg-red-50 border-red-200 text-red-800'
  };
  
  const iconClasses = {
    amber: 'text-amber-500',
    blue: 'text-blue-500',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
    green: 'text-green-500',
    red: 'text-red-500'
  };

  return (
    <div className={`mx-4 my-3 p-4 rounded-xl border ${bgClasses[msg.bg]}`}>
      <div className="flex items-center gap-3">
        <i className={`fas ${msg.icon} ${iconClasses[msg.bg]} text-xl ${['PICKUP_PENDING', 'IN_TRANSIT'].includes(booking.status) ? 'animate-bounce' : ''}`}></i>
        <p className="font-medium">{msg.text}</p>
      </div>
    </div>
  );
};

// Route Display
const RouteDisplay = ({ booking }) => (
  <div className="space-y-3">
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
        <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-emerald-600 font-semibold uppercase">Pickup</p>
        <p className="text-sm text-gray-800 mt-0.5">{booking?.pickupPoint?.address || booking?.ride?.route?.start?.address || 'Pickup location'}</p>
      </div>
    </div>
    <div className="ml-4 border-l-2 border-dashed border-gray-300 h-6"></div>
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <div className="w-3 h-3 rounded-full bg-red-500"></div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-red-600 font-semibold uppercase">Drop-off</p>
        <p className="text-sm text-gray-800 mt-0.5">{booking?.dropoffPoint?.address || booking?.ride?.route?.destination?.address || 'Destination'}</p>
      </div>
    </div>
  </div>
);

// Driver Card
const DriverCard = ({ rider, bookingId, navigate }) => {
  const [imgError, setImgError] = useState(false);
  
  if (!rider) return <p className="text-gray-500 text-sm">Driver information not available</p>;
  
  const displayName = getUserDisplayName(rider);
  const photo = getUserPhoto(rider);
  const vehicle = rider.vehicles?.[0] || rider.vehicle;
  const rating = getRating(rider.rating) || 4.5;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Driver</h3>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          {photo && !imgError ? (
            <img src={photo} alt={displayName} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className={`w-full h-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-bold text-lg`}>
              {getInitials(displayName)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-800 truncate">{displayName}</h4>
            <span className="flex items-center text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              <i className="fas fa-star text-yellow-500 mr-1"></i>{Number(rating).toFixed(1)}
            </span>
          </div>
          {vehicle && <p className="text-xs text-gray-500 mt-0.5">{vehicle.color} {vehicle.make} {vehicle.model} • {vehicle.licensePlate}</p>}
        </div>
        <div className="flex gap-2">
          {rider.phone && (
            <a href={`tel:${rider.phone}`} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
              <i className="fas fa-phone"></i>
            </a>
          )}
          <button onClick={() => navigate(`/chat?bookingId=${bookingId}`)} className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-600 transition">
            <i className="fas fa-comment"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

// Passenger Card
const PassengerCard = ({ passenger, bookingId, navigate }) => {
  const [imgError, setImgError] = useState(false);
  
  if (!passenger) return <p className="text-gray-500 text-sm">Passenger information not available</p>;
  
  const displayName = getUserDisplayName(passenger);
  const photo = getUserPhoto(passenger);
  const rating = getRating(passenger.rating) || 4.5;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Passenger</h3>
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
          {photo && !imgError ? (
            <img src={photo} alt={displayName} className="w-full h-full object-cover" onError={() => setImgError(true)} />
          ) : (
            <div className={`w-full h-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-bold text-lg`}>
              {getInitials(displayName)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-gray-800 truncate">{displayName}</h4>
            <span className="flex items-center text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
              <i className="fas fa-star text-yellow-500 mr-1"></i>{Number(rating).toFixed(1)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{passenger.statistics?.totalRidesCompleted || 0} rides completed</p>
        </div>
        <div className="flex gap-2">
          {passenger.phone && (
            <a href={`tel:${passenger.phone}`} className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition">
              <i className="fas fa-phone"></i>
            </a>
          )}
          <button onClick={() => navigate(`/chat?bookingId=${bookingId}`)} className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white hover:bg-emerald-600 transition">
            <i className="fas fa-comment"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;
