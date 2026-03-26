/**
 * AdminSustainability — Carbon Footprint & Environmental Impact Dashboard
 * REDESIGNED: Uses dedicated /api/admin/sustainability endpoint for real DB data.
 * Sections: Hero KPIs, Green Score, Monthly Trends, Route Leaderboard, Green Champions, SDGs, Config
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line, RadialBarChart, RadialBar,
} from 'recharts';
import adminService from '../../services/adminService';
import { AdminStatCard, AIInsightCard, AdminPageHeader } from '../../components/admin';
import {
  Cloud, TreePine, Fuel, Car, Globe, Recycle, Handshake,
  RefreshCw, Loader2, Settings2, Users, TrendingUp, Route,
  Award, Leaf, Zap, MapPin, ArrowUpRight, ArrowDownRight, Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['#0ead69', '#6366f1', '#f4a261', '#dc2626', '#0ea5e9', '#a855f7'];

/* ── Shared Tooltip ────────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-3 text-sm">
      <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color }} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: e.color }} />
          {e.name}: {typeof e.value === 'number' ? e.value.toLocaleString('en-IN') : e.value}
        </p>
      ))}
    </div>
  );
};

/* ── Green Score Ring ──────────────────────────────────────── */
const GreenScoreRing = ({ score }) => {
  const data = [{ name: 'Score', value: score, fill: score >= 70 ? '#16a34a' : score >= 40 ? '#f59e0b' : '#dc2626' }];
  return (
    <div className="relative w-40 h-40 mx-auto">
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" startAngle={90} endAngle={-270} data={data} barSize={12}>
          <RadialBar background={{ fill: '#e4e4e7' }} dataKey="value" cornerRadius={6} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{score}</span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Green Score</span>
      </div>
    </div>
  );
};

/* ── Progress Bar Helper ───────────────────────────────────── */
const ProgressBar = ({ value, max, color = '#16a34a', label, suffix = '' }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-200">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}{suffix}</span>
      </div>
      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const AdminSustainability = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminService.getSustainabilityData();
      setData(res?.data || res || null);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Destructure
  const summary = data?.summary || {};
  const rides = data?.rides || {};
  const bookings = data?.bookings || {};
  const config = data?.config || {};
  const monthly = data?.monthly || [];
  const greenRoutes = data?.greenRoutes || [];
  const greenLeaders = data?.greenLeaders || [];
  const totalUsers = data?.totalUsers || 0;

  // Derived
  const totalCO2 = summary.totalCO2Saved || 0;
  const greenScore = summary.greenScore || 0;

  // Monthly trend with growth indicators
  const monthlyWithGrowth = useMemo(() => {
    return monthly.map((m, i) => ({
      ...m,
      co2Growth: i > 0 && monthly[i - 1].co2Saved > 0
        ? Math.round(((m.co2Saved - monthly[i - 1].co2Saved) / monthly[i - 1].co2Saved) * 100)
        : 0,
    }));
  }, [monthly]);

  // AI metrics
  const aiMetrics = {
    totalCO2SavedKg: Math.round(totalCO2),
    treesEquivalent: summary.treesEquivalent || 0,
    fuelSavedLiters: summary.fuelSavedLiters || 0,
    totalCarpoolRides: rides.completed || 0,
    avgPassengersPerRide: rides.avgPassengers || 0,
    carsRemovedEquivalent: summary.carsOffRoad || 0,
    greenScore,
    completionRate: rides.completionRate || 0,
    totalDistance: summary.totalDistance || 0,
    topRoute: greenRoutes[0] ? `${greenRoutes[0].from} → ${greenRoutes[0].to}` : 'N/A',
    co2PerKm: config.co2PerKm || 0.12,
    co2PerTree: config.co2PerTree || 22,
  };

  // Impact breakdown pie
  const impactPie = useMemo(() => [
    { name: 'CO₂ Saved (kg)', value: Math.round(totalCO2) },
    { name: 'Fuel Saved (L)', value: summary.fuelSavedLiters || 0 },
    { name: 'Solo km Avoided', value: summary.soloKmAvoided || 0 },
  ].filter(d => d.value > 0), [totalCO2, summary]);

  const SDG_ITEMS = [
    { Icon: Globe, num: 11, title: 'Sustainable Cities', desc: 'Making cities inclusive, safe, resilient and sustainable', color: 'emerald' },
    { Icon: Recycle, num: 13, title: 'Climate Action', desc: 'Taking urgent action to combat climate change', color: 'teal' },
    { Icon: Handshake, num: 17, title: 'Partnerships', desc: 'Strengthening global partnerships for sustainable development', color: 'sky' },
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', Icon: TrendingUp },
    { id: 'routes', label: 'Green Routes', Icon: Route },
    { id: 'leaders', label: 'Champions', Icon: Trophy },
    { id: 'config', label: 'Config', Icon: Settings2 },
  ];

  // ─── Skeleton ─────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Sustainability Impact" subtitle="Loading environmental data..." />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-80 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminPageHeader
        title="Sustainability Impact"
        subtitle="Environmental metrics, carbon savings, green routes, and ESG reporting"
        actions={
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
        }
      />

      {/* AI Intelligence */}
      <AIInsightCard context="sustainability" metrics={aiMetrics} title="Environmental Intelligence" />

      {/* ─── Hero Stats + Green Score ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-4">
        {/* Green Score Card */}
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-6 flex flex-col items-center justify-center">
          <GreenScoreRing score={greenScore} />
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-3 text-center font-medium">
            {greenScore >= 70 ? 'Excellent environmental performance' : greenScore >= 40 ? 'Good progress — room to grow' : 'Early stage — keep carpooling!'}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminStatCard
            title="CO₂ Saved"
            value={totalCO2 > 1000 ? `${(totalCO2 / 1000).toFixed(1)}t` : `${Math.round(totalCO2)}kg`}
            icon={Cloud}
            subtitle={`${rides.completed || 0} carpool rides`}
            loading={loading}
          />
          <AdminStatCard
            title="Trees Equivalent"
            value={(summary.treesEquivalent || 0).toLocaleString('en-IN')}
            icon={TreePine}
            subtitle={`@ ${config.co2PerTree || 22}kg/tree/yr`}
            loading={loading}
          />
          <AdminStatCard
            title="Fuel Saved"
            value={`${(summary.fuelSavedLiters || 0).toLocaleString('en-IN')}L`}
            icon={Fuel}
            subtitle="Petrol equivalent"
            loading={loading}
          />
          <AdminStatCard
            title="Distance Pooled"
            value={`${Math.round(summary.totalDistance || 0).toLocaleString('en-IN')}km`}
            icon={MapPin}
            subtitle={`Avg ${rides.avgDistance || 0}km/ride`}
            loading={loading}
          />
        </div>
      </div>

      {/* ─── Secondary Stats Bar ───────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Completed Rides', value: rides.completed || 0, Icon: Car, color: 'text-emerald-600' },
          { label: 'Avg Passengers', value: (rides.avgPassengers || 0).toFixed(1), Icon: Users, color: 'text-indigo-600' },
          { label: 'Completion Rate', value: `${rides.completionRate || 0}%`, Icon: Zap, color: 'text-amber-600' },
          { label: 'Solo km Avoided', value: (summary.soloKmAvoided || 0).toLocaleString('en-IN'), Icon: ArrowDownRight, color: 'text-red-500' },
          { label: 'Cars Off Road', value: summary.carsOffRoad || 0, Icon: Car, color: 'text-teal-600' },
          { label: 'Green Users', value: totalUsers, Icon: Leaf, color: 'text-green-600' },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 flex items-center gap-3">
            <s.Icon size={16} className={s.color} />
            <div>
              <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{s.label}</p>
              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Tabs ──────────────────────────────────────────── */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition',
              activeTab === tab.id
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}>
            <tab.Icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ OVERVIEW TAB ════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <>
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Carbon Savings Trend */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Carbon Savings Trend</h3>
              <p className="text-xs text-zinc-400 mb-4">Monthly CO₂ saved from carpooling (kg)</p>
              {monthly.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={monthlyWithGrowth}>
                    <defs>
                      <linearGradient id="co2Grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}kg`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="co2Saved" stroke="#16a34a" strokeWidth={2} fill="url(#co2Grad)" name="CO₂ Saved (kg)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-sm text-zinc-400">No monthly data yet</div>
              )}
            </div>

            {/* Rides + Passengers + CO₂ Multi-Bar */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Monthly Activity Breakdown</h3>
              <p className="text-xs text-zinc-400 mb-4">Rides, passengers booked, and fuel saved per month</p>
              {monthly.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="rides" fill="#6366f1" name="Rides" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="passengers" fill="#0ead69" name="Passengers" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="fuelSaved" fill="#f4a261" name="Fuel Saved (L)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-sm text-zinc-400">No monthly data yet</div>
              )}
            </div>
          </div>

          {/* Impact Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Impact Distribution Pie */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Impact Distribution</h3>
              {impactPie.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={impactPie} innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                        {impactPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v, name) => [v.toLocaleString('en-IN'), name]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {impactPie.map((d, i) => (
                      <span key={d.name} className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        {d.name}: {d.value.toLocaleString('en-IN')}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-sm text-zinc-400">No impact data yet</div>
              )}
            </div>

            {/* Per-Ride Impact Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Per-Ride Metrics</h3>
              <div className="space-y-3">
                <ProgressBar label="CO₂ saved/ride" value={Number((config.co2SavedPerRide || 0).toFixed(2))} max={2} color="#16a34a" suffix=" kg" />
                <ProgressBar label="Avg distance" value={rides.avgDistance || 0} max={50} color="#6366f1" suffix=" km" />
                <ProgressBar label="Avg passengers" value={rides.avgPassengers || 0} max={4} color="#f59e0b" />
                <ProgressBar label="Completion rate" value={rides.completionRate || 0} max={100} color="#0ea5e9" suffix="%" />
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">CO₂ factor</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{config.co2PerKm} kg/km</span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-zinc-400">Tree factor</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">{config.co2PerTree} kg/tree/yr</span>
                </div>
              </div>
            </div>

            {/* SDG Alignment */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">UN SDG Alignment</h3>
              {SDG_ITEMS.map(({ Icon, num, title, desc, color }) => (
                <div key={num} className={cn(
                  'p-4 rounded-xl border transition-all hover:shadow-sm',
                  color === 'emerald' && 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800',
                  color === 'teal' && 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800',
                  color === 'sky' && 'bg-sky-50 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800',
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm',
                      color === 'emerald' ? 'bg-emerald-600' : color === 'teal' ? 'bg-teal-600' : 'bg-sky-600'
                    )}>
                      {num}
                    </div>
                    <div>
                      <p className={cn('font-semibold text-sm',
                        color === 'emerald' && 'text-emerald-700 dark:text-emerald-400',
                        color === 'teal' && 'text-teal-700 dark:text-teal-400',
                        color === 'sky' && 'text-sky-700 dark:text-sky-400',
                      )}>{title}</p>
                      <p className={cn('text-xs',
                        color === 'emerald' && 'text-emerald-600/70 dark:text-emerald-400/70',
                        color === 'teal' && 'text-teal-600/70 dark:text-teal-400/70',
                        color === 'sky' && 'text-sky-600/70 dark:text-sky-400/70',
                      )}>{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
              <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700">
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  LoopLane contributes to 3 UN Sustainable Development Goals by reducing single-occupancy car trips
                  and promoting shared mobility across Indian cities.
                </p>
              </div>
            </div>
          </div>

          {/* Distance + Revenue Line */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Distance Pooled vs Revenue</h3>
            <p className="text-xs text-zinc-400 mb-4">How carpooling distance correlates with platform revenue per month</p>
            {monthly.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}km`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="left" type="monotone" dataKey="distance" stroke="#16a34a" strokeWidth={2} dot={{ r: 4 }} name="Distance (km)" />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Revenue (₹)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center text-sm text-zinc-400">No data yet</div>
            )}
          </div>
        </>
      )}

      {/* ═══ GREEN ROUTES TAB ════════════════════════════════ */}
      {activeTab === 'routes' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Top Green Routes</h3>
              <p className="text-xs text-zinc-400 mt-1">Routes with the highest environmental impact from carpooling</p>
            </div>
            {greenRoutes.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {greenRoutes.map((route, i) => (
                  <div key={i} className="px-6 py-4 flex items-center gap-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    {/* Rank */}
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
                      i === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                      i === 1 ? 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300' :
                      i === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                    )}>
                      {i + 1}
                    </div>

                    {/* Route Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {route.from}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <ArrowUpRight size={12} className="text-emerald-500" />
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{route.to}</p>
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="flex items-center gap-6 text-right flex-shrink-0">
                      <div>
                        <p className="text-xs text-zinc-400">Rides</p>
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{route.rides}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400">Avg Dist</p>
                        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">{route.distance}km</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400">CO₂ Saved</p>
                        <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{route.co2Saved}kg</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-sm text-zinc-400">No route data available yet</div>
            )}
          </div>

          {/* Route CO₂ Bar Chart */}
          {greenRoutes.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">CO₂ Saved by Route</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={greenRoutes.slice(0, 6).map(r => ({ name: `${r.from.split(',')[0]} → ${r.to.split(',')[0]}`, co2: r.co2Saved, rides: r.rides }))} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}kg`} />
                  <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="co2" fill="#16a34a" name="CO₂ Saved (kg)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ═══ CHAMPIONS TAB ═══════════════════════════════════ */}
      {activeTab === 'leaders' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Green Champions Leaderboard</h3>
              <p className="text-xs text-zinc-400 mt-1">Users with the most completed carpool trips — leading the sustainability charge</p>
            </div>
            {greenLeaders.length > 0 ? (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {greenLeaders.map((user, i) => (
                  <div key={i} className="px-6 py-4 flex items-center gap-4">
                    {/* Medal */}
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
                      i === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-white' :
                      i === 1 ? 'bg-gradient-to-br from-zinc-300 to-zinc-400 text-white' :
                      i === 2 ? 'bg-gradient-to-br from-orange-400 to-amber-600 text-white' :
                      'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                    )}>
                      {i < 3 ? <Award size={18} /> : <span className="text-sm font-bold">{i + 1}</span>}
                    </div>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{user.name}</p>
                      <p className="text-xs text-zinc-400">{user.trips} completed trips</p>
                    </div>

                    {/* CO₂ Badge */}
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{user.co2Saved}kg</span>
                        <span className="text-[10px] text-emerald-500 ml-1">CO₂</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-sm text-zinc-400">No champion data available yet</div>
            )}
          </div>

          {/* Champion Stats */}
          {greenLeaders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 rounded-xl border border-amber-200 dark:border-amber-800 p-5 text-center">
                <Award size={28} className="text-amber-500 mx-auto mb-2" />
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{greenLeaders[0]?.name}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{greenLeaders[0]?.trips} trips · {greenLeaders[0]?.co2Saved}kg CO₂ saved</p>
                <p className="text-[10px] text-zinc-400 mt-2 uppercase tracking-wider font-semibold">Top Green Champion</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                <p className="text-xs text-zinc-400 mb-2">Total Champion CO₂</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {greenLeaders.reduce((s, u) => s + u.co2Saved, 0).toFixed(1)}kg
                </p>
                <p className="text-xs text-zinc-400 mt-1">From top {greenLeaders.length} users</p>
              </div>
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                <p className="text-xs text-zinc-400 mb-2">Total Champion Trips</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {greenLeaders.reduce((s, u) => s + u.trips, 0)}
                </p>
                <p className="text-xs text-zinc-400 mt-1">{((greenLeaders.reduce((s, u) => s + u.trips, 0) / Math.max(1, bookings.completed)) * 100).toFixed(0)}% of all completed bookings</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ CONFIG TAB ══════════════════════════════════════ */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Environmental Calculation Parameters</h3>
            <p className="text-xs text-zinc-400 mb-6">These values come from Platform Settings → Environmental. Changes made there will reflect here on next refresh.</p>
            <div className="space-y-4">
              {[
                { label: 'CO₂ per km (kg)', value: config.co2PerKm || 0.12, desc: 'Kilograms of CO₂ saved per carpooled kilometer', icon: Cloud },
                { label: 'CO₂ per tree/year (kg)', value: config.co2PerTree || 22, desc: 'CO₂ absorbed by one tree annually — used for tree equivalence', icon: TreePine },
                { label: 'Avg ride distance (km)', value: rides.avgDistance || 0, desc: 'Average ride distance computed from completed rides', icon: MapPin },
                { label: 'Avg passengers/ride', value: (rides.avgPassengers || 0).toFixed(1), desc: 'Average passengers per ride (driver + riders)', icon: Users },
                { label: 'CO₂ saved per ride (kg)', value: (config.co2SavedPerRide || 0).toFixed(3), desc: 'co2PerKm × avgDistance × (1 - 1/avgPassengers)', icon: Leaf },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                  <item.icon size={16} className="text-zinc-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{item.label}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{item.desc}</p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-md flex-shrink-0">{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Formula Card */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Calculation Formula</h3>
              <div className="space-y-3 text-sm">
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800">
                  <p className="font-mono text-xs text-emerald-800 dark:text-emerald-300">
                    CO₂/ride = co2PerKm × avgDistance × (1 - 1/avgPassengers)
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                  <p className="font-mono text-xs text-indigo-800 dark:text-indigo-300">
                    Total CO₂ = completedRides × CO₂/ride
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800">
                  <p className="font-mono text-xs text-amber-800 dark:text-amber-300">
                    Trees = totalCO₂ / co2PerTree
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800">
                  <p className="font-mono text-xs text-sky-800 dark:text-sky-300">
                    Fuel (L) = totalDistance × (1 - 1/avgPassengers) / 12
                  </p>
                </div>
              </div>
            </div>

            {/* Data Summary */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Data Summary</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Completed Rides', value: rides.completed || 0 },
                  { label: 'Completed Bookings', value: bookings.completed || 0 },
                  { label: 'Total Revenue', value: `₹${(bookings.totalRevenue || 0).toLocaleString('en-IN')}` },
                  { label: 'Total Distance', value: `${Math.round(summary.totalDistance || 0)}km` },
                  { label: 'Total Users', value: totalUsers },
                  { label: 'Passenger Trips', value: rides.totalPassengerTrips || 0 },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{item.label}</p>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-1">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSustainability;
