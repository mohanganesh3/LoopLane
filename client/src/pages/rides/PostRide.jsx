import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner, Alert, Button, ContributionCalculator } from '../../components/common';
import LocationInput from '../../components/common/LocationInput';
import userService from '../../services/userService';
import rideService from '../../services/rideService';

const PostRide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState([]);
  const [pendingVehicles, setPendingVehicles] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    origin: null,
    destination: null,
    date: '',
    time: '',
    vehicleId: '',
    availableSeats: 4,
    customPricePerSeat: '',
    ladiesOnly: false,
    notes: ''
  });

  const [distance, setDistance] = useState(null);
  const [pricePerSeat, setPricePerSeat] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchVehicles();
  }, []);

  // Recalculate distance when origin or destination change
  useEffect(() => {
    if (formData.origin && formData.destination && formData.origin.coordinates && formData.destination.coordinates) {
      calculateDistance(formData.origin, formData.destination);
    }
  }, [
    formData.origin?.coordinates?.[0], 
    formData.origin?.coordinates?.[1], 
    formData.destination?.coordinates?.[0], 
    formData.destination?.coordinates?.[1]
  ]);

  // Calculate distance between origin and destination
  const calculateDistance = async (origin, destination) => {
    try {
      const coordsString = `${origin.coordinates[0]},${origin.coordinates[1]};${destination.coordinates[0]},${destination.coordinates[1]}`;
      
      console.log('🗺️ Calculating route:', coordsString);

      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=false`
      );
      const data = await response.json();

      if (data.code === 'Ok' && data.routes?.[0]) {
        const distanceKm = (data.routes[0].distance / 1000).toFixed(1);
        const durationMins = Math.round(data.routes[0].duration / 60);
        setDistance(distanceKm);
        console.log('✅ Route distance:', distanceKm, 'km, Duration:', durationMins, 'mins');
      }
    } catch (err) {
      console.error('Distance calculation error:', err);
      // Fallback: calculate straight-line distance
      try {
        const dist = haversineDistance(origin.coordinates, destination.coordinates);
        setDistance(dist.toFixed(1));
      } catch (e) {
        console.error('Fallback distance calculation failed:', e);
      }
    }
  };

  // Haversine formula for fallback distance calculation
  const haversineDistance = (coord1, coord2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const fetchVehicles = async () => {
    try {
      const data = await userService.getProfile();
      const userVehicles = data.user?.vehicles || [];
      setAllVehicles(userVehicles);
      
      const approvedVehicles = userVehicles.filter(v => v.status === 'APPROVED');
      const pendingVehiclesList = userVehicles.filter(v => v.status === 'PENDING');
      
      setVehicles(approvedVehicles);
      setPendingVehicles(pendingVehiclesList);
      
      if (approvedVehicles.length > 0) {
        setFormData(prev => ({ ...prev, vehicleId: approvedVehicles[0]._id }));
      }
    } catch (err) {
      console.error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent double submission
    if (submitting) {
      return;
    }
    
    setError('');

    if (!formData.origin || !formData.origin.coordinates) {
      setError('Please select a valid pickup location');
      return;
    }

    if (!formData.destination || !formData.destination.coordinates) {
      setError('Please select a valid drop-off location');
      return;
    }

    if (!formData.vehicleId) {
      setError('Please select a vehicle');
      return;
    }

    if (!formData.date || !formData.time) {
      setError('Please select departure date and time');
      return;
    }

    if (!pricePerSeat || pricePerSeat <= 0) {
      setError('Please wait for price calculation or enter a custom price per seat');
      return;
    }

    setSubmitting(true);

    try {
      const departureTime = new Date(`${formData.date}T${formData.time}`).toISOString();

      const rideData = {
        originCoordinates: formData.origin,
        destinationCoordinates: formData.destination,
        fromLocation: formData.origin.address,
        toLocation: formData.destination.address,
        departureTime,
        vehicleId: formData.vehicleId,
        availableSeats: parseInt(formData.availableSeats),
        pricePerSeat: pricePerSeat,
        distance: parseFloat(distance) || 0,
        ladiesOnly: formData.ladiesOnly,
        notes: formData.notes
      };

      const result = await rideService.postRide(rideData);

      if (result.success) {
        setSuccess('Ride posted successfully!');
        setTimeout(() => navigate('/my-rides'), 1500);
      } else {
        setError(result.message || 'Failed to post ride');
      }
    } catch (err) {
      setError(err.message || 'Failed to post ride');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  // Case 1: No vehicles at all - prompt to add vehicle
  if (allVehicles.length === 0) {
    return (
      <div className="pb-12 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <i className="fas fa-car text-gray-300 text-6xl mb-4"></i>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Vehicles Added</h2>
            <p className="text-gray-600 mb-6">
              You need to add a vehicle to post rides. Add your vehicle details and it will be verified by our team.
            </p>
            <Link
              to="/profile"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition inline-block"
            >
              <i className="fas fa-plus-circle mr-2"></i>Add Vehicle
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Has vehicles but none approved yet (all pending)
  if (vehicles.length === 0 && pendingVehicles.length > 0) {
    return (
      <div className="pb-12 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-clock text-yellow-600 text-3xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Vehicle Verification Pending</h2>
            <p className="text-gray-600 mb-4">
              Your vehicle is currently under review by our admin team. You'll be able to post rides once your vehicle is approved.
            </p>
            
            {/* Show pending vehicles */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
              <h3 className="font-semibold text-yellow-800 mb-3">
                <i className="fas fa-car mr-2"></i>Pending Vehicles ({pendingVehicles.length})
              </h3>
              {pendingVehicles.map((vehicle, index) => (
                <div key={vehicle._id || index} className="flex items-center gap-3 py-2 border-b border-yellow-200 last:border-0">
                  <div className="w-10 h-10 bg-yellow-200 rounded-full flex items-center justify-center">
                    <i className="fas fa-car-side text-yellow-700"></i>
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">
                      {vehicle.make} {vehicle.model}
                    </p>
                    <p className="text-sm text-gray-500">
                      {vehicle.vehicleNumber || vehicle.licensePlate || 'License plate pending'}
                    </p>
                  </div>
                  <span className="ml-auto text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">
                    Pending
                  </span>
                </div>
              ))}
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/profile"
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-3 rounded-lg font-semibold transition inline-flex items-center justify-center"
              >
                <i className="fas fa-user mr-2"></i>View Profile
              </Link>
              <button
                onClick={() => window.location.reload()}
                className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition inline-flex items-center justify-center"
              >
                <i className="fas fa-sync-alt mr-2"></i>Check Status
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mt-6">
              <i className="fas fa-info-circle mr-1"></i>
              Verification usually takes 24-48 hours. Contact support if it's taking longer.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Has vehicles but none approved and none pending (all rejected)
  if (vehicles.length === 0) {
    const rejectedVehicles = allVehicles.filter(v => v.status === 'REJECTED');
    return (
      <div className="pb-12 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fas fa-times-circle text-red-600 text-3xl"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Approved Vehicles</h2>
            <p className="text-gray-600 mb-4">
              {rejectedVehicles.length > 0 
                ? "Your vehicle verification was not successful. Please add a new vehicle with correct details."
                : "You need at least one approved vehicle to post rides."
              }
            </p>
            
            {rejectedVehicles.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-left max-w-md mx-auto">
                <h3 className="font-semibold text-red-800 mb-2">
                  <i className="fas fa-exclamation-triangle mr-2"></i>Rejected Vehicles
                </h3>
                {rejectedVehicles.map((vehicle, index) => (
                  <div key={vehicle._id || index} className="py-2 border-b border-red-200 last:border-0">
                    <p className="font-medium text-gray-800">
                      {vehicle.make} {vehicle.model}
                    </p>
                    {vehicle.rejectionReason && (
                      <p className="text-sm text-red-600 mt-1">
                        Reason: {vehicle.rejectionReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            <Link
              to="/profile"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition inline-block"
            >
              <i className="fas fa-plus-circle mr-2"></i>Add New Vehicle
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-12 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl shadow-lg p-8 mb-8 text-white">
          <h1 className="text-3xl font-bold mb-2">
            <i className="fas fa-plus-circle mr-3"></i>Post a New Ride
          </h1>
          <p className="opacity-90">Share your journey and earn while helping others travel</p>
        </div>

        {/* Form Placeholder - Will be completed */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {success && <Alert type="success" message={success} />}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Route Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-route text-emerald-500 mr-2"></i>Route Details
              </h2>

              <div className="space-y-4">
                <LocationInput
                  label="Pick-up Location *"
                  placeholder="Enter starting location"
                  icon="fa-map-marker-alt"
                  iconColor="text-green-600"
                  value={formData.origin}
                  onChange={(loc) => setFormData(prev => ({ ...prev, origin: loc }))}
                  required
                />

                <LocationInput
                  label="Drop-off Location *"
                  placeholder="Enter destination"
                  icon="fa-map-marker-alt"
                  iconColor="text-red-600"
                  value={formData.destination}
                  onChange={(loc) => setFormData(prev => ({ ...prev, destination: loc }))}
                  required
                />
              </div>
            </div>

            {/* More sections coming... */}
            {/* Date & Time Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-calendar-alt text-emerald-500 mr-2"></i>Date & Time
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Vehicle & Capacity */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-car text-emerald-500 mr-2"></i>Vehicle & Capacity
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Select Vehicle *</label>
                  <select
                    name="vehicleId"
                    value={formData.vehicleId}
                    onChange={(e) => setFormData(prev => ({ ...prev, vehicleId: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    <option value="">Choose a vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v._id} value={v._id}>
                        {v.make} {v.model} ({v.color}) - {v.licensePlate}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Available Seats *</label>
                  <select
                    name="availableSeats"
                    value={formData.availableSeats}
                    onChange={(e) => setFormData(prev => ({ ...prev, availableSeats: e.target.value }))}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  >
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>{n} seat{n > 1 ? 's' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Pricing Section */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-rupee-sign text-emerald-500 mr-2"></i>Pricing
              </h2>

              {/* Show ContributionCalculator when distance is available */}
              {distance ? (
                <div className="space-y-4">
                  {/* BlaBlaCar-style Contribution Calculator with Interactive Slider */}
                  <ContributionCalculator 
                    distanceKm={parseFloat(distance)} 
                    passengers={parseInt(formData.availableSeats)}
                    onPriceCalculated={(price) => {
                      setPricePerSeat(price);
                    }}
                    showBreakdown={true}
                    allowSlider={true}
                  />

                  {/* Final Price Summary */}
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-green-800 font-medium">
                          <i className="fas fa-check-circle mr-1"></i>
                          Final Price Per Seat
                        </p>
                        <p className="text-xs text-green-600">
                          Adjust using the slider above
                        </p>
                      </div>
                      <div className="text-3xl font-bold text-green-700">
                        {pricePerSeat ? `₹${pricePerSeat}` : '₹ -'}
                      </div>
                    </div>
                    {pricePerSeat && formData.availableSeats && (
                      <div className="mt-3 pt-3 border-t border-green-300 text-sm text-green-700">
                        <i className="fas fa-calculator mr-1"></i>
                        If all {formData.availableSeats} seats booked: You'll receive ₹{pricePerSeat * formData.availableSeats}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500">
                  <i className="fas fa-map-marked-alt text-4xl mb-3"></i>
                  <p className="font-medium">Select pickup and drop-off locations</p>
                  <p className="text-sm">Price will be calculated based on distance</p>
                </div>
              )}
            </div>

            {/* Preferences */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">
                <i className="fas fa-sliders-h text-emerald-500 mr-2"></i>Preferences
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

                {/* Notes */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Additional Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    rows="3"
                    placeholder="Any special instructions for passengers..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4">
              <Link
                to="/dashboard"
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                Cancel
              </Link>
              <Button type="submit" loading={submitting}>
                <i className="fas fa-paper-plane mr-2"></i>Post Ride
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostRide;
