/**
 * AdminPricing — Dynamic Pricing Control Panel
 * BUG FIX: Maps to Settings model schema (commission, baseFare, pricePerKm, pricePerMinute)
 * Includes fare simulator, demand/supply chart, and surge config
 */
import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { cn } from '@/lib/utils';
import adminService from '../../services/adminService';
import { AdminStatCard, AIInsightCard, AdminPageHeader } from '../../components/admin';
import {
  Zap, ArrowUp, Car, IndianRupee, Loader2, Save, BarChart3,
  Calculator, CheckCircle, Settings, TrendingUp, AlertCircle,
} from 'lucide-react';

// ─── Schema Mapping ──────────────────────────────────────────
// ALL fields map to Settings model: pricing.commission, pricing.baseFare, pricing.pricePerKm,
// pricing.pricePerMinute, pricing.surgeMultiplierMax, pricing.surgeThreshold, pricing.minimumFare
const DEFAULTS = {
  commission: 10, baseFare: 20, pricePerKm: 5, pricePerMinute: 1,
  surgeMultiplierMax: 2.5, surgeThreshold: 0.7, minimumFare: 30,
};

const FARE_SLIDERS = [
  { key: 'baseFare', label: 'Base Fare (₹)', min: 5, max: 100, step: 1, unit: '₹', desc: 'Fixed fare component for every ride' },
  { key: 'pricePerKm', label: 'Price Per KM (₹)', min: 1, max: 30, step: 0.5, unit: '₹', desc: 'Distance-based fare component' },
  { key: 'pricePerMinute', label: 'Price Per Minute (₹)', min: 0.5, max: 10, step: 0.5, unit: '₹', desc: 'Time-based fare component' },
  { key: 'commission', label: 'Platform Commission', min: 0, max: 50, step: 1, unit: '%', desc: 'Percentage of fare retained by platform' },
  { key: 'surgeMultiplierMax', label: 'Max Surge Multiplier', min: 1, max: 5, step: 0.1, unit: 'x', desc: 'Maximum surge pricing factor applied during peak demand' },
  { key: 'surgeThreshold', label: 'Surge Trigger (D/S Ratio)', min: 0.3, max: 1.5, step: 0.1, unit: '', desc: 'Demand/supply ratio that activates surge pricing' },
  { key: 'minimumFare', label: 'Minimum Fare (₹)', min: 10, max: 200, step: 5, unit: '₹', desc: 'Lowest possible ride fare — enforced on all bookings' },
];

// ─── Tooltip ─────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-3 text-sm">
      <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{label}</p>
      {payload.map((e, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: e.color }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: e.color }} />
          {e.name}: {e.value}
        </p>
      ))}
    </div>
  );
};

// ═════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
const AdminPricing = () => {
  const [loading, setLoading] = useState(true);
  const [demandSupply, setDemandSupply] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState({ ...DEFAULTS });
  const [activeTab, setActiveTab] = useState('config');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [demandRes, settingsRes] = await Promise.all([
        adminService.getDemandSupplyAnalytics({}).catch(() => null),
        adminService.getSettings().catch(() => null),
      ]);
      if (demandRes?.data || demandRes) setDemandSupply(demandRes?.data || demandRes);
      const s = settingsRes?.data?.settings || settingsRes?.data || settingsRes?.settings || settingsRes;
      if (s?.pricing) {
        setConfig(prev => ({
          ...prev,
          commission: s.pricing.commission ?? prev.commission,
          baseFare: s.pricing.baseFare ?? prev.baseFare,
          pricePerKm: s.pricing.pricePerKm ?? prev.pricePerKm,
          pricePerMinute: s.pricing.pricePerMinute ?? prev.pricePerMinute,
          surgeMultiplierMax: s.pricing.surgeMultiplierMax ?? prev.surgeMultiplierMax,
          surgeThreshold: s.pricing.surgeThreshold ?? prev.surgeThreshold,
          minimumFare: s.pricing.minimumFare ?? prev.minimumFare,
        }));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      // Persist all 7 pricing fields to Settings model
      await adminService.updateSettings({
        pricing: {
          commission: config.commission,
          baseFare: config.baseFare,
          pricePerKm: config.pricePerKm,
          pricePerMinute: config.pricePerMinute,
          surgeMultiplierMax: config.surgeMultiplierMax,
          surgeThreshold: config.surgeThreshold,
          minimumFare: config.minimumFare,
        },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save pricing');
    } finally { setSaving(false); }
  };

  // ─── Demand/Supply Data ────────────────────────────────────
  // API returns: { success, analytics: { supply[], demand[], peakHours[], summary{} } }
  const analytics = demandSupply?.analytics || {};
  const supplyData = analytics.supply || [];
  const demandData = analytics.demand || [];
  const summary = analytics.summary || {};
  const peakHours = analytics.peakHours || [];

  // Merge supply + demand by date into single chart series
  const dsChartData = useMemo(() => {
    const dateMap = {};
    supplyData.forEach(s => {
      dateMap[s._id] = { ...dateMap[s._id], date: s._id, ridesPosted: s.ridesPosted || 0, seatsOffered: s.totalSeats || 0 };
    });
    demandData.forEach(d => {
      dateMap[d._id] = { ...dateMap[d._id], date: d._id, bookings: d.bookingsRequested || 0, seatsRequested: d.seatsRequested || 0, confirmed: d.confirmed || 0 };
    });
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date)).map(d => ({
      ...d, label: new Date(d.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    }));
  }, [supplyData, demandData]);

  const peakChartData = useMemo(() => {
    return [...peakHours].sort((a, b) => a._id - b._id).map(h => ({
      hour: `${String(h._id).padStart(2, '0')}:00`, rides: h.count || 0,
    }));
  }, [peakHours]);

  // ─── Fare Simulator ────────────────────────────────────────
  const fareSimulation = useMemo(() => {
    return [3, 5, 10, 15, 20, 30, 50].map(km => {
      const mins = Math.round(km * 2.5); // rough 24km/h avg
      const baseFare = config.baseFare + (km * config.pricePerKm) + (mins * config.pricePerMinute);
      const fare = Math.max(baseFare, config.minimumFare);
      const platformCut = fare * (config.commission / 100);
      const driverPayout = fare - platformCut;
      const surgeFare = fare * config.surgeMultiplierMax;
      return { km, mins, fare: Math.round(fare), platformCut: Math.round(platformCut), driverPayout: Math.round(driverPayout), surgeFare: Math.round(surgeFare) };
    });
  }, [config]);

  const aiMetrics = {
    supplyDemandRatio: summary.supplyDemandRatio || 0,
    totalBookings: summary.totalBookings || 0, totalRidesPosted: summary.totalRidesPosted || 0,
    baseFare: config.baseFare, pricePerKm: config.pricePerKm,
    commission: config.commission, surgeMax: config.surgeMultiplierMax,
  };

  const tabs = [
    { key: 'config', label: 'Configuration', Icon: Settings },
    { key: 'simulator', label: 'Fare Simulator', Icon: Calculator },
    { key: 'demand', label: 'Demand / Supply', Icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dynamic Pricing"
        subtitle="Fare structure, surge configuration, and demand/supply balancing"
        actions={
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-sm text-emerald-600 font-medium">
                <CheckCircle size={14} /> Saved
              </span>
            )}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        }
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded-lg border border-red-200 dark:border-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <AIInsightCard context="pricing" metrics={aiMetrics} title="Pricing Intelligence" />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard title="S/D Ratio" value={summary.supplyDemandRatio || '—'} icon={Zap} loading={loading} />
        <AdminStatCard title="Bookings" value={summary.totalBookings || 0} icon={ArrowUp} subtitle="last 30 days" loading={loading} />
        <AdminStatCard title="Rides Posted" value={summary.totalRidesPosted || 0} icon={Car} subtitle="last 30 days" loading={loading} />
        <AdminStatCard title="Base Fare" value={`₹${config.baseFare}`} icon={IndianRupee} loading={loading} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition',
              activeTab === t.key ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}>
            <t.Icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ═══ Configuration Tab ═══ */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Fare Structure</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">All fields are saved to server and enforced platform-wide</p>
            <div className="space-y-5">
              {FARE_SLIDERS.map(({ key, label, min, max, step, unit, desc }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm text-zinc-600 dark:text-zinc-400">{label}</label>
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {unit === '%' ? `${config[key]}%` : unit === 'x' ? `${config[key]}x` : unit === '₹' ? `₹${config[key]}` : config[key]}
                    </span>
                  </div>
                  <input
                    type="range" min={min} max={max} step={step} value={config[key]}
                    onChange={e => setConfig(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-zinc-900 dark:accent-zinc-100"
                  />
                  <p className="text-[10px] text-zinc-400 mt-0.5">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Fare Preview */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Quick Fare Preview</h3>
              <div className="grid grid-cols-2 gap-4">
                {[5, 10, 20, 50].map(km => {
                  const mins = Math.round(km * 2.5);
                  const base = config.baseFare + (km * config.pricePerKm) + (mins * config.pricePerMinute);
                  const fare = Math.max(base, config.minimumFare);
                  const surge = fare * config.surgeMultiplierMax;
                  const platform = fare * (config.commission / 100);
                  return (
                    <div key={km} className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700 text-center">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">{km} km · ~{mins} min</p>
                      <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">₹{Math.round(fare)}</p>
                      <div className="flex justify-center gap-3 mt-2 text-[10px]">
                        <span className="text-orange-600 dark:text-orange-400">Surge: ₹{Math.round(surge)}</span>
                        <span className="text-emerald-600">Fee: ₹{Math.round(platform)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800 p-5">
              <h4 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-3">Revenue Model Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Base fare per ride</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">₹{config.baseFare}</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Distance component</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">₹{config.pricePerKm}/km</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Time component</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">₹{config.pricePerMinute}/min</span>
                </div>
                <div className="border-t border-emerald-200 dark:border-emerald-700 pt-2 flex justify-between">
                  <span className="font-medium text-emerald-700 dark:text-emerald-400">Platform take rate</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">{config.commission}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Simulator Tab ═══ */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Fare Curve Visualization</h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={fareSimulation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="km" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `${v} km`} />
                <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${v}`} />
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="fare" name="Normal Fare" stroke="#0ead69" strokeWidth={3} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="surgeFare" name="Max Surge Fare" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                <Line type="monotone" dataKey="driverPayout" name="Driver Payout" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="platformCut" name="Platform Fee" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Fare Breakdown Table</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-zinc-500 dark:text-zinc-400">
                    <th className="pb-3 font-medium">Distance</th>
                    <th className="pb-3 font-medium">Est. Time</th>
                    <th className="pb-3 font-medium text-right">Fare</th>
                    <th className="pb-3 font-medium text-right">Platform</th>
                    <th className="pb-3 font-medium text-right">Driver</th>
                    <th className="pb-3 font-medium text-right">Surge Fare</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {fareSimulation.map(r => (
                    <tr key={r.km} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                      <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">{r.km} km</td>
                      <td className="py-3 text-zinc-500 dark:text-zinc-400">~{r.mins} min</td>
                      <td className="py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">₹{r.fare}</td>
                      <td className="py-3 text-right text-emerald-600">₹{r.platformCut}</td>
                      <td className="py-3 text-right text-zinc-600 dark:text-zinc-400">₹{r.driverPayout}</td>
                      <td className="py-3 text-right text-orange-600 dark:text-orange-400">₹{r.surgeFare}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Demand/Supply Tab ═══ */}
      {activeTab === 'demand' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Seats Offered', value: summary.totalSeatsOffered || 0 },
              { label: 'Seats Requested', value: summary.totalSeatsRequested || 0 },
              { label: 'S/D Ratio', value: summary.supplyDemandRatio || '—' },
              { label: 'Avg Price/Seat', value: `₹${summary.avgPricePerSeat || 0}` },
            ].map(c => (
              <div key={c.label} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{c.label}</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{c.value}</p>
              </div>
            ))}
          </div>

          {/* Daily Supply vs Demand */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Daily Supply vs Demand</h3>
            {dsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={dsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="ridesPosted" name="Rides Posted (Supply)" stroke="#0ead69" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="bookings" name="Bookings (Demand)" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="confirmed" name="Confirmed" stroke="#6366f1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[350px] flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm text-zinc-500">Demand/supply data will appear when rides are active</p>
                </div>
              </div>
            )}
          </div>

          {/* Peak Hours */}
          {peakChartData.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Ride Activity by Hour of Day</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={peakChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="rides" fill="#6366f1" name="Rides" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPricing;
