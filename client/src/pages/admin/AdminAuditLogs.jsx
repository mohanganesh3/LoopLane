/**
 * AdminAuditLogs — Admin Action Audit Trail
 * FIXED: Uses AdminPageHeader, hardcoded all known action types in filter,
 * added stats summary row, improved empty state UX.
 */
import { useState, useEffect, useMemo } from 'react';
import adminService from '../../services/adminService';
import { cn } from '@/lib/utils';
import { AdminPageHeader, AdminStatCard, AIInsightCard } from '../../components/admin';
import {
  UserX, UserCheck, Trash2, IdCard, CarFront, Banknote, AlertTriangle,
  Flag, Settings, UserPlus, UserPen, UserMinus, Loader2, ClipboardList,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight, X, AlertCircle, Circle,
  RefreshCw, Shield, Download,
} from 'lucide-react';

const SEVERITY_CLASSES = {
  LOW: 'bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700',
  MEDIUM: 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:ring-yellow-800',
  HIGH: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:ring-orange-800',
  CRITICAL: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800',
};

const ACTION_ICONS = {
  USER_SUSPENDED: UserX, USER_ACTIVATED: UserCheck, USER_DELETED: Trash2,
  VERIFICATION_APPROVED: IdCard, VERIFICATION_REJECTED: IdCard,
  RIDE_CANCELLED: CarFront, BOOKING_REFUNDED: Banknote,
  EMERGENCY_RESOLVED: AlertTriangle, REPORT_ACTION: Flag,
  SETTINGS_UPDATED: Settings, EMPLOYEE_CREATED: UserPlus,
  EMPLOYEE_UPDATED: UserPen, EMPLOYEE_DEACTIVATED: UserMinus,
};

const ALL_ACTIONS = [
  'USER_SUSPENDED', 'USER_ACTIVATED', 'USER_DELETED',
  'VERIFICATION_APPROVED', 'VERIFICATION_REJECTED',
  'RIDE_CANCELLED', 'BOOKING_REFUNDED',
  'EMERGENCY_RESOLVED', 'REPORT_ACTION',
  'SETTINGS_UPDATED', 'EMPLOYEE_CREATED',
  'EMPLOYEE_UPDATED', 'EMPLOYEE_DEACTIVATED',
];

const AdminAuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filters, setFilters] = useState({ action: '', severity: '' });
  const [expandedLog, setExpandedLog] = useState(null);

  useEffect(() => { fetchLogs(); }, [page, filters]);

  const fetchLogs = async () => {
    try {
      setLoading(true); setError('');
      const params = { page, limit: 30 };
      if (filters.action) params.action = filters.action;
      if (filters.severity) params.severity = filters.severity;
      const res = await adminService.getAuditLogs(params);
      if (res.success) {
        setLogs(res.logs || []);
        setTotalPages(res.pagination?.pages || 1);
        setTotalCount(res.pagination?.total || res.logs?.length || 0);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load audit logs');
    } finally { setLoading(false); }
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const diff = Date.now() - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Severity stats from current page
  const severityStats = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    logs.forEach(l => { if (counts[l.severity] !== undefined) counts[l.severity]++; });
    return counts;
  }, [logs]);

  const selectCls = 'px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:ring-2 focus:ring-zinc-400 outline-none';

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Audit Logs"
        subtitle="Track all admin and employee actions across the platform"
        actions={
          <button onClick={fetchLogs} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh
          </button>
        }
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 p-3 rounded-md border border-red-200 dark:border-red-800 text-sm flex items-center gap-2">
          <AlertCircle size={14} /> {error}
        </div>
      )}

      <AIInsightCard context="audit" metrics={{
        totalActions: totalCount,
        actionTypeCount: [...new Set(logs.map(l => l.action))].length,
        criticalActions: severityStats.CRITICAL,
        highActions: severityStats.HIGH,
        mediumActions: severityStats.MEDIUM,
        lowActions: severityStats.LOW,
        recentActivity: totalCount > 100 ? 'High' : totalCount > 30 ? 'Normal' : 'Low',
      }} title="Audit Intelligence" />

      {/* Severity Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard title="Total Logs" value={totalCount} icon={ClipboardList} loading={loading} />
        <AdminStatCard title="Critical" value={severityStats.CRITICAL} icon={AlertTriangle} loading={loading} />
        <AdminStatCard title="High" value={severityStats.HIGH} icon={Shield} loading={loading} />
        <AdminStatCard title="Medium / Low" value={severityStats.MEDIUM + severityStats.LOW} icon={Flag} loading={loading} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={filters.action}
          onChange={e => { setFilters(prev => ({ ...prev, action: e.target.value })); setPage(1); }}
          className={selectCls}>
          <option value="">All Actions</option>
          {ALL_ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.severity}
          onChange={e => { setFilters(prev => ({ ...prev, severity: e.target.value })); setPage(1); }}
          className={selectCls}>
          <option value="">All Severity</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="CRITICAL">Critical</option>
        </select>
        {(filters.action || filters.severity) && (
          <button onClick={() => { setFilters({ action: '', severity: '' }); setPage(1); }}
            className="flex items-center gap-1 px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">
            <X size={14} /> Clear Filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-zinc-400" /></div>
      ) : (
        <>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
            {logs.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardList size={28} className="mx-auto mb-2 text-zinc-300 dark:text-zinc-600" />
                <p className="text-sm text-zinc-500">No audit logs found for the current filters</p>
              </div>
            ) : (
              logs.map(log => {
                const Icon = ACTION_ICONS[log.action] || Circle;
                const isExpanded = expandedLog === log._id;
                return (
                  <div key={log._id}
                    className="px-5 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer"
                    onClick={() => setExpandedLog(isExpanded ? null : log._id)}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon size={14} className="text-zinc-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100 text-sm">{log.actorName || log.actorEmail || 'System'}</span>
                          <span className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset', SEVERITY_CLASSES[log.severity] || SEVERITY_CLASSES.LOW)}>{log.severity}</span>
                          <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">{log.action?.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{log.description}</p>
                        <p className="text-[10px] text-zinc-400 mt-1">{formatTime(log.createdAt)}</p>
                        {isExpanded && (
                          <div className="mt-3 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg text-xs space-y-2 animate-in fade-in duration-200">
                            <div className="grid grid-cols-2 gap-2">
                              <div><span className="text-zinc-400">Actor Role:</span><span className="ml-2 text-zinc-700 dark:text-zinc-300">{log.actorRole}</span></div>
                              <div><span className="text-zinc-400">Target:</span><span className="ml-2 text-zinc-700 dark:text-zinc-300">{log.targetType} / {log.targetId}</span></div>
                              {log.metadata?.ip && <div><span className="text-zinc-400">IP:</span><span className="ml-2 text-zinc-700 dark:text-zinc-300">{log.metadata.ip}</span></div>}
                              {log.metadata?.endpoint && <div><span className="text-zinc-400">Endpoint:</span><span className="ml-2 text-zinc-700 dark:text-zinc-300">{log.metadata.method} {log.metadata.endpoint}</span></div>}
                            </div>
                            {log.changes && (log.changes.before || log.changes.after) && (
                              <div className="border-t border-zinc-200 dark:border-zinc-700 pt-2">
                                <p className="text-zinc-400 mb-1">Changes:</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {log.changes.before && (
                                    <div>
                                      <p className="text-zinc-500 mb-0.5">Before:</p>
                                      <pre className="text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-xs overflow-x-auto">{JSON.stringify(log.changes.before, null, 2)}</pre>
                                    </div>
                                  )}
                                  {log.changes.after && (
                                    <div>
                                      <p className="text-zinc-500 mb-0.5">After:</p>
                                      <pre className="text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-2 rounded border border-zinc-200 dark:border-zinc-700 text-xs overflow-x-auto">{JSON.stringify(log.changes.after, null, 2)}</pre>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {isExpanded ? <ChevronUp size={12} className="text-zinc-300 mt-1" /> : <ChevronDown size={12} className="text-zinc-300 mt-1" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">Page {page} of {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm disabled:opacity-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminAuditLogs;
