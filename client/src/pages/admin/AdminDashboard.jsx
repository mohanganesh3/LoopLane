import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeRides: 0,
    completedRides: 0,
    pendingVerifications: 0,
    totalRevenue: 0,
    todayBookings: 0
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await adminService.getDashboardStats();
      if (response.success) {
        setStats(response.stats);
        setRecentActivities(response.recentActivities || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: '👥', color: 'blue', link: '/admin/users' },
    { label: 'Active Rides', value: stats.activeRides, icon: '🚗', color: 'emerald', link: '/admin/rides' },
    { label: 'Completed Rides', value: stats.completedRides, icon: '✅', color: 'green', link: '/admin/rides?status=completed' },
    { label: 'Pending Verifications', value: stats.pendingVerifications, icon: '📋', color: 'yellow', link: '/admin/verifications' },
    { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: '💰', color: 'purple', link: '/admin/revenue' },
    { label: 'Today\'s Bookings', value: stats.todayBookings, icon: '📅', color: 'orange', link: '/admin/bookings' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
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
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-500 text-sm">Welcome back, Admin</p>
            </div>
            <div className="flex space-x-4">
              <button className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Export Data
              </button>
              <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition">
                Generate Report
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {error && <Alert type="error" message={error} className="mb-6" />}

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <Link
              key={index}
              to={stat.link}
              className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className={`text-3xl font-bold mt-1 text-${stat.color}-600`}>{stat.value}</p>
                </div>
                <div className={`w-14 h-14 rounded-full bg-${stat.color}-100 flex items-center justify-center text-2xl group-hover:scale-110 transition`}>
                  {stat.icon}
                </div>
              </div>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <Link to="/admin/users" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-center">
                <div className="text-2xl mb-2">👥</div>
                <p className="font-medium text-gray-900">Manage Users</p>
              </Link>
              <Link to="/admin/rides" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-center">
                <div className="text-2xl mb-2">🚗</div>
                <p className="font-medium text-gray-900">Manage Rides</p>
              </Link>
              <Link to="/admin/bookings" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-center">
                <div className="text-2xl mb-2">📋</div>
                <p className="font-medium text-gray-900">Bookings</p>
              </Link>
              <Link to="/admin/reports" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-center">
                <div className="text-2xl mb-2">📊</div>
                <p className="font-medium text-gray-900">Reports</p>
              </Link>
            </div>
          </div>

          {/* Recent Activities */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activities</h2>
            <div className="space-y-4">
              {recentActivities.length > 0 ? (
                recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-start p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mr-3">
                      <span className="text-lg">{activity.icon || '📌'}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{activity.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No recent activities</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
