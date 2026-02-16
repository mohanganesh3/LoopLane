import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { LoadingSpinner, Alert } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import rideService from '../../services/rideService';
import bookingService from '../../services/bookingService';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';
import { getRating, formatRating, getRatingCount } from '../../utils/helpers';

const RideDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected } = useSocket();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingModal, setBookingModal] = useState(false);
  const [notification, setNotification] = useState(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpType, setOtpType] = useState(null); // 'pickup' or 'dropoff'
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);

  // Get searched locations from navigation state (passed from SearchRides)
  const searchedPickup = location.state?.searchedPickup || null;
  const searchedDropoff = location.state?.searchedDropoff || null;
  const searchedSeats = location.state?.searchedSeats || 1;

  const fetchRideDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await rideService.getRideById(id);
      if (data && data.ride) {
        setRide(data.ride);
      } else {
        setError('Ride not found');
      }
    } catch (err) {
      console.error('Failed to load ride details:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load ride details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchRideDetails();
    } else {
      setError('Invalid ride ID');
      setLoading(false);
    }
  }, [id, fetchRideDetails]);

  // Listen for real-time booking updates (for ride owners)
  useEffect(() => {
    if (socket && isConnected && id && user) {
      const handleNewBooking = (data) => {
        if (data.rideId === id) {
          showNotification('New booking request received!', 'info');
          fetchRideDetails();
        }
      };

      const handleBookingCancelled = (data) => {
        if (data.rideId === id) {
          showNotification('A passenger cancelled their booking.', 'warning');
          fetchRideDetails();
        }
      };

      const handleBookingConfirmed = (data) => {
        if (data.rideId === id) {
          showNotification('Booking confirmed!', 'success');
          fetchRideDetails();
        }
      };

      const handlePickupConfirmed = (data) => {
        if (data.rideId === id || ride?.bookings?.some(b => b._id === data.bookingId)) {
          showNotification('✅ Pickup verified! Passenger on board.', 'success');
          fetchRideDetails();
        }
      };

      const handleDropoffConfirmed = (data) => {
        if (data.rideId === id || ride?.bookings?.some(b => b._id === data.bookingId)) {
          showNotification('🎉 Dropoff complete!', 'success');
          fetchRideDetails();
        }
      };

      const handleRideStatusUpdated = (data) => {
        if (data.rideId === id) {
          showNotification(`Ride status: ${data.status}`, 'info');
          fetchRideDetails();
        }
      };

      socket.on('new-booking-request', handleNewBooking);
      socket.on('booking-cancelled', handleBookingCancelled);
      socket.on('booking-confirmed', handleBookingConfirmed);
      socket.on('pickup-confirmed', handlePickupConfirmed);
      socket.on('dropoff-confirmed', handleDropoffConfirmed);
      socket.on('ride-status-updated', handleRideStatusUpdated);

      // Join ride room for updates
      socket.emit('join-ride', { rideId: id });

      return () => {
        socket.off('new-booking-request', handleNewBooking);
        socket.off('booking-cancelled', handleBookingCancelled);
        socket.off('booking-confirmed', handleBookingConfirmed);
        socket.off('pickup-confirmed', handlePickupConfirmed);
        socket.off('dropoff-confirmed', handleDropoffConfirmed);
        socket.off('ride-status-updated', handleRideStatusUpdated);
        socket.emit('leave-ride', { rideId: id });
      };
    }
  }, [socket, isConnected, id, user, ride?.bookings, fetchRideDetails]);

  // Show notification helper
  const showNotification = (message, type = 'info') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Check if user can book this ride
  const canBook = () => {
    if (!isAuthenticated) return false;
    if (!ride) return false;
    if (ride.rider?._id === user?._id) return false;
    if ((ride.pricing?.availableSeats || 0) <= 0) return false;
    if (ride.status !== 'ACTIVE') return false;
    return true;
  };

  // Check if current user is the ride owner
  const isOwner = ride?.rider?._id === user?._id;

  // ============ DRIVER ACTIONS ============

  // Start ride handler
  const handleStartRide = async () => {
    if (!window.confirm('Are you sure you want to start this ride? All confirmed passengers will be notified with their pickup OTP.')) {
      return;
    }

    setActionLoading(true);
    try {
      await rideService.startRide(id);
      showNotification('🚗 Ride started! Navigate to pickup locations.', 'success');
      fetchRideDetails();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to start ride', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Complete ride handler
  const handleCompleteRide = async () => {
    if (!window.confirm('Are you sure you want to complete this ride? Make sure all passengers have been dropped off.')) {
      return;
    }

    setActionLoading(true);
    try {
      await rideService.completeRide(id);
      showNotification('🎉 Ride completed! Great job.', 'success');
      fetchRideDetails();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to complete ride', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Open OTP verification modal
  const openOtpVerification = (booking, type) => {
    setSelectedBooking(booking);
    setOtpType(type);
    setOtpInput('');
    setShowOtpModal(true);
  };

  // Handle OTP verification
  const handleVerifyOTP = async () => {
    if (otpInput.length !== 4) {
      showNotification('Please enter a 4-digit OTP', 'error');
      return;
    }

    setOtpVerifying(true);
    try {
      if (otpType === 'pickup') {
        await bookingService.confirmPickup(selectedBooking._id, otpInput);
        showNotification('✅ Pickup verified! Passenger is on board.', 'success');
      } else {
        await bookingService.confirmDropoff(selectedBooking._id, otpInput);
        showNotification('🎉 Dropoff verified! Journey complete for this passenger.', 'success');
      }
      setShowOtpModal(false);
      setOtpInput('');
      setSelectedBooking(null);
      fetchRideDetails();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Invalid OTP. Please try again.', 'error');
    } finally {
      setOtpVerifying(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading ride details..." />;
  }

  if (error) {
    return (
      <div className="pb-12 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <Alert type="error" message={error} />
          <div className="mt-4 flex gap-4">
            <button
              onClick={fetchRideDetails}
              className="text-emerald-500 hover:underline inline-flex items-center"
            >
              <i className="fas fa-sync-alt mr-2"></i>Retry
            </button>
            <Link to="/find-ride" className="text-gray-500 hover:underline inline-flex items-center">
              <i className="fas fa-arrow-left mr-2"></i>Back to Search
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="pb-12 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <Alert type="warning" message="Ride not found or has been removed" />
          <Link to="/find-ride" className="text-emerald-500 hover:underline mt-4 inline-block">
            <i className="fas fa-arrow-left mr-2"></i>Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Real-time notification */}
        {notification && (
          <div className={`fixed top-20 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-down ${notification.type === 'success' ? 'bg-green-500 text-white' :
              notification.type === 'error' ? 'bg-red-500 text-white' :
                notification.type === 'warning' ? 'bg-yellow-500 text-white' :
                  'bg-blue-500 text-white'
            }`}>
            <i className={`fas ${notification.type === 'success' ? 'fa-check-circle' :
                notification.type === 'error' ? 'fa-times-circle' :
                  notification.type === 'warning' ? 'fa-exclamation-circle' :
                    'fa-info-circle'
              }`}></i>
            <span className="font-medium">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 opacity-70 hover:opacity-100">
              <i className="fas fa-times"></i>
            </button>
          </div>
        )}

        {/* OTP Verification Modal */}
        {showOtpModal && selectedBooking && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${otpType === 'pickup' ? 'bg-blue-100' : 'bg-purple-100'
                }`}>
                <i className={`fas ${otpType === 'pickup' ? 'fa-key text-blue-600' : 'fa-flag-checkered text-purple-600'} text-2xl`}></i>
              </div>
              <h3 className="text-xl font-bold text-center text-gray-800 mb-2">
                Verify {otpType === 'pickup' ? 'Pickup' : 'Dropoff'} OTP
              </h3>
              <p className="text-gray-600 text-center mb-2">
                Passenger: <span className="font-semibold">{getUserDisplayName(selectedBooking.passenger)}</span>
              </p>
              <p className="text-gray-500 text-sm text-center mb-6">
                Ask for their 4-digit {otpType} OTP
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
                  onClick={() => { setShowOtpModal(false); setOtpInput(''); setSelectedBooking(null); }}
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

        {/* Back Button */}
        <Link to={isOwner ? "/my-rides" : "/find-ride"} className="inline-flex items-center text-emerald-500 hover:text-emerald-700 mb-6">
          <i className="fas fa-arrow-left mr-2"></i>
          {isOwner ? 'Back to My Rides' : 'Back to Search'}
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Route Card */}
            <RouteCard ride={ride} />

            {/* === DRIVER DASHBOARD SECTION === */}
            {isOwner && (
              <DriverDashboard
                ride={ride}
                actionLoading={actionLoading}
                onStartRide={handleStartRide}
                onCompleteRide={handleCompleteRide}
                onVerifyPickup={(booking) => openOtpVerification(booking, 'pickup')}
                onVerifyDropoff={(booking) => openOtpVerification(booking, 'dropoff')}
                onRefresh={fetchRideDetails}
              />
            )}

            {/* Driver Info Card - only for non-owners */}
            {!isOwner && <DriverCard driver={ride.rider} />}

            {/* Ride Details Card */}
            <RideInfoCard ride={ride} />

            {/* Preferences Card */}
            {ride.preferences && <PreferencesCard preferences={ride.preferences} />}
          </div>

          {/* Sidebar - Booking Card */}
          <div className="lg:col-span-1">
            {isOwner ? (
              <RideManagementSidebar
                ride={ride}
                onStartRide={handleStartRide}
                onCompleteRide={handleCompleteRide}
                actionLoading={actionLoading}
              />
            ) : (
              <BookingCard
                ride={ride}
                canBook={canBook()}
                onBook={() => setBookingModal(true)}
                isOwner={isOwner}
              />
            )}
          </div>
        </div>

        {/* Booking Modal */}
        {bookingModal && (
          <BookingModal
            ride={ride}
            searchedPickup={searchedPickup}
            searchedDropoff={searchedDropoff}
            searchedSeats={searchedSeats}
            onClose={() => setBookingModal(false)}
            onSuccess={(bookingId) => navigate(`/bookings/${bookingId}`)}
          />
        )}
      </div>
    </div>
  );
};

// Route Card Component
const RouteCard = ({ ride }) => {
  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-800">
          <i className="fas fa-route text-emerald-500 mr-2"></i>Route Details
        </h1>
        <RideStatusBadge status={ride.status} />
      </div>

      {/* Route Visualization */}
      <div className="relative py-4">
        <div className="flex items-start">
          <div className="flex flex-col items-center mr-4">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <div className="w-0.5 h-24 bg-gray-300 my-1"></div>
            <div className="w-4 h-4 bg-red-500 rounded-full"></div>
          </div>
          <div className="flex-1 space-y-8">
            <div>
              <p className="text-sm text-gray-500">Pickup Point</p>
              <p className="text-lg font-semibold text-gray-800">{ride.route?.start?.name || ride.route?.start?.address}</p>
              <p className="text-sm text-gray-500">{ride.route?.start?.address}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Drop-off Point</p>
              <p className="text-lg font-semibold text-gray-800">{ride.route?.destination?.name || ride.route?.destination?.address}</p>
              <p className="text-sm text-gray-500">{ride.route?.destination?.address}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Info */}
      <div className="bg-emerald-50 rounded-lg p-4 mt-4">
        <div className="flex items-center text-emerald-700">
          <i className="fas fa-calendar-alt mr-3 text-2xl"></i>
          <div>
            <p className="text-sm font-medium">Departure Time</p>
            <p className="text-lg font-bold">
              {formatDateTime(ride.schedule?.departureDateTime)}
            </p>
          </div>
        </div>
      </div>

      {/* Distance & Duration */}
      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <i className="fas fa-road text-emerald-500 text-xl mb-1"></i>
          <p className="text-lg font-semibold">{ride.route?.distance?.toFixed(1) || 'N/A'} km</p>
          <p className="text-xs text-gray-500">Distance</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <i className="fas fa-clock text-emerald-500 text-xl mb-1"></i>
          <p className="text-lg font-semibold">{Math.round(ride.route?.duration || 0)} min</p>
          <p className="text-xs text-gray-500">Duration</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <i className="fas fa-chair text-emerald-500 text-xl mb-1"></i>
          <p className="text-lg font-semibold">{ride.pricing?.availableSeats || 0}</p>
          <p className="text-xs text-gray-500">Seats Left</p>
        </div>
      </div>
    </div>
  );
};

// Ride Status Badge
const RideStatusBadge = ({ status }) => {
  const statusConfig = {
    'ACTIVE': { class: 'bg-green-100 text-green-800', icon: 'fa-check-circle', text: 'Active' },
    'FULL': { class: 'bg-yellow-100 text-yellow-800', icon: 'fa-exclamation-circle', text: 'Fully Booked' },
    'IN_PROGRESS': { class: 'bg-blue-100 text-blue-800', icon: 'fa-car', text: 'In Progress' },
    'COMPLETED': { class: 'bg-gray-100 text-gray-800', icon: 'fa-flag-checkered', text: 'Completed' },
    'CANCELLED': { class: 'bg-red-100 text-red-800', icon: 'fa-times-circle', text: 'Cancelled' }
  };

  const config = statusConfig[status] || { class: 'bg-gray-100 text-gray-800', icon: 'fa-question', text: status };

  return (
    <span className={`${config.class} px-3 py-1 rounded-full text-sm font-semibold`}>
      <i className={`fas ${config.icon} mr-1`}></i>
      {config.text}
    </span>
  );
};

// Driver Card Component
const DriverCard = ({ driver }) => {
  const [imgError, setImgError] = useState(false);

  if (!driver) return null;

  const displayName = getUserDisplayName(driver);
  const photoUrl = getUserPhoto(driver);

  // Get first vehicle from vehicles array or use vehicle object
  const vehicle = driver.vehicles?.[0] || driver.vehicle;

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        <i className="fas fa-user text-emerald-500 mr-2"></i>Driver
      </h2>

      <div className="flex items-start space-x-4">
        {photoUrl && !imgError ? (
          <img
            src={photoUrl}
            alt={displayName}
            className="w-20 h-20 rounded-full object-cover border-4 border-emerald-100"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={`w-20 h-20 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white text-2xl font-bold border-4 border-emerald-100`}>
            {getInitials(displayName)}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-gray-800">
              {displayName}
            </h3>
            {(driver.verification?.license?.verified || driver.verificationStatus?.license === 'VERIFIED') && (
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                <i className="fas fa-check-circle mr-1"></i>Verified
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center mt-1">
            <div className="flex text-yellow-400">
              {[1, 2, 3, 4, 5].map(i => (
                <i key={i} className={`fas fa-star ${i <= Math.round(getRating(driver.rating)) ? '' : 'text-gray-300'}`}></i>
              ))}
            </div>
            <span className="ml-2 text-gray-600">
              {formatRating(driver.rating)} ({getRatingCount(driver.rating, driver.statistics)} reviews)
            </span>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-gray-600">
            <span>
              <i className="fas fa-car text-emerald-500 mr-1"></i>
              {driver.statistics?.totalRidesCompleted || 0} rides
            </span>
            <span>
              <i className="fas fa-calendar text-emerald-500 mr-1"></i>
              Member since {new Date(driver.createdAt).getFullYear()}
            </span>
          </div>

          {/* Note: Chat is available after booking via booking details page */}
        </div>
      </div>

      {/* Vehicle Info */}
      {vehicle && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-2">
            <i className="fas fa-car text-emerald-500 mr-2"></i>Vehicle
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Model:</span>
              <span className="ml-2 font-medium">{vehicle.make} {vehicle.model}</span>
            </div>
            <div>
              <span className="text-gray-500">Color:</span>
              <span className="ml-2 font-medium">{vehicle.color}</span>
            </div>
            <div>
              <span className="text-gray-500">Number:</span>
              <span className="ml-2 font-medium font-mono">{vehicle.registrationNumber || vehicle.licensePlate}</span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2 font-medium capitalize">{vehicle.type}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Ride Info Card
const RideInfoCard = ({ ride }) => {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        <i className="fas fa-info-circle text-emerald-500 mr-2"></i>Ride Information
      </h2>

      <div className="space-y-4">
        {/* Description */}
        {ride.specialInstructions && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-1">Note from Driver</h4>
            <p className="text-gray-600 bg-gray-50 rounded-lg p-3 italic">
              "{ride.specialInstructions}"
            </p>
          </div>
        )}

        {/* Stops - Filter out empty stops (no name or address) */}
        {(() => {
          const validStops = (ride.route?.intermediateStops || []).filter(stop => stop.name || stop.address);
          return validStops.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-700 mb-2">Intermediate Stops</h4>
              <div className="space-y-2">
                {validStops.map((stop, index) => (
                  <div key={index} className="flex items-center text-gray-600">
                    <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-xs font-semibold text-yellow-700">{index + 1}</span>
                    </div>
                    <span>{stop.name || stop.address}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Carbon Savings */}
        {ride.carbon?.carbonSaved > 0 && (
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center text-green-700">
              <i className="fas fa-leaf mr-2"></i>
              <span className="font-medium">Carbon Saved:</span>
              <span className="ml-2">{ride.carbon.carbonSaved.toFixed(2)} kg CO2</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Preferences Card
const PreferencesCard = ({ preferences }) => {
  const preferencesList = [
    { key: 'smoking', icon: 'fa-smoking-ban', label: 'No Smoking', value: !preferences.smoking },
    { key: 'music', icon: 'fa-music', label: 'Music Allowed', value: preferences.music },
    { key: 'pets', icon: 'fa-paw', label: 'Pets Allowed', value: preferences.pets },
    { key: 'luggage', icon: 'fa-suitcase', label: 'Luggage Space', value: preferences.largeLuggage },
    { key: 'ac', icon: 'fa-snowflake', label: 'Air Conditioned', value: preferences.ac },
    { key: 'chatty', icon: 'fa-comments', label: 'Conversation Friendly', value: preferences.chatty }
  ];

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        <i className="fas fa-sliders-h text-emerald-500 mr-2"></i>Preferences
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {preferencesList.map(pref => (
          <div
            key={pref.key}
            className={`flex items-center p-3 rounded-lg ${pref.value ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
              }`}
          >
            <i className={`fas ${pref.icon} mr-2`}></i>
            <span className="text-sm font-medium">{pref.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Passengers Card - Shows all passengers with their pickup/dropoff for the rider
const PassengersCard = ({ ride }) => {
  const bookings = ride.bookings || [];

  // Filter by different statuses
  const pendingBookings = bookings.filter(b => b.status === 'PENDING');
  const confirmedBookings = bookings.filter(b =>
    ['CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING', 'DROPPED_OFF'].includes(b.status)
  );
  const completedBookings = bookings.filter(b => b.status === 'COMPLETED');

  const getStatusBadge = (status) => {
    const config = {
      'PENDING': { color: 'bg-yellow-100 text-yellow-800', text: 'Pending' },
      'CONFIRMED': { color: 'bg-green-100 text-green-800', text: 'Confirmed' },
      'PICKUP_PENDING': { color: 'bg-blue-100 text-blue-800', text: 'Pickup Pending' },
      'PICKED_UP': { color: 'bg-purple-100 text-purple-800', text: 'Picked Up' },
      'IN_TRANSIT': { color: 'bg-purple-100 text-purple-800', text: 'In Transit' },
      'DROPOFF_PENDING': { color: 'bg-orange-100 text-orange-800', text: 'Dropoff Pending' },
      'DROPPED_OFF': { color: 'bg-teal-100 text-teal-800', text: 'Dropped Off' },
      'COMPLETED': { color: 'bg-gray-100 text-gray-800', text: 'Completed' },
      'CANCELLED': { color: 'bg-red-100 text-red-800', text: 'Cancelled' }
    };
    const c = config[status] || { color: 'bg-gray-100 text-gray-600', text: status };
    return <span className={`${c.color} px-2 py-0.5 rounded-full text-xs font-medium`}>{c.text}</span>;
  };

  if (bookings.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          <i className="fas fa-users text-emerald-500 mr-2"></i>Passengers
        </h2>
        <div className="text-center py-8 text-gray-500">
          <i className="fas fa-user-clock text-4xl mb-3 text-gray-300"></i>
          <p>No bookings yet</p>
          <p className="text-sm">Passengers will appear here when they book your ride</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        <i className="fas fa-users text-emerald-500 mr-2"></i>
        Passengers ({bookings.length})
      </h2>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {pendingBookings.length > 0 && (
          <div className="bg-yellow-50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-600">{pendingBookings.length}</p>
            <p className="text-xs text-yellow-700">Pending</p>
          </div>
        )}
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{confirmedBookings.length}</p>
          <p className="text-xs text-green-700">Confirmed</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-600">{completedBookings.length}</p>
          <p className="text-xs text-gray-700">Completed</p>
        </div>
      </div>

      {/* Pending Requests */}
      {pendingBookings.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
            <i className="fas fa-hourglass-half text-yellow-500 mr-2"></i>
            Pending Requests ({pendingBookings.length})
          </h3>
          <div className="space-y-3">
            {pendingBookings.map(booking => (
              <PassengerBookingCard key={booking._id} booking={booking} getStatusBadge={getStatusBadge} isPending />
            ))}
          </div>
        </div>
      )}

      {/* Confirmed Passengers */}
      {confirmedBookings.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
            <i className="fas fa-check-circle text-green-500 mr-2"></i>
            Confirmed Passengers ({confirmedBookings.length})
          </h3>
          <div className="space-y-3">
            {confirmedBookings.map(booking => (
              <PassengerBookingCard key={booking._id} booking={booking} getStatusBadge={getStatusBadge} />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedBookings.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center">
            <i className="fas fa-flag-checkered text-gray-500 mr-2"></i>
            Completed ({completedBookings.length})
          </h3>
          <div className="space-y-3">
            {completedBookings.map(booking => (
              <PassengerBookingCard key={booking._id} booking={booking} getStatusBadge={getStatusBadge} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Individual passenger booking card with pickup/dropoff details
const PassengerBookingCard = ({ booking, getStatusBadge, isPending }) => {
  const passenger = booking.passenger;
  const [imgError, setImgError] = useState(false);

  const displayName = getUserDisplayName(passenger);
  const photoUrl = getUserPhoto(passenger);

  return (
    <div className={`border rounded-lg p-4 ${isPending ? 'border-yellow-200 bg-yellow-50/30' : 'border-gray-200'}`}>
      {/* Passenger Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          {photoUrl && !imgError ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover mr-3"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-12 h-12 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-bold mr-3`}>
              {getInitials(displayName)}
            </div>
          )}
          <div>
            <h4 className="font-semibold text-gray-800">{displayName}</h4>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{booking.seatsBooked} seat{booking.seatsBooked > 1 ? 's' : ''}</span>
              <span>•</span>
              <span className="font-semibold text-emerald-600">₹{booking.totalPrice || booking.payment?.total || 0}</span>
            </div>
          </div>
        </div>
        {getStatusBadge(booking.status)}
      </div>

      {/* Pickup & Dropoff Locations */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <div className="flex items-start">
          <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="fas fa-map-marker-alt text-white text-xs"></i>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-xs text-gray-500 font-medium">PICKUP</p>
            <p className="text-sm text-gray-800">
              {booking.pickupPoint?.address || booking.pickupPoint?.name || 'Same as ride start'}
            </p>
          </div>
        </div>

        <div className="ml-3 border-l-2 border-dashed border-gray-300 h-3"></div>

        <div className="flex items-start">
          <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="fas fa-map-marker-alt text-white text-xs"></i>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-xs text-gray-500 font-medium">DROPOFF</p>
            <p className="text-sm text-gray-800">
              {booking.dropoffPoint?.address || booking.dropoffPoint?.name || 'Same as ride end'}
            </p>
          </div>
        </div>
      </div>

      {/* Special Requests */}
      {booking.specialRequests && (
        <div className="mt-3 bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-blue-600 font-medium mb-1">
            <i className="fas fa-comment-dots mr-1"></i>Special Request
          </p>
          <p className="text-sm text-blue-800">{booking.specialRequests}</p>
        </div>
      )}

      {/* Contact & Actions */}
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Chat Button */}
        <Link
          to={`/chat?bookingId=${booking._id}`}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-3 rounded-lg text-center transition"
        >
          <i className="fas fa-comments mr-1"></i>Chat
        </Link>

        {/* Phone Button - only if phone available */}
        {passenger?.phone && (
          <a
            href={`tel:${passenger.phone}`}
            className="bg-green-500 hover:bg-green-600 text-white text-sm py-2 px-3 rounded-lg transition"
          >
            <i className="fas fa-phone"></i>
          </a>
        )}

        {/* View Booking Details */}
        <Link
          to={`/bookings/${booking._id}`}
          className="bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm py-2 px-3 rounded-lg transition"
        >
          <i className="fas fa-eye mr-1"></i>Details
        </Link>
      </div>

      {/* Accept/Reject buttons for pending */}
      {isPending && (
        <div className="mt-3 pt-3 border-t flex gap-2">
          <Link
            to={`/bookings/${booking._id}`}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm py-2 px-4 rounded-lg text-center transition font-medium"
          >
            <i className="fas fa-check mr-1"></i>Review & Accept
          </Link>
        </div>
      )}
    </div>
  );
};

// Booking Card (Sidebar)
const BookingCard = ({ ride, canBook, onBook, isOwner }) => {
  const pricePerSeat = ride.pricing?.pricePerSeat || 0;
  const availableSeats = ride.pricing?.availableSeats || 0;

  return (
    <div className="bg-white rounded-xl shadow-md p-6 sticky top-24">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        <i className="fas fa-ticket-alt text-emerald-500 mr-2"></i>Book This Ride
      </h2>

      {/* Price */}
      <div className="text-center py-4 border-b mb-4">
        <p className="text-sm text-gray-500">Price per seat</p>
        <p className="text-4xl font-bold text-emerald-600">₹{pricePerSeat}</p>
      </div>

      {/* Seats Available */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-600">Seats Available</span>
        <span className="text-lg font-semibold text-emerald-600">{availableSeats}</span>
      </div>

      {/* Payment Methods */}
      <div className="mb-4">
        <span className="text-sm text-gray-500">Payment Methods</span>
        <div className="flex gap-2 mt-1">
          {ride.pricing?.paymentMethods?.includes('CASH') && (
            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
              <i className="fas fa-money-bill mr-1"></i>Cash
            </span>
          )}
          {ride.pricing?.paymentMethods?.includes('UPI') && (
            <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs">
              <i className="fas fa-mobile-alt mr-1"></i>UPI
            </span>
          )}
        </div>
      </div>

      {/* Book Button */}
      {isOwner ? (
        <div className="bg-yellow-50 text-yellow-700 rounded-lg p-3 text-center text-sm">
          <i className="fas fa-info-circle mr-2"></i>
          This is your ride
        </div>
      ) : canBook ? (
        <button
          onClick={onBook}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center"
        >
          <i className="fas fa-ticket-alt mr-2"></i>Book Now
        </button>
      ) : availableSeats <= 0 ? (
        <div className="bg-red-50 text-red-600 rounded-lg p-3 text-center text-sm">
          <i className="fas fa-times-circle mr-2"></i>
          No seats available
        </div>
      ) : (
        <Link
          to="/login"
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition flex items-center justify-center"
        >
          <i className="fas fa-sign-in-alt mr-2"></i>Login to Book
        </Link>
      )}

      {/* Trust Badges */}
      <div className="mt-4 pt-4 border-t">
        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center">
            <i className="fas fa-shield-alt text-emerald-500 mr-2"></i>
            OTP verified pickup & dropoff
          </div>
          <div className="flex items-center">
            <i className="fas fa-undo text-emerald-500 mr-2"></i>
            Free cancellation up to 2 hours
          </div>
          <div className="flex items-center">
            <i className="fas fa-headset text-emerald-500 mr-2"></i>
            24/7 customer support
          </div>
        </div>
      </div>
    </div>
  );
};

// Booking Modal
const BookingModal = ({ ride, searchedPickup, searchedDropoff, searchedSeats, onClose, onSuccess }) => {
  const [seats, setSeats] = useState(searchedSeats || 1);
  const [specialRequests, setSpecialRequests] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Use SEARCHED locations if available, otherwise fall back to ride's route
  // This shows the passenger what THEY searched for, not the entire ride route
  const pickupPoint = searchedPickup?.address || searchedPickup?.name || ride.route?.start?.address || 'Start point';
  const dropoffPoint = searchedDropoff?.address || searchedDropoff?.name || ride.route?.destination?.address || 'End point';

  // For sending to backend - include coordinates
  const pickupData = searchedPickup || {
    address: ride.route?.start?.address,
    name: ride.route?.start?.name,
    coordinates: ride.route?.start?.coordinates
  };
  const dropoffData = searchedDropoff || {
    address: ride.route?.destination?.address,
    name: ride.route?.destination?.name,
    coordinates: ride.route?.destination?.coordinates
  };

  const pricePerSeat = ride.pricing?.pricePerSeat || 0;
  const availableSeats = ride.pricing?.availableSeats || 1;
  const rideFare = seats * pricePerSeat;
  const platformCommission = Math.round(rideFare * 0.10); // 10% platform fee
  const totalPrice = rideFare + platformCommission;

  // ✅ EDGE CASE FIX: Prevent double-submission race condition
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Double-click protection - prevent multiple submissions
    if (isSubmitting || loading) {
      console.log('⚠️ Booking already in progress, ignoring duplicate submission');
      return;
    }

    setError('');
    setLoading(true);
    setIsSubmitting(true); // Lock form immediately

    try {
      // Get coordinates - searchedPickup has coordinates as [lon, lat] array
      const pickupCoords = pickupData.coordinates || (pickupData.lat && pickupData.lon ? [parseFloat(pickupData.lon), parseFloat(pickupData.lat)] : null);
      const dropoffCoords = dropoffData.coordinates || (dropoffData.lat && dropoffData.lon ? [parseFloat(dropoffData.lon), parseFloat(dropoffData.lat)] : null);

      const bookingData = {
        seatsBooked: seats,
        // Send the full location data with coordinates
        pickupLocation: JSON.stringify({
          address: pickupData.address || pickupData.name,
          name: pickupData.name || pickupData.city,
          coordinates: pickupCoords
        }),
        dropoffLocation: JSON.stringify({
          address: dropoffData.address || dropoffData.name,
          name: dropoffData.name || dropoffData.city,
          coordinates: dropoffCoords
        }),
        specialRequests: specialRequests || undefined,
        paymentMethod,
        // ✅ Add idempotency key to prevent duplicate processing
        idempotencyKey: `${ride._id}-${Date.now()}`
      };

      console.log('📝 Booking data:', bookingData);

      const response = await bookingService.createBooking(ride._id, bookingData);
      onSuccess(response.booking._id);
    } catch (err) {
      console.error('Booking error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to create booking');
      setIsSubmitting(false); // Unlock only on error so user can retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">
              <i className="fas fa-ticket-alt text-emerald-500 mr-2"></i>Book Ride
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>

          {error && <Alert type="error" message={error} className="mb-4" />}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Number of Seats */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Number of Seats
              </label>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setSeats(Math.max(1, seats - 1))}
                  className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                >
                  <i className="fas fa-minus"></i>
                </button>
                <span className="text-2xl font-bold text-gray-800 w-8 text-center">{seats}</span>
                <button
                  type="button"
                  onClick={() => setSeats(Math.min(availableSeats, seats + 1))}
                  className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">{availableSeats} seats available</p>
            </div>

            {/* Route Info - Read Only */}
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                <i className="fas fa-route text-emerald-500 mr-2"></i>
                {searchedPickup ? 'Your Route' : 'Route Details'}
                {searchedPickup && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    Based on your search
                  </span>
                )}
              </h3>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
                <div>
                  <p className="text-xs text-gray-500">Pickup</p>
                  <p className="text-sm text-gray-800 font-medium">{pickupPoint}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 flex-shrink-0"></div>
                <div>
                  <p className="text-xs text-gray-500">Dropoff</p>
                  <p className="text-sm text-gray-800 font-medium">{dropoffPoint}</p>
                </div>
              </div>
            </div>

            {/* Special Requests */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special Requests (Optional)
              </label>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Any special requirements..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('CASH')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition font-medium ${paymentMethod === 'CASH'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                >
                  <i className="fas fa-money-bill-wave mr-2"></i>Cash
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('UPI')}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition font-medium ${paymentMethod === 'UPI'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                >
                  <i className="fas fa-mobile-alt mr-2"></i>UPI
                </button>
              </div>
            </div>

            {/* Price Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between text-gray-600 mb-2">
                <span>Ride Fare ({seats} seat × ₹{pricePerSeat})</span>
                <span>₹{rideFare}</span>
              </div>
              <div className="flex justify-between text-gray-600 mb-2">
                <span>Platform Fee</span>
                <span>₹{platformCommission}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-emerald-600">₹{totalPrice}</span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>Processing...
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-2"></i>Confirm Booking
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============ DRIVER DASHBOARD COMPONENT ============
// This component shows for the ride owner/driver with full control panel
const DriverDashboard = ({ ride, actionLoading, onStartRide, onCompleteRide, onVerifyPickup, onVerifyDropoff, onRefresh }) => {
  const bookings = ride.bookings || [];

  // Filter bookings by status
  const pendingBookings = bookings.filter(b => b.status === 'PENDING');
  const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED');
  const pickupPendingBookings = bookings.filter(b => b.status === 'PICKUP_PENDING');
  const pickedUpBookings = bookings.filter(b => ['PICKED_UP', 'IN_TRANSIT'].includes(b.status));
  const dropoffPendingBookings = bookings.filter(b => b.status === 'DROPOFF_PENDING');
  const completedBookings = bookings.filter(b => ['DROPPED_OFF', 'COMPLETED'].includes(b.status));
  const activeBookings = bookings.filter(b => !['PENDING', 'CANCELLED', 'COMPLETED', 'DROPPED_OFF'].includes(b.status));

  // Can start ride check: must be ACTIVE with at least one confirmed booking
  const canStartRide = ride.status === 'ACTIVE' && confirmedBookings.length > 0;

  // Can complete ride check: must be IN_PROGRESS and all active passengers dropped off
  const canCompleteRide = ride.status === 'IN_PROGRESS' &&
    pickupPendingBookings.length === 0 &&
    pickedUpBookings.length === 0 &&
    dropoffPendingBookings.length === 0;

  // Progress calculation
  const getProgress = () => {
    const totalPassengers = bookings.filter(b => b.status !== 'PENDING' && b.status !== 'CANCELLED').length;
    if (totalPassengers === 0) return { step: 0, percent: 0 };

    if (ride.status === 'COMPLETED') return { step: 4, percent: 100 };
    if (ride.status === 'ACTIVE') return { step: 1, percent: 25 };

    // Count based on passenger statuses
    const pickedUp = bookings.filter(b => ['PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING', 'DROPPED_OFF', 'COMPLETED'].includes(b.status)).length;
    const droppedOff = bookings.filter(b => ['DROPPED_OFF', 'COMPLETED'].includes(b.status)).length;

    if (droppedOff === totalPassengers) return { step: 4, percent: 100 };
    if (droppedOff > 0) return { step: 3, percent: 75 };
    if (pickedUp === totalPassengers) return { step: 3, percent: 65 };
    if (pickedUp > 0) return { step: 2, percent: 50 };
    return { step: 2, percent: 40 };
  };

  const { step: currentStep, percent } = getProgress();

  const getStatusBadge = (status) => {
    const config = {
      'PENDING': { color: 'bg-yellow-100 text-yellow-800 border-yellow-300', text: 'Pending Approval' },
      'CONFIRMED': { color: 'bg-green-100 text-green-800 border-green-300', text: 'Confirmed' },
      'PICKUP_PENDING': { color: 'bg-blue-100 text-blue-800 border-blue-300', text: 'Awaiting Pickup' },
      'PICKED_UP': { color: 'bg-purple-100 text-purple-800 border-purple-300', text: 'On Board' },
      'IN_TRANSIT': { color: 'bg-purple-100 text-purple-800 border-purple-300', text: 'In Transit' },
      'DROPOFF_PENDING': { color: 'bg-orange-100 text-orange-800 border-orange-300', text: 'Ready for Dropoff' },
      'DROPPED_OFF': { color: 'bg-teal-100 text-teal-800 border-teal-300', text: 'Dropped Off' },
      'COMPLETED': { color: 'bg-gray-100 text-gray-800 border-gray-300', text: 'Complete' },
      'CANCELLED': { color: 'bg-red-100 text-red-800 border-red-300', text: 'Cancelled' }
    };
    const c = config[status] || { color: 'bg-gray-100 text-gray-600 border-gray-300', text: status };
    return <span className={`${c.color} px-3 py-1 rounded-full text-xs font-semibold border`}>{c.text}</span>;
  };

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      {/* Header with Progress */}
      <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center">
            <i className="fas fa-tachometer-alt mr-3"></i>
            Driver Dashboard
          </h2>
          <button onClick={onRefresh} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition text-sm">
            <i className="fas fa-sync-alt mr-1"></i>Refresh
          </button>
        </div>

        {/* Journey Progress Bar */}
        <div className="bg-white/10 rounded-lg p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">Journey Progress</span>
            <span>{percent}%</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="flex justify-between mt-3 text-xs">
            <span className={currentStep >= 1 ? 'font-bold' : 'opacity-70'}>
              <i className="fas fa-circle text-[8px] mr-1"></i>Ready
            </span>
            <span className={currentStep >= 2 ? 'font-bold' : 'opacity-70'}>
              <i className="fas fa-circle text-[8px] mr-1"></i>Started
            </span>
            <span className={currentStep >= 3 ? 'font-bold' : 'opacity-70'}>
              <i className="fas fa-circle text-[8px] mr-1"></i>Pickups
            </span>
            <span className={currentStep >= 4 ? 'font-bold' : 'opacity-70'}>
              <i className="fas fa-circle text-[8px] mr-1"></i>Complete
            </span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-yellow-50 rounded-lg p-3 text-center border border-yellow-200">
            <p className="text-2xl font-bold text-yellow-600">{pendingBookings.length}</p>
            <p className="text-xs text-yellow-700 font-medium">Pending</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-200">
            <p className="text-2xl font-bold text-blue-600">{pickupPendingBookings.length}</p>
            <p className="text-xs text-blue-700 font-medium">Await Pickup</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3 text-center border border-purple-200">
            <p className="text-2xl font-bold text-purple-600">{pickedUpBookings.length + dropoffPendingBookings.length}</p>
            <p className="text-xs text-purple-700 font-medium">On Board</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
            <p className="text-2xl font-bold text-green-600">{completedBookings.length}</p>
            <p className="text-xs text-green-700 font-medium">Completed</p>
          </div>
        </div>

        {/* Action Button - Start/Complete Ride */}
        {ride.status === 'ACTIVE' && (
          <div className="mb-6">
            {canStartRide ? (
              <button
                onClick={onStartRide}
                disabled={actionLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Starting Ride...</>
                ) : (
                  <><i className="fas fa-play-circle mr-2"></i>Start Ride - Begin Journey</>
                )}
              </button>
            ) : (
              <div className="bg-gray-100 rounded-xl p-4 text-center text-gray-600">
                <i className="fas fa-info-circle mr-2"></i>
                Waiting for confirmed bookings to start the ride
              </div>
            )}
          </div>
        )}

        {ride.status === 'IN_PROGRESS' && canCompleteRide && (
          <div className="mb-6">
            <button
              onClick={onCompleteRide}
              disabled={actionLoading}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? (
                <><i className="fas fa-spinner fa-spin mr-2"></i>Completing...</>
              ) : (
                <><i className="fas fa-flag-checkered mr-2"></i>Complete Ride - All Passengers Dropped</>
              )}
            </button>
          </div>
        )}

        {/* === PASSENGERS REQUIRING ACTION === */}

        {/* Pending Approval Section */}
        {pendingBookings.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center">
              <span className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-clock text-white text-sm"></i>
              </span>
              Awaiting Your Approval ({pendingBookings.length})
            </h3>
            <div className="space-y-3">
              {pendingBookings.map(booking => (
                <PassengerActionCard
                  key={booking._id}
                  booking={booking}
                  getStatusBadge={getStatusBadge}
                  actionType="approve"
                />
              ))}
            </div>
          </div>
        )}

        {/* Pickup Pending Section - Need to verify OTP */}
        {pickupPendingBookings.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center">
              <span className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-map-marker-alt text-white text-sm"></i>
              </span>
              Ready for Pickup - Verify OTP ({pickupPendingBookings.length})
            </h3>
            <div className="space-y-3">
              {pickupPendingBookings.map(booking => (
                <PassengerActionCard
                  key={booking._id}
                  booking={booking}
                  getStatusBadge={getStatusBadge}
                  actionType="pickup"
                  onVerifyPickup={onVerifyPickup}
                />
              ))}
            </div>
          </div>
        )}

        {/* On Board - In Transit */}
        {pickedUpBookings.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center">
              <span className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-car text-white text-sm"></i>
              </span>
              On Board - In Transit ({pickedUpBookings.length})
            </h3>
            <div className="space-y-3">
              {pickedUpBookings.map(booking => (
                <PassengerActionCard
                  key={booking._id}
                  booking={booking}
                  getStatusBadge={getStatusBadge}
                  actionType="transit"
                  onVerifyDropoff={onVerifyDropoff}
                />
              ))}
            </div>
          </div>
        )}

        {/* Dropoff Pending - Need to verify OTP */}
        {dropoffPendingBookings.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center">
              <span className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-flag-checkered text-white text-sm"></i>
              </span>
              Ready for Dropoff - Verify OTP ({dropoffPendingBookings.length})
            </h3>
            <div className="space-y-3">
              {dropoffPendingBookings.map(booking => (
                <PassengerActionCard
                  key={booking._id}
                  booking={booking}
                  getStatusBadge={getStatusBadge}
                  actionType="dropoff"
                  onVerifyDropoff={onVerifyDropoff}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed Passengers */}
        {completedBookings.length > 0 && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center">
              <span className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center mr-3">
                <i className="fas fa-check text-white text-sm"></i>
              </span>
              Journey Complete ({completedBookings.length})
            </h3>
            <div className="space-y-3">
              {completedBookings.map(booking => (
                <PassengerActionCard
                  key={booking._id}
                  booking={booking}
                  getStatusBadge={getStatusBadge}
                  actionType="complete"
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {bookings.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-users text-4xl text-gray-300"></i>
            </div>
            <p className="font-medium">No Passengers Yet</p>
            <p className="text-sm">Passengers will appear here when they book your ride</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Passenger Action Card - Shows passenger with action buttons based on status
const PassengerActionCard = ({ booking, getStatusBadge, actionType, onVerifyPickup, onVerifyDropoff }) => {
  const passenger = booking.passenger;
  const [imgError, setImgError] = useState(false);

  const displayName = getUserDisplayName(passenger);
  const photoUrl = getUserPhoto(passenger);

  // Determine card border and action button
  const getCardStyle = () => {
    switch (actionType) {
      case 'approve': return 'border-yellow-300 bg-yellow-50/50';
      case 'pickup': return 'border-blue-300 bg-blue-50/50';
      case 'transit': return 'border-purple-300 bg-purple-50/50';
      case 'dropoff': return 'border-orange-300 bg-orange-50/50';
      case 'complete': return 'border-green-300 bg-green-50/50';
      default: return 'border-gray-200';
    }
  };

  return (
    <div className={`border-2 rounded-xl p-4 ${getCardStyle()}`}>
      {/* Passenger Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center">
          {photoUrl && !imgError ? (
            <img
              src={photoUrl}
              alt={displayName}
              className="w-12 h-12 rounded-full object-cover mr-3 border-2 border-white shadow"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={`w-12 h-12 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-bold mr-3 border-2 border-white shadow`}>
              {getInitials(displayName)}
            </div>
          )}
          <div>
            <h4 className="font-semibold text-gray-800">{displayName}</h4>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span><i className="fas fa-chair text-gray-400 mr-1"></i>{booking.seatsBooked} seat{booking.seatsBooked > 1 ? 's' : ''}</span>
              <span className="text-emerald-600 font-semibold">₹{booking.payment?.rideFare || booking.totalPrice || 0}</span>
            </div>
          </div>
        </div>
        {getStatusBadge(booking.status)}
      </div>

      {/* Pickup & Dropoff Locations */}
      <div className="bg-white rounded-lg p-3 space-y-2 mb-3">
        <div className="flex items-start">
          <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="fas fa-arrow-up text-white text-[10px]"></i>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-[10px] text-gray-500 font-semibold uppercase">Pickup</p>
            <p className="text-sm text-gray-800">{booking.pickupPoint?.address || booking.pickupPoint?.name || 'Ride start'}</p>
          </div>
        </div>
        <div className="ml-2.5 border-l-2 border-dashed border-gray-300 h-2"></div>
        <div className="flex items-start">
          <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <i className="fas fa-arrow-down text-white text-[10px]"></i>
          </div>
          <div className="ml-3 flex-1">
            <p className="text-[10px] text-gray-500 font-semibold uppercase">Dropoff</p>
            <p className="text-sm text-gray-800">{booking.dropoffPoint?.address || booking.dropoffPoint?.name || 'Ride end'}</p>
          </div>
        </div>
      </div>

      {/* OTP Display for Ride Owner (Driver sees passenger's OTP) */}
      {(actionType === 'pickup' && booking.pickup?.otp) && (
        <div className="bg-blue-100 rounded-lg p-3 mb-3 text-center">
          <p className="text-xs text-blue-600 font-medium mb-1">Ask passenger for this OTP</p>
          <p className="text-2xl font-mono font-bold text-blue-800 tracking-wider">{booking.pickup.otp}</p>
        </div>
      )}

      {((actionType === 'dropoff' || actionType === 'transit') && booking.dropoff?.otp) && (
        <div className="bg-orange-100 rounded-lg p-3 mb-3 text-center">
          <p className="text-xs text-orange-600 font-medium mb-1">Ask passenger for Dropoff OTP</p>
          <p className="text-2xl font-mono font-bold text-orange-800 tracking-wider">{booking.dropoff.otp}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {/* Always show chat and view details */}
        <Link
          to={`/chat?bookingId=${booking._id}`}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-sm py-2.5 px-3 rounded-lg text-center font-medium transition"
        >
          <i className="fas fa-comments mr-1"></i>Chat
        </Link>

        {passenger?.phone && (
          <a
            href={`tel:${passenger.phone}`}
            className="bg-green-500 hover:bg-green-600 text-white text-sm py-2.5 px-3 rounded-lg transition"
          >
            <i className="fas fa-phone"></i>
          </a>
        )}

        <Link
          to={`/bookings/${booking._id}`}
          className="bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm py-2.5 px-3 rounded-lg transition"
        >
          <i className="fas fa-eye"></i>
        </Link>

        {/* Approval action */}
        {actionType === 'approve' && (
          <Link
            to={`/bookings/${booking._id}`}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm py-2.5 px-3 rounded-lg text-center font-medium transition"
          >
            <i className="fas fa-check mr-1"></i>Review & Approve
          </Link>
        )}

        {/* Pickup verification */}
        {actionType === 'pickup' && onVerifyPickup && (
          <button
            onClick={() => onVerifyPickup(booking)}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm py-2.5 px-3 rounded-lg font-medium transition"
          >
            <i className="fas fa-key mr-1"></i>Verify Pickup OTP
          </button>
        )}

        {/* Dropoff verification */}
        {(actionType === 'dropoff' || actionType === 'transit') && onVerifyDropoff && (
          <button
            onClick={() => onVerifyDropoff(booking)}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-sm py-2.5 px-3 rounded-lg font-medium transition"
          >
            <i className="fas fa-flag-checkered mr-1"></i>Verify Dropoff OTP
          </button>
        )}
      </div>

      {/* Special Requests */}
      {booking.specialRequests && (
        <div className="mt-3 bg-amber-50 rounded-lg p-2 border border-amber-200">
          <p className="text-xs text-amber-700 font-medium">
            <i className="fas fa-comment-dots mr-1"></i>Note: {booking.specialRequests}
          </p>
        </div>
      )}
    </div>
  );
};

// ============ RIDE MANAGEMENT SIDEBAR ============
// Shows ride status, quick actions, and earnings summary for driver
const RideManagementSidebar = ({ ride, onStartRide, onCompleteRide, actionLoading }) => {
  const bookings = ride.bookings || [];
  const confirmedBookings = bookings.filter(b => b.status !== 'PENDING' && b.status !== 'CANCELLED');
  const completedBookings = bookings.filter(b => ['DROPPED_OFF', 'COMPLETED'].includes(b.status));

  // Calculate earnings - rider gets rideFare only (excluding platform fee)
  const totalEarnings = confirmedBookings.reduce((sum, b) => sum + (b.payment?.rideFare || b.totalPrice || 0), 0);
  const collectedEarnings = completedBookings.reduce((sum, b) => sum + (b.payment?.rideFare || b.totalPrice || 0), 0);
  const pendingEarnings = totalEarnings - collectedEarnings;

  const canStartRide = ride.status === 'ACTIVE' && bookings.filter(b => b.status === 'CONFIRMED').length > 0;

  const pickupPendingCount = bookings.filter(b => b.status === 'PICKUP_PENDING').length;
  const onBoardCount = bookings.filter(b => ['PICKED_UP', 'IN_TRANSIT'].includes(b.status)).length;
  const dropoffPendingCount = bookings.filter(b => b.status === 'DROPOFF_PENDING').length;

  const canCompleteRide = ride.status === 'IN_PROGRESS' &&
    pickupPendingCount === 0 &&
    onBoardCount === 0 &&
    dropoffPendingCount === 0;

  const getRideStatusInfo = () => {
    switch (ride.status) {
      case 'ACTIVE':
        return { color: 'bg-green-500', icon: 'fa-clock', text: 'Scheduled', desc: 'Waiting for departure' };
      case 'IN_PROGRESS':
        return { color: 'bg-blue-500', icon: 'fa-car', text: 'In Progress', desc: 'Journey underway' };
      case 'COMPLETED':
        return { color: 'bg-gray-500', icon: 'fa-flag-checkered', text: 'Completed', desc: 'Journey finished' };
      case 'CANCELLED':
        return { color: 'bg-red-500', icon: 'fa-times-circle', text: 'Cancelled', desc: 'Ride cancelled' };
      default:
        return { color: 'bg-gray-500', icon: 'fa-question', text: ride.status, desc: '' };
    }
  };

  const statusInfo = getRideStatusInfo();

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden sticky top-24">
      {/* Status Header */}
      <div className={`${statusInfo.color} p-4 text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <i className={`fas ${statusInfo.icon} text-2xl mr-3`}></i>
            <div>
              <p className="font-bold text-lg">{statusInfo.text}</p>
              <p className="text-sm opacity-90">{statusInfo.desc}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Primary Action Button */}
        {ride.status === 'ACTIVE' && (
          <div className="mb-6">
            {canStartRide ? (
              <button
                onClick={onStartRide}
                disabled={actionLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Starting...</>
                ) : (
                  <><i className="fas fa-play-circle mr-2"></i>Start Ride</>
                )}
              </button>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                <i className="fas fa-hourglass-half text-yellow-500 text-xl mb-2"></i>
                <p className="text-sm text-yellow-700 font-medium">Waiting for Passengers</p>
                <p className="text-xs text-yellow-600">Confirm bookings to start ride</p>
              </div>
            )}
          </div>
        )}

        {ride.status === 'IN_PROGRESS' && (
          <div className="mb-6">
            {canCompleteRide ? (
              <button
                onClick={onCompleteRide}
                disabled={actionLoading}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading ? (
                  <><i className="fas fa-spinner fa-spin mr-2"></i>Completing...</>
                ) : (
                  <><i className="fas fa-flag-checkered mr-2"></i>Complete Ride</>
                )}
              </button>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <i className="fas fa-car text-blue-500 text-xl mb-2"></i>
                <p className="text-sm text-blue-700 font-medium">Ride In Progress</p>
                <p className="text-xs text-blue-600">
                  {pickupPendingCount > 0 && `${pickupPendingCount} awaiting pickup`}
                  {onBoardCount > 0 && ` • ${onBoardCount} on board`}
                  {dropoffPendingCount > 0 && ` • ${dropoffPendingCount} ready to drop`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Earnings Summary */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">
            <i className="fas fa-rupee-sign text-emerald-500 mr-2"></i>Earnings
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Total Expected</span>
              <span className="font-bold text-gray-800">₹{totalEarnings}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-gray-600">Collected</span>
              <span className="font-bold text-green-600">₹{collectedEarnings}</span>
            </div>
            {pendingEarnings > 0 && (
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-600">Pending</span>
                <span className="font-bold text-orange-500">₹{pendingEarnings}</span>
              </div>
            )}
          </div>
        </div>

        {/* Passenger Summary */}
        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">
            <i className="fas fa-users text-emerald-500 mr-2"></i>Passengers
          </h3>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-gray-800">{confirmedBookings.length}</p>
              <p className="text-xs text-gray-600">Confirmed</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xl font-bold text-gray-800">{completedBookings.length}</p>
              <p className="text-xs text-gray-600">Completed</p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-2">
          <Link
            to="/my-rides"
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-lg transition flex items-center justify-center"
          >
            <i className="fas fa-list mr-2 text-gray-500"></i>
            All My Rides
          </Link>
        </div>

        {/* Help Section */}
        <div className="mt-6 pt-4 border-t">
          <div className="text-xs text-gray-500 space-y-1">
            <p><i className="fas fa-info-circle mr-1"></i>OTP verification ensures secure pickup & dropoff</p>
            <p><i className="fas fa-shield-alt mr-1"></i>All rides are insured and monitored</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RideDetails;
