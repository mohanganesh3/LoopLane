import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';
import { cn } from '@/lib/utils';
import {
  Search, Eye, XCircle, Car, MapPin, CircleDot, Loader2,
  ChevronRight, Clock, Users as UsersIcon, Route, Calendar, ArrowRight
} from 'lucide-react';

const formatRideDateTime = (ride) => {
  const dateTime = ride.schedule?.departureDateTime || ride.departureTime;
  if (!dateTime) return 'N/A';
  return new Date(dateTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const formatRideDistance = (ride) => {
  const distanceKm = ride.route?.distance ?? ride.distance;
  return distanceKm ? `${distanceKm.toFixed(1)} km` : 'N/A';
};

const formatRideDuration = (ride) => {
  const durationMinutes = ride.route?.duration ?? ride.duration;
  return durationMinutes ? `${Math.round(durationMinutes)} min` : 'N/A';
};

const getStatusBadgeClass = (status) => ({
  'ACTIVE': 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
  'IN_PROGRESS': 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-800',
  'COMPLETED': 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  'CANCELLED': 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  'EXPIRED': 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700'
}[status] || 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700');

const AdminRides = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filters, setFilters] = useState({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || 'all',
    date: searchParams.get('date') || ''
  });

  useEffect(() => {
    let isMounted = true;
    const loadRides = async () => {
      setLoading(true);
      try {
        const paramsFromUrl = {
          search: searchParams.get('search') || '',
          status: searchParams.get('status') || 'all',
          date: searchParams.get('date') || ''
        };
        setFilters(paramsFromUrl);
        const response = await adminService.getRides(paramsFromUrl);
        if (isMounted && response?.success) {
          setRides(response.rides || []);
        }
      } catch (err) {
        if (isMounted && err.response?.status !== 401 && err.response?.status !== 403) {
          setError(err.response?.data?.message || err.message || 'Failed to load rides');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadRides();
    return () => { isMounted = false; };
  }, [searchParams]);

  const fetchRides = async () => {
    setLoading(true);
    try {
      const response = await adminService.getRides(filters);
      if (response?.success) setRides(response.rides || []);
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        setError(err.response?.data?.message || err.message || 'Failed to load rides');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status !== 'all') params.set('status', filters.status);
    if (filters.date) params.set('date', filters.date);
    setSearchParams(params);
  };

  const handleCancelRide = async (rideId) => {
    const reason = prompt('Enter reason for cancellation:');
    if (!reason) return;
    if (!window.confirm('Are you sure you want to cancel this ride?')) return;
    try {
      const response = await adminService.cancelRide(rideId, reason);
      if (response.success) {
        setSuccess('Ride cancelled successfully');
        fetchRides();
      }
    } catch (err) {
      setError(err.message || 'Failed to cancel ride');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Rides</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Monitor and manage all rides in the system</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && <Alert type="error" message={error} className="mb-4" onClose={() => setError('')} />}
        {success && <Alert type="success" message={success} className="mb-4" onClose={() => setSuccess('')} />}

        {/* Filter Bar */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder="Origin, destination, rider..."
                className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">Date</label>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => handleFilterChange('date', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={applyFilters}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                <Search size={14} /> Search
              </button>
            </div>
          </div>
        </div>

        {/* Rides List */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
            <Car size={14} className="text-zinc-400" />
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">All Rides ({rides.length})</h3>
          </div>

          {rides.length === 0 ? (
            <div className="text-center py-12">
              <Car size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
              <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">No Rides Found</h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">No rides match your search criteria.</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {rides.map((ride) => (
                <div
                  key={ride._id}
                  className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  {/* Route + Status */}
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      <CircleDot size={12} className="text-emerald-500 flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{ride.route?.start?.address?.split(',')[0] || ride.from?.address?.split(',')[0] || 'Unknown'}</span>
                      <ArrowRight size={12} className="text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                      <MapPin size={12} className="text-red-500 flex-shrink-0" />
                      <span className="truncate max-w-[180px]">{ride.route?.destination?.address?.split(',')[0] || ride.to?.address?.split(',')[0] || 'Unknown'}</span>
                    </div>
                    <span className={cn('inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset', getStatusBadgeClass(ride.status))}>
                      {ride.status}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-3 bg-zinc-50/50 dark:bg-zinc-800/30 rounded-md border border-zinc-100 dark:border-zinc-800 mb-3">
                    {[
                      { label: 'Rider', value: ride.rider?.profile?.firstName || ride.rider?.name || 'Unknown' },
                      { label: 'Date & Time', value: formatRideDateTime(ride) },
                      { label: 'Seats', value: `${ride.pricing?.availableSeats || ride.availableSeats || 0} available` },
                      { label: 'Price/Seat', value: `₹${ride.pricing?.pricePerSeat || ride.pricePerSeat || 0}` },
                      { label: 'Distance', value: formatRideDistance(ride) },
                      { label: 'Duration', value: formatRideDuration(ride) },
                    ].map((item) => (
                      <div key={item.label}>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{item.label}</p>
                        <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => navigate(`/admin/rides/${ride._id}`)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Eye size={12} /> View Details
                    </button>
                    {ride.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleCancelRide(ride._id)}
                        className="flex items-center gap-1 px-3 py-1.5 border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 rounded-md text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                      >
                        <XCircle size={12} /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminRides;
