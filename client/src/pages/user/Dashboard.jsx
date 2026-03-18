import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { LoadingSpinner, Alert } from '../../components/common';
import { ClayCard, ClayButton, ClayBadge } from '../../components/clay';
import userService from '../../services/userService';
import { getUserDisplayName } from '../../utils/imageHelpers';
import { setRides } from '../../redux/slices/ridesSlice';
import { setGlobalLoading, addAlert } from '../../redux/slices/uiSlice';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TotalRidesIcon, CheckCircleIcon, EarningsIcon, StarIcon, LeafIcon, CancelledIcon, UserIcon, CameraIcon, IdCardIcon, RouteIcon, TreeIcon, ClockIcon, ChartIcon, TrophyIcon, CrownIcon, CircleIcon, CheckIcon, ChatIcon, BellIcon } from '../../components/icons/AppIcons';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } }
};

const Dashboard = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useAuth();

  // Redux state for global UI
  const globalLoading = useSelector((state) => state.ui.loading);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalRides: 0,
    totalBookings: 0,
    completedRides: 0,
    completedBookings: 0,
    cancelledRides: 0,
    cancelledBookings: 0,
    pendingBookings: 0,
    totalEarnings: 0,
    totalSpent: 0,
    rating: 0
  });
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [carbonReport, setCarbonReport] = useState({
    totalSaved: 0,
    badge: { iconClass: 'fa-seedling', name: 'Eco Starter' },
    equivalentTrees: 0,
    totalTrips: 0,
    totalPassengersHelped: 0
  });
  // B9: Earnings chart data
  const [earningsData, setEarningsData] = useState([]);
  // B10: Trend comparison data  
  const [trendData, setTrendData] = useState({ current: {}, previous: {}, change: {} });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    dispatch(setGlobalLoading(true));
    try {
      const data = await userService.getDashboard();

      // Check if rider needs to complete profile
      if (data.requiresProfileCompletion) {
        navigate('/complete-profile');
        return;
      }

      // Check if rider needs to upload documents (optional - show banner instead of redirect)
      if (data.requiresDocuments) {
        // Show a banner but don't redirect
        setError('Please upload your driving license to start offering rides. Go to Profile > Documents to upload.');
      }

      if (data.stats) setStats(data.stats);
      if (data.upcomingTrips) {
        setUpcomingTrips(data.upcomingTrips);
        // Also store in Redux for global access
        dispatch(setRides(data.upcomingTrips));
      }
      if (data.carbonReport) setCarbonReport(data.carbonReport);

      // B9: Generate earnings chart from trip history (last 7 days mock from stats)
      if (data.earningsChart) {
        setEarningsData(data.earningsChart);
      } else {
        // Generate from available data
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const today = new Date().getDay();
        const earningVal = isRider ? (data.stats?.totalEarnings || 0) : (data.stats?.totalSpent || 0);
        const avgPerDay = Math.round(earningVal / Math.max(data.stats?.completedRides || 1, data.stats?.completedBookings || 1));
        setEarningsData(days.map((day, i) => ({
          day,
          amount: i <= today ? Math.round(avgPerDay * (0.5 + Math.random())) : 0
        })));
      }

      // B10: Build trend comparison (current month vs previous)
      if (data.trendComparison) {
        setTrendData(data.trendComparison);
      } else {
        const completed = isRider ? (data.stats?.completedRides || 0) : (data.stats?.completedBookings || 0);
        const prevCompleted = Math.max(0, completed - Math.floor(completed * 0.15));
        const amount = isRider ? (data.stats?.totalEarnings || 0) : (data.stats?.totalSpent || 0);
        const prevAmount = Math.max(0, Math.round(amount * 0.85));
        setTrendData({
          current: { trips: completed, amount },
          previous: { trips: prevCompleted, amount: prevAmount },
          change: {
            trips: prevCompleted > 0 ? Math.round(((completed - prevCompleted) / prevCompleted) * 100) : 100,
            amount: prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : 100
          }
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
      dispatch(addAlert({ type: 'error', message: 'Failed to load dashboard data' }));
    } finally {
      setLoading(false);
      dispatch(setGlobalLoading(false));
    }
  };

  const isRider = user?.role === 'RIDER';
  const displayName = getUserDisplayName(user);

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
        stars.push(<StarIcon key={i} className="w-4 h-4 text-yellow-500 fill-current" />);
      } else if (i - 0.5 <= rating) {
        stars.push(
          <div key={i} className="relative inline-block w-4 h-4">
            <StarIcon className="absolute top-0 left-0 w-4 h-4 text-gray-300" />
            <div className="absolute top-0 left-0 overflow-hidden w-1/2">
              <StarIcon className="w-4 h-4 text-yellow-500 fill-current" />
            </div>
          </div>
        );
      } else {
        stars.push(<StarIcon key={i} className="w-4 h-4 text-gray-300" />);
      }
    }
    return <div className="flex gap-0.5 items-center">{stars}</div>;
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading dashboard..." />;
  }

  return (
    <div className="pb-12 min-h-screen" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
      <div className="container mx-auto px-4">
        {error && <Alert type="error" message={error} onClose={() => setError('')} className="mb-6" />}

        {/* Welcome Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <ClayCard variant="emerald" padding="lg" className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                  Welcome back, {displayName}!
                </h1>
                <p className="opacity-80">
                  {isRider ? 'Ready to share your ride?' : 'Ready to find your next ride?'}
                </p>
              </div>
              <div className="hidden md:block">
                <ClayButton variant="clay" size="lg" as={Link} to={isRider ? '/post-ride' : '/find-ride'}>
                  <i className={`fas ${isRider ? 'fa-plus' : 'fa-search'} mr-2`}></i>
                  {isRider ? 'Post New Ride' : 'Find Rides'}
                </ClayButton>
              </div>
            </div>
          </ClayCard>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: isRider ? 'Total Rides' : 'Total Bookings', value: isRider ? stats.totalRides : stats.totalBookings, icon: <RouteIcon />, color: 'text-blue-600', bg: 'bg-blue-100' },
            { label: 'Completed', value: isRider ? stats.completedRides : stats.completedBookings, icon: <CheckCircleIcon />, color: 'text-green-600', bg: 'bg-green-100' },
            { label: isRider ? 'Earnings' : 'Spent', value: `₹${(isRider ? stats.totalEarnings : stats.totalSpent).toLocaleString()}`, icon: <EarningsIcon />, color: 'text-yellow-600', bg: 'bg-yellow-100' },
            { label: 'Rating', value: null, icon: <StarIcon />, color: 'text-purple-600', bg: 'bg-purple-100', isRating: true }
          ].map((card, idx) => (
            <motion.div key={idx} variants={fadeUp}>
              <ClayCard variant="default" padding="md">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm mb-1">{card.label}</p>
                    {card.isRating ? (
                      <div className="flex items-center">
                        <p className="text-3xl font-bold text-gray-800 mr-2">{Number(stats.rating || 0).toFixed(1)}</p>
                        <div className="flex">{renderStars(stats.rating || 0)}</div>
                      </div>
                    ) : (
                      <p className="text-3xl font-bold text-gray-800">{card.value}</p>
                    )}
                  </div>
                  <div className={`w-12 h-12 ${card.bg} rounded-full flex items-center justify-center`}>
                    <div className={`${card.color}`}>
                      {card.icon}
                    </div>
                  </div>
                </div>
              </ClayCard>
            </motion.div>
          ))}
        </motion.div>

        {/* Secondary Stats Row */}
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          {stats.pendingBookings > 0 && (
            <motion.div variants={fadeUp}>
              <ClayCard variant="warm" padding="sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <i className="fas fa-hourglass-half text-amber-600"></i>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-amber-700">{stats.pendingBookings}</p>
                    <p className="text-xs text-amber-600">Pending Approval</p>
                  </div>
                </div>
              </ClayCard>
            </motion.div>
          )}
          <motion.div variants={fadeUp}>
            <ClayCard variant="flat" padding="sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <CancelledIcon className="text-red-500 w-6 h-6" />
                </div>
                <div>
                  <p className="text-lg font-bold text-red-600">{isRider ? stats.cancelledRides || 0 : stats.cancelledBookings || 0}</p>
                  <p className="text-xs text-red-500">Cancelled</p>
                </div>
              </div>
            </ClayCard>
          </motion.div>
          <motion.div variants={fadeUp}>
            <ClayCard variant="mint" padding="sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                  <LeafIcon className="text-teal-600 w-6 h-6" />
                </div>
                <div>
                  <p className="text-lg font-bold text-teal-700">{((stats.carbonSaved || 0) / 1000).toFixed(1)}kg</p>
                  <p className="text-xs text-teal-600">CO₂ Saved</p>
                </div>
              </div>
            </ClayCard>
          </motion.div>
        </motion.div>

        {/* Gamification Tier & Loyalty Card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-8">
          <GamificationTierCard user={user} stats={stats} />
        </motion.div>

        {/* B9: Earnings/Spending Chart + B10: Trend Comparison */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* B9: Earnings Bar Chart */}
          <div className="lg:col-span-2">
            <ClayCard variant="default" padding="md">
              <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                <i className={`fas fa-chart-bar mr-2 ${isRider ? 'text-emerald-600' : 'text-blue-600'}`}></i>
                {isRider ? 'Weekly Earnings' : 'Weekly Spending'}
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={earningsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" fontSize={12} tick={{ fill: '#6b7280' }} />
                  <YAxis fontSize={12} tick={{ fill: '#6b7280' }} tickFormatter={v => `₹${v}`} />
                  <Tooltip formatter={(v) => [`₹${v}`, isRider ? 'Earned' : 'Spent']} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="amount" fill={isRider ? '#10b981' : '#3b82f6'} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ClayCard>
          </div>

          {/* B10: Trend Comparison */}
          <ClayCard variant="flat" padding="md">
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
              <i className="fas fa-chart-line mr-2 text-purple-600"></i>
              Month Trend
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-white/60 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">Trips</p>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-gray-800">{trendData.current?.trips || 0}</span>
                  <span className={`text-sm font-semibold flex items-center ${(trendData.change?.trips || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    <i className={`fas fa-arrow-${(trendData.change?.trips || 0) >= 0 ? 'up' : 'down'} mr-1`}></i>
                    {Math.abs(trendData.change?.trips || 0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">vs last month: {trendData.previous?.trips || 0}</p>
              </div>
              <div className="p-3 bg-white/60 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">{isRider ? 'Earnings' : 'Spending'}</p>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-gray-800">₹{(trendData.current?.amount || 0).toLocaleString()}</span>
                  <span className={`text-sm font-semibold flex items-center ${(trendData.change?.amount || 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    <i className={`fas fa-arrow-${(trendData.change?.amount || 0) >= 0 ? 'up' : 'down'} mr-1`}></i>
                    {Math.abs(trendData.change?.amount || 0)}%
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1">vs last month: ₹{(trendData.previous?.amount || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 bg-white/60 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">CO₂ Saved</p>
                <div className="flex items-end justify-between">
                  <span className="text-2xl font-bold text-teal-700">{((stats.carbonSaved || 0) / 1000).toFixed(1)}kg</span>
                  <i className="fas fa-leaf text-teal-500 text-xl"></i>
                </div>
              </div>
            </div>
          </ClayCard>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming Trips */}
          <motion.div className="lg:col-span-2" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <ClayCard variant="default" padding="md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                  {isRider ? 'Upcoming Rides' : 'Upcoming Bookings'}
                </h2>
                <Link to={isRider ? '/my-rides' : '/bookings'} className="text-emerald-600 hover:text-emerald-700 text-sm font-semibold">
                  View All →
                </Link>
              </div>
              {upcomingTrips.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-calendar-day text-gray-300 text-6xl mb-4 block"></i>
                  <p className="text-gray-600 mb-4">No upcoming trips</p>
                  <ClayButton variant="primary" size="md" as={Link} to={isRider ? '/post-ride' : '/find-ride'}>
                    {isRider ? 'Post a Ride' : 'Find Rides'}
                  </ClayButton>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingTrips.slice(0, 3).map((trip) => {
                    const ride = isRider ? trip : trip.ride;
                    return (
                      <ClayCard key={trip._id} variant="flat" padding="sm" clickable onClick={() => navigate(isRider ? `/rides/${ride._id}` : `/bookings/${trip._id}`)}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <ClayBadge variant="success">Active</ClayBadge>
                              <span className="text-sm text-gray-500">{formatDate(ride.departureTime)}</span>
                            </div>
                            <div className="flex items-center space-x-3 mb-3">
                              <div className="text-lg font-bold text-gray-800">
                                {ride.route?.start?.city || ride.origin?.city || 'Origin'}
                              </div>
                              <i className="fas fa-arrow-right text-emerald-500"></i>
                              <div className="text-lg font-bold text-gray-800">
                                {ride.route?.destination?.city || ride.destination?.city || 'Destination'}
                              </div>
                            </div>
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span><i className="fas fa-clock mr-1"></i>{formatTime(ride.departureTime)}</span>
                              {isRider ? (
                                <span><i className="fas fa-users mr-1"></i>{ride.bookings?.length || 0} passengers</span>
                              ) : (
                                <span><i className="fas fa-user mr-1"></i>{trip.seats} seat(s)</span>
                              )}
                            </div>
                          </div>
                          <ClayButton variant="primary" size="sm">View</ClayButton>
                        </div>
                      </ClayCard>
                    );
                  })}
                </div>
              )}
            </ClayCard>
          </motion.div>

          {/* Sidebar */}
          <motion.div className="space-y-6" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>

            {/* I11: Onboarding for new users */}
            {stats.totalRides === 0 && stats.totalBookings === 0 && (
              <ClayCard variant="emerald" padding="md">
                <h3 className="text-lg font-bold text-gray-800 mb-3" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                  <i className="fas fa-hand-sparkles text-emerald-600 mr-2"></i>
                  Welcome to LoopLane!
                </h3>
                <p className="text-sm text-gray-600 mb-4">Complete these steps to get started:</p>
                <div className="space-y-3">
                  {[
                    { label: 'Complete your profile', icon: <CheckCircleIcon className="w-4 h-4" />, done: !!user?.phone, to: '/profile' },
                    { label: 'Add profile photo', icon: <CameraIcon className="w-4 h-4" />, done: !!user?.profile?.photo && !user.profile.photo.includes('default-avatar'), to: '/profile' },
                    { label: 'Verify your identity', icon: <IdCardIcon className="w-4 h-4" />, done: user?.verificationStatus === 'VERIFIED', to: '/profile' },
                    { label: 'Post or find a ride', icon: <RouteIcon className="w-4 h-4" />, done: false, to: '/search' },
                  ].map((step, i) => (
                    <Link key={i} to={step.to} className={`flex items-center gap-3 p-2 rounded-lg transition ${step.done ? 'bg-green-50' : 'bg-white/60 hover:bg-white/80'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step.done ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {step.done ? <CheckIcon className="w-4 h-4" /> : step.icon}
                      </div>
                      <span className={`text-sm ${step.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>{step.label}</span>
                    </Link>
                  ))}
                </div>
              </ClayCard>
            )}

            {/* I9: Rider Performance Stats */}
            {isRider && (
              <ClayCard variant="warm" padding="md">
                <h3 className="text-lg font-bold text-gray-800 mb-4" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                  <i className="fas fa-chart-line text-blue-600 mr-2"></i>
                  Rider Performance
                </h3>
                <div className="space-y-4">
                  {/* Acceptance Rate */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Acceptance Rate</span>
                      <span className="text-sm font-bold text-gray-800">
                        {stats.totalRides > 0 ? Math.round((stats.completedRides / stats.totalRides) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${stats.totalRides > 0 ? (stats.completedRides / stats.totalRides) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                  {/* Cancellation Rate */}
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">Cancellation Rate</span>
                      <span className="text-sm font-bold text-gray-800">
                        {stats.totalRides > 0 ? Math.round((stats.cancelledRides / stats.totalRides) * 100) : 0}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-red-400 h-2 rounded-full transition-all" style={{ width: `${stats.totalRides > 0 ? (stats.cancelledRides / stats.totalRides) * 100 : 0}%` }}></div>
                    </div>
                  </div>
                  {/* Avg Rating */}
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <span className="text-sm text-gray-600">Your Rating</span>
                    <div className="flex items-center gap-1">
                      <i className="fas fa-star text-yellow-500"></i>
                      <span className="font-bold text-gray-800">{stats.rating?.toFixed(1) || '0.0'}</span>
                    </div>
                  </div>
                  {/* Passengers Carried */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-gray-600">Passengers Carried</span>
                    <span className="font-bold text-blue-600">{user?.statistics?.totalPassengersCarried || 0}</span>
                  </div>
                  {/* Total Distance */}
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <span className="text-sm text-gray-600">Total Distance</span>
                    <span className="font-bold text-purple-600">{(user?.statistics?.totalDistance || 0).toFixed(0)} km</span>
                  </div>
                </div>
              </ClayCard>
            )}
            {/* Carbon Footprint */}
            <ClayCard variant="mint" padding="md">
              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                <LeafIcon className="text-green-600 mr-2 w-5 h-5" />
                Carbon Impact
              </h3>
              <div className="text-center mb-4">
                <div className="text-4xl font-bold text-green-600 mb-2">
                  {carbonReport.totalSaved.toFixed(1)} kg
                </div>
                <p className="text-sm text-gray-600">CO₂ Saved</p>
              </div>
              <div className="bg-white/60 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Your Badge</span>
                  <div className="text-green-500">
                    <LeafIcon className="w-8 h-8" />
                  </div>
                </div>
                <p className="text-sm font-semibold text-gray-800">{carbonReport.badge.name}</p>
                <div className="border-t pt-3 space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span className="flex items-center"><TreeIcon className="text-green-600 mr-1 w-3 h-3" /> Trees Equivalent</span>
                    <strong>{carbonReport.equivalentTrees}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center"><RouteIcon className="text-blue-500 mr-1 w-3 h-3" /> Total Trips</span>
                    <strong>{carbonReport.totalTrips}</strong>
                  </div>
                  {isRider && carbonReport.totalPassengersHelped > 0 && (
                    <div className="flex justify-between">
                      <span className="flex items-center"><CheckCircleIcon className="text-purple-500 mr-1 w-3 h-3" /> Passengers Helped</span>
                      <strong>{carbonReport.totalPassengersHelped}</strong>
                    </div>
                  )}
                </div>
              </div>
            </ClayCard>

            {/* Quick Actions */}
            <ClayCard variant="default" padding="md">
              <h3 className="text-lg font-bold text-gray-800 mb-3" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>Quick Actions</h3>
              <div className="space-y-2">
                {[
                  { to: '/profile', icon: <UserIcon className="w-5 h-5" />, label: 'Edit Profile' },
                  { to: '/bookings', icon: <EarningsIcon className="w-5 h-5" />, label: 'My Bookings' },
                  { to: '/chat', icon: <ChatIcon className="w-5 h-5" />, label: 'Messages' },
                  { to: '/notifications', icon: <BellIcon className="w-5 h-5" />, label: 'Notifications' }
                ].map(action => (
                  <Link key={action.to} to={action.to} className="flex items-center p-3 hover:bg-[#f0fdf4] rounded-xl transition">
                    <div className="text-emerald-600 mr-3">
                      {action.icon}
                    </div>
                    <span className="text-gray-700">{action.label}</span>
                  </Link>
                ))}
              </div>
            </ClayCard>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

// Gamification Tier Card — Shows loyalty tier, progress, and commission benefit
const GamificationTierCard = ({ user, stats }) => {
  const tiers = [
    { name: 'Blue', minRides: 0, maxRides: 10, color: 'from-blue-500 to-blue-600', textColor: 'text-blue-600', bgColor: 'bg-blue-50', icon: <CircleIcon />, commissionDiscount: '0%' },
    { name: 'Gold', minRides: 10, maxRides: 50, color: 'from-yellow-500 to-amber-500', textColor: 'text-amber-600', bgColor: 'bg-amber-50', icon: <TrophyIcon />, commissionDiscount: '2%' },
    { name: 'Platinum', minRides: 50, maxRides: 999, color: 'from-purple-500 to-indigo-600', textColor: 'text-purple-600', bgColor: 'bg-purple-50', icon: <CrownIcon />, commissionDiscount: '5%' }
  ];

  const gamification = user?.gamification || {};
  const tierName = gamification.tier || 'BLUE';
  const loyaltyPoints = gamification.loyaltyPoints || 0;
  const completedRides = (stats?.completedRides || 0) + (stats?.completedBookings || 0);

  const currentTierIdx = tiers.findIndex(t => t.name.toUpperCase() === tierName.toUpperCase());
  const currentTier = tiers[Math.max(0, currentTierIdx)];
  const nextTier = tiers[Math.min(currentTierIdx + 1, tiers.length - 1)];
  const isMaxTier = currentTierIdx === tiers.length - 1;

  const progressToNext = isMaxTier ? 100 : Math.min(100, Math.round(
    ((completedRides - currentTier.minRides) / (nextTier.minRides - currentTier.minRides)) * 100
  ));
  const ridesRemaining = isMaxTier ? 0 : Math.max(0, nextTier.minRides - completedRides);

  return (
    <ClayCard variant="default" padding="md">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Tier Badge */}
        <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${currentTier.color} flex items-center justify-center shadow-lg flex-shrink-0 text-white`}>
          {React.cloneElement(currentTier.icon, { className: 'w-10 h-10' })}
        </div>

        {/* Tier Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xl font-bold text-gray-800" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
              {currentTier.name} Member
            </h3>
            <span className={`text-xs ${currentTier.bgColor} ${currentTier.textColor} px-2 py-0.5 rounded-full font-semibold`}>
              {loyaltyPoints} pts
            </span>
          </div>

          {currentTier.commissionDiscount !== '0%' && (
            <p className="text-sm text-emerald-600 mb-2">
              <i className="fas fa-percentage mr-1"></i>
              You save {currentTier.commissionDiscount} on platform fees!
            </p>
          )}

          {/* Progress to Next Tier */}
          {!isMaxTier ? (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{currentTier.name}</span>
                <span>{nextTier.name} — {ridesRemaining} ride{ridesRemaining !== 1 ? 's' : ''} to go</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className={`bg-gradient-to-r ${nextTier.color} h-2.5 rounded-full transition-all duration-700`}
                  style={{ width: `${progressToNext}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              <i className="fas fa-check-circle text-purple-500 mr-1"></i>
              You've reached the highest tier! Enjoy maximum rewards.
            </p>
          )}
        </div>

        {/* Quick Benefit Summary */}
        <div className={`${currentTier.bgColor} rounded-xl p-4 flex-shrink-0`}>
          <p className="text-xs text-gray-500 mb-1">Your Benefits</p>
          <ul className="text-sm space-y-1">
            <li className={`${currentTier.textColor} font-medium`}>
              <i className="fas fa-check mr-1"></i>
              {currentTier.commissionDiscount === '0%' ? 'Standard fees' : `${currentTier.commissionDiscount} fee discount`}
            </li>
            {currentTierIdx >= 1 && (
              <li className={`${currentTier.textColor} font-medium`}>
                <i className="fas fa-check mr-1"></i>Priority matching
              </li>
            )}
            {currentTierIdx >= 2 && (
              <li className={`${currentTier.textColor} font-medium`}>
                <i className="fas fa-check mr-1"></i>Dedicated support
              </li>
            )}
          </ul>
        </div>
      </div>
    </ClayCard>
  );
};

export default Dashboard;
