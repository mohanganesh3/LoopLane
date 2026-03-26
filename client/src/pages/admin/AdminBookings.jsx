import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import adminService from '../../services/adminService';
import { cn } from '@/lib/utils';
import {
  Search, X, LayoutGrid, List, ChevronRight, ChevronLeft, ChevronRight as ChevronR,
  Clock, CheckCircle, Car, Flag, XCircle, UserX, BarChart3, Star,
  MapPin, CircleDot, Building2, Zap, Timer, Route, QrCode, Calendar,
  Users as UsersIcon, ArrowRight, Loader2, FileText, Gavel, ArrowLeftRight
} from 'lucide-react';

/* ── Helpers ──────────────────────────────────────────── */
const fmtDT = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'N/A';

const FILTER_ICONS = {
  all: BarChart3, PENDING: Clock, CONFIRMED: CheckCircle, IN_TRANSIT: Car,
  COMPLETED: Flag, CANCELLED: XCircle, NO_SHOW: UserX
};

const AdminBookings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStatus, setCurrentStatus] = useState(searchParams.get('status') || 'all');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [stats, setStats] = useState({});
  const [revenue, setRevenue] = useState(null);
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [viewMode, setViewMode] = useState('cards');

  useEffect(() => {
    let isMounted = true;
    const loadBookings = async () => {
      setLoading(true);
      try {
        const page = searchParams.get('page') || 1;
        const status = searchParams.get('status') || 'all';
        const search = searchParams.get('search') || '';
        setCurrentStatus(status);
        setSearchTerm(search);
        const response = await adminService.getBookings({ page, status, search });
        if (isMounted && response?.success) {
          setBookings(response.bookings || []);
          setPagination(response.pagination || { page: 1, pages: 1, total: 0 });
          if (response.stats) setStats(response.stats);
          if (response.revenue) setRevenue(response.revenue);
        }
      } catch (err) {
        if (isMounted && err.response?.status !== 401 && err.response?.status !== 403) {
          setError(err.response?.data?.message || err.message || 'Failed to load bookings');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadBookings();
    return () => { isMounted = false; };
  }, [searchParams]);

  const handleStatusFilter = (status) => {
    const params = { status, page: '1' };
    if (searchTerm) params.search = searchTerm;
    setSearchParams(params);
  };

  const handleSearch = useCallback((e) => {
    e?.preventDefault();
    const params = { status: currentStatus, page: '1' };
    if (searchInput.trim()) params.search = searchInput.trim();
    setSearchParams(params);
  }, [searchInput, currentStatus, setSearchParams]);

  const clearSearch = () => {
    setSearchInput('');
    setSearchParams({ status: currentStatus, page: '1' });
  };

  /* ── Badge Helpers ── */
  const getStatusBadgeClass = (status) => ({
    'PENDING': 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-800',
    'CONFIRMED': 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-800',
    'CANCELLED': 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
    'COMPLETED': 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
    'PICKUP_PENDING': 'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:ring-indigo-800',
    'PICKED_UP': 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
    'IN_TRANSIT': 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:ring-sky-800',
    'DROPOFF_PENDING': 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-900/20 dark:text-teal-400 dark:ring-teal-800',
    'DROPPED_OFF': 'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-900/20 dark:text-cyan-400 dark:ring-cyan-800',
    'EXPIRED': 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
    'REJECTED': 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:ring-rose-800',
    'NO_SHOW': 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-800'
  }[status] || 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700');

  const getPaymentBadgeClass = (status) => ({
    'PAID': 'bg-green-50 text-green-700 ring-green-200 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-800',
    'PAYMENT_CONFIRMED': 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
    'PENDING': 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-800',
    'REFUNDED': 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
    'FAILED': 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
    'NOT_DUE': 'bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700'
  }[status] || 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700');

  const getSmartPaymentStatus = (booking) => {
    const ps = booking.payment?.status;
    const bs = booking.status;
    if (ps && ps !== 'PENDING') return ps;
    if (['PENDING', 'CONFIRMED', 'EXPIRED', 'REJECTED'].includes(bs)) return 'NOT_DUE';
    if (bs === 'CANCELLED') return booking.payment?.refundAmount > 0 ? 'REFUNDED' : 'NOT_DUE';
    return ps || 'PENDING';
  };

  const paymentLabel = (s) => ({
    PAID: 'Paid', PAYMENT_CONFIRMED: 'Confirmed', PENDING: 'Pending',
    REFUNDED: 'Refunded', FAILED: 'Failed', NOT_DUE: 'Not Yet Due'
  }[s] || s);

  /* ── Filter Tabs Config ── */
  const filterTabs = [
    { key: 'all', label: 'All', count: stats.all || pagination.total },
    { key: 'PENDING', label: 'Pending', count: stats.pending },
    { key: 'CONFIRMED', label: 'Confirmed', count: stats.confirmed },
    { key: 'IN_TRANSIT', label: 'In Transit', count: stats.inTransit },
    { key: 'COMPLETED', label: 'Completed', count: stats.completed },
    { key: 'CANCELLED', label: 'Cancelled', count: stats.cancelled },
    { key: 'NO_SHOW', label: 'No-Show', count: stats.noShow },
  ];

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Bookings</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Monitor and manage all ride bookings</p>
          </div>
          <span className="text-sm text-zinc-500 dark:text-zinc-400 tabular-nums">
            {pagination.total} total
          </span>
        </div>

        {/* Revenue Summary */}
        {revenue && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {[
              { label: 'Total Volume', value: `₹${Math.round(revenue.totalVolume || 0).toLocaleString()}` },
              { label: 'Platform Revenue', value: `₹${Math.round(revenue.platformRevenue || 0).toLocaleString()}` },
              { label: 'Rider Earnings', value: `₹${Math.round(revenue.riderEarnings || 0).toLocaleString()}` },
              { label: 'Avg Booking', value: `₹${Math.round(revenue.avgBookingValue || 0)}` },
              { label: 'Seats Booked', value: revenue.totalSeatsBooked || 0 },
            ].map((item) => (
              <div key={item.label} className="bg-zinc-50 dark:bg-zinc-800/50 rounded-md border border-zinc-200 dark:border-zinc-700 p-2.5 text-center">
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">{item.label}</p>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && <Alert type="error" message={error} className="mb-4" onClose={() => setError('')} />}

        {/* Search + View Toggle */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 mb-4 flex flex-col md:flex-row items-center gap-3">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2 w-full">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text" value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search by booking reference or ID..."
                className="w-full pl-9 pr-4 py-2 border border-zinc-200 dark:border-zinc-700 bg-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md text-sm font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
              Search
            </button>
            {searchTerm && (
              <button type="button" onClick={clearSearch} className="p-2 border border-zinc-200 dark:border-zinc-700 text-zinc-500 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <X size={14} />
              </button>
            )}
          </form>
          <div className="flex gap-0.5 bg-zinc-100 dark:bg-zinc-800 rounded-md p-0.5">
            <button onClick={() => setViewMode('cards')} className={cn('p-2 rounded-md text-sm transition-colors', viewMode === 'cards' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500')}>
              <LayoutGrid size={14} />
            </button>
            <button onClick={() => setViewMode('compact')} className={cn('p-2 rounded-md text-sm transition-colors', viewMode === 'compact' ? 'bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100' : 'text-zinc-500')}>
              <List size={14} />
            </button>
          </div>
        </div>

        {/* Search Active Indicator */}
        {searchTerm && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-md px-4 py-2 mb-4 flex items-center justify-between">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <Search size={12} className="inline mr-1" />Showing results for "<strong>{searchTerm}</strong>" — {pagination.total} match{pagination.total !== 1 ? 'es' : ''}
            </p>
            <button onClick={clearSearch} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 text-sm font-medium">Clear</button>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-2 mb-6">
          <div className="flex flex-wrap gap-1">
            {filterTabs.map(({ key, label, count }) => {
              const Icon = FILTER_ICONS[key];
              return (
                <button key={key} onClick={() => handleStatusFilter(key)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-colors',
                    currentStatus === key
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  )}
                >
                  {Icon && <Icon size={13} />}{label}
                  {count !== undefined && count > 0 && (
                    <span className={cn('ml-0.5 px-1.5 py-0.5 rounded-md text-[10px]', currentStatus === key ? 'bg-white/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400')}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-12 text-center">
            <FileText size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
            <h3 className="text-sm font-medium text-zinc-600 dark:text-zinc-400 mb-1">No Bookings Found</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">No bookings match your filter criteria.</p>
          </div>
        ) : viewMode === 'compact' ? (
          /* Compact/Table View */
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Reference</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Passenger</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Driver</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Price</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Commission</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Payment</th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wide">Created</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {bookings.map((booking) => {
                    const smartPay = getSmartPaymentStatus(booking);
                    const commission = booking.payment?.platformCommission || 0;
                    return (
                      <tr key={booking._id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/bookings/${booking._id}`)}>
                        <td className="px-4 py-2.5">
                          <p className="font-mono font-medium text-xs text-zinc-800 dark:text-zinc-200">{booking.bookingReference || booking._id.toString().slice(-8)}</p>
                          {booking.bidding?.isCounterOffer && <span className="text-[10px] text-amber-600 flex items-center gap-0.5"><Gavel size={9} />Bid</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
                              {(booking.passenger?.profile?.firstName?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[120px]">
                                {booking.passenger?.profile?.firstName || 'Unknown'}
                              </p>
                              {booking.passenger?.rating?.average > 0 && (
                                <p className="text-[10px] text-zinc-400 flex items-center gap-0.5"><Star size={8} className="text-yellow-500" /> {booking.passenger.rating.average.toFixed(1)}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate max-w-[120px]">
                            {booking.ride?.rider?.profile?.firstName || 'Unassigned'}
                          </p>
                          {booking.ride?.rider?.rating?.average > 0 && (
                            <p className="text-[10px] text-zinc-400 flex items-center gap-0.5"><Star size={8} className="text-yellow-500" /> {booking.ride.rider.rating.average.toFixed(1)}</p>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-xs text-zinc-800 dark:text-zinc-200">₹{booking.totalPrice || 0}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">₹{commission}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn('inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset whitespace-nowrap', getStatusBadgeClass(booking.status))}>{booking.status}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn('inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset', getPaymentBadgeClass(smartPay))}>{paymentLabel(smartPay)}</span>
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">{fmtDate(booking.createdAt)}</td>
                        <td className="px-4 py-2.5">
                          <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Card View */
          <div className="space-y-3">
            {bookings.map((booking) => {
              const smartPay = getSmartPaymentStatus(booking);
              const commission = booking.payment?.platformCommission || 0;
              const rideFare = booking.payment?.rideFare || 0;
              const hasRating = booking.passenger?.rating?.average > 0;
              const driverRating = booking.ride?.rider?.rating?.average || 0;
              return (
                <div key={booking._id} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                  {/* Header Row */}
                  <div className="flex justify-between items-start p-4 pb-3">
                    <div className="flex items-center gap-2">
                      <div>
                        <h3 className="font-mono font-medium text-sm text-zinc-900 dark:text-zinc-100">
                          {booking.bookingReference || `#${booking._id.toString().slice(-8).toUpperCase()}`}
                        </h3>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">{fmtDT(booking.createdAt)}</p>
                      </div>
                      {booking.bidding?.isCounterOffer && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800">
                          <Gavel size={9} />Bid
                        </span>
                      )}
                      {booking.reassignment?.isReassigned && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-800">
                          <ArrowLeftRight size={9} />Reassigned
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn('inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset', getPaymentBadgeClass(smartPay))}>
                        {paymentLabel(smartPay)}
                      </span>
                      <span className={cn('inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset', getStatusBadgeClass(booking.status))}>
                        {booking.status}
                      </span>
                    </div>
                  </div>

                  {/* Content Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 px-4 py-3 bg-zinc-50/50 dark:bg-zinc-800/30 border-y border-zinc-100 dark:border-zinc-800">
                    {/* Passenger */}
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 text-xs font-medium">
                        {(booking.passenger?.profile?.firstName?.[0] || 'P').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Passenger</p>
                        <p className="font-medium text-zinc-800 dark:text-zinc-200 text-xs truncate">
                          {booking.passenger?.profile?.firstName || 'Unknown'} {booking.passenger?.profile?.lastName || ''}
                        </p>
                        {hasRating && (
                          <div className="flex items-center gap-0.5">
                            <Star size={9} className="text-yellow-500" />
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">{booking.passenger.rating.average.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Route */}
                    <div className="min-w-0">
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">Route</p>
                      <p className="font-medium text-zinc-800 dark:text-zinc-200 text-xs truncate flex items-center gap-1">
                        <CircleDot size={10} className="text-emerald-500 flex-shrink-0" />
                        {(booking.pickupPoint?.name || booking.pickupPoint?.address || booking.ride?.route?.start?.name)?.substring(0, 28) || 'Start'}
                      </p>
                      <p className="font-medium text-zinc-800 dark:text-zinc-200 text-xs truncate flex items-center gap-1">
                        <MapPin size={10} className="text-red-500 flex-shrink-0" />
                        {(booking.dropoffPoint?.name || booking.dropoffPoint?.address || booking.ride?.route?.destination?.name)?.substring(0, 28) || 'End'}
                      </p>
                    </div>

                    {/* Pricing */}
                    <div>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">Pricing</p>
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">₹{booking.totalPrice || 0}</p>
                      {commission > 0 && (
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 flex items-center gap-0.5">
                          <Building2 size={9} />₹{commission} platform
                          {rideFare > 0 && <span className="text-zinc-400"> · ₹{rideFare} rider</span>}
                        </p>
                      )}
                      <p className="text-[10px] text-zinc-400">{booking.seatsBooked || 1} seat(s){booking.payment?.method ? ` · ${booking.payment.method}` : ''}</p>
                    </div>

                    {/* Quick Indicators */}
                    <div className="space-y-1">
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-1">Details</p>
                      {booking.riderResponse?.responseTime != null && (
                        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1">
                          <Zap size={9} className={booking.riderResponse.responseTime <= 5 ? 'text-emerald-500' : booking.riderResponse.responseTime <= 15 ? 'text-yellow-500' : 'text-red-500'} />
                          Response: {booking.riderResponse.responseTime}m
                        </p>
                      )}
                      {booking.journey?.duration > 0 && (
                        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1"><Timer size={9} />Duration: {booking.journey.duration >= 60 ? `${Math.floor(booking.journey.duration / 60)}h ${booking.journey.duration % 60}m` : `${booking.journey.duration}m`}</p>
                      )}
                      {booking.journey?.distance > 0 && (
                        <p className="text-[10px] text-zinc-600 dark:text-zinc-400 flex items-center gap-1"><Route size={9} />{booking.journey.distance.toFixed(1)} km</p>
                      )}
                      {booking.verification?.pickup?.verified && <p className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><QrCode size={9} />OTP Verified</p>}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {booking.ride?.rider && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 text-[10px] font-medium">
                            {(booking.ride.rider.profile?.firstName?.[0] || 'D').toUpperCase()}
                          </div>
                          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            {booking.ride.rider.profile?.firstName || 'Unknown'}
                          </span>
                          {driverRating > 0 && (
                            <span className="text-[10px] text-zinc-400 flex items-center gap-0.5"><Star size={8} className="text-yellow-500" /> {driverRating.toFixed(1)}</span>
                          )}
                        </div>
                      )}
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                        <Calendar size={10} />
                        {booking.ride?.schedule?.departureDateTime ? fmtDate(booking.ride.schedule.departureDateTime) : 'N/A'}
                      </span>
                      {booking.coPassengers?.length > 0 && (
                        <span className="text-[10px] text-zinc-400 flex items-center gap-0.5"><UsersIcon size={9} />{booking.coPassengers.length} co-passenger(s)</span>
                      )}
                    </div>
                    <button onClick={() => navigate(`/admin/bookings/${booking._id}`)}
                      className="px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md text-xs font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
                    >
                      Details <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-center items-center gap-1.5 mt-6">
            {pagination.page > 1 && (
              <button onClick={() => {
                const params = { status: currentStatus, page: (pagination.page - 1).toString() };
                if (searchTerm) params.search = searchTerm;
                setSearchParams(params);
              }} className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <ChevronLeft size={14} />
              </button>
            )}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                let page;
                if (pagination.pages <= 5) page = i + 1;
                else if (pagination.page <= 3) page = i + 1;
                else if (pagination.page >= pagination.pages - 2) page = pagination.pages - 4 + i;
                else page = pagination.page - 2 + i;
                return (
                  <button key={page} onClick={() => {
                    const params = { status: currentStatus, page: page.toString() };
                    if (searchTerm) params.search = searchTerm;
                    setSearchParams(params);
                  }} className={cn(
                    'px-2.5 py-1 rounded-md text-sm transition-colors',
                    page === pagination.page
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium'
                      : 'border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  )}>{page}</button>
                );
              })}
            </div>
            {pagination.page < pagination.pages && (
              <button onClick={() => {
                const params = { status: currentStatus, page: (pagination.page + 1).toString() };
                if (searchTerm) params.search = searchTerm;
                setSearchParams(params);
              }} className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
                <ChevronR size={14} />
              </button>
            )}
            <span className="text-xs text-zinc-400 dark:text-zinc-500 ml-2">Page {pagination.page} of {pagination.pages}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminBookings;
