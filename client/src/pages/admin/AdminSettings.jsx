/**
 * AdminSettings — Platform-Wide Settings Configuration (END-TO-END)
 *
 * Every section maps to Settings model fields that are ENFORCED:
 *  - Pricing: commission used in bookingController, rideController
 *  - Safety: maxSpeed + routeDeviation → trackingControllerEnhanced, minRating/autoSuspend → moderation
 *  - Features: toggles gate ride/booking/chat/review routes via settingsEnforcer middleware
 *  - Booking: maxPassengers → rideController.postRide, cancellation window/fee → bookingController.cancelBooking
 *  - Email/SMS: stored for notification pipeline config
 *  - Environmental: used in sustainability calculations
 *
 * Includes: audit trail tab, live impact stats, dirty tracking, confirmation dialogs, reset-to-defaults.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Banknote, Shield, Bell, ToggleLeft, CalendarCheck, Mail, Leaf, Loader2,
  Save, AlertCircle, CheckCircle, X, AlertTriangle, Phone, Info,
  Settings2, History, BarChart3, RefreshCw, RotateCcw, ChevronRight,
  ExternalLink, Activity, Users, Car, MessageSquare, Star, Siren,
  Route, Zap,
} from 'lucide-react';
import adminService from '../../services/adminService';
import { AdminPageHeader, AIInsightCard } from '../../components/admin';

/* ── Default values (match Settings model) ───────────────── */
const MODEL_DEFAULTS = {
  pricing: { commission: 10, baseFare: 20, pricePerKm: 5, pricePerMinute: 1, surgeMultiplierMax: 2.5, surgeThreshold: 0.7, minimumFare: 30 },
  safety: { maxSpeed: 100, routeDeviation: 500, minRating: 3.5, autoSuspendReports: 3 },
  notifications: { emailEnabled: true, smsEnabled: true, pushEnabled: true, sosAlertsEnabled: true },
  features: { rideSharingEnabled: true, chatEnabled: true, reviewsEnabled: true, onlinePaymentRequired: true, verificationRequired: true, maintenanceMode: false },
  booking: { maxPassengersPerRide: 4, cancellationWindow: 60, cancellationFee: 0, autoAcceptRadius: 5 },
  email: { smtpHost: 'smtp.gmail.com', smtpPort: 587, fromEmail: 'noreply@lanecarpool.com', fromName: 'LANE Carpool' },
  sms: { twilioSid: '', twilioPhone: '' },
  environmental: { co2PerKm: 0.12, co2PerTree: 22 },
};

/* ── Impact descriptions per section ─────────────────────── */
const SECTION_IMPACT = {
  pricing: {
    where: 'Booking creation, ride completion payouts',
    how: 'Commission is deducted from every booking fare. Base fare + per-km + per-minute determine how fares are calculated.',
  },
  safety: {
    where: 'Real-time tracking, route deviation alerts, user moderation',
    how: 'Max speed triggers alerts during live tracking. Route deviation threshold controls the corridor width for geofence monitoring.',
  },
  features: {
    where: 'Ride posting, booking creation, chat, reviews — entire platform',
    how: 'Disabling a toggle immediately blocks the corresponding API endpoint for all users. Maintenance mode returns 503 to non-admins.',
  },
  booking: {
    where: 'Ride creation (max passengers), booking cancellation (window + fee)',
    how: 'Max passengers caps seats when drivers post rides. Cancellation fee is charged if passenger cancels within the window.',
  },
  notifications: {
    where: 'Email, SMS, push notification pipelines',
    how: 'Disabling a channel prevents that delivery method across all system notifications.',
  },
  email: {
    where: 'Outbound email pipeline (booking confirmations, SOS, etc.)',
    how: 'SMTP settings are read by the email service for all outbound messages.',
  },
  sms: {
    where: 'OTP delivery, booking alerts via Twilio',
    how: 'Twilio SID and phone number are used for SMS/OTP sending. Auth token is from ENV.',
  },
  environmental: {
    where: 'Sustainability dashboard CO₂ calculations',
    how: 'CO₂/km and CO₂/tree are used to compute environmental impact metrics.',
  },
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
const AdminSettings = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeSection, setActiveSection] = useState('pricing');
  const [audit, setAudit] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const originalRef = useRef(null); // track original settings for dirty detection

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const res = await adminService.getSettings();
      const data = res?.settings || res?.data;
      if (data) {
        setSettings(data);
        originalRef.current = JSON.parse(JSON.stringify(data));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load settings');
    } finally { setLoading(false); }
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      setAuditLoading(true);
      const res = await adminService.getSettingsAudit();
      setAudit(res?.data || null);
    } catch { /* silent */ }
    finally { setAuditLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);
  useEffect(() => { if (activeSection === 'audit') fetchAudit(); }, [activeSection, fetchAudit]);

  /* ── Dirty tracking ──────────────────────────────────────── */
  const isDirty = settings && originalRef.current
    ? JSON.stringify(settings) !== JSON.stringify(originalRef.current)
    : false;

  /* ── Save handler ────────────────────────────────────────── */
  const handleSave = async () => {
    try {
      setSaving(true); setError(''); setSuccess('');
      const res = await adminService.updateSettings(settings);
      if (res?.success) {
        setSuccess('Settings saved — changes are live across the platform');
        originalRef.current = JSON.parse(JSON.stringify(res.settings || settings));
        setTimeout(() => setSuccess(''), 4000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save settings');
    } finally { setSaving(false); }
  };

  /* ── Reset section to defaults ───────────────────────────── */
  const resetSection = (section) => {
    if (!MODEL_DEFAULTS[section]) return;
    setSettings(prev => ({ ...prev, [section]: { ...MODEL_DEFAULTS[section] } }));
  };

  /* ── Field updaters ──────────────────────────────────────── */
  const updateField = (section, field, value) => {
    setSettings(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  /* ── Confirmation wrapper for dangerous toggles ──────────── */
  const toggleWithConfirm = (section, field, label) => {
    const newVal = !settings?.[section]?.[field];
    const danger = (field === 'maintenanceMode' && newVal) || (field === 'rideSharingEnabled' && !newVal);
    if (danger) {
      setConfirmDialog({
        title: `${newVal ? 'Enable' : 'Disable'} ${label}?`,
        message: field === 'maintenanceMode'
          ? 'This will block ALL non-admin users from accessing the platform API immediately after saving.'
          : 'This will prevent ALL users from posting rides or creating bookings immediately after saving.',
        onConfirm: () => { updateField(section, field, newVal); setConfirmDialog(null); },
      });
    } else {
      updateField(section, field, newVal);
    }
  };

  /* ── Sections ────────────────────────────────────────────── */
  const sections = [
    { key: 'pricing', label: 'Pricing', Icon: Banknote },
    { key: 'safety', label: 'Safety', Icon: Shield },
    { key: 'features', label: 'Feature Toggles', Icon: ToggleLeft },
    { key: 'booking', label: 'Booking', Icon: CalendarCheck },
    { key: 'notifications', label: 'Notifications', Icon: Bell },
    { key: 'email', label: 'Email', Icon: Mail },
    { key: 'sms', label: 'SMS', Icon: Phone },
    { key: 'environmental', label: 'Environmental', Icon: Leaf },
    { key: 'audit', label: 'Audit Trail', Icon: History },
  ];

  /* ── Shared renderers ────────────────────────────────────── */
  const inputCls = 'px-3 py-2 border border-zinc-200 dark:border-zinc-700 rounded-md text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-zinc-400 outline-none transition';

  const NumberField = ({ section, field, label, desc, ...props }) => (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
        {desc && <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>}
      </div>
      <input type="number" value={settings?.[section]?.[field] ?? ''} onChange={e => updateField(section, field, parseFloat(e.target.value) || 0)}
        min={props.min} max={props.max} step={props.step || 1} className={cn(inputCls, 'w-28 text-right flex-shrink-0')} />
    </div>
  );

  const Toggle = ({ section, field, label, desc, dangerous }) => (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
        {desc && <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => dangerous ? toggleWithConfirm(section, field, label) : updateField(section, field, !settings?.[section]?.[field])}
        className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0',
          settings?.[section]?.[field] ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-600')}>
        <span className={cn('inline-block h-4 w-4 rounded-full bg-white dark:bg-zinc-900 transition-transform shadow',
          settings?.[section]?.[field] ? 'translate-x-6' : 'translate-x-1')} />
      </button>
    </div>
  );

  const TextField = ({ section, field, label, desc, placeholder, wide }) => (
    <div className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</p>
        {desc && <p className="text-xs text-zinc-400 mt-0.5">{desc}</p>}
      </div>
      <input type="text" value={settings?.[section]?.[field] ?? ''} onChange={e => updateField(section, field, e.target.value)}
        placeholder={placeholder} className={cn(inputCls, wide ? 'w-64' : 'w-52', 'flex-shrink-0')} />
    </div>
  );

  /* ── Impact Banner ───────────────────────────────────────── */
  const ImpactBanner = ({ section }) => {
    const impact = SECTION_IMPACT[section];
    if (!impact) return null;
    return (
      <div className="mb-5 p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start gap-2">
          <ExternalLink size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-semibold text-blue-700 dark:text-blue-400">Where this is enforced:</p>
            <p className="text-blue-600 dark:text-blue-300 mt-0.5">{impact.where}</p>
            <p className="text-blue-500/70 dark:text-blue-400/60 mt-1">{impact.how}</p>
          </div>
        </div>
      </div>
    );
  };

  /* ── Card wrapper ────────────────────────────────────────── */
  const Card = ({ children, className: cls, title, desc, section: sec }) => (
    <div className={cn('bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800', cls)}>
      {title && (
        <div className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
              {desc && <p className="text-xs text-zinc-400 mt-1">{desc}</p>}
            </div>
            {sec && (
              <button onClick={() => resetSection(sec)}
                className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition" title="Reset to defaults">
                <RotateCcw size={12} /> Reset
              </button>
            )}
          </div>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  );

  /* ── Loading ─────────────────────────────────────────────── */
  if (loading && !settings) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Platform Settings" subtitle="Loading configuration..." />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="h-96 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          <div className="lg:col-span-3 h-96 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse" />
        </div>
      </div>
    );
  }

  /* ── AI Metrics ──────────────────────────────────────────── */
  const aiMetrics = {
    sections: sections.length - 1, // exclude audit
    maintenanceMode: settings?.features?.maintenanceMode ? 'ON' : 'OFF',
    commission: `${settings?.pricing?.commission || 0}%`,
    baseFare: `₹${settings?.pricing?.baseFare || 0}`,
    maxSpeed: `${settings?.safety?.maxSpeed || 100}km/h`,
    routeDeviation: `${settings?.safety?.routeDeviation || 500}m`,
    sosAlerts: settings?.notifications?.sosAlertsEnabled ? 'Enabled' : 'Disabled',
    chatEnabled: settings?.features?.chatEnabled ? 'ON' : 'OFF',
    reviewsEnabled: settings?.features?.reviewsEnabled ? 'ON' : 'OFF',
    rideSharingEnabled: settings?.features?.rideSharingEnabled ? 'ON' : 'OFF',
    cancellationWindow: `${settings?.booking?.cancellationWindow || 0}min`,
    cancellationFee: `${settings?.booking?.cancellationFee || 0}%`,
    maxPassengers: settings?.booking?.maxPassengersPerRide || 4,
  };

  /* ── Audit stats ─────────────────────────────────────────── */
  const stats = audit?.stats || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <AdminPageHeader
        title="Platform Settings"
        subtitle="Every setting here is enforced live across the platform"
        actions={
          <div className="flex items-center gap-3">
            {isDirty && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                <AlertTriangle size={12} /> Unsaved changes
              </span>
            )}
            <button onClick={handleSave} disabled={saving || !isDirty}
              className={cn('flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition disabled:opacity-50',
              isDirty ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-zinc-200'
                : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed')}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        }
      />

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 p-3 rounded-lg border border-red-200 dark:border-red-800 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><AlertCircle size={14} /> {error}</span>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/10 text-emerald-700 dark:text-emerald-400 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 text-sm flex items-center justify-between">
          <span className="flex items-center gap-2"><CheckCircle size={14} /> {success}</span>
          <button onClick={() => setSuccess('')}><X size={14} /></button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl p-6 max-w-md mx-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{confirmDialog.title}</h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5">{confirmDialog.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800 transition">
                Cancel
              </button>
              <button onClick={confirmDialog.onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      <AIInsightCard context="settings" metrics={aiMetrics} title="Settings Intelligence" />

      {/* ── Main Layout ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Section Nav */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-2 sticky top-4">
            <nav className="space-y-0.5">
              {sections.map(s => (
                <button key={s.key} onClick={() => setActiveSection(s.key)}
                  className={cn('w-full flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition group',
                    activeSection === s.key
                      ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                      : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50')}>
                  <s.Icon size={15} />
                  <span className="flex-1 text-left">{s.label}</span>
                  <ChevronRight size={12} className={cn('opacity-0 group-hover:opacity-50 transition', activeSection === s.key && 'opacity-50')} />
                </button>
              ))}
            </nav>

            {/* Last updated */}
            {settings?.lastUpdated && (
              <div className="mt-3 px-4 py-2 text-[10px] text-zinc-400 border-t border-zinc-100 dark:border-zinc-800">
                Last saved: {new Date(settings.lastUpdated).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* ═══ PRICING ═══ */}
          {activeSection === 'pricing' && (
            <Card title="Pricing & Commission" desc="Commission, fare structure, surge, and minimum fare" section="pricing">
              <ImpactBanner section="pricing" />
              <NumberField section="pricing" field="commission" label="Platform Commission (%)" desc="Percentage retained from each booking fare" min={0} max={50} />
              <NumberField section="pricing" field="baseFare" label="Base Fare (₹)" desc="Fixed component added to every ride fare" min={0} />
              <NumberField section="pricing" field="pricePerKm" label="Price Per Km (₹)" desc="Distance-based fare component" min={0} step={0.5} />
              <NumberField section="pricing" field="pricePerMinute" label="Price Per Minute (₹)" desc="Time-based fare component" min={0} step={0.5} />
              <NumberField section="pricing" field="minimumFare" label="Minimum Fare (₹)" desc="Lowest possible ride fare — fare never goes below this" min={0} step={5} />
              <NumberField section="pricing" field="surgeMultiplierMax" label="Max Surge Multiplier" desc="Maximum surge factor during peak demand" min={1} max={5} step={0.1} />
              <NumberField section="pricing" field="surgeThreshold" label="Surge Trigger (D/S Ratio)" desc="Demand/supply ratio that activates surge pricing" min={0.1} max={2} step={0.1} />
            </Card>
          )}

          {/* ═══ SAFETY ═══ */}
          {activeSection === 'safety' && (
            <Card title="Safety Thresholds" desc="Speed limits, deviation corridors, and auto-moderation rules" section="safety">
              <ImpactBanner section="safety" />
              <NumberField section="safety" field="maxSpeed" label="Max Speed (km/h)" desc="Speed above this triggers a CRITICAL alert in live tracking" min={60} max={200} />
              <NumberField section="safety" field="routeDeviation" label="Route Deviation Corridor (m)" desc="Corridor width in meters — deviation beyond this triggers alerts to passengers/admin" min={100} max={5000} step={50} />
              <NumberField section="safety" field="minRating" label="Minimum Rating" desc="Users below this rating are flagged for review" min={1} max={5} step={0.1} />
              <NumberField section="safety" field="autoSuspendReports" label="Auto-Suspend After Reports" desc="Number of verified reports that triggers automatic user suspension" min={1} max={20} />
            </Card>
          )}

          {/* ═══ FEATURES ═══ */}
          {activeSection === 'features' && (
            <Card title="Feature Toggles" desc="Enable/disable platform features — changes take effect immediately after save" section="features">
              <ImpactBanner section="features" />
              <Toggle section="features" field="rideSharingEnabled" label="Ride Sharing" desc="When OFF: no one can post rides or create bookings" dangerous />
              <Toggle section="features" field="chatEnabled" label="In-App Chat" desc="When OFF: all chat API endpoints are blocked" />
              <Toggle section="features" field="reviewsEnabled" label="Reviews & Ratings" desc="When OFF: users cannot submit new reviews" />
              <Toggle section="features" field="onlinePaymentRequired" label="Online Payment Required" desc="Require digital payment for all bookings" />
              <Toggle section="features" field="verificationRequired" label="Verification Required" desc="When ON: only verified users can post rides" />
              <Toggle section="features" field="maintenanceMode" label="Maintenance Mode" desc="When ON: ALL non-admin API requests return 503" dangerous />

              {settings?.features?.maintenanceMode && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={14} /> <strong>MAINTENANCE MODE IS ON</strong> — All non-admin users are blocked from the API
                </div>
              )}
              {settings?.features?.rideSharingEnabled === false && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg text-amber-700 dark:text-amber-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={14} /> Ride sharing is disabled — no new rides or bookings can be created
                </div>
              )}
            </Card>
          )}

          {/* ═══ BOOKING ═══ */}
          {activeSection === 'booking' && (
            <Card title="Booking Configuration" desc="Passenger limits, cancellation rules, and auto-accept radius" section="booking">
              <ImpactBanner section="booking" />
              <NumberField section="booking" field="maxPassengersPerRide" label="Max Passengers Per Ride" desc="Maximum seats a driver can offer when posting a ride" min={1} max={8} />
              <NumberField section="booking" field="cancellationWindow" label="Cancellation Window (min)" desc="Minutes before departure — cancelling within this window incurs a fee" min={0} max={1440} />
              <NumberField section="booking" field="cancellationFee" label="Cancellation Fee (%)" desc="Percentage of fare charged if cancelled within window (0 = free cancellation)" min={0} max={100} />
              <NumberField section="booking" field="autoAcceptRadius" label="Auto-Accept Radius (km)" desc="Radius for location-based auto-matching bookings" min={1} max={50} />
              {(settings?.booking?.cancellationFee || 0) > 0 && (
                <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-zinc-600 dark:text-zinc-400 text-xs">
                  <Info size={12} className="inline mr-1" />
                  Example: A ₹100 booking cancelled within {settings?.booking?.cancellationWindow || 60} min of departure will be charged <strong>₹{Math.round(100 * (settings?.booking?.cancellationFee || 0) / 100)}</strong> fee, and <strong>₹{100 - Math.round(100 * (settings?.booking?.cancellationFee || 0) / 100)}</strong> refunded.
                </div>
              )}
            </Card>
          )}

          {/* ═══ NOTIFICATIONS ═══ */}
          {activeSection === 'notifications' && (
            <Card title="Notification Channels" desc="Control which delivery methods are active" section="notifications">
              <ImpactBanner section="notifications" />
              <Toggle section="notifications" field="emailEnabled" label="Email Notifications" desc="Send booking confirmations, alerts via email" />
              <Toggle section="notifications" field="smsEnabled" label="SMS Notifications" desc="Send OTP, booking alerts via SMS (Twilio)" />
              <Toggle section="notifications" field="pushEnabled" label="Push Notifications" desc="Browser push notification delivery" />
              <Toggle section="notifications" field="sosAlertsEnabled" label="SOS Alerts" desc="Emergency SOS alert system for passengers" />
            </Card>
          )}

          {/* ═══ EMAIL ═══ */}
          {activeSection === 'email' && (
            <Card title="Email Configuration" desc="SMTP settings for outbound email delivery" section="email">
              <ImpactBanner section="email" />
              <TextField section="email" field="smtpHost" label="SMTP Host" desc="Mail server hostname" placeholder="smtp.gmail.com" />
              <NumberField section="email" field="smtpPort" label="SMTP Port" desc="Mail server port" min={1} max={65535} />
              <TextField section="email" field="fromEmail" label="From Email" desc="Sender email address for outbound mail" placeholder="noreply@lanecarpool.com" />
              <TextField section="email" field="fromName" label="From Name" desc="Display name for the sender" placeholder="LANE Carpool" />
            </Card>
          )}

          {/* ═══ SMS ═══ */}
          {activeSection === 'sms' && (
            <Card title="SMS Configuration (Twilio)" desc="Credentials for SMS and OTP delivery" section="sms">
              <ImpactBanner section="sms" />
              <TextField section="sms" field="twilioSid" label="Twilio Account SID" desc="Your Twilio account SID" placeholder="AC..." wide />
              <TextField section="sms" field="twilioPhone" label="Twilio Phone Number" desc="The phone number to send from" placeholder="+1234567890" />
              <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-600 dark:text-zinc-400 flex items-start gap-2">
                <Info size={14} className="mt-0.5 flex-shrink-0" />
                <p>Auth token is managed via environment variables (TWILIO_AUTH_TOKEN) and should never be stored in the database.</p>
              </div>
            </Card>
          )}

          {/* ═══ ENVIRONMENTAL ═══ */}
          {activeSection === 'environmental' && (
            <Card title="Environmental Settings" desc="Carbon calculation parameters for the Sustainability dashboard" section="environmental">
              <ImpactBanner section="environmental" />
              <NumberField section="environmental" field="co2PerKm" label="CO₂ Per Km (kg)" desc="Kilograms of CO₂ saved per carpooled kilometer" min={0} step={0.01} />
              <NumberField section="environmental" field="co2PerTree" label="CO₂ Per Tree/Year (kg)" desc="CO₂ absorbed by one tree annually — used for tree equivalence" min={0} />
            </Card>
          )}

          {/* ═══ AUDIT TRAIL ═══ */}
          {activeSection === 'audit' && (
            <div className="space-y-6">
              {/* Live Impact Stats */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Live Platform Impact</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">Real-time counts showing what your settings affect</p>
                  </div>
                  <button onClick={fetchAudit} disabled={auditLoading}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600 transition">
                    {auditLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Rides', value: stats.rides?.total || 0, sub: `${stats.rides?.active || 0} active`, Icon: Car, color: 'text-indigo-600' },
                    { label: 'Bookings', value: stats.bookings?.total || 0, sub: `${stats.bookings?.cancelled || 0} cancelled`, Icon: CalendarCheck, color: 'text-emerald-600' },
                    { label: 'Users', value: stats.users?.total || 0, sub: `${stats.users?.flagged || 0} flagged`, Icon: Users, color: 'text-blue-600' },
                    { label: 'Chats', value: stats.chats || 0, sub: `${settings?.features?.chatEnabled ? 'Active' : 'Disabled'}`, Icon: MessageSquare, color: 'text-purple-600' },
                    { label: 'Reviews', value: stats.reviews || 0, sub: `${settings?.features?.reviewsEnabled ? 'Active' : 'Disabled'}`, Icon: Star, color: 'text-amber-600' },
                    { label: 'SOS Alerts', value: stats.sosAlerts || 0, sub: `${settings?.notifications?.sosAlertsEnabled ? 'Active' : 'Disabled'}`, Icon: Siren, color: 'text-red-600' },
                    { label: 'Route Deviations', value: stats.routeDeviations || 0, sub: `Corridor: ${settings?.safety?.routeDeviation || 500}m`, Icon: Route, color: 'text-orange-600' },
                    { label: 'Cancel Fees', value: `₹${stats.cancellationFees?.totalFees || 0}`, sub: `${stats.cancellationFees?.count || 0} charged`, Icon: Zap, color: 'text-pink-600' },
                  ].map(s => (
                    <div key={s.label} className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-700">
                      <div className="flex items-center gap-2 mb-1">
                        <s.Icon size={14} className={s.color} />
                        <span className="text-[10px] text-zinc-400 uppercase tracking-wider">{s.label}</span>
                      </div>
                      <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{typeof s.value === 'number' ? s.value.toLocaleString('en-IN') : s.value}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{s.sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Change History */}
              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <div className="p-6 border-b border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Settings Change History</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">All changes are logged in the audit trail</p>
                </div>
                {(audit?.auditLogs || []).length > 0 ? (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-96 overflow-y-auto">
                    {audit.auditLogs.map(log => (
                      <div key={log._id} className="px-6 py-3 flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                        <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Settings2 size={14} className="text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-zinc-700 dark:text-zinc-300">
                            <span className="font-medium">{log.user}</span>{' '}
                            <span className="text-zinc-400">updated</span>{' '}
                            <span className="font-medium">{log.sections?.join(', ') || 'settings'}</span>
                          </p>
                          {log.description && <p className="text-xs text-zinc-400 mt-0.5">{log.description}</p>}
                        </div>
                        <span className="text-[10px] text-zinc-400 flex-shrink-0">
                          {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 text-center text-sm text-zinc-400">
                    {auditLoading ? 'Loading...' : 'No settings changes recorded yet'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
