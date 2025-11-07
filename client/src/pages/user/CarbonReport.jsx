import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import { Alert } from '../../components/common';

const CarbonReport = () => {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCarbonReport();
  }, []);

  const fetchCarbonReport = async () => {
    try {
      const response = await userService.getCarbonReport();
      if (response.success) {
        setReport(response.report || response);
      }
    } catch (err) {
      setError(err.message || 'Failed to load carbon report');
    } finally {
      setLoading(false);
    }
  };

  const getBadge = (totalSaved) => {
    if (totalSaved >= 1000) return { emoji: '🌍', name: 'Earth Guardian', color: 'from-green-500 to-teal-500' };
    if (totalSaved >= 500) return { emoji: '🌳', name: 'Forest Protector', color: 'from-green-400 to-emerald-500' };
    if (totalSaved >= 100) return { emoji: '🌱', name: 'Eco Warrior', color: 'from-emerald-400 to-green-500' };
    if (totalSaved >= 50) return { emoji: '🍃', name: 'Green Champion', color: 'from-lime-400 to-green-400' };
    return { emoji: '🌿', name: 'Eco Starter', color: 'from-lime-300 to-green-300' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const badge = getBadge(report?.totalSaved || 0);
  const equivalentTrees = ((report?.totalSaved || 0) / 21).toFixed(1);
  const carsOffRoad = ((report?.totalSaved || 0) / 4600).toFixed(2);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className={`bg-gradient-to-r ${badge.color} rounded-2xl shadow-lg p-8 mb-8 text-white`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center">
                🌍 Carbon Impact Report
              </h1>
              <p className="opacity-90">Your contribution to a greener planet</p>
            </div>
            <div className="text-center">
              <div className="text-6xl mb-2">{badge.emoji}</div>
              <p className="text-lg font-semibold">{badge.name}</p>
            </div>
          </div>
        </div>

        {error && <Alert type="error" message={error} className="mb-6" />}

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🌿</span>
            </div>
            <p className="text-gray-600 text-sm mb-1">Total CO₂ Saved</p>
            <p className="text-4xl font-bold text-emerald-600">
              {(report?.totalSaved || 0).toFixed(1)}
              <span className="text-lg ml-1">kg</span>
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🌳</span>
            </div>
            <p className="text-gray-600 text-sm mb-1">Equivalent Trees</p>
            <p className="text-4xl font-bold text-green-600">{equivalentTrees}</p>
            <p className="text-xs text-gray-500">trees planted for a year</p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🚗</span>
            </div>
            <p className="text-gray-600 text-sm mb-1">Cars Off Road</p>
            <p className="text-4xl font-bold text-blue-600">{carsOffRoad}</p>
            <p className="text-xs text-gray-500">cars for a year</p>
          </div>
        </div>

        {/* Trip Stats */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            📊 Your Green Journey
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-gray-800">{report?.totalTrips || 0}</p>
              <p className="text-sm text-gray-600">Total Trips</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-gray-800">{(report?.totalDistance || 0).toFixed(0)}</p>
              <p className="text-sm text-gray-600">km Traveled</p>
            </div>
            {user?.role === 'RIDER' && (
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <p className="text-3xl font-bold text-gray-800">{report?.passengersHelped || 0}</p>
                <p className="text-sm text-gray-600">Passengers Helped</p>
              </div>
            )}
            <div className="text-center p-4 bg-gray-50 rounded-xl">
              <p className="text-3xl font-bold text-emerald-600">
                {((report?.totalSaved || 0) / Math.max(report?.totalTrips || 1, 1)).toFixed(1)}
              </p>
              <p className="text-sm text-gray-600">kg CO₂ / Trip</p>
            </div>
          </div>
        </div>

        {/* How It's Calculated */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
            🧮 How We Calculate
          </h2>
          <div className="space-y-4 text-gray-700">
            <p>
              <strong>Carbon savings</strong> are calculated based on the difference between driving alone 
              and carpooling. When you share a ride, each passenger saves approximately 
              <strong className="text-emerald-600"> 0.21 kg CO₂ per km</strong>.
            </p>
            <div className="bg-white rounded-lg p-4 space-y-2">
              <p><span className="font-semibold">🌳 1 Tree</span> = Absorbs ~21 kg CO₂ per year</p>
              <p><span className="font-semibold">🚗 1 Car</span> = Emits ~4,600 kg CO₂ per year</p>
              <p><span className="font-semibold">📏 Formula</span> = Distance × Passengers × 0.21 kg CO₂/km</p>
            </div>
          </div>
        </div>

        {/* Share Card */}
        <div className="mt-8 bg-white rounded-2xl shadow-lg p-6 text-center">
          <h3 className="font-semibold text-gray-800 mb-4">Share your impact! 🎉</h3>
          <div className="flex justify-center space-x-4">
            <button className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition">
              🐦 Twitter
            </button>
            <button className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
              📱 WhatsApp
            </button>
            <button className="px-6 py-2 bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition">
              💼 LinkedIn
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CarbonReport;
