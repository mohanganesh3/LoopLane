/**
 * ═══════════════════════════════════════════════════════════════════
 *  ENTERPRISE EMPLOYEE MANAGEMENT — Geo-Coordinate-First
 *  LoopLane Admin — Real [lng, lat] locations, auto-derived city/zone,
 *  cross-area ride stats, office selection, permission geo-scoping
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Check, Clock, Plane, Ban, X, DoorOpen, Pencil, Search, Plus, Download, UserMinus, ExternalLink, Loader2, AlertCircle, Globe, Info, MapPin, Building2, Shield, Star, ArrowUp, Route, CarFront, UserPlus, PieChart, Heart, Hexagon, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import adminService from '../../services/adminService';
import HexMapPicker from '../../components/admin/HexMapPicker';

// ─── CONSTANTS ────────────────────────────────────────────────────

const ROLE_LABELS = {
  ADMIN: 'Admin', SUPER_ADMIN: 'Super Admin',
  SUPPORT_AGENT: 'Support Agent', FINANCE_MANAGER: 'Finance Manager',
  OPERATIONS_MANAGER: 'Ops Manager', CONTENT_MODERATOR: 'Content Mod',
  FLEET_MANAGER: 'Fleet Manager'
};

const ROLE_COLORS = {
  ADMIN: { bg: '#f4f4f5', text: '#3f3f46', border: '#a1a1aa' },
  SUPER_ADMIN: { bg: '#f4f4f5', text: '#3f3f46', border: '#71717a' },
  SUPPORT_AGENT: { bg: '#f4f4f5', text: '#52525b', border: '#a1a1aa' },
  FINANCE_MANAGER: { bg: '#f4f4f5', text: '#52525b', border: '#a1a1aa' },
  OPERATIONS_MANAGER: { bg: '#f4f4f5', text: '#52525b', border: '#a1a1aa' },
  CONTENT_MODERATOR: { bg: '#f4f4f5', text: '#52525b', border: '#a1a1aa' },
  FLEET_MANAGER: { bg: '#f4f4f5', text: '#52525b', border: '#a1a1aa' },
};

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active' },
  PROBATION: { label: 'Probation' },
  ON_LEAVE: { label: 'On Leave' },
  NOTICE_PERIOD: { label: 'Notice' },
  SUSPENDED: { label: 'Suspended' },
  TERMINATED: { label: 'Terminated' },
  OFFBOARDED: { label: 'Offboarded' },
};

const HIERARCHY_LABELS = {
  1: 'C-Suite', 2: 'VP', 3: 'Director', 4: 'Sr. Manager', 5: 'Manager', 6: 'Sr. Associate', 7: 'Associate'
};

const DEPARTMENTS = [
  'Operations', 'Engineering', 'Customer Support', 'Finance',
  'Safety & Trust', 'Fleet Management', 'Marketing', 'Legal',
  'Human Resources', 'Product', 'Data & Analytics', 'Quality Assurance'
];

const ZONE_COLORS = {
  SOUTH: '#16a34a', NORTH: '#2563eb', WEST: '#d97706', EAST: '#9333ea', CENTRAL: '#6b7280'
};

const toFiniteNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const normalizeLngLat = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const lng = toFiniteNumber(coordinates[0]);
  const lat = toFiniteNumber(coordinates[1]);
  if (lng === null || lat === null) return null;
  return { lng, lat };
};

const EMPLOYEE_ROLES = ['SUPPORT_AGENT', 'FINANCE_MANAGER', 'OPERATIONS_MANAGER', 'CONTENT_MODERATOR', 'FLEET_MANAGER'];
const EMPLOYEE_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
const SHIFT_TYPES = ['MORNING', 'AFTERNOON', 'NIGHT', 'ROTATIONAL', 'FLEXIBLE'];

const INIT_FORM = {
  firstName: '', lastName: '', email: '', phone: '', password: '',
  role: 'SUPPORT_AGENT', designation: '', employeeType: 'FULL_TIME',
  department: 'Operations', subDepartment: '', team: '',
  areaKey: 'chennai', officeIndex: 0,
  coordinates: null, h3Index: null,
  // Zone allocation
  assignedZones: [], // [{hex, role}]
  jurisdictionType: 'ZONE',
  jurisdictionCoverage: 'SHARED',
  autoExpand: false,
  crossAreaCorridors: [],
  shiftSchedule: 'MORNING', shiftStart: '09:00', shiftEnd: '18:00',
  hierarchyLevel: 7, reportsTo: '',
  permissions: [], permissionLocations: [], permissionDepartments: [],
  skills: '', languages: '', notes: '', tags: '',
  emergencyContactName: '', emergencyContactPhone: '', emergencyContactRelation: '',
};

// ─── HELPER COMPONENTS ────────────────────────────────────────────

const StatCard = ({ label, value, sub, small }) => (
  <div className={`bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 ${small ? 'p-3' : 'p-4'} flex flex-col`}>
    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">{label}</span>
    <div className={`${small ? 'text-xl' : 'text-2xl'} font-bold text-zinc-900 dark:text-zinc-100`}>{value}</div>
    {sub && <div className="text-[11px] text-zinc-400 mt-0.5">{sub}</div>}
  </div>
);

const RoleBadge = ({ role }) => {
  const c = ROLE_COLORS[role] || { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}30` }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ACTIVE;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
      {cfg.label}
    </span>
  );
};

const ZoneBadge = ({ zone }) => {
  const color = ZONE_COLORS[zone] || '#6b7280';
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider"
      style={{ color, background: `${color}12`, border: `1px solid ${color}20` }}>
      {zone}
    </span>
  );
};

const CoordDisplay = ({ coordinates, small }) => {
  const parsed = normalizeLngLat(coordinates);
  if (!parsed) return <span className="text-zinc-300 text-[10px]">No coords</span>;
  const { lng, lat } = parsed;
  return (
    <span className={`font-mono ${small ? 'text-[9px]' : 'text-[10px]'} text-zinc-400`} title={`${lat.toFixed(6)}, ${lng.toFixed(6)}`}>
      {lat.toFixed(4)}°N, {lng.toFixed(4)}°E
    </span>
  );
};

const HexBadge = ({ hex, small }) => {
  if (!hex) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-700 dark:text-zinc-300 font-mono ${small ? 'text-[8px]' : 'text-[9px]'} font-semibold border border-zinc-200 dark:border-zinc-700`}
      title={hex}>
      <Hexagon size={7} className="text-zinc-400" />
      {hex.slice(-7)}
    </span>
  );
};

const FilterDropdown = ({ label, value, onChange, options }) => (
  <div className="relative">
    <select value={value} onChange={e => onChange(e.target.value)}
      className="appearance-none pl-3 pr-7 py-2 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-zinc-300 dark:focus:ring-zinc-600 cursor-pointer min-w-[100px]">
      <option value="">{label}</option>
      {options.map(o => typeof o === 'string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>
      )}
    </select>
    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
  </div>
);

const getUserName = (user) => {
  if (!user) return 'Unknown';
  const p = user.profile || {};
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || user.email || 'Unknown';
};

const getInitials = (user) => {
  const name = getUserName(user);
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const timeAgo = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// ─── DETAIL PANEL ─────────────────────────────────────────────────

const EmployeeDetailPanel = ({ employee, detail, serviceAreas, onClose, onEdit, onStatusChange, onOnboardingUpdate }) => {
  const [tab, setTab] = useState('overview');
  const ed = employee.employeeDetails || {};
  const tabs = ['overview', 'permissions', 'activity', 'onboarding'];

  const onboardingItems = [
    { key: 'systemAccess', label: 'System & Email Access' },
    { key: 'training', label: 'Role Training Completed' },
    { key: 'documentation', label: 'Documentation Reviewed' },
    { key: 'teamIntro', label: 'Team Introduction Done' },
    { key: 'mentorAssigned', label: 'Mentor Assigned' },
  ];

  const completedCount = onboardingItems.filter(i => ed.onboarding?.[i.key]).length;
  const progressPct = Math.round((completedCount / onboardingItems.length) * 100);

  // Get area info for this employee
  const areaInfo = ed.location?.areaKey && serviceAreas?.[ed.location.areaKey] ? serviceAreas[ed.location.areaKey] : null;
  const areaRideStats = detail?.areaRideStats;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-white dark:bg-zinc-950 shadow-sm z-50 flex flex-col overflow-hidden border-l border-zinc-200 dark:border-zinc-800">
      {/* Header */}
      <div className="p-5 border-b flex items-start gap-4 bg-white dark:bg-zinc-900 flex-shrink-0">
        <div className="w-14 h-14 rounded-lg flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: ROLE_COLORS[employee.role]?.bg || '#e0e7ff', color: ROLE_COLORS[employee.role]?.text || '#4338ca' }}>
          {getInitials(employee)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-zinc-900 truncate">
            {getUserName(employee)}
          </h2>
          <p className="text-xs text-zinc-400 truncate">{ed.designation || employee.role} · {ed.employeeId || '—'}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <RoleBadge role={employee.role} />
            <StatusBadge status={ed.status || 'ACTIVE'} />
            {ed.location?.zone && <ZoneBadge zone={ed.location.zone} />}
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <button onClick={() => onEdit(employee)} title="Edit"
            className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition">
            <Pencil size={14} />
          </button>
          <button onClick={onClose} title="Close"
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b px-4 flex-shrink-0">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-2.5 text-xs font-semibold capitalize border-b-2 transition ${tab === t ? 'text-zinc-900 border-zinc-900' : 'text-zinc-400 border-transparent hover:text-zinc-600'
              }`}>
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {tab === 'overview' && (
          <>
            {/* Contact */}
            <Section title="Contact">
              <InfoRow label="Email" value={employee.email} />
              <InfoRow label="Phone" value={employee.phone || '—'} />
              {ed.emergencyContact?.name && (
                <InfoRow label="Emergency" value={`${ed.emergencyContact.name} (${ed.emergencyContact.relationship || 'Contact'}) — ${ed.emergencyContact.phone || ''}`} />
              )}
            </Section>

            <Section title="Employment Details">
              <InfoRow label="Type" value={ed.employeeType?.replace('_', ' ') || 'Full Time'} />
              <InfoRow label="Department" value={ed.department || '—'} />
              {ed.subDepartment && <InfoRow label="Sub-Dept" value={ed.subDepartment} />}
              {ed.team && <InfoRow label="Team" value={ed.team} />}
              <InfoRow label="Hired" value={ed.hiredAt ? new Date(ed.hiredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
              {ed.confirmationDate && <InfoRow label="Confirmed" value={new Date(ed.confirmationDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />}
              {ed.lastPromotionDate && <InfoRow label="Last Promotion" value={new Date(ed.lastPromotionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />}
            </Section>

            {/* Location — Geo-coordinate-first display */}
            <Section title="Location & Schedule">
              <InfoRow label="Service Area" value={
                <span className="flex items-center gap-1.5">
                  <span className="font-semibold text-zinc-800">{ed.location?.city || '—'}</span>
                  {ed.location?.zone && <ZoneBadge zone={ed.location.zone} />}
                </span>
              } />
              {ed.location?.coordinates && (
                <InfoRow label="Coordinates" value={
                  <div className="flex items-center gap-1.5">
                    <CoordDisplay coordinates={ed.location.coordinates} />
                    <a href={`https://maps.google.com/?q=${ed.location.coordinates[1]},${ed.location.coordinates[0]}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-zinc-400 hover:text-zinc-900 text-[10px]" title="Open in Google Maps">
                      <ExternalLink size={12} />
                    </a>
                  </div>
                } />
              )}
              {ed.location?.state && <InfoRow label="State" value={ed.location.state} />}
              <InfoRow label="Office" value={ed.location?.office || '—'} />
              {ed.location?.officeAddress && (
                <div className="text-[10px] text-zinc-400 pl-5 -mt-1 mb-1">{ed.location.officeAddress}</div>
              )}
              {/* H3 Hex Indexes */}
              {ed.location?.h3Index && (
                <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 mt-2 space-y-1.5">
                  <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Hexagon size={8} />H3 Spatial Index
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div className="text-[9px]">
                      <span className="text-zinc-500">Zone R7</span>
                      <div className="font-mono text-[8px] text-zinc-500 truncate" title={ed.location.h3Index}>{ed.location.h3Index}</div>
                    </div>
                    {ed.location.h3Neighborhood && (
                      <div className="text-[9px]">
                        <span className="text-zinc-500">Nbhd R8</span>
                        <div className="font-mono text-[8px] text-zinc-500 truncate" title={ed.location.h3Neighborhood}>{ed.location.h3Neighborhood}</div>
                      </div>
                    )}
                    {ed.location.h3Block && (
                      <div className="text-[9px]">
                        <span className="text-zinc-500">Block R9</span>
                        <div className="font-mono text-[8px] text-zinc-500 truncate" title={ed.location.h3Block}>{ed.location.h3Block}</div>
                      </div>
                    )}
                    {ed.location.h3Metro && (
                      <div className="text-[9px]">
                        <span className="text-zinc-500">Metro R5</span>
                        <div className="font-mono text-[8px] text-zinc-500 truncate" title={ed.location.h3Metro}>{ed.location.h3Metro}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <InfoRow label="Shift" value={`${ed.shift?.schedule || 'MORNING'} (${ed.shift?.startTime || '09:00'} – ${ed.shift?.endTime || '18:00'})`} />
            </Section>

            {/* Area Ride Stats (cross-area awareness) */}
            {areaRideStats && (
              <Section title="Area Ride Activity (7d)">
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{areaRideStats.local}</div>
                    <div className="text-[9px] text-zinc-500 font-semibold">LOCAL</div>
                  </div>
                  <div className="bg-zinc-50 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-zinc-700">{areaRideStats.inbound}</div>
                    <div className="text-[9px] text-zinc-500 font-semibold">INBOUND</div>
                  </div>
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-2 text-center">
                    <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{areaRideStats.outbound}</div>
                    <div className="text-[9px] text-zinc-500 font-semibold">OUTBOUND</div>
                  </div>
                </div>
                <div className="text-[10px] text-zinc-400">
                  {areaRideStats.last7Days} total rides in {areaRideStats.areaName} · {areaRideStats.crossArea} cross-area
                </div>
              </Section>
            )}

            {/* Hierarchy */}
            <Section title="Organization">
              <InfoRow label="Level" value={`L${ed.hierarchy?.level || 7} — ${HIERARCHY_LABELS[ed.hierarchy?.level || 7]}`} />
              {detail?.employee?.employeeDetails?.hierarchy?.reportsTo && (
                <InfoRow label="Reports To" value={getUserName(detail.employee.employeeDetails.hierarchy.reportsTo)} />
              )}
              {detail?.directReports?.length > 0 && (
                <>
                  <InfoRow label="Direct Reports" value={`${detail.directReports.length} people`} />
                  <div className="space-y-1 mt-1">
                    {detail.directReports.slice(0, 5).map(r => (
                      <div key={r._id} className="flex items-center gap-2 text-[11px] pl-5">
                        <span className="text-zinc-600">{getUserName(r)}</span>
                        <span className="text-zinc-300">·</span>
                        <span className="text-zinc-400">{r.employeeDetails?.location?.city || ''}</span>
                      </div>
                    ))}
                    {detail.directReports.length > 5 && <div className="text-[10px] text-zinc-400 pl-5">+{detail.directReports.length - 5} more</div>}
                  </div>
                </>
              )}
            </Section>

            {/* Skills & Tags */}
            {((ed.skills?.length > 0) || (ed.tags?.length > 0)) && (
              <Section title="Skills & Tags">
                {ed.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {ed.skills.map((s, i) => (
                      <span key={i} className="px-2 py-0.5 bg-zinc-50 text-zinc-600 text-[10px] font-medium rounded-md">{s}</span>
                    ))}
                  </div>
                )}
                {ed.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {ed.tags.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-zinc-100 text-zinc-500 text-[10px] font-medium rounded-md">#{t}</span>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {ed.notes && (
              <Section title="Notes">
                <p className="text-xs text-zinc-600 leading-relaxed">{ed.notes}</p>
              </Section>
            )}

            {/* Status Management */}
            <Section title="Status Management">
              <div className="flex flex-wrap gap-1">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <button key={key}
                    onClick={() => key !== (ed.status || 'ACTIVE') && onStatusChange(employee._id, key)}
                    disabled={key === (ed.status || 'ACTIVE') || employee.role === 'ADMIN' || employee.role === 'SUPER_ADMIN'}
                    className="px-2.5 py-1 text-[10px] font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 transition disabled:opacity-30 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    style={{
                      background: key === (ed.status || 'ACTIVE') ? '#f4f4f5' : 'white',
                      color: key === (ed.status || 'ACTIVE') ? '#18181b' : '#a1a1aa',
                      fontWeight: key === (ed.status || 'ACTIVE') ? 700 : 600
                    }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Peers */}
            {detail?.peers?.length > 0 && (
              <Section title={`Peers in ${ed.department || 'Dept'}`}>
                <div className="space-y-1">
                  {detail.peers.slice(0, 5).map(p => (
                    <div key={p._id} className="flex items-center gap-2 text-xs py-1">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold"
                        style={{ background: ROLE_COLORS[p.role]?.bg || '#e0e7ff', color: ROLE_COLORS[p.role]?.text || '#4338ca' }}>
                        {getInitials(p)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-zinc-700 font-medium truncate block">{getUserName(p)}</span>
                      </div>
                      <span className="text-[10px] text-zinc-400">{p.employeeDetails?.location?.city || ''}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </>
        )}

        {tab === 'permissions' && (
          <>
            <div className="space-y-3">
              {['User Management', 'Ride Operations', 'Financial', 'Reports & Safety', 'Fleet', 'Platform'].map(group => {
                const groupPerms = (ed.permissions || []).filter(pk => {
                  const all = [
                    { key: 'manage_users', group: 'User Management' }, { key: 'view_users', group: 'User Management' },
                    { key: 'manage_rides', group: 'Ride Operations' }, { key: 'view_rides', group: 'Ride Operations' },
                    { key: 'manage_bookings', group: 'Ride Operations' }, { key: 'view_bookings', group: 'Ride Operations' },
                    { key: 'manage_finances', group: 'Financial' }, { key: 'manage_payouts', group: 'Financial' },
                    { key: 'manage_reports', group: 'Reports & Safety' }, { key: 'view_reports', group: 'Reports & Safety' },
                    { key: 'manage_reviews', group: 'Reports & Safety' },
                    { key: 'manage_verifications', group: 'Fleet' },
                    { key: 'manage_settings', group: 'Platform' },
                  ];
                  return all.find(a => a.key === pk && a.group === group);
                });
                if (!groupPerms.length) return null;
                return (
                  <div key={group}>
                    <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{group}</h5>
                    <div className="flex flex-wrap gap-1">
                      {groupPerms.map(p => (
                        <span key={p} className="px-2 py-0.5 bg-zinc-50 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 text-[10px] font-medium rounded-md ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700">
                          <Check size={8} className="mr-0.5" />{p.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Permission scope — geo-aware display */}
            {((ed.permissionScope?.locations?.length > 0) || (ed.permissionScope?.departments?.length > 0)) && (
              <div className="mt-4 space-y-3">
                {ed.permissionScope?.locations?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Geo Location Scope</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ed.permissionScope.locations.map(aKey => {
                        const area = serviceAreas?.[aKey];
                        const center = normalizeLngLat(area?.center);
                        return (
                          <span key={aKey} className="px-2 py-0.5 bg-zinc-50 text-zinc-700 text-[10px] font-medium rounded-md ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700">
                            <MapPin size={8} className="mr-0.5" />
                            {area?.name || aKey}
                            {center && <span className="text-zinc-400 ml-1">[{center.lat.toFixed(2)}, {center.lng.toFixed(2)}]</span>}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {ed.permissionScope?.departments?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 uppercase">Department Scope</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ed.permissionScope.departments.map(d => (
                        <span key={d} className="px-2 py-0.5 bg-zinc-50 text-zinc-700 text-[10px] font-medium rounded-md ring-1 ring-inset ring-zinc-200 dark:ring-zinc-700">
                          <Building2 size={8} className="mr-0.5" />{d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {!ed.permissionScope?.locations?.length && !ed.permissionScope?.departments?.length && (
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 text-xs text-zinc-600 dark:text-zinc-400 mt-3">
                <Globe size={12} className="mr-1.5 inline" />
                This employee has <strong>global access</strong> — no geographic or department restrictions applied.
              </div>
            )}
          </>
        )}

        {tab === 'activity' && (
          <div className="space-y-4">
            {detail?.recentActions?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Actions by this employee</h4>
                <div className="space-y-1.5">
                  {detail.recentActions.slice(0, 15).map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.severity === 'HIGH' ? 'bg-red-400' : a.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-zinc-300'
                        }`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-zinc-600">{a.description || a.action}</span>
                        <span className="text-zinc-300 ml-1.5">{timeAgo(a.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {detail?.actionsOnEmployee?.length > 0 && (
              <div>
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Actions on this employee</h4>
                <div className="space-y-1.5">
                  {detail.actionsOnEmployee.slice(0, 15).map((a, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px]">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${a.severity === 'HIGH' ? 'bg-red-400' : a.severity === 'MEDIUM' ? 'bg-amber-400' : 'bg-zinc-300'
                        }`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-zinc-600">{a.description || a.action}</span>
                        {a.actor && <span className="text-zinc-400 ml-1">by {getUserName(a.actor)}</span>}
                        <span className="text-zinc-300 ml-1.5">{timeAgo(a.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!detail?.recentActions?.length && !detail?.actionsOnEmployee?.length && (
              <p className="text-xs text-zinc-400 text-center py-8">No activity recorded yet</p>
            )}
          </div>
        )}

        {tab === 'onboarding' && (
          <>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-600">{completedCount}/{onboardingItems.length} completed</span>
                <span className="text-xs font-bold" style={{ color: progressPct === 100 ? '#16a34a' : '#d97706' }}>{progressPct}%</span>
              </div>
              <div className="w-full bg-zinc-200 rounded-full h-2.5">
                <div className="h-2.5 rounded-full transition-all" style={{
                  width: `${progressPct}%`,
                  backgroundColor: progressPct === 100 ? '#16a34a' : progressPct > 50 ? '#d97706' : '#ef4444'
                }} />
              </div>
            </div>

            <div className="space-y-2">
              {onboardingItems.map(item => {
                const checked = ed.onboarding?.[item.key] || false;
                return (
                  <div key={item.key}
                    onClick={() => onOnboardingUpdate(employee._id, item.key, !checked)}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition hover:shadow-sm ${checked ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700' : 'bg-white border-zinc-200 hover:border-zinc-300'
                      }`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${checked ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400'
                      }`}>
                      {checked ? <Check size={14} /> : <span className="w-3.5 h-3.5 rounded border border-zinc-300 dark:border-zinc-600" />}
                    </div>
                    <span className={`text-sm font-medium ${checked ? 'text-zinc-500 line-through' : 'text-zinc-700'}`}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// Small helpers
const Section = ({ title, children }) => (
  <div>
    <h4 className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">{title}</h4>
    {children}
  </div>
);

const InfoRow = ({ label, value }) => (
  <div className="flex items-center py-1.5 text-xs border-b border-zinc-100 dark:border-zinc-800 last:border-0">
    <span className="text-zinc-400 w-24 flex-shrink-0">{label}</span>
    <span className="text-zinc-700 dark:text-zinc-300 font-medium flex-1 truncate">{typeof value === 'string' ? value : <span>{value}</span>}</span>
  </div>
);

// ─── CREATE / EDIT MODAL (geo-coordinate-first) ──────────────────

const EmployeeModal = ({ open, editMode, form, setForm, onSubmit, onClose, submitting, allPermissions, roleDefaults, managers, serviceAreas, showMapPicker, setShowMapPicker }) => {
  // Hooks MUST be called before any conditional return (React rules of hooks)
  const permissionGroups = useMemo(() => {
    const groups = {};
    (allPermissions || []).forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    return groups;
  }, [allPermissions]);

  if (!open) return null;

  const togglePerm = (key) => {
    setForm(f => ({
      ...f,
      permissions: f.permissions.includes(key)
        ? f.permissions.filter(p => p !== key)
        : [...f.permissions, key]
    }));
  };

  // When role changes, auto-update permissions
  const handleRoleChange = (newRole) => {
    setForm(f => ({
      ...f,
      role: newRole,
      permissions: roleDefaults?.[newRole] || f.permissions
    }));
  };

  // When area changes, auto-set office to first in that area
  const handleAreaChange = (newAreaKey) => {
    setForm(f => ({ ...f, areaKey: newAreaKey, officeIndex: 0 }));
  };

  const selectedArea = serviceAreas?.[form.areaKey];
  const areaList = Object.entries(serviceAreas || {});

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm w-full max-w-[680px] max-h-[90vh] flex flex-col overflow-hidden">

        {/* Modal Header */}
        <div className="p-5 border-b flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">
              {editMode ? 'Edit Employee' : 'Add New Employee'}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">{editMode ? 'Update employee details, access, and geo-location' : 'Onboard a new team member with real coordinates'}</p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 rounded-lg hover:bg-zinc-100 transition">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Section: Personal Info ── */}
          <FormSection title="Personal Information" num="1">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="First Name *" value={form.firstName} onChange={v => setForm(f => ({ ...f, firstName: v }))} required />
              <FormField label="Last Name" value={form.lastName} onChange={v => setForm(f => ({ ...f, lastName: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Email *" type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} required disabled={editMode} />
              <FormField label="Phone *" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} required placeholder="+91..." />
            </div>
            {!editMode && (
              <FormField label="Password *" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))} required />
            )}
          </FormSection>

          {/* ── Section: Employment ── */}
          <FormSection title="Employment" num="2">
            <div className="grid grid-cols-2 gap-3">
              <FormSelect label="Role" value={form.role} onChange={handleRoleChange}
                options={EMPLOYEE_ROLES.map(r => ({ value: r, label: ROLE_LABELS[r] || r }))} />
              <FormSelect label="Type" value={form.employeeType} onChange={v => setForm(f => ({ ...f, employeeType: v }))}
                options={EMPLOYEE_TYPES.map(t => ({ value: t, label: t.replace('_', ' ') }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Designation" value={form.designation} onChange={v => setForm(f => ({ ...f, designation: v }))} placeholder="Sr. Operations Manager" />
              <FormSelect label="Department" value={form.department} onChange={v => setForm(f => ({ ...f, department: v }))}
                options={DEPARTMENTS.map(d => ({ value: d, label: d }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Sub-Department" value={form.subDepartment} onChange={v => setForm(f => ({ ...f, subDepartment: v }))} placeholder="Driver Ops" />
              <FormField label="Team" value={form.team} onChange={v => setForm(f => ({ ...f, team: v }))} placeholder="Alpha Squad" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormSelect label="Hierarchy Level" value={form.hierarchyLevel} onChange={v => setForm(f => ({ ...f, hierarchyLevel: parseInt(v) }))}
                options={[1, 2, 3, 4, 5, 6, 7].map(l => ({ value: l, label: `L${l} — ${HIERARCHY_LABELS[l]}` }))} />
              <FormSelect label="Reports To" value={form.reportsTo} onChange={v => setForm(f => ({ ...f, reportsTo: v }))}
                options={(managers || []).map(m => ({ value: m._id, label: `${getUserName(m)} (${m.employeeDetails?.employeeId || m.role})` }))}
                emptyLabel="Select Manager" />
            </div>
          </FormSection>

          {/* ── Section: Zone Allocation & Schedule ── */}
          <FormSection title="Territory & Schedule" num="3">
            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg p-2.5 text-xs text-zinc-700 dark:text-zinc-300 mb-1">
              <Hexagon size={10} className="mr-1.5" />
              Allocate <strong>hex zones</strong> on the interactive map to define this employee's territory. Click individual hexes or use <strong>bulk select</strong> per area.
            </div>

            {/* ZONE ALLOCATOR BUTTON */}
            <button
              type="button"
              onClick={() => setShowMapPicker(true)}
              className="w-full py-3.5 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-lg text-sm font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition shadow-sm flex items-center justify-center gap-2 mb-3"
            >
              <MapPin size={14} />
              {form.assignedZones?.length > 0 ? `Edit Zone Allocation (${form.assignedZones.length} zones)` : 'Allocate Zones on Map'}
              <ExternalLink size={10} className="opacity-60" />
            </button>

            {/* Zone allocation summary */}
            {form.assignedZones?.length > 0 && (
              <div className="bg-zinc-900 rounded-lg p-3 text-white text-xs space-y-2 mb-3 border border-zinc-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                    <span className="font-semibold text-zinc-300">{form.assignedZones.length} Zones Allocated</span>
                  </div>
                  <span className="text-white/30 text-[10px]">{(form.assignedZones.length * 5.16).toFixed(1)} km²</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const primary = form.assignedZones.filter(z => z.role === 'PRIMARY').length;
                    const backup = form.assignedZones.filter(z => z.role === 'BACKUP').length;
                    const escalation = form.assignedZones.filter(z => z.role === 'ESCALATION').length;
                    return (
                      <>
                        {primary > 0 && <span className="px-2 py-0.5 rounded-md bg-zinc-700 text-zinc-300 text-[10px] font-bold"><Star size={8} className="mr-0.5" />{primary} primary</span>}
                        {backup > 0 && <span className="px-2 py-0.5 rounded-md bg-zinc-700 text-zinc-300 text-[10px] font-bold"><Shield size={8} className="mr-0.5" />{backup} backup</span>}
                        {escalation > 0 && <span className="px-2 py-0.5 rounded-md bg-zinc-700 text-zinc-400 text-[10px] font-bold"><ArrowUp size={8} className="mr-0.5" />{escalation} escalation</span>}
                      </>
                    );
                  })()}
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-white/50 text-[10px] font-semibold">
                    {form.jurisdictionType} · {form.jurisdictionCoverage}
                  </span>
                </div>
                {form.crossAreaCorridors?.length > 0 && (
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400">
                    <Route size={8} />
                    {form.crossAreaCorridors.length} cross-area corridor{form.crossAreaCorridors.length !== 1 ? 's' : ''}
                  </div>
                )}
                {form.coordinates && (
                  <a href={`https://maps.google.com/?q=${form.coordinates[1]},${form.coordinates[0]}`}
                    target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-zinc-400 hover:text-zinc-300 inline-flex items-center gap-1">
                    <ExternalLink size={12} /> View centroid on Google Maps
                  </a>
                )}
              </div>
            )}

            {/* Fallback: Base area (used if no map allocation) */}
            {!form.assignedZones?.length && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Base Service Area</label>
                  <select value={form.areaKey} onChange={e => handleAreaChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 bg-white">
                    {areaList.map(([key, area]) => (
                      <option key={key} value={key}>{area.name} — {area.zone}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 mb-1">Office</label>
                  <select value={form.officeIndex} onChange={e => setForm(f => ({ ...f, officeIndex: parseInt(e.target.value) }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 bg-white">
                    {(selectedArea?.offices || []).map((off, idx) => (
                      <option key={idx} value={idx}>{off.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <FormSelect label="Shift" value={form.shiftSchedule} onChange={v => setForm(f => ({ ...f, shiftSchedule: v }))}
                options={SHIFT_TYPES.map(s => ({ value: s, label: s }))} />
              <FormField label="Start Time" type="time" value={form.shiftStart} onChange={v => setForm(f => ({ ...f, shiftStart: v }))} />
              <FormField label="End Time" type="time" value={form.shiftEnd} onChange={v => setForm(f => ({ ...f, shiftEnd: v }))} />
            </div>
          </FormSection>

          {/* ── Section: Permissions ── */}
          <FormSection title="Access & Permissions" num="4">
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-2.5 text-xs text-zinc-700 mb-3">
              <Info size={12} className="mr-1.5 inline" />
              Default permissions are auto-applied based on role. You can customize below.
            </div>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {Object.entries(permissionGroups).map(([group, perms]) => (
                <div key={group}>
                  <h5 className="text-[10px] font-bold text-zinc-500 uppercase mb-1">{group}</h5>
                  <div className="space-y-1">
                    {perms.map(p => (
                      <label key={p.key} className="flex items-center gap-2 text-xs py-1 px-2 rounded-lg hover:bg-zinc-50 cursor-pointer">
                        <input type="checkbox" checked={form.permissions.includes(p.key)} onChange={() => togglePerm(p.key)}
                          className="rounded text-zinc-900 h-3.5 w-3.5" />
                        <span className="text-zinc-700 font-medium">{p.label}</span>
                        <span className="text-zinc-400 text-[10px] ml-auto">{p.desc}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Geo Location Scope */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">Geo Location Scope</label>
                <div className="max-h-28 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {areaList.map(([key, area]) => (
                    <label key={key} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox"
                        checked={(form.permissionLocations || []).includes(key)}
                        onChange={() => {
                          setForm(f => ({
                            ...f,
                            permissionLocations: f.permissionLocations.includes(key)
                              ? f.permissionLocations.filter(x => x !== key)
                              : [...f.permissionLocations, key]
                          }));
                        }}
                        className="rounded text-zinc-900 h-3 w-3" />
                      <span className="text-zinc-600">{area.name}</span>
                      <span className="text-zinc-300 text-[9px] ml-auto">{area.zone}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[9px] text-zinc-400 mt-0.5">Empty = global access across all service areas</p>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">Department Scope</label>
                <div className="max-h-28 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {DEPARTMENTS.map(d => (
                    <label key={d} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox"
                        checked={(form.permissionDepartments || []).includes(d)}
                        onChange={() => {
                          setForm(f => ({
                            ...f,
                            permissionDepartments: f.permissionDepartments.includes(d)
                              ? f.permissionDepartments.filter(x => x !== d)
                              : [...f.permissionDepartments, d]
                          }));
                        }}
                        className="rounded text-zinc-900 h-3 w-3" />
                      <span className="text-zinc-600">{d}</span>
                    </label>
                  ))}
                </div>
                <p className="text-[9px] text-zinc-400 mt-0.5">Empty = all departments</p>
              </div>
            </div>
          </FormSection>

          {/* ── Section: Additional ── */}
          <FormSection title="Additional Info" num="5">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Skills (comma-separated)" value={form.skills} onChange={v => setForm(f => ({ ...f, skills: v }))} placeholder="Python, Data Analysis" />
              <FormField label="Languages" value={form.languages} onChange={v => setForm(f => ({ ...f, languages: v }))} placeholder="English, Hindi, Tamil" />
            </div>
            <FormField label="Notes" value={form.notes} onChange={v => setForm(f => ({ ...f, notes: v }))} textarea placeholder="Internal notes..." />
            <FormField label="Tags (comma-separated)" value={form.tags} onChange={v => setForm(f => ({ ...f, tags: v }))} placeholder="high-performer, training" />

            {/* Emergency Contact */}
            <div className="border-t pt-3 mt-2">
              <h5 className="text-[10px] font-bold text-zinc-400 uppercase mb-2"><Heart size={10} className="mr-1 inline" />Emergency Contact</h5>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Name" value={form.emergencyContactName} onChange={v => setForm(f => ({ ...f, emergencyContactName: v }))} />
                <FormField label="Phone" value={form.emergencyContactPhone} onChange={v => setForm(f => ({ ...f, emergencyContactPhone: v }))} />
                <FormField label="Relation" value={form.emergencyContactRelation} onChange={v => setForm(f => ({ ...f, emergencyContactRelation: v }))} placeholder="Spouse" />
              </div>
            </div>
          </FormSection>
        </form>

        {/* Footer */}
        <div className="p-4 border-t flex items-center gap-3 flex-shrink-0 bg-zinc-50/50">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 border rounded-lg text-sm font-medium text-zinc-500 hover:bg-zinc-100 transition">
            Cancel
          </button>
          <button type="submit" onClick={onSubmit} disabled={submitting}
            className="flex-1 py-2.5 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-950 transition disabled:opacity-50">
            {submitting ? <><Loader2 size={14} className="mr-1.5 animate-spin" />Saving...</> : editMode ? 'Update Employee' : 'Create Employee'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Form field helpers ──

const FormField = ({ label, value, onChange, type = 'text', required, placeholder, disabled, textarea }) => (
  <div>
    <label className="block text-[11px] font-semibold text-zinc-500 mb-1">{label}</label>
    {textarea ? (
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        rows={2} className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400 resize-none" />
    ) : (
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        required={required} placeholder={placeholder} disabled={disabled}
        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400 disabled:bg-zinc-50 disabled:text-zinc-400" />
    )}
  </div>
);

const FormSelect = ({ label, value, onChange, options, emptyLabel }) => (
  <div>
    <label className="block text-[11px] font-semibold text-zinc-500 mb-1">{label}</label>
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400 bg-white">
      {emptyLabel && <option value="">{emptyLabel}</option>}
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  </div>
);

const FormSection = ({ title, num, children }) => (
  <div className="relative">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0">{num}</div>
      <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{title}</h3>
    </div>
    <div className="space-y-3 pl-8">{children}</div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

const AdminEmployees = () => {
  // ── State ──
  const [employees, setEmployees] = useState([]);
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState({ allPermissions: [], roleDefaults: {}, serviceAreas: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  // Filters
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterArea, setFilterArea] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Detail panel
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeDetail, setEmployeeDetail] = useState(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ ...INIT_FORM });
  const [submitting, setSubmitting] = useState(false);

  // Managers list for dropdown
  const [managers, setManagers] = useState([]);

  // Map picker
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Service areas from backend
  const serviceAreas = meta.serviceAreas || {};

  // ── Data Fetching ──
  const fetchStats = useCallback(async () => {
    try {
      const res = await adminService.getEmployeeStats();
      if (res.success) {
        setStats(res.stats);
        setMeta(res.meta || {});
      }
    } catch (err) {
      console.error('Stats fetch failed:', err);
    }
  }, []);

  const fetchEmployees = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 25 };
      if (search) params.search = search;
      if (filterRole) params.role = filterRole;
      if (filterDept) params.department = filterDept;
      if (filterArea) params.areaKey = filterArea;
      if (filterStatus) params.status = filterStatus;

      const res = await adminService.getEmployees(params);
      if (res.success) {
        setEmployees(res.employees || []);
        setPagination(res.pagination || { page: 1, pages: 1, total: 0 });
        setManagers((res.employees || []).filter(e => ['ADMIN', 'SUPER_ADMIN', 'OPERATIONS_MANAGER'].includes(e.role)));
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [search, filterRole, filterDept, filterArea, filterStatus]);

  const fetchEmployeeDetail = useCallback(async (id) => {
    try {
      const res = await adminService.getEmployeeById(id);
      if (res.success) setEmployeeDetail(res);
    } catch (err) {
      console.error('Detail fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchEmployees();
  }, []);

  // Debounced search
  useEffect(() => {
    const timeout = setTimeout(() => fetchEmployees(), 400);
    return () => clearTimeout(timeout);
  }, [search, filterRole, filterDept, filterArea, filterStatus]);

  // ── Handlers ──
  const handleSelectEmployee = (emp) => {
    setSelectedEmployee(emp);
    fetchEmployeeDetail(emp._id);
  };

  const handleCreate = async (e) => {
    e?.preventDefault?.();
    try {
      setSubmitting(true);
      setError('');
      const payload = {
        ...formData,
        skills: typeof formData.skills === 'string' ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : formData.skills,
        languages: typeof formData.languages === 'string' ? formData.languages.split(',').map(s => s.trim()).filter(Boolean) : formData.languages,
        tags: typeof formData.tags === 'string' ? formData.tags.split(',').map(s => s.trim()).filter(Boolean) : formData.tags,
      };
      // If coordinates were picked on map, send them
      if (formData.coordinates) {
        payload.coordinates = formData.coordinates;
      }
      const res = await adminService.createEmployee(payload);
      if (res.success) {
        setShowModal(false);
        setFormData({ ...INIT_FORM });
        fetchEmployees();
        fetchStats();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (e) => {
    e?.preventDefault?.();
    if (!selectedEmployee) return;
    try {
      setSubmitting(true);
      setError('');
      const payload = {
        ...formData,
        skills: typeof formData.skills === 'string' ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : formData.skills,
        languages: typeof formData.languages === 'string' ? formData.languages.split(',').map(s => s.trim()).filter(Boolean) : formData.languages,
        tags: typeof formData.tags === 'string' ? formData.tags.split(',').map(s => s.trim()).filter(Boolean) : formData.tags,
      };
      if (formData.coordinates) {
        payload.coordinates = formData.coordinates;
      }
      const res = await adminService.updateEmployee(selectedEmployee._id, payload);
      if (res.success) {
        setShowModal(false);
        setEditMode(false);
        fetchEmployees();
        fetchStats();
        if (selectedEmployee) fetchEmployeeDetail(selectedEmployee._id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (empId, newStatus) => {
    try {
      const res = await adminService.updateEmployeeStatus(empId, { status: newStatus });
      if (res.success) {
        fetchEmployees();
        fetchStats();
        if (selectedEmployee?._id === empId) fetchEmployeeDetail(empId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Status update failed');
    }
  };

  const handleOnboardingUpdate = async (empId, field, value) => {
    try {
      const res = await adminService.updateEmployeeOnboarding(empId, { field, value });
      if (res.success && selectedEmployee?._id === empId) {
        fetchEmployeeDetail(empId);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Onboarding update failed');
    }
  };

  const openCreate = () => {
    setFormData({ ...INIT_FORM, permissions: meta.roleDefaults?.SUPPORT_AGENT || [] });
    setEditMode(false);
    setShowModal(true);
  };

  const handleMapConfirm = useCallback((locationData) => {
    setFormData(f => ({
      ...f,
      coordinates: locationData.coordinates,
      h3Index: locationData.h3Index,
      areaKey: locationData.areaKey || f.areaKey,
      // Zone allocation data
      assignedZones: locationData.assignedZones || f.assignedZones,
      jurisdictionType: locationData.jurisdictionType || f.jurisdictionType,
      jurisdictionCoverage: locationData.jurisdictionCoverage || f.jurisdictionCoverage,
      autoExpand: locationData.autoExpand ?? f.autoExpand,
      crossAreaCorridors: locationData.crossAreaCorridors || f.crossAreaCorridors,
    }));
  }, []);

  const openEdit = (emp) => {
    const ed = emp.employeeDetails || {};
    setFormData({
      firstName: emp.profile?.firstName || '',
      lastName: emp.profile?.lastName || '',
      email: emp.email || '',
      phone: emp.phone || '',
      password: '',
      role: emp.role || 'SUPPORT_AGENT',
      designation: ed.designation || '',
      employeeType: ed.employeeType || 'FULL_TIME',
      department: ed.department || 'Operations',
      subDepartment: ed.subDepartment || '',
      team: ed.team || '',
      areaKey: ed.location?.areaKey || 'chennai',
      officeIndex: 0,  // will pick first office in that area
      coordinates: ed.location?.coordinates || null,
      h3Index: ed.location?.h3Index || null,
      shiftSchedule: ed.shift?.schedule || 'MORNING',
      shiftStart: ed.shift?.startTime || '09:00',
      shiftEnd: ed.shift?.endTime || '18:00',
      hierarchyLevel: ed.hierarchy?.level || 7,
      reportsTo: ed.hierarchy?.reportsTo?._id || ed.hierarchy?.reportsTo || '',
      permissions: ed.permissions || [],
      permissionLocations: ed.permissionScope?.locations || [],
      permissionDepartments: ed.permissionScope?.departments || [],
      skills: (ed.skills || []).join(', '),
      languages: (ed.languages || []).join(', '),
      notes: ed.notes || '',
      tags: (ed.tags || []).join(', '),
      emergencyContactName: ed.emergencyContact?.name || '',
      emergencyContactPhone: ed.emergencyContact?.phone || '',
      emergencyContactRelation: ed.emergencyContact?.relationship || '',
      // Zone allocation
      assignedZones: (ed.assignedZones || []).map(z => ({ hex: z.hex, role: z.role || 'PRIMARY' })),
      jurisdictionType: ed.jurisdiction?.type || 'ZONE',
      jurisdictionCoverage: ed.jurisdiction?.coverage || 'SHARED',
      autoExpand: ed.jurisdiction?.autoExpand || false,
      crossAreaCorridors: (ed.crossAreaCorridors || []).map(c => ({ fromArea: c.fromArea, toArea: c.toArea })),
    });
    setSelectedEmployee(emp);
    setEditMode(true);
    setShowModal(true);
  };

  const handleExport = () => {
    const header = 'Employee ID,Name,Email,Phone,Role,Department,Area,Zone,Lat,Lng,H3 Index,Office,Level,Status,Type,Hired,Skills';
    const rows = employees.map(emp => {
      const ed = emp.employeeDetails || {};
      const coords = ed.location?.coordinates || [];
      return [
        ed.employeeId || '', getUserName(emp), emp.email, emp.phone || '',
        ROLE_LABELS[emp.role] || emp.role, ed.department || '',
        ed.location?.city || '', ed.location?.zone || '',
        toFiniteNumber(coords[1])?.toFixed(6) || '', toFiniteNumber(coords[0])?.toFixed(6) || '',
        ed.location?.h3Index || '',
        ed.location?.office || '',
        `L${ed.hierarchy?.level || 7}`, ed.status || 'ACTIVE',
        ed.employeeType || '', ed.hiredAt ? new Date(ed.hiredAt).toLocaleDateString() : '',
        (ed.skills || []).join('; ')
      ].map(v => `"${v}"`).join(',');
    });
    const blob = new Blob([header + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `looplane-employees-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Loading State ──
  if (loading && employees.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-zinc-900 mx-auto mb-3" />
          <p className="text-sm text-zinc-400">Loading workforce data...</p>
        </div>
      </div>
    );
  }

  // Build sorted area list for filter dropdown
  const areaFilterOptions = Object.entries(serviceAreas).map(([key, area]) => ({
    value: key,
    label: `${area.name} (${area.zone})`
  }));

  return (
    <div className="space-y-5 min-h-screen pb-8">

      {/* ═══ HEADER ═══ */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Employee Management
          </h1>
          <p className="text-zinc-400 text-sm mt-0.5">
            {pagination.total} team member{pagination.total !== 1 ? 's' : ''} across {stats?.departments || 0} departments · {stats?.locations || 0} service areas · H3 indexed
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport}
            className="px-3 py-2 border rounded-lg text-xs font-medium text-zinc-500 hover:bg-white hover:border-zinc-400 transition">
            <Download size={14} className="mr-1.5" />Export
          </button>
          <button onClick={openCreate}
            className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-sm font-semibold hover:bg-zinc-950 transition shadow-sm">
            <Plus size={14} className="mr-1.5" />Add Employee
          </button>
        </div>
      </div>

      {/* ═══ STATS DASHBOARD ═══ */}
      {stats && stats.total !== undefined && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="Total" value={stats.total} sub={`+${stats.hiresThisMonth || 0} this month`} />
          <StatCard label="Active" value={stats.active || 0} small />
          <StatCard label="On Leave" value={stats.onLeave || 0} small />
          <StatCard label="Probation" value={stats.probation || 0} small />
          <StatCard label="Notice" value={stats.noticePeriod || 0} small />
          <StatCard label="Departments" value={stats.departments || 0} small />
          <StatCard label="Onboarding" value={stats.onboardingPending || 0} sub="pending" small />
        </div>
      )}

      {/* ═══ GEO BREAKDOWN — Service Areas with Real Coords ═══ */}
      {stats && stats.byDepartment && stats.byLocation && (Object.keys(stats.byDepartment || {}).length > 0 || Object.keys(stats.byLocation || {}).length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* By Department */}
          {stats.byDepartment && Object.keys(stats.byDepartment).length > 0 && (
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">By Department</h3>
              <div className="space-y-1.5">
                {Object.entries(stats.byDepartment).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([dept, count]) => (
                  <div key={dept} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-600 w-32 truncate">{dept}</span>
                    <div className="flex-1 bg-zinc-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-zinc-400" style={{ width: `${(count / stats.total) * 100}%` }} />
                    </div>
                    <span className="text-xs text-zinc-500 font-mono w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* By Service Area — with coordinates + zone badges + ride overlay */}
          {Object.keys(stats.byLocation).length > 0 && (
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                <Hexagon size={10} className="mr-1 text-zinc-400" />By Service Area (H3 hex-indexed)
              </h3>
              <div className="space-y-2">
                {Object.entries(stats.byLocation).sort((a, b) => (b[1]?.count || b[1]) - (a[1]?.count || a[1])).slice(0, 8).map(([areaName, data]) => {
                  const count = typeof data === 'object' ? data.count : data;
                  const coords = typeof data === 'object' ? data.coordinates : null;
                  const parsedCoords = normalizeLngLat(coords);
                  const zone = typeof data === 'object' ? data.zone : null;
                  const areaKey = typeof data === 'object' ? data.areaKey : null;
                  const rideCount = areaKey ? (stats.ridesByArea?.[areaName] || 0) : 0;

                  return (
                    <div key={areaName} className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 w-36 flex-shrink-0">
                        <span className="text-xs text-zinc-700 font-medium truncate">{areaName}</span>
                        {zone && <ZoneBadge zone={zone} />}
                      </div>
                      <div className="flex-1 bg-zinc-100 rounded-full h-2 relative">
                        <div className="h-2 rounded-full bg-zinc-900" style={{ width: `${(count / stats.total) * 100}%` }} />
                      </div>
                      <span className="text-xs text-zinc-500 font-mono w-6 text-right">{count}</span>
                      {parsedCoords && (
                        <span className="text-[8px] font-mono text-zinc-300 w-28 text-right hidden xl:block">
                          {parsedCoords.lat.toFixed(2)}°, {parsedCoords.lng.toFixed(2)}°
                        </span>
                      )}
                      {rideCount > 0 && (
                        <span className="text-[9px] text-zinc-500 font-semibold w-16 text-right" title="Active rides in area">
                          <CarFront size={8} className="mr-0.5" />{rideCount}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ CROSS-AREA CORRIDOR STATS ═══ */}
      {stats?.crossAreaRides?.topCorridors?.length > 0 && (
        <div className="bg-white rounded-lg border shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              <Route size={12} className="mr-1 text-zinc-400" />Cross-Area Ride Corridors (30d)
            </h3>
            <span className="text-xs text-zinc-400">
              {stats.crossAreaRides.crossArea} of {stats.crossAreaRides.total} rides ({stats.crossAreaRides.crossAreaPct}%) cross areas
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.crossAreaRides.topCorridors.map((c, i) => (
              <div key={i} className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5">
                <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{c.corridor}</span>
                <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-700 px-1.5 rounded">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ERROR BANNER ═══ */}
      {error && (
        <div className="bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 p-3 rounded-lg border border-zinc-200 flex items-center justify-between text-sm">
          <span><AlertCircle size={14} className="mr-1.5" />{error}</span>
          <button onClick={() => setError('')} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
        </div>
      )}

      {/* ═══ TOOLBAR ═══ */}
      <div className="bg-white rounded-lg border shadow-sm p-3 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, ID, phone, city..."
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-zinc-300 focus:border-zinc-400"
          />
        </div>

        {/* Filters */}
        <FilterDropdown label="All Roles" value={filterRole}
          onChange={setFilterRole}
          options={[...EMPLOYEE_ROLES, 'ADMIN', 'SUPER_ADMIN'].map(r => ({ value: r, label: ROLE_LABELS[r] || r }))} />

        <FilterDropdown label="All Depts" value={filterDept}
          onChange={setFilterDept}
          options={DEPARTMENTS} />

        <FilterDropdown label="All Areas" value={filterArea}
          onChange={setFilterArea}
          options={areaFilterOptions} />

        <FilterDropdown label="All Status" value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'PROBATION', label: 'Probation' },
            { value: 'ON_LEAVE', label: 'On Leave' },
            { value: 'NOTICE_PERIOD', label: 'Notice Period' },
            { value: 'SUSPENDED', label: 'Suspended' },
            { value: 'inactive', label: 'Inactive' },
          ]} />

        {(search || filterRole || filterDept || filterArea || filterStatus) && (
          <button onClick={() => { setSearch(''); setFilterRole(''); setFilterDept(''); setFilterArea(''); setFilterStatus(''); }}
            className="px-2.5 py-2 text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition font-medium">
            <X size={12} className="inline mr-1" />Clear
          </button>
        )}
      </div>

      {/* ═══ EMPLOYEE TABLE ═══ */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50/80 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-zinc-400 text-[11px] uppercase tracking-wider">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-400 text-[11px] uppercase tracking-wider">ID</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-400 text-[11px] uppercase tracking-wider">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-400 text-[11px] uppercase tracking-wider">Department</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-400 text-[11px] uppercase tracking-wider">Service Area</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-400 text-[11px] uppercase tracking-wider">Level</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-400 text-[11px] uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 font-semibold text-zinc-400 text-[11px] uppercase tracking-wider">Hired</th>
                <th className="text-right px-4 py-3 font-semibold text-zinc-400 text-[11px] uppercase tracking-wider w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-50">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-16 text-zinc-400">
                    <Users size={40} className="mb-3 mx-auto opacity-30" />
                    <p className="font-medium">No employees match your filters</p>
                    <p className="text-xs mt-1">Try adjusting your search or filter criteria</p>
                  </td>
                </tr>
              ) : (
                employees.map(emp => {
                  const ed = emp.employeeDetails || {};
                  const isSelected = selectedEmployee?._id === emp._id;
                  return (
                    <tr key={emp._id}
                      onClick={() => handleSelectEmployee(emp)}
                      className={`cursor-pointer transition ${isSelected ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:bg-zinc-800'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: ROLE_COLORS[emp.role]?.bg || '#e0e7ff', color: ROLE_COLORS[emp.role]?.text || '#4338ca' }}>
                            {getInitials(emp)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-zinc-900 text-sm truncate">{getUserName(emp)}</p>
                            <p className="text-[11px] text-zinc-400 truncate">{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[11px] text-zinc-500 font-mono">{ed.employeeId || '—'}</span>
                      </td>
                      <td className="px-4 py-3"><RoleBadge role={emp.role} /></td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">{ed.department || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-xs text-zinc-700 font-medium">{ed.location?.city || '—'}</span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {ed.location?.zone && <ZoneBadge zone={ed.location.zone} />}
                            {ed.assignedZones?.length > 0 ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-50 text-zinc-700 dark:text-zinc-300 text-[9px] font-bold border border-zinc-200 dark:border-zinc-700">
                                <Hexagon size={7} className="text-zinc-400" />
                                {ed.assignedZones.length} zones
                              </span>
                            ) : ed.location?.h3Index ? (
                              <HexBadge hex={ed.location.h3Index} small />
                            ) : ed.location?.coordinates ? (
                              <CoordDisplay coordinates={ed.location.coordinates} small />
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-500 font-mono">L{ed.hierarchy?.level || 7}</span>
                        <span className="text-[10px] text-zinc-300 ml-1">{HIERARCHY_LABELS[ed.hierarchy?.level || 7]}</span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={ed.status || 'ACTIVE'} /></td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">
                        {ed.hiredAt ? new Date(ed.hiredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : new Date(emp.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end" onClick={e => e.stopPropagation()}>
                          <button onClick={() => openEdit(emp)} title="Edit"
                            className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition">
                            <Pencil size={12} />
                          </button>
                          {ed.isActive !== false && !['ADMIN', 'SUPER_ADMIN'].includes(emp.role) && (
                            <button onClick={() => handleStatusChange(emp._id, 'OFFBOARDED')} title="Offboard"
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                              <UserMinus size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t flex items-center justify-between bg-zinc-50/50">
            <span className="text-xs text-zinc-400">
              Showing {(pagination.page - 1) * 25 + 1}–{Math.min(pagination.page * 25, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-1">
              <button onClick={() => fetchEmployees(pagination.page - 1)} disabled={pagination.page <= 1}
                className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-30 hover:bg-white transition">Prev</button>
              {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
                const p = i + 1;
                return (
                  <button key={p} onClick={() => fetchEmployees(p)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition ${p === pagination.page ? 'bg-zinc-900 text-white' : 'border hover:bg-white'}`}>
                    {p}
                  </button>
                );
              })}
              {pagination.pages > 5 && <span className="px-2 text-zinc-400">...</span>}
              <button onClick={() => fetchEmployees(pagination.page + 1)} disabled={pagination.page >= pagination.pages}
                className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-30 hover:bg-white transition">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ RECENT ACTIVITY ═══ */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Recent Hires */}
          <div className="bg-white rounded-lg border shadow-sm p-4">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
              <UserPlus size={12} className="mr-1.5 text-zinc-400" />Recent Hires
            </h3>
            {(stats?.total > 0 && employees.length > 0) ? (
              <div className="space-y-2">
                {employees.slice(0, 4).map(emp => (
                  <div key={emp._id} className="flex items-center gap-3 py-1.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: ROLE_COLORS[emp.role]?.bg || '#e0e7ff', color: ROLE_COLORS[emp.role]?.text || '#4338ca' }}>
                      {getInitials(emp)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-zinc-700 truncate">{getUserName(emp)}</p>
                      <p className="text-[10px] text-zinc-400">{emp.employeeDetails?.department || emp.role}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-[10px] text-zinc-400 block">{timeAgo(emp.createdAt)}</span>
                      <span className="text-[9px] text-zinc-300">{emp.employeeDetails?.location?.city || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-400 italic">No recent hires</p>
            )}
          </div>

          {/* Role Distribution */}
          {stats?.byRole && Object.keys(stats.byRole).length > 0 && (
            <div className="bg-white rounded-lg border shadow-sm p-4">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-3">
                <PieChart size={12} className="mr-1.5 text-zinc-400" />Role Distribution
              </h3>
              <div className="space-y-2">
                {Object.entries(stats.byRole).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                  <div key={role} className="flex items-center gap-2">
                    <RoleBadge role={role} />
                    <div className="flex-1 bg-zinc-100 rounded-full h-2">
                      <div className="h-2 rounded-full" style={{
                        width: `${(count / stats.total) * 100}%`,
                        background: ROLE_COLORS[role]?.border || '#6366f1'
                      }} />
                    </div>
                    <span className="text-xs text-zinc-500 font-mono w-6 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ DETAIL PANEL ═══ */}
      {selectedEmployee && (
          <>
            <div
              className="fixed inset-0 bg-black/20 z-40"
              onClick={() => { setSelectedEmployee(null); setEmployeeDetail(null); }}
            />
            <EmployeeDetailPanel
              employee={selectedEmployee}
              detail={employeeDetail}
              serviceAreas={serviceAreas}
              onClose={() => { setSelectedEmployee(null); setEmployeeDetail(null); }}
              onEdit={openEdit}
              onStatusChange={handleStatusChange}
              onOnboardingUpdate={handleOnboardingUpdate}
            />
          </>
        )}

      {/* ═══ CREATE / EDIT MODAL ═══ */}
      <EmployeeModal
        open={showModal}
        editMode={editMode}
        form={formData}
        setForm={setFormData}
        onSubmit={editMode ? handleUpdate : handleCreate}
        onClose={() => { setShowModal(false); setEditMode(false); setFormData({ ...INIT_FORM }); }}
        submitting={submitting}
        allPermissions={meta.allPermissions || []}
        roleDefaults={meta.roleDefaults || {}}
        managers={managers}
        serviceAreas={serviceAreas}
        showMapPicker={showMapPicker}
        setShowMapPicker={setShowMapPicker}
      />

      {/* ═══ HEX MAP PICKER (fullscreen overlay) ═══ */}
      <HexMapPicker
        open={showMapPicker}
        onClose={() => setShowMapPicker(false)}
        onConfirm={handleMapConfirm}
        serviceAreas={serviceAreas}
        initialCoords={formData.coordinates || (serviceAreas?.[formData.areaKey]?.center)}
        existingZones={formData.assignedZones || []}
        employeeName={formData.firstName ? `${formData.firstName} ${formData.lastName}`.trim() : ''}
      />
    </div>
  );
};

export default AdminEmployees;
