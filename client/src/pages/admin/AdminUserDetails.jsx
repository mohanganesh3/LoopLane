import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Car, User, Shield, Mail, Phone, Calendar, LogIn, Star, Ban, Zap, ChevronRight, Trophy, Medal, Gem, Music, Dog, MessageCircle, Heart, Bolt, Smile, Sparkles, Handshake, Leaf, BarChart3, Clock, History, Route, PieChart, Coins, CheckCircle, XCircle, TrendingUp, Users, Loader2, Flag, Trash2, Settings, FileText, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import adminService from '../../services/adminService';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';
import { formatRating } from '../../utils/helpers';

// ── Reusable Section Wrapper ──
const Section = ({ title, children, badge }) => (
  <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mb-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      {badge}
    </div>
    {children}
  </div>
);

// ── Mini Stat Card ──
const StatCard = ({ value, label, sub }) => (
  <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-lg text-center border border-zinc-200 dark:border-zinc-700">
    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
    <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    {sub && <p className="text-[10px] text-zinc-400 mt-0.5">{sub}</p>}
  </div>
);

// ── Star Rating Display ──
const Stars = ({ rating, size = 'sm' }) => {
  const sizes = { xs: 12, sm: 14, md: 16, lg: 18 };
  const s = sizes[size] || 14;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} size={s} className={i <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-zinc-200 dark:text-zinc-600'} />
      ))}
    </div>
  );
};

// ── Bar Gauge ──
const BarGauge = ({ value, max = 100, label }) => (
  <div className="flex items-center gap-3">
    <span className="text-xs text-zinc-500 w-24 text-right">{label}</span>
    <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
      <div className="h-full bg-zinc-900 dark:bg-zinc-300 rounded-full transition-all" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
    <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 w-8">{typeof value === 'number' ? value.toFixed(1) : value}</span>
  </div>
);

// ── Tag Pill ──
const TagPill = ({ label, count, positive }) => (
  <span className={cn(
    'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ring-1 ring-inset',
    positive ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/20'
             : 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/20'
  )}>
    {label.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
    {count > 1 && <span className="bg-white/80 dark:bg-zinc-800 px-1.5 rounded text-[10px]">×{count}</span>}
  </span>
);

const POSITIVE_TAGS = ['GREAT_CONVERSATION', 'SMOOTH_DRIVER', 'CLEAN_CAR', 'ON_TIME', 'SAFE_DRIVER', 'FLEXIBLE', 'FRIENDLY', 'RESPECTFUL', 'QUIET', 'GOOD_COMPANY'];

const AdminUserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [recentRides, setRecentRides] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [reportsAgainst, setReportsAgainst] = useState([]);
  const [reviewsReceived, setReviewsReceived] = useState([]);
  const [financials, setFinancials] = useState({ totalSpent: 0, transactionCount: 0, totalEarnings: 0 });
  const [platformRevenue, setPlatformRevenue] = useState({ fromRides: 0, fromBookings: 0, total: 0 });
  const [topRoutes, setTopRoutes] = useState([]);
  const [activityPatterns, setActivityPatterns] = useState(null);
  const [frequentCoTravelers, setFrequentCoTravelers] = useState([]);
  const [ratingCategories, setRatingCategories] = useState(null);
  const [reviewTags, setReviewTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [activateNotes, setActivateNotes] = useState('');
  const [imgError, setImgError] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { fetchUserDetails(); }, [id]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const r = await adminService.getUserById(id);
      if (r.success) {
        setUser(r.user);
        setRecentRides(r.recentRides || []);
        setRecentBookings(r.recentBookings || []);
        setReportsAgainst(r.reportsAgainst || []);
        setReviewsReceived(r.reviewsReceived || []);
        setFinancials(r.financials || { totalSpent: 0, transactionCount: 0, totalEarnings: 0 });
        setPlatformRevenue(r.platformRevenue || { fromRides: 0, fromBookings: 0, total: 0 });
        setTopRoutes(r.topRoutes || []);
        setActivityPatterns(r.activityPatterns || null);
        setFrequentCoTravelers(r.frequentCoTravelers || []);
        setRatingCategories(r.ratingCategories || null);
        setReviewTags(r.reviewTags || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load user details');
    } finally { setLoading(false); }
  };

  const handleSuspend = async () => {
    if (!suspendReason.trim()) { setError('Please provide a reason for suspension'); return; }
    try {
      const r = await adminService.updateUserStatus(id, 'suspend', { reason: suspendReason });
      if (r.success) { setSuccess('User suspended successfully'); setShowSuspendModal(false); setSuspendReason(''); fetchUserDetails(); }
    } catch (err) { setError(err.message || 'Failed to suspend user'); }
  };

  const handleActivate = async () => {
    try {
      const r = await adminService.updateUserStatus(id, 'activate', { appealNotes: activateNotes });
      if (r.success) { setSuccess('User reactivated successfully'); setShowActivateModal(false); setActivateNotes(''); fetchUserDetails(); }
    } catch (err) { setError(err.message || 'Failed to activate user'); }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to DELETE this user? This action cannot be undone!')) return;
    try {
      const r = await adminService.deleteUser(id);
      if (r.success) { setSuccess('User deleted successfully'); setTimeout(() => navigate('/admin/users'), 1500); }
    } catch (err) { setError(err.message || 'Failed to delete user'); }
  };

  // ── Badge Helpers ──
  const statusCls = { ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400', SUSPENDED: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400', DELETED: 'bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-400' };
  const roleCls = { RIDER: 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400', PASSENGER: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-400' };
  const trustCls = { NEWCOMER: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300', REGULAR: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400', EXPERIENCED: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400', AMBASSADOR: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', EXPERT: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' };
  const tierCls = { BLUE: 'bg-blue-600', GOLD: 'bg-amber-600', PLATINUM: 'bg-zinc-600' };

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
    </div>
  );

  if (!user) return (
    <div className="p-6">
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">User not found</div>
      <button onClick={() => navigate('/admin/users')} className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm dark:bg-zinc-100 dark:text-zinc-900">← Back to Users</button>
    </div>
  );

  const photoUrl = getUserPhoto(user);
  const displayName = getUserDisplayName(user);
  const memberDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const cancelRate = user.cancellationRate?.rate || 0;
  const trustLevel = user.trustScore?.level || 'NEWCOMER';
  const trustScoreVal = user.trustScore?.score || 0;
  const tier = user.gamification?.tier || 'BLUE';
  const loyaltyPts = user.gamification?.loyaltyPoints || 0;

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'revenue', label: 'Revenue' },
    { key: 'ratings', label: 'Ratings' },
    { key: 'routes', label: 'Routes' },
    { key: 'activity', label: 'Activity' },
    { key: 'history', label: 'History' },
  ];

  return (
    <div className="min-h-screen">
      {/* ══════════════════ HERO HEADER ══════════════════ */}
      <div className="bg-zinc-900 dark:bg-zinc-950 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <button onClick={() => navigate('/admin/users')} className="text-zinc-400 hover:text-white text-sm mb-4 inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Users
          </button>
          <div className="flex flex-col md:flex-row items-start gap-6">
            <div className="relative flex-shrink-0">
              {photoUrl && !imgError ? (
                <img src={photoUrl} alt={displayName} className="w-28 h-28 rounded-lg object-cover border-2 border-zinc-700" onError={() => setImgError(true)} />
              ) : (
                <div className={`w-28 h-28 rounded-lg ${getAvatarColor(displayName)} flex items-center justify-center text-white text-4xl font-bold border-2 border-zinc-700`}>
                  {getInitials(displayName)}
                </div>
              )}
              <div className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md text-[10px] font-bold ring-1 ring-inset ring-zinc-500/20 ${trustCls[trustLevel] || 'bg-zinc-100 text-zinc-700'}`}>
                {trustLevel}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{displayName}</h1>
                <span className={`px-3 py-1 rounded-md text-xs font-bold ring-1 ring-inset ${statusCls[user.accountStatus] || 'bg-amber-50 text-amber-700 ring-amber-600/20'}`}>{user.accountStatus}</span>
                <span className={`px-3 py-1 rounded-md text-xs font-bold ring-1 ring-inset ${roleCls[user.role] || 'bg-zinc-100 text-zinc-700 ring-zinc-500/20'}`}>
                  {user.role === 'RIDER' ? <Car size={12} className="inline mr-1" /> : <User size={12} className="inline mr-1" />}{user.role}
                </span>
                {user.role === 'RIDER' && user.verificationStatus && (
                  <span className={`px-3 py-1 rounded-md text-xs font-bold ring-1 ring-inset ${user.verificationStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' : 'bg-amber-50 text-amber-700 ring-amber-600/20'}`}>
                    <Shield size={12} className="inline mr-1" />{user.verificationStatus}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-1 text-zinc-400 text-sm mb-3">
                <span className="inline-flex items-center gap-1.5"><Mail size={13} />{user.email}</span>
                <span className="inline-flex items-center gap-1.5"><Phone size={13} />{user.phone || 'N/A'}</span>
                <span className="inline-flex items-center gap-1.5"><Calendar size={13} />Member for {memberDays} days</span>
                {user.lastLogin && <span className="inline-flex items-center gap-1.5"><LogIn size={13} />Last login {new Date(user.lastLogin).toLocaleDateString()}</span>}
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-lg">
                  <span className="text-zinc-400 text-xs">Rating</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-lg">{formatRating(user.rating)}</span>
                    <Stars rating={user.rating?.overall || 0} size="xs" />
                    <span className="text-zinc-500 text-xs">({user.rating?.totalRatings || 0})</span>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-lg">
                  <span className="text-zinc-400 text-xs">Trust Score</span>
                  <div className="font-bold text-lg">{trustScoreVal}<span className="text-zinc-500 text-xs">/100</span></div>
                </div>
                <div className="bg-white/10 backdrop-blur px-4 py-2 rounded-lg">
                  <span className="text-zinc-400 text-xs">Platform Revenue</span>
                  <div className="font-bold text-lg">₹{platformRevenue.total.toLocaleString()}</div>
                </div>
                <div className={`${tierCls[tier]} text-white px-4 py-2 rounded-lg`}>
                  <span className="text-white/60 text-xs">Loyalty Tier</span>
                  <div className="font-bold text-lg"><Gem size={14} className="inline mr-1" />{tier}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════ TAB BAR ══════════════════ */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn('px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition',
                activeTab === t.key ? 'border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100' : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && <div className="mb-6 rounded-lg border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex justify-between"><span>{error}</span><button onClick={() => setError('')} className="text-red-400">×</button></div>}
        {success && <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/20 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 flex justify-between"><span>{success}</span><button onClick={() => setSuccess('')} className="text-emerald-400">×</button></div>}

        {/* ══════════════════ OVERVIEW TAB ══════════════════ */}
        {activeTab === 'overview' && (
          <>
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <StatCard value={user.statistics?.totalRidesPosted || 0} label="Rides Posted" />
              <StatCard value={user.statistics?.totalRidesTaken || 0} label="Rides Taken" />
              <StatCard value={user.statistics?.completedRides || 0} label="Completed" />
              <StatCard value={user.statistics?.cancelledRides || 0} label="Cancelled" />
              <StatCard value={`${(user.statistics?.totalDistance || 0).toLocaleString()} km`} label="Total Distance" />
              <StatCard value={`${(user.statistics?.carbonSaved || 0).toFixed(1)} kg`} label="CO₂ Saved" />
            </div>

            {/* Trust Score + Cancellation + Response Profile */}
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              {/* Trust Score */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Trust Score</h3>
                <div className="flex items-center justify-center mb-4">
                  <div className="relative w-28 h-28">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f0f0f0" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.9" fill="none" stroke={trustScoreVal >= 70 ? '#10b981' : trustScoreVal >= 40 ? '#f59e0b' : '#ef4444'} strokeWidth="3"
                        strokeDasharray={`${trustScoreVal} ${100 - trustScoreVal}`} strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black">{trustScoreVal}</span>
                      <span className="text-[10px] text-zinc-400">/ 100</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {user.trustScore?.factors && Object.entries(user.trustScore.factors).map(([key, val]) => val > 0 && (
                    <BarGauge key={key} value={val} max={20} color="indigo" label={key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace('Bonus', '').trim()} />
                  ))}
                </div>
              </div>

              {/* Cancellation Profile */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Cancellation Profile</h3>
                <div className="flex items-center justify-center mb-4">
                  <div className={`text-5xl font-black ${cancelRate > 20 ? 'text-red-500' : cancelRate > 10 ? 'text-amber-500' : 'text-green-500'}`}>
                    {cancelRate.toFixed(1)}%
                  </div>
                </div>
                <div className="text-center text-xs text-zinc-500 mb-4">
                  {user.cancellationRate?.cancelledByUser || 0} cancelled out of {user.cancellationRate?.totalBookings || 0} bookings
                </div>
                {user.cancellationRate?.recentCancellations?.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-semibold text-zinc-600">Recent Cancellations</p>
                    {user.cancellationRate.recentCancellations.slice(0, 3).map((c, i) => (
                      <div key={i} className="text-xs text-zinc-500 flex justify-between">
                        <span className="truncate flex-1">{c.reason || 'No reason'}</span>
                        {c.wasLastMinute && <span className="text-red-500 ml-2 flex-shrink-0">⚡ Last minute</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Response Time */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Response Metrics</h3>
                <div className="flex items-center justify-center mb-4">
                  <div className="text-center">
                    <div className="text-5xl font-black text-zinc-900 dark:text-zinc-100">{user.responseMetrics?.averageResponseTime || 0}<span className="text-lg text-zinc-400"> min</span></div>
                    <p className="text-xs text-zinc-500 mt-1">Avg. Response Time</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-zinc-50 p-2 rounded-lg">
                    <p className="text-lg font-bold text-zinc-700">{user.responseMetrics?.totalResponses || 0}</p>
                    <p className="text-[10px] text-zinc-400">Total Responses</p>
                  </div>
                  <div className="bg-zinc-50 p-2 rounded-lg">
                    <p className="text-lg font-bold text-zinc-700">{user.responseMetrics?.quickResponder ? '⚡ Yes' : 'No'}</p>
                    <p className="text-[10px] text-zinc-400">Quick Responder</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Badges & Gamification */}
            <Section title="Badges & Gamification">
              {user.badges?.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {user.badges.map((badge, i) => (
                    <div key={i} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-lg">
                      <Medal size={16} className="text-amber-500" />
                      <div>
                        <p className="text-xs font-semibold text-amber-800">{badge.type?.replace(/_/g, ' ')}</p>
                        {badge.earnedAt && <p className="text-[10px] text-amber-600">{new Date(badge.earnedAt).toLocaleDateString()}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">No badges earned yet</p>
              )}
              <div className="mt-4 flex items-center gap-4">
                <div className={`${tierCls[tier]} text-white px-4 py-2 rounded-lg text-sm font-bold`}>
                  <Gem size={14} className="inline mr-1" />{tier} Tier
                </div>
                <span className="text-sm text-zinc-600">{loyaltyPts.toLocaleString()} loyalty points</span>
                {user.gamification?.nextTierProgress > 0 && (
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${user.gamification.nextTierProgress}%` }} />
                    </div>
                    <span className="text-xs text-zinc-400">{user.gamification.nextTierProgress}% to next tier</span>
                  </div>
                )}
              </div>
            </Section>

            {/* Ride Preferences DNA */}
            {user.preferences?.rideComfort && (
              <Section title="Ride Preference DNA">
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: 'Music', value: user.preferences.rideComfort.musicPreference },
                    { label: 'Smoking', value: user.preferences.rideComfort.smokingAllowed ? 'Allowed' : 'Not Allowed' },
                    { label: 'Pets', value: user.preferences.rideComfort.petsAllowed ? 'Allowed' : 'Not Allowed' },
                    { label: 'Chat', value: user.preferences.rideComfort.conversationPreference },
                  ].map(pref => (
                    <div key={pref.label} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-sm">
                      <span className="text-zinc-500">{pref.label}:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{pref.value?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) || 'N/A'}</span>
                    </div>
                  ))}
                  {user.preferences?.booking?.preferredCoRiderGender && user.preferences.booking.preferredCoRiderGender !== 'ANY' && (
                    <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-sm">
                      <span className="text-zinc-500">Co-rider:</span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{user.preferences.booking.preferredCoRiderGender.replace(/_/g, ' ')}</span>
                    </div>
                  )}
                  {user.preferences?.booking?.instantBooking && (
                    <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-2 rounded-lg text-sm">
                      <Zap size={14} className="text-amber-500" />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">Instant Booking ON</span>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Vehicles & Documents (Riders only) */}
            {user.role === 'RIDER' && (
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {user.vehicles?.length > 0 && (
                  <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Vehicles</h3>
                    <div className="space-y-3">
                      {user.vehicles.map((v, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border">
                          <div>
                            <p className="font-semibold text-zinc-800">{v.make} {v.model} <span className="text-zinc-400">({v.year})</span></p>
                            <p className="text-xs text-zinc-500">{v.color} · {v.licensePlate} · {v.vehicleType} · {v.seats} seats</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${v.status === 'APPROVED' ? 'bg-green-100 text-green-800' : v.status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {v.status || 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {user.documents && (
                  <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                    <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Documents</h3>
                    <div className="space-y-3">
                      {[
                        { key: 'driverLicense', label: 'Driver License' },
                        { key: 'governmentId', label: 'Government ID' },
                        { key: 'insurance', label: 'Insurance' },
                      ].map(({ key, label }) => (
                        <div key={key} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center gap-2">
                            <FileText size={14} className="text-zinc-400" />
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">{label}</span>
                          </div>
                          {user.documents[key] ? (
                            <span className={`px-2 py-1 rounded text-xs font-bold ${user.documents[key].status === 'APPROVED' ? 'bg-green-100 text-green-800' : user.documents[key].status === 'REJECTED' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                              {user.documents[key].status || 'Pending'}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded text-xs font-bold bg-zinc-100 text-zinc-600">Not Uploaded</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Frequent Co-travelers */}
            {frequentCoTravelers.length > 0 && (
              <Section title="Frequent Co-Travelers">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {frequentCoTravelers.map((ct, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <div className={`w-10 h-10 rounded-lg ${getAvatarColor(ct.name)} flex items-center justify-center text-white text-sm font-bold`}>
                        {getInitials(ct.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{ct.name}</p>
                        <p className="text-xs text-zinc-500">{ct.tripsTogether} trips together · ⭐ {ct.rating?.toFixed(1) || 'N/A'}</p>
                      </div>
                      <div className="text-2xl font-black text-zinc-300 dark:text-zinc-600">#{i + 1}</div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Reports Against */}
            {reportsAgainst.length > 0 && (
              <Section title={`Reports Against (${reportsAgainst.length})`}>
                <div className="space-y-3">
                  {reportsAgainst.map(report => (
                    <div key={report._id} className="p-4 bg-zinc-50 rounded-lg border flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${report.severity === 'HIGH' ? 'bg-red-500' : report.severity === 'MEDIUM' ? 'bg-orange-500' : 'bg-yellow-500'}`}></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-zinc-800 text-sm">{report.category}</span>
                          <span className={`px-2 py-0.5 rounded-md text-xs ring-1 ring-inset ${report.status === 'RESOLVED' ? 'bg-green-50 text-green-700 ring-green-600/20' : report.status === 'DISMISSED' ? 'bg-zinc-100 text-zinc-600 ring-zinc-500/20' : 'bg-yellow-50 text-yellow-700 ring-yellow-600/20'}`}>{report.status}</span>
                        </div>
                        <p className="text-sm text-zinc-600">{report.description}</p>
                        <p className="text-xs text-zinc-400 mt-1">Reported by {report.reporter?.profile?.firstName || 'Unknown'} · {new Date(report.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Suspension Info */}
            {user.accountStatus === 'SUSPENDED' && user.suspensionReason && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-300 mb-2">Suspension Details</h3>
                <p className="text-red-700 dark:text-red-400">{user.suspensionReason}</p>
                {user.suspendedAt && <p className="text-sm text-red-500 mt-2">Suspended on {new Date(user.suspendedAt).toLocaleDateString()}</p>}
              </div>
            )}
          </>
        )}

        {/* ══════════════════ REVENUE TAB ══════════════════ */}
        {activeTab === 'revenue' && (
          <>
            {/* Platform Revenue Impact */}
            <div className="bg-zinc-900 dark:bg-zinc-950 rounded-lg p-6 mb-6 text-white">
              <h3 className="text-lg font-bold mb-1">Revenue Generated for Platform</h3>
              <p className="text-white/70 text-sm mb-4">Total commission the platform earned from this user&apos;s activity</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white/15 backdrop-blur rounded-lg p-4 text-center">
                  <p className="text-3xl font-black">₹{platformRevenue.total.toLocaleString()}</p>
                  <p className="text-white/70 text-xs mt-1">Total Platform Revenue</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">₹{platformRevenue.fromRides.toLocaleString()}</p>
                  <p className="text-white/70 text-xs mt-1">From Rides (as Driver)</p>
                  <p className="text-white/50 text-[10px]">{platformRevenue.fromRidesCount} completed rides</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold">₹{platformRevenue.fromBookings.toLocaleString()}</p>
                  <p className="text-white/70 text-xs mt-1">From Bookings (as Passenger)</p>
                  <p className="text-white/50 text-[10px]">{platformRevenue.fromBookingsCount} completed bookings</p>
                </div>
              </div>
            </div>

            {/* User Financial Summary */}
            <Section title="User Financial Summary">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg text-center border border-emerald-200">
                  <p className="text-3xl font-bold text-emerald-700">₹{((financials.totalEarnings || 0) + (financials.totalSpent || 0)).toLocaleString()}</p>
                  <p className="text-xs font-semibold text-emerald-800 uppercase tracking-widest mt-1">Total LTV</p>
                </div>
                <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">₹{(financials.totalEarnings || 0).toLocaleString()}</p>
                  <p className="text-xs text-zinc-500 mt-1">Total Earnings (Rider)</p>
                </div>
                <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">₹{(financials.totalSpent || 0).toLocaleString()}</p>
                  <p className="text-xs text-zinc-500 mt-1">Total Spent (Passenger)</p>
                </div>
                <div className="bg-white border border-zinc-200 p-4 rounded-lg text-center">
                  <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{financials.transactionCount || 0}</p>
                  <p className="text-xs text-zinc-500 mt-1">Total Transactions</p>
                </div>
              </div>

              {/* Per-ride average metrics */}
              {financials.transactionCount > 0 && (
                <div className="grid grid-cols-3 gap-4 border-t pt-4">
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-700">₹{Math.round(((financials.totalEarnings || 0) + (financials.totalSpent || 0)) / financials.transactionCount).toLocaleString()}</p>
                    <p className="text-xs text-zinc-500">Avg. Transaction Value</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-700">₹{Math.round(platformRevenue.total / financials.transactionCount).toLocaleString()}</p>
                    <p className="text-xs text-zinc-500">Avg. Commission / Txn</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-zinc-700">
                      {((financials.totalEarnings + financials.totalSpent) > 0) ?
                        ((platformRevenue.total / (financials.totalEarnings + financials.totalSpent)) * 100).toFixed(1) : '0'}%
                    </p>
                    <p className="text-xs text-zinc-500">Effective Commission Rate</p>
                  </div>
                </div>
              )}
            </Section>

            {/* Carbon Impact */}
            <Section title="Environmental Impact">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard value={`${(user.statistics?.carbonSaved || 0).toFixed(1)} kg`} label="CO₂ Saved" />
                <StatCard value={`${(user.statistics?.totalDistance || 0).toLocaleString()} km`} label="Total Distance" />
                <StatCard value={user.statistics?.totalPassengersCarried || 0} label="Passengers Carried" />
                <StatCard
                  value={`🌳 ${Math.max(1, Math.round((user.statistics?.carbonSaved || 0) / 21))}`}
                  label="Equivalent Trees"
                  sub="~21 kg CO₂/tree/year"
                />
              </div>
            </Section>
          </>
        )}

        {/* ══════════════════ RATINGS TAB ══════════════════ */}
        {activeTab === 'ratings' && (
          <>
            {/* Rating Overview */}
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Star Breakdown */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Rating Distribution</h3>
                <div className="flex items-center gap-6 mb-6">
                  <div className="text-center">
                    <div className="text-5xl font-black text-zinc-800 dark:text-zinc-100">{formatRating(user.rating)}</div>
                    <Stars rating={user.rating?.overall || 0} size="md" />
                    <p className="text-xs text-zinc-400 mt-1">{user.rating?.totalRatings || 0} ratings</p>
                  </div>
                  <div className="flex-1 space-y-2">
                    {[5, 4, 3, 2, 1].map(star => {
                      const key = ['', 'oneStar', 'twoStar', 'threeStar', 'fourStar', 'fiveStar'][star];
                      const count = user.rating?.breakdown?.[key] || 0;
                      const pct = (user.rating?.totalRatings || 0) > 0 ? (count / user.rating.totalRatings) * 100 : 0;
                      return (
                        <div key={star} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500 w-4">{star}</span>
                          <Star size={12} className="text-yellow-400 fill-yellow-400" />
                          <div className="flex-1 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-zinc-400 w-8">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Category Ratings */}
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6">
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-4">Category Ratings</h3>
                {ratingCategories ? (
                  <div className="space-y-3">
                    {[
                      { key: 'avgPunctuality', label: 'Punctuality', icon: <Clock size={16} className="text-zinc-500" /> },
                      { key: 'avgCommunication', label: 'Communication', icon: <MessageCircle size={16} className="text-zinc-500" /> },
                      { key: 'avgDriving', label: 'Driving', icon: <Car size={16} className="text-zinc-500" /> },
                      { key: 'avgCleanliness', label: 'Cleanliness', icon: <Sparkles size={16} className="text-zinc-500" /> },
                      { key: 'avgRespectfulness', label: 'Respectfulness', icon: <Handshake size={16} className="text-zinc-500" /> },
                      { key: 'avgFriendliness', label: 'Friendliness', icon: <Smile size={16} className="text-zinc-500" /> },
                    ].filter(c => ratingCategories[c.key]).map(cat => (
                      <div key={cat.key} className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6">{cat.icon}</span>
                        <span className="text-sm text-zinc-600 dark:text-zinc-400 w-28">{cat.label}</span>
                        <div className="flex-1 h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${ratingCategories[cat.key] >= 4 ? 'bg-green-400' : ratingCategories[cat.key] >= 3 ? 'bg-yellow-400' : 'bg-red-400'}`}
                            style={{ width: `${(ratingCategories[cat.key] / 5) * 100}%` }} />
                        </div>
                        <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 w-10">{ratingCategories[cat.key].toFixed(1)}</span>
                      </div>
                    ))}
                    <p className="text-xs text-zinc-400 pt-2 border-t border-zinc-200 dark:border-zinc-700">Based on {ratingCategories.totalReviews} reviews</p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 italic">No category ratings available</p>
                )}
              </div>
            </div>

            {/* Review Tags Cloud */}
            {reviewTags.length > 0 && (
              <Section title="Review Tags">
                <div className="flex flex-wrap gap-2">
                  {reviewTags.map((tag, i) => (
                    <TagPill key={i} label={tag._id} count={tag.count} positive={POSITIVE_TAGS.includes(tag._id)} />
                  ))}
                </div>
              </Section>
            )}

            {/* Full Reviews */}
            <Section title={`Reviews Received (${reviewsReceived.length})`}
              badge={<span className="text-xs text-zinc-400">Showing latest {reviewsReceived.length}</span>}>
              {reviewsReceived.length > 0 ? (
                <div className="space-y-4">
                  {reviewsReceived.map(review => (
                    <div key={review._id} className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Stars rating={review.rating} size="sm" />
                          <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{review.rating}/5</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ring-1 ring-inset ${review.type === 'DRIVER_REVIEW' ? 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-400/30' : 'bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-400/30'}`}>
                            {review.type === 'DRIVER_REVIEW' ? 'As Driver' : 'As Passenger'}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                      </div>
                      {review.comment && <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">{review.comment}</p>}
                      {review.ratings?.categories && (
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500 mb-2">
                          {Object.entries(review.ratings.categories).filter(([, v]) => v).map(([k, v]) => (
                            <span key={k}>{k}: <span className="font-semibold">{v}/5</span></span>
                          ))}
                        </div>
                      )}
                      {review.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {review.tags.map((t, i) => <TagPill key={i} label={t} count={1} positive={POSITIVE_TAGS.includes(t)} />)}
                        </div>
                      )}
                      <p className="text-xs text-zinc-400 mt-2">by {review.reviewer?.profile?.firstName || 'Anonymous'} {review.reviewer?.profile?.lastName || ''}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">No reviews received yet</p>
              )}
            </Section>
          </>
        )}

        {/* ══════════════════ ROUTES TAB ══════════════════ */}
        {activeTab === 'routes' && (
          <>
            {/* Top Routes */}
            <Section title="Most Travelled Routes"
              badge={<span className="text-xs text-zinc-400">{topRoutes.length} routes</span>}>
              {topRoutes.length > 0 ? (
                <div className="space-y-3">
                  {topRoutes.map((route, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center text-zinc-900 dark:text-zinc-100 font-black text-lg">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{route._id.from}</span>
                          <ArrowRight size={14} className="text-zinc-400 flex-shrink-0" />
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate">{route._id.to}</span>
                        </div>
                        <div className="flex gap-3 text-xs text-zinc-500">
                          <span>{route.count} trips</span>
                          {route.totalDistance && <span>{Math.round(route.totalDistance)} km total</span>}
                          {route.totalSpent && <span>₹{route.totalSpent.toLocaleString()} spent</span>}
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ring-1 ring-inset ${route.role === 'rider' ? 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-400/30' : 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-400/30'}`}>
                            {route.role === 'rider' ? 'Driver' : 'Passenger'}
                          </span>
                        </div>
                      </div>
                      {route.lastTravelled && (
                        <div className="text-right text-xs text-zinc-400 flex-shrink-0">
                          Last: {new Date(route.lastTravelled).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">No route data available yet</p>
              )}
            </Section>

            {/* Frequent Co-travelers (also shown on routes tab) */}
            {frequentCoTravelers.length > 0 && (
              <Section title="Travel Companions on These Routes">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {frequentCoTravelers.map((ct, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <div className={`w-10 h-10 rounded-full ${getAvatarColor(ct.name)} flex items-center justify-center text-white text-sm font-bold`}>
                        {getInitials(ct.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{ct.name}</p>
                        <p className="text-xs text-zinc-500">{ct.tripsTogether} trips · ⭐ {ct.rating?.toFixed(1) || 'N/A'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}

        {/* ══════════════════ ACTIVITY TAB ══════════════════ */}
        {activeTab === 'activity' && (
          <>
            {/* Activity Heatmap */}
            {activityPatterns && (
              <>
                <Section title="Activity by Day of Week">
                  <div className="flex items-end justify-between gap-2 h-40 mb-2">
                    {activityPatterns.byDay.map((d, i) => {
                      const maxCount = Math.max(1, ...activityPatterns.byDay.map(x => x.count));
                      const height = d.count > 0 ? Math.max(8, (d.count / maxCount) * 100) : 4;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{d.count}</span>
                          <div
                            className={`w-full rounded-t-lg transition-all ${d.day === activityPatterns.peakDay ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            style={{ height: `${height}%` }}
                          />
                          <span className={`text-xs ${d.day === activityPatterns.peakDay ? 'font-bold text-zinc-900 dark:text-zinc-100' : 'text-zinc-500'}`}>{d.day}</span>
                        </div>
                      );
                    })}
                  </div>
                  {activityPatterns.peakDay && (
                    <p className="text-sm text-center text-zinc-500">Peak day: <span className="font-bold text-zinc-900 dark:text-zinc-100">{activityPatterns.peakDay}</span></p>
                  )}
                </Section>

                <Section title="Activity by Hour">
                  <div className="flex items-end gap-0.5 h-32 mb-2 overflow-x-auto">
                    {activityPatterns.byHour.map((h, i) => {
                      const maxCount = Math.max(1, ...activityPatterns.byHour.map(x => x.count));
                      const height = h.count > 0 ? Math.max(4, (h.count / maxCount) * 100) : 2;
                      return (
                        <div key={i} className="flex flex-col items-center flex-1 min-w-[14px]">
                          {h.count > 0 && <span className="text-[9px] text-zinc-500 mb-0.5">{h.count}</span>}
                          <div
                            className={`w-full rounded-t transition-all ${h.label === activityPatterns.peakHour ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-200 dark:bg-zinc-700'}`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-zinc-400 px-1">
                    <span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span>
                  </div>
                  {activityPatterns.peakHour && (
                    <p className="text-sm text-center text-zinc-500 mt-2">Peak hour: <span className="font-bold text-zinc-900 dark:text-zinc-100">{activityPatterns.peakHour}</span></p>
                  )}
                </Section>
              </>
            )}

            {/* Account Timeline */}
            <Section title="Account Timeline">
              <div className="relative border-l-2 border-zinc-200 dark:border-zinc-700 ml-3 space-y-6">
                <div className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-200 border-4 border-white dark:border-zinc-900 shadow"></div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Joined LoopLane</p>
                  <p className="text-xs text-zinc-500">{new Date(user.createdAt).toLocaleDateString()} · {memberDays} days ago</p>
                </div>
                {user.emailVerified && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-zinc-400 dark:bg-zinc-500 border-4 border-white dark:border-zinc-900 shadow"></div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Email Verified</p>
                  </div>
                )}
                {user.phoneVerified && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-zinc-400 dark:bg-zinc-500 border-4 border-white dark:border-zinc-900 shadow"></div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Phone Verified</p>
                  </div>
                )}
                {user.role === 'RIDER' && user.verificationStatus === 'VERIFIED' && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-zinc-600 dark:bg-zinc-400 border-4 border-white dark:border-zinc-900 shadow"></div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Rider Verified</p>
                  </div>
                )}
                {(user.statistics?.totalRidesPosted > 0 || recentRides.length > 0) && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-zinc-700 dark:bg-zinc-300 border-4 border-white dark:border-zinc-900 shadow"></div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">First Ride Offered</p>
                    <p className="text-xs text-zinc-500">{user.statistics?.totalRidesPosted || 0} total rides posted</p>
                  </div>
                )}
                {(user.statistics?.totalRidesTaken > 0 || recentBookings.length > 0) && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-zinc-500 dark:bg-zinc-400 border-4 border-white dark:border-zinc-900 shadow"></div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">First Booking Made</p>
                    <p className="text-xs text-zinc-500">{user.statistics?.totalRidesTaken || 0} rides as passenger</p>
                  </div>
                )}
                {user.badges?.length > 0 && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-zinc-900 dark:bg-zinc-200 border-4 border-white dark:border-zinc-900 shadow"></div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Earned {user.badges.length} Badge{user.badges.length > 1 ? 's' : ''}</p>
                    <p className="text-xs text-zinc-500">{user.badges.map(b => b.type?.replace(/_/g, ' ')).join(', ')}</p>
                  </div>
                )}
                {user.statistics?.lastRideAt && (
                  <div className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-zinc-400 dark:bg-zinc-500 border-4 border-white dark:border-zinc-900 shadow"></div>
                    <p className="font-semibold text-zinc-800 dark:text-zinc-200">Last Active</p>
                    <p className="text-xs text-zinc-500">{new Date(user.statistics.lastRideAt).toLocaleDateString()}</p>
                  </div>
                )}
                <div className="relative pl-6">
                  <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-white dark:border-zinc-900 shadow ${user.accountStatus === 'SUSPENDED' ? 'bg-red-500' : user.accountStatus === 'DELETED' ? 'bg-zinc-500' : 'bg-zinc-900 dark:bg-zinc-200'}`}></div>
                  <p className="font-semibold text-zinc-800 dark:text-zinc-200">Current: {user.accountStatus}</p>
                </div>
              </div>
            </Section>
          </>
        )}

        {/* ══════════════════ HISTORY TAB ══════════════════ */}
        {activeTab === 'history' && (
          <>
            {/* Recent Rides */}
            <Section title={`Recent Rides as Driver (${recentRides.length})`}>
              {recentRides.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-zinc-500">
                      <th className="pb-2 font-medium">Route</th>
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Distance</th>
                      <th className="pb-2 font-medium text-right">Price/Seat</th>
                      <th className="pb-2 font-medium text-right">Seats</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {recentRides.map(ride => (
                        <tr key={ride._id} className="hover:bg-zinc-50 cursor-pointer" onClick={() => navigate(`/admin/rides/${ride._id}`)}>
                          <td className="py-2 text-zinc-800">
                            {ride.route?.start?.name || ride.route?.start?.address?.split(',')[0] || '—'} → {ride.route?.destination?.name || ride.route?.destination?.address?.split(',')[0] || '—'}
                          </td>
                          <td className="py-2 text-zinc-500 text-xs">{new Date(ride.schedule?.departureDate || ride.createdAt).toLocaleDateString()}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${ride.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : ride.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{ride.status}</span>
                          </td>
                          <td className="py-2 text-right text-zinc-600">{ride.route?.distance ? `${ride.route.distance.toFixed(1)} km` : '—'}</td>
                          <td className="py-2 text-right font-medium">₹{ride.pricing?.pricePerSeat || 0}</td>
                          <td className="py-2 text-right text-zinc-600">{ride.pricing?.availableSeats}/{ride.pricing?.totalSeats}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">No rides posted</p>
              )}
            </Section>

            {/* Recent Bookings */}
            <Section title={`Recent Bookings as Passenger (${recentBookings.length})`}>
              {recentBookings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-zinc-500">
                      <th className="pb-2 font-medium">Route</th>
                      <th className="pb-2 font-medium">Ref</th>
                      <th className="pb-2 font-medium">Seats</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Payment</th>
                      <th className="pb-2 font-medium text-right">Amount</th>
                      <th className="pb-2 font-medium text-right">Commission</th>
                    </tr></thead>
                    <tbody className="divide-y">
                      {recentBookings.map(booking => (
                        <tr key={booking._id} className="hover:bg-zinc-50 cursor-pointer" onClick={() => navigate(`/admin/bookings/${booking._id}`)}>
                          <td className="py-2 text-zinc-800">
                            {booking.ride?.route?.start?.name || booking.ride?.route?.start?.address?.split(',')[0] || '—'} → {booking.ride?.route?.destination?.name || booking.ride?.route?.destination?.address?.split(',')[0] || '—'}
                          </td>
                          <td className="py-2 text-xs text-zinc-600 font-mono">{booking.bookingReference || '—'}</td>
                          <td className="py-2 text-zinc-600">{booking.seatsBooked || 1}</td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${booking.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : booking.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{booking.status}</span>
                          </td>
                          <td className="py-2">
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ring-1 ring-inset ${booking.payment?.status === 'PAID' || booking.payment?.status === 'PAYMENT_CONFIRMED' ? 'bg-green-100 text-green-700' : 'bg-zinc-100 text-zinc-600'}`}>
                              {booking.payment?.method || 'CASH'} · {booking.payment?.status || 'PENDING'}
                            </span>
                          </td>
                          <td className="py-2 text-right font-medium">₹{booking.totalPrice || 0}</td>
                          <td className="py-2 text-right text-zinc-600 font-medium">₹{booking.payment?.platformCommission || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-zinc-400 italic">No bookings made</p>
              )}
            </Section>
          </>
        )}

        {/* ══════════════════ ADMIN ACTIONS (always visible) ══════════════════ */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 mt-6">
          <h3 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Admin Actions</h3>
          <div className="flex flex-wrap gap-3">
            {user.accountStatus === 'ACTIVE' && (
              <button onClick={() => setShowSuspendModal(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition">
                <Ban size={16} />Suspend User
              </button>
            )}
            {user.accountStatus === 'SUSPENDED' && (
              <button onClick={() => setShowActivateModal(true)} className="inline-flex items-center gap-2 px-6 py-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition">
                <CheckCircle size={16} />Reactivate User
              </button>
            )}
            <button onClick={handleDelete} className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition">
              <Trash2 size={16} />Delete User
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════ MODALS ══════════════════ */}
      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Suspend User</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">Reason for suspending {displayName}:</p>
            <textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} placeholder="Reason for suspension..." className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-none text-zinc-900 dark:text-zinc-100" rows={4} />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowSuspendModal(false)} className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">Cancel</button>
              <button onClick={handleSuspend} className="flex-1 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition">Suspend</button>
            </div>
          </div>
        </div>
      )}

      {showActivateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-8 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">Reactivate User</h2>
            <p className="text-zinc-600 dark:text-zinc-400 mb-4">Notes for reactivating {displayName}:</p>
            <textarea value={activateNotes} onChange={(e) => setActivateNotes(e.target.value)} placeholder="Notes for reactivation..." className="w-full px-4 py-3 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 rounded-lg focus:ring-2 focus:ring-zinc-500 focus:border-transparent resize-none text-zinc-900 dark:text-zinc-100" rows={4} />
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowActivateModal(false)} className="flex-1 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">Cancel</button>
              <button onClick={handleActivate} className="flex-1 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg font-semibold hover:bg-zinc-200 transition">Reactivate</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserDetails;
