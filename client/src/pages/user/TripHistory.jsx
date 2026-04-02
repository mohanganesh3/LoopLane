import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import { Alert } from '../../components/common';
import { getRating, formatRating } from '../../utils/helpers';

const TripHistory = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  // B18: Date range filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [stats, setStats] = useState({
    totalTrips: 0,
    totalAmount: 0,
    avgRating: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0
  });

  const isRider = user?.role === 'RIDER';
  const statusOptions = isRider
    ? ['ALL', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS', 'ACTIVE']
    : ['ALL', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS', 'CONFIRMED'];

  useEffect(() => {
    fetchTripHistory();
  }, [searchParams, statusFilter, dateFrom, dateTo]);

  const fetchTripHistory = async () => {
    setLoading(true);
    try {
      const page = searchParams.get('page') || 1;
      const response = await userService.getTripHistory(page, statusFilter !== 'ALL' ? statusFilter : undefined, dateFrom, dateTo);
      if (response.success) {
        setTrips(response.trips || []);
        setPagination(response.pagination || { page: 1, pages: 1, total: 0 });

        // Calculate stats
        const totalAmount = (response.trips || []).reduce((sum, trip) => {
          return sum + (isRider ? (trip.totalEarnings || 0) : (trip.totalAmount || 0));
        }, 0);

        setStats({
          totalTrips: response.pagination?.total || response.trips?.length || 0,
          totalAmount,
          avgRating: getRating(user?.rating)
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load trip history');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < Math.floor(rating) ? 'text-yellow-400' : 'text-gray-300'}>
        ★
      </span>
    ));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen py-8" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl shadow-lg p-8 mb-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                <span className="mr-3"><i className="fas fa-scroll text-emerald-600"></i></span> Trip History
              </h1>
              <p className="opacity-90">
                {isRider
                  ? 'Review your completed rides and passenger feedback'
                  : 'Review your completed bookings and travel history'
                }
              </p>
            </div>
            <div className="hidden md:block text-center">
              <div className="text-4xl font-bold mb-1">{stats.totalTrips}</div>
              <p className="text-sm opacity-90">Completed Trips</p>
            </div>
          </div>
        </div>

        {error && <Alert type="error" message={error} className="mb-6" />}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Total Trips</p>
                <p className="text-3xl font-bold text-gray-800">{stats.totalTrips}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-2xl text-blue-500"><i className="fas fa-road"></i></span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">
                  {isRider ? 'Total Earnings' : 'Total Spent'}
                </p>
                <p className="text-3xl font-bold text-emerald-600">
                  ₹{stats.totalAmount.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl text-amber-500"><i className="fas fa-coins"></i></span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm mb-1">Average Rating</p>
                <div className="flex items-center space-x-2">
                  <p className="text-3xl font-bold text-gray-800">
                    {Number(stats.avgRating || 0).toFixed(1)}
                  </p>
                  <div className="text-lg">{renderStars(stats.avgRating || 0)}</div>
                </div>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <span className="text-2xl text-yellow-500"><i className="fas fa-star"></i></span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span className="text-sm text-gray-500 font-medium">Filter:</span>
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${statusFilter === status
                ? 'bg-emerald-500 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'
                }`}
            >
              {status === 'ALL' ? 'All' : status === 'IN_PROGRESS' ? 'In Progress' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}

          {/* B18: Date Range Filter */}
          <span className="text-sm text-gray-500 font-medium ml-2">Date:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
            placeholder="From"
          />
          <span className="text-gray-400 text-xs">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 outline-none"
          />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="px-2 py-1 text-xs text-red-500 hover:text-red-700">
              <i className="fas fa-times mr-1"></i>Clear
            </button>
          )}
        </div>

        {/* Trip List */}
        {trips.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl text-gray-300 mb-4"><i className="fas fa-clipboard-list"></i></div>
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No completed trips yet</h3>
            <p className="text-gray-500 mb-6">
              {isRider
                ? 'Post your first ride to start earning'
                : 'Book your first ride to start traveling'
              }
            </p>
            <Link
              to={isRider ? '/post-ride' : '/find-ride'}
              className="inline-block bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              {isRider ? 'Post a Ride' : 'Find Rides'}
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {trips.map((trip) => (
              <div key={trip._id} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition p-6">
                {isRider ? (
                  // Rider View
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xl">
                          <i className="fas fa-car text-lg"></i>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800">Your Ride</h3>
                          <p className="text-sm text-gray-500">
                            {new Date(trip.departureTime).toLocaleDateString('en-US', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-600 mb-1">
                          ₹{trip.totalEarnings || 0}
                        </div>
                        <p className="text-sm text-gray-600">
                          {trip.bookings?.filter(b => b.status === 'COMPLETED').reduce((sum, booking) => sum + (booking.seatsBooked || 1), 0) || 0} passengers
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  // Passenger View
                  <>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <img
                          src={trip.ride?.rider?.profile?.photo || trip.ride?.rider?.profilePhoto || '/images/default-avatar.png'}
                          className="w-12 h-12 rounded-full object-cover"
                          alt={trip.ride?.rider?.profile?.firstName || trip.ride?.rider?.name}
                        />
                        <div>
                          <h3 className="font-semibold text-gray-800">
                            {trip.ride?.rider?.profile?.firstName
                              ? `${trip.ride.rider.profile.firstName} ${trip.ride.rider.profile.lastName || ''}`
                              : trip.ride?.rider?.name || 'Unknown'}
                          </h3>
                          <div className="flex items-center text-sm text-gray-600">
                            <div className="text-yellow-400 mr-2">
                              {renderStars(getRating(trip.ride?.rider?.rating))}
                            </div>
                            <span>{formatRating(trip.ride?.rider?.rating)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-600 mb-1">
                          ₹{trip.totalPrice || trip.totalAmount || 0}
                        </div>
                        <p className="text-sm text-gray-600">{trip.seatsBooked} seat(s)</p>
                      </div>
                    </div>
                  </>
                )}

                {/* Route */}
                <div className="border-t border-b py-4 mb-4">
                  <div className="space-y-2">
                    <div className="flex items-center text-gray-700">
                      <span className="text-green-600 w-6"><i className="fas fa-map-marker-alt"></i></span>
                      <span className="ml-2 font-medium">
                        {isRider
                          ? (trip.route?.start?.address || trip.from?.address)
                          : (trip.ride?.route?.start?.address || trip.ride?.from?.address || 'Not available')}
                      </span>
                    </div>
                    <div className="flex items-center text-gray-400 ml-6">
                      <span className="ml-3 text-sm">
                        {isRider
                          ? (trip.route?.distance?.value ? `${(trip.route.distance.value / 1000).toFixed(1)} km` : (trip.distance ? `${trip.distance.toFixed(1)} km` : ''))
                          : (trip.ride?.route?.distance?.value ? `${(trip.ride.route.distance.value / 1000).toFixed(1)} km` : (trip.ride?.distance ? `${trip.ride.distance.toFixed(1)} km` : ''))
                        }
                      </span>
                    </div>
                    <div className="flex items-center text-gray-700">
                      <span className="text-red-600 w-6"><i className="fas fa-map-marker-alt"></i></span>
                      <span className="ml-2 font-medium">
                        {isRider
                          ? (trip.route?.destination?.address || trip.to?.address)
                          : (trip.ride?.route?.destination?.address || trip.ride?.to?.address || 'Not available')}
                      </span>
                    </div>
                  </div>

                  {/* Carbon Savings Badge */}
                  {trip.carbonSaved && trip.carbonSaved > 0 && (
                    <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg border border-green-200">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <i className="fas fa-seedling text-2xl text-green-500"></i>
                          <div>
                            <p className="text-xs text-gray-600 font-medium">Carbon Impact</p>
                            <p className="text-lg font-bold text-green-600">
                              {Number(trip.carbonSaved || 0).toFixed(1)} kg CO₂ saved
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-600">Equivalent to</p>
                          <p className="text-sm font-semibold text-green-700">
                            <i className="fas fa-tree mr-1"></i> {((trip.carbonSaved || 0) / 21).toFixed(1)} trees
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                  <Link
                    to={isRider ? `/rides/${trip._id}` : `/bookings/${trip._id}`}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition text-sm"
                  >
                    <i className="fas fa-eye mr-1"></i> View Details
                  </Link>

                  {!isRider && ['COMPLETED', 'DROPPED_OFF'].includes(trip.status) && !trip.reviews?.passengerReviewed && (
                    <Link
                      to={`/bookings/${trip._id}/rate`}
                      className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-semibold transition text-sm"
                    >
                      <i className="fas fa-star mr-1"></i> Rate Rider
                    </Link>
                  )}
                </div>

                <p className="text-gray-400 text-xs mt-4">
                  <i className="fas fa-clock mr-1"></i> Completed on {new Date(trip.completedAt || trip.createdAt).toLocaleString()}
                </p>
              </div>
            ))}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-center items-center space-x-2 mt-8">
                {pagination.page > 1 && (
                  <button
                    onClick={() => setSearchParams({ page: (pagination.page - 1).toString() })}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    ←
                  </button>
                )}

                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => setSearchParams({ page: page.toString() })}
                    className={`px-4 py-2 rounded-lg font-semibold transition ${page === pagination.page
                      ? 'bg-emerald-500 text-white'
                      : 'bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                  >
                    {page}
                  </button>
                ))}

                {pagination.page < pagination.pages && (
                  <button
                    onClick={() => setSearchParams({ page: (pagination.page + 1).toString() })}
                    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                  >
                    →
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TripHistory;
