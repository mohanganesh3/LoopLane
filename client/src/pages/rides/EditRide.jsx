import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner, Alert, Button, ContributionCalculator } from '../../components/common';
import userService from '../../services/userService';
import rideService from '../../services/rideService';

const EditRide = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [originalRide, setOriginalRide] = useState(null);

  const [formData, setFormData] = useState({
    origin: null,
    destination: null,
    date: '',
    time: '',
    vehicleId: '',
    availableSeats: 4,
    ladiesOnly: false,
    notes: ''
  });

  const [distance, setDistance] = useState(null);
  const [suggestedPricePerSeat, setSuggestedPricePerSeat] = useState(null);
  const [pricePerSeat, setPricePerSeat] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchRideAndVehicles();
  }, [id]);

  const fetchRideAndVehicles = async () => {
    try {
      // Fetch ride details
      const rideData = await rideService.getRideById(id);
      if (!rideData || !rideData.ride) {
        setError('Ride not found');
        return;
      }

      const ride = rideData.ride;
      setOriginalRide(ride);

      // Check if ride can be edited (no bookings)
      if (ride.bookings && ride.bookings.length > 0) {
        setError('Cannot edit ride with existing bookings');
        return;
      }

      if (ride.status !== 'ACTIVE') {
        setError('Only active rides can be edited');
        return;
      }

      // Fetch vehicles
      const profileData = await userService.getProfile();
      const approvedVehicles = (profileData.user?.vehicles || []).filter(v => v.status === 'APPROVED');
      setVehicles(approvedVehicles);

      // Parse date and time from departureDateTime
      const departureDate = new Date(ride.schedule?.departureDateTime);
      const dateStr = departureDate.toISOString().split('T')[0];
      const timeStr = departureDate.toTimeString().slice(0, 5);

      // Set form data from ride
      setFormData({
        origin: {
          address: ride.route?.start?.address || ride.route?.start?.name,
          coordinates: ride.route?.start?.coordinates?.coordinates || ride.route?.start?.coordinates
        },
        destination: {
          address: ride.route?.destination?.address || ride.route?.destination?.name,
          coordinates: ride.route?.destination?.coordinates?.coordinates || ride.route?.destination?.coordinates
        },
        date: dateStr,
        time: timeStr,
        vehicleId: ride.vehicle?._id || ride.vehicle || '',
        availableSeats: ride.pricing?.totalSeats || ride.pricing?.availableSeats || 4,
        ladiesOnly: ride.preferences?.gender === 'FEMALE_ONLY',
        notes: ride.specialInstructions || ''
      });

      // Set initial price
      setPricePerSeat(ride.pricing?.pricePerSeat);
      setSuggestedPricePerSeat(ride.pricing?.pricePerSeat);
      setDistance(ride.route?.distance);

    } catch (err) {
      console.error('Failed to load ride:', err);
      setError(err.message || 'Failed to load ride details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (submitting) return;
    
    setError('');

    if (!formData.date || !formData.time) {
      setError('Please select departure date and time');
      return;
    }

    // Use original price as fallback if slider hasn't set a value
    const finalPrice = pricePerSeat || originalRide?.pricing?.pricePerSeat;
    if (!finalPrice || finalPrice <= 0) {
      setError('Please set a valid price per seat');
      return;
    }

    setSubmitting(true);

    try {
      const departureTime = new Date(`${formData.date}T${formData.time}`).toISOString();

      // Build preferences object to match backend expectations
      const preferences = {
        gender: formData.ladiesOnly ? 'FEMALE_ONLY' : 'ANY'
      };

      const rideData = {
        departureTime,
        availableSeats: parseInt(formData.availableSeats),
        pricePerSeat: finalPrice,
        preferences: JSON.stringify(preferences)
      };

      console.log('📤 Sending ride update:', rideData);

      const result = await rideService.updateRide(id, rideData);

      if (result.success) {
        setSuccess('Ride updated successfully!');
        setTimeout(() => navigate('/my-rides'), 1500);
      } else {
        setError(result.message || 'Failed to update ride');
      }
    } catch (err) {
      console.error('Update error:', err.response?.data || err);
      // Extract the actual error message from the response
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update ride';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading ride details..." />;
  }

  if (error && !originalRide) {
    return (
      <div className="pb-12 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <Alert type="error" message={error} />
          <Link to="/my-rides" className="text-emerald-500 hover:underline mt-4 inline-block">
            <i className="fas fa-arrow-left mr-2"></i>Back to My Rides
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl shadow-lg p-8 mb-8 text-white">
          <h1 className="text-3xl font-bold mb-2">
            <i className="fas fa-edit mr-3"></i>Edit Ride
          </h1>
          <p className="opacity-90">Update your ride details before passengers book</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {success && <Alert type="success" message={success} />}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Route Display (Read-only) */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-route text-orange-500 mr-2"></i>Route Details
                <span className="text-sm font-normal text-gray-500 ml-2">(Cannot be changed)</span>
              </h2>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center text-gray-700">
                  <i className="fas fa-map-marker-alt text-green-600 w-6"></i>
                  <span className="ml-2 font-medium">{formData.origin?.address || 'Loading...'}</span>
                </div>
                <div className="flex items-center text-gray-400 ml-6">
                  <i className="fas fa-ellipsis-v"></i>
                  <span className="ml-3 text-sm">
                    {distance ? `${distance} km` : 'Calculating...'}
                  </span>
                </div>
                <div className="flex items-center text-gray-700">
                  <i className="fas fa-map-marker-alt text-red-600 w-6"></i>
                  <span className="ml-2 font-medium">{formData.destination?.address || 'Loading...'}</span>
                </div>
              </div>
              
              <p className="text-xs text-gray-500 mt-2">
                <i className="fas fa-info-circle mr-1"></i>
                To change the route, please delete this ride and create a new one.
              </p>
            </div>

            {/* Date & Time Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-calendar-alt text-orange-500 mr-2"></i>Date & Time
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Departure Date *</label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    min={today}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Departure Time *</label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Seats Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-users text-orange-500 mr-2"></i>Available Seats
              </h2>

              <div>
                <label className="block text-gray-700 font-medium mb-2">Number of Seats *</label>
                <select
                  name="availableSeats"
                  value={formData.availableSeats}
                  onChange={(e) => setFormData(prev => ({ ...prev, availableSeats: e.target.value }))}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent max-w-xs"
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n} seat{n > 1 ? 's' : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-rupee-sign text-orange-500 mr-2"></i>Pricing
              </h2>

              {distance ? (
                <div className="space-y-4">
                  {/* BlaBlaCar-style Contribution Calculator with Working Slider */}
                  <ContributionCalculator 
                    distanceKm={parseFloat(distance)} 
                    passengers={parseInt(formData.availableSeats)}
                    onPriceCalculated={(price) => {
                      setPricePerSeat(price);
                    }}
                    showBreakdown={true}
                    allowSlider={true}
                    initialPrice={originalRide?.pricing?.pricePerSeat}
                  />

                  {/* Final Price Summary */}
                  <div className="p-4 bg-gradient-to-r from-orange-50 to-yellow-50 border-2 border-orange-400 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-orange-800 font-medium">
                          <i className="fas fa-check-circle mr-1"></i>
                          Price Per Seat
                        </p>
                      </div>
                      <div className="text-3xl font-bold text-orange-700">
                        {pricePerSeat ? `₹${pricePerSeat}` : '₹ -'}
                      </div>
                    </div>
                    {pricePerSeat && formData.availableSeats && (
                      <div className="mt-3 pt-3 border-t border-orange-300 text-sm text-orange-700">
                        <i className="fas fa-calculator mr-1"></i>
                        If all {formData.availableSeats} seats booked: You'll receive ₹{pricePerSeat * formData.availableSeats}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500">
                  <i className="fas fa-map-marked-alt text-4xl mb-3"></i>
                  <p className="font-medium">Loading route information...</p>
                </div>
              )}
            </div>

            {/* Preferences */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-sliders-h text-orange-500 mr-2"></i>Preferences
              </h2>

              <div className="space-y-4">
                {/* Ladies Only */}
                {user?.gender === 'FEMALE' && (
                  <div className="flex items-center justify-between p-4 bg-pink-50 rounded-lg border border-pink-200">
                    <div>
                      <h4 className="font-semibold text-gray-800">
                        <i className="fas fa-female text-pink-600 mr-1"></i>Ladies Only
                      </h4>
                      <p className="text-sm text-gray-600">Only female passengers can book this ride</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.ladiesOnly}
                        onChange={(e) => setFormData(prev => ({ ...prev, ladiesOnly: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
                    </label>
                  </div>
                )}
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4">
              <Link
                to="/my-rides"
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                Cancel
              </Link>
              <Button 
                type="submit" 
                loading={submitting}
                className="bg-orange-500 hover:bg-orange-600"
              >
                <i className="fas fa-save mr-2"></i>Save Changes
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EditRide;
