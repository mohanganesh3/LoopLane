/**
 * AdminFinancials — Enterprise Financial Command Center
 * Revenue waterfalls, payment analytics, settlement management, AI insights
 * Uses configurable commission from Settings (not hardcoded 15%)
 */
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, Percent, Wallet, Clock, CheckCircle,
  BarChart3, Banknote, Receipt, Loader2, Zap,
  ArrowUpRight, ArrowDownRight, CreditCard, FileText,
  RefreshCw, Download, IndianRupee, PiggyBank, Activity,
  ChevronRight, CircleDollarSign
} from 'lucide-react';
import adminService from '../../services/adminService';
import { AdminStatCard, AdminDataTable, AIInsightCard, AdminPageHeader, StatusBadge, ExportButton } from '../../components/admin';

// ─── Constants ───────────────────────────────────────────────
const PAYMENT_COLORS = { UPI: '#6366f1', CARD: '#3b82f6', CASH: '#18181b', WALLET: '#10b981', NET_BANKING: '#f59e0b' };

const DATE_RANGES = [
  { key: '7d', label: '7 Days', days: 7 },
  { key: '30d', label: '30 Days', days: 30 },
  { key: '90d', label: '90 Days', days: 90 },
];

const TABS = [
  { id: 'overview', label: 'Revenue Overview', Icon: BarChart3 },
  { id: 'settlements', label: 'Settlements', Icon: Banknote },
  { id: 'transactions', label: 'Transactions', Icon: Receipt },
  { id: 'invoices', label: 'Invoices', Icon: FileText },
];

const METHOD_STYLES = {
  UPI: 'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-800',
  CARD: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
  CASH: 'bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
  WALLET: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  NET_BANKING: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
};

// ─── Revenue Waterfall Card ─────────────────────────────────
const WaterfallCard = ({ label, value, percentage, icon: Icon, color, isLast }) => (
  <div className="flex items-center gap-3">
    <div className={cn('flex-1 p-4 rounded-xl border transition-all hover:shadow-md', color)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/60 dark:bg-black/20 flex items-center justify-center">
            <Icon size={16} />
          </div>
          <span className="text-xs font-medium opacity-80">{label}</span>
        </div>
        {percentage && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/40 dark:bg-black/20">
            {percentage}
          </span>
        )}
      </div>
      <p className="text-xl font-bold">₹{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p>
    </div>
    {!isLast && <ChevronRight size={16} className="text-zinc-300 dark:text-zinc-600 flex-shrink-0" />}
  </div>
);

// ─── Metric Tile ────────────────────────────────────────────
const MetricTile = ({ title, value, change, icon: Icon, loading: isLoading }) => {
  const isPositive = (change || 0) >= 0;
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
          <Icon size={16} className="text-zinc-600 dark:text-zinc-400" />
        </div>
        {change !== undefined && change !== null && (
          <div className={cn('flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full',
            isPositive ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
          )}>
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">{title}</p>
      {isLoading ? (
        <div className="h-6 w-20 bg-zinc-100 dark:bg-zinc-800 rounded animate-pulse" />
      ) : (
        <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      )}
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────
const AdminFinancials = () => {
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [dateRange, setDateRange] = useState('30d');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [commission, setCommission] = useState(10);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await adminService.getSettings();
        const s = res?.data || res;
        if (s?.pricing?.commission) setCommission(s.pricing.commission);
      } catch { /* use default */ }
      finally { setSettingsLoaded(true); }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    if (settingsLoaded) loadFinancialData();
  }, [dateRange, settingsLoaded]);

  const loadFinancialData = async () => {
    setLoading(true);
    try {
      const endDate = new Date().toISOString();
      const days = DATE_RANGES.find(d => d.key === dateRange)?.days || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const [revenueData, bookingsData] = await Promise.all([
        adminService.getRevenueReport(startDate, endDate).catch(() => null),
        adminService.getAllBookings({ status: 'COMPLETED', limit: 100, sort: '-createdAt' }).catch(() => null),
      ]);

      if (revenueData?.data || revenueData) setRevenue(revenueData?.data || revenueData);

      const bookings = bookingsData?.data?.bookings || bookingsData?.bookings || [];
      if (bookings.length > 0) {
        const rate = commission / 100;
        setSettlements(bookings.map(b => ({
          _id: b._id,
          bookingId: b._id?.slice(-8)?.toUpperCase(),
          passenger: b.passenger?.name || b.passenger?.profile?.firstName || 'Unknown',
          driver: b.ride?.creator?.name || b.ride?.creator?.profile?.firstName || 'Unknown',
          amount: b.payment?.amount || b.totalPrice || 0,
          platformFee: b.payment?.platformCommission || Math.round((b.payment?.amount || b.totalPrice || 0) * rate),
          driverPayout: b.payment?.rideFare || Math.round((b.payment?.amount || b.totalPrice || 0) * (1 - rate)),
          status: b.payment?.status || b.status || 'PENDING',
          date: b.createdAt,
          method: b.payment?.method || 'CASH',
          seatsBooked: b.seatsBooked || 1,
        })));
      }
    } catch { /* empty states shown */ }
    finally { setLoading(false); }
  };

  const handleBatchSettlement = async () => {
    if (!confirm('Process batch settlement for all pending payouts?')) return;
    setBatchProcessing(true);
    try { await adminService.batchSettlement({ process: true }); await loadFinancialData(); }
    catch { /* handled */ }
    finally { setBatchProcessing(false); }
  };

  // ─── Computed ──────────────────────────────────────────────
  const metrics = useMemo(() => {
    const rate = commission / 100;
    const totalRevenue = revenue?.totalRevenue || settlements.reduce((s, t) => s + t.amount, 0);
    const totalPlatformFee = revenue?.totalCommission || Math.round(totalRevenue * rate);
    const totalDriverPayouts = Math.round(totalRevenue - totalPlatformFee);
    const totalRefunds = revenue?.totalRefunds || 0;
    const netRevenue = totalPlatformFee - totalRefunds;
    const pendingCount = settlements.filter(s => s.status === 'PENDING').length;
    const completedCount = settlements.filter(s => s.status === 'COMPLETED' || s.status === 'DROPPED_OFF').length;
    const avgTxn = settlements.length > 0 ? Math.round(totalRevenue / settlements.length) : 0;
    const methods = {};
    settlements.forEach(s => { methods[s.method || 'CASH'] = (methods[s.method || 'CASH'] || 0) + s.amount; });
    const paymentMethodData = Object.entries(methods).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const revenueChartData = revenue?.dailyRevenue || revenue?.chartData || revenue?.data || [];
    return { totalRevenue, totalPlatformFee, totalDriverPayouts, totalRefunds, netRevenue, pendingCount, completedCount, avgTxn, paymentMethodData, revenueChartData };
  }, [revenue, settlements, commission]);

  const aiMetrics = { totalRevenue: metrics.totalRevenue, platformCommission: metrics.totalPlatformFee, commissionRate: commission, driverPayouts: metrics.totalDriverPayouts, pendingSettlements: metrics.pendingCount, completedSettlements: metrics.completedCount, avgTransactionValue: metrics.avgTxn, transactionCount: settlements.length, period: dateRange };

  const settlementColumns = useMemo(() => [
    { field: 'bookingId', label: 'Booking', sortable: true, render: (v) => <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">{v}</span> },
    { field: 'passenger', label: 'Passenger', sortable: true },
    { field: 'driver', label: 'Driver', sortable: true },
    { field: 'amount', label: 'Gross', sortable: true, render: (v) => <span className="font-semibold text-zinc-900 dark:text-zinc-100">₹{v?.toLocaleString('en-IN')}</span> },
    { field: 'platformFee', label: `Fee (${commission}%)`, render: (v) => <span className="text-emerald-600 dark:text-emerald-400 font-medium">₹{v?.toLocaleString('en-IN')}</span> },
    { field: 'driverPayout', label: 'Payout', render: (v) => <span className="text-zinc-600 dark:text-zinc-400">₹{v?.toLocaleString('en-IN')}</span> },
    { field: 'method', label: 'Method', render: (v) => <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset', METHOD_STYLES[v] || METHOD_STYLES.CASH)}>{v}</span> },
    { field: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    { field: 'date', label: 'Date', sortable: true, render: (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—' },
  ], [commission]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Financial Command Center"
        subtitle={`Revenue tracking · ${commission}% commission · Driver payouts & settlements`}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-100 dark:bg-zinc-800 rounded-lg p-0.5">
              {DATE_RANGES.map(r => (
                <button key={r.key} onClick={() => setDateRange(r.key)}
                  className={cn('px-3 py-1 text-xs font-medium rounded-md transition',
                    dateRange === r.key ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}>
                  {r.label}
                </button>
              ))}
            </div>
            <button onClick={loadFinancialData} className="p-2 rounded-md text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition" title="Refresh">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <ExportButton type="csv" params={{ section: 'financials', dateRange }} />
            <button onClick={handleBatchSettlement} disabled={batchProcessing || metrics.pendingCount === 0}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition">
              {batchProcessing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
              {batchProcessing ? 'Processing...' : `Settle All (${metrics.pendingCount})`}
            </button>
          </div>
        }
      />

      <AIInsightCard context="financial" metrics={aiMetrics} title="Financial Intelligence" />

      {/* Revenue Waterfall */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
          <Activity size={14} className="text-zinc-400" /> Revenue Waterfall
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <WaterfallCard label="Gross Revenue" value={metrics.totalRevenue} icon={IndianRupee} color="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-zinc-200 dark:border-zinc-700" />
          <WaterfallCard label={`Platform (${commission}%)`} value={metrics.totalPlatformFee} percentage={`${commission}%`} icon={PiggyBank} color="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800" />
          <WaterfallCard label="Driver Payouts" value={metrics.totalDriverPayouts} percentage={`${100 - commission}%`} icon={Wallet} color="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800" />
          <WaterfallCard label="Refunds" value={metrics.totalRefunds} icon={RefreshCw} color="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800" />
          <WaterfallCard label="Net Platform Revenue" value={metrics.netRevenue} icon={CircleDollarSign} color="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-100" isLast />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricTile title="Total Revenue" value={`₹${(metrics.totalRevenue / 1000).toFixed(1)}K`} icon={TrendingUp} loading={loading} />
        <MetricTile title="Commission" value={`₹${(metrics.totalPlatformFee / 1000).toFixed(1)}K`} icon={Percent} loading={loading} />
        <MetricTile title="Avg Transaction" value={`₹${metrics.avgTxn.toLocaleString('en-IN')}`} icon={CreditCard} loading={loading} />
        <MetricTile title="Transactions" value={settlements.length} icon={Activity} loading={loading} />
        <MetricTile title="Pending" value={metrics.pendingCount} icon={Clock} loading={loading} />
        <MetricTile title="Completed" value={metrics.completedCount} icon={CheckCircle} loading={loading} />
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 w-fit overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition whitespace-nowrap',
              activeTab === tab.id ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}>
            <tab.Icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Revenue Trend</h3>
                <span className="text-xs text-zinc-400">Last {DATE_RANGES.find(d => d.key === dateRange)?.days} days</span>
              </div>
              {metrics.revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={metrics.revenueChartData}>
                    <defs>
                      <linearGradient id="finRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#18181b" stopOpacity={0.12} />
                        <stop offset="95%" stopColor="#18181b" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                    <XAxis dataKey={metrics.revenueChartData[0]?._id ? '_id' : 'date'} tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false}
                      tickFormatter={v => { const d = new Date(v); return isNaN(d) ? v : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }); }} />
                    <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e4e4e7', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: 12 }}
                      formatter={(v, name) => [`₹${v?.toLocaleString('en-IN')}`, name === 'revenue' ? 'Revenue' : name]} />
                    <Area type="monotone" dataKey="revenue" stroke="#18181b" strokeWidth={2} fill="url(#finRevGrad)" name="Revenue" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex flex-col items-center justify-center text-zinc-400">
                  <BarChart3 size={32} className="mb-2 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm">Revenue chart populates with transaction data</p>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-4">Payment Methods</h3>
              {metrics.paymentMethodData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={metrics.paymentMethodData} innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                        {metrics.paymentMethodData.map((entry) => <Cell key={entry.name} fill={PAYMENT_COLORS[entry.name] || '#a1a1aa'} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `₹${v?.toLocaleString('en-IN')}`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-2 mt-3">
                    {metrics.paymentMethodData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[item.name] || '#a1a1aa' }} />
                          <span className="text-zinc-500 dark:text-zinc-400">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">{metrics.totalRevenue > 0 ? ((item.value / metrics.totalRevenue) * 100).toFixed(1) : 0}%</span>
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">₹{item.value?.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-zinc-400 text-sm">
                  <CreditCard size={20} className="mr-2 text-zinc-300" /> No payment data yet
                </div>
              )}
            </div>
          </div>

          {/* Revenue Split Bar */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm mb-4">Revenue Split</h3>
            <div className="flex items-center h-8 rounded-lg overflow-hidden mb-3">
              {metrics.totalRevenue > 0 ? (
                <>
                  <div className="h-full bg-emerald-500 flex items-center justify-center" style={{ width: `${commission}%`, minWidth: 60 }}>
                    <span className="text-[10px] font-bold text-white">Platform {commission}%</span>
                  </div>
                  <div className="h-full bg-blue-500 flex items-center justify-center" style={{ width: `${100 - commission}%`, minWidth: 60 }}>
                    <span className="text-[10px] font-bold text-white">Drivers {100 - commission}%</span>
                  </div>
                </>
              ) : (
                <div className="h-full bg-zinc-100 dark:bg-zinc-800 w-full rounded-lg flex items-center justify-center">
                  <span className="text-xs text-zinc-400">No revenue data</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-xs text-zinc-500">Gross Revenue</p><p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">₹{metrics.totalRevenue.toLocaleString('en-IN')}</p></div>
              <div><p className="text-xs text-zinc-500">Platform Take</p><p className="text-lg font-bold text-emerald-600">₹{metrics.totalPlatformFee.toLocaleString('en-IN')}</p></div>
              <div><p className="text-xs text-zinc-500">Driver Payouts</p><p className="text-lg font-bold text-blue-600">₹{metrics.totalDriverPayouts.toLocaleString('en-IN')}</p></div>
            </div>
          </div>
        </div>
      )}

      {/* Settlements Tab */}
      {activeTab === 'settlements' && (
        <AdminDataTable title="Settlement Ledger" columns={settlementColumns} data={settlements} loading={loading} searchable
          searchPlaceholder="Search by booking ID, passenger, driver..." emptyMessage="No settlement records found"
          actions={
            <div className="flex items-center gap-2">
              <ExportButton type="csv" params={{ section: 'settlements' }} />
              <button onClick={handleBatchSettlement} disabled={batchProcessing || metrics.pendingCount === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-medium rounded-md hover:bg-emerald-700 disabled:opacity-50 transition">
                {batchProcessing ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                {batchProcessing ? 'Processing...' : `Settle Pending (${metrics.pendingCount})`}
              </button>
            </div>
          }
        />
      )}

      {/* Transactions Tab */}
      {activeTab === 'transactions' && (
        <AdminDataTable title="Transaction History" columns={settlementColumns} data={settlements} loading={loading} searchable
          searchPlaceholder="Search transactions..." emptyMessage="No transaction records found"
          actions={<ExportButton type="csv" params={{ section: 'transactions' }} />} />
      )}

      {/* Invoices Tab */}
      {activeTab === 'invoices' && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">Invoice Generator</h3>
            <span className="text-xs text-zinc-400">Generate invoices for completed bookings</span>
          </div>
          {settlements.filter(s => s.status === 'COMPLETED' || s.status === 'DROPPED_OFF').length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {settlements.filter(s => s.status === 'COMPLETED' || s.status === 'DROPPED_OFF').slice(0, 12).map(s => (
                <div key={s._id} className="border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-700 dark:text-zinc-300">{s.bookingId}</span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="space-y-1 text-sm mb-3">
                    <div className="flex justify-between"><span className="text-zinc-500">Passenger</span><span className="text-zinc-900 dark:text-zinc-100 font-medium">{s.passenger}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Amount</span><span className="font-semibold text-zinc-900 dark:text-zinc-100">₹{s.amount?.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-500">Date</span><span className="text-zinc-600 dark:text-zinc-400">{s.date ? new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}</span></div>
                  </div>
                  <button onClick={() => adminService.generateInvoice(s._id).catch(() => {})}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 text-xs font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 rounded-md hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">
                    <Download size={12} /> Generate Invoice
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-zinc-400">
              <FileText size={32} className="mx-auto mb-2 text-zinc-300" />
              <p className="text-sm">No completed bookings for invoice generation</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminFinancials;