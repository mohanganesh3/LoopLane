/**
 * AdminHealth — System Health & Platform Monitoring Dashboard
 * FIXED: Correct data-shape mapping to the actual getSystemHealth() API response:
 *   { health: { status, uptime, uptimeFormatted, database: { status, connected },
 *     memory: { heapUsed, heapTotal, rss, external },
 *     system: { platform, cpus, totalMem, freeMem, loadAvg },
 *     counters: { totalUsers, activeRides, pendingEmergencies, pendingReports },
 *     timestamp } }
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import adminService from '../../services/adminService';
import { AdminStatCard, AdminPageHeader, AIInsightCard } from '../../components/admin';
import {
  Clock, MemoryStick, Cpu, Plug, Server, Database, Users, AlertTriangle, FileWarning,
  RefreshCw, Loader2, Activity, HardDrive, Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-3 text-sm">
      <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{label}</p>
      {payload.map((e, i) => (
        <p key={i} style={{ color: e.color }} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: e.color }} />
          {e.name}: {e.value}{typeof e.value === 'number' && !e.name.includes('Count') ? (e.name.includes('Memory') ? '%' : '') : ''}
        </p>
      ))}
    </div>
  );
};

const AdminHealth = () => {
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const intervalRef = useRef(null);

  useEffect(() => {
    loadHealth();
    intervalRef.current = setInterval(loadHealth, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const loadHealth = async () => {
    try {
      const res = await adminService.getSystemHealth();
      // API returns { success, health: { ... } }
      const h = res?.health || res?.data?.health || res?.data || res || {};
      setHealth(h);

      // Compute derived values for history
      const memPercent = h.memory?.heapTotal > 0
        ? Math.round((h.memory.heapUsed / h.memory.heapTotal) * 100)
        : 0;
      const cpuLoad = h.system?.loadAvg?.[0] ?? 0;
      const activeRides = h.counters?.activeRides ?? 0;

      setHistory(prev => [...prev.slice(-19), {
        time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        memory: memPercent,
        cpu: Math.round(cpuLoad * 100) / 100,
        activeRides,
      }]);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // ─── Extract actual fields from health response ────────────
  const uptime = health?.uptime || 0;
  const uptimeDays = Math.floor(uptime / 86400);
  const uptimeHours = Math.floor((uptime % 86400) / 3600);
  const uptimeMins = Math.floor((uptime % 3600) / 60);

  const dbStatus = health?.database?.status || (health?.database?.connected ? 'connected' : 'unknown');
  const memHeapUsed = health?.memory?.heapUsed || 0;
  const memHeapTotal = health?.memory?.heapTotal || 1;
  const memRss = health?.memory?.rss || 0;
  const memExternal = health?.memory?.external || 0;
  const memPercent = Math.round((memHeapUsed / memHeapTotal) * 100);

  const platform = health?.system?.platform || 'unknown';
  const cpus = health?.system?.cpus || 0;
  const totalMem = health?.system?.totalMem || 0;
  const freeMem = health?.system?.freeMem || 0;
  const loadAvg = (health?.system?.loadAvg || [0, 0, 0]).map(v => Number(v) || 0);
  const cpuLoad1m = loadAvg[0] ?? 0;

  const counters = health?.counters || {};
  const overallStatus = health?.status || (dbStatus === 'connected' ? 'healthy' : 'degraded');

  // ─── Memory Breakdown Bars ─────────────────────────────────
  const memoryBars = useMemo(() => [
    { name: 'Heap Used', bytes: memHeapUsed, color: '#6366f1' },
    { name: 'Heap Total', bytes: memHeapTotal, color: '#a1a1aa' },
    { name: 'RSS', bytes: memRss, color: '#0ead69' },
    { name: 'External', bytes: memExternal, color: '#f4a261' },
  ], [memHeapUsed, memHeapTotal, memRss, memExternal]);

  const statusColor = (s) => {
    if (['healthy', 'connected', 'ok'].includes(s)) return 'text-emerald-600 dark:text-emerald-400';
    if (['degraded', 'warning'].includes(s)) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const statusBg = (s) => {
    if (['healthy', 'connected', 'ok'].includes(s)) return 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800';
    if (['degraded', 'warning'].includes(s)) return 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800';
    return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800';
  };

  const services = [
    { name: 'API Server', status: overallStatus, detail: `Uptime: ${uptimeDays}d ${uptimeHours}h ${uptimeMins}m`, Icon: Server },
    { name: 'MongoDB', status: dbStatus === 'connected' ? 'healthy' : dbStatus, detail: dbStatus === 'connected' ? 'Connected & healthy' : dbStatus, Icon: Database },
    { name: 'Platform', status: 'healthy', detail: `${platform} | ${cpus} CPUs`, Icon: Globe },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="System Health"
        subtitle="Real-time platform monitoring, service status, and performance metrics"
        actions={
          <div className="flex items-center gap-3">
            <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-md border text-sm font-medium', statusBg(overallStatus), statusColor(overallStatus))}>
              <span className={cn('w-2 h-2 rounded-full', overallStatus === 'healthy' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500')} />
              {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}
            </div>
            <button onClick={loadHealth} disabled={loading}
              className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-50">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
            </button>
          </div>
        }
      />

      <AIInsightCard context="health" metrics={{
        memoryUsagePercent: memPercent,
        heapUsed: formatBytes(memHeapUsed),
        heapTotal: formatBytes(memHeapTotal),
        cpuLoad: cpuLoad1m,
        cpuCores: cpus,
        uptimeHours: uptimeDays * 24 + uptimeHours,
        platform,
        totalMemory: formatBytes(totalMem),
        freeMemory: formatBytes(freeMem),
        dbStatus,
        overallStatus,
        activeRides: counters.activeRides || 0,
        totalUsers: counters.totalUsers || 0,
        loadAvg: loadAvg.map(l => l.toFixed(2)).join(', '),
      }} title="System Health Intelligence" />

      {/* Stat Cards  */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <AdminStatCard title="Uptime" value={uptimeDays > 0 ? `${uptimeDays}d ${uptimeHours}h` : `${uptimeHours}h ${uptimeMins}m`} icon={Clock} loading={loading} />
        <AdminStatCard title="Heap Memory" value={`${memPercent}%`} icon={MemoryStick} subtitle={`${formatBytes(memHeapUsed)} / ${formatBytes(memHeapTotal)}`} loading={loading} />
        <AdminStatCard title="CPU Load (1m)" value={cpuLoad1m.toFixed(2)} icon={Cpu} subtitle={`${cpus} cores`} loading={loading} />
        <AdminStatCard title="Active Rides" value={counters.activeRides || 0} icon={Activity} loading={loading} />
        <AdminStatCard title="Total Users" value={counters.totalUsers || 0} icon={Users} loading={loading} />
      </div>

      {/* Service Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {services.map(svc => (
          <div key={svc.name} className={cn('p-4 rounded-xl border flex items-center gap-3', statusBg(svc.status))}>
            <div className={cn('w-9 h-9 rounded-md bg-white/70 dark:bg-white/10 flex items-center justify-center', statusColor(svc.status))}>
              <svc.Icon size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{svc.name}</p>
                <span className={cn('text-xs font-medium capitalize', statusColor(svc.status))}>{svc.status}</span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{svc.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Platform Counters */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Platform Counters</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: counters.totalUsers || 0, Icon: Users, color: 'text-indigo-600' },
            { label: 'Active Rides', value: counters.activeRides || 0, Icon: Activity, color: 'text-emerald-600' },
            { label: 'Pending Emergencies', value: counters.pendingEmergencies || 0, Icon: AlertTriangle, color: counters.pendingEmergencies > 0 ? 'text-red-600' : 'text-zinc-400' },
            { label: 'Pending Reports', value: counters.pendingReports || 0, Icon: FileWarning, color: counters.pendingReports > 0 ? 'text-amber-600' : 'text-zinc-400' },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700">
              <c.Icon size={18} className={c.color} />
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{c.label}</p>
                <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{c.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Memory Trend */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Memory Usage Trend (Last 20 checks)</h3>
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="memory" stroke="#6366f1" strokeWidth={2} dot={false} name="Memory %" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-zinc-400">
              Collecting data points... (auto-refreshes every 30s)
            </div>
          )}
        </div>

        {/* CPU Load Trend */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">CPU Load Average Trend</h3>
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="cpu" stroke="#0ead69" strokeWidth={2} dot={false} name="Load Avg (1m)" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-sm text-zinc-400">
              Collecting data points...
            </div>
          )}
        </div>
      </div>

      {/* Memory Breakdown */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Memory Breakdown</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {memoryBars.map(m => (
            <div key={m.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600 dark:text-zinc-400">{m.name}</span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatBytes(m.bytes)}</span>
              </div>
              <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                <div className="h-2 rounded-full transition-all" style={{
                  width: `${memHeapTotal > 0 ? Math.min(100, (m.bytes / memHeapTotal) * 100) : 0}%`,
                  backgroundColor: m.color,
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Info */}
      {health && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">System Environment</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-zinc-500 text-xs">Platform</p>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">{platform}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">CPUs</p>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">{cpus} cores</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">System Memory</p>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">{formatBytes(totalMem)} total / {formatBytes(freeMem)} free</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs">Load Average</p>
              <p className="font-medium text-zinc-800 dark:text-zinc-200">{loadAvg.map(l => l.toFixed(2)).join(' / ')}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHealth;
