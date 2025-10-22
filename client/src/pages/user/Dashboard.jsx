import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card, LoadingSpinner, Badge } from '../../components/common';
import userService from '../../services/userService';

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRides: 0,
    totalBookings: 0,
    completedRides: 0,
    completedBookings: 0,
    totalEarnings: 0,
    totalSpent: 0,
    rating: 0
  });
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [carbonReport, setCarbonReport] = useState({
    totalSaved: 0,
    badge: { emoji: '🌱', name: 'Eco Starter' },
    equivalentTrees: 0,
    totalTrips: 0,
    totalPassengersHelped: 0
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const data = await userService.getDashboard();
      if (data.stats) setStats(data.stats);
      if (data.upcomingTrips) setUpcomingTrips(data.upcomingTrips);
      if (data.carbonReport) setCarbonReport(data.carbonReport);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isRider = user?.role === 'RIDER';

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      if (i <= Math.floor(rating)) {
        stars.push(<i key={i} className="fas fa-star text-yellow-400"></i>);
      } else if (i - 0.5 <= rating) {
        stars.push(<i key={i} className="fas fa-star-half-alt text-yellow-400"></i>);
      } else {
        stars.push(<i key={i} className="far fa-star text-yellow-400"></i>);
      }
    }
    return stars;
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading dashboard..." />;
  }

  return (
    <div className="pt-20 pb-12 bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl shadow-lg p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">
                Welcome back, {user?.name || 'User'}! 👋
              </h1>
              <p className="opacity-90">
                {isRider ? 'Ready to share your ride?' : 'Ready to find your next ride?'}
              </p>
            </div>
            <div className="hidden md:block">
              {isRider ? (
                <Link
                  to="/rides/post"
                  className="bg-white text-emerald-500 hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition"
                >
                  <i className="fas fa-plus-circle mr-2"></i> Post New Ride
                </Link>
              ) : (
                <Link
                  to="/rides/search"
                  className="bg-white text-emerald-500 hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold transition"
                >
                  <i className="fas fa-search mr-2"></i> Find Rides
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Stat Card 1 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">
                  {isRider ? 'Total Rides' : 'Total Bookings'}
                </p>
                <p className="text-3xl font-bold text-gray-800">
                  {isRider ? stats.totalRides : stats.totalBookings}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <i className="fas fa-route text-blue-600 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Stat Card 2 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Completed</p>
                <p className="text-3xl font-bold text-gray-800">
                  {isRider ? stats.completedRides : stats.completedBookings}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <i className="fas fa-check-circle text-green-600 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Stat Card 3 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">
                  {isRider ? 'Earnings' : 'Spent'}
                </p>
                <p className="text-3xl font-bold text-gray-800">
                  ₹{(isRider ? stats.totalEarnings : stats.totalSpent).toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <i className="fas fa-wallet text-yellow-600 text-xl"></i>
              </div>
            </div>
          </div>

          {/* Stat Card 4 */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Rating</p>
                <div className="flex items-center">
                  <p className="text-3xl font-bold text-gray-800 mr-2">
                    {stats.rating.toFixed(1)}
                  </p>
                  <div className="flex">{renderStars(stats.rating)}</div>
                </div>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <i className="fas fa-star text-purple-600 text-xl"></i>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Trips */}
          <div className="lg:col-span-2">
            <Card
              title={isRider ? 'Upcoming Rides' : 'Upcoming Bookings'}
              headerAction={
                <Link
                  to={isRider ? '/rides/my-rides' : '/bookings'}
                  className="text-emerald-500 hover:text-emerald-600 text-sm font-semibold"
                >
                  View All <i className="fas fa-arrow-right ml-1"></i>
                </Link>
              }
            >
              {upcomingTrips.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-calendar-times text-gray-300 text-6xl mb-4"></i>
                  <p className="text-gray-600 mb-4">No upcoming trips</p>
                  <Link
                    to={isRider ? '/rides/post' : '/rides/search'}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg transition inline-block"
                  >
                    {isRider ? 'Post a Ride' : 'Find Rides'}
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingTrips.slice(0, 3).map((trip) => {
                    const ride = isRider ? trip : trip.ride;
                    return (
                      <div
                        key={trip._id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <Badge variant="success" dot>Active</Badge>
                              <span className="text-sm text-gray-500">
                                {formatDate(ride.departureTime)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="text-lg font-bold text-gray-800">
                                {ride.origin?.city || 'Origin'}
                              </div>
                              <i className="fas fa-arrow-right text-emerald-500"></i>
                              <div className="text-lg font-bold text-gray-800">
                                {ride.destination?.city || 'Destination'}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>
                                <i className="fas fa-clock mr-1"></i>
                                {formatTime(ride.departureTime)}
                              </span>
                              {isRider ? (
                                <span>
                                  <i className="fas fa-users mr-1"></i>
                                  {ride.bookings?.length || 0} passengers
                                </span>
                              ) : (
                                <span>
                                  <i className="fas fa-user mr-1"></i>
                                  {trip.seats} seat(s)
                                </span>
                              )}
                            </div>
                          </div>
                          <Link
                            to={isRider ? `/rides/${ride._id}` : `/bookings/${trip._id}`}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg transition text-sm"
                          >
                            View Details
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Carbon Footprint */}
            <div className="bg-gradient-to-br from-green-50 to-teal-50 rounded-xl shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <i className="fas fa-leaf text-green-600 mr-2"></i>
                Carbon Impact
              </h3>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  {carbonReport.totalSaved.toFixed(1)} kg
                </div>
                <p className="text-sm text-gray-600">CO₂ Saved</p>
              </div>
              <div className="bg-white rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Your Badge</span>
                  <span className="text-3xl">{carbonReport.badge.emoji}</span>
                </div>
                <p className="text-sm font-semibold text-gray-800">
                  {carbonReport.badge.name}
                </p>
                <div className="border-t pt-3 space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>🌳 Trees Equivalent</span>
                    <strong>{carbonReport.equivalentTrees}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>🚗 Total Trips</span>
                    <strong>{carbonReport.totalTrips}</strong>
                  </div>
                  {isRider && carbonReport.totalPassengersHelped > 0 && (
                    <div className="flex justify-between">
                      <span>👥 Passengers Helped</span>
                      <strong>{carbonReport.totalPassengersHelped}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <Card title="Quick Actions">
              <div className="space-y-3">
                <Link
                  to="/user/profile"
                  className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition"
                >
                  <i className="fas fa-user text-emerald-500 mr-3"></i>
                  <span className="text-gray-700">Edit Profile</span>
                </Link>
                <Link
                  to="/user/trip-history"
                  className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition"
                >
                  <i className="fas fa-history text-emerald-500 mr-3"></i>
                  <span className="text-gray-700">Trip History</span>
                </Link>
                <Link
                  to="/chat"
                  className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition"
                >
                  <i className="fas fa-comments text-emerald-500 mr-3"></i>
                  <span className="text-gray-700">Messages</span>
                </Link>
                <Link
                  to="/user/settings"
                  className="flex items-center p-3 hover:bg-gray-50 rounded-lg transition"
                >
                  <i className="fas fa-cog text-emerald-500 mr-3"></i>
                  <span className="text-gray-700">Settings</span>
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
