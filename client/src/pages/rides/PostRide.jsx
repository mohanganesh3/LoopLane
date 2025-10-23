import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner } from '../../components/common';
import userService from '../../services/userService';

const PostRide = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);

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
          <p className="text-gray-600">Form coming soon...</p>
          <p className="text-sm text-gray-500 mt-2">Vehicles found: {vehicles.length}</p>
        </div>
      </div>
    </div>
  );
};

export default PostRide;
