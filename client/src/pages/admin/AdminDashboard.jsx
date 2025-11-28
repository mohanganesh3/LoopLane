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
    let isMounted = true;
    
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await adminService.getDashboardStats();
        if (isMounted) {
          if (response && response.success) {
            setStats(response.stats || {
              totalUsers: 0,
              activeRides: 0,
              completedRides: 0,
              pendingVerifications: 0,
              totalRevenue: 0,
              todayBookings: 0
            });
            setRecentActivities(response.recentActivities || []);
          } else {
            setError('Failed to load dashboard data');
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error('Dashboard load error:', err);
          // Don't show error for auth issues - let the route guard handle it
          if (err.response?.status !== 401 && err.response?.status !== 403) {
            setError(err.response?.data?.message || err.message || 'Failed to load dashboard');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminService.getDashboardStats();
      if (response && response.success) {
        setStats(response.stats || {
          totalUsers: 0,
          activeRides: 0,
          completedRides: 0,
          pendingVerifications: 0,
          totalRevenue: 0,
          todayBookings: 0
        });
        setRecentActivities(response.recentActivities || []);
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError(err.response?.data?.message || err.message || 'Failed to load dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: <i className="fas fa-users"></i>, color: 'blue', link: '/admin/users' },
    { label: 'Active Rides', value: stats.activeRides, icon: <i className="fas fa-car"></i>, color: 'emerald', link: '/admin/rides' },
    { label: 'Completed Rides', value: stats.completedRides, icon: <i className="fas fa-check-circle"></i>, color: 'green', link: '/admin/rides?status=completed' },
    { label: 'Pending Verifications', value: stats.pendingVerifications, icon: <i className="fas fa-clipboard-list"></i>, color: 'yellow', link: '/admin/verifications' },
    { label: 'Total Revenue', value: `₹${stats.totalRevenue.toLocaleString()}`, icon: <i className="fas fa-money-bill-wave"></i>, color: 'purple', link: '/admin/bookings' },
    { label: 'Today\'s Bookings', value: stats.todayBookings, icon: <i className="fas fa-calendar-day"></i>, color: 'orange', link: '/admin/bookings' }
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
                <div className="text-2xl mb-2"><i className="fas fa-users text-blue-500"></i></div>
                <p className="font-medium text-gray-900">Manage Users</p>
              </Link>
              <Link to="/admin/rides" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-center">
                <div className="text-2xl mb-2"><i className="fas fa-car text-emerald-500"></i></div>
                <p className="font-medium text-gray-900">Manage Rides</p>
              </Link>
              <Link to="/admin/bookings" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-center">
                <div className="text-2xl mb-2"><i className="fas fa-clipboard-list text-yellow-500"></i></div>
                <p className="font-medium text-gray-900">Bookings</p>
              </Link>
              <Link to="/admin/safety" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-center">
                <div className="text-2xl mb-2"><i className="fas fa-exclamation-triangle text-red-500"></i></div>
                <p className="font-medium text-gray-900">Safety Alerts</p>
              </Link>
              <Link to="/admin/verifications" className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-center">
                <div className="text-2xl mb-2"><i className="fas fa-id-card text-orange-500"></i></div>
                <p className="font-medium text-gray-900">Verifications</p>
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
                      <span className="text-lg">{activity.icon || <i className="fas fa-thumbtack"></i>}</span>
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
