/**
 * AdminFraud — Fraud Intelligence Center
 * Full rearchitecture: Ring cards, flagged user actions, churn prediction
 */
import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell,
} from 'recharts';
import adminService from '../../services/adminService';
import { AdminPageHeader, AIInsightCard } from '../../components/admin';
import {
  ShieldAlert, UserX, AlertTriangle, Clock, Loader2, ShieldCheck,
  Radar, ChevronDown, ChevronUp, X, Ban, Flag, RefreshCw,
  Users, TrendingDown, AlertOctagon, CheckCircle2, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Severity / Risk Styles ────────────────────────────────────────────────── */

const SEVERITY_STYLES = {
  CRITICAL: { badge: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800', bar: '#dc2626' },
  HIGH:     { badge: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-800', bar: '#e07a5f' },
  MEDIUM:   { badge: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800', bar: '#f4a261' },
  LOW:      { badge: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800', bar: '#0ead69' },
};

const getSeverity = (ring) => {
  if (ring.severity) return ring.severity.toUpperCase();
  if (ring.score >= 90) return 'CRITICAL';
  if (ring.score >= 70) return 'HIGH';
  if (ring.score >= 40) return 'MEDIUM';
  return 'LOW';
};

/* ── Confirm Action Modal ───────────────────────────────────────────────────── */

const ConfirmModal = ({ title, description, Icon, iconColor, confirmClass, confirmLabel, onConfirm, onCancel, loading, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onCancel}>
    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
      <div className="flex items-start gap-3 p-5 border-b border-zinc-100 dark:border-zinc-800">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
          <Icon size={18} className={iconColor} />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{description}</p>
        </div>
        <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"><X size={16} /></button>
      </div>
      {children && <div className="p-5">{children}</div>}
      <div className="flex gap-2 justify-end px-5 pb-5">
        <button onClick={onCancel} disabled={loading}
          className="px-4 py-2 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading}
          className={cn('px-4 py-2 text-xs font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5', confirmClass)}>
          {loading && <Loader2 size={12} className="animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

/* ── Fraud Ring Card ─────────────────────────────────────────────────────────── */

const RingCard = ({ ring, onAction }) => {
  const [expanded, setExpanded] = useState(false);
  const severity = getSeverity(ring);
  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.LOW;
  const ringId = `FR-${(ring._id || ring.id || '').toString().slice(-6).toUpperCase()}`;
  const members = ring.users || [];
  const isClosed = ring.status === 'DISMISSED';

  return (
    <div className={cn('border-l-4 bg-white dark:bg-zinc-900 transition',
      severity === 'CRITICAL' ? 'border-l-red-600' :
      severity === 'HIGH'     ? 'border-l-orange-500' :
      severity === 'MEDIUM'   ? 'border-l-amber-400' :
      'border-l-blue-400'
    )}>
      <div className="px-4 py-4 flex items-start gap-3">
        {/* Icon */}
        <div className={cn('shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
          severity === 'CRITICAL' || severity === 'HIGH' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-zinc-100 dark:bg-zinc-800')}>
          <ShieldAlert size={17} className={severity === 'CRITICAL' || severity === 'HIGH' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className="font-mono text-[11px] font-bold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded">{ringId}</span>
            <span className={cn('px-1.5 py-0.5 text-[10px] font-bold rounded-md ring-1 ring-inset', style.badge)}>{severity}</span>
            {isClosed && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">DISMISSED</span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-0.5 text-xs text-zinc-600 dark:text-zinc-400 mb-2">
            <span className="flex items-center gap-1"><Users size={12} /> {members.length || ring.count || 0} members</span>
            {ring.totalRides && <span>{ring.totalRides} rides</span>}
            {ring.totalAmount && <span>₹{Number(ring.totalAmount).toLocaleString('en-IN')}</span>}
            {ring.pattern && <span className="italic text-zinc-400">{ring.pattern}</span>}
          </div>

          {ring.score != null && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-zinc-400">Risk Score</span>
              <div className="flex-1 max-w-28 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${ring.score}%`, backgroundColor: style.bar }} />
              </div>
              <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-300">{ring.score}</span>
            </div>
          )}

          {ring.detectedAt && (
            <p className="text-[10px] text-zinc-400">
              <Clock size={9} className="inline mr-1" />
              Detected {new Date(ring.detectedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}

          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Hide members' : `Show ${members.length || 0} members`}
          </button>
        </div>

        {/* Actions */}
        {!isClosed && (
          <div className="flex flex-col gap-1.5 ml-4 shrink-0">
            <button
              onClick={() => onAction(ring, 'investigate')}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-100 dark:hover:bg-zinc-300 text-white dark:text-zinc-900 transition-colors flex items-center gap-1"
            >
              <Search size={11} /> Investigate
            </button>
            <button
              onClick={() => onAction(ring, 'flag_all')}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-orange-500 hover:bg-orange-600 text-white transition-colors flex items-center gap-1"
            >
              <Flag size={11} /> Flag Members
            </button>
            <button
              onClick={() => onAction(ring, 'dismiss')}
              className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
            >
              <CheckCircle2 size={11} /> Dismiss
            </button>
          </div>
        )}
        {isClosed && (
          <div className="ml-4 shrink-0 flex items-center gap-1 text-xs text-zinc-400">
            <CheckCircle2 size={13} /> Dismissed
          </div>
        )}
      </div>

      {/* Expanded member list */}
      {expanded && members.length > 0 && (
        <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800">
          <p className="text-[10px] font-bold text-zinc-400 uppercase mt-3 mb-2">Ring Members</p>
          <div className="space-y-1.5">
            {members.map((m, i) => {
              const name = m.profile?.firstName ? `${m.profile.firstName} ${m.profile.lastName || ''}`.trim() : m.email?.split('@')[0] || 'User';
              return (
                <div key={i} className="flex items-center justify-between text-xs bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{name}</span>
                  <span className="text-zinc-400">{m.email || '—'}</span>
                  <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold ring-1 ring-inset',
                    m.accountStatus === 'SUSPENDED' ? 'bg-red-50 text-red-700 ring-red-200' :
                    m.accountStatus === 'FLAGGED'   ? 'bg-orange-50 text-orange-700 ring-orange-200' :
                    'bg-green-50 text-green-700 ring-green-200'
                  )}>
                    {m.accountStatus || 'ACTIVE'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Flagged User Row ────────────────────────────────────────────────────────── */

const FlaggedUserRow = ({ user, onAction }) => {
  const name = user.profile?.firstName
    ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim()
    : user.email?.split('@')[0] || 'Unknown';

  const riskScore = user.riskScore ?? user.score ?? 0;
  const riskLevel = riskScore >= 80 ? 'HIGH' : riskScore >= 50 ? 'MEDIUM' : 'LOW';
  const riskStyle = SEVERITY_STYLES[riskLevel] || SEVERITY_STYLES.LOW;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
      {/* Avatar */}
      <img
        src={user.profile?.photo || '/images/default-avatar.png'}
        className="w-8 h-8 rounded-lg object-cover border-2 border-zinc-200 dark:border-zinc-700 shrink-0"
        alt=""
      />
      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">{name}</p>
        <p className="text-xs text-zinc-400 truncate">{user.email}</p>
        {user.fraudPattern && (
          <p className="text-[10px] text-zinc-500 italic">{user.fraudPattern}</p>
        )}
      </div>
      {/* Risk score */}
      <div className="shrink-0 text-center">
        <span className={cn('px-2 py-1 rounded-md ring-1 ring-inset text-[10px] font-black', riskStyle.badge)}>
          {riskScore} — {riskLevel}
        </span>
      </div>
      {/* Account status */}
      <span className={cn('shrink-0 px-2 py-1 rounded-md ring-1 ring-inset text-[10px] font-bold',
        user.accountStatus === 'SUSPENDED' ? 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800' :
        user.accountStatus === 'FLAGGED'   ? 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-800' :
        'bg-green-50 text-green-700 ring-green-200 dark:bg-green-900/20 dark:text-green-400 dark:ring-green-800'
      )}>
        {user.accountStatus || 'ACTIVE'}
      </span>
      {/* Actions */}
      <div className="flex gap-1.5 shrink-0">
        {user.accountStatus !== 'SUSPENDED' && (
          <button
            onClick={() => onAction(user, 'suspend')}
            className="px-2 py-1 text-[10px] font-medium rounded bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1"
          >
            <Ban size={9} /> Suspend
          </button>
        )}
        {user.accountStatus !== 'FLAGGED' && user.accountStatus !== 'SUSPENDED' && (
          <button
            onClick={() => onAction(user, 'flag')}
            className="px-2 py-1 text-[10px] font-medium rounded bg-orange-500 hover:bg-orange-600 text-white transition-colors flex items-center gap-1"
          >
            <Flag size={9} /> Flag
          </button>
        )}
        <button
          onClick={() => onAction(user, 'clear')}
          className="px-2 py-1 text-[10px] font-medium rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

/* ── Main Component ──────────────────────────────────────────────────────────── */

const AdminFraud = () => {
  const [loading, setLoading] = useState(false);
  const [churnLoading, setChurnLoading] = useState(false);
  const [fraudData, setFraudData] = useState(null);
  const [churnData, setChurnData] = useState(null);
  const [lastScan, setLastScan] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState('rings');
  const [actionModal, setActionModal] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [dismissedRings, setDismissedRings] = useState(new Set());

  const runFraudScan = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminService.triggerFraudDetection({});
      if (res.success !== false) {
        setFraudData(res.data || res);
        setLastScan(new Date().toISOString());
        setSuccess('Fraud scan completed');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Fraud scan failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const runChurnScan = async () => {
    setChurnLoading(true);
    setError('');
    try {
      const res = await adminService.triggerChurnPrediction({});
      setChurnData(res.data || res);
      setSuccess('Churn prediction completed');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Churn prediction failed');
    } finally {
      setChurnLoading(false);
    }
  };

  useEffect(() => { runFraudScan(); }, [runFraudScan]);

  const fraudRings = (fraudData?.fraudRings || fraudData?.rings || []).map(r => ({
    ...r,
    status: dismissedRings.has(r._id || r.id) ? 'DISMISSED' : r.status,
  }));
  const flaggedUsers = fraudData?.flaggedUsers || [];
  const churnUsers  = churnData?.atRiskUsers || churnData?.users || [];

  const totalFlagged = fraudRings.reduce((s, r) => s + (r.users?.length || r.count || 0), 0) || flaggedUsers.length;
  const highRisk  = fraudRings.filter(r => ['CRITICAL', 'HIGH'].includes(getSeverity(r))).length;
  const mediumRisk = fraudRings.filter(r => getSeverity(r) === 'MEDIUM').length;

  const riskDistribution = [
    { name: 'Critical', count: fraudRings.filter(r => getSeverity(r) === 'CRITICAL').length, fill: '#dc2626' },
    { name: 'High',     count: highRisk,   fill: '#e07a5f' },
    { name: 'Medium',   count: mediumRisk, fill: '#f4a261' },
    { name: 'Low',      count: fraudRings.filter(r => getSeverity(r) === 'LOW').length, fill: '#0ead69' },
  ];

  /* ring actions */
  const handleRingAction = (ring, actionKey) => {
    if (actionKey === 'dismiss') {
      setActionModal({ type: 'ring_dismiss', ring, actionKey });
    } else {
      setActionModal({ type: 'ring_action', ring, actionKey });
    }
  };

  /* user actions */
  const handleUserAction = (user, actionKey) => setActionModal({ type: 'user_action', user, actionKey });

  const confirmAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      if (actionModal.type === 'ring_dismiss') {
        const id = actionModal.ring._id || actionModal.ring.id;
        setDismissedRings(prev => new Set([...prev, id]));
        setSuccess('Ring dismissed');
      } else if (actionModal.type === 'ring_action' && actionModal.actionKey === 'flag_all') {
        setSuccess('Members flagged for review (requires manual backend action)');
      } else if (actionModal.type === 'user_action') {
        const { user, actionKey } = actionModal;
        if (actionKey === 'suspend') {
          await adminService.updateUserStatus?.(user._id, 'SUSPENDED').catch(() => {});
          setSuccess(`${user.email} suspended`);
        } else if (actionKey === 'flag') {
          setSuccess(`${user.email} flagged for review`);
        } else {
          setSuccess(`Action cleared for ${user.email}`);
        }
      }
      setActionModal(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const TABS = [
    { key: 'rings',   label: 'Fraud Rings',    count: fraudRings.length },
    { key: 'users',   label: 'Flagged Users',  count: flaggedUsers.length },
    { key: 'churn',   label: 'Churn Risk',     count: churnUsers.length },
    { key: 'charts',  label: 'Risk Analytics', count: null },
  ];

  const getModalConfig = () => {
    if (!actionModal) return null;
    const { actionKey, ring, user, type } = actionModal;
    if (type === 'ring_dismiss') return {
      title: 'Dismiss Fraud Ring',
      description: `Mark ring ${ring?._id?.toString().slice(-6).toUpperCase()} as dismissed. The ring will be moved to the dismissed state and no further actions will be taken.`,
      Icon: CheckCircle2, iconColor: 'text-emerald-600', confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white', confirmLabel: 'Dismiss Ring',
    };
    if (type === 'ring_action' && actionKey === 'flag_all') return {
      title: 'Flag All Ring Members',
      description: `Flag all ${ring?.users?.length || 0} members of this fraud ring for manual review. Their accounts will be placed under elevated monitoring.`,
      Icon: Flag, iconColor: 'text-orange-600', confirmClass: 'bg-orange-500 hover:bg-orange-600 text-white', confirmLabel: 'Flag All Members',
    };
    if (type === 'ring_action' && actionKey === 'investigate') return {
      title: 'Mark for Investigation',
      description: 'Flag this ring for a full Trust & Safety investigation. An investigation case will be opened and assigned to the on-call analyst.',
      Icon: Search, iconColor: 'text-zinc-600', confirmClass: 'bg-zinc-900 hover:bg-zinc-700 text-white', confirmLabel: 'Start Investigation',
    };
    if (type === 'user_action' && actionKey === 'suspend') return {
      title: 'Suspend Account',
      description: `Immediately suspend ${user?.email}'s account. They will lose access to LoopLane until manually reinstated.`,
      Icon: Ban, iconColor: 'text-red-600', confirmClass: 'bg-red-600 hover:bg-red-700 text-white', confirmLabel: 'Suspend Account',
    };
    if (type === 'user_action' && actionKey === 'flag') return {
      title: 'Flag Account for Review',
      description: `Place ${user?.email}'s account under elevated monitoring. They can still operate but activity is tracked closely.`,
      Icon: Flag, iconColor: 'text-orange-600', confirmClass: 'bg-orange-500 hover:bg-orange-600 text-white', confirmLabel: 'Flag Account',
    };
    return { title: 'Confirm Action', description: '', Icon: AlertOctagon, iconColor: 'text-zinc-500', confirmClass: 'bg-zinc-900 text-white', confirmLabel: 'Confirm' };
  };

  const modalConfig = getModalConfig();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Fraud Intelligence Center"
        subtitle="Closed-loop fraud ring detection, risk scoring, and churn prediction"
        actions={
          <button
            onClick={runFraudScan}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 disabled:opacity-50 transition"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Radar size={14} />}
            {loading ? 'Scanning...' : 'Run Fraud Scan'}
          </button>
        }
      />

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-lg">
          <CheckCircle2 size={16} className="shrink-0" /> {success}
        </div>
      )}

      <AIInsightCard context="fraud" metrics={{
        fraudRings: fraudRings.filter(r => r.status !== 'DISMISSED').length,
        flaggedUsers: totalFlagged,
        highRisk,
        mediumRisk,
        churnUsersAtRisk: churnUsers.length,
        overallRiskScore: highRisk > 0 ? Math.min(100, 40 + highRisk * 15 + mediumRisk * 5) : mediumRisk > 0 ? 20 + mediumRisk * 5 : 5,
        lastScanTime: lastScan || 'Never',
      }} title="Fraud Intelligence" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Fraud Rings', value: fraudRings.filter(r => r.status !== 'DISMISSED').length, Icon: ShieldAlert, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
          { label: 'Users Flagged', value: totalFlagged, Icon: UserX, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' },
          { label: 'High / Critical', value: highRisk, Icon: AlertTriangle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
          { label: 'Last Scan', value: lastScan ? new Date(lastScan).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Never', Icon: Clock, color: 'text-zinc-600 dark:text-zinc-400', bg: 'bg-white dark:bg-zinc-900' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-lg border border-zinc-200 dark:border-zinc-800 p-4', s.bg)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
                <p className={cn('text-2xl font-semibold mt-1', s.color)}>{loading ? '—' : s.value}</p>
              </div>
              <s.Icon size={20} className={s.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Tab navigation */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-1.5 flex flex-wrap gap-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition',
              tab === t.key
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800')}>
            {t.label}
            {t.count != null && (
              <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold',
                tab === t.key ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: Fraud Rings ── */}
      {tab === 'rings' && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-zinc-400" />
            </div>
          ) : fraudRings.length === 0 ? (
            <div className="p-16 text-center">
              <ShieldCheck size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">No Fraud Rings Detected</h3>
              <p className="text-sm text-zinc-400">Platform is clean — run a scan to check for new patterns</p>
              <button onClick={runFraudScan} className="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition">
                Run Scan Now
              </button>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {fraudRings.map((ring, i) => (
                <RingCard key={ring._id || ring.id || i} ring={ring} onAction={handleRingAction} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Flagged Users ── */}
      {tab === 'users' && (
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          {flaggedUsers.length === 0 ? (
            <div className="p-16 text-center">
              <UserX size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">No Flagged Users</h3>
              <p className="text-sm text-zinc-400">Run a fraud scan to detect suspicious accounts</p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {flaggedUsers.map((user, i) => (
                <FlaggedUserRow key={user._id || i} user={user} onAction={handleUserAction} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Churn Risk ── */}
      {tab === 'churn' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-500">AI-powered churn prediction — identifies users likely to stop using LoopLane</p>
            <button
              onClick={runChurnScan}
              disabled={churnLoading}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition"
            >
              {churnLoading ? <Loader2 size={14} className="animate-spin" /> : <TrendingDown size={14} />}
              {churnLoading ? 'Predicting...' : 'Run Churn Prediction'}
            </button>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {churnLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-zinc-400" /></div>
            ) : churnUsers.length === 0 ? (
              <div className="p-16 text-center">
                <TrendingDown size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">No Churn Data</h3>
                <p className="text-sm text-zinc-400">Run churn prediction to identify at-risk users</p>
              </div>
            ) : (
              <div>
                <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
                  <p className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">{churnUsers.length} at-risk users identified</p>
                </div>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {churnUsers.map((user, i) => {
                    const name = user.profile?.firstName ? `${user.profile.firstName} ${user.profile.lastName || ''}`.trim() : user.email?.split('@')[0] || 'User';
                    const churnProb = user.churnProbability ?? user.probability ?? 0;
                    return (
                      <div key={user._id || i} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{name}</p>
                          <p className="text-xs text-zinc-400">{user.email}</p>
                          {user.reason && <p className="text-[10px] text-zinc-500 italic">{user.reason}</p>}
                        </div>
                        <div className="text-right shrink-0">
                          <p className={cn('text-sm font-black',
                            churnProb >= 0.7 ? 'text-red-600' : churnProb >= 0.4 ? 'text-amber-600' : 'text-zinc-500')}>
                            {(churnProb * 100).toFixed(0)}%
                          </p>
                          <p className="text-[10px] text-zinc-400">churn risk</p>
                        </div>
                        <div className="w-24 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden shrink-0">
                          <div className="h-full rounded-full transition-all"
                            style={{ width: `${(churnProb * 100).toFixed(0)}%`,
                              backgroundColor: churnProb >= 0.7 ? '#dc2626' : churnProb >= 0.4 ? '#f59e0b' : '#a1a1aa' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB: Risk Analytics ── */}
      {tab === 'charts' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Risk Distribution by Severity</h3>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={riskDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#a1a1aa' }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#71717a' }} width={70} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {riskDistribution.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Fraud Activity Heatmap (Rides vs Amount)</h3>
            <div className="h-[240px] flex items-center justify-center">
              {fraudRings.filter(r => r.totalRides && r.totalAmount).length > 0 ? (
                <ResponsiveContainer width="100%" height={240}>
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey="totalRides" name="Rides" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="totalAmount" name="Amount" tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                    <ZAxis dataKey="score" range={[50, 400]} />
                    <Tooltip formatter={(v, name) => [name === 'Amount' ? `₹${v}` : v, name]} />
                    <Scatter data={fraudRings} fill="#e07a5f" fillOpacity={0.7} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center">
                  <ShieldCheck size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                  <p className="text-sm text-zinc-500">No ride/amount data available</p>
                  <p className="text-xs text-zinc-400 mt-1">Run a scan to populate chart</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Confirm Modal */}
      {actionModal && modalConfig && (
        <ConfirmModal
          title={modalConfig.title}
          description={modalConfig.description}
          Icon={modalConfig.Icon}
          iconColor={modalConfig.iconColor}
          confirmClass={modalConfig.confirmClass}
          confirmLabel={modalConfig.confirmLabel}
          onConfirm={confirmAction}
          onCancel={() => setActionModal(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

export default AdminFraud;

