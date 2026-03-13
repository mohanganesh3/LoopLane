/**
 * RouteSuggestions — Driver-facing demand intelligence
 * Backend: getRouteSuggestions (personalized route suggestions based on demand)
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import userService from '../../services/userService';
import Layout from '../../components/layout/Layout';

const RouteSuggestions = () => {
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      setLoading(true);
      const res = await userService.getRouteSuggestions();
      setSuggestions(res?.suggestions || res?.routes || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load route suggestions');
      console.error('[RouteSuggestions] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getDemandColor = (level) => {
    if (level === 'HIGH' || level === 'high') return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-100', icon: 'fa-fire' };
    if (level === 'MEDIUM' || level === 'medium') return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100', icon: 'fa-chart-line' };
    return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100', icon: 'fa-leaf' };
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: '"Instrument Serif", serif' }}>
            Route Intelligence
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Personalised high-demand route suggestions — maximize your earnings
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Tip Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-2xl p-5 mb-6 text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <i className="fas fa-lightbulb text-lg" />
            </div>
            <div>
              <p className="font-semibold text-sm">Smart Route Tip</p>
              <p className="text-emerald-100 text-xs mt-0.5">
                Routes are ranked by demand in your area. Post a ride on a high-demand route to get bookings faster.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Suggestions */}
        <div className="space-y-3">
          {suggestions.map((route, i) => {
            const demand = getDemandColor(route.demandLevel || route.demand);
            return (
              <motion.div
                key={route._id || i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-gray-100 p-5"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${demand.bg} ${demand.text}`}>
                    <i className={`fas ${demand.icon}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                      <span>{route.origin || route.from}</span>
                      <i className="fas fa-long-arrow-alt-right text-xs text-gray-400" />
                      <span>{route.destination || route.to}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      {route.distance && (
                        <span><i className="fas fa-road mr-1" />{route.distance} km</span>
                      )}
                      {(route.avgFare || route.suggestedFare) && (
                        <span><i className="fas fa-rupee-sign mr-1" />Avg fare ₹{route.avgFare || route.suggestedFare}</span>
                      )}
                      {route.searchCount && (
                        <span><i className="fas fa-search mr-1" />{route.searchCount} searches</span>
                      )}
                      {route.unbookedCount && (
                        <span><i className="fas fa-exclamation-circle mr-1 text-amber-500" />{route.unbookedCount} unserved</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${demand.bg} ${demand.text} ${demand.border} border`}>
                      {(route.demandLevel || route.demand || 'medium').toUpperCase()}
                    </span>
                    <Link
                      to={`/post-ride?from=${encodeURIComponent(route.origin || route.from || '')}&to=${encodeURIComponent(route.destination || route.to || '')}`}
                      className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition"
                    >
                      Post Ride →
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {suggestions.length === 0 && !error && (
          <div className="text-center py-16 text-gray-400">
            <i className="fas fa-route text-4xl mb-4 block" />
            <p className="font-medium text-gray-600 mb-1">No suggestions available yet</p>
            <p className="text-sm">Route suggestions are generated based on search demand in your area. Check back later!</p>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            onClick={loadSuggestions}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
          >
            <i className={`fas fa-sync-alt text-xs ${loading ? 'animate-spin' : ''}`} />
            Refresh Suggestions
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default RouteSuggestions;
