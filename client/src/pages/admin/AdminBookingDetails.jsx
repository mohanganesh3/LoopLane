import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, MapPin, Wallet, Calendar, Clock, User, Users, Car, ChevronRight, Check, AlertCircle, Loader2, RefreshCw, CreditCard, Shield, Leaf, TrendingUp, BarChart3, Settings, ArrowRight, CircleDot, Hash, Phone, Mail, Eye, Ban, Undo2, MessageSquare, Package, Route, Gauge } from 'lucide-react';
import adminService from '../../services/adminService';
import { cn } from '@/lib/utils';

/* ── Helpers ────────────────────────────────────────────── */
const fmtDT = (d) => d ? new Date(d).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
const pct = (v, t) => t > 0 ? Math.round((v / t) * 100) : 0;
const dur = (m) => {
  if (!m || m <= 0) return '—';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

/* ── Reusable Components ────────────────────────────────── */
const Section = ({ title, children, badge, className = '' }) => (
  <div className={cn('bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 mb-6', className)}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </h3>
      {badge}
    </div>
    {children}
  </div>
);

const StatCard = ({ value, label, sub }) => (
  <div className="bg-zinc-50 dark:bg-zinc-800 p-4 rounded-lg text-center border border-zinc-200 dark:border-zinc-700">
    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
    <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
  </div>
);

const Stars = ({ rating, size = 'sm' }) => {
  const s = { xs: 'text-xs', sm: 'text-sm', md: 'text-base', lg: 'text-lg' }[size];
  return (
    <div className={`flex gap-0.5 ${s}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={14} className={i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-zinc-200'} />
      ))}
    </div>
  );
};

const BarGauge = ({ value, max = 100, label }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-zinc-500 w-28 text-right truncate">{label}</span>
    <div className="flex-1 h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden">
      <div className="h-full bg-zinc-900 dark:bg-zinc-100 rounded-md transition-all" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 w-10">{typeof value === 'number' ? value.toFixed(1) : value}</span>
  </div>
);

const TABS = [
  { key: 'overview',  label: 'Overview' },
  { key: 'journey',   label: 'Journey' },
  { key: 'financial', label: 'Financial' },
  { key: 'reviews',   label: 'Reviews' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'actions',   label: 'Actions' },
];

/* ══════════════════════════════════════════════════════════ */
const AdminBookingDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [vehicleDetails, setVehicleDetails] = useState(null);
  const [siblingBookings, setSiblingBookings] = useState([]);
  const [passengerStats, setPassengerStats] = useState(null);
  const [riderStats, setRiderStats] = useState(null);
  const [carbonData, setCarbonData] = useState(null);
  const [priceComparison, setPriceComparison] = useState(null);
  const [lifecycle, setLifecycle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { fetchBookingDetails(); }, [id]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    try {
      const r = await adminService.getBookingById(id);
      if (r.success) {
        setBooking(r.booking);
        setReviews(r.reviews || []);
        setVehicleDetails(r.vehicleDetails || null);
        setSiblingBookings(r.siblingBookings || []);
        setPassengerStats(r.passengerStats || null);
        setRiderStats(r.riderStats || null);
        setCarbonData(r.carbonData || null);
        setPriceComparison(r.priceComparison || null);
        setLifecycle(r.lifecycle || null);
        setRefundAmount(r.booking.totalPrice?.toString() || '');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) { setError('Enter valid amount'); return; }
    if (!window.confirm(`Refund ₹${refundAmount}?`)) return;
    try {
      const r = await adminService.refundBooking(id, parseFloat(refundAmount));
      if (r.success) { setSuccess('Refund processed'); setShowRefundModal(false); fetchBookingDetails(); }
    } catch (err) { setError(err.message || 'Refund failed'); }
  };

  /* ── Badge Helpers ── */
  const badge = (status, map) => {
    const cls = map[status] || 'bg-zinc-100 text-zinc-800';
    return <span className={`px-3 py-1 rounded-md text-sm font-semibold ${cls}`}>{status}</span>;
  };
  const statusBadge = (s) => badge(s, {
    'PENDING': 'bg-yellow-100 text-yellow-800', 'CONFIRMED': 'bg-green-100 text-green-800',
    'CANCELLED': 'bg-red-100 text-red-800', 'COMPLETED': 'bg-emerald-100 text-emerald-800',
    'PICKUP_PENDING': 'bg-zinc-100 text-zinc-800', 'PICKED_UP': 'bg-blue-100 text-blue-800',
    'IN_TRANSIT': 'bg-sky-100 text-sky-800', 'DROPOFF_PENDING': 'bg-teal-100 text-teal-800',
    'DROPPED_OFF': 'bg-cyan-100 text-cyan-800', 'EXPIRED': 'bg-zinc-100 text-zinc-800',
    'REJECTED': 'bg-rose-100 text-rose-800', 'NO_SHOW': 'bg-orange-100 text-orange-800'
  });
  const payBadge = (s) => badge(s, {
    'PAID': 'bg-green-100 text-green-800', 'PAYMENT_CONFIRMED': 'bg-emerald-100 text-emerald-800',
    'PENDING': 'bg-yellow-100 text-yellow-800', 'REFUNDED': 'bg-blue-100 text-blue-800',
    'FAILED': 'bg-red-100 text-red-800'
  });

  /* ── Status Flow ── */
  const STATUS_FLOW = ['PENDING', 'CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP', 'IN_TRANSIT', 'DROPOFF_PENDING', 'DROPPED_OFF', 'COMPLETED'];
  const TERMINAL = ['CANCELLED', 'REJECTED', 'EXPIRED', 'NO_SHOW'];
  const isTerminal = TERMINAL.includes(booking?.status);
  const currentIdx = STATUS_FLOW.indexOf(booking?.status);

  /* ── Loading / Missing ── */
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }
  if (!booking) {
    return (
      <div className="p-6">
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">Booking not found</div>
        <button onClick={() => navigate('/admin/bookings')} className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg dark:bg-zinc-100 dark:text-zinc-900">← Back</button>
      </div>
    );
  }

  const commission = booking.payment?.platformCommission || 0;
  const rideFare = booking.payment?.rideFare || 0;
  const payout = booking.payment?.riderPayout;
  const dist = booking.journey?.distance || booking.ride?.route?.distance || 0;

  /* ══════════════════════════════════════════════════════ */
  return (
    <div className="p-6 max-w-6xl mx-auto min-h-screen" >

      {/* ── Hero Header ─────────────────────────────────── */}
      <div className="rounded-lg overflow-hidden mb-6 bg-zinc-900 dark:bg-zinc-800">
        <div className="p-8 text-white">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate('/admin/bookings')} className="px-4 py-2 bg-white/20 backdrop-blur rounded-lg hover:bg-white/30 transition text-sm font-medium">
              ← Back to Bookings
            </button>
            <div className="flex items-center gap-3">
              {statusBadge(booking.status)}
              {booking.bidding?.isCounterOffer && (
                <span className="px-3 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800">
                  Bidding
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-white/70 text-sm mb-1">Booking Reference</p>
              <h1 className="text-3xl font-bold font-mono tracking-wide" >
                {booking.bookingReference || booking._id}
              </h1>
              <p className="text-white/60 text-sm mt-1 font-mono">{booking._id}</p>
              <p className="text-white/70 mt-2 flex items-center gap-4 flex-wrap">
                <span>{fmtDT(booking.createdAt)}</span>
                <span>{booking.seatsBooked || 1} seat(s)</span>
                {dist > 0 && <span>{dist.toFixed(1)} km</span>}
              </p>
            </div>

            {/* Key Financial Summary */}
            <div className="flex gap-4 flex-wrap">
              <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center min-w-[100px]">
                <p className="text-white/70 text-xs">Total Price</p>
                <p className="text-2xl font-bold">₹{booking.totalPrice || 0}</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center min-w-[100px]">
                <p className="text-white/70 text-xs">Platform Revenue</p>
                <p className="text-2xl font-bold text-green-300">₹{commission}</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center min-w-[100px]">
                <p className="text-white/70 text-xs">Rider Earnings</p>
                <p className="text-2xl font-bold text-blue-200">₹{rideFare}</p>
              </div>
            </div>
          </div>

          {/* Status Flow Stepper */}
          <div className="mt-6 pt-4 border-t border-white/20">
            {!isTerminal ? (
              <div className="flex items-center gap-1 overflow-x-auto pb-1">
                {STATUS_FLOW.map((step, idx) => {
                  const done = idx <= currentIdx;
                  const active = idx === currentIdx;
                  return (
                    <div key={step} className="flex items-center">
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap transition
                        ${active ? 'bg-white text-zinc-900 shadow-sm' : done ? 'bg-white/30 text-white' : 'bg-white/10 text-white/40'}`}>
                        {done && !active && <Check size={10} />}
                        {active && <CircleDot size={8} />}
                        {step.replace(/_/g, ' ')}
                      </div>
                      {idx < STATUS_FLOW.length - 1 && <ChevronRight size={10} className={cn('mx-0.5', done ? 'text-white/50' : 'text-white/20')} />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-md text-xs font-bold bg-red-500/30 text-red-200">
                  {booking.status}
                </span>
                {booking.cancellation?.reason && (
                  <span className="text-sm text-white/60">— {booking.cancellation.reason}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ──────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-1.5 mb-6 flex gap-1 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn('px-4 py-2.5 rounded-lg font-semibold text-sm transition whitespace-nowrap flex items-center gap-2',
              activeTab === t.key ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800')}>
            {t.label}
            {t.key === 'reviews' && reviews.length > 0 && (
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === t.key ? 'bg-white/30' : 'bg-zinc-200'}`}>{reviews.length}</span>
            )}
          </button>
        ))}
      </div>

      {error && <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 flex items-center justify-between"><span>{error}</span><button onClick={() => setError('')} className="text-red-400 hover:text-red-600">&times;</button></div>}
      {success && <div className="mb-6 p-4 rounded-lg border border-green-200 bg-green-50 text-green-700 text-sm dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 flex items-center justify-between"><span>{success}</span><button onClick={() => setSuccess('')} className="text-green-400 hover:text-green-600">&times;</button></div>}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: OVERVIEW                                      */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <StatCard value={`₹${booking.totalPrice || 0}`} label="Total Price" />
            <StatCard value={booking.seatsBooked || 1} label="Seats Booked" />
            <StatCard value={booking.payment?.method || 'CASH'} label="Payment Method" />
            <StatCard value={dur(booking.journey?.duration)} label="Journey Duration" />
            <StatCard value={dist > 0 ? `${dist.toFixed(1)} km` : '—'} label="Distance" />
            <StatCard
              value={booking.riderResponse?.responseTime ? `${booking.riderResponse.responseTime}m` : '—'}
              label="Response Time"
              sub={booking.riderResponse?.responseTime ? (booking.riderResponse.responseTime <= 5 ? 'Fast' : booking.riderResponse.responseTime <= 15 ? 'Normal' : 'Slow') : null}
            />
          </div>

          {/* Passenger + Driver Side-by-Side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Passenger Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4">
Passenger
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-bold text-xl">
                  {(booking.passenger?.profile?.firstName?.[0] || 'P').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-800 text-lg truncate">
                    {booking.passenger?.profile?.firstName || ''} {booking.passenger?.profile?.lastName || 'Unknown'}
                  </p>
                  <p className="text-sm text-zinc-500 truncate">{booking.passenger?.email}</p>
                  {booking.passenger?.phone && <p className="text-sm text-zinc-400">{booking.passenger.phone}</p>}
                </div>
                <button onClick={() => navigate(`/admin/users/${booking.passenger?._id}`)} className="p-2 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 transition text-sm flex-shrink-0">
                  <Eye size={14} />
                </button>
              </div>
              {booking.passenger?.rating?.average > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <Stars rating={booking.passenger.rating.average} />
                  <span className="text-sm text-zinc-500">{booking.passenger.rating.average.toFixed(1)} ({booking.passenger.rating.count || 0})</span>
                </div>
              )}
              {passengerStats && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-center">
                  <div>
                    <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300">{passengerStats.totalBookings}</p>
                    <p className="text-[10px] text-zinc-500">Bookings</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{pct(passengerStats.completed, passengerStats.totalBookings)}%</p>
                    <p className="text-[10px] text-zinc-500">Completion</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">₹{Math.round(passengerStats.totalSpent || 0)}</p>
                    <p className="text-[10px] text-zinc-500">Total Spent</p>
                  </div>
                </div>
              )}
              {booking.passenger?.verificationStatus && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {booking.passenger.verificationStatus.email && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-xs"><Check size={12} className="inline" /> Email</span>}
                  {booking.passenger.verificationStatus.phone && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-xs"><Check size={12} className="inline" /> Phone</span>}
                  {booking.passenger.verificationStatus.identity && <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-md text-xs"><Check size={12} className="inline" /> ID</span>}
                </div>
              )}
            </div>

            {/* Driver Card */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-zinc-800 mb-4">
Driver
              </h3>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-bold text-xl">
                  {(booking.ride?.rider?.profile?.firstName?.[0] || 'D').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-zinc-800 text-lg truncate">
                    {booking.ride?.rider?.profile?.firstName || ''} {booking.ride?.rider?.profile?.lastName || 'Unknown'}
                  </p>
                  <p className="text-sm text-zinc-500 truncate">{booking.ride?.rider?.email}</p>
                  {booking.ride?.rider?.phone && <p className="text-sm text-zinc-400">{booking.ride.rider.phone}</p>}
                </div>
                {booking.ride?.rider?._id && (
                  <button onClick={() => navigate(`/admin/users/${booking.ride.rider._id}`)} className="p-2 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 transition text-sm flex-shrink-0">
                    <Eye size={14} />
                  </button>
                )}
              </div>
              {booking.ride?.rider?.rating?.average > 0 && (
                <div className="flex items-center gap-2 mb-3">
                  <Stars rating={booking.ride.rider.rating.average} />
                  <span className="text-sm text-zinc-500">{booking.ride.rider.rating.average.toFixed(1)} ({booking.ride.rider.rating.count || 0})</span>
                </div>
              )}
              {riderStats && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-center">
                  <div>
                    <p className="text-lg font-bold text-zinc-700 dark:text-zinc-300">{riderStats.totalBookingsHandled}</p>
                    <p className="text-[10px] text-zinc-500">Handled</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">{pct(riderStats.completed, riderStats.totalBookingsHandled)}%</p>
                    <p className="text-[10px] text-zinc-500">Completion</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-emerald-600">₹{Math.round(riderStats.totalEarned || 0)}</p>
                    <p className="text-[10px] text-zinc-500">Earned</p>
                  </div>
                </div>
              )}
              {/* Response Time Indicator */}
              {booking.riderResponse?.responseTime != null && (
                <div className="mt-3 p-3 bg-zinc-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-zinc-500">Response Time</span>
                    <span className={`text-xs font-semibold ${booking.riderResponse.responseTime <= 5 ? 'text-green-600' : booking.riderResponse.responseTime <= 15 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {booking.riderResponse.responseTime}m
                      {booking.riderResponse.responseTime <= 5 ? ' (Lightning)' : booking.riderResponse.responseTime <= 15 ? ' (Good)' : ' (Slow)'}
                    </span>
                  </div>
                  <div className="h-2 bg-zinc-200 rounded-md overflow-hidden">
                    <div className={`h-full rounded-md transition-all ${booking.riderResponse.responseTime <= 5 ? 'bg-green-500' : booking.riderResponse.responseTime <= 15 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(100, (booking.riderResponse.responseTime / 30) * 100)}%` }} />
                  </div>
                  {booking.riderResponse.message && (
                    <p className="text-xs text-zinc-500 italic mt-1">"{booking.riderResponse.message}"</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Special Requests & Co-Passengers */}
          {(booking.specialRequests || booking.coPassengers?.length > 0) && (
            <Section title="Special Requests & Co-Passengers">
              {booking.specialRequests && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                  <p className="text-sm text-amber-800">{booking.specialRequests}</p>
                </div>
              )}
              {booking.coPassengers?.length > 0 && (
                <div>
                  <p className="text-sm text-zinc-600 font-semibold mb-2">Co-Passengers ({booking.coPassengers.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {booking.coPassengers.map((cp, i) => (
                      <span key={i} className="px-3 py-1.5 bg-zinc-100 rounded-md text-sm text-zinc-700 border">
                        
                        {cp.name}{cp.phone ? ` · ${cp.phone}` : ''}{cp.age ? ` · Age ${cp.age}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Vehicle */}
          {vehicleDetails && (
            <Section title="Vehicle Information">
              <div className="flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Car size={24} className="text-zinc-600" />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-800 text-lg">{vehicleDetails.make} {vehicleDetails.model}</p>
                    <p className="text-sm text-zinc-500">{vehicleDetails.color} · {vehicleDetails.year}</p>
                  </div>
                </div>
                {vehicleDetails.licensePlate && (
                  <div className="px-4 py-2 bg-yellow-50 border-2 border-yellow-300 rounded-lg font-mono font-bold text-zinc-800 text-lg">
                    {vehicleDetails.licensePlate}
                  </div>
                )}
                {vehicleDetails.type && (
                  <div className="px-3 py-2 bg-zinc-100 rounded-lg text-sm text-zinc-600">
                    {vehicleDetails.type}
                  </div>
                )}
              </div>
            </Section>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: JOURNEY                                       */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'journey' && (
        <>
          {/* Route Visualization */}
          <Section title="Route Details">
            {/* Rider's Full Route */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Rider's Full Route</p>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-md bg-zinc-400 mt-1.5 ring-2 ring-zinc-200"></div>
                  <div>
                    <p className="text-xs text-zinc-400">Origin</p>
                    <p className="font-semibold text-zinc-700">{booking.ride?.route?.start?.name || booking.ride?.route?.start?.address || 'Unknown'}</p>
                    {booking.ride?.route?.start?.address && booking.ride?.route?.start?.name && <p className="text-xs text-zinc-400">{booking.ride.route.start.address}</p>}
                  </div>
                </div>
                {booking.ride?.route?.intermediateStops?.length > 0 && (
                  <div className="ml-1 pl-4 border-l-2 border-dashed border-zinc-200 space-y-2">
                    {booking.ride.route.intermediateStops.sort((a, b) => (a.order || 0) - (b.order || 0)).map((stop, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-md bg-zinc-300 mt-1.5"></div>
                        <p className="text-sm text-zinc-600">{stop.name || stop.address || `Stop ${idx + 1}`}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-md bg-zinc-400 mt-1.5 ring-2 ring-zinc-200"></div>
                  <div>
                    <p className="text-xs text-zinc-400">Destination</p>
                    <p className="font-semibold text-zinc-700">{booking.ride?.route?.destination?.name || booking.ride?.route?.destination?.address || 'Unknown'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Passenger Pickup & Dropoff */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 mb-4">
              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-3">Passenger's Pickup & Dropoff</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0">
                    <MapPin size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-500 mb-0.5">Pickup Point</p>
                    <p className="font-semibold text-zinc-800">{booking.pickupPoint?.name || booking.pickupPoint?.address || 'Same as start'}</p>
                    {booking.pickupPoint?.estimatedTime && <p className="text-xs text-zinc-400">ETA: {booking.pickupPoint.estimatedTime}</p>}
                    {booking.pickupPoint?.distanceFromStart > 0 && <p className="text-xs text-zinc-400">{booking.pickupPoint.distanceFromStart.toFixed(1)} km from start</p>}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-red-500 flex items-center justify-center flex-shrink-0">
                    <CircleDot size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-500 mb-0.5">Dropoff Point</p>
                    <p className="font-semibold text-zinc-800">{booking.dropoffPoint?.name || booking.dropoffPoint?.address || 'Same as end'}</p>
                    {booking.dropoffPoint?.estimatedTime && <p className="text-xs text-zinc-400">ETA: {booking.dropoffPoint.estimatedTime}</p>}
                    {booking.dropoffPoint?.distanceFromEnd > 0 && <p className="text-xs text-zinc-400">{booking.dropoffPoint.distanceFromEnd.toFixed(1)} km from end</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Ride Quick Info */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
              <div className="bg-zinc-50 p-3 rounded-lg">
                <p className="text-sm text-zinc-500">Departure</p>
                <p className="font-semibold text-zinc-800 text-sm">{fmtDT(booking.ride?.schedule?.departureDateTime)}</p>
              </div>
              <div className="bg-zinc-50 p-3 rounded-lg">
                <p className="text-sm text-zinc-500">Ride Status</p>
                {statusBadge(booking.ride?.status || 'N/A')}
              </div>
              <div className="bg-zinc-50 p-3 rounded-lg">
                <p className="text-sm text-zinc-500">Total Ride Distance</p>
                <p className="font-semibold text-zinc-800">{booking.ride?.route?.distance ? `${booking.ride.route.distance.toFixed(1)} km` : 'N/A'}</p>
              </div>
              <div className="bg-zinc-50 p-3 rounded-lg">
                <p className="text-sm text-zinc-500">Vehicle</p>
                <p className="font-semibold text-zinc-800">{vehicleDetails ? `${vehicleDetails.make} ${vehicleDetails.model}` : 'N/A'}</p>
              </div>
            </div>

            {booking.ride?._id && (
              <button onClick={() => navigate(`/admin/rides/${booking.ride._id}`)} className="mt-4 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 transition text-sm font-semibold">
                View Full Ride Details →
              </button>
            )}
          </Section>

          {/* OTP Verification */}
          <Section title="OTP Verification">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['pickup', 'dropoff'].map(type => {
                const v = booking.verification?.[type];
                const verified = v?.verified;
                return (
                  <div key={type} className={`p-5 rounded-lg border-2 transition ${verified ? 'bg-green-50 border-green-200' : 'bg-zinc-50 border-zinc-200'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-10 h-10 rounded-md flex items-center justify-center ${verified ? 'bg-green-500' : 'bg-zinc-300'}`}>
                          {verified ? <Check size={16} className="text-white" /> : <Clock size={16} className="text-white" />}
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-700 capitalize">{type} OTP</p>
                          <p className={`text-xs font-semibold ${verified ? 'text-green-600' : 'text-zinc-400'}`}>
                            {verified ? 'Verified' : 'Not Verified'}
                          </p>
                        </div>
                      </div>
                      {v?.attempts > 0 && (
                        <span className={`px-2 py-1 rounded-md text-xs font-semibold ${v.attempts > 3 ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'}`}>
                          {v.attempts} attempt{v.attempts !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {v?.verifiedAt && <p className="text-xs text-zinc-400">{fmtDT(v.verifiedAt)}</p>}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Journey Metrics */}
          {(booking.journey?.started || booking.journey?.completed) && (
            <Section title="Journey Metrics">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {booking.journey.startedAt && <StatCard value={new Date(booking.journey.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} label="Started" />}
                {booking.journey.completedAt && <StatCard value={new Date(booking.journey.completedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} label="Completed" />}
                {booking.journey.duration > 0 && <StatCard value={dur(booking.journey.duration)} label="Duration" />}
                {booking.journey.distance > 0 && <StatCard value={`${booking.journey.distance.toFixed(1)} km`} label="Distance" />}
              </div>
              {/* Speed estimate */}
              {booking.journey?.duration > 0 && booking.journey?.distance > 0 && (
                <div className="mt-4 p-3 bg-zinc-50 rounded-lg flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Average Speed</span>
                  <span className="font-bold text-zinc-800">{((booking.journey.distance / booking.journey.duration) * 60).toFixed(1)} km/h</span>
                </div>
              )}
            </Section>
          )}

          {/* Lifecycle Timeline */}
          <Section title="Booking Lifecycle">
            {lifecycle?.events?.length > 0 ? (
              <div className="relative">
                <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-zinc-200"></div>
                <div className="space-y-6">
                  {lifecycle.events.map((evt, idx) => {
                    const transition = lifecycle.transitions?.[idx];
                    return (
                      <div key={idx} className="flex items-start gap-4 relative">
                        <div className="w-10 h-10 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 z-10 border border-zinc-200 dark:border-zinc-700">
                          <CircleDot size={16} className="text-zinc-600 dark:text-zinc-400" />
                        </div>
                        <div className="flex-1 pb-2">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-zinc-800">{evt.status.replace(/_/g, ' ')}</p>
                            <p className="text-xs text-zinc-400">{fmtDT(evt.at)}</p>
                          </div>
                          {transition && (
                            <p className="text-xs text-zinc-500 mt-0.5">
                              Next step in {dur(transition.durationMin)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {lifecycle.totalLifecycleMin > 0 && (
                  <div className="mt-4 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-between">
                    <span className="text-sm text-zinc-700 dark:text-zinc-300 font-semibold">Total Lifecycle Duration</span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">{dur(lifecycle.totalLifecycleMin)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <TimelineEvent title="Booking Created" time={booking.createdAt} />
                {booking.riderResponse?.respondedAt && (
                  <TimelineEvent title="Rider Responded" time={booking.riderResponse.respondedAt}
                    extra={booking.riderResponse.message && <p className="text-sm text-zinc-500 italic">"{booking.riderResponse.message}"</p>} />
                )}
                {booking.verification?.pickup?.verifiedAt && <TimelineEvent title="Pickup Verified" time={booking.verification.pickup.verifiedAt} />}
                {booking.journey?.startedAt && <TimelineEvent title="Journey Started" time={booking.journey.startedAt} />}
                {booking.verification?.dropoff?.verifiedAt && <TimelineEvent title="Dropoff Verified" time={booking.verification.dropoff.verifiedAt} />}
                {booking.journey?.completedAt && <TimelineEvent title="Completed" time={booking.journey.completedAt} />}
                {booking.cancellation?.cancelledAt && <TimelineEvent title={`Cancelled (${booking.cancellation.cancelledBy})`} time={booking.cancellation.cancelledAt} />}
                {booking.payment?.paidAt && <TimelineEvent title="Payment Received" time={booking.payment.paidAt} />}
              </div>
            )}
          </Section>
        </>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: FINANCIAL                                     */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'financial' && (
        <>
          {/* Revenue Breakdown */}
          <div className="bg-zinc-900 dark:bg-zinc-800 rounded-lg p-6 mb-6 text-white">
            <h3 className="text-lg font-semibold mb-4">Revenue Breakdown</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center">
                <p className="text-white/70 text-xs">Total Charged</p>
                <p className="text-3xl font-bold">₹{booking.payment?.totalAmount || booking.totalPrice || 0}</p>
              </div>
              <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center">
                <p className="text-white/70 text-xs">Rider's Share</p>
                <p className="text-3xl font-bold">₹{rideFare}</p>
                {booking.totalPrice > 0 && <p className="text-xs text-white/60">{pct(rideFare, booking.totalPrice)}%</p>}
              </div>
              <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center">
                <p className="text-white/70 text-xs">Platform Commission</p>
                <p className="text-3xl font-bold text-green-200">₹{commission}</p>
                {booking.totalPrice > 0 && <p className="text-xs text-white/60">{pct(commission, booking.totalPrice)}% rate</p>}
              </div>
              <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center">
                <p className="text-white/70 text-xs">Per Seat</p>
                <p className="text-3xl font-bold">₹{booking.seatsBooked > 0 ? Math.round(booking.totalPrice / booking.seatsBooked) : 0}</p>
                <p className="text-xs text-white/60">{booking.seatsBooked} seat(s)</p>
              </div>
            </div>
          </div>

          {/* Price Comparison — Savings */}
          {priceComparison && priceComparison.estimatedTaxiPrice > 0 && (
            <Section title="Price Comparison — Savings vs Alternatives">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-center border border-zinc-200 dark:border-zinc-700">
                  <p className="text-xs text-zinc-500 mb-1">Carpool (This Booking)</p>
                  <p className="text-2xl font-bold text-zinc-700">₹{priceComparison.carpoolPrice}</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg text-center border border-yellow-100">
                  <p className="text-xs text-zinc-500 mb-1">Estimated Taxi</p>
                  <p className="text-2xl font-bold text-yellow-600">₹{priceComparison.estimatedTaxiPrice}</p>
                  <p className="text-xs text-zinc-400">~₹14/km</p>
                </div>
                <div className="p-4 bg-orange-50 rounded-lg text-center border border-orange-100">
                  <p className="text-xs text-zinc-500 mb-1">Estimated Auto</p>
                  <p className="text-2xl font-bold text-orange-600">₹{priceComparison.estimatedAutoPrice}</p>
                  <p className="text-xs text-zinc-400">~₹10/km</p>
                </div>
              </div>
              {priceComparison.savings > 0 && (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700 font-semibold">Passenger Saved</p>
                    <p className="text-xs text-green-600">Compared to taking a taxi</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-700">₹{priceComparison.savings}</p>
                    <p className="text-xs text-green-500">{priceComparison.savingsPercent}% cheaper</p>
                  </div>
                </div>
              )}
            </Section>
          )}

          {/* Payment Details */}
          <Section title="Payment Details">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-zinc-50 p-4 rounded-lg">
                <p className="text-sm text-zinc-500">Status</p>
                {payBadge(booking.payment?.status || 'PENDING')}
              </div>
              <div className="bg-zinc-50 p-4 rounded-lg">
                <p className="text-sm text-zinc-500">Method</p>
                <p className="font-semibold text-zinc-800 flex items-center gap-2">
                  <CreditCard size={16} className="text-zinc-400" />
                  {booking.payment?.method || 'Cash'}
                </p>
              </div>
              <div className="bg-zinc-50 p-4 rounded-lg">
                <p className="text-sm text-zinc-500">Transaction ID</p>
                <p className="font-mono text-sm text-zinc-700 truncate">{booking.payment?.transactionId || '—'}</p>
              </div>
              <div className="bg-zinc-50 p-4 rounded-lg">
                <p className="text-sm text-zinc-500">Paid At</p>
                <p className="font-semibold text-sm text-zinc-800">{booking.payment?.paidAt ? fmtDT(booking.payment.paidAt) : '—'}</p>
              </div>
            </div>

            {/* Rider Payment Confirmation */}
            {booking.payment?.riderConfirmedPayment && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
                <p className="text-sm text-green-700">Rider confirmed payment receipt</p>
                {booking.payment.riderConfirmedAt && <p className="text-xs text-green-600">Confirmed: {fmtDT(booking.payment.riderConfirmedAt)}</p>}
              </div>
            )}

            {/* Rider Payout */}
            {payout && (payout.settled || payout.amount > 0) && (
              <div className={`p-4 rounded-lg border-2 ${payout.settled ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-zinc-700">Rider Payout</p>
                  <span className={`px-3 py-1 rounded-md text-xs font-semibold ${payout.settled ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {payout.settled ? '✅ Settled' : '⏳ Pending'}
                  </span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div><p className="text-zinc-500 text-xs">Amount</p><p className="font-bold text-zinc-800">₹{payout.amount || 0}</p></div>
                  {payout.method && <div><p className="text-zinc-500 text-xs">Method</p><p className="font-semibold text-zinc-700">{payout.method}</p></div>}
                  {payout.settledAt && <div><p className="text-zinc-500 text-xs">Settled At</p><p className="font-semibold text-zinc-700">{fmtDT(payout.settledAt)}</p></div>}
                  {payout.transactionId && <div><p className="text-zinc-500 text-xs">Txn ID</p><p className="font-mono text-zinc-700 text-xs truncate">{payout.transactionId}</p></div>}
                </div>
              </div>
            )}

            {/* Refund */}
            {booking.payment?.status === 'REFUNDED' && (
              <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600 font-semibold">Refund Processed</p>
                    {booking.payment.refundedAt && <p className="text-xs text-blue-500">{fmtDT(booking.payment.refundedAt)}</p>}
                  </div>
                  <p className="text-2xl font-bold text-zinc-700 dark:text-zinc-300">₹{booking.payment.refundAmount || booking.totalPrice}</p>
                </div>
              </div>
            )}
          </Section>

          {/* Bidding / Counter-Offer */}
          {booking.bidding?.isCounterOffer && (
            <Section title="Bidding / Counter-Offer">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-zinc-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-zinc-500">Original Price</p>
                  <p className="text-2xl font-bold text-zinc-800">₹{booking.bidding.originalPrice || 0}</p>
                </div>
                <div className="bg-amber-50 p-4 rounded-lg text-center border border-amber-200">
                  <p className="text-sm text-amber-600">Proposed Price</p>
                  <p className="text-2xl font-bold text-amber-700">₹{booking.bidding.proposedPrice || 0}</p>
                  {booking.bidding.originalPrice > 0 && (
                    <p className="text-xs text-zinc-400">
                      {booking.bidding.proposedPrice > booking.bidding.originalPrice ? '▲' : '▼'}
                      {Math.abs(pct(booking.bidding.proposedPrice - booking.bidding.originalPrice, booking.bidding.originalPrice))}% diff
                    </p>
                  )}
                </div>
                <div className="bg-zinc-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-zinc-500">Final Price</p>
                  <p className="text-2xl font-bold text-emerald-600">₹{booking.totalPrice || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <p className="text-sm text-zinc-500">Bidding Status:</p>
                <span className={`px-3 py-1 rounded-md text-xs font-semibold ${
                  booking.bidding.biddingStatus === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                  booking.bidding.biddingStatus === 'REJECTED' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'
                }`}>{booking.bidding.biddingStatus}</span>
              </div>
              {booking.bidding.biddingHistory?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-zinc-600 mb-3">Negotiation History ({booking.bidding.biddingHistory.length} round(s))</p>
                  <div className="space-y-2">
                    {booking.bidding.biddingHistory.map((h, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 rounded-lg border">
                        <span className="text-sm text-zinc-400 w-6">#{i + 1}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${h.proposedBy === 'RIDER' ? 'bg-blue-100 text-zinc-700 dark:text-zinc-300' : 'bg-purple-100 text-zinc-700 dark:text-zinc-300'}`}>
                          {h.proposedBy}
                        </span>
                        <span className="font-bold text-zinc-800">₹{h.amount}</span>
                        {h.message && <span className="text-zinc-500 text-sm italic flex-1">"{h.message}"</span>}
                        <span className="text-xs text-zinc-400 ml-auto">{fmtDT(h.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: REVIEWS                                       */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'reviews' && (
        <>
          {/* Review Status */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`p-4 rounded-lg border-2 ${booking.reviews?.passengerReviewed ? 'bg-green-50 border-green-200' : 'bg-zinc-50 border-zinc-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${booking.reviews?.passengerReviewed ? 'bg-green-500' : 'bg-zinc-300'}`}>
                  {booking.reviews?.passengerReviewed ? <Check size={16} className="text-white" /> : <Clock size={16} className="text-white" />}
                </div>
                <div>
                  <p className="font-semibold text-zinc-700">Passenger Review</p>
                  <p className={`text-xs ${booking.reviews?.passengerReviewed ? 'text-green-600' : 'text-zinc-400'}`}>
                    {booking.reviews?.passengerReviewed ? 'Submitted' : 'Not yet submitted'}
                  </p>
                </div>
              </div>
            </div>
            <div className={`p-4 rounded-lg border-2 ${booking.reviews?.riderReviewed ? 'bg-green-50 border-green-200' : 'bg-zinc-50 border-zinc-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${booking.reviews?.riderReviewed ? 'bg-green-500' : 'bg-zinc-300'}`}>
                  {booking.reviews?.riderReviewed ? <Check size={16} className="text-white" /> : <Clock size={16} className="text-white" />}
                </div>
                <div>
                  <p className="font-semibold text-zinc-700">Rider Review</p>
                  <p className={`text-xs ${booking.reviews?.riderReviewed ? 'text-green-600' : 'text-zinc-400'}`}>
                    {booking.reviews?.riderReviewed ? 'Submitted' : 'Not yet submitted'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map(review => (
                <Section key={review._id} title={`${review.type === 'DRIVER_REVIEW' ? '🚗 Driver' : '👤 Passenger'} Review`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-md bg-yellow-100 flex items-center justify-center text-yellow-700 font-bold text-xl">
                        {review.ratings?.overall || '?'}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-800">
                          {review.reviewer?.profile?.firstName || 'Unknown'} → {review.reviewee?.profile?.firstName || 'Unknown'}
                        </p>
                        <Stars rating={review.ratings?.overall || 0} />
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400">{fmtDT(review.createdAt)}</p>
                  </div>

                  {/* Category Ratings */}
                  {review.ratings?.categories && (
                    <div className="space-y-2 mb-4">
                      {Object.entries(review.ratings.categories)
                        .filter(([, v]) => v && v > 0)
                        .map(([cat, val]) => (
                          <BarGauge key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)} value={val} max={5} color={val >= 4 ? 'green' : val >= 3 ? 'yellow' : 'red'} />
                        ))}
                    </div>
                  )}

                  {/* Tags */}
                  {review.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {review.tags.map((tag, i) => {
                        const positive = ['GREAT_CONVERSATION', 'SMOOTH_DRIVER', 'CLEAN_CAR', 'ON_TIME', 'SAFE_DRIVER', 'FLEXIBLE', 'FRIENDLY', 'RESPECTFUL', 'QUIET', 'GOOD_COMPANY'].includes(tag);
                        return (
                          <span key={i} className={`px-2.5 py-1 rounded-md text-xs font-medium ${positive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {positive ? '👍' : '👎'} {tag.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {review.comment && (
                    <div className="p-3 bg-zinc-50 rounded-lg border">
                      <p className="text-sm text-zinc-700 italic">"{review.comment}"</p>
                    </div>
                  )}

                  {review.response?.text && (
                    <div className="mt-2 p-3 bg-blue-50 rounded-lg">
                      <p className="text-xs text-blue-600 font-semibold mb-1">Response:</p>
                      <p className="text-sm text-zinc-700">{review.response.text}</p>
                    </div>
                  )}

                  {review.photos?.length > 0 && (
                    <div className="mt-3 flex gap-2 flex-wrap">
                      {review.photos.map((p, i) => (
                        <img key={i} src={p} alt={`Review photo ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border" />
                      ))}
                    </div>
                  )}
                </Section>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="text-5xl text-zinc-200 mb-3"></div>
              <p className="text-zinc-500">No reviews submitted for this booking yet.</p>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: ANALYTICS                                     */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'analytics' && (
        <>
          {/* Carbon Footprint */}
          {carbonData && carbonData.distance > 0 && (
            <div className="bg-zinc-900 dark:bg-zinc-800 rounded-lg p-6 mb-6 text-white">
              <h3 className="text-lg font-semibold mb-4">Carbon Footprint Impact</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center">
                  <p className="text-white/70 text-xs">Solo Driving Emissions</p>
                  <p className="text-2xl font-bold">{(carbonData.soloEmissions / 1000).toFixed(2)} kg</p>
                  <p className="text-xs text-white/60">CO₂</p>
                </div>
                <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center">
                  <p className="text-white/70 text-xs">Shared Emissions</p>
                  <p className="text-2xl font-bold">{(carbonData.sharedEmissions / 1000).toFixed(2)} kg</p>
                  <p className="text-xs text-white/60">CO₂</p>
                </div>
                <div className="bg-white/25 backdrop-blur rounded-lg p-4 text-center border border-white/30">
                  <p className="text-white/80 text-xs font-semibold">CO₂ Saved</p>
                  <p className="text-3xl font-bold text-green-200">{(carbonData.saved / 1000).toFixed(2)} kg</p>
                </div>
                <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center">
                  <p className="text-white/70 text-xs">Trees Equivalent</p>
                  <p className="text-2xl font-bold">🌳 {carbonData.treesEquivalent}</p>
                  <p className="text-xs text-white/60">annual absorption</p>
                </div>
              </div>
            </div>
          )}

          {/* Sibling Bookings — Other passengers on same ride */}
          <Section title={`Other Bookings on This Ride (${siblingBookings.length})`}>
            {siblingBookings.length > 0 ? (
              <div className="space-y-3">
                {siblingBookings.map(sb => (
                  <div key={sb._id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border hover:bg-zinc-100 transition cursor-pointer"
                    onClick={() => navigate(`/admin/bookings/${sb._id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 font-bold text-sm">
                        {(sb.passenger?.profile?.firstName?.[0] || '?').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-zinc-800 text-sm">
                          {sb.passenger?.profile?.firstName || 'Unknown'} {sb.passenger?.profile?.lastName || ''}
                        </p>
                        <p className="text-xs text-zinc-400">{sb.bookingReference || sb._id.toString().slice(-8)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-emerald-600 text-sm">₹{sb.totalPrice || 0}</p>
                        {sb.payment?.platformCommission > 0 && <p className="text-[10px] text-zinc-500">₹{sb.payment.platformCommission} comm.</p>}
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        sb.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                        sb.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                        'bg-zinc-100 text-zinc-700'
                      }`}>{sb.status}</span>
                      <ChevronRight size={14} className="text-zinc-300" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-400 text-center py-4">No other bookings on this ride.</p>
            )}
          </Section>

          {/* Passenger Reliability Profile */}
          {passengerStats && (
            <Section title="Passenger Reliability Profile">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <StatCard value={passengerStats.totalBookings} label="Total Bookings" />
                <StatCard value={passengerStats.completed} label="Completed" />
                <StatCard value={passengerStats.cancelled} label="Cancelled" />
                <StatCard value={passengerStats.noShow} label="No-Shows" />
                <StatCard
                  value={`${pct(passengerStats.completed, passengerStats.totalBookings)}%`}
                  label="Reliability Score"
                  sub={passengerStats.completed === passengerStats.totalBookings ? 'Perfect' : null}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <p className="text-xs text-zinc-500">Avg Booking Value</p>
                  <p className="font-bold text-zinc-800">₹{Math.round(passengerStats.avgPrice || 0)}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <p className="text-xs text-zinc-500">Total Platform Revenue</p>
                  <p className="font-bold text-zinc-700">₹{Math.round(passengerStats.totalPlatformRevenue || 0)}</p>
                </div>
                <div className="p-3 bg-zinc-50 rounded-lg">
                  <p className="text-xs text-zinc-500">Bidding Bookings</p>
                  <p className="font-bold text-amber-600">{passengerStats.biddingCount || 0}</p>
                  <p className="text-[10px] text-zinc-400">{passengerStats.totalBookings > 0 ? pct(passengerStats.biddingCount, passengerStats.totalBookings) : 0}% of total</p>
                </div>
              </div>

              {/* Reliability Gauge */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-zinc-500">Completion Rate</span>
                  <span className="text-xs font-semibold text-zinc-700">{pct(passengerStats.completed, passengerStats.totalBookings)}%</span>
                </div>
                <div className="h-3 bg-zinc-200 rounded-md overflow-hidden">
                  <div className={`h-full rounded-md transition-all ${
                    pct(passengerStats.completed, passengerStats.totalBookings) >= 80 ? 'bg-green-500' :
                    pct(passengerStats.completed, passengerStats.totalBookings) >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                  }`} style={{ width: `${pct(passengerStats.completed, passengerStats.totalBookings)}%` }} />
                </div>
              </div>
            </Section>
          )}

          {/* Rider Performance */}
          {riderStats && (
            <Section title="Rider Performance Summary">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard value={riderStats.totalBookingsHandled} label="Total Rides Given" />
                <StatCard value={riderStats.completed} label="Completed" />
                <StatCard value={riderStats.rejected} label="Rejected" />
                <StatCard
                  value={riderStats.avgResponseTime ? `${Math.round(riderStats.avgResponseTime)}m` : '—'}
                  label="Avg Response Time"
                />
              </div>
            </Section>
          )}

          {/* Notification Status */}
          <Section title="Notification Delivery Status">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { key: 'bookingConfirmed', label: 'Booking Confirmed' },
                { key: 'rideStarting', label: 'Ride Starting' },
                { key: 'rideStarted', label: 'Ride Started' },
                { key: 'rideCompleted', label: 'Ride Completed' },
                { key: 'reviewReminder', label: 'Review Reminder' }
              ].map(n => (
                <div key={n.key} className={`p-3 rounded-lg border text-center ${booking.notifications?.[n.key] ? 'bg-green-50 border-green-200' : 'bg-zinc-50 border-zinc-200'}`}>
                  <div className={cn('mx-auto w-6 h-6 rounded-md flex items-center justify-center mb-1', booking.notifications?.[n.key] ? 'bg-green-500' : 'bg-zinc-200')}>
                    {booking.notifications?.[n.key] ? <Check size={14} className="text-white" /> : <Clock size={14} className="text-white" />}
                  </div>
                  <p className="text-xs text-zinc-600">{n.label}</p>
                  <p className={`text-xs font-semibold ${booking.notifications?.[n.key] ? 'text-green-600' : 'text-zinc-400'}`}>
                    {booking.notifications?.[n.key] ? '✅ Sent' : '—'}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/* TAB: ACTIONS                                       */}
      {/* ══════════════════════════════════════════════════ */}
      {activeTab === 'actions' && (
        <>
          {/* Cancellation Details */}
          {booking.cancellation?.cancelled && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-l-4 border-red-500">
              <h3 className="text-lg font-semibold text-red-700 mb-4">Cancellation Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-zinc-500">Cancelled By</p>
                  <p className="font-bold text-red-700">{booking.cancellation.cancelledBy || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Cancelled At</p>
                  <p className="font-semibold text-zinc-800">{fmtDT(booking.cancellation.cancelledAt)}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Reason</p>
                  <p className="font-semibold text-zinc-800">{booking.cancellation.reason || 'No reason'}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-500">Refund Issued</p>
                  <p className="font-semibold">{booking.cancellation.refundIssued ? <span className="text-green-600">Yes</span> : <span className="text-red-600">No</span>}</p>
                </div>
              </div>
            </div>
          )}

          {/* Reassignment Details */}
          {booking.reassignment?.isReassigned && (
            <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-l-4 border-amber-500">
              <h3 className="text-lg font-semibold text-amber-700 mb-4">Reassignment Details</h3>
              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                <div>
                  <p className="text-zinc-500">Original Booking</p>
                  <p className="font-mono text-zinc-700">{booking.reassignment.originalBooking || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-zinc-500">Reassigned At</p>
                  <p className="font-semibold">{fmtDT(booking.reassignment.reassignedAt)}</p>
                </div>
                {booking.reassignment.reason && (
                  <div className="col-span-2">
                    <p className="text-zinc-500">Reason</p>
                    <p className="font-semibold">{booking.reassignment.reason}</p>
                  </div>
                )}
              </div>
              {booking.reassignment.chain?.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-zinc-600 mb-2">Reassignment Chain ({booking.reassignment.chain.length} hops, {booking.reassignment.attempts} attempts)</p>
                  <div className="space-y-2">
                    {booking.reassignment.chain.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 bg-amber-50 rounded-lg text-sm">
                        <span className="font-mono text-zinc-500">#{i + 1}</span>
                        <span className="text-zinc-600">Ride ...{c.fromRide?.toString().slice(-6)}</span>
                        <ArrowRight size={14} className="text-amber-400" />
                        <span className="text-zinc-600">Ride ...{c.toRide?.toString().slice(-6)}</span>
                        {c.matchScore && <span className="text-xs bg-white px-2 py-0.5 rounded text-zinc-500">Score: {c.matchScore}</span>}
                        <span className="text-xs text-zinc-400 ml-auto">{fmtDT(c.reassignedAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Admin Actions */}
          <Section title="Admin Actions">
            <div className="flex flex-wrap gap-3">
              {booking.payment?.status !== 'REFUNDED' && ['PAID', 'PAYMENT_CONFIRMED'].includes(booking.payment?.status) && (
                <button onClick={() => setShowRefundModal(true)} className="px-6 py-3 bg-zinc-900 text-white rounded-lg font-semibold hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition">
                  Process Refund
                </button>
              )}
              {booking.ride?._id && (
                <button onClick={() => navigate(`/admin/rides/${booking.ride._id}`)} className="px-6 py-3 bg-zinc-100 text-zinc-700 rounded-lg font-semibold hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 transition">
                  View Ride
                </button>
              )}
              {booking.passenger?._id && (
                <button onClick={() => navigate(`/admin/users/${booking.passenger._id}`)} className="px-6 py-3 bg-zinc-100 text-zinc-700 rounded-lg font-semibold hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 transition">
                  View Passenger
                </button>
              )}
              {booking.ride?.rider?._id && (
                <button onClick={() => navigate(`/admin/users/${booking.ride.rider._id}`)} className="px-6 py-3 bg-zinc-100 text-zinc-700 rounded-lg font-semibold hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 transition">
                  View Driver
                </button>
              )}
            </div>

            {/* Technical Details */}
            <div className="mt-6 p-4 bg-zinc-50 rounded-lg">
              <p className="text-xs text-zinc-400 uppercase tracking-wide mb-3">Technical Details</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-zinc-500 text-xs">Booking ID</p>
                  <p className="font-mono text-zinc-700 text-xs">{booking._id}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs">Ride ID</p>
                  <p className="font-mono text-zinc-700 text-xs">{booking.ride?._id || '—'}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs">Passenger ID</p>
                  <p className="font-mono text-zinc-700 text-xs">{booking.passenger?._id || '—'}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs">Created</p>
                  <p className="font-semibold text-zinc-700 text-xs">{fmtDT(booking.createdAt)}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs">Updated</p>
                  <p className="font-semibold text-zinc-700 text-xs">{fmtDT(booking.updatedAt)}</p>
                </div>
                <div>
                  <p className="text-zinc-500 text-xs">Status</p>
                  {statusBadge(booking.status)}
                </div>
              </div>
            </div>
          </Section>
        </>
      )}

      {/* ── Refund Modal ───────────────────────────────── */}
      {showRefundModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-sm">
            <h2 className="text-xl font-bold text-zinc-900 mb-4">Process Refund</h2>
            <p className="text-zinc-600 mb-2">Enter the refund amount:</p>
            {(rideFare > 0 || commission > 0) && (
              <div className="p-3 bg-zinc-50 rounded-lg mb-3 text-xs text-zinc-500">
                <p>Rider Fare: ₹{rideFare} · Platform Commission: ₹{commission}</p>
                <p>Total Charged: ₹{booking.payment?.totalAmount || booking.totalPrice}</p>
              </div>
            )}
            <div className="relative mb-4">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">₹</span>
              <input type="number" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-400 focus:border-transparent text-lg"
                max={booking.totalPrice} placeholder="Amount" />
            </div>
            <p className="text-sm text-zinc-500 mb-4">Maximum: ₹{booking.totalPrice}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowRefundModal(false)} className="flex-1 px-4 py-3 bg-zinc-100 text-zinc-700 rounded-lg font-semibold hover:bg-zinc-200 transition">Cancel</button>
              <button onClick={handleRefund} className="flex-1 px-4 py-3 bg-zinc-900 text-white rounded-lg font-semibold hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition">Process Refund</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Fallback Timeline Event ── */
const TimelineEvent = ({ title, time, extra }) => (
  <div className="flex items-start gap-4">
    <div className="w-10 h-10 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 border border-zinc-200 dark:border-zinc-700">
      <CircleDot size={16} className="text-zinc-600 dark:text-zinc-400" />
    </div>
    <div>
      <p className="font-semibold text-zinc-800 dark:text-zinc-200">{title}</p>
      <p className="text-sm text-zinc-500">{fmtDT(time)}</p>
      {extra}
    </div>
  </div>
);

export default AdminBookingDetails;
