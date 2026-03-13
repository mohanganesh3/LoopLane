import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { Alert, LoadingSpinner, TrustScore } from '../../components/common';
import { ClayCard, ClayButton, ClayBadge, ClayInput } from '../../components/clay';
import LocationInput from '../../components/common/LocationInput';
import rideService from '../../services/rideService';
import { getRating, formatRating } from '../../utils/helpers';
import { setSearchResults, setFilters, clearSearchResults } from '../../redux/slices/ridesSlice';
import { setGlobalLoading } from '../../redux/slices/uiSlice';

const SearchRides = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Get cached search results from Redux (for back navigation)
  const cachedResults = useSelector((state) => state.rides.searchResults);
  const cachedFilters = useSelector((state) => state.rides.filters);

  const [searchParams, setSearchParams] = useState({
    origin: cachedFilters?.origin || null,
    destination: cachedFilters?.destination || null,
    date: cachedFilters?.date || '',
    seats: cachedFilters?.seats || 1
  });
  const [advancedFilters, setAdvancedFilters] = useState({
    smokingAllowed: '',
    petsAllowed: '',
    verifiedOnly: false,
    sortBy: 'matchScore'
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [results, setResults] = useState(cachedResults || []);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(cachedResults?.length > 0);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const runSearch = async (nextSearchParams = searchParams) => {
    setError('');

    if (!nextSearchParams.origin || !nextSearchParams.destination) {
      setError('Please select valid locations from the dropdown');
      return;
    }

    setLoading(true);
    setSearched(true);
    dispatch(setGlobalLoading(true));

    // Store search filters in Redux
    dispatch(setFilters(nextSearchParams));

    try {
      const params = { ...nextSearchParams };
      // Include advanced filters
      if (advancedFilters.smokingAllowed) params.smokingAllowed = advancedFilters.smokingAllowed;
      if (advancedFilters.petsAllowed) params.petsAllowed = advancedFilters.petsAllowed;
      if (advancedFilters.verifiedOnly) params.verifiedOnly = 'true';
      if (advancedFilters.sortBy) params.sortBy = advancedFilters.sortBy;

      const data = await rideService.searchRides(params);
      const searchResults = data.rides || [];
      setResults(searchResults);

      // Store results in Redux for caching
      dispatch(setSearchResults(searchResults));
    } catch (err) {
      setError(err.message || 'Failed to search rides');
      setResults([]);
      dispatch(clearSearchResults());
    } finally {
      setLoading(false);
      dispatch(setGlobalLoading(false));
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    await runSearch();
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
  };

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
  const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-12 min-h-screen"
      style={{ background: 'var(--ll-cream, #f5f0e8)' }}
    >
      <div className="container mx-auto px-4">
        {/* Search Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <ClayCard variant="default" padding="lg" className="mb-8">
            <h1
              className="text-3xl font-bold text-gray-800 mb-6"
              style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}
            >
              <i className="fas fa-search text-emerald-500 mr-3"></i>
              Find Your Perfect Ride
            </h1>

            {error && <Alert type="error" message={error} onClose={() => setError('')} />}

            {/* Search Form */}
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* From Location */}
                <LocationInput
                  label="From"
                  placeholder="Enter pickup location"
                  icon="fa-map-marker-alt"
                  iconColor="text-green-600"
                  value={searchParams.origin}
                  onChange={(location) => setSearchParams(prev => ({ ...prev, origin: location }))}
                  required
                />

                {/* To Location */}
                <LocationInput
                  label="To"
                  placeholder="Enter destination"
                  icon="fa-map-marker-alt"
                  iconColor="text-red-600"
                  value={searchParams.destination}
                  onChange={(location) => setSearchParams(prev => ({ ...prev, destination: location }))}
                  required
                />

                {/* Date */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <i className="fas fa-calendar text-emerald-500 mr-2"></i>Date
                  </label>
                  <input
                    type="date"
                    value={searchParams.date}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, date: e.target.value }))}
                    min={today}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white/60"
                  />
                </div>

                {/* Passengers */}
                <div>
                  <label className="block text-gray-700 font-medium mb-2">
                    <i className="fas fa-users text-emerald-500 mr-2"></i>Passengers
                  </label>
                  <select
                    value={searchParams.seats}
                    onChange={(e) => setSearchParams(prev => ({ ...prev, seats: parseInt(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white/60"
                  >
                    <option value="1">1 Passenger</option>
                    <option value="2">2 Passengers</option>
                    <option value="3">3 Passengers</option>
                    <option value="4">4 Passengers</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-center mt-6">
                <ClayButton type="submit" variant="primary" size="lg" loading={loading} className="px-8">
                  <i className="fas fa-search mr-2"></i>
                  Search Rides
                </ClayButton>
              </div>
            </form>

            {/* Advanced Filters Toggle */}
            <div className="mt-4 border-t pt-4">
              <ClayButton
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <i className={`fas fa-${showAdvanced ? 'chevron-up' : 'sliders-h'} mr-2`}></i>
                {showAdvanced ? 'Hide' : 'Show'} Advanced Filters
              </ClayButton>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      {/* No Smoking Filter */}
                      <div>
                        <label className="block text-gray-700 font-medium mb-2 text-sm">
                          <i className="fas fa-smoking-ban text-gray-500 mr-1"></i>Smoking
                        </label>
                        <select
                          value={advancedFilters.smokingAllowed}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, smokingAllowed: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white/60"
                        >
                          <option value="">Any</option>
                          <option value="false">No Smoking</option>
                          <option value="true">Smoking OK</option>
                        </select>
                      </div>

                      {/* Pets Filter */}
                      <div>
                        <label className="block text-gray-700 font-medium mb-2 text-sm">
                          <i className="fas fa-paw text-gray-500 mr-1"></i>Pets
                        </label>
                        <select
                          value={advancedFilters.petsAllowed}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, petsAllowed: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white/60"
                        >
                          <option value="">Any</option>
                          <option value="false">No Pets</option>
                          <option value="true">Pets OK</option>
                        </select>
                      </div>

                      {/* Verified Only */}
                      <div className="flex items-end">
                        <label className="flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={advancedFilters.verifiedOnly}
                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, verifiedOnly: e.target.checked }))}
                            className="w-4 h-4 text-emerald-500 border-gray-300 rounded focus:ring-emerald-500"
                          />
                          <span className="ml-2 text-sm text-gray-700 font-medium">
                            <i className="fas fa-shield-alt text-blue-500 mr-1"></i>Verified Only
                          </span>
                        </label>
                      </div>

                      {/* Sort By */}
                      <div>
                        <label className="block text-gray-700 font-medium mb-2 text-sm">
                          <i className="fas fa-sort text-gray-500 mr-1"></i>Sort By
                        </label>
                        <select
                          value={advancedFilters.sortBy}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm bg-white/60"
                        >
                          <option value="matchScore">Best Match</option>
                          <option value="price">Lowest Price</option>
                          <option value="departure">Earliest Departure</option>
                          <option value="rating">Highest Rating</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ClayCard>
        </motion.div>

        {/* Results Section */}
        {loading ? (
          <LoadingSpinner size="lg" text="Searching for rides..." className="py-12" />
        ) : searched ? (
          results.length === 0 ? (
            <motion.div variants={fadeUp} initial="hidden" animate="visible">
              <ClayCard variant="default" padding="lg">
                <div className="text-center py-8">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-route text-emerald-400 text-3xl"></i>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No rides found for this route</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Don't worry — we can notify you as soon as a ride is posted on this route!
                  </p>

                  {/* Route Alert CTA */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 mb-6 max-w-lg mx-auto text-left">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <i className="fas fa-bell text-emerald-600"></i>
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800 mb-1">Set a Route Alert</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          We'll send you a notification when a driver posts a ride matching your route.
                        </p>
                        <button
                          onClick={async () => {
                            if (!searchParams.origin || !searchParams.destination) return;
                            try {
                              const userService = (await import('../../services/userService')).default;
                              await userService.createRouteAlert({
                                origin: searchParams.origin,
                                destination: searchParams.destination,
                                minSeats: parseInt(searchParams.seats) || 1
                              });
                              alert('Route alert set! We\'ll notify you when a matching ride is posted.');
                            } catch (err) {
                              alert(err.response?.data?.message || 'Failed to set route alert. Please try again.');
                            }
                          }}
                          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold transition"
                        >
                          <i className="fas fa-bell mr-2"></i>Notify Me
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Alternative Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-lg mx-auto">
                    <Link
                      to="/post-ride"
                      className="flex items-center justify-center px-5 py-3 border-2 border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-50 transition font-semibold text-sm"
                    >
                      <i className="fas fa-car mr-2"></i>Post a Ride Instead
                    </Link>
                    <button
                      onClick={() => {
                        const relaxedSearchParams = { ...searchParams, date: '' };
                        setSearchParams(relaxedSearchParams);
                        runSearch(relaxedSearchParams);
                      }}
                      className="flex items-center justify-center px-5 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition font-semibold text-sm"
                    >
                      <i className="fas fa-calendar-alt mr-2"></i>Try Different Dates
                    </button>
                  </div>
                </div>
              </ClayCard>
            </motion.div>
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-4">
              <p className="text-gray-600 mb-4">
                Found <span className="font-semibold">{results.length}</span> ride(s)
              </p>
              {results.map((result) => {
                // Handle both formats: result with nested ride or direct ride object
                const ride = result.ride || result;
                const rideId = ride._id;
                const riderName = result.riderDisplayName || ride.rider?.name || ride.rider?.profile?.firstName || 'Driver';
                const originalPrice = result.pricingBreakdown?.originalPricePerSeat || result.originalPricePerSeat || ride.pricing?.pricePerSeat || ride.pricePerSeat || 0;
                const dynamicPrice = result.pricingBreakdown?.finalPricePerSeat || result.pricePerSeat || ride.pricing?.pricePerSeat || ride.pricePerSeat || originalPrice;
                const totalPrice = result.price || dynamicPrice * (searchParams.seats || 1);
                const hasSurge = result.pricingBreakdown?.surgeMultiplier > 1 || ride.pricingBreakdown?.surgeMultiplier > 1;
                const surgeMultiplier = result.pricingBreakdown?.surgeMultiplier || ride.pricingBreakdown?.surgeMultiplier || 1;
                const hasDiscount = dynamicPrice < originalPrice && originalPrice > 0;
                const availableSeats = ride.pricing?.availableSeats || ride.availableSeats || 0;
                const departureTime = ride.schedule?.departureDateTime || ride.departureTime;
                const originCity = ride.route?.start?.address || ride.origin?.city || 'Origin';
                const destCity = ride.route?.destination?.address || ride.destination?.city || 'Destination';
                const riderRating = getRating(ride.rider?.rating);
                const trustScore = ride.rider?.trustScore || 0;
                const completedRides = ride.rider?.statistics?.totalRidesCompleted || ride.rider?.statistics?.completedRides || 0;
                const isVerified = ride.rider?.verificationStatus === 'VERIFIED' || ride.rider?.verification?.license?.verified;
                const vehicleName = ride.vehicle?.make && ride.vehicle?.model
                  ? `${ride.vehicle.make} ${ride.vehicle.model}`
                  : ride.rider?.vehicles?.[0] ? `${ride.rider.vehicles[0].make} ${ride.rider.vehicles[0].model}` : null;
                const isLadiesOnly = ride.preferences?.gender === 'FEMALE_ONLY' || ride.ladiesOnly;

                const handleViewDetails = (e) => {
                  e.stopPropagation();
                  navigate(`/rides/${rideId}`, {
                    state: {
                      searchedPickup: searchParams.origin,
                      searchedDropoff: searchParams.destination,
                      searchedSeats: searchParams.seats
                    }
                  });
                };

                return (
                  <motion.div key={rideId} variants={fadeUp}>
                    <ClayCard variant="default" hover clickable className="cursor-pointer" onClick={handleViewDetails}>
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                        <div className="flex-1">
                          {/* Route */}
                          <div className="flex items-center space-x-3 mb-3">
                            <div>
                              <div className="text-lg font-bold text-gray-800">
                                {originCity.split(',')[0]}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatTime(departureTime)}
                              </div>
                            </div>
                            <div className="flex-1 flex items-center px-4">
                              <div className="flex-1 h-0.5 bg-gray-300"></div>
                              <i className="fas fa-car text-emerald-500 mx-2"></i>
                              <div className="flex-1 h-0.5 bg-gray-300"></div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-800">
                                {destCity.split(',')[0]}
                              </div>
                              <div className="text-xs text-gray-500">
                                {result.matchQuality || '~'}
                              </div>
                            </div>
                          </div>

                          {/* Details Row 1: Driver & Ride Info */}
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-2">
                            <span className="flex items-center">
                              <i className="fas fa-user-circle mr-1"></i>
                              {riderName}
                              {isVerified && (
                                <span className="ml-1 text-blue-500" title="Verified Driver">
                                  <i className="fas fa-check-circle text-xs"></i>
                                </span>
                              )}
                            </span>
                            {completedRides > 0 && (
                              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full">
                                {completedRides} rides
                              </span>
                            )}
                            {ride.rider?._id && (
                              <TrustScore userId={ride.rider._id} compact={true} />
                            )}
                            {isLadiesOnly && (
                              <span className="text-xs bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full flex items-center">
                                <i className="fas fa-female mr-1"></i>Ladies Only
                              </span>
                            )}
                          </div>

                          {/* Details Row 2: Schedule, Seats, Rating */}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                            <span>
                              <i className="fas fa-calendar mr-1"></i>
                              {formatDate(departureTime)}
                            </span>
                            <span>
                              <i className="fas fa-chair mr-1"></i>
                              {availableSeats} seat(s) left
                            </span>
                            {riderRating > 0 && (
                              <span className="flex items-center">
                                <i className="fas fa-star text-yellow-400 mr-1"></i>
                                {riderRating.toFixed(1)}
                              </span>
                            )}
                            {vehicleName && (
                              <span className="text-xs text-gray-400">
                                <i className="fas fa-car mr-1"></i>{vehicleName}
                              </span>
                            )}
                            {result.carbonSaved > 0 && (
                              <span className="flex items-center text-green-600">
                                <i className="fas fa-leaf mr-1"></i>
                                {result.carbonSaved.toFixed(1)} kg CO₂
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price & Action */}
                        <div className="mt-4 md:mt-0 md:ml-6 flex flex-col items-end">
                          {/* Dynamic Pricing Display */}
                          <div className="text-right mb-2">
                            {hasDiscount && (
                              <div className="text-sm text-gray-400 line-through">₹{originalPrice}</div>
                            )}
                            <div className="text-2xl font-bold text-emerald-500">
                              ₹{dynamicPrice}
                              <span className="text-sm text-gray-500 font-normal">/seat</span>
                            </div>
                            {(searchParams.seats || 1) > 1 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Total for {searchParams.seats} seats: ₹{totalPrice}
                              </div>
                            )}
                            {hasSurge && (
                              <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full inline-flex items-center mt-1">
                                <i className="fas fa-bolt mr-1"></i>Surge {surgeMultiplier.toFixed(1)}x
                              </span>
                            )}
                            {hasDiscount && (
                              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full inline-flex items-center mt-1">
                                <i className="fas fa-tag mr-1"></i>
                                {Math.round((1 - dynamicPrice / originalPrice) * 100)}% off
                              </span>
                            )}
                          </div>
                          <ClayButton variant="primary" size="sm" onClick={handleViewDetails}>
                            View Details
                          </ClayButton>
                        </div>
                      </div>

                      {/* Match Quality & Badges Row */}
                      {(result.matchQuality || result.distance) && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                          {result.matchQuality && (
                            <ClayBadge variant={result.matchQuality === 'EXCELLENT' || result.matchQuality === 'Excellent' ? 'success' : result.matchQuality === 'GOOD' || result.matchQuality === 'Good' ? 'info' : 'default'}>
                              {result.matchQuality} Match
                            </ClayBadge>
                          )}
                          {result.distance && (
                            <ClayBadge variant="default">
                              {result.distance.toFixed(1)} km
                            </ClayBadge>
                          )}
                        </div>
                      )}
                    </ClayCard>
                  </motion.div>
                );
              })}
            </motion.div>
          )
        ) : null}
      </div>
    </motion.div>
  );
};

export default SearchRides;
