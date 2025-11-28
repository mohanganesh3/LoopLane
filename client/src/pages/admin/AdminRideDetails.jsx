import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';

const AdminRideDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ride, setRide] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchRideDetails();
  }, [id]);

  const fetchRideDetails = async () => {
    setLoading(true);
    try {
      const response = await adminService.getRideById(id);
      if (response.success) {
        setRide(response.ride);
        setBookings(response.bookings || response.ride?.bookings || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load ride details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRide = async () => {
    const reason = prompt('Enter reason for cancellation:');
    if (!reason) return;
    
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;

    try {
      const response = await adminService.cancelRide(id, reason);
      if (response.success) {
        setSuccess('Ride cancelled successfully');
        fetchRideDetails();
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel ride');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      'ACTIVE': 'bg-blue-100 text-blue-800',
      'SCHEDULED': 'bg-purple-100 text-purple-800',
      'IN_PROGRESS': 'bg-yellow-100 text-yellow-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const getBookingStatusBadge = (status) => {
    const styles = {
      'PENDING': 'bg-yellow-100 text-yellow-800',
      'CONFIRMED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-red-100 text-red-800',
      'COMPLETED': 'bg-emerald-100 text-emerald-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="p-6">
        <Alert type="error" message="Ride not found" />
        <button
          onClick={() => navigate('/admin/rides')}
          className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg"
        >
          ← Back to Rides
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/rides')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-gray-800">
            <i className="fas fa-car mr-2"></i>Ride Details
          </h1>
        </div>
        <span className={`px-4 py-2 rounded-full font-semibold ${getStatusBadge(ride.status)}`}>
          {ride.status}
        </span>
      </div>

      {error && <Alert type="error" message={error} className="mb-6" onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} className="mb-6" onClose={() => setSuccess('')} />}

      {/* Ride Info Card */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-route mr-2 text-indigo-500"></i>Route Information
        </h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5"></div>
              <div>
                <p className="text-sm text-gray-500">From</p>
                <p className="font-semibold text-gray-800">
                  {ride.route?.start?.address || ride.from?.address || 'Unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5"></div>
              <div>
                <p className="text-sm text-gray-500">To</p>
                <p className="font-semibold text-gray-800">
                  {ride.route?.destination?.address || ride.to?.address || 'Unknown'}
                </p>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Date & Time</p>
              <p className="font-semibold text-gray-800">
                {ride.departureTime 
                  ? new Date(ride.departureTime).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short'
                    })
                  : 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Price per Seat</p>
              <p className="font-bold text-emerald-600 text-lg">
                ₹{ride.pricing?.pricePerSeat || ride.pricePerSeat || 0}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Available Seats</p>
              <p className="font-semibold text-gray-800">
                {ride.pricing?.availableSeats || ride.availableSeats || 0}
              </p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <p className="text-sm text-gray-500">Distance</p>
              <p className="font-semibold text-gray-800">
                {ride.route?.distance?.value 
                  ? `${(ride.route.distance.value / 1000).toFixed(1)} km`
                  : ride.distance 
                  ? `${(ride.distance / 1000).toFixed(1)} km`
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Info */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-user mr-2 text-indigo-500"></i>Driver Information
        </h2>
        
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl">
            {(ride.rider?.profile?.firstName?.[0] || ride.rider?.name?.[0] || 'U').toUpperCase()}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-lg">
              {ride.rider?.profile?.firstName || ''} {ride.rider?.profile?.lastName || ride.rider?.name || 'Unknown'}
            </p>
            <p className="text-gray-500">{ride.rider?.email}</p>
            <p className="text-gray-500">{ride.rider?.phone}</p>
          </div>
          <button
            onClick={() => navigate(`/admin/users/${ride.rider?._id}`)}
            className="px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"
          >
            View Profile →
          </button>
        </div>
      </div>

      {/* Bookings */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <i className="fas fa-ticket-alt mr-2 text-indigo-500"></i>Bookings ({bookings.length})
        </h2>
        
        {bookings.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <i className="fas fa-inbox text-4xl mb-2"></i>
            <p>No bookings for this ride yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <div
                key={booking._id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 font-bold">
                    {(booking.passenger?.profile?.firstName?.[0] || 'P').toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      {booking.passenger?.profile?.firstName || ''} {booking.passenger?.profile?.lastName || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-500">{booking.passenger?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-emerald-600">₹{booking.totalPrice || 0}</p>
                    <p className="text-sm text-gray-500">{booking.seatsBooked || 1} seat(s)</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getBookingStatusBadge(booking.status)}`}>
                    {booking.status}
                  </span>
                  <button
                    onClick={() => navigate(`/admin/bookings/${booking._id}`)}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded text-sm hover:bg-indigo-200"
                  >
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {ride.status === 'ACTIVE' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Admin Actions</h2>
          <div className="flex gap-3">
            <button
              onClick={handleCancelRide}
              className="px-6 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
            >
              <i className="fas fa-times-circle mr-2"></i>Cancel Ride
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRideDetails;
