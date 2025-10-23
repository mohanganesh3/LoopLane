import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner, Alert } from '../../components/common';
import LocationInput from '../../components/common/LocationInput';
import userService from '../../services/userService';

const PostRide = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    origin: null,
    destination: null,
    date: '',
    time: '',
    vehicleId: '',
    availableSeats: 4,
    totalRidePrice: '',
    instantBooking: true,
    ladiesOnly: false,
    notes: ''
  });

  const [stops, setStops] = useState([]);
  const [distance, setDistance] = useState(null);
  const [predictedPrice, setPredictedPrice] = useState(null);
  const [pricePerSeat, setPricePerSeat] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      const data = await userService.getProfile();
      const approvedVehicles = (data.user?.vehicles || []).filter(v => v.status === 'APPROVED');
      setVehicles(approvedVehicles);
    } catch (err) {
      console.error('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading..." />;
  }

  if (vehicles.length === 0) {
    return (
      <div className="pt-20 pb-12 bg-gray-50 min-h-screen">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <i className="fas fa-car text-gray-300 text-6xl mb-4"></i>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Approved Vehicles</h2>
            <p className="text-gray-600 mb-6">
              You need at least one approved vehicle to post rides.
            </p>
            <Link
              to="/user/profile"
              className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition inline-block"
            >
              <i className="fas fa-plus-circle mr-2"></i>Add Vehicle
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-20 pb-12 bg-gray-50 min-h-screen">
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

          <form className="space-y-6">
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

                {/* Stops */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <i className="fas fa-map-signs text-emerald-500 mr-2"></i>
                    Stops Along the Way (Optional)
                  </label>
                  <div className="space-y-2">
                    {stops.map((stop, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="flex-1">
                          <LocationInput
                            placeholder="Stop location"
                            icon="fa-map-marker"
                            value={stop.location}
                            onChange={(loc) => {
                              const newStops = [...stops];
                              newStops[index].location = loc;
                              setStops(newStops);
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setStops(stops.filter((_, i) => i !== index))}
                          className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition h-fit mt-8"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStops([...stops, { location: null }])}
                    className="mt-2 text-emerald-500 hover:text-emerald-700 font-semibold text-sm"
                  >
                    <i className="fas fa-plus-circle mr-1"></i>Add Stop
                  </button>
                </div>
              </div>
            </div>

            {/* More sections coming... */}
            <p className="text-gray-500 text-sm">More form sections coming...</p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostRide;
