import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { cn } from '@/lib/utils';
import { AIInsightCard } from '../../components/admin';
import {
  MapPin, Shield, Loader2, ChevronLeft, ChevronRight, X, Ruler, Info,
  AlertTriangle, CheckCircle2, TrendingUp, Clock, ChevronDown, ChevronUp,
  Ban, Flag, ShieldAlert, ShieldCheck, RefreshCw, User, Route,
  AlertOctagon, TriangleAlert
} from 'lucide-react';

/* ── Constants ──────────────────────────────────────────────────────────────── */

const SEVERITY_STYLES = {
  CRITICAL: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  HIGH:     'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-800',
  MEDIUM:   'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-800',
  LOW:      'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
};

const STATUS_STYLES = {
  ACTIVE:            'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  ESCALATED:         'bg-purple-50 text-purple-700 ring-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:ring-purple-800',
  RESOLVED:          'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  RETURNED_TO_ROUTE: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
};

const ACTION_LABELS = {
  NO_ACTION:        { label: 'No Action Taken', color: 'text-zinc-500 dark:text-zinc-400' },
  WARNING_ISSUED:   { label: 'Warning Issued',   color: 'text-yellow-600 dark:text-yellow-400' },
  DRIVER_SUSPENDED: { label: 'Driver Suspended', color: 'text-red-600 dark:text-red-400' },
  ACCOUNT_FLAGGED:  { label: 'Account Flagged',  color: 'text-orange-600 dark:text-orange-400' },
  RESOLVED:         { label: 'Resolved',         color: 'text-emerald-600 dark:text-emerald-400' },
};

/* ── Action Modal ───────────────────────────────────────────────────────────── */

const ACTION_CONFIGS = {
  escalate: {
    title: 'Escalate to Critical',
    description: 'Marks the deviation as CRITICAL and sends an emergency real-time alert to the driver. Use when the driver appears to be in danger or acting suspiciously.',
    Icon: AlertOctagon,
    iconColor: 'text-purple-600 dark:text-purple-400',
    confirmClass: 'bg-purple-600 hover:bg-purple-700 text-white',
    confirmLabel: 'Escalate Now',
    requiresNotes: false,
  },
  warn: {
    title: 'Issue Driver Warning',
    description: 'Issues an official warning logged on the driver\'s profile. The deviation is marked resolved with a WARNING_ISSUED outcome.',
    Icon: TriangleAlert,
    iconColor: 'text-yellow-600 dark:text-yellow-400',
    confirmClass: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    confirmLabel: 'Issue Warning',
    requiresNotes: true,
  },
  dismiss: {
    title: 'Dismiss Deviation',
    description: 'Marks the deviation resolved with No Action Taken. Use for false positives or minor self-corrected deviations.',
    Icon: CheckCircle2,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    confirmLabel: 'Dismiss',
    requiresNotes: false,
  },
  suspend: {
    title: 'Suspend Driver Account',
    description: 'Immediately suspends the driver\'s account. Severe action — use only for dangerous or repeated deviations. The driver loses platform access.',
    Icon: Ban,
    iconColor: 'text-red-600 dark:text-red-400',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    confirmLabel: 'Suspend Driver',
    requiresNotes: true,
  },
  flag: {
    title: 'Flag Account for Review',
    description: 'Places the driver under elevated monitoring. They can still operate, but future activity is tracked more closely. Good for repeat offenders.',
    Icon: Flag,
    iconColor: 'text-orange-600 dark:text-orange-400',
    confirmClass: 'bg-orange-500 hover:bg-orange-600 text-white',
    confirmLabel: 'Flag Account',
    requiresNotes: true,
  },
  resolve: {
    title: 'Mark as Resolved',
    description: 'Closes the deviation case without applying a driver penalty. Appropriate after an investigation or when the situation has been addressed.',
    Icon: ShieldCheck,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    confirmLabel: 'Mark Resolved',
    requiresNotes: false,
  },
};

const ActionModal = ({ deviation, actionKey, onConfirm, onCancel, loading }) => {
  const [notes, setNotes] = useState('');
  const cfg = ACTION_CONFIGS[actionKey];
  if (!cfg) return null;

  const driverName = `${deviation.driver?.profile?.firstName || ''} ${deviation.driver?.profile?.lastName || ''}`.trim() || 'Unknown Driver';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={onCancel}>
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
            <cfg.Icon size={18} className={cfg.iconColor} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{cfg.title}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Applying to: <span className="font-medium text-zinc-700 dark:text-zinc-300">{driverName}</span>
              {deviation.driver?.phone && <span className="ml-1 text-zinc-400">({deviation.driver.phone})</span>}
            </p>
          </div>
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{cfg.description}</p>

          {/* Deviation summary */}
          <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Deviation distance</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{deviation.deviationDistance}m off-route</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Severity</span>
              <span className={cn('font-medium',
                deviation.severity === 'CRITICAL' ? 'text-red-600 dark:text-red-400' :
                deviation.severity === 'HIGH'     ? 'text-orange-600 dark:text-orange-400' :
                'text-yellow-600 dark:text-yellow-400'
              )}>{deviation.severity}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Current status</span>
              <span className={cn('font-medium',
                deviation.status === 'ESCALATED' ? 'text-purple-600 dark:text-purple-400' : 'text-red-600 dark:text-red-400'
              )}>{deviation.status}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Admin Notes
              {cfg.requiresNotes
                ? <span className="text-red-500 ml-0.5">*</span>
                : <span className="text-zinc-400 font-normal ml-1">(optional)</span>}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={`Reason for ${cfg.title.toLowerCase()}...`}
              className="w-full px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-5 pb-5">
          <button onClick={onCancel} disabled={loading}
            className="px-4 py-2 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(notes)}
            disabled={loading || (cfg.requiresNotes && !notes.trim())}
            className={cn('px-4 py-2 text-xs font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5', cfg.confirmClass)}>
            {loading && <Loader2 size={12} className="animate-spin" />}
            {cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Status-aware Action Row ────────────────────────────────────────────────── */

const ActionRow = ({ deviation, onAction }) => {
  const { status } = deviation;

  if (status === 'ACTIVE') {
    return (
      <div className="flex flex-wrap gap-1.5 ml-4 shrink-0">
        <button onClick={() => onAction(deviation, 'escalate')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center gap-1">
          <AlertOctagon size={11} /> Escalate
        </button>
        <button onClick={() => onAction(deviation, 'warn')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-yellow-500 hover:bg-yellow-600 text-white transition-colors flex items-center gap-1">
          <TriangleAlert size={11} /> Warn Driver
        </button>
        <button onClick={() => onAction(deviation, 'dismiss')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          Dismiss
        </button>
      </div>
    );
  }

  if (status === 'ESCALATED') {
    return (
      <div className="flex flex-wrap gap-1.5 ml-4 shrink-0">
        <button onClick={() => onAction(deviation, 'warn')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-yellow-500 hover:bg-yellow-600 text-white transition-colors flex items-center gap-1">
          <TriangleAlert size={11} /> Issue Warning
        </button>
        <button onClick={() => onAction(deviation, 'suspend')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1">
          <Ban size={11} /> Suspend
        </button>
        <button onClick={() => onAction(deviation, 'flag')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-orange-500 hover:bg-orange-600 text-white transition-colors flex items-center gap-1">
          <Flag size={11} /> Flag Account
        </button>
        <button onClick={() => onAction(deviation, 'resolve')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1">
          <ShieldCheck size={11} /> Mark Resolved
        </button>
      </div>
    );
  }

  /* RESOLVED / RETURNED_TO_ROUTE — show outcome */
  const reviewAction = deviation.adminReview?.action;
  if (reviewAction && ACTION_LABELS[reviewAction]) {
    const { label, color } = ACTION_LABELS[reviewAction];
    return (
      <div className="ml-4 shrink-0 text-right">
        <span className={cn('text-[11px] font-medium flex items-center gap-1 justify-end', color)}>
          <ShieldCheck size={11} /> {label}
        </span>
        {deviation.adminReview?.notes && (
          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 max-w-[200px]">{deviation.adminReview.notes}</p>
        )}
      </div>
    );
  }

  return null;
};

/* ── Deviation Card ─────────────────────────────────────────────────────────── */

const DeviationCard = ({ dev, onAction }) => {
  const [expanded, setExpanded] = useState(false);
  const canExpand = dev.driverExplanation || dev.adminReview?.notes || (dev.metadata && Object.values(dev.metadata).some(v => v != null));

  return (
    <div className={cn(
      'bg-white dark:bg-zinc-900 rounded-lg border transition-colors',
      dev.status === 'ESCALATED'
        ? 'border-purple-200 dark:border-purple-800/60 shadow-sm shadow-purple-100 dark:shadow-purple-900/20'
        : dev.status === 'ACTIVE'
        ? 'border-red-200 dark:border-red-800/60'
        : 'border-zinc-200 dark:border-zinc-800'
    )}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Badges row */}
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1 ring-inset', SEVERITY_STYLES[dev.severity] || SEVERITY_STYLES.LOW)}>
                {dev.severity}
              </span>
              <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1 ring-inset', STATUS_STYLES[dev.status] || '')}>
                {dev.status.replace(/_/g, ' ')}
              </span>
              {dev.deviationType && dev.deviationType !== 'ROUTE_DEVIATION' && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {dev.deviationType.replace(/_/g, ' ')}
                </span>
              )}
              {dev.deviationDistance && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Ruler size={10} /> {dev.deviationDistance}m off-route
                </span>
              )}
            </div>

            {/* Driver */}
            <div className="flex items-center gap-1.5 text-sm text-zinc-800 dark:text-zinc-200 mb-1">
              <User size={12} className="text-zinc-400 shrink-0" />
              <span className="font-medium">{dev.driver?.profile?.firstName} {dev.driver?.profile?.lastName}</span>
              {dev.driver?.phone && <span className="text-zinc-400 text-xs">({dev.driver.phone})</span>}
            </div>

            {/* Route */}
            {dev.ride && (
              <div className="flex items-start gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                <Route size={11} className="shrink-0 mt-0.5 text-zinc-400" />
                <span>
                  {dev.ride.route?.start?.address || dev.ride.route?.start?.name || 'Unknown origin'}
                  {' → '}
                  {dev.ride.route?.destination?.address || dev.ride.route?.destination?.name || 'Unknown destination'}
                </span>
              </div>
            )}

            {/* Time + meta */}
            <div className="flex items-center flex-wrap gap-3 text-[10px] text-zinc-400 mt-1">
              <span className="flex items-center gap-1">
                <Clock size={9} /> Detected: {new Date(dev.deviatedAt).toLocaleString()}
              </span>
              {dev.duration > 0 && (
                <span>Duration: {Math.floor(dev.duration / 60)}m {dev.duration % 60}s</span>
              )}
              {dev.returnedToRoute && (
                <span className="text-blue-500 font-medium flex items-center gap-1">
                  <RefreshCw size={9} /> Self-corrected
                </span>
              )}
            </div>
          </div>

          <ActionRow deviation={dev} onAction={onAction} />
        </div>

        {/* Expand toggle */}
        {canExpand && (
          <button onClick={() => setExpanded(v => !v)}
            className="mt-2 flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? 'Hide details' : 'View details'}
          </button>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 px-4 pb-4 pt-3 space-y-3">
          {dev.driverExplanation && (
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Driver Explanation</p>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 rounded p-2 leading-relaxed">{dev.driverExplanation}</p>
            </div>
          )}
          {dev.adminReview?.notes && (
            <div>
              <p className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">Admin Notes</p>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800 rounded p-2 leading-relaxed">{dev.adminReview.notes}</p>
            </div>
          )}
          {dev.adminReview?.reviewedBy && (
            <p className="text-[10px] text-zinc-400">
              Reviewed by {dev.adminReview.reviewedBy?.profile?.firstName || 'Admin'} · {new Date(dev.adminReview.reviewedAt).toLocaleString()}
            </p>
          )}
          {dev.metadata && (
            <div className="flex flex-wrap gap-4 text-[10px] text-zinc-500">
              {dev.metadata.speed     != null && <span>Speed: <strong>{dev.metadata.speed}</strong> km/h</span>}
              {dev.metadata.routeProgress != null && <span>Route progress: <strong>{Math.round(dev.metadata.routeProgress)}%</strong></span>}
              {dev.metadata.estimatedDelay != null && <span>Est. delay: <strong>{dev.metadata.estimatedDelay}m</strong></span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Main Page ──────────────────────────────────────────────────────────────── */

const AdminGeoFencing = () => {
  const [deviations, setDeviations]     = useState([]);
  const [stats, setStats]               = useState([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [statusCounts, setStatusCounts] = useState({ ACTIVE: 0, ESCALATED: 0, RESOLVED: 0 });
  const [loading, setLoading]           = useState(true);
  const [filter, setFilter]             = useState({ severity: '', status: '' });
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [modal, setModal]               = useState(null); // { deviation, actionKey }
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDeviations = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit: 10 };
      if (filter.severity) params.severity = filter.severity;
      if (filter.status)   params.status   = filter.status;
      const [pageRes, allRes] = await Promise.all([
        api.get('/api/admin/deviations', { params }),
        api.get('/api/admin/deviations', { params: { limit: 1000 } }),
      ]);
      if (pageRes.data.success) {
        setDeviations(pageRes.data.deviations || []);
        setStats(pageRes.data.stats || []);
        setUnresolvedCount(pageRes.data.unresolvedCount || 0);
        setTotalPages(pageRes.data.pagination?.pages || 1);
      }
      if (allRes.data.success) {
        const all = allRes.data.deviations || [];
        setStatusCounts({
          ACTIVE:    all.filter(d => d.status === 'ACTIVE').length,
          ESCALATED: all.filter(d => d.status === 'ESCALATED').length,
          RESOLVED:  all.filter(d => d.status === 'RESOLVED' || d.status === 'RETURNED_TO_ROUTE').length,
        });
      }
    } catch (_) { /* silent */ }
    finally { setLoading(false); }
  }, [page, filter]);

  useEffect(() => { fetchDeviations(); }, [fetchDeviations]);

  /* Action API map */
  const ACTION_API = {
    escalate: (id)        => api.post(`/api/admin/deviations/${id}/escalate`),
    warn:     (id, notes) => api.post(`/api/admin/deviations/${id}/resolve`, { action: 'WARNING_ISSUED',    notes: notes || 'Warning issued by admin' }),
    dismiss:  (id, notes) => api.post(`/api/admin/deviations/${id}/resolve`, { action: 'NO_ACTION',        notes: notes || 'Dismissed — no action required' }),
    suspend:  (id, notes) => api.post(`/api/admin/deviations/${id}/resolve`, { action: 'DRIVER_SUSPENDED', notes: notes || 'Driver suspended by admin' }),
    flag:     (id, notes) => api.post(`/api/admin/deviations/${id}/resolve`, { action: 'ACCOUNT_FLAGGED',  notes: notes || 'Account flagged for monitoring' }),
    resolve:  (id, notes) => api.post(`/api/admin/deviations/${id}/resolve`, { action: 'RESOLVED',         notes: notes || 'Resolved by admin' }),
  };

  const handleOpenAction = (deviation, actionKey) => setModal({ deviation, actionKey });

  const handleConfirmAction = async (notes) => {
    if (!modal) return;
    setActionLoading(true);
    try {
      await ACTION_API[modal.actionKey](modal.deviation._id, notes);
      setModal(null);
      await fetchDeviations();
    } catch (err) {
      console.error('Geo-fencing action failed:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const statCards = [
    { label: 'Unresolved Alerts', value: unresolvedCount,       color: 'text-red-600 dark:text-red-400',     Icon: ShieldAlert },
    { label: 'Active',            value: statusCounts.ACTIVE,    color: 'text-orange-600 dark:text-orange-400', Icon: AlertTriangle },
    { label: 'Escalated',         value: statusCounts.ESCALATED, color: 'text-purple-600 dark:text-purple-400', Icon: TrendingUp },
    { label: 'Resolved',          value: statusCounts.RESOLVED,  color: 'text-emerald-600 dark:text-emerald-400', Icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <MapPin size={18} /> Geo-Fencing &amp; Route Monitoring
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Monitor route deviations, safe zones, and driver compliance</p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">

        <AIInsightCard context="geoFencing" metrics={{
          totalDeviations: deviations.length,
          unresolvedDeviations: unresolvedCount,
          activeDeviations: statusCounts.ACTIVE || 0,
          escalatedDeviations: statusCounts.ESCALATED || 0,
          resolvedDeviations: statusCounts.RESOLVED || 0,
          activeZones: stats.length || 0,
        }} title="Geo-Fencing Intelligence" />

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statCards.map(({ label, value, color, Icon }) => (
            <div key={label} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                <Icon size={16} className={color} />
              </div>
              <div>
                <p className={cn('text-xl font-bold', color)}>{value}</p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Severity aggregation */}
        {stats.length > 0 && (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {stats.map((s, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 text-center">
                <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200">{s.count}</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">{s._id || 'Unknown'}</p>
                <p className="text-[9px] text-zinc-400">{Math.round(s.avgDistance || 0)}m avg</p>
              </div>
            ))}
          </div>
        )}

        {/* Thresholds */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <h3 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
            <Info size={12} /> Deviation Severity Thresholds
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'Low',      dist: '< 500m',    bg: 'bg-blue-50 dark:bg-blue-900/10',   border: 'border-blue-200 dark:border-blue-800',     text: 'text-blue-700 dark:text-blue-400',   sub: 'text-blue-600 dark:text-blue-500' },
              { label: 'Medium',   dist: '500–1 km',  bg: 'bg-yellow-50 dark:bg-yellow-900/10', border: 'border-yellow-200 dark:border-yellow-800', text: 'text-yellow-700 dark:text-yellow-400', sub: 'text-yellow-600 dark:text-yellow-500' },
              { label: 'High',     dist: '1–2 km',    bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-200 dark:border-orange-800', text: 'text-orange-700 dark:text-orange-400', sub: 'text-orange-600 dark:text-orange-500' },
              { label: 'Critical', dist: '> 2 km',    bg: 'bg-red-50 dark:bg-red-900/10',     border: 'border-red-200 dark:border-red-800',       text: 'text-red-700 dark:text-red-400',     sub: 'text-red-600 dark:text-red-500' },
            ].map(({ label, dist, bg, border, text, sub }) => (
              <div key={label} className={cn('p-2.5 rounded-md border text-center', bg, border)}>
                <p className={cn('text-sm font-bold', text)}>{dist}</p>
                <p className={cn('text-[10px]', sub)}>{label} Deviation</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <select value={filter.severity}
              onChange={(e) => { setFilter(f => ({ ...f, severity: e.target.value })); setPage(1); }}
              className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400">
              <option value="">All Severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <select value={filter.status}
              onChange={(e) => { setFilter(f => ({ ...f, status: e.target.value })); setPage(1); }}
              className="px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400">
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="ESCALATED">Escalated</option>
              <option value="RESOLVED">Resolved</option>
              <option value="RETURNED_TO_ROUTE">Returned to Route</option>
            </select>
            {(filter.severity || filter.status) && (
              <button onClick={() => { setFilter({ severity: '', status: '' }); setPage(1); }}
                className="flex items-center gap-1 px-3 py-1.5 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                <X size={13} /> Clear filters
              </button>
            )}
            <button onClick={fetchDeviations}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Status legend */}
        <div className="flex flex-wrap gap-4 text-[11px] text-zinc-500 dark:text-zinc-400 px-1">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> ACTIVE — awaiting admin action</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> ESCALATED — critical, forceful action available</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> RETURNED — driver self-corrected</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> RESOLVED — case closed</span>
        </div>

        {/* Deviations */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-zinc-400" /></div>
        ) : deviations.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-14 text-center">
            <Shield size={30} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No deviations found</p>
            <p className="text-xs text-zinc-400 mt-1">All routes are within safe parameters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {deviations.map(dev => (
              <DeviationCard key={dev._id} dev={dev} onAction={handleOpenAction} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-md disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-md disabled:opacity-40 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Action Confirmation Modal */}
      {modal && (
        <ActionModal
          deviation={modal.deviation}
          actionKey={modal.actionKey}
          onConfirm={handleConfirmAction}
          onCancel={() => setModal(null)}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

export default AdminGeoFencing;
