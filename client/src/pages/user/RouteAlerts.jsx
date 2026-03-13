/**
 * RouteAlerts — Manage "Notify me when a ride is posted on this route" alerts
 * Backend: getRouteAlerts, createRouteAlert, deleteRouteAlert
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import userService from '../../services/userService';
import Layout from '../../components/layout/Layout';

const RouteAlerts = () => {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ from: '', to: '', days: [] });
  const [error, setError] = useState('');

  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const res = await userService.getRouteAlerts();
      setAlerts(res?.alerts || res?.routeAlerts || []);
    } catch (err) {
      console.error('[RouteAlerts] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.from.trim() || !form.to.trim()) {
      setError('Both origin and destination are required.');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await userService.createRouteAlert({
        origin: form.from,
        destination: form.to,
        preferredDays: form.days,
      });
      setForm({ from: '', to: '', days: [] });
      setShowCreate(false);
      await loadAlerts();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create alert');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (alertId) => {
    try {
      await userService.deleteRouteAlert(alertId);
      setAlerts(prev => prev.filter(a => a._id !== alertId));
    } catch (err) {
      console.error('[RouteAlerts] Delete error:', err);
    }
  };

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day]
    }));
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: '"Instrument Serif", serif' }}>
              Route Alerts
            </h1>
            <p className="text-gray-500 text-sm mt-1">Get notified when rides are posted on your preferred routes</p>
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition"
          >
            <i className="fas fa-plus text-xs" />
            New Alert
          </button>
        </div>

        {/* Create Form */}
        <AnimatePresence>
          {showCreate && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleCreate}
              className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 overflow-hidden"
            >
              <h2 className="font-semibold text-gray-800 mb-4">Create Route Alert</h2>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">From (Origin)</label>
                  <input
                    type="text"
                    value={form.from}
                    onChange={(e) => setForm(prev => ({ ...prev, from: e.target.value }))}
                    placeholder="e.g., Koramangala, Bangalore"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">To (Destination)</label>
                  <input
                    type="text"
                    value={form.to}
                    onChange={(e) => setForm(prev => ({ ...prev, to: e.target.value }))}
                    placeholder="e.g., Whitefield, Bangalore"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Preferred Days (optional)</label>
                  <div className="flex gap-2 flex-wrap">
                    {DAYS.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                          form.days.includes(day)
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setError(''); }}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-sm text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Alert'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Alerts List */}
        <div className="space-y-3">
          <AnimatePresence>
            {alerts.map((alert) => (
              <motion.div
                key={alert._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="bg-white rounded-2xl border border-gray-100 p-5 flex items-center gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <i className="fas fa-bell" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <span>{alert.origin || alert.from}</span>
                    <i className="fas fa-arrow-right text-xs text-gray-400" />
                    <span>{alert.destination || alert.to}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {alert.preferredDays?.length > 0 ? (
                      <span className="text-xs text-gray-500">
                        {alert.preferredDays.join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">All days</span>
                    )}
                    <span className="text-xs text-gray-300">•</span>
                    <span className="text-xs text-gray-400">
                      {alert.matchCount ?? 0} matches found
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(alert._id)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                  title="Delete alert"
                >
                  <i className="fas fa-trash-alt text-xs" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {alerts.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <i className="fas fa-bell-slash text-4xl mb-4 block" />
              <p className="font-medium text-gray-600 mb-1">No route alerts yet</p>
              <p className="text-sm">Create an alert to get notified when carpools are posted on your preferred routes.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default RouteAlerts;
