/**
 * AdminChurn — Churn Prediction & Retention Dashboard
 * BUG FIX: Maps to actual API response shapes:
 *   - POST /api/admin/analytics/churn-predict → { data: { flaggedCount, users[] } }
 *   - GET  /api/admin/analytics/user-ltv      → { analytics: { overview, ltv, cohorts[], segments } }
 */
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import {
  Clock, Crown, Mail, Heart, PieChart as PieChartIcon, Users, Gem,
  RefreshCw, Loader2, Flag, TrendingDown, UserCheck, AlertTriangle, BarChart3,
} from 'lucide-react';
import adminService from '../../services/adminService';
import { AdminStatCard, AdminDataTable, AIInsightCard, AdminPageHeader, StatusBadge } from '../../components/admin';

const SEGMENT_COLORS = { power: '#0ead69', regular: '#6366f1', casual: '#f4a261', inactive: '#dc2626' };

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-md border border-zinc-200 dark:border-zinc-700 p-3 text-sm">
      <p className="font-semibold text-zinc-800 dark:text-zinc-200 mb-1">{label}</p>
      {payload.map((e, i) => (
        <p key={i} className="flex items-center gap-2" style={{ color: e.color }}>
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: e.color }} />
          {e.name}: {e.value}{typeof e.value === 'number' && e.name.includes('Rate') ? '%' : ''}
        </p>
      ))}
    </div>
  );
};

const AdminChurn = () => {
  const [loading, setLoading] = useState(false);
  const [churnData, setChurnData] = useState(null);
  const [ltvData, setLtvData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [churnRes, ltvRes] = await Promise.all([
        adminService.triggerChurnPrediction({}).catch(() => null),
        adminService.getUserLTVAnalytics({}).catch(() => null),
      ]);
      // churnRes => { success, data: { flaggedCount, users[] } }
      const cd = churnRes?.data || churnRes;
      if (cd) setChurnData(cd);
      // ltvRes => { success, analytics: { overview, ltv, cohorts[], segments } }
      const ltv = ltvRes?.analytics || ltvRes?.data?.analytics || ltvRes;
      if (ltv) setLtvData(ltv);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // ─── Churn Data ────────────────────────────────────────────
  const flaggedUsers = churnData?.users || [];
  const flaggedCount = churnData?.flaggedCount || flaggedUsers.length;

  // ─── LTV Data ──────────────────────────────────────────────
  const overview = ltvData?.overview || {};
  const ltv = ltvData?.ltv || {};
  const cohorts = ltvData?.cohorts || [];
  const segments = ltvData?.segments || {};

  const retentionRate = overview.retentionRate30d || 0;
  const churnRate = overview.churnRate || 0;
  const totalUsers = overview.totalUsers || 0;
  const activeUsers = overview.activeUsers30d || 0;

  // ─── Segment Pie Data ─────────────────────────────────────
  const segmentPie = useMemo(() => [
    { name: 'Power (20+)', value: segments.power || 0, fill: SEGMENT_COLORS.power },
    { name: 'Regular (5-19)', value: segments.regular || 0, fill: SEGMENT_COLORS.regular },
    { name: 'Casual (1-4)', value: segments.casual || 0, fill: SEGMENT_COLORS.casual },
    { name: 'Inactive (0)', value: segments.inactive || 0, fill: SEGMENT_COLORS.inactive },
  ].filter(s => s.value > 0), [segments]);

  // ─── Cohort Chart Data ────────────────────────────────────
  const cohortChart = useMemo(() =>
    [...cohorts].reverse().map(c => ({
      month: new Date(c.month + '-01').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      signedUp: c.signedUp, retained: c.retained, retentionRate: c.retentionRate,
    })),
  [cohorts]);

  const aiMetrics = {
    atRiskUsers: flaggedCount, retentionRate, churnRate, totalUsers, activeUsers,
    avgEarnings: Math.round(ltv.avgEarnings || 0), avgSpent: Math.round(ltv.avgSpent || 0),
  };

  // ─── User Table Columns ───────────────────────────────────
  const userColumns = [
    { field: 'name', label: 'User', render: (v, row) => (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 text-xs font-bold">
          {(v || row.email || '?')[0]?.toUpperCase()}
        </div>
        <div>
          <p className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{v || 'Unknown'}</p>
          <p className="text-[10px] text-zinc-400">{row.email}</p>
        </div>
      </div>
    )},
    { field: 'totalRides', label: 'Total Rides', render: (v) => v || 0 },
    { field: 'lastRideAt', label: 'Last Active', render: (v) => {
      if (!v) return <span className="text-zinc-400">Never</span>;
      const days = Math.floor((Date.now() - new Date(v).getTime()) / 86400000);
      return <span className={cn(days > 60 ? 'text-red-600 dark:text-red-400 font-medium' : 'text-zinc-600 dark:text-zinc-400')}>{days}d ago</span>;
    }},
    { field: 'totalRides', key: 'risk', label: 'Risk Level', render: (v) => {
      const isHigh = (v || 0) >= 20;
      return <StatusBadge status={isHigh ? 'HIGH' : 'MEDIUM'} />;
    }},
  ];

  const tabs = [
    { id: 'overview', label: 'Overview', Icon: PieChartIcon },
    { id: 'users', label: 'At-Risk Users', Icon: Users },
    { id: 'ltv', label: 'LTV & Cohorts', Icon: Gem },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Churn Prediction"
        subtitle="User retention analytics, risk flagging & automated winback campaigns"
        actions={
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            {loading ? 'Scanning...' : 'Run Churn Analysis'}
          </button>
        }
      />

      <AIInsightCard context="churn" metrics={aiMetrics} title="Retention Intelligence" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard title="At-Risk Users" value={flaggedCount} icon={AlertTriangle} loading={loading} />
        <AdminStatCard title="Retention Rate" value={retentionRate ? `${retentionRate}%` : '—'} icon={Heart} loading={loading} />
        <AdminStatCard title="Active (30d)" value={activeUsers} icon={UserCheck} subtitle={`of ${totalUsers} total`} loading={loading} />
        <AdminStatCard title="Churn Rate" value={churnRate ? `${churnRate}%` : '—'} icon={TrendingDown} loading={loading} />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition',
              activeTab === tab.id ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}>
            <tab.Icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ═══ Overview Tab ═══ */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Segments */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">User Segments</h3>
            {segmentPie.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={segmentPie} innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                      {segmentPie.map((entry, idx) => <Cell key={idx} fill={entry.fill} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-3">
                  {segmentPie.map(s => (
                    <div key={s.name} className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                      {s.name}: {s.value}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-[240px] flex items-center justify-center">
                <div className="text-center">
                  <PieChartIcon size={24} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm text-zinc-500">Run churn analysis to see segments</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Summary */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Retention Action Summary</h3>
            <div className="space-y-3">
              {[
                { Icon: Flag, label: 'Users Flagged', value: flaggedCount, desc: 'riskFlags.churnRisk set in database', cls: 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 text-orange-800 dark:text-orange-300' },
                { Icon: Mail, label: 'Winback Emails', value: flaggedCount > 0 ? flaggedCount : 0, desc: 'Automated MISSYOU20 promo email sent', cls: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' },
                { Icon: Crown, label: 'Power Users at Risk', value: flaggedUsers.filter(u => (u.totalRides || 0) >= 20).length, desc: '20+ rides, inactive 30+ days', cls: 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-300' },
              ].map(item => (
                <div key={item.label} className={cn('p-4 rounded-lg border', item.cls)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <item.Icon size={14} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <span className="text-lg font-semibold">{item.value}</span>
                  </div>
                  <p className="text-xs opacity-70 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* LTV Summary */}
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Lifetime Value Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Avg Earnings', value: `₹${Math.round(ltv.avgEarnings || 0)}`, desc: 'Per rider' },
                { label: 'Avg Spent', value: `₹${Math.round(ltv.avgSpent || 0)}`, desc: 'Per passenger' },
                { label: 'Avg Rides', value: Math.round(ltv.medianRides || 0), desc: 'Completed' },
                { label: 'Top Earners', value: ltv.topEarners || 0, desc: '₹1000+ earned' },
                { label: 'Top Spenders', value: ltv.topSpenders || 0, desc: '₹1000+ spent' },
              ].map(c => (
                <div key={c.label} className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{c.label}</p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">{c.value}</p>
                  <p className="text-[10px] text-zinc-400">{c.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ At-Risk Users Tab ═══ */}
      {activeTab === 'users' && (
        <AdminDataTable
          title="Flagged At-Risk Users"
          columns={userColumns}
          data={flaggedUsers}
          loading={loading}
          searchable
          searchPlaceholder="Search by name or email..."
          emptyMessage="No at-risk users detected — retention is strong"
        />
      )}

      {/* ═══ LTV & Cohorts Tab ═══ */}
      {activeTab === 'ltv' && (
        <div className="space-y-6">
          {/* Retention Cohort Chart */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Monthly Retention Cohorts</h3>
            {cohortChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={cohortChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} domain={[0, 100]} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="signedUp" fill="#e4e4e7" name="Signed Up" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="left" dataKey="retained" fill="#0ead69" name="Retained" radius={[4, 4, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="retentionRate" stroke="#6366f1" strokeWidth={2} name="Retention Rate" dot={{ r: 3 }} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[320px] flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm text-zinc-500">Cohort data will appear after LTV analysis loads</p>
                </div>
              </div>
            )}
          </div>

          {/* Cohort Table */}
          {cohorts.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Cohort Breakdown</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-left">
                      <th className="pb-3 font-medium">Month</th>
                      <th className="pb-3 font-medium text-right">Signed Up</th>
                      <th className="pb-3 font-medium text-right">Still Active</th>
                      <th className="pb-3 font-medium text-right">Retention</th>
                      <th className="pb-3 font-medium">Bar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {[...cohorts].reverse().map(c => (
                      <tr key={c.month} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                        <td className="py-3 font-medium text-zinc-900 dark:text-zinc-100">
                          {new Date(c.month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                        </td>
                        <td className="py-3 text-right text-zinc-600 dark:text-zinc-400">{c.signedUp}</td>
                        <td className="py-3 text-right text-emerald-600">{c.retained}</td>
                        <td className="py-3 text-right font-semibold text-zinc-900 dark:text-zinc-100">{c.retentionRate}%</td>
                        <td className="py-3 w-32">
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full transition-all" style={{ width: `${c.retentionRate}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminChurn;
