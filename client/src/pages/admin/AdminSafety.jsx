import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, ShieldCheck, Loader2, X, MapPin,
  User, Phone, Mail, Clock, ChevronDown, ChevronUp, Shield,
  AlertOctagon, XCircle, RefreshCw, ChevronLeft, ChevronRight,
  Siren, Ambulance, Flame, Activity
} from 'lucide-react';
import { AdminPageHeader, AIInsightCard } from '../../components/admin';

/* ── Constants ──────────────────────────────────────────────────────────────────────────────── */

const STATUS_STYLES = {
  ACTIVE:       'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  ACKNOWLEDGED: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
  RESOLVED:     'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800',
  CANCELLED:    'bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
};

const SEVERITY_STYLES = {
  CRITICAL: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
  HIGH:     'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-800',
  MODERATE: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:ring-amber-800',
  LOW:      'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800',
};

const TYPE_ICONS = {
  SOS:      Siren,
  ACCIDENT: AlertOctagon,
  MEDICAL:  Ambulance,
  SAFETY:   Shield,
  OTHER:    AlertTriangle,
};

/* ── Action Configurations ──────────────────────────────────────────────────────────── */

const ACTION_CONFIGS = {
  acknowledge: {
    title: 'Acknowledge Alert',
    description: 'Acknowledge that you are aware of this emergency and are actively monitoring the situation. The status will move to ACKNOWLEDGED.',
    Icon: CheckCircle2,
    iconColor: 'text-amber-600 dark:text-amber-400',
    confirmClass: 'bg-amber-500 hover:bg-amber-600 text-white',
    confirmLabel: 'Acknowledge',
    targetStatus: 'ACKNOWLEDGED',
    requiresNotes: false,
  },
  escalate: {
    title: 'Escalate to Critical',
    description: 'Bumps this emergency to CRITICAL severity. All platform admins will be notified. The user\'s emergency contacts will be re-alerted. A permanent escalation record is saved with: timestamp, escalating admin, reason, and the full list of who was notified.',
    Icon: AlertOctagon,
    iconColor: 'text-red-600 dark:text-red-400',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    confirmLabel: 'Escalate — Notify All Admins',
    targetStatus: 'ACKNOWLEDGED',
    requiresNotes: false,
  },
  resolve: {
    title: 'Resolve Alert',
    description: 'Close this emergency alert as successfully handled. The situation has been addressed and no further action is required.',
    Icon: ShieldCheck,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    confirmLabel: 'Mark Resolved',
    targetStatus: 'RESOLVED',
    requiresNotes: false,
  },
  false_alarm: {
    title: 'Mark as False Alarm',
    description: 'Cancel this alert as a false alarm or accidental trigger. The user will be notified and the alert will be closed.',
    Icon: XCircle,
    iconColor: 'text-zinc-500 dark:text-zinc-400',
    confirmClass: 'bg-zinc-600 hover:bg-zinc-700 text-white',
    confirmLabel: 'Mark False Alarm',
    targetStatus: 'CANCELLED',
    requiresNotes: false,
  },
};

/* ── Action Modal ────────────────────────────────────────────────────────────────────────────── */

const ActionModal = ({ emergency, actionKey, onConfirm, onCancel, loading }) => {
  const [notes, setNotes] = useState('');
  const cfg = ACTION_CONFIGS[actionKey];
  if (!cfg) return null;

  const userName = emergency.user?.profile?.firstName
    ? `${emergency.user.profile.firstName} ${emergency.user.profile.lastName || ''}`.trim()
    : emergency.user?.email?.split('@')[0] || 'Unknown User';

  const handleConfirm = () => {
    const finalNotes = cfg.notePrefix ? cfg.notePrefix + notes : notes;
    onConfirm(cfg.targetStatus, finalNotes);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      onClick={onCancel}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5 border-b border-zinc-100 dark:border-zinc-800">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
            <cfg.Icon size={18} className={cfg.iconColor} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{cfg.title}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              For: <span className="font-medium text-zinc-700 dark:text-zinc-300">{userName}</span>
              {emergency.user?.phone && (
                <span className="ml-1 text-zinc-400">({emergency.user.phone})</span>
              )}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{cfg.description}</p>

          <div className="bg-zinc-50 dark:bg-zinc-800/60 rounded-lg p-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Alert type</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{emergency.type}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Severity</span>
              <span className={cn('font-medium',
                emergency.severity === 'CRITICAL' ? 'text-red-600 dark:text-red-400' :
                emergency.severity === 'HIGH'     ? 'text-orange-600 dark:text-orange-400' :
                emergency.severity === 'MODERATE' ? 'text-amber-600 dark:text-amber-400' :
                'text-blue-600 dark:text-blue-400'
              )}>{emergency.severity}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-zinc-500">Current status</span>
              <span className={cn('font-medium',
                emergency.status === 'ACTIVE' ? 'text-red-600 dark:text-red-400' :
                'text-amber-600 dark:text-amber-400'
              )}>{emergency.status}</span>
            </div>
            {emergency.location?.address && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Location</span>
                <span className="font-medium text-zinc-800 dark:text-zinc-200 text-right max-w-[60%] truncate">
                  {emergency.location.address}
                </span>
              </div>
            )}
          </div>

          {actionKey === 'escalate' && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
              <p className="text-[11px] font-bold text-red-700 dark:text-red-400 mb-2 flex items-center gap-1.5">
                <AlertOctagon size={12} /> WHO GETS NOTIFIED
              </p>
              <div className="space-y-1 text-[11px] text-red-600 dark:text-red-300">
                <div className="flex items-start gap-1.5"><span>&#8594;</span><span>All platform admins — immediate email alert</span></div>
                <div className="flex items-start gap-1.5"><span>&#8594;</span><span>User's emergency contacts — re-notified immediately</span></div>
                <div className="flex items-start gap-1.5"><span>&#8594;</span><span>Escalation log saved: timestamp, your name, reason, full recipient list</span></div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              {actionKey === 'escalate' ? 'Reason for Escalation' : 'Admin Notes'}
              {cfg.requiresNotes
                ? <span className="text-red-500 ml-0.5">*</span>
                : <span className="text-zinc-400 font-normal ml-1">(optional)</span>}
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={actionKey === 'escalate'
                ? 'Reason for escalation... e.g. "User unresponsive, suspected accident on Ring Road"'
                : `Notes for ${cfg.title.toLowerCase()}...`}
              className="w-full px-3 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-400 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end px-5 pb-5">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || (cfg.requiresNotes && !notes.trim())}
            className={cn('px-4 py-2 text-xs font-medium rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5', cfg.confirmClass)}
          >
            {loading && <Loader2 size={12} className="animate-spin" />}
            {cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Status-aware Action Row ──────────────────────────────────────────────────────────── */

const ActionRow = ({ emergency, onAction }) => {
  const { status } = emergency;

  if (status === 'ACTIVE') {
    return (
      <div className="flex flex-wrap gap-1.5 ml-4 shrink-0">
        <button
          onClick={() => onAction(emergency, 'acknowledge')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center gap-1"
        >
          <CheckCircle2 size={11} /> Acknowledge
        </button>
        <button
          onClick={() => onAction(emergency, 'escalate')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1"
        >
          <AlertOctagon size={11} /> Escalate Critical
        </button>
        <button
          onClick={() => onAction(emergency, 'false_alarm')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
        >
          <XCircle size={11} /> False Alarm
        </button>
      </div>
    );
  }

  if (status === 'ACKNOWLEDGED') {
    const notYetEscalated = !emergency.escalation?.level;
    return (
      <div className="flex flex-wrap gap-1.5 ml-4 shrink-0">
        <button
          onClick={() => onAction(emergency, 'resolve')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-1"
        >
          <ShieldCheck size={11} /> Resolve Alert
        </button>
        {notYetEscalated && (
          <button
            onClick={() => onAction(emergency, 'escalate')}
            className="px-2.5 py-1.5 text-[11px] font-medium rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors flex items-center gap-1"
          >
            <AlertOctagon size={11} /> Escalate
          </button>
        )}
        <button
          onClick={() => onAction(emergency, 'false_alarm')}
          className="px-2.5 py-1.5 text-[11px] font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1"
        >
          <XCircle size={11} /> Cancel
        </button>
      </div>
    );
  }

  const isResolved = status === 'RESOLVED';
  return (
    <div className="ml-4 shrink-0 flex items-center gap-1.5 text-xs">
      {isResolved
        ? <><ShieldCheck size={13} className="text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400 font-medium">Resolved</span></>
        : <><XCircle size={13} className="text-zinc-400" /><span className="text-zinc-500 font-medium">Cancelled</span></>
      }
    </div>
  );
};

/* ── Emergency Card ────────────────────────────────────────────────────────────────────────────── */

const EmergencyCard = ({ emergency, onAction }) => {
  const [expanded, setExpanded] = useState(false);
  const TypeIcon = TYPE_ICONS[emergency.type] || AlertTriangle;
  const isCritical = emergency.severity === 'CRITICAL';
  const isActive = emergency.status === 'ACTIVE';

  const formatDate = (d) => d
    ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  const mapsUrl = emergency.location?.coordinates?.coordinates?.length === 2
    ? `https://www.google.com/maps?q=${emergency.location.coordinates.coordinates[1]},${emergency.location.coordinates.coordinates[0]}`
    : null;

  const userName = emergency.user?.profile?.firstName
    ? `${emergency.user.profile.firstName} ${emergency.user.profile.lastName || ''}`.trim()
    : emergency.user?.email?.split('@')[0] || 'Unknown';

  return (
    <div
      className={cn(
        'border-l-4 bg-white dark:bg-zinc-900 transition',
        isActive && isCritical ? 'border-l-red-600 bg-red-50/30 dark:bg-red-900/10' :
        isActive              ? 'border-l-red-400' :
        emergency.status === 'ACKNOWLEDGED' ? 'border-l-amber-400' :
        emergency.status === 'RESOLVED'     ? 'border-l-emerald-400' :
        'border-l-zinc-300 dark:border-l-zinc-700'
      )}
    >
      <div className="px-4 py-4 flex items-start gap-3">
        <div className={cn('shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
          isActive ? 'bg-red-100 dark:bg-red-900/30' : 'bg-zinc-100 dark:bg-zinc-800')}>
          <TypeIcon size={17} className={isActive ? 'text-red-600 dark:text-red-400' : 'text-zinc-500 dark:text-zinc-400'} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className={cn('px-1.5 py-0.5 text-[10px] font-bold rounded-md ring-1 ring-inset', STATUS_STYLES[emergency.status] || STATUS_STYLES.CANCELLED)}>
              {emergency.status}
            </span>
            <span className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded-md ring-1 ring-inset', SEVERITY_STYLES[emergency.severity] || SEVERITY_STYLES.LOW)}>
              {emergency.severity}
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-md bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              {emergency.type}
            </span>
            {isCritical && isActive && (
              <span className="px-1.5 py-0.5 text-[10px] font-black rounded-md bg-red-600 text-white animate-pulse">
                CRITICAL — IMMEDIATE ACTION
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400 mb-2">
            <span className="flex items-center gap-1"><User size={12} /> {userName}</span>
            {emergency.user?.email && (
              <span className="flex items-center gap-1"><Mail size={12} /> {emergency.user.email}</span>
            )}
            {emergency.user?.phone && (
              <span className="flex items-center gap-1"><Phone size={12} /> {emergency.user.phone}</span>
            )}
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">
            <MapPin size={11} className="inline mr-1" />
            {emergency.location?.address || 'Location not available'}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-zinc-700 dark:text-zinc-300 underline hover:no-underline"
              >
                View Map
              </a>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px] text-zinc-400">
            <span className="flex items-center gap-1"><Clock size={10} /> Triggered {formatDate(emergency.triggeredAt)}</span>
            {emergency.acknowledgedAt && <span>Acknowledged {formatDate(emergency.acknowledgedAt)}</span>}
            {emergency.resolvedAt && <span>Resolved {formatDate(emergency.resolvedAt)}</span>}
          </div>

          {emergency.adminNotes && (
            <div className="mt-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-md text-xs text-zinc-600 dark:text-zinc-400 border border-zinc-100 dark:border-zinc-700">
              <span className="font-semibold text-zinc-700 dark:text-zinc-300">Admin note:</span> {emergency.adminNotes}
            </div>
          )}

          {emergency.escalation?.level > 0 && (
            <div className="mt-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-200 dark:border-red-800">
              <p className="text-[11px] font-black text-red-700 dark:text-red-400">
                &#x26A1; ESCALATED L{emergency.escalation.level}
                {emergency.escalation.escalatedAt && (
                  <span className="font-normal ml-1">&mdash; {formatDate(emergency.escalation.escalatedAt)}</span>
                )}
              </p>
              {emergency.escalation.reason && (
                <p className="text-[10px] text-red-600 dark:text-red-300 mt-0.5">{emergency.escalation.reason}</p>
              )}
              {emergency.escalation.notifiedTo?.length > 0 && (
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Notified {emergency.escalation.notifiedTo.length} recipient{emergency.escalation.notifiedTo.length !== 1 ? 's' : ''} &mdash;{' '}
                  {emergency.escalation.notifiedTo.filter(e => e.startsWith('admin:')).length} admin(s),{' '}
                  {emergency.escalation.notifiedTo.filter(e => e.startsWith('contact:')).length} emergency contact(s)
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-2 flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Less detail' : 'More detail'}
          </button>
        </div>

        <ActionRow emergency={emergency} onAction={onAction} />
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-zinc-100 dark:border-zinc-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            {emergency.contacts?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Notified Contacts ({emergency.contacts.length})</p>
                <div className="space-y-1.5">
                  {emergency.contacts.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                      <User size={11} className="text-zinc-400" />
                      <span className="font-medium">{c.name}</span>
                      {c.email && <span className="text-zinc-400">{c.email}</span>}
                      {c.phone && <span className="text-zinc-400">{c.phone}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {emergency.responder && (
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Assigned Responder</p>
                <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-3 py-1.5 rounded-md">
                  <Shield size={11} className="text-zinc-500" />
                  <span>
                    {emergency.responder?.profile?.firstName
                      ? `${emergency.responder.profile.firstName} ${emergency.responder.profile.lastName || ''}`.trim()
                      : emergency.responder?.email || 'Admin'}
                  </span>
                </div>
              </div>
            )}

            {emergency.deviceInfo && (
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Device Info</p>
                <div className="space-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {emergency.deviceInfo.platform && <p>Platform: <span className="text-zinc-700 dark:text-zinc-300 font-medium">{emergency.deviceInfo.platform}</span></p>}
                  {emergency.deviceInfo.language && <p>Language: <span className="text-zinc-700 dark:text-zinc-300 font-medium">{emergency.deviceInfo.language}</span></p>}
                </div>
              </div>
            )}

            {emergency.description && emergency.description !== 'Emergency alert sent by user' && (
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Description</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 rounded-md leading-relaxed">
                  {emergency.description}
                </p>
              </div>
            )}

            {emergency.notifications?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Notifications Sent ({emergency.notifications.length})</p>
                <div className="space-y-1">
                  {emergency.notifications.map((n, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px] text-zinc-500 bg-zinc-50 dark:bg-zinc-800 px-3 py-1 rounded-md">
                      <span className="font-medium">{n.channel}</span>
                      <span className="truncate max-w-[60%] text-right">{n.target}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Stat Defs & Page Size ──────────────────────────────────────────────────────────── */

const STAT_DEFS = [
  { key: 'ACTIVE',       label: 'Active Alerts',   Icon: Flame,       color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-50 dark:bg-red-900/20' },
  { key: 'ACKNOWLEDGED', label: 'Acknowledged',     Icon: Activity,    color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { key: 'RESOLVED',     label: 'Resolved',         Icon: ShieldCheck, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
  { key: 'CANCELLED',    label: 'Cancelled',        Icon: XCircle,     color: 'text-zinc-500 dark:text-zinc-400',       bg: 'bg-zinc-50 dark:bg-zinc-800' },
  { key: 'total',        label: 'Total Alerts',     Icon: Shield,      color: 'text-zinc-700 dark:text-zinc-300',       bg: 'bg-white dark:bg-zinc-900' },
];

const PAGE_SIZE = 15;

const AdminSafety = () => {
  const [emergencies, setEmergencies] = useState([]);
  const [stats, setStats] = useState({ total: 0, ACTIVE: { count: 0 }, ACKNOWLEDGED: { count: 0 }, RESOLVED: { count: 0 }, CANCELLED: { count: 0 } });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('all');
  const [modal, setModal] = useState(null); // { emergency, actionKey }
  const [page, setPage] = useState(1);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const endpoint = filter === 'active' ? '/api/sos/admin/active' : '/api/sos/admin/all';
      const [emRes, stRes] = await Promise.all([
        api.get(endpoint),
        api.get('/api/sos/admin/stats'),
      ]);
      if (emRes.data.success)  setEmergencies(emRes.data.emergencies || []);
      if (stRes.data.success)  setStats(stRes.data.stats || { total: 0, ACTIVE: { count: 0 }, ACKNOWLEDGED: { count: 0 }, RESOLVED: { count: 0 }, CANCELLED: { count: 0 } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load safety alerts');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setPage(1);
    fetchData();
  }, [fetchData]);

  const handleOpenAction = (emergency, actionKey) => setModal({ emergency, actionKey });
  const handleCloseModal = () => setModal(null);

  const handleConfirmAction = async (targetStatus, notes) => {
    if (!modal) return;
    try {
      setActionLoading(true);
      if (modal.actionKey === 'escalate') {
        // Use dedicated escalation endpoint — not the generic update.
        // This notifies all admins + emergency contacts and records the escalation chain.
        const res = await api.post(`/api/sos/admin/${modal.emergency._id}/escalate`, {
          reason: notes || undefined,
        });
        const n = res.data.notifiedCount ?? 0;
        setSuccess(`Escalated to CRITICAL — ${n} recipient${n !== 1 ? 's' : ''} notified (admins + emergency contacts)`);
      } else {
        await api.post(`/api/sos/admin/${modal.emergency._id}/update`, {
          status: targetStatus,
          adminNotes: notes || undefined,
        });
        setSuccess(`Alert ${targetStatus.toLowerCase()} successfully`);
      }
      setModal(null);
      fetchData();
      setTimeout(() => setSuccess(''), 6000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update alert');
    } finally {
      setActionLoading(false);
    }
  };

  // Sort: ACTIVE first → CRITICAL severity → ACKNOWLEDGED → others
  const sorted = [...emergencies].sort((a, b) => {
    const statusOrder = { ACTIVE: 0, ACKNOWLEDGED: 1, RESOLVED: 2, CANCELLED: 3 };
    const severityOrder = { CRITICAL: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
    if (statusOrder[a.status] !== statusOrder[b.status]) return statusOrder[a.status] - statusOrder[b.status];
    return severityOrder[a.severity] - severityOrder[b.severity];
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeCount = (stats.ACTIVE?.count || 0) + (stats.ACKNOWLEDGED?.count || 0);

  const FILTER_TABS = [
    { key: 'active', label: 'Active Alerts',  count: activeCount },
    { key: 'all',    label: 'All Alerts',      count: stats.total || 0 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Safety Alerts"
        subtitle="Monitor and respond to emergency SOS alerts across the platform"
        actions={
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            <RefreshCw size={14} /> Refresh
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
          <CheckCircle2 size={16} className="shrink-0" /> <span>{success}</span>
        </div>
      )}

      {(stats.ACTIVE?.count || 0) > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-600 text-white rounded-lg">
          <Flame size={18} className="shrink-0 animate-pulse" />
          <span className="font-semibold text-sm">
            {stats.ACTIVE.count} active emergency alert{stats.ACTIVE.count > 1 ? 's' : ''} require immediate attention
          </span>
        </div>
      )}

      <AIInsightCard context="safety" metrics={{
        totalAlerts: stats.total || 0,
        activeSOS: stats.ACTIVE?.count || 0,
        acknowledged: stats.ACKNOWLEDGED?.count || 0,
        resolvedCount: stats.RESOLVED?.count || 0,
        cancelledCount: stats.CANCELLED?.count || 0,
        unresolvedCount: (stats.ACTIVE?.count || 0) + (stats.ACKNOWLEDGED?.count || 0),
        resolutionRate: stats.total > 0 ? Math.round(((stats.RESOLVED?.count || 0) / stats.total) * 100) : 0,
      }} title="Safety Intelligence" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {STAT_DEFS.map(({ key, label, Icon, color, bg }) => (
          <div key={key} className={cn('rounded-lg border border-zinc-200 dark:border-zinc-800 p-4', bg)}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
                <p className={cn('text-2xl font-semibold mt-1', color)}>
                  {key === 'total' ? (stats.total || 0) : (stats[key]?.count || 0)}
                </p>
              </div>
              <Icon size={20} className={color} />
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 w-fit">
        {FILTER_TABS.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-md transition flex items-center gap-2',
              filter === key
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            )}
          >
            {label}
            <span className={cn(
              'px-1.5 py-0.5 rounded-md text-[10px] font-bold',
              filter === key
                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-500'
            )}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-zinc-500">
        {[
          { dot: 'bg-red-600',     label: 'ACTIVE — Immediate action required' },
          { dot: 'bg-amber-500',   label: 'ACKNOWLEDGED — Being handled' },
          { dot: 'bg-emerald-500', label: 'RESOLVED — Closed successfully' },
          { dot: 'bg-zinc-400',    label: 'CANCELLED — False alarm or dismissed' },
        ].map(({ dot, label }) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className={cn('w-2 h-2 rounded-full', dot)} />{label}
          </span>
        ))}
      </div>

      {/* Alert list */}
      <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {paginated.length === 0 ? (
          <div className="p-16 text-center">
            <ShieldCheck size={36} className="mx-auto mb-3 text-zinc-300 dark:text-zinc-600" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">No Safety Alerts</h3>
            <p className="text-sm text-zinc-400">
              {filter === 'active' ? 'No active safety alerts — platform is safe' : 'No safety alerts found'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {paginated.map(em => (
              <EmergencyCard key={em._id} emergency={em} onAction={handleOpenAction} />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sorted.length)} of {sorted.length} alerts
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
              className="p-2 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="flex items-center px-3 text-sm text-zinc-600 dark:text-zinc-400">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page === totalPages}
              className="p-2 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {modal && (
        <ActionModal
          emergency={modal.emergency}
          actionKey={modal.actionKey}
          onConfirm={handleConfirmAction}
          onCancel={handleCloseModal}
          loading={actionLoading}
        />
      )}
    </div>
  );
};

export default AdminSafety;
