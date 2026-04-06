/**
 * AdminAnalytics — Platform Analytics Observatory
 * 9 tabs: Revenue, Activity, Rides, Routes, Areas, User Revenue, Comparison, Advanced, Funnel
 * Uses shared AdminStatCard/AdminPageHeader, deck.gl map for Areas, proper dark mode
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import DeckGL from '@deck.gl/react';
import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
import { Map as MapGL } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  ArrowUp, ArrowDown, BarChart3, TrendingUp, Route, MapPin, Users,
  Scale, PieChart as PieIcon, Loader2, Activity, Globe, Layers,
  ArrowUpRight, ArrowDownRight, GitCompare, Navigation, Crosshair
} from 'lucide-react';
import { cn } from '@/lib/utils';
import adminService from '../../services/adminService';
import { AdminStatCard, AdminPageHeader, AIInsightCard, ExportButton } from '../../components/admin';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const INDIA_VIEW = { longitude: 78.9629, latitude: 20.5937, zoom: 4.5, pitch: 35, bearing: 0 };

// ─── Constants ───────────────────────────────────────────────
const CHART_COLORS = ['#0ead69', '#6366f1', '#18181b', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#8ee4af'];

const PERIODS = [
  { value: 'week', label: '7 Days' },
  { value: 'month', label: '30 Days' },
  { value: 'year', label: '1 Year' },
];

const mapRollingPeriod = (p) => p === 'week' ? '7d' : p === 'year' ? '1y' : '30d';

const TABS = [
  { key: 'revenue', label: 'Revenue', Icon: TrendingUp },
  { key: 'activity', label: 'Activity', Icon: Activity },
  { key: 'rides', label: 'Rides', Icon: Route },
  { key: 'routes', label: 'Routes', Icon: GitCompare },
  { key: 'areas', label: 'Areas', Icon: Globe },
  { key: 'users', label: 'User Revenue', Icon: Users },
  { key: 'comparison', label: 'Comparison', Icon: Scale },
  { key: 'advanced', label: 'Advanced', Icon: Layers },
  { key: 'funnel', label: 'Funnel', Icon: PieIcon },
];

// ─── Normalizers ─────────────────────────────────────────────
const normalizeAreaAnalytics = (p) => ({
  ...p,
  originCities: (p?.originCities || []).map(c => ({ ...c, _id: c.city || c._id || 'Unknown', count: c.ridesFrom ?? c.count ?? 0 })),
  destinationCities: (p?.destinationCities || p?.destCities || []).map(c => ({ ...c, _id: c.city || c._id || 'Unknown', count: c.ridesTo ?? c.count ?? 0 })),
  userGrowth: (p?.userGrowth || []).map(e => ({ ...e, count: e.newUsers ?? e.count ?? 0 })),
});

const normalizeUserRevenue = (p) => {
  const combined = new Map();
  for (const r of p?.riderRevenue || []) {
    const id = r.userId || r._id;
    combined.set(String(id), { _id: id, userId: id, name: r.name || 'Unknown', email: r.email || '', riderEarnings: r.totalEarnings || 0, passengerSpending: 0, riderRides: r.completedTrips || 0, passengerRides: 0 });
  }
  for (const pa of p?.passengerSpending || []) {
    const id = pa.userId || pa._id;
    const ex = combined.get(String(id)) || { _id: id, userId: id, name: pa.name || 'Unknown', email: pa.email || '', riderEarnings: 0, passengerSpending: 0, riderRides: 0, passengerRides: 0 };
    combined.set(String(id), { ...ex, name: ex.name || pa.name || 'Unknown', email: ex.email || pa.email || '', passengerSpending: pa.totalSpent || 0, passengerRides: pa.bookingCount || 0 });
  }
  return { users: Array.from(combined.values()).map(u => ({ ...u, totalRevenue: (u.riderEarnings || 0) + (u.passengerSpending || 0) })).sort((a, b) => b.totalRevenue - a.totalRevenue) };
};

const normalizePeriodComparison = (p) => {
  const c = p?.comparison || p?.data?.comparison || {};
  return {
    current: { rides: c.rides?.current || 0, bookings: c.bookings?.current || 0, users: c.newUsers?.current || 0, revenue: c.revenue?.current || 0 },
    previous: { rides: c.rides?.previous || 0, bookings: c.bookings?.previous || 0, users: c.newUsers?.previous || 0, revenue: c.revenue?.previous || 0 },
    changes: { rides: c.rides?.change ?? 0, bookings: c.bookings?.change ?? 0, users: c.newUsers?.change ?? 0, revenue: c.revenue?.change ?? 0 },
  };
};

// ─── Helpers ─────────────────────────────────────────────────
const fmt = (v) => `₹${(v || 0).toLocaleString('en-IN')}`;
const fmtDate = (d) => { if (!d) return ''; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }); };

// ─── Chart Card Wrapper ──────────────────────────────────────
const ChartCard = ({ title, children, actions, className: cls }) => (
  <div className={cn('bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5', cls)}>
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
      {actions}
    </div>
    {children}
  </div>
);

const EmptyState = ({ text }) => (
  <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
    <BarChart3 size={28} className="mb-2 text-zinc-300 dark:text-zinc-600" />
    <p className="text-sm">{text}</p>
  </div>
);

const ChangeIndicator = ({ change }) => {
  if (change === null || change === undefined) return null;
  const pos = change >= 0;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', pos ? 'text-emerald-600' : 'text-red-500')}>
      {pos ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
};

// Custom tooltip for all charts
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-3 text-sm">
      <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{fmtDate(label) || label}</p>
      {payload.map((e, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: e.color }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: e.color }} />
          {e.name}: {/revenue|volume|earning|spend|price/i.test(e.name) ? fmt(e.value) : e.value}
        </p>
      ))}
    </div>
  );
};

// ─── Routes Tab (DeckGL ArcLayer) ────────────────────────────
const RoutesTab = ({ routeAnalytics, loading }) => {
  const [viewState, setViewState] = useState(INDIA_VIEW);
  const [hoveredRoute, setHoveredRoute] = useState(null);

  const routes = useMemo(
    () => (routeAnalytics?.routes || []).filter(r => r.fromCoords?.length === 2 && r.toCoords?.length === 2),
    [routeAnalytics]
  );
  const maxRides = useMemo(() => Math.max(1, ...routes.map(r => r.totalRides || 1)), [routes]);

  const layers = useMemo(() => [
    new ArcLayer({
      id: 'route-arcs',
      data: routes,
      getSourcePosition: d => d.fromCoords,
      getTargetPosition: d => d.toCoords,
      getSourceColor: d => {
        const t = Math.min(1, (d.completionRate || 0) / 100);
        return [14 + t * 200, 173, 105, 200];
      },
      getTargetColor: d => {
        const t = Math.min(1, (d.completionRate || 0) / 100);
        return [99, 102, 241, 160 + t * 95];
      },
      getWidth: d => 1 + (d.totalRides / maxRides) * 8,
      getHeight: 0.4,
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 100],
      onHover: info => setHoveredRoute(info.object || null),
    }),
    new ScatterplotLayer({
      id: 'source-dots',
      data: routes,
      getPosition: d => d.fromCoords,
      getFillColor: [14, 173, 105, 220],
      getLineColor: [255, 255, 255, 180],
      getRadius: d => 4000 + (d.totalRides / maxRides) * 20000,
      lineWidthMinPixels: 1,
      stroked: true,
      pickable: false,
    }),
    new ScatterplotLayer({
      id: 'dest-dots',
      data: routes,
      getPosition: d => d.toCoords,
      getFillColor: [99, 102, 241, 220],
      getLineColor: [255, 255, 255, 180],
      getRadius: d => 4000 + (d.totalRides / maxRides) * 20000,
      lineWidthMinPixels: 1,
      stroked: true,
      pickable: false,
    }),
  ], [routes, maxRides]);

  const totalRides = routes.reduce((s, r) => s + (r.totalRides || 0), 0);
  const totalEarnings = routes.reduce((s, r) => s + (r.totalEarnings || 0), 0);
  const avgCompletion = routes.length ? routes.reduce((s, r) => s + (r.completionRate || 0), 0) / routes.length : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AdminStatCard title="Unique Routes" value={routes.length} icon={GitCompare} loading={loading} />
        <AdminStatCard title="Total Route Rides" value={totalRides.toLocaleString()} icon={Route} loading={loading} />
        <AdminStatCard title="Route Earnings" value={fmt(totalEarnings)} icon={TrendingUp} loading={loading} />
        <AdminStatCard title="Avg Completion" value={`${avgCompletion.toFixed(0)}%`} icon={Activity} loading={loading} />
      </div>

      {routes.length > 0 ? (
        <>
          <ChartCard title="Route Network Map" className="!p-0 overflow-hidden">
            <div className="relative h-[500px] rounded-xl overflow-hidden">
              <DeckGL viewState={viewState} onViewStateChange={({ viewState: vs }) => setViewState(vs)} layers={layers} controller={true}>
                <MapGL mapStyle={MAP_STYLE} />
              </DeckGL>

              {hoveredRoute && (
                <div className="absolute top-4 right-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 p-4 min-w-[220px] pointer-events-none z-10">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-2">
                    {hoveredRoute.from} → {hoveredRoute.to}
                  </p>
                  <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <p>Rides: <span className="font-medium text-zinc-900 dark:text-zinc-100">{hoveredRoute.totalRides}</span></p>
                    <p>Completed: <span className="font-medium text-emerald-600">{hoveredRoute.completedRides}</span></p>
                    <p>Completion: <span className={cn('font-medium', (hoveredRoute.completionRate || 0) >= 70 ? 'text-emerald-600' : 'text-amber-600')}>{(hoveredRoute.completionRate || 0).toFixed(0)}%</span></p>
                    <p>Avg Price: <span className="font-medium text-zinc-900 dark:text-zinc-100">{fmt(hoveredRoute.avgPrice)}</span></p>
                    <p>Distance: <span className="font-medium">{(hoveredRoute.avgDistance || 0).toFixed(1)} km</span></p>
                    <p>Earnings: <span className="font-bold text-emerald-600">{fmt(hoveredRoute.totalEarnings)}</span></p>
                  </div>
                </div>
              )}

              <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg px-4 py-3 text-xs space-y-1.5 border border-zinc-200 dark:border-zinc-700 z-10">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-zinc-600 dark:text-zinc-400">Origins</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500" /><span className="text-zinc-600 dark:text-zinc-400">Destinations</span></div>
                <p className="text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-200 dark:border-zinc-700">Arc width = ride volume</p>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Route Performance">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                    <th className="pb-3 font-medium">#</th>
                    <th className="pb-3 font-medium">Origin</th>
                    <th className="pb-3 font-medium">Destination</th>
                    <th className="pb-3 font-medium text-right">Rides</th>
                    <th className="pb-3 font-medium text-right">Completed</th>
                    <th className="pb-3 font-medium text-right">Rate</th>
                    <th className="pb-3 font-medium text-right">Avg Price</th>
                    <th className="pb-3 font-medium text-right">Avg Dist</th>
                    <th className="pb-3 font-medium text-right">Earnings</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(routeAnalytics?.routes || []).map((r, i) => (
                    <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                      <td className="py-3 text-zinc-400">{i + 1}</td>
                      <td className="py-3 text-zinc-800 dark:text-zinc-200 max-w-[140px] truncate font-medium">{r.from || 'Unknown'}</td>
                      <td className="py-3 text-zinc-800 dark:text-zinc-200 max-w-[140px] truncate">{r.to || 'Unknown'}</td>
                      <td className="py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">{r.totalRides}</td>
                      <td className="py-3 text-right text-emerald-600">{r.completedRides}</td>
                      <td className="py-3 text-right">
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold',
                          (r.completionRate || 0) >= 80 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                          (r.completionRate || 0) >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                          'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400')}>
                          {(r.completionRate || 0).toFixed(0)}%
                        </span>
                      </td>
                      <td className="py-3 text-right text-zinc-900 dark:text-zinc-100">{fmt(r.avgPrice)}</td>
                      <td className="py-3 text-right text-zinc-500">{(r.avgDistance || 0).toFixed(1)} km</td>
                      <td className="py-3 text-right font-medium text-emerald-600">{fmt(r.totalEarnings)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      ) : (
        <ChartCard title="Route Analytics"><EmptyState text="No route data for this period" /></ChartCard>
      )}
    </div>
  );
};

// ─── Areas Tab (DeckGL ScatterplotLayer) ─────────────────────
const AreasTab = ({ areaAnalytics, loading }) => {
  const [viewState, setViewState] = useState(INDIA_VIEW);
  const [hoveredCity, setHoveredCity] = useState(null);

  const originCities = useMemo(
    () => (areaAnalytics?.originCities || []).filter(c => c.lon && c.lat),
    [areaAnalytics]
  );
  const destCities = useMemo(
    () => (areaAnalytics?.destinationCities || []).filter(c => c.lon && c.lat),
    [areaAnalytics]
  );
  const maxOriginRides = useMemo(() => Math.max(1, ...originCities.map(c => c.count || 1)), [originCities]);
  const maxDestRides = useMemo(() => Math.max(1, ...destCities.map(c => c.count || 1)), [destCities]);

  const layers = useMemo(() => [
    new ScatterplotLayer({
      id: 'origin-cities',
      data: originCities,
      getPosition: d => [d.lon, d.lat],
      getFillColor: [14, 173, 105, 180],
      getLineColor: [14, 173, 105, 255],
      getRadius: d => 8000 + ((d.count || 0) / maxOriginRides) * 40000,
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [14, 173, 105, 100],
      onHover: info => setHoveredCity(info.object ? { ...info.object, type: 'origin' } : null),
    }),
    new ScatterplotLayer({
      id: 'dest-cities',
      data: destCities,
      getPosition: d => [d.lon, d.lat],
      getFillColor: [99, 102, 241, 180],
      getLineColor: [99, 102, 241, 255],
      getRadius: d => 8000 + ((d.count || 0) / maxDestRides) * 40000,
      lineWidthMinPixels: 2,
      stroked: true,
      pickable: true,
      autoHighlight: true,
      highlightColor: [99, 102, 241, 100],
      onHover: info => setHoveredCity(info.object ? { ...info.object, type: 'dest' } : null),
    }),
  ], [originCities, destCities, maxOriginRides, maxDestRides]);

  const totalOriginRides = originCities.reduce((s, c) => s + (c.count || 0), 0);
  const totalDestRides = destCities.reduce((s, c) => s + (c.count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <AdminStatCard title="Origin Cities" value={originCities.length} icon={Navigation} loading={loading} />
        <AdminStatCard title="Destination Cities" value={destCities.length} icon={Crosshair} loading={loading} />
        <AdminStatCard title="Total Departures" value={totalOriginRides.toLocaleString()} icon={ArrowUpRight} loading={loading} />
        <AdminStatCard title="Total Arrivals" value={totalDestRides.toLocaleString()} icon={ArrowDownRight} loading={loading} />
      </div>

      {(originCities.length > 0 || destCities.length > 0) ? (
        <>
          <ChartCard title="City Coverage Map" className="!p-0 overflow-hidden">
            <div className="relative h-[500px] rounded-xl overflow-hidden">
              <DeckGL viewState={viewState} onViewStateChange={({ viewState: vs }) => setViewState(vs)} layers={layers} controller={true}>
                <MapGL mapStyle={MAP_STYLE} />
              </DeckGL>

              {hoveredCity && (
                <div className="absolute top-4 right-4 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 p-4 min-w-[200px] pointer-events-none z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('w-2.5 h-2.5 rounded-full', hoveredCity.type === 'origin' ? 'bg-emerald-500' : 'bg-indigo-500')} />
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{hoveredCity._id}</p>
                  </div>
                  <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    <p>{hoveredCity.type === 'origin' ? 'Departures' : 'Arrivals'}: <span className="font-medium text-zinc-900 dark:text-zinc-100">{hoveredCity.count}</span></p>
                    {hoveredCity.avgPrice > 0 && <p>Avg Price: <span className="font-medium">{fmt(hoveredCity.avgPrice)}</span></p>}
                    {hoveredCity.totalEarnings > 0 && <p>Earnings: <span className="font-bold text-emerald-600">{fmt(hoveredCity.totalEarnings)}</span></p>}
                  </div>
                </div>
              )}

              <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm rounded-lg px-4 py-3 text-xs space-y-1.5 border border-zinc-200 dark:border-zinc-700 z-10">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500" /><span className="text-zinc-600 dark:text-zinc-400">Origin cities (departures)</span></div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-indigo-500" /><span className="text-zinc-600 dark:text-zinc-400">Destination cities (arrivals)</span></div>
                <p className="text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-200 dark:border-zinc-700">Bubble size = ride volume</p>
              </div>
            </div>
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartCard title="Top Origin Cities">
              <div className="space-y-3">
                {(areaAnalytics?.originCities || []).slice(0, 10).map((c, i) => {
                  const pct = maxOriginRides > 0 ? ((c.count || 0) / maxOriginRides) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 font-mono text-xs w-5">{i + 1}</span>
                          <span className="text-zinc-800 dark:text-zinc-200 font-medium">{c._id}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-600 font-semibold">{c.count} rides</span>
                          {c.totalEarnings > 0 && <span className="text-zinc-500 text-xs">{fmt(c.totalEarnings)}</span>}
                        </div>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!(areaAnalytics?.originCities || []).length && <EmptyState text="No origin city data" />}
              </div>
            </ChartCard>

            <ChartCard title="Top Destination Cities">
              <div className="space-y-3">
                {(areaAnalytics?.destinationCities || []).slice(0, 10).map((c, i) => {
                  const pct = maxDestRides > 0 ? ((c.count || 0) / maxDestRides) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-400 font-mono text-xs w-5">{i + 1}</span>
                          <span className="text-zinc-800 dark:text-zinc-200 font-medium">{c._id}</span>
                        </div>
                        <span className="text-indigo-600 font-semibold">{c.count} rides</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-indigo-500 transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                {!(areaAnalytics?.destinationCities || []).length && <EmptyState text="No destination city data" />}
              </div>
            </ChartCard>
          </div>

          {(areaAnalytics?.userGrowth || []).length > 0 && (
            <ChartCard title="User Growth by City">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={areaAnalytics.userGrowth.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="_id" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="New Users" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}
        </>
      ) : (
        <ChartCard title="Area Analytics"><EmptyState text="No area data for this period" /></ChartCard>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────
const AdminAnalytics = () => {
  const [activeTab, setActiveTab] = useState('revenue');
  const [period, setPeriod] = useState('month');
  const [revenueData, setRevenueData] = useState(null);
  const [activityData, setActivityData] = useState(null);
  const [rideAnalytics, setRideAnalytics] = useState(null);
  const [routeAnalytics, setRouteAnalytics] = useState(null);
  const [areaAnalytics, setAreaAnalytics] = useState(null);
  const [userRevenue, setUserRevenue] = useState(null);
  const [periodComparison, setPeriodComparison] = useState(null);
  const [advancedData, setAdvancedData] = useState(null);
  const [funnelData, setFunnelData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const getDateRange = useCallback(() => {
    const end = new Date();
    const start = new Date();
    if (period === 'week') start.setDate(end.getDate() - 7);
    else if (period === 'month') start.setDate(end.getDate() - 30);
    else start.setFullYear(end.getFullYear() - 1);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [period]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError('');
        const { startDate, endDate } = getDateRange();
        const ap = mapRollingPeriod(period);
        const ad = period === 'week' ? 7 : period === 'month' ? 30 : 365;

        const [revRes, actRes, rideRes, routeRes, areaRes, userRevRes, compRes, demandRes, ltvRes, cancelRes, funnelRes] = await Promise.all([
          adminService.getRevenueReport(startDate, endDate).catch(() => null),
          adminService.getUserActivityReport(startDate, endDate).catch(() => null),
          adminService.getRideAnalytics(period).catch(() => null),
          adminService.getRouteAnalytics({ period: ap, limit: 20 }).catch(() => null),
          adminService.getAreaAnalytics({ period: ap }).catch(() => null),
          adminService.getUserRevenue({ period: ap, limit: 20, sortBy: 'totalRevenue' }).catch(() => null),
          adminService.getPeriodComparison({ period: ap }).catch(() => null),
          adminService.getDemandSupplyAnalytics({ days: ad }).catch(() => null),
          adminService.getUserLTVAnalytics().catch(() => null),
          adminService.getCancellationAnalytics({ days: ad }).catch(() => null),
          adminService.getConversionFunnel({ days: ad }).catch(() => null),
        ]);

        if (revRes?.success) setRevenueData(revRes);
        if (actRes?.success) setActivityData(actRes);
        if (rideRes?.success) setRideAnalytics(rideRes);
        if (routeRes) setRouteAnalytics(routeRes);
        if (areaRes) setAreaAnalytics(normalizeAreaAnalytics(areaRes));
        if (userRevRes) setUserRevenue(normalizeUserRevenue(userRevRes));
        if (compRes) setPeriodComparison(normalizePeriodComparison(compRes));
        if (funnelRes?.success) setFunnelData(funnelRes.data);
        setAdvancedData({
          demandSupply: demandRes?.success ? demandRes.analytics : null,
          ltvRetention: ltvRes?.success ? ltvRes.analytics : null,
          cancellations: cancelRes?.success ? cancelRes.analytics : null,
        });
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period, getDateRange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminPageHeader
        title="Platform Analytics"
        subtitle="Comprehensive performance, revenue & operations insights"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
              {PERIODS.map(opt => (
                <button key={opt.value} onClick={() => setPeriod(opt.value)}
                  className={cn('px-3 py-1 text-xs font-medium rounded-md transition',
                    period === opt.value ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}>
                  {opt.label}
                </button>
              ))}
            </div>
            <ExportButton type="csv" params={{ section: 'analytics', period }} />
          </div>
        }
      />

      {/* Tab Bar */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition whitespace-nowrap',
              activeTab === tab.key ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}>
            <tab.Icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-lg border border-red-200 dark:border-red-800">{error}</div>}

      <AIInsightCard context="analytics" metrics={{
        totalRides: rideAnalytics?.totalRides || 0,
        totalRevenue: revenueData?.totalRevenue || 0,
        totalVolume: revenueData?.totalVolume || 0,
        topRoute: (routeAnalytics?.routes || [])[0]?.route || 'N/A',
        routeCount: (routeAnalytics?.routes || []).length,
        areaCount: (areaAnalytics?.areas || []).length,
        period,
        peakHour: (activityData?.hourly || []).reduce((best, h) => h.value > (best?.value || 0) ? h : best, null)?.name || 'N/A',
      }} title="Analytics Intelligence" />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-zinc-400" />
        </div>
      ) : (
        <>
          {/* ═══ Revenue Tab ═══ */}
          {activeTab === 'revenue' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AdminStatCard title="Platform Revenue" value={fmt(revenueData?.totalRevenue)} icon={TrendingUp} loading={loading} />
                <AdminStatCard title="Transaction Volume" value={fmt(revenueData?.totalVolume)} icon={BarChart3} loading={loading} />
                <AdminStatCard title="Total Transactions" value={(revenueData?.data || []).reduce((s, d) => s + (d.count || 0), 0).toLocaleString()} icon={Activity} loading={loading} />
              </div>

              <ChartCard title="Revenue Over Time">
                {(revenueData?.data || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <AreaChart data={revenueData.data}>
                      <defs>
                        <linearGradient id="anRevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ead69" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#0ead69" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="anVolGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                      <XAxis dataKey="_id" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#0ead69" fill="url(#anRevGrad)" strokeWidth={2} />
                      <Area type="monotone" dataKey="volume" name="Volume" stroke="#6366f1" fill="url(#anVolGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <EmptyState text="No revenue data for this period" />}
              </ChartCard>

              <ChartCard title="Daily Transactions">
                {(revenueData?.data || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={revenueData.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                      <XAxis dataKey="_id" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="Transactions" fill="#0ead69" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState text="No transaction data" />}
              </ChartCard>
            </div>
          )}

          {/* ═══ Activity Tab ═══ */}
          {activeTab === 'activity' && (
            <div className="space-y-6">
              <ChartCard title="User Registrations">
                {(activityData?.userActivity || []).length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={activityData.userActivity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                      <XAxis dataKey="_id" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="count" name="New Users" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <EmptyState text="No user registration data" />}
              </ChartCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Rides Posted">
                  {(activityData?.rideActivity || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={activityData.rideActivity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                        <XAxis dataKey="_id" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="count" name="Rides" stroke="#0ead69" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No ride data" />}
                </ChartCard>

                <ChartCard title="Bookings Made">
                  {(activityData?.bookingActivity || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={activityData.bookingActivity}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                        <XAxis dataKey="_id" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="count" name="Bookings" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No booking data" />}
                </ChartCard>
              </div>
            </div>
          )}

          {/* ═══ Rides Tab ═══ */}
          {activeTab === 'rides' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <AdminStatCard title="Total Rides" value={rideAnalytics?.totalRides ?? 0} icon={Route} loading={loading} />
                <AdminStatCard title="Avg Occupancy" value={`${(rideAnalytics?.avgOccupancy ?? 0).toFixed(1)} seats`} icon={Users} loading={loading} />
                <AdminStatCard title="Avg Distance" value={`${(rideAnalytics?.avgDistance ?? 0).toFixed(1)} km`} icon={MapPin} loading={loading} />
                <AdminStatCard title="Completion Rate" value={`${(rideAnalytics?.completionRate ?? 0).toFixed(0)}%`} icon={Activity} loading={loading} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Ride Status Distribution">
                  {(rideAnalytics?.statusDistribution || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={rideAnalytics.statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="count" nameKey="_id"
                          label={({ _id, count }) => `${_id}: ${count}`}>
                          {rideAnalytics.statusDistribution.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No ride status data" />}
                </ChartCard>

                <ChartCard title="Daily Ride Trends">
                  {(rideAnalytics?.dailyRides || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <AreaChart data={rideAnalytics.dailyRides}>
                        <defs>
                          <linearGradient id="anRideGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                        <XAxis dataKey="_id" tickFormatter={fmtDate} tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Area type="monotone" dataKey="count" name="Rides" stroke="#8b5cf6" fill="url(#anRideGrad)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No daily ride data" />}
                </ChartCard>
              </div>

              {(rideAnalytics?.popularRoutes || []).length > 0 && (
                <ChartCard title="Popular Routes">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                          <th className="pb-3 font-medium">#</th>
                          <th className="pb-3 font-medium">Origin</th>
                          <th className="pb-3 font-medium">Destination</th>
                          <th className="pb-3 font-medium text-right">Rides</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {rideAnalytics.popularRoutes.slice(0, 10).map((r, i) => (
                          <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                            <td className="py-3 text-zinc-400">{i + 1}</td>
                            <td className="py-3 text-zinc-800 dark:text-zinc-200">{r._id?.start || 'Unknown'}</td>
                            <td className="py-3 text-zinc-800 dark:text-zinc-200">{r._id?.destination || 'Unknown'}</td>
                            <td className="py-3 text-right font-medium text-zinc-900 dark:text-zinc-100">{r.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ChartCard>
              )}
            </div>
          )}

          {/* ═══ Routes Tab ═══ */}
          {activeTab === 'routes' && (
            <RoutesTab routeAnalytics={routeAnalytics} loading={loading} />
          )}

          {/* ═══ Areas Tab ═══ */}
          {activeTab === 'areas' && (
            <AreasTab areaAnalytics={areaAnalytics} loading={loading} />
          )}

          {/* ═══ User Revenue Tab ═══ */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <AdminStatCard title="Top Earner" value={userRevenue?.users?.[0]?.name || 'N/A'} subtitle={fmt(userRevenue?.users?.[0]?.totalRevenue)} icon={TrendingUp} loading={loading} />
                <AdminStatCard title="Users Tracked" value={userRevenue?.users?.length ?? 0} icon={Users} loading={loading} />
                <AdminStatCard title="Combined Revenue" value={fmt((userRevenue?.users || []).reduce((s, u) => s + (u.totalRevenue || 0), 0))} icon={BarChart3} loading={loading} />
              </div>

              {(userRevenue?.users || []).length > 0 && (
                <>
                  <ChartCard title="Top User Revenue">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={userRevenue.users.slice(0, 10).map(u => ({
                        name: (u.name || 'Unknown').substring(0, 15),
                        earnings: u.riderEarnings || 0,
                        spending: u.passengerSpending || 0,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v}`} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="earnings" name="Rider Earnings" fill="#0ead69" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="spending" name="Passenger Spending" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <ChartCard title="User Revenue Breakdown">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                            <th className="pb-3 font-medium">#</th>
                            <th className="pb-3 font-medium">User</th>
                            <th className="pb-3 font-medium">Email</th>
                            <th className="pb-3 font-medium text-right">As Rider</th>
                            <th className="pb-3 font-medium text-right">As Passenger</th>
                            <th className="pb-3 font-medium text-right">Rides</th>
                            <th className="pb-3 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {userRevenue.users.map((u, i) => (
                            <tr key={u._id || i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                              <td className="py-3 text-zinc-400">{i + 1}</td>
                              <td className="py-3 text-zinc-800 dark:text-zinc-200 font-medium">{u.name}</td>
                              <td className="py-3 text-zinc-500 text-xs">{u.email || '-'}</td>
                              <td className="py-3 text-right text-emerald-600">{fmt(u.riderEarnings)}</td>
                              <td className="py-3 text-right text-zinc-900 dark:text-zinc-100">{fmt(u.passengerSpending)}</td>
                              <td className="py-3 text-right">{(u.riderRides || 0) + (u.passengerRides || 0)}</td>
                              <td className="py-3 text-right font-bold text-zinc-800 dark:text-zinc-200">{fmt(u.totalRevenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </ChartCard>
                </>
              )}
              {!(userRevenue?.users || []).length && <ChartCard title="User Revenue"><EmptyState text="No user revenue data for this period" /></ChartCard>}
            </div>
          )}

          {/* ═══ Comparison Tab ═══ */}
          {activeTab === 'comparison' && (
            <div className="space-y-6">
              {periodComparison ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Rides', current: periodComparison.current?.rides ?? 0, previous: periodComparison.previous?.rides ?? 0, change: periodComparison.changes?.rides },
                      { label: 'Bookings', current: periodComparison.current?.bookings ?? 0, previous: periodComparison.previous?.bookings ?? 0, change: periodComparison.changes?.bookings },
                      { label: 'New Users', current: periodComparison.current?.users ?? 0, previous: periodComparison.previous?.users ?? 0, change: periodComparison.changes?.users },
                      { label: 'Revenue', current: periodComparison.current?.revenue ?? 0, previous: periodComparison.previous?.revenue ?? 0, change: periodComparison.changes?.revenue, isCurrency: true },
                    ].map((m, i) => (
                      <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{m.label}</p>
                          <ChangeIndicator change={m.change} />
                        </div>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                          {m.isCurrency ? fmt(m.current) : m.current.toLocaleString()}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-zinc-400">vs {m.isCurrency ? fmt(m.previous) : m.previous.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-md h-1.5 mt-3">
                          <div className="bg-emerald-500 h-1.5 rounded-md transition-all duration-500"
                            style={{ width: `${Math.min(100, m.previous > 0 ? (m.current / m.previous) * 50 : 50)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <ChartCard title="Period Comparison">
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={[
                        { metric: 'Rides', current: periodComparison.current?.rides ?? 0, previous: periodComparison.previous?.rides ?? 0 },
                        { metric: 'Bookings', current: periodComparison.current?.bookings ?? 0, previous: periodComparison.previous?.bookings ?? 0 },
                        { metric: 'Users', current: periodComparison.current?.users ?? 0, previous: periodComparison.previous?.users ?? 0 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                        <XAxis dataKey="metric" tick={{ fontSize: 12, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="current" name="Current Period" fill="#0ead69" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="previous" name="Previous Period" fill="#d4d4d8" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartCard>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="text-center p-6 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                      <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-1 font-medium">Current Period</p>
                      <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{fmt(periodComparison.current?.revenue)}</p>
                    </div>
                    <div className="text-center p-6 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1 font-medium">Previous Period</p>
                      <p className="text-3xl font-bold text-zinc-600 dark:text-zinc-300">{fmt(periodComparison.previous?.revenue)}</p>
                    </div>
                  </div>
                </>
              ) : <ChartCard title="Comparison"><EmptyState text="No comparison data available" /></ChartCard>}
            </div>
          )}

          {/* ═══ Advanced Tab ═══ */}
          {activeTab === 'advanced' && advancedData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard title="User Retention (30 Days)">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{advancedData.ltvRetention?.overview?.retentionRate30d || 0}%</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Active / Total Users</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-red-500">{advancedData.ltvRetention?.overview?.churnRate || 0}%</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Churn Rate (90d)</p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={advancedData.ltvRetention?.cohorts || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="signedUp" name="Signups" fill="#d4d4d8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="retained" name="Retained" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>

                <ChartCard title="Peak Hours (Ride Departures)">
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={(advancedData.demandSupply?.peakHours || []).sort((a, b) => a._id - b._id)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={h => `${h}:00`} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                      <Tooltip labelFormatter={h => `Hour: ${h}:00`} formatter={val => [val, 'Rides']} />
                      <Line type="monotone" dataKey="count" name="Rides" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ChartCard title="Cancellation Analytics">
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                      <p className="text-sm text-red-600 dark:text-red-400 font-medium">Booking Cancellations</p>
                      <p className="text-2xl font-bold text-red-700 dark:text-red-300">{advancedData.cancellations?.bookingCancellations || 0}</p>
                    </div>
                    <div className="flex-1 bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                      <p className="text-sm text-orange-600 dark:text-orange-400 font-medium">Driver Cancellations</p>
                      <p className="text-2xl font-bold text-orange-700 dark:text-orange-300">{advancedData.cancellations?.rideCancellations || 0}</p>
                    </div>
                  </div>
                  {(advancedData.cancellations?.reasons || []).length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={advancedData.cancellations.reasons} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="count" nameKey="reason">
                          {advancedData.cancellations.reasons.map((_, i) => <Cell key={i} fill={['#ef4444', '#f97316', '#eab308', '#84cc16', '#06b6d4', '#8b5cf6'][i % 6]} />)}
                        </Pie>
                        <Tooltip formatter={val => [val, 'Cancellations']} />
                        <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="No cancellation data" />}
                </ChartCard>

                <ChartCard title="Demand vs Supply">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <p className="text-3xl font-bold text-emerald-600">{advancedData.demandSupply?.summary?.supplyDemandRatio || 0}</p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Supply / Demand Ratio</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">Seats Offered: <span className="text-emerald-600 font-medium">{advancedData.demandSupply?.summary?.totalSeatsOffered || 0}</span></p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">Seats Booked: <span className="text-zinc-900 dark:text-zinc-100 font-medium">{advancedData.demandSupply?.summary?.totalSeatsRequested || 0}</span></p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={advancedData.demandSupply?.demand || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                      <XAxis dataKey="_id" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={fmtDate} />
                      <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="bookingsRequested" name="Bookings" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="confirmed" name="Confirmed" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                      <Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartCard>
              </div>
            </div>
          )}

          {/* ═══ Funnel Tab ═══ */}
          {activeTab === 'funnel' && funnelData && (
            <ChartCard title="User Conversion Funnel" className="!p-8">
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-8">Visualizing user drop-off across the booking journey</p>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={funnelData.funnel || []} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="stage" type="category" width={150} tick={{ fontSize: 13, fill: '#71717a', fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.05)' }} formatter={v => [v, 'Users']} />
                  <Bar dataKey="count" name="Users" fill="#6366f1" radius={[0, 4, 4, 0]}>
                    {(funnelData.funnel || []).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {funnelData.cancellations > 0 && (
                <div className="mt-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg text-center max-w-md mx-auto">
                  <p className="text-red-800 dark:text-red-300 font-semibold mb-1">{funnelData.cancellations} Cancellations</p>
                  <p className="text-sm text-red-600 dark:text-red-400">Users who initiated booking but cancelled</p>
                </div>
              )}
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAnalytics;