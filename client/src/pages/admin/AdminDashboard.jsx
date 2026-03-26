import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
  BarChart, Bar, CartesianGrid, RadialBarChart, RadialBar,
} from 'recharts';
import {
  Users, Radio, CheckCircle, IdCard, Coins, ArrowLeftRight,
  CalendarDays, ArrowUp, ArrowDown, ArrowRight, TrendingUp,
  Activity, Clock, Database, Cpu, AlertCircle, Flame, History,
  Bot, ShieldAlert, Route, Loader2, Shield, UserX, Heart,
  MapPin, Megaphone, AlertTriangle, Car, ClipboardList, Globe,
  Ticket, UserPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import adminService from '../../services/adminService';
import { Alert } from '../../components/common';
import { AIInsightCard } from '../../components/admin';
import { useSocket } from '../../context/SocketContext';

/* ═══ Helpers ═══ */
const formatDemandDay = (dk) => new Date(dk).toLocaleDateString('en-US', { weekday: 'short' });
const fmtK = (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v ?? 0));
const fmtCurrency = (v) => `₹${(v || 0).toLocaleString('en-IN')}`;
const pctChange = (curr, prev) => {
  if (!prev) return null;
  return ((curr - prev) / prev * 100).toFixed(1);
};

/* ═══ Normalize results ═══ */
const normalizeFraudResults = (payload) => ({
  ...payload,
  flaggedUsers: (payload?.details || []).map((pair) => ({
    _id: pair.userA, userId: pair.userA,
    name: `${String(pair.userA).slice(-6)} ↔ ${String(pair.userB).slice(-6)}`,
    reason: `${pair.ridesTogether} shared rides, ${pair.isolationRatioA}% / ${pair.isolationRatioB}% isolation`,
  })),
  summary: payload ? `Analyzed ${payload.analyzedBookings || 0} bookings — ${payload.suspiciousPairsFound || 0} suspicious pairs detected.` : '',
});

const normalizeChurnResults = (payload) => ({
  ...payload,
  atRiskUsers: payload?.users || [],
  totalFlagged: payload?.flaggedCount ?? 0,
  message: payload ? `Flagged ${payload.flaggedCount || 0} high-value inactive users.` : '',
});

/* ═══ Mini sparkline for stat cards ═══ */
const Sparkline = ({ data, color, height = 32 }) => {
  if (!data || data.length < 2) return null;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="v" stroke={color} fill={`url(#spark-${color.replace('#', '')})`} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
};

/* ═══ Trend Badge ═══ */
const TrendBadge = ({ value }) => {
  if (value === null || value === undefined) return null;
  const isPos = Number(value) >= 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md ring-1 ring-inset',
      isPos ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800' : 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800'
    )}>
      {isPos ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
      {Math.abs(value)}%
    </span>
  );
};

/* ═══ Live event icon mapping ═══ */
const EVENT_ICONS = {
  booking: Ticket,
  ride: Car,
  emergency: AlertTriangle,
  user: UserPlus,
  complete: CheckCircle,
};

/* ═══ Stat Card ═══ */
const CommandStatCard = ({ label, value, icon: Icon, link, sparkData, sparkColor, trend, subtitle }) => (
  <Link to={link} className="block group">
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors relative overflow-hidden">
      <div className="flex items-start justify-between mb-2">
        <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400">
          {Icon && <Icon size={18} />}
        </div>
        <TrendBadge value={trend} />
      </div>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight">{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
        {subtitle && <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{subtitle}</p>}
      </div>
      {sparkData && sparkData.length >= 2 && (
        <div className="mt-2 -mx-1">
          <Sparkline data={sparkData} color={sparkColor || '#0ead69'} />
        </div>
      )}
      <ArrowRight size={12} className="absolute top-3 right-3 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  </Link>
);

/* ═══ MAIN COMPONENT ═══ */
const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0, activeRides: 0, completedRides: 0,
    pendingVerifications: 0, totalRevenue: 0, totalTransactionVolume: 0, todayBookings: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [revenueTrend, setRevenueTrend] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [liveEvents, setLiveEvents] = useState([]);
  const [demandData, setDemandData] = useState([]);
  const { socket, isConnected } = useSocket();

  // Autonomous Ops State
  const [opsLoading, setOpsLoading] = useState({ fraud: false, churn: false, routes: false });
  const [fraudResults, setFraudResults] = useState(null);
  const [churnResults, setChurnResults] = useState(null);
  const [routeInsights, setRouteInsights] = useState(null);
  const [opsError, setOpsError] = useState('');

  // Autonomous Ops Actions
  const runFraudScan = useCallback(async () => {
    setOpsLoading(prev => ({ ...prev, fraud: true }));
    setOpsError('');
    try {
      const result = await adminService.triggerFraudDetection();
      setFraudResults(normalizeFraudResults(result.data || result));
    } catch (err) { setOpsError(`Fraud scan failed: ${err.message}`); }
    finally { setOpsLoading(prev => ({ ...prev, fraud: false })); }
  }, []);

  const runChurnScan = useCallback(async () => {
    setOpsLoading(prev => ({ ...prev, churn: true }));
    setOpsError('');
    try {
      const result = await adminService.triggerChurnPrediction();
      setChurnResults(normalizeChurnResults(result.data || result));
    } catch (err) { setOpsError(`Churn scan failed: ${err.message}`); }
    finally { setOpsLoading(prev => ({ ...prev, churn: false })); }
  }, []);

  const loadRouteInsights = useCallback(async () => {
    setOpsLoading(prev => ({ ...prev, routes: true }));
    setOpsError('');
    try {
      const result = await adminService.getUnbookedRoutesInsight();
      setRouteInsights(result.data || result);
    } catch (err) { setOpsError(`Route insights failed: ${err.message}`); }
    finally { setOpsLoading(prev => ({ ...prev, routes: false })); }
  }, []);

  // Load dashboard data
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        setLoading(true); setError('');
        const [response, revRes, healthRes] = await Promise.all([
          adminService.getDashboardStats(),
          adminService.getRevenueReport(new Date(Date.now() - 7 * 86400000).toISOString(), new Date().toISOString()).catch(() => null),
          adminService.getSystemHealth().catch(() => null),
        ]);
        if (isMounted) {
          if (response?.success) {
            setStats(response.stats || {});
            setRecentActivities(response.recentActivities || []);
          } else { setError('Failed to load dashboard data'); }
          if (revRes?.success) setRevenueTrend(revRes.data || []);
          if (healthRes?.success) setHealth(healthRes.health);
        }
      } catch (err) {
        if (isMounted && err.response?.status !== 401 && err.response?.status !== 403)
          setError(err.response?.data?.message || err.message || 'Failed to load dashboard');
      } finally { if (isMounted) setLoading(false); }
    };
    loadData();
    return () => { isMounted = false; };
  }, []);

  // Real-time Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handlers = {
      'booking-confirmed': () => {
        setLiveEvents(prev => [{ type: 'booking', message: 'New booking confirmed', time: new Date().toLocaleTimeString(), icon: 'fa-ticket-alt', color: 'blue' }, ...prev].slice(0, 15));
        setStats(prev => ({ ...prev, todayBookings: (prev.todayBookings || 0) + 1 }));
      },
      'ride-created': () => {
        setLiveEvents(prev => [{ type: 'ride', message: 'New ride posted', time: new Date().toLocaleTimeString(), icon: 'fa-car', color: 'emerald' }, ...prev].slice(0, 15));
        setStats(prev => ({ ...prev, activeRides: (prev.activeRides || 0) + 1 }));
      },
      'emergency-alert': () => {
        setLiveEvents(prev => [{ type: 'emergency', message: 'SOS Alert triggered', time: new Date().toLocaleTimeString(), icon: 'fa-exclamation-triangle', color: 'red' }, ...prev].slice(0, 15));
      },
      'user-joined': () => {
        setLiveEvents(prev => [{ type: 'user', message: 'New user registered', time: new Date().toLocaleTimeString(), icon: 'fa-user-plus', color: 'indigo' }, ...prev].slice(0, 15));
        setStats(prev => ({ ...prev, totalUsers: (prev.totalUsers || 0) + 1 }));
      },
      'ride-completed': () => {
        setLiveEvents(prev => [{ type: 'complete', message: 'Ride completed', time: new Date().toLocaleTimeString(), icon: 'fa-check-circle', color: 'green' }, ...prev].slice(0, 15));
        setStats(prev => ({ ...prev, completedRides: (prev.completedRides || 0) + 1, activeRides: Math.max(0, (prev.activeRides || 0) - 1) }));
      },
    };
    Object.entries(handlers).forEach(([ev, fn]) => socket.on(ev, fn));
    socket.on('new-booking', handlers['booking-confirmed']);
    return () => {
      Object.entries(handlers).forEach(([ev, fn]) => socket.off(ev, fn));
      socket.off('new-booking', handlers['booking-confirmed']);
    };
  }, [socket]);

  // Demand/Supply analytics
  useEffect(() => {
    const loadDemand = async () => {
      try {
        const res = await adminService.getDemandSupplyAnalytics();
        const analytics = res?.analytics || res?.data;
        if (res?.success && analytics) {
          const supplyByDay = new Map((analytics.supply || []).map(e => [e._id, e]));
          const demandByDay = new Map((analytics.demand || []).map(e => [e._id, e]));
          const mergedDays = Array.from(new Set([...supplyByDay.keys(), ...demandByDay.keys()])).sort();
          setDemandData(mergedDays.map(dk => {
            const supply = supplyByDay.get(dk) || {};
            const demand = demandByDay.get(dk) || {};
            return {
              day: formatDemandDay(dk), date: dk,
              rides: supply.ridesPosted || 0,
              bookings: demand.bookingsRequested || 0,
              ratio: (supply.ridesPosted || 0) > 0 ? (demand.bookingsRequested || 0) / (supply.ridesPosted || 0) : 0,
            };
          }));
        }
      } catch (err) { console.error('Demand data error:', err); }
    };
    loadDemand();
  }, []);

  // Derived data
  const revenueSparkData = useMemo(() => revenueTrend.map(d => ({ v: d.revenue || 0 })), [revenueTrend]);
  const bookingsSparkData = useMemo(() => demandData.map(d => ({ v: d.bookings || 0 })), [demandData]);
  const ridesSparkData = useMemo(() => demandData.map(d => ({ v: d.rides || 0 })), [demandData]);
  const revenuePct = useMemo(() => {
    if (revenueTrend.length < 2) return null;
    return pctChange(revenueTrend[revenueTrend.length - 1]?.revenue || 0, revenueTrend[revenueTrend.length - 2]?.revenue || 0);
  }, [revenueTrend]);
  const demandSummary = useMemo(() => {
    if (!demandData.length) return { avgRatio: 0, peakDay: null };
    const avg = demandData.reduce((acc, d) => acc + d.ratio, 0) / demandData.length;
    const peak = demandData.reduce((a, b) => (b.bookings > a.bookings ? b : a), demandData[0]);
    return { avgRatio: avg.toFixed(2), peakDay: peak };
  }, [demandData]);
  const healthScore = useMemo(() => {
    if (!health) return null;
    let s = 70;
    if (health.status === 'healthy') s += 20;
    if (health.database?.status === 'connected') s += 10;
    return Math.min(100, s);
  }, [health]);

  const statCards = [
    { label: 'Total Users', value: fmtK(stats.totalUsers), icon: Users, link: '/admin/users', sparkColor: '#3b82f6', subtitle: 'All registered' },
    { label: 'Active Rides', value: stats.activeRides, icon: Radio, link: '/admin/rides', sparkData: ridesSparkData, sparkColor: '#0ead69', subtitle: 'Right now' },
    { label: 'Completed', value: fmtK(stats.completedRides), icon: CheckCircle, link: '/admin/rides?status=completed', sparkColor: '#16a34a' },
    { label: 'Verifications', value: stats.pendingVerifications, icon: IdCard, link: '/admin/verifications', sparkColor: '#f97316', subtitle: 'Pending' },
    { label: 'Revenue', value: fmtCurrency(stats.totalRevenue), icon: Coins, link: '/admin/financials', sparkData: revenueSparkData, sparkColor: '#7c3aed', trend: revenuePct },
    { label: 'Volume', value: fmtCurrency(stats.totalTransactionVolume), icon: ArrowLeftRight, link: '/admin/financials', sparkColor: '#6366f1' },
    { label: "Today's Bookings", value: stats.todayBookings, icon: CalendarDays, link: '/admin/bookings', sparkData: bookingsSparkData, sparkColor: '#eab308' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={24} className="animate-spin text-zinc-400 mx-auto mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* ═══ HEADER ═══ */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Dashboard</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Platform overview & real-time intelligence</p>
          </div>
          <div className="flex items-center gap-3">
            {healthScore !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-sm">
                <div className={cn('w-2 h-2 rounded-full', healthScore >= 90 ? 'bg-emerald-500' : healthScore >= 70 ? 'bg-yellow-500' : 'bg-red-500')} />
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{healthScore}%</span>
                <span className="text-xs text-zinc-400">Health</span>
              </div>
            )}
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium',
              isConnected
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
              {isConnected ? 'LIVE' : 'OFFLINE'}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {error && <Alert type="error" message={error} className="mb-6" />}

        {/* ═══ STAT CARDS GRID ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map((stat, i) => <CommandStatCard key={i} {...stat} />)}
        </div>

        {/* ═══ PRIMARY ROW: Revenue Chart + System Status ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Revenue Trend</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">7-day rolling window</p>
              </div>
              <Link to="/admin/analytics" className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 flex items-center gap-1">
                Full Analytics <ArrowRight size={12} />
              </Link>
            </div>
            {revenueTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={revenueTrend}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ead69" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0ead69" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="_id" tickFormatter={d => new Date(d).toLocaleDateString('en-IN', { weekday: 'short' })} stroke="#9ca3af" fontSize={11} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `₹${fmtK(v)}`} stroke="#9ca3af" fontSize={11} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(val) => [`₹${val.toLocaleString('en-IN')}`, 'Revenue']}
                    labelFormatter={d => new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0ead69" fill="url(#revGrad)" strokeWidth={2} dot={{ r: 3, fill: '#0ead69' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                <div className="text-center">
                  <TrendingUp size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm">Revenue data loads as transactions occur</p>
                </div>
              </div>
            )}
          </div>

          {/* System Status Panel */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">System Status</h2>
            {health ? (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <div className="relative w-28 h-28">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" data={[{ value: healthScore, fill: healthScore >= 90 ? '#0ead69' : healthScore >= 70 ? '#f4a261' : '#e07a5f' }]} startAngle={180} endAngle={0}>
                        <RadialBar background clockWise dataKey="value" cornerRadius={10} />
                      </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{healthScore}%</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { icon: Clock, label: 'Uptime', val: health.uptimeFormatted },
                    { icon: Database, label: 'Database', val: health.database?.status === 'connected' ? 'Connected' : 'Down', valColor: health.database?.status === 'connected' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400' },
                    { icon: Cpu, label: 'Memory', val: `${health.memory?.heapUsed}MB / ${health.memory?.heapTotal}MB` },
                    { icon: AlertCircle, label: 'Alerts', val: `${health.counters?.pendingEmergencies || 0} SOS · ${health.counters?.pendingReports || 0} reports` },
                  ].map(m => (
                    <div key={m.label} className="flex items-center justify-between py-2 px-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-md">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5"><m.icon size={12} /> {m.label}</span>
                      <span className={cn('text-xs font-medium', m.valColor || 'text-zinc-700 dark:text-zinc-300')}>{m.val}</span>
                    </div>
                  ))}
                </div>
                <Link to="/admin/health" className="block text-center text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 mt-2">Full System Health →</Link>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                <div className="text-center"><Activity size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" /><p className="text-sm">Health data unavailable</p></div>
              </div>
            )}
          </div>
        </div>

        {/* ═══ AI INTELLIGENCE ═══ */}
        <div className="mb-8">
          <AIInsightCard
            context="dashboard"
            metrics={{ totalUsers: stats.totalUsers, activeRides: stats.activeRides, completedRides: stats.completedRides, todayBookings: stats.todayBookings, totalRevenue: stats.totalRevenue, pendingVerifications: stats.pendingVerifications }}
            title="AI Platform Intelligence"
          />
        </div>

        {/* ═══ DEMAND + LIVE EVENTS ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Flame size={14} className="text-orange-500" /> Demand vs Supply
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {demandSummary.peakDay ? `Peak: ${demandSummary.peakDay.day} (${demandSummary.peakDay.bookings} bookings)` : 'Weekly pattern'}
                </p>
              </div>
              {Number(demandSummary.avgRatio) > 0 && (
                <span className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-md ring-1 ring-inset',
                  Number(demandSummary.avgRatio) > 1
                    ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800'
                    : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800'
                )}>
                  D/S {demandSummary.avgRatio}
                </span>
              )}
            </div>
            {demandData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={demandData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e4e4e7', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                    <Bar dataKey="rides" name="Supply" fill="#0ead69" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="bookings" name="Demand" fill="#f4a261" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-center gap-6 mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-emerald-500" /> Supply</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-yellow-500" /> Demand</span>
                </div>
              </>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-zinc-400 dark:text-zinc-500">
                <div className="text-center"><TrendingUp size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" /><p className="text-sm">Demand data populates with ride activity</p></div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span className={cn('w-2 h-2 rounded-full', isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500')} />
                Live Feed
              </h2>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{liveEvents.length} events</span>
            </div>
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
              {liveEvents.length > 0 ? liveEvents.map((event, index) => {
                const EvIcon = EVENT_ICONS[event.type] || Activity;
                return (
                  <div
                    key={`${event.type}-${event.time}-${index}`}
                    className="flex items-center gap-3 p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-md bg-zinc-200/60 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                      <EvIcon size={14} className="text-zinc-500 dark:text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{event.message}</p>
                      <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{event.time}</p>
                    </div>
                    {event.type === 'emergency' && <span className="w-2 h-2 bg-red-500 rounded-full animate-ping flex-shrink-0" />}
                  </div>
                );
              }) : (
                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
                  <Radio size={28} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm font-medium">Listening for events...</p>
                  <p className="text-[10px] mt-1">{isConnected ? 'Socket connected — waiting for activity' : 'Connecting to server...'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ QUICK NAV + RECENT ACTIVITY ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Quick Access</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/admin/users', icon: Users, label: 'Users' },
                { to: '/admin/rides', icon: Car, label: 'Rides' },
                { to: '/admin/bookings', icon: ClipboardList, label: 'Bookings' },
                { to: '/admin/safety', icon: Shield, label: 'Safety' },
                { to: '/admin/verifications', icon: IdCard, label: 'Verify' },
                { to: '/admin/bird-eye', icon: Globe, label: 'Bird Eye' },
                { to: '/admin/fraud', icon: ShieldAlert, label: 'Fraud' },
                { to: '/admin/geo-fencing', icon: MapPin, label: 'Geo-Fence' },
              ].map(item => (
                <Link key={item.to} to={item.to} className="flex flex-col items-center gap-1.5 p-3 rounded-md bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group">
                  <item.icon size={16} className="text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-300 transition-colors" />
                  <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Recent Activities</h2>
            <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
              {recentActivities.length > 0 ? recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center gap-3 p-2.5 bg-zinc-50 dark:bg-zinc-800/50 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                  <div className="w-8 h-8 rounded-md bg-zinc-200/60 dark:bg-zinc-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">{activity.icon || '📌'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{activity.message}</p>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{activity.time}</p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-12 text-zinc-400 dark:text-zinc-500">
                  <History size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" /><p className="text-sm">No recent activities yet</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══ AUTONOMOUS OPS CENTER ═══ */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-5">
            <Bot size={18} className="text-zinc-500 dark:text-zinc-400" />
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Autonomous Operations</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">AI-powered threat detection, churn prediction & route intelligence</p>
            </div>
          </div>

          {opsError && <Alert type="error" className="mb-4">{opsError}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { title: 'Fraud Detection', desc: 'Scan for suspicious transaction patterns and fake booking rings', icon: ShieldAlert, loading: opsLoading.fraud, action: runFraudScan, btnText: 'Run Fraud Scan' },
              { title: 'Churn Prediction', desc: 'Identify at-risk users who may stop using the platform', icon: TrendingUp, loading: opsLoading.churn, action: runChurnScan, btnText: 'Run Churn Scan' },
              { title: 'Route Intelligence', desc: 'Discover oversupplied routes and high-demand opportunities', icon: Route, loading: opsLoading.routes, action: loadRouteInsights, btnText: 'Analyze Routes' },
            ].map(op => (
              <div key={op.title} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
                <op.icon size={18} className="text-zinc-400 dark:text-zinc-500 mb-3" />
                <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1">{op.title}</h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 leading-relaxed">{op.desc}</p>
                <button onClick={op.action} disabled={op.loading} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition-colors">
                  {op.loading ? <><Loader2 size={14} className="animate-spin" /> Scanning...</> : op.btnText}
                </button>
              </div>
            ))}
          </div>

          {/* Ops Results */}
          {fraudResults && (
            <div className="mb-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
              <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2"><Shield size={14} className="text-red-500" /> Fraud Scan Results</h3>
              {fraudResults.flaggedUsers?.length > 0 ? (
                <div className="space-y-2">
                  {fraudResults.flaggedUsers.slice(0, 5).map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/10 rounded-md border border-red-100 dark:border-red-900/20">
                      <div><p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{u.name || u.email || `User ${i + 1}`}</p><p className="text-xs text-red-600 dark:text-red-400">{u.reason}</p></div>
                      <Link to={`/admin/users/${u.userId || u._id}`} className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 font-medium">Investigate →</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6"><CheckCircle size={20} className="mx-auto mb-2 text-emerald-500" /><p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">All clear — no fraud detected</p></div>
              )}
              {fraudResults.summary && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-md">{fraudResults.summary}</p>}
            </div>
          )}

          {churnResults && (
            <div className="mb-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
              <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2"><UserX size={14} className="text-yellow-500" /> Churn Risk Assessment</h3>
              {churnResults.atRiskUsers?.length > 0 ? (
                <div className="space-y-2">
                  {churnResults.atRiskUsers.slice(0, 5).map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded-md border border-yellow-100 dark:border-yellow-900/20">
                      <div><p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{u.name || u.email || `User ${i + 1}`}</p><p className="text-xs text-yellow-700 dark:text-yellow-400">Last active: {u.lastRideAt ? new Date(u.lastRideAt).toLocaleDateString() : 'Unknown'}{u.riskScore ? ` · Risk: ${u.riskScore}%` : ''}</p></div>
                      <Link to={`/admin/users/${u.userId || u._id}`} className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300 font-medium">View →</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6"><Heart size={20} className="mx-auto mb-2 text-emerald-500" /><p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">All users actively engaged!</p></div>
              )}
              {churnResults.totalFlagged !== undefined && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-md">Total flagged: {churnResults.totalFlagged}{churnResults.message && ` — ${churnResults.message}`}</p>}
            </div>
          )}

          {routeInsights && (
            <div className="mb-4 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
              <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2"><MapPin size={14} className="text-blue-500" /> Route Intelligence — {routeInsights.period || 'Last 30 days'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <h4 className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1"><Flame size={12} /> High Demand</h4>
                  {routeInsights.highDemand?.length > 0 ? routeInsights.highDemand.map((r, i) => (
                    <div key={i} className="p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-md mb-1.5 border border-emerald-100 dark:border-emerald-900/20"><p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{r.route}</p><p className="text-[10px] text-emerald-700 dark:text-emerald-400">{r.fillRate}% fill · {r.totalRides} rides</p></div>
                  )) : <p className="text-xs text-zinc-400 dark:text-zinc-500">None</p>}
                </div>
                <div>
                  <h4 className="text-xs font-medium text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Oversupplied</h4>
                  {routeInsights.oversupplied?.length > 0 ? routeInsights.oversupplied.map((r, i) => (
                    <div key={i} className="p-2 bg-orange-50 dark:bg-orange-900/10 rounded-md mb-1.5 border border-orange-100 dark:border-orange-900/20"><p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{r.route}</p><p className="text-[10px] text-orange-700 dark:text-orange-400">{r.unbookedRate}% unbooked · ₹{r.avgPrice} avg</p></div>
                  )) : <p className="text-xs text-zinc-400 dark:text-zinc-500">None</p>}
                </div>
                <div>
                  <h4 className="text-xs font-medium text-blue-700 dark:text-blue-400 mb-2 flex items-center gap-1"><Megaphone size={12} /> Needs Push</h4>
                  {routeInsights.needsPromotion?.length > 0 ? routeInsights.needsPromotion.map((r, i) => (
                    <div key={i} className="p-2 bg-blue-50 dark:bg-blue-900/10 rounded-md mb-1.5 border border-blue-100 dark:border-blue-900/20"><p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 truncate">{r.route}</p><p className="text-[10px] text-blue-700 dark:text-blue-400">{r.suggestion}</p></div>
                  )) : <p className="text-xs text-zinc-400 dark:text-zinc-500">None</p>}
                </div>
              </div>
              {routeInsights.healthy !== undefined && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-md flex items-center gap-1"><CheckCircle size={12} className="text-emerald-500" />{routeInsights.healthy} routes with balanced supply/demand</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
