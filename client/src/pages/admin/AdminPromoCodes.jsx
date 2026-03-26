/**
 * AdminPromoCodes — Promo Code Command Center
 * Full CRUD: Create, Edit, Delete, Toggle + analytics
 * BUG FIX: uses discountType/discountValue (matching PromoCode model)
 */
import { useState, useEffect, useMemo } from 'react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import {
  Tags, CheckCircle, Receipt, PiggyBank, Plus, X, Loader2,
  Pencil, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Percent, IndianRupee,
} from 'lucide-react';
import adminService from '../../services/adminService';
import { AdminStatCard, AdminDataTable, AdminPageHeader, StatusBadge, ExportButton } from '../../components/admin';

// ─── Constants ───────────────────────────────────────────────
const CHART_COLORS = ['#0ead69', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const EMPTY_FORM = {
  code: '', discountType: 'PERCENTAGE', discountValue: '', maxUses: '',
  expiresAt: '', minBookingAmount: '', description: '',
};

const INPUT_CLS = 'w-full px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400';

// ─── Helpers ─────────────────────────────────────────────────
const getPromoStatus = (p) => {
  if (!p.isActive) return 'INACTIVE';
  if (p.expiresAt && new Date(p.expiresAt) < new Date()) return 'EXPIRED';
  if (p.maxUses && (p.currentUses || 0) >= p.maxUses) return 'EXHAUSTED';
  return 'ACTIVE';
};

const STATUS_MAP = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'CANCELLED',
  EXPIRED: 'CANCELLED',
  EXHAUSTED: 'PENDING',
};

const fmtDate = (v) => v ? new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : null;

// ─── Confirm Modal ───────────────────────────────────────────
const ConfirmModal = ({ title, message, onConfirm, onCancel, danger }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-lg w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', danger ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30')}>
          <AlertTriangle size={18} className={danger ? 'text-red-600' : 'text-amber-600'} />
        </div>
        <div>
          <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{title}</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{message}</p>
        </div>
      </div>
      <div className="flex gap-2 mt-5">
        <button onClick={onCancel} className="flex-1 py-2 text-sm font-medium border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition">Cancel</button>
        <button onClick={onConfirm} className={cn('flex-1 py-2 text-sm font-medium rounded-md text-white transition', danger ? 'bg-red-600 hover:bg-red-700' : 'bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200')}>
          Confirm
        </button>
      </div>
    </div>
  </div>
);

// ─── Promo Form Modal ────────────────────────────────────────
const PromoFormModal = ({ title, form, setForm, onSubmit, onClose, submitting, submitLabel }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-lg w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X size={16} /></button>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Code</label>
          <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))}
            placeholder="e.g. WELCOME50" required className={cn(INPUT_CLS, 'font-mono uppercase')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Type</label>
            <select value={form.discountType} onChange={e => setForm(p => ({ ...p, discountType: e.target.value }))} className={INPUT_CLS}>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FLAT">Flat Amount</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Value</label>
            <input type="number" value={form.discountValue} onChange={e => setForm(p => ({ ...p, discountValue: e.target.value }))}
              placeholder={form.discountType === 'PERCENTAGE' ? '50' : '100'} required className={INPUT_CLS} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Max Uses</label>
            <input type="number" value={form.maxUses} onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))}
              placeholder="Unlimited" className={INPUT_CLS} />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Expires</label>
            <input type="date" value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} className={INPUT_CLS} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Min Booking Amount (₹)</label>
          <input type="number" value={form.minBookingAmount} onChange={e => setForm(p => ({ ...p, minBookingAmount: e.target.value }))}
            placeholder="Optional" className={INPUT_CLS} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">Description</label>
          <input type="text" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="What is this promo for?" className={INPUT_CLS} />
        </div>
        <button type="submit" disabled={submitting}
          className="w-full py-2.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 transition flex items-center justify-center gap-2">
          {submitting ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : submitLabel}
        </button>
      </form>
    </div>
  </div>
);

// ═════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
const AdminPromoCodes = () => {
  const [loading, setLoading] = useState(true);
  const [promoCodes, setPromoCodes] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => { loadPromoCodes(); }, []);

  const loadPromoCodes = async () => {
    setLoading(true);
    try {
      const res = await adminService.getPromoCodes();
      const codes = res?.data?.promoCodes || res?.promoCodes || res?.data || [];
      setPromoCodes(Array.isArray(codes) ? codes : []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  // ─── Create ────────────────────────────────────────────────
  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminService.createPromoCode({
        code: form.code.toUpperCase(),
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
        minBookingAmount: form.minBookingAmount ? parseFloat(form.minBookingAmount) : undefined,
        description: form.description,
      });
      setShowCreateModal(false);
      setForm({ ...EMPTY_FORM });
      await loadPromoCodes();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  // ─── Edit ──────────────────────────────────────────────────
  const openEdit = (promo) => {
    setForm({
      code: promo.code || '',
      discountType: promo.discountType || 'PERCENTAGE',
      discountValue: promo.discountValue?.toString() || '',
      maxUses: promo.maxUses?.toString() || '',
      expiresAt: promo.expiresAt ? new Date(promo.expiresAt).toISOString().split('T')[0] : '',
      minBookingAmount: promo.minBookingAmount?.toString() || '',
      description: promo.description || '',
    });
    setEditTarget(promo);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editTarget?._id) return;
    setSubmitting(true);
    try {
      await adminService.updatePromoCode(editTarget._id, {
        code: form.code.toUpperCase(),
        discountType: form.discountType,
        discountValue: parseFloat(form.discountValue),
        maxUses: form.maxUses ? parseInt(form.maxUses) : undefined,
        expiresAt: form.expiresAt || undefined,
        minBookingAmount: form.minBookingAmount ? parseFloat(form.minBookingAmount) : undefined,
        description: form.description,
      });
      setEditTarget(null);
      setForm({ ...EMPTY_FORM });
      await loadPromoCodes();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  // ─── Delete ────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    setSubmitting(true);
    try {
      await adminService.deletePromoCode(deleteTarget._id);
      setDeleteTarget(null);
      await loadPromoCodes();
    } catch { /* silent */ }
    finally { setSubmitting(false); }
  };

  // ─── Toggle ────────────────────────────────────────────────
  const handleToggle = async (promo) => {
    try {
      await adminService.togglePromoCode(promo._id);
      await loadPromoCodes();
    } catch { /* silent */ }
  };

  // ─── Computed ──────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = promoCodes.filter(p => getPromoStatus(p) === 'ACTIVE').length;
    const totalUses = promoCodes.reduce((s, p) => s + (p.currentUses || 0), 0);
    const totalSavings = promoCodes.reduce((s, p) => s + ((p.currentUses || 0) * (p.discountValue || 0)), 0);
    const typeBreakdown = [
      { name: 'Percentage', value: promoCodes.filter(p => p.discountType === 'PERCENTAGE').length },
      { name: 'Flat', value: promoCodes.filter(p => p.discountType === 'FLAT').length },
    ].filter(d => d.value > 0);
    const usageData = promoCodes.filter(p => (p.currentUses || 0) > 0)
      .sort((a, b) => (b.currentUses || 0) - (a.currentUses || 0))
      .slice(0, 8)
      .map(p => ({ code: p.code, uses: p.currentUses || 0 }));
    return { active, totalUses, totalSavings, typeBreakdown, usageData };
  }, [promoCodes]);

  const filteredData = useMemo(() => {
    if (activeTab === 'all') return promoCodes;
    if (activeTab === 'active') return promoCodes.filter(p => getPromoStatus(p) === 'ACTIVE');
    if (activeTab === 'inactive') return promoCodes.filter(p => ['INACTIVE', 'EXPIRED', 'EXHAUSTED'].includes(getPromoStatus(p)));
    return promoCodes;
  }, [promoCodes, activeTab]);

  // ─── Columns ───────────────────────────────────────────────
  const columns = [
    { field: 'code', label: 'Code', sortable: true, render: (v) => (
      <span className="font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md tracking-wider">{v}</span>
    )},
    { field: 'discountType', label: 'Type', render: (v) => (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ring-1 ring-inset',
        v === 'PERCENTAGE' ? 'bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700'
          : 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:ring-blue-800')}>
        {v === 'PERCENTAGE' ? <><Percent size={10} /> Off</> : <><IndianRupee size={10} /> Flat</>}
      </span>
    )},
    { field: 'discountValue', label: 'Value', render: (v, row) => (
      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{row.discountType === 'PERCENTAGE' ? `${v}%` : `₹${v}`}</span>
    )},
    { field: 'currentUses', label: 'Used', render: (v, row) => (
      <div className="space-y-1">
        <div>
          <span className="font-medium text-zinc-900 dark:text-zinc-100">{v || 0}</span>
          {row.maxUses && <span className="text-zinc-400"> / {row.maxUses}</span>}
        </div>
        {row.maxUses > 0 && (
          <div className="w-20 h-1 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((v || 0) / row.maxUses) * 100)}%` }} />
          </div>
        )}
      </div>
    )},
    { field: 'minBookingAmount', label: 'Min ₹', render: (v) => v ? `₹${v}` : '—' },
    { field: 'expiresAt', label: 'Expires', render: (v) => {
      if (!v) return <span className="text-zinc-400">Never</span>;
      const expired = new Date(v) < new Date();
      return <span className={expired ? 'text-red-600 dark:text-red-400' : 'text-zinc-600 dark:text-zinc-400'}>
        {fmtDate(v)}{expired && ' (expired)'}
      </span>;
    }},
    { field: '_status', label: 'Status', render: (_, row) => <StatusBadge status={STATUS_MAP[getPromoStatus(row)] || 'ACTIVE'} /> },
    { field: '_actions', label: '', render: (_, row) => (
      <div className="flex items-center gap-1">
        <button onClick={() => handleToggle(row)} title={row.isActive ? 'Deactivate' : 'Activate'}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          {row.isActive ? <ToggleRight size={16} className="text-emerald-600" /> : <ToggleLeft size={16} />}
        </button>
        <button onClick={() => openEdit(row)} title="Edit"
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
          <Pencil size={14} />
        </button>
        <button onClick={() => setDeleteTarget(row)} title="Delete"
          className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition text-zinc-400 hover:text-red-600">
          <Trash2 size={14} />
        </button>
      </div>
    )},
  ];

  // ─── Tab Defs ──────────────────────────────────────────────
  const tabs = [
    { key: 'all', label: 'All', count: promoCodes.length },
    { key: 'active', label: 'Active', count: stats.active },
    { key: 'inactive', label: 'Inactive / Expired', count: promoCodes.length - stats.active },
    { key: 'analytics', label: 'Analytics' },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Promo Codes"
        subtitle="Create, manage, and track promotional codes"
        actions={
          <div className="flex items-center gap-2">
            <ExportButton type="csv" params={{ section: 'promo-codes' }} />
            <button onClick={() => { setForm({ ...EMPTY_FORM }); setShowCreateModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition">
              <Plus size={14} /> Create Code
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard title="Total Codes" value={promoCodes.length} icon={Tags} loading={loading} />
        <AdminStatCard title="Active" value={stats.active} icon={CheckCircle} loading={loading} />
        <AdminStatCard title="Total Redemptions" value={stats.totalUses} icon={Receipt} loading={loading} />
        <AdminStatCard title="Est. Savings" value={`₹${stats.totalSavings.toLocaleString('en-IN')}`} icon={PiggyBank} loading={loading} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={cn('px-4 py-2 text-sm font-medium rounded-md transition',
              activeTab === t.key ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')}>
            {t.label}{t.count !== undefined && <span className="ml-1.5 text-xs text-zinc-400">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Table Tabs */}
      {activeTab !== 'analytics' && (
        <AdminDataTable
          title={activeTab === 'all' ? 'All Promo Codes' : activeTab === 'active' ? 'Active Promos' : 'Inactive / Expired'}
          columns={columns}
          data={filteredData}
          loading={loading}
          searchable
          searchPlaceholder="Search codes..."
          emptyMessage="No promo codes found"
        />
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Type Breakdown</h3>
            {stats.typeBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={stats.typeBreakdown} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}>
                    {stats.typeBreakdown.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-zinc-400">No promo codes yet</div>
            )}
          </div>

          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Top Codes by Usage</h3>
            {stats.usageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={stats.usageData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
                  <XAxis dataKey="code" tick={{ fontSize: 10, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#a1a1aa' }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={v => [v, 'Redemptions']} />
                  <Bar dataKey="uses" name="Uses" fill="#0ead69" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-zinc-400">No redemptions yet</div>
            )}
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <PromoFormModal
          title="Create Promo Code" form={form} setForm={setForm}
          onSubmit={handleCreate} onClose={() => setShowCreateModal(false)}
          submitting={submitting} submitLabel="Create Promo Code"
        />
      )}

      {/* Edit Modal */}
      {editTarget && (
        <PromoFormModal
          title={`Edit: ${editTarget.code}`} form={form} setForm={setForm}
          onSubmit={handleEdit} onClose={() => { setEditTarget(null); setForm({ ...EMPTY_FORM }); }}
          submitting={submitting} submitLabel="Save Changes"
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete Promo Code"
          message={`Permanently delete "${deleteTarget.code}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}
    </div>
  );
};

export default AdminPromoCodes;
