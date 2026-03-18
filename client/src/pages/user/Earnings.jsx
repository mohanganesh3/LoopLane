/**
 * Earnings — Driver Earnings Dashboard
 * Monthly charts, per-ride breakdown, dynamic commission from API
 */
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from 'recharts';
import { LoadingSpinner } from '../../components/common';
import { ClayCard, ClayButton } from '../../components/clay';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const CHART_COLORS = ['#0ead69', '#6366f1', '#f4a261', '#e07a5f', '#5a9c7c'];

const Earnings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [earnings, setEarnings] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [period, setPeriod] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchEarnings();
  }, [period]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/user/earnings?period=${period}`);
      if (response.data.success) {
        setEarnings(response.data.earnings);
        setTransactions(response.data.transactions || []);
      }
    } catch (err) {
      // Fallback with user stats — use server-provided commission rate if available
      const stats = user?.statistics || {};
      const commRate = earnings?.commissionRate || 0.10;
      setEarnings({
        totalEarnings: stats.totalEarnings || 0,
        totalRides: stats.ridesAsDriver || stats.completedRides || 0,
        pendingPayout: 0,
        commissionRate: commRate,
        commission: Math.round((stats.totalEarnings || 0) * commRate),
        netEarnings: Math.round((stats.totalEarnings || 0) * (1 - commRate)),
        avgPerRide: stats.ridesAsDriver ? Math.round((stats.totalEarnings || 0) / stats.ridesAsDriver) : 0,
      });
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  // Derived values — use API values whenever available, fallback to calculation
  const commRate = earnings?.commissionRate || 0.10;
  const totalEarnings = earnings?.totalEarnings || 0;
  const netEarnings = earnings?.netEarnings || Math.round(totalEarnings * (1 - commRate));
  const commission = earnings?.commission || Math.round(totalEarnings * commRate);
  const pendingPayout = earnings?.pendingPayout || 0;
  const totalRides = earnings?.totalRides || 0;
  const avgPerRide = earnings?.avgPerRide || (totalRides > 0 ? Math.round(totalEarnings / totalRides) : 0);
  const commPct = Math.round(commRate * 100);

  // Monthly breakdown chart data — group transactions by month
  const monthlyData = useMemo(() => {
    if (!transactions.length) return [];
    const map = new Map();
    transactions.forEach(txn => {
      const d = new Date(txn.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!map.has(key)) map.set(key, { key, label, gross: 0, net: 0, commission: 0, rides: 0 });
      const entry = map.get(key);
      entry.gross += txn.amount || 0;
      entry.commission += txn.commission || Math.round((txn.amount || 0) * commRate);
      entry.net += (txn.amount || 0) - (txn.commission || Math.round((txn.amount || 0) * commRate));
      entry.rides += 1;
    });
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [transactions, commRate]);

  // Weekly earnings trend
  const weeklyTrend = useMemo(() => {
    if (!transactions.length) return [];
    const map = new Map();
    const now = Date.now();
    // last 12 weeks
    transactions.filter(t => now - new Date(t.createdAt).getTime() < 84 * 86400000).forEach(txn => {
      const d = new Date(txn.createdAt);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!map.has(key)) map.set(key, { key, label, amount: 0 });
      map.get(key).amount += txn.amount || 0;
    });
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [transactions]);

  // Earnings split for pie chart
  const splitData = useMemo(() => [
    { name: 'Net Earnings', value: netEarnings, fill: '#0ead69' },
    { name: 'Commission', value: commission, fill: '#f4a261' },
    { name: 'Pending', value: pendingPayout, fill: '#6366f1' },
  ].filter(s => s.value > 0), [netEarnings, commission, pendingPayout]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
    { id: 'rides', label: 'Per-Ride', icon: 'fa-car' },
    { id: 'monthly', label: 'Monthly', icon: 'fa-calendar-alt' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen pb-12"
      style={{ background: 'var(--ll-cream, #f5f0e8)' }}
    >
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Link to="/dashboard" className="text-emerald-500 hover:text-emerald-700 text-sm mb-4 inline-block">
            <i className="fas fa-arrow-left mr-2" />Back to Dashboard
          </Link>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h1
              className="text-3xl font-bold text-gray-800"
              style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}
            >
              <i className="fas fa-chart-line text-emerald-500 mr-3" />Earnings
            </h1>
            <div className="flex gap-1">
              {['week', 'month', 'year'].map(p => (
                <ClayButton key={p} variant={period === p ? 'primary' : 'ghost'} size="sm" onClick={() => setPeriod(p)}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </ClayButton>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Hero Earnings Card */}
        <ClayCard variant="emerald" padding="lg" className="mb-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <p className="text-emerald-100 text-sm font-medium mb-1">Total Earnings</p>
              <p className="text-4xl font-bold text-white">₹{totalEarnings.toLocaleString()}</p>
              <p className="text-emerald-200 text-xs mt-1">{totalRides} rides completed</p>
            </div>
            {splitData.length > 0 && (
              <div className="w-24 h-24">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={splitData} innerRadius={25} outerRadius={40} paddingAngle={2} dataKey="value" stroke="none">
                      {splitData.map((s, i) => <Cell key={i} fill={s.fill} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-emerald-400/30 text-white">
            <div>
              <p className="text-emerald-200 text-xs">Net Earnings</p>
              <p className="text-lg font-bold">₹{netEarnings.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-emerald-200 text-xs">Commission ({commPct}%)</p>
              <p className="text-lg font-bold">₹{commission.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-emerald-200 text-xs">Pending Payout</p>
              <p className="text-lg font-bold">₹{pendingPayout.toLocaleString()}</p>
            </div>
          </div>
        </ClayCard>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: 'fa-car', bg: 'bg-blue-100', color: 'text-blue-600', value: totalRides, label: 'Total Rides' },
            { icon: 'fa-rupee-sign', bg: 'bg-green-100', color: 'text-green-600', value: `₹${avgPerRide}`, label: 'Avg per Ride' },
            { icon: 'fa-users', bg: 'bg-purple-100', color: 'text-purple-600', value: user?.statistics?.totalPassengersCarried || 0, label: 'Passengers' },
            { icon: 'fa-star', bg: 'bg-yellow-100', color: 'text-yellow-600', value: user?.rating?.overall ? Number(user.rating.overall).toFixed(1) : '—', label: 'Rating' },
          ].map((s, i) => (
            <ClayCard key={i} variant="flat" padding="sm">
              <div className={`w-10 h-10 ${s.bg} rounded-lg flex items-center justify-center mb-2`}>
                <i className={`fas ${s.icon} ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </ClayCard>
          ))}
        </div>

        {/* Weekly Trend Chart */}
        {weeklyTrend.length >= 2 && (
          <ClayCard variant="default" padding="lg" className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3" style={{ fontFamily: 'var(--ll-font-display)' }}>
              <i className="fas fa-wave-square text-indigo-500 mr-2" />Earnings Trend
            </h2>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={weeklyTrend}>
                <defs>
                  <linearGradient id="earnTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ead69" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#0ead69" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `₹${v}`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [`₹${v.toLocaleString()}`, 'Earnings']} contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="amount" stroke="#0ead69" fill="url(#earnTrend)" strokeWidth={2} dot={{ r: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ClayCard>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition ${
                activeTab === tab.id ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <i className={`fas ${tab.icon} text-xs`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Payout Info */}
            <ClayCard variant="default" padding="lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">
                    <i className="fas fa-university text-emerald-500 mr-2" />Payout Settings
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">Earnings are automatically settled weekly</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Next payout</p>
                  <p className="text-lg font-bold text-emerald-600">₹{netEarnings.toLocaleString()}</p>
                </div>
              </div>
              <ClayCard variant="flat" padding="sm" className="mt-4">
                <p className="text-xs text-blue-700">
                  <i className="fas fa-flask mr-1" />
                  <span className="font-semibold">Simulation Mode</span> — Payouts are simulated. No real bank transfers occur.
                </p>
              </ClayCard>
            </ClayCard>

            {/* Earnings Breakdown Donut */}
            {splitData.length > 0 && (
              <ClayCard variant="default" padding="lg">
                <h2 className="text-lg font-bold text-gray-800 mb-4" style={{ fontFamily: 'var(--ll-font-display)' }}>
                  <i className="fas fa-chart-pie text-purple-500 mr-2" />Earnings Breakdown
                </h2>
                <div className="flex items-center gap-8 flex-wrap">
                  <div className="w-40 h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={splitData} innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" stroke="none">
                          {splitData.map((s, i) => <Cell key={i} fill={s.fill} />)}
                        </Pie>
                        <Tooltip formatter={v => `₹${v.toLocaleString()}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-3 flex-1">
                    {splitData.map(s => (
                      <div key={s.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.fill }} />
                          <span className="text-sm text-gray-700">{s.name}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">₹{s.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ClayCard>
            )}
          </div>
        )}

        {activeTab === 'rides' && (
          <ClayCard variant="default" padding="lg">
            <h2 className="text-lg font-bold text-gray-800 mb-4" style={{ fontFamily: 'var(--ll-font-display)' }}>
              <i className="fas fa-list text-emerald-500 mr-2" />Per-Ride Earnings
            </h2>

            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <i className="fas fa-receipt text-gray-400 text-2xl" />
                </div>
                <p className="text-gray-500">Complete rides to see your earnings here</p>
                <Link to="/post-ride" className="inline-block mt-3 text-emerald-500 hover:text-emerald-600 font-medium text-sm">
                  Post a ride <i className="fas fa-arrow-right ml-1" />
                </Link>
              </div>
            ) : (
              <div className="divide-y">
                {transactions.map(txn => {
                  const txnCommission = txn.commission || Math.round((txn.amount || 0) * commRate);
                  const txnNet = (txn.amount || 0) - txnCommission;
                  return (
                    <div key={txn._id} className="py-4 flex items-center justify-between hover:bg-gray-50 transition px-2 -mx-2 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                          <i className="fas fa-car text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{txn.description || 'Ride earnings'}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(txn.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            {txn.passengers ? ` · ${txn.passengers} passenger${txn.passengers > 1 ? 's' : ''}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">+₹{(txn.amount || 0).toLocaleString()}</p>
                        <div className="flex items-center gap-2 justify-end text-[10px]">
                          <span className="text-orange-500">-₹{txnCommission} fee</span>
                          <span className="text-gray-400">·</span>
                          <span className="text-emerald-600 font-semibold">₹{txnNet} net</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ClayCard>
        )}

        {activeTab === 'monthly' && (
          <div className="space-y-6">
            {monthlyData.length > 0 ? (
              <>
                <ClayCard variant="default" padding="lg">
                  <h2 className="text-lg font-bold text-gray-800 mb-4" style={{ fontFamily: 'var(--ll-font-display)' }}>
                    <i className="fas fa-calendar-alt text-indigo-500 mr-2" />Monthly Breakdown
                  </h2>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `₹${v}`} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        formatter={(val, name) => [`₹${val.toLocaleString()}`, name]}
                        contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}
                      />
                      <Bar dataKey="net" name="Net Earnings" fill="#0ead69" radius={[4, 4, 0, 0]} stackId="a" />
                      <Bar dataKey="commission" name="Commission" fill="#f4a261" radius={[4, 4, 0, 0]} stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-6 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-emerald-500" /> Net</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-1.5 rounded bg-yellow-500" /> Commission</span>
                  </div>
                </ClayCard>

                {/* Monthly Table */}
                <ClayCard variant="default" padding="lg">
                  <h2 className="text-lg font-bold text-gray-800 mb-4">Monthly Summary</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 text-gray-500 font-medium">Month</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Rides</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Gross</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Commission</th>
                          <th className="text-right py-2 text-gray-500 font-medium">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyData.map(m => (
                          <tr key={m.key} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2.5 font-medium text-gray-800">{m.label}</td>
                            <td className="py-2.5 text-right text-gray-600">{m.rides}</td>
                            <td className="py-2.5 text-right text-gray-800 font-medium">₹{m.gross.toLocaleString()}</td>
                            <td className="py-2.5 text-right text-orange-600">-₹{m.commission.toLocaleString()}</td>
                            <td className="py-2.5 text-right text-emerald-600 font-bold">₹{m.net.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ClayCard>
              </>
            ) : (
              <ClayCard variant="default" padding="lg">
                <div className="text-center py-12">
                  <i className="fas fa-calendar-alt text-3xl text-gray-300 mb-3 block" />
                  <p className="text-gray-500">Monthly data will appear once you complete rides</p>
                </div>
              </ClayCard>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Earnings;
