import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Alert } from '../../components/common';

const AdminSafety = () => {
  const [emergencies, setEmergencies] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    ACTIVE: { count: 0 },
    ACKNOWLEDGED: { count: 0 },
    RESOLVED: { count: 0 },
    CANCELLED: { count: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedEmergency, setSelectedEmergency] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load emergencies
      const endpoint = filter === 'active' ? '/api/sos/admin/active' : '/api/sos/admin/all';
      const [emergencyRes, statsRes] = await Promise.all([
        api.get(endpoint),
        api.get('/api/sos/admin/stats')
      ]);
      
      if (emergencyRes.data.success) {
        setEmergencies(emergencyRes.data.emergencies || []);
      }
      
      if (statsRes.data.success) {
        setStats(statsRes.data.stats || {
          total: 0,
          ACTIVE: { count: 0 },
          ACKNOWLEDGED: { count: 0 },
          RESOLVED: { count: 0 },
          CANCELLED: { count: 0 }
        });
      }
    } catch (err) {
      console.error('Error loading safety data:', err);
      setError(err.response?.data?.message || 'Failed to load safety alerts');
    } finally {
      setLoading(false);
    }
  };

  const updateEmergencyStatus = async (emergencyId, newStatus) => {
    try {
      setUpdating(true);
      setError('');
      
      const response = await api.post(`/api/sos/admin/${emergencyId}/update`, {
        status: newStatus,
        adminNotes: adminNotes
      });
      
      if (response.data.success) {
        setSuccess(`Alert ${newStatus.toLowerCase()} successfully`);
        setSelectedEmergency(null);
        setAdminNotes('');
        loadData();
        
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Error updating emergency:', err);
      setError(err.response?.data?.message || 'Failed to update alert');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      'ACTIVE': 'bg-red-100 text-red-800 animate-pulse',
      'ACKNOWLEDGED': 'bg-yellow-100 text-yellow-800',
      'RESOLVED': 'bg-green-100 text-green-800',
      'CANCELLED': 'bg-gray-100 text-gray-800'
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityBadge = (severity) => {
    const badges = {
      'CRITICAL': 'bg-red-600 text-white',
      'HIGH': 'bg-orange-500 text-white',
      'MODERATE': 'bg-yellow-500 text-white',
      'LOW': 'bg-blue-500 text-white'
    };
    return badges[severity] || 'bg-gray-500 text-white';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getUserName = (user) => {
    if (!user) return 'Unknown';
    if (user.profile?.firstName) {
      return `${user.profile.firstName} ${user.profile.lastName || ''}`.trim();
    }
    return user.email?.split('@')[0] || 'Unknown';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Safety Alerts
              </h1>
              <p className="text-gray-500 text-sm">Manage emergency and safety alerts</p>
            </div>
            <Link to="/admin" className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && <Alert type="error" message={error} className="mb-6" />}
        {success && <Alert type="success" message={success} className="mb-6" />}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Alerts</p>
                <p className="text-2xl font-bold text-red-600">{stats.ACTIVE?.count || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Acknowledged</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.ACKNOWLEDGED?.count || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Resolved</p>
                <p className="text-2xl font-bold text-green-600">{stats.RESOLVED?.count || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Alerts</p>
                <p className="text-2xl font-bold text-gray-600">{stats.total || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setFilter('active')}
              className={`flex-1 py-3 px-4 text-center font-medium transition ${
                filter === 'active' 
                  ? 'text-red-600 border-b-2 border-red-600 bg-red-50' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Active Alerts ({(stats.ACTIVE?.count || 0) + (stats.ACKNOWLEDGED?.count || 0)})
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-3 px-4 text-center font-medium transition ${
                filter === 'all' 
                  ? 'text-gray-900 border-b-2 border-gray-900' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              All Alerts ({stats.total || 0})
            </button>
          </div>
        </div>

        {/* Emergencies List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {emergencies.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Safety Alerts</h3>
              <p className="text-gray-500">
                {filter === 'active' ? 'No active safety alerts at the moment' : 'No safety alerts found'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {emergencies.map((emergency) => (
                <div 
                  key={emergency._id} 
                  className={`p-4 hover:bg-gray-50 transition ${
                    emergency.status === 'ACTIVE' ? 'bg-red-50 border-l-4 border-red-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(emergency.status)}`}>
                          {emergency.status}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityBadge(emergency.severity)}`}>
                          {emergency.severity}
                        </span>
                        <span className="text-xs text-gray-500">
                          {emergency.type}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          {getUserName(emergency.user)}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          {emergency.user?.email || 'N/A'}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {emergency.user?.phone || 'N/A'}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-500 mb-2">
                        <span className="font-medium">Location:</span> {emergency.location?.address || 'Unknown'}
                      </p>
                      
                      {emergency.location?.coordinates?.coordinates && (
                        <a 
                          href={`https://www.google.com/maps?q=${emergency.location.coordinates.coordinates[1]},${emergency.location.coordinates.coordinates[0]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          View on Map
                        </a>
                      )}
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Triggered: {formatDate(emergency.triggeredAt)}</span>
                        {emergency.acknowledgedAt && (
                          <span>Acknowledged: {formatDate(emergency.acknowledgedAt)}</span>
                        )}
                        {emergency.resolvedAt && (
                          <span>Resolved: {formatDate(emergency.resolvedAt)}</span>
                        )}
                      </div>
                      
                      {emergency.adminNotes && (
                        <p className="text-sm text-gray-600 mt-2 bg-gray-100 p-2 rounded">
                          <span className="font-medium">Notes:</span> {emergency.adminNotes}
                        </p>
                      )}
                      
                      {/* Emergency Contacts */}
                      {emergency.contacts && emergency.contacts.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-gray-600 mb-1">Notified Contacts:</p>
                          <div className="flex flex-wrap gap-2">
                            {emergency.contacts.map((contact, idx) => (
                              <span key={idx} className="text-xs bg-gray-100 px-2 py-1 rounded">
                                {contact.name} ({contact.email || contact.phone})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex flex-col gap-2 ml-4">
                      {emergency.status === 'ACTIVE' && (
                        <button
                          onClick={() => setSelectedEmergency({ ...emergency, newStatus: 'ACKNOWLEDGED' })}
                          className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 transition"
                        >
                          Acknowledge
                        </button>
                      )}
                      {(emergency.status === 'ACTIVE' || emergency.status === 'ACKNOWLEDGED') && (
                        <button
                          onClick={() => setSelectedEmergency({ ...emergency, newStatus: 'RESOLVED' })}
                          className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 transition"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Update Modal */}
      {selectedEmergency && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">
              {selectedEmergency.newStatus === 'ACKNOWLEDGED' ? 'Acknowledge Alert' : 'Resolve Alert'}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes (Optional)</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add any notes about this alert..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                rows={3}
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedEmergency(null);
                  setAdminNotes('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                disabled={updating}
              >
                Cancel
              </button>
              <button
                onClick={() => updateEmergencyStatus(selectedEmergency._id, selectedEmergency.newStatus)}
                className={`flex-1 px-4 py-2 text-white rounded-lg transition ${
                  selectedEmergency.newStatus === 'ACKNOWLEDGED' 
                    ? 'bg-yellow-500 hover:bg-yellow-600' 
                    : 'bg-green-500 hover:bg-green-600'
                }`}
                disabled={updating}
              >
                {updating ? 'Updating...' : selectedEmergency.newStatus === 'ACKNOWLEDGED' ? 'Acknowledge' : 'Resolve'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSafety;
