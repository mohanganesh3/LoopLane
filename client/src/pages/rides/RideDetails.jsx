import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { LoadingSpinner, Alert } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import rideService from '../../services/rideService';
import bookingService from '../../services/bookingService';

const RideDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingModal, setBookingModal] = useState(false);

  useEffect(() => {
    fetchRideDetails();
  }, [id]);

  const fetchRideDetails = async () => {
    try {
      const data = await rideService.getRideById(id);
      setRide(data.ride);
    } catch (err) {
      setError('Failed to load ride details');
    } finally {
      setLoading(false);
    }
  };

  // Check if user can book this ride
  const canBook = () => {
    if (!isAuthenticated) return false;
    if (!ride) return false;
    if (ride.rider?._id === user?._id) return false; // Can't book own ride
    if (ride.availableSeats <= 0) return false;
    if (ride.status !== 'ACTIVE') return false;
    return true;
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading ride details..." />;
  }

  if (error || !ride) {
    return (
      <div className="pt-20 pb-12 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <Alert type="error" message={error || 'Ride not found'} />
          <Link to="/rides/search" className="text-emerald-500 hover:underline mt-4 inline-block">
            ← Back to Search
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-12 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Back Button */}
        <Link to="/rides/search" className="inline-flex items-center text-emerald-500 hover:text-emerald-700 mb-6">
          <i className="fas fa-arrow-left mr-2"></i>Back to Search
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Route Card */}
            <RouteCard ride={ride} />
            
            {/* Driver Info Card */}
            <DriverCard driver={ride.rider} />
            
            {/* Ride Details Card */}
            <RideInfoCard ride={ride} />
            
            {/* Preferences Card */}
            {ride.preferences && <PreferencesCard preferences={ride.preferences} />}
          </div>

          {/* Sidebar - Booking Card */}
          <div className="lg:col-span-1">
            <BookingCard 
              ride={ride} 
              canBook={canBook()}
              onBook={() => setBookingModal(true)}
              isOwner={ride.rider?._id === user?._id}
            />
          </div>
        </div>

        {/* Booking Modal */}
        {bookingModal && (
          <BookingModal 
            ride={ride} 
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
              <p className="text-lg font-semibold text-gray-800">{ride.source?.name || ride.source?.address}</p>
              <p className="text-sm text-gray-500">{ride.source?.address}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Drop-off Point</p>
              <p className="text-lg font-semibold text-gray-800">{ride.destination?.name || ride.destination?.address}</p>
              <p className="text-sm text-gray-500">{ride.destination?.address}</p>
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
          <p className="text-lg font-semibold">{ride.availableSeats}</p>
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
  if (!driver) return null;

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        <i className="fas fa-user text-emerald-500 mr-2"></i>Driver
      </h2>

      <div className="flex items-start space-x-4">
        <img 
          src={driver.profilePhoto || '/images/default-avatar.png'} 
          alt={driver.firstName}
          className="w-20 h-20 rounded-full object-cover border-4 border-emerald-100"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold text-gray-800">
              {driver.firstName} {driver.lastName?.charAt(0)}.
            </h3>
            {driver.verification?.license?.verified && (
              <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-semibold">
                <i className="fas fa-check-circle mr-1"></i>Verified
              </span>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center mt-1">
            <div className="flex text-yellow-400">
              {[1,2,3,4,5].map(i => (
                <i key={i} className={`fas fa-star ${i <= Math.round(driver.rating?.overall || 0) ? '' : 'text-gray-300'}`}></i>
              ))}
            </div>
            <span className="ml-2 text-gray-600">
              {(driver.rating?.overall || 0).toFixed(1)} ({driver.rating?.count || 0} reviews)
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

          {/* Chat Button */}
          <Link
            to={`/chat?userId=${driver._id}`}
            className="inline-flex items-center mt-3 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm transition"
          >
            <i className="fas fa-comment mr-2"></i>Chat with Driver
          </Link>
        </div>
      </div>

      {/* Vehicle Info */}
      {driver.vehicle && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-2">
            <i className="fas fa-car text-emerald-500 mr-2"></i>Vehicle
          </h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Model:</span>
              <span className="ml-2 font-medium">{driver.vehicle.model}</span>
            </div>
            <div>
              <span className="text-gray-500">Color:</span>
              <span className="ml-2 font-medium">{driver.vehicle.color}</span>
            </div>
            <div>
              <span className="text-gray-500">Number:</span>
              <span className="ml-2 font-medium font-mono">{driver.vehicle.registrationNumber}</span>
            </div>
            <div>
              <span className="text-gray-500">Type:</span>
              <span className="ml-2 font-medium capitalize">{driver.vehicle.type}</span>
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
        {ride.description && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-1">Note from Driver</h4>
            <p className="text-gray-600 bg-gray-50 rounded-lg p-3 italic">
              "{ride.description}"
            </p>
          </div>
        )}

        {/* Stops */}
        {ride.stops && ride.stops.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-700 mb-2">Intermediate Stops</h4>
            <div className="space-y-2">
              {ride.stops.map((stop, index) => (
                <div key={index} className="flex items-center text-gray-600">
                  <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mr-3">
                    <span className="text-xs font-semibold text-yellow-700">{index + 1}</span>
                  </div>
                  <span>{stop.name || stop.address}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Booking Deadline */}
        {ride.bookingDeadline && (
          <div className="bg-yellow-50 rounded-lg p-3">
            <div className="flex items-center text-yellow-700">
              <i className="fas fa-exclamation-triangle mr-2"></i>
              <span className="font-medium">Book before:</span>
              <span className="ml-2">
                {new Date(ride.bookingDeadline).toLocaleString()}
              </span>
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
            className={`flex items-center p-3 rounded-lg ${
              pref.value ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
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

// Booking Card (Sidebar)
const BookingCard = ({ ride, canBook, onBook, isOwner }) => {
  const pricePerSeat = ride.pricing?.pricePerSeat || 0;

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
        <span className="text-lg font-semibold text-emerald-600">{ride.availableSeats}</span>
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
      ) : ride.availableSeats <= 0 ? (
        <div className="bg-red-50 text-red-600 rounded-lg p-3 text-center text-sm">
          <i className="fas fa-times-circle mr-2"></i>
          No seats available
        </div>
      ) : (
        <Link
          to="/auth/login"
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
const BookingModal = ({ ride, onClose, onSuccess }) => {
  const [seats, setSeats] = useState(1);
  const [pickupPoint, setPickupPoint] = useState('');
  const [dropoffPoint, setDropoffPoint] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pricePerSeat = ride.pricing?.pricePerSeat || 0;
  const totalPrice = seats * pricePerSeat;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const bookingData = {
        seatsBooked: seats,
        pickupPoint: pickupPoint || ride.source?.address,
        dropoffPoint: dropoffPoint || ride.destination?.address,
        specialRequests: specialRequests || undefined
      };

      const response = await bookingService.createBooking(ride._id, bookingData);
      onSuccess(response.booking._id);
    } catch (err) {
      setError(err.message || 'Failed to create booking');
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
                  onClick={() => setSeats(Math.min(ride.availableSeats, seats + 1))}
                  className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50"
                >
                  <i className="fas fa-plus"></i>
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">{ride.availableSeats} seats available</p>
            </div>

            {/* Pickup Point */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pickup Point (Optional)
              </label>
              <input
                type="text"
                value={pickupPoint}
                onChange={(e) => setPickupPoint(e.target.value)}
                placeholder={ride.source?.name || "Same as ride start"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Dropoff Point */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dropoff Point (Optional)
              </label>
              <input
                type="text"
                value={dropoffPoint}
                onChange={(e) => setDropoffPoint(e.target.value)}
                placeholder={ride.destination?.name || "Same as ride end"}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
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

            {/* Price Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between text-gray-600 mb-2">
                <span>₹{pricePerSeat} × {seats} seat(s)</span>
                <span>₹{totalPrice}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
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

export default RideDetails;
