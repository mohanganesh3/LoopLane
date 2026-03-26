import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import adminService from '../../services/adminService';
import { AIInsightCard } from '../../components/admin';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, BookOpen, Shield, ShieldAlert, AlertTriangle, Info, Feather,
  UserX, CarFront, AlertCircle, IndianRupee, Banknote, Route, Wrench,
  CigaretteOff, Ghost, IdCard, UserMinus, Car, Frown, Flag,
  Search, Ban, Gavel, Undo2, XCircle, Check, CheckCheck,
  FileText, History, Zap, Phone, Pen, ArrowUpRight,
  Clock, Flame, Hourglass, Layers, MessageSquare, Paperclip,
  ChevronRight, Lightbulb, Receipt, Send, Loader2, Lock, Scale, Bolt,
  SkullIcon, CircleDot, Cog, User, Brain, Star
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════════
   TRUST & SAFETY OPERATIONS CENTER
   Inspired by Uber T&S operations, Lyft Community Safety, Ola Safety Shield
   ═══════════════════════════════════════════════════════════════════════════════ */

// ─────────────────────────────── SAFETY PLAYBOOKS ─────────────────────────────
// Uber-style investigation protocols — step-by-step guides for safety agents
const SAFETY_PLAYBOOKS = {
  HARASSMENT: {
    title: 'Harassment Investigation Protocol',
    tier: 'T1_CRITICAL',
    slaTarget: '2 hours',
    steps: [
      { label: 'Verify reporter identity and trip details against booking records', cat: 'VERIFY' },
      { label: 'Review trip GPS data, route timeline, and any anomalies', cat: 'EVIDENCE' },
      { label: 'Check for audio/video/photo evidence submitted by reporter', cat: 'EVIDENCE' },
      { label: 'Pull reported user violation history — flag repeat offenders', cat: 'HISTORY' },
      { label: 'Apply immediate account hold on reported user (Uber policy: auto-hold for T1)', cat: 'ACTION' },
      { label: 'Contact reporter within SLA window — document conversation', cat: 'CONTACT' },
      { label: 'Attempt contact with reported user for their statement', cat: 'CONTACT' },
      { label: 'Document all findings in internal investigation notes', cat: 'DOCUMENT' },
      { label: 'Escalate to Trust & Safety Lead if physical threat or repeat offence', cat: 'ESCALATE' },
      { label: 'Issue final determination — notify both parties with outcome', cat: 'RESOLVE' },
    ]
  },
  RECKLESS_DRIVING: {
    title: 'Reckless Driving Safety Review',
    tier: 'T1_CRITICAL',
    slaTarget: '2 hours',
    steps: [
      { label: 'Verify trip details — confirm booking, route, and timestamps', cat: 'VERIFY' },
      { label: 'Analyse GPS telemetry for speeding, hard braking, sudden swerves', cat: 'EVIDENCE' },
      { label: 'Cross-reference with route deviation data (if available)', cat: 'EVIDENCE' },
      { label: 'Review driver safety record and past driving incidents', cat: 'HISTORY' },
      { label: 'Temporarily pause driver from accepting new rides', cat: 'ACTION' },
      { label: 'Contact reporter — gather additional details about the incident', cat: 'CONTACT' },
      { label: 'Schedule mandatory Fleet Safety Review for the driver', cat: 'ACTION' },
      { label: 'Issue determination: Warning / Suspension / Permanent Ban', cat: 'RESOLVE' },
    ]
  },
  PAYMENT_DISPUTE: {
    title: 'Payment Dispute Resolution',
    tier: 'T3_MINOR',
    slaTarget: '24 hours',
    steps: [
      { label: 'Verify booking details — fare calculation, surge, tolls, distance', cat: 'VERIFY' },
      { label: 'Pull transaction records — payment gateway logs', cat: 'EVIDENCE' },
      { label: 'Compare actual route distance with billed distance', cat: 'EVIDENCE' },
      { label: 'Check if promo codes or discounts were correctly applied', cat: 'VERIFY' },
      { label: 'Calculate correct fare and identify discrepancy amount', cat: 'DOCUMENT' },
      { label: 'Contact reporter with findings — offer refund if overcharged', cat: 'CONTACT' },
      { label: 'Process refund through Refund Console if applicable', cat: 'RESOLVE' },
    ]
  },
  OVERCHARGING: {
    title: 'Overcharging Investigation',
    tier: 'T2_MAJOR',
    slaTarget: '8 hours',
    steps: [
      { label: 'Pull fare breakdown — base fare, distance, time, surge, tolls', cat: 'VERIFY' },
      { label: 'Compare with estimated fare shown to rider at booking time', cat: 'EVIDENCE' },
      { label: 'Verify actual route vs booked route (detect extra detours)', cat: 'EVIDENCE' },
      { label: 'Check driver history for repeat overcharging complaints', cat: 'HISTORY' },
      { label: 'Calculate differential and issue refund for excess amount', cat: 'RESOLVE' },
      { label: 'Issue driver warning if intentional overcharging suspected', cat: 'ACTION' },
    ]
  },
  ROUTE_DEVIATION: {
    title: 'Route Deviation Safety Protocol',
    tier: 'T2_MAJOR',
    slaTarget: '8 hours',
    steps: [
      { label: 'Pull GPS track for the trip — visualise actual vs expected route', cat: 'EVIDENCE' },
      { label: 'Check if deviation was reported as emergency (SOS trigger)', cat: 'VERIFY' },
      { label: 'Determine if deviation was traffic-related or intentional', cat: 'EVIDENCE' },
      { label: 'Review driver explanation if provided', cat: 'CONTACT' },
      { label: 'Check for pattern — has this driver deviated on other trips?', cat: 'HISTORY' },
      { label: 'Apply warning or suspension based on severity and intent', cat: 'RESOLVE' },
      { label: 'If safety concern: escalate to T1 and apply account hold', cat: 'ESCALATE' },
    ]
  },
  UNSAFE_VEHICLE: {
    title: 'Vehicle Safety Inspection Protocol',
    tier: 'T2_MAJOR',
    slaTarget: '8 hours',
    steps: [
      { label: 'Verify vehicle details against driver registration records', cat: 'VERIFY' },
      { label: 'Check last vehicle inspection date and status', cat: 'EVIDENCE' },
      { label: 'Review evidence photos submitted by reporter', cat: 'EVIDENCE' },
      { label: 'Immediately pause vehicle from accepting rides', cat: 'ACTION' },
      { label: 'Contact Fleet team to schedule in-person inspection', cat: 'ACTION' },
      { label: 'Notify driver — mandatory safety inspection required', cat: 'CONTACT' },
      { label: 'Re-activate only after passing Fleet inspection', cat: 'RESOLVE' },
      { label: 'Update driver safety record with the incident', cat: 'DOCUMENT' },
    ]
  },
  NO_SHOW: {
    title: 'No-Show Resolution',
    tier: 'T3_MINOR',
    slaTarget: '24 hours',
    steps: [
      { label: 'Verify booking timeline — check driver arrival time at pickup', cat: 'VERIFY' },
      { label: 'Check GPS data — was driver actually at pickup location?', cat: 'EVIDENCE' },
      { label: 'Review any chat messages between rider and driver', cat: 'EVIDENCE' },
      { label: 'Determine who caused the no-show — driver or rider', cat: 'DOCUMENT' },
      { label: 'Process full refund if driver was at fault', cat: 'RESOLVE' },
      { label: 'Update driver no-show record (3 strikes = warning)', cat: 'ACTION' },
    ]
  },
  INAPPROPRIATE_BEHAVIOR: {
    title: 'Inappropriate Behaviour Investigation',
    tier: 'T2_MAJOR',
    slaTarget: '8 hours',
    steps: [
      { label: 'Document the reported behaviour in detail', cat: 'DOCUMENT' },
      { label: 'Cross-reference with other reports against same user', cat: 'HISTORY' },
      { label: 'Contact reporter for detailed statement', cat: 'CONTACT' },
      { label: 'Review Community Guidelines relevance', cat: 'VERIFY' },
      { label: 'Issue warning / educational material / suspension as warranted', cat: 'RESOLVE' },
    ]
  },
  VEHICLE_MISMATCH: {
    title: 'Vehicle Mismatch Safety Protocol',
    tier: 'T2_MAJOR',
    slaTarget: '8 hours',
    steps: [
      { label: 'Compare vehicle in photos with registered vehicle details', cat: 'EVIDENCE' },
      { label: 'Verify driver photo matches the person who drove', cat: 'EVIDENCE' },
      { label: 'Check if vehicle was recently changed in the system', cat: 'VERIFY' },
      { label: 'Pause driver until identity re-verification is completed', cat: 'ACTION' },
      { label: 'Require updated vehicle documents from driver', cat: 'ACTION' },
      { label: 'Issue warning — repeat offence leads to permanent ban', cat: 'RESOLVE' },
    ]
  },
  SMOKING: {
    title: 'Smoking Policy Violation',
    tier: 'T4_COSMETIC',
    slaTarget: '72 hours',
    steps: [
      { label: 'Verify complaint details and severity', cat: 'VERIFY' },
      { label: 'Check driver violation history for repeat offences', cat: 'HISTORY' },
      { label: 'Issue formal warning to driver (first offence)', cat: 'RESOLVE' },
      { label: 'Second offence: 7-day suspension', cat: 'ACTION' },
    ]
  },
  FAKE_PROFILE: {
    title: 'Fraudulent Account Investigation',
    tier: 'T2_MAJOR',
    slaTarget: '8 hours',
    steps: [
      { label: 'Run identity verification check on the reported account', cat: 'VERIFY' },
      { label: 'Compare profile photos with government ID on file', cat: 'EVIDENCE' },
      { label: 'Check for duplicate accounts with same phone/email', cat: 'EVIDENCE' },
      { label: 'Apply immediate account hold during investigation', cat: 'ACTION' },
      { label: 'If fraudulent: permanently ban and flag for compliance', cat: 'RESOLVE' },
    ]
  },
  VEHICLE_DAMAGE: {
    title: 'Vehicle Damage Claim',
    tier: 'T3_MINOR',
    slaTarget: '24 hours',
    steps: [
      { label: 'Review photographic evidence of damage', cat: 'EVIDENCE' },
      { label: 'Check ride timeline for when damage may have occurred', cat: 'VERIFY' },
      { label: 'Contact both parties for statements', cat: 'CONTACT' },
      { label: 'Facilitate mediation between parties', cat: 'RESOLVE' },
    ]
  },
  RUDE_BEHAVIOR: {
    title: 'Rude Behaviour Report',
    tier: 'T4_COSMETIC',
    slaTarget: '72 hours',
    steps: [
      { label: 'Review complaint details', cat: 'VERIFY' },
      { label: 'Check if reported user has similar complaints', cat: 'HISTORY' },
      { label: 'Issue educational material on Community Guidelines', cat: 'RESOLVE' },
    ]
  },
  OTHER: {
    title: 'General Investigation Protocol',
    tier: 'T3_MINOR',
    slaTarget: '24 hours',
    steps: [
      { label: 'Review and categorise the complaint', cat: 'VERIFY' },
      { label: 'Gather relevant evidence and trip data', cat: 'EVIDENCE' },
      { label: 'Contact reporter for clarification if needed', cat: 'CONTACT' },
      { label: 'Determine appropriate action and resolve', cat: 'RESOLVE' },
    ]
  },
};

// ─────────────────────────────── SMART RESPONSE TEMPLATES ─────────────────────
const SMART_TEMPLATES = {
  HARASSMENT: [
    'We have received your harassment report and escalated it to our Trust & Safety team immediately. Your safety is our absolute priority. The reported user\'s account has been placed on hold pending investigation. Expect a follow-up within 2 hours.',
    'Thank you for reporting this. Harassment is strictly prohibited under LoopLane Community Guidelines. We are reviewing all available evidence including trip data and will take immediate disciplinary action. You may use the in-app block feature for additional safety.',
    'We take reports of harassment with the utmost seriousness. A dedicated safety agent has been assigned to your case. We will contact you shortly for a detailed statement. The reported user cannot accept rides during this investigation.',
  ],
  RECKLESS_DRIVING: [
    'Critical safety report received. We have flagged this driver\'s account and paused their ability to accept rides. Our Safety team is reviewing the trip GPS data and driving telemetry. A mandatory Fleet Safety Review will be conducted before the driver can resume.',
    'Thank you for reporting this dangerous driving incident. We are cross-referencing your report with our real-time trip monitoring data. If the investigation confirms violations, the driver will face suspension or permanent removal from LoopLane.',
  ],
  PAYMENT_DISPUTE: [
    'We have received your payment dispute. Our Finance team will audit the complete fare breakdown including base fare, distance pricing, surge multiplier, and applicable tolls. If an overcharge is confirmed, the differential will be refunded within 3-5 business days.',
    'Thank you for bringing this fare issue to our attention. We take fare integrity very seriously. Your trip details have been flagged for a manual fare audit. You will receive a detailed breakdown and resolution within 24 hours.',
  ],
  OVERCHARGING: [
    'We have flagged this trip for a fare audit. Our system will recalculate the correct fare based on actual GPS route distance, applicable rates, and any surge pricing. Any excess amount will be refunded automatically within 3 business days.',
  ],
  ROUTE_DEVIATION: [
    'Route deviation reported. Our Safety team is reviewing the GPS log for your trip against the approved route. Unauthorized deviations are a critical safety concern. The driver has been notified and their rides are paused pending review.',
  ],
  UNSAFE_VEHICLE: [
    'Vehicle safety report received. The reported vehicle has been flagged for immediate inspection and the driver\'s ability to accept rides is paused. Our Fleet team will schedule a mandatory in-person safety inspection before the vehicle is re-approved.',
  ],
  NO_SHOW: [
    'We sincerely apologize for the no-show. After verifying the trip timeline, a full refund has been initiated and will reflect in your account within 3-5 business days. The driver\'s no-show record has been updated; repeat offences will result in account suspension.',
  ],
  VEHICLE_MISMATCH: [
    'Thank you for reporting the vehicle mismatch. This is a safety concern we treat with high priority. The driver has been notified and must re-verify their vehicle registration before resuming rides. Always verify the vehicle number plate and driver photo before boarding.',
  ],
  SMOKING: [
    'LoopLane enforces a strict no-smoking policy in all vehicles. The driver has received a formal warning. A second violation will result in a 7-day suspension, and a third will lead to permanent removal from the platform.',
  ],
  INAPPROPRIATE_BEHAVIOR: [
    'We are sorry you experienced this. Your report has been escalated to our Trust & Safety team. The reported user will be required to acknowledge our Community Guidelines and may face disciplinary action including suspension.',
  ],
  FAKE_PROFILE: [
    'Thank you for reporting a suspected fraudulent account. Our verification team will conduct an immediate identity check. If the account is confirmed fraudulent, it will be permanently banned and flagged for our compliance team.',
  ],
  VEHICLE_DAMAGE: [
    'We have received your vehicle damage report. Our team will review the evidence and trip details to facilitate a fair resolution between both parties. For significant damage, please also retain any repair estimates.',
  ],
  RUDE_BEHAVIOR: [
    'Thank you for this feedback. While we understand this was an unpleasant experience, we want every LoopLane journey to be respectful. The reported user will receive a reminder about our Community Guidelines, and repeat complaints will lead to further action.',
  ],
  OTHER: [
    'Thank you for reaching out. Our Trust & Safety team has received your report and will review it thoroughly. You can expect a detailed response and resolution within 24 hours.',
  ],
};

// ─────────────────────────────── CONSTANTS ─────────────────────────────────────
const TIER_META = {
  T1_CRITICAL: { label: 'T1 Critical', color: 'bg-red-600 text-white', sla: '2h', ring: 'ring-red-400' },
  T2_MAJOR:    { label: 'T2 Major',    color: 'bg-orange-500 text-white', sla: '8h', ring: 'ring-orange-400' },
  T3_MINOR:    { label: 'T3 Minor',    color: 'bg-yellow-400 text-yellow-900', sla: '24h', ring: 'ring-yellow-400' },
  T4_COSMETIC: { label: 'T4 Cosmetic', color: 'bg-zinc-400 text-white', sla: '72h', ring: 'ring-zinc-300' },
};
const getTier = (t) => TIER_META[t] || TIER_META.T3_MINOR;

const CAT_META = {
  HARASSMENT:             { color: 'bg-red-100 text-red-800',       label: 'Harassment' },
  RECKLESS_DRIVING:       { color: 'bg-red-100 text-red-800',       label: 'Reckless Driving' },
  INAPPROPRIATE_BEHAVIOR: { color: 'bg-orange-100 text-orange-800', label: 'Inappropriate' },
  PAYMENT_DISPUTE:        { color: 'bg-blue-100 text-blue-800',     label: 'Payment Dispute' },
  OVERCHARGING:           { color: 'bg-blue-100 text-blue-800',     label: 'Overcharging' },
  ROUTE_DEVIATION:        { color: 'bg-purple-100 text-purple-800', label: 'Route Deviation' },
  UNSAFE_VEHICLE:         { color: 'bg-yellow-100 text-yellow-800', label: 'Unsafe Vehicle' },
  SMOKING:                { color: 'bg-zinc-100 text-zinc-700',     label: 'Smoking' },
  NO_SHOW:                { color: 'bg-zinc-100 text-zinc-700',     label: 'No Show' },
  VEHICLE_MISMATCH:       { color: 'bg-yellow-100 text-yellow-800', label: 'Vehicle Mismatch' },
  FAKE_PROFILE:           { color: 'bg-red-100 text-red-800',       label: 'Fake Profile' },
  VEHICLE_DAMAGE:         { color: 'bg-zinc-100 text-zinc-700',     label: 'Vehicle Damage' },
  RUDE_BEHAVIOR:          { color: 'bg-zinc-100 text-zinc-700',     label: 'Rude Behaviour' },
  OTHER:                  { color: 'bg-zinc-100 text-zinc-700',     label: 'Other' },
};
const getCat = (c) => CAT_META[c] || CAT_META.OTHER;

const ACTIONS = [
  { id: 'NO_ACTION',  label: 'Investigate',   active: 'bg-zinc-900 text-white',        desc: 'Mark for further investigation' },
  { id: 'WARNING',    label: 'Warn User',     active: 'bg-yellow-400 text-yellow-900', desc: 'Community Guidelines warning' },
  { id: 'SUSPENSION', label: 'Suspend',       active: 'bg-orange-500 text-white',      desc: 'Temporary account suspension' },
  { id: 'BAN',        label: 'Permanent Ban', active: 'bg-red-600 text-white',         desc: 'Permanent account removal' },
  { id: 'REFUND',     label: 'Issue Refund',  active: 'bg-emerald-500 text-white',     desc: 'Process financial refund' },
  { id: 'DISMISSED',  label: 'Dismiss',       active: 'bg-zinc-500 text-white',        desc: 'Close as no violation found' },
];

const STEP_CATS = { VERIFY: 'Verify', EVIDENCE: 'Evidence', HISTORY: 'History', ACTION: 'Action', CONTACT: 'Contact', DOCUMENT: 'Document', ESCALATE: 'Escalate', RESOLVE: 'Resolve' };

// ─────────────────────────────── AI ANALYSIS ──────────────────────────────────
const analyseReport = (report) => {
  const desc = (report.description || '').toLowerCase();
  const cat = report.category || 'OTHER';
  const highRisk  = ['assault','hit','punch','threaten','weapon','knife','gun','rape','touch','molest','drunk','accident','crash','speed','reckless','killed','die','blood','injur'];
  const refundSig = ['overcharg','extra','paid','refund','money','charge','fare','payment','double','wrong amount','incorrect'];
  const safetySig = ['unsafe','danger','speed','signal','lane','deviation','route','scared','fear','follow'];

  const isHigh   = highRisk.some(k  => desc.includes(k));
  const needsRef = refundSig.some(k => desc.includes(k)) || ['PAYMENT_DISPUTE','OVERCHARGING','NO_SHOW'].includes(cat);
  const isSafety = safetySig.some(k => desc.includes(k)) || ['RECKLESS_DRIVING','UNSAFE_VEHICLE','ROUTE_DEVIATION'].includes(cat);

  let suggestedAction = 'NO_ACTION', suggestedLabel = 'Investigate First';
  if (isHigh)       { suggestedAction = 'SUSPENSION'; suggestedLabel = 'Suspend User'; }
  else if (isSafety){ suggestedAction = 'WARNING';    suggestedLabel = 'Warn + Safety Review'; }
  else if (needsRef){ suggestedAction = 'REFUND';     suggestedLabel = 'Issue Refund'; }

  const base  = { HIGH: 70, MEDIUM: 45, LOW: 20 }[report.severity] || 45;
  const score = Math.min(100, base + (isHigh ? 25 : 0) + (isSafety ? 10 : 0));
  const color = score >= 70 ? 'text-red-600'    : score >= 45 ? 'text-yellow-600'    : 'text-green-600';
  const bg    = score >= 70 ? 'bg-red-50'       : score >= 45 ? 'bg-yellow-50'       : 'bg-green-50';
  const label = score >= 70 ? 'High Risk'       : score >= 45 ? 'Moderate Risk'      : 'Low Risk';

  return { suggestedAction, suggestedLabel, needsRef, score, color, bg, label };
};

const uname = (u) => u ? (u.profile?.firstName + ' ' + (u.profile?.lastName || '')).trim() || u.email : '—';

const getSLACountdown = (r) => {
  if (['RESOLVED','DISMISSED'].includes(r.status)) return { label: 'Closed', color: 'text-green-600 bg-green-50', urgent: false };
  const deadline = r.sla?.resolutionDeadline ? new Date(r.sla.resolutionDeadline) : null;
  if (!deadline) { const h = (Date.now() - new Date(r.createdAt)) / 36e5; return { label: Math.floor(h) + 'h elapsed', color: 'text-zinc-500 bg-zinc-50', urgent: false }; }
  const remain = deadline - Date.now();
  if (remain <= 0) { const overH = Math.abs(remain) / 36e5; return { label: 'BREACHED ' + Math.floor(overH) + 'h ago', color: 'text-red-700 bg-red-100 font-bold', urgent: true }; }
  const h = Math.floor(remain / 36e5); const m = Math.floor((remain % 36e5) / 6e4);
  if (h < 1)  return { label: m + 'm remaining', color: 'text-red-600 bg-red-50', urgent: true };
  if (h < 4)  return { label: h + 'h ' + m + 'm left', color: 'text-orange-600 bg-orange-50', urgent: true };
  return { label: h + 'h ' + m + 'm left', color: 'text-emerald-600 bg-emerald-50', urgent: false };
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SAFETY PLAYBOOK COMPONENT
   Step-by-step investigation checklist — like Uber's trained safety agents use
   ═══════════════════════════════════════════════════════════════════════════════ */
const SafetyPlaybook = ({ report, completedSteps = [], onStepToggle }) => {
  const pb = SAFETY_PLAYBOOKS[report.category] || SAFETY_PLAYBOOKS.OTHER;
  const done = completedSteps.length;
  const total = pb.steps.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="bg-zinc-900 dark:bg-zinc-950 px-4 py-3 flex justify-between items-center">
        <div>
          <h3 className="text-white font-bold text-sm flex items-center gap-2"><BookOpen size={14} /> Safety Playbook</h3>
          <p className="text-zinc-400 text-xs">{pb.title} — SLA Target: {pb.slaTarget}</p>
        </div>
        <div className="text-right">
          <span className="text-white font-black text-lg">{pct}%</span>
          <p className="text-zinc-400 text-xs">{done}/{total} steps</p>
        </div>
      </div>
      <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-1"><div className="bg-zinc-600 dark:bg-zinc-400 h-1 transition-all" style={{ width: pct + '%' }} /></div>
      <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
        {pb.steps.map((step, i) => {
          const isDone = completedSteps.includes(i);
          return (
            <button key={i} onClick={() => onStepToggle(i)}
              className={`w-full flex items-start gap-3 text-left px-3 py-2 rounded-lg text-xs transition group
                ${isDone ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'}`}>
              <span className={`flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center border-2 mt-0.5
                ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-zinc-300 dark:border-zinc-600 group-hover:border-zinc-400'}`}>
                {isDone ? <Check size={10} /> : <span className="text-[9px] font-bold">{i + 1}</span>}
              </span>
              <div className="flex-1">
                <span className={isDone ? 'line-through opacity-60' : ''}>{step.label}</span>
              </div>
              <span className="text-[9px] text-zinc-400 mt-1 uppercase">{STEP_CATS[step.cat] || ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   USER DOSSIER COMPONENT
   Full safety profile — like Uber's internal user file
   ═══════════════════════════════════════════════════════════════════════════════ */
const UserDossier = ({ user, reportHistory = [], totalReports = 0, isRepeatOffender = false, label = 'Reported User' }) => {
  if (!user) return null;
  const trustLevel = user.trustScore?.level || 'NEWCOMER';
  const trustVal = user.trustScore?.score || 0;
  const rating = user.rating?.overall?.toFixed(1) || '—';
  const completedRides = user.statistics?.completedRides || 0;
  const cancelRate = user.cancellationRate?.rate ? user.cancellationRate.rate.toFixed(0) + '%' : '0%';
  const status = user.accountStatus || 'ACTIVE';

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className={`px-4 py-3 flex items-center gap-3 ${label === 'Reporter' ? 'bg-zinc-50 dark:bg-zinc-800' : 'bg-zinc-50 dark:bg-zinc-800'}`}>
        <img src={user.profile?.photo || '/images/default-avatar.png'} className="w-11 h-11 rounded-lg object-cover border-2 border-zinc-200 dark:border-zinc-700" alt="" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-zinc-800 dark:text-zinc-200 text-sm flex items-center gap-2 truncate">
            {uname(user)}
            {isRepeatOffender && <span className="px-1.5 py-0.5 bg-red-600 text-white text-[9px] rounded-md font-bold">REPEAT OFFENDER</span>}
          </p>
          <p className="text-xs text-zinc-500 truncate">{user.email}</p>
        </div>
        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ring-1 ring-inset ${status === 'ACTIVE' ? 'bg-green-50 text-green-700 ring-green-600/20' : status === 'SUSPENDED' ? 'bg-red-50 text-red-700 ring-red-600/20' : 'bg-zinc-100 text-zinc-600 ring-zinc-500/20'}`}>
          {status}
        </span>
      </div>
      <div className="px-4 py-3 grid grid-cols-4 gap-2">
        {[
          { lbl: 'Trust', val: trustVal, sub: trustLevel, cls: trustVal >= 70 ? 'text-emerald-600' : trustVal >= 40 ? 'text-yellow-600' : 'text-red-600' },
          { lbl: 'Rating', val: rating, sub: (user.rating?.totalRatings || 0) + ' reviews', cls: parseFloat(rating) >= 4 ? 'text-emerald-600' : 'text-yellow-600' },
          { lbl: 'Rides', val: completedRides, sub: 'completed', cls: 'text-zinc-900 dark:text-zinc-100' },
          { lbl: 'Cancel', val: cancelRate, sub: 'rate', cls: parseFloat(cancelRate) > 15 ? 'text-red-600' : 'text-zinc-600' },
        ].map(s => (
          <div key={s.lbl} className="text-center">
            <p className={`text-sm font-black ${s.cls}`}>{s.val}</p>
            <p className="text-[9px] text-zinc-400">{s.sub}</p>
            <p className="text-[9px] text-zinc-400 font-semibold">{s.lbl}</p>
          </div>
        ))}
      </div>
      {reportHistory.length > 0 && (
        <div className="border-t px-4 py-2">
          <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1.5">Past Reports ({totalReports})</p>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            {reportHistory.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-500">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getCat(r.category).color}`}>{r.category?.replace(/_/g, ' ')}</span>
                <span className={r.severity === 'HIGH' ? 'text-red-500 font-bold' : ''}>{r.severity}</span>
                <span className="flex-1" />
                <span className={`font-semibold ${r.status === 'RESOLVED' ? 'text-green-600' : r.status === 'DISMISSED' ? 'text-zinc-400' : 'text-yellow-600'}`}>{r.status}</span>
                <span className="text-zinc-300 dark:text-zinc-600">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   INVESTIGATION WORKSPACE
   Full-screen panel for investigating a single report
   This is Uber/Lyft's "investigation view" — agents work in this panel
   ═══════════════════════════════════════════════════════════════════════════════ */
const InvestigationWorkspace = ({ report, reportDetail, onBack, onSuccess }) => {
  const r = reportDetail?.report || report;
  const ai = analyseReport(r);
  const sla = getSLACountdown(r);
  const tier = getTier(r.investigation?.tier);
  const cat = getCat(r.category);
  const templates = SMART_TEMPLATES[r.category] || SMART_TEMPLATES.OTHER;
  const bookingAmt = r.booking?.payment?.totalAmount || r.booking?.totalPrice || 0;
  const closed = ['RESOLVED', 'DISMISSED'].includes(r.status);

  const [action, setAction] = useState(ai.suggestedAction);
  const [notes, setNotes] = useState('');
  const [reply, setReply] = useState('');
  const [refundAmt, setRefundAmt] = useState(bookingAmt);
  const [suspDays, setSuspDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [thread, setThread] = useState(r.messages || []);
  const [quickMsg, setQuickMsg] = useState('');
  const [sendingMsg, setSending] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(r.investigation?.playbook?.completedSteps || []);
  const [activeTab, setActiveTab] = useState('playbook');
  const [lightboxImg, setLightboxImg] = useState(null);
  const threadEndRef = useRef(null);

  const reportedUserHistory = reportDetail?.reportedUserHistory || [];
  const isRepeatOffender = reportDetail?.isRepeatOffender || false;

  const handleStepToggle = (idx) => {
    const next = completedSteps.includes(idx) ? completedSteps.filter(s => s !== idx) : [...completedSteps, idx];
    setCompletedSteps(next);
    adminService.updatePlaybookProgress(r._id, r.category, next).catch(() => {});
  };

  const submit = async () => {
    if (!notes.trim() && !['NO_ACTION', 'REFUND'].includes(action)) { setErr('Please add internal notes before taking action.'); return; }
    setBusy(true);
    try {
      await adminService.takeReportAction(r._id, {
        actionType: action,
        status: action === 'DISMISSED' ? 'DISMISSED' : action === 'NO_ACTION' ? 'UNDER_REVIEW' : 'RESOLVED',
        notes,
        messageToReporter: reply,
        refundAmount: action === 'REFUND' ? refundAmt : undefined,
        suspensionDuration: action === 'SUSPENSION' ? suspDays : undefined,
      });
      onSuccess('Action applied successfully');
    } catch (e) { setErr(e.response?.data?.message || e.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const sendMsg = async () => {
    if (!quickMsg.trim()) return;
    setSending(true);
    try {
      await adminService.sendAdminReportMessage(r._id, quickMsg.trim());
      setThread(p => [...p, { from: 'ADMIN', message: quickMsg.trim(), timestamp: new Date() }]);
      setQuickMsg('');
      setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  };

  const addTimeline = async (eventName, details) => {
    try { await adminService.addInvestigationEvent(r._id, eventName, details); } catch {}
  };

  const timeline = r.investigation?.timeline || [];

  return (
    <div className="min-h-screen">
      {/* Top command bar */}
      <div className="bg-zinc-900 dark:bg-zinc-950 px-6 py-4 flex items-center justify-between rounded-lg mb-4 border border-zinc-800">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-zinc-400 hover:text-white transition"><ArrowLeft size={18} /></button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-white font-bold text-lg">Investigation Workspace</h2>
              <span className={`px-2.5 py-1 rounded-md text-[10px] font-black ${tier.color}`}>{tier.label}</span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${cat.color}`}>{cat.label}</span>
              <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${sla.color}`}>{sla.label}</span>
            </div>
            <p className="text-zinc-400 text-xs mt-0.5">Case #{r._id?.toString().slice(-8).toUpperCase()} — Filed {new Date(r.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className={`text-2xl font-black ${ai.color}`}>{ai.score}</p>
            <p className="text-[10px] text-zinc-400">Risk Score</p>
          </div>
          {r.refundRequested && (
            <span className={`px-3 py-1.5 rounded-md text-xs font-bold ring-1 ring-inset ${r.refundStatus === 'PROCESSED' ? 'bg-green-50 text-green-700 ring-green-600/20' : 'bg-blue-50 text-blue-700 ring-blue-600/20'}`}>
              {r.refundStatus === 'PROCESSED' ? 'Refunded' : 'Refund Requested'}
            </span>
          )}
        </div>
      </div>

      {err && <div className="mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-2 text-sm flex gap-2"><span className="flex-1">{err}</span><button onClick={() => setErr('')}>×</button></div>}

      {/* AI Analysis Banner */}
      <div className={`rounded-lg p-4 mb-4 ${ai.bg} border`}>
        <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-2">AI Complaint Analysis</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { lbl: 'Risk Score', val: ai.score, sub: ai.label, cls: `text-xl font-black ${ai.color}` },
            { lbl: 'Severity', val: r.severity, sub: '', cls: `text-base font-bold ${r.severity === 'HIGH' ? 'text-red-600' : r.severity === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'}` },
            { lbl: 'Investigation Tier', val: tier.label, sub: 'SLA: ' + tier.sla, cls: 'text-xs font-bold text-zinc-700 dark:text-zinc-300' },
            { lbl: 'AI Suggestion', val: ai.suggestedLabel, sub: '', cls: 'text-xs font-bold text-zinc-700 dark:text-zinc-300' },
            { lbl: 'Refund Signal', val: ai.needsRef ? 'Likely Needed' : 'Not Detected', sub: '', cls: `text-xs font-bold ${ai.needsRef ? 'text-emerald-600' : 'text-zinc-400'}` },
          ].map(c => (
            <div key={c.lbl} className="bg-white dark:bg-zinc-800 rounded-lg p-2.5 text-center border border-zinc-200 dark:border-zinc-700">
              <p className="text-[10px] text-zinc-400 mb-0.5">{c.lbl}</p>
              <p className={c.cls}>{c.val}</p>
              {c.sub && <p className="text-[10px] text-zinc-400">{c.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* LEFT — Evidence & Info (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          {/* Complaint Description */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 rounded-r-lg p-4">
            <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase mb-1">Complaint Narrative</p>
            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-sm">{r.description}</p>
          </div>

          {/* Evidence Gallery */}
          {r.evidence?.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">Evidence ({r.evidence.length} items)</p>
              <div className="flex gap-2 flex-wrap">
                {r.evidence.map((ev, i) => (
                  <img key={i} src={typeof ev === 'string' ? ev : ev.url}
                    onClick={() => setLightboxImg(typeof ev === 'string' ? ev : ev.url)}
                    className="w-24 h-24 rounded-lg object-cover border-2 border-zinc-200 dark:border-zinc-700 cursor-pointer hover:border-zinc-400 transition" alt="Evidence" />
                ))}
              </div>
            </div>
          )}

          {/* Booking Forensics */}
          {r.booking && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4">
              <p className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Booking Forensics</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { lbl: 'Reference', val: r.booking.bookingReference || r.booking._id?.toString().slice(-8) },
                  { lbl: 'Amount', val: '₹' + bookingAmt },
                  { lbl: 'Payment', val: r.booking.payment?.status || 'N/A' },
                  { lbl: 'Booking Status', val: r.booking.status },
                ].map(f => (
                  <div key={f.lbl}>
                    <p className="text-[10px] text-zinc-400">{f.lbl}</p>
                    <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{f.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs: Playbook / Timeline / Templates */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="flex border-b border-zinc-200 dark:border-zinc-700">
              {[
                { key: 'playbook', label: 'Safety Playbook' },
                { key: 'timeline', label: 'Investigation Log' },
                { key: 'templates', label: 'Response Templates' },
              ].map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={cn('flex-1 px-4 py-2.5 text-xs font-semibold transition flex items-center justify-center gap-1.5',
                    activeTab === t.key ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-b-2 border-zinc-900 dark:border-zinc-100' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800')}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="p-0">
              {activeTab === 'playbook' && <SafetyPlaybook report={r} completedSteps={completedSteps} onStepToggle={handleStepToggle} />}
              {activeTab === 'timeline' && (
                <div className="p-4 max-h-72 overflow-y-auto">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-zinc-400 text-center py-8">No investigation events yet</p>
                  ) : (
                    <div className="space-y-3">
                      {timeline.map((ev, i) => (
                        <div key={i} className="flex gap-3 items-start">
                          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', ev.isAutomatic ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-zinc-200 dark:bg-zinc-700')}>
                            {ev.isAutomatic ? <Cog size={12} className="text-zinc-400" /> : <User size={12} className="text-zinc-600 dark:text-zinc-300" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{ev.event?.replace(/_/g, ' ')}</p>
                            <p className="text-[11px] text-zinc-500">{ev.details}</p>
                            <p className="text-[10px] text-zinc-300 dark:text-zinc-600 mt-0.5">
                              {new Date(ev.timestamp).toLocaleString()}
                              {ev.performedBy && typeof ev.performedBy === 'object' ? ' — ' + uname(ev.performedBy) : ''}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'templates' && (
                <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                  <p className="text-[10px] text-zinc-400 mb-1">Click a template to auto-fill the "Message to Reporter" field</p>
                  {templates.map((t, i) => (
                    <button key={i} onClick={() => setReply(t)}
                      className="w-full text-left text-xs bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 rounded-lg p-3 transition text-zinc-700 dark:text-zinc-300 leading-relaxed">
                      <Zap size={12} className="inline text-zinc-400 mr-2" />{t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT — User Dossier, Actions, Communication (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Reported User Dossier */}
          <UserDossier user={r.reportedUser} reportHistory={reportedUserHistory} totalReports={reportDetail?.reportedUserTotalReports || 0}
            isRepeatOffender={isRepeatOffender} label="Reported User" />

          {/* Reporter Info */}
          <UserDossier user={r.reporter} totalReports={reportDetail?.reporterTotalReports || 0} label="Reporter" />

          {/* Action Center */}
          {!closed && (
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <div className="bg-zinc-900 dark:bg-zinc-950 px-4 py-3">
                <h3 className="text-white font-bold text-sm flex items-center gap-2"><Gavel size={16} /> Action Center</h3>
              </div>
              <div className="p-4 space-y-3">
                {/* Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5">
                  {ACTIONS.map(a => (
                    <button key={a.id} onClick={() => setAction(a.id)}
                      className={cn('p-2 rounded-lg text-[11px] font-semibold transition flex flex-col items-center gap-1 border-2',
                        action === a.id ? `${a.active} border-transparent shadow-sm` : 'bg-white dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400')}>
                      <span>{a.label}</span>
                      {a.id === ai.suggestedAction && <span className="text-[8px] opacity-60 bg-zinc-100 dark:bg-zinc-700 px-1.5 rounded-md">AI Pick</span>}
                    </button>
                  ))}
                </div>

                {/* Refund Console */}
                {action === 'REFUND' && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-2"><Undo2 size={12} className="inline mr-1" />Refund Console</p>
                      <div className="space-y-2">
                        <div>
                          <label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">Amount (₹)</label>
                          <div className="relative mt-0.5">
                            <span className="absolute left-2.5 top-2 text-zinc-400 text-xs">₹</span>
                            <input type="number" value={refundAmt} onChange={e => setRefundAmt(e.target.value)}
                              className="w-full pl-6 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-zinc-400 focus:outline-none bg-white dark:bg-zinc-800" />
                          </div>
                          {bookingAmt > 0 && (
                            <div className="flex gap-1 mt-1">
                              {[100, 75, 50, 25].map(p => (
                                <button key={p} onClick={() => setRefundAmt(Math.round(bookingAmt * p / 100))}
                                  className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-md hover:bg-emerald-200 font-semibold">{p}%</button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">Refund Reason</label>
                          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Overcharge confirmed by fare audit"
                            className="w-full mt-0.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs focus:ring-2 focus:ring-zinc-400 focus:outline-none bg-white dark:bg-zinc-800" />
                        </div>
                      </div>
                  </div>
                )}

                {/* Suspension Duration */}
                {action === 'SUSPENSION' && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
                    <p className="text-[10px] font-bold text-orange-700 dark:text-orange-400 uppercase mb-2"><Clock size={12} className="inline mr-1" />Suspension Duration</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {[1, 3, 7, 14, 30, 90].map(d => (
                          <button key={d} onClick={() => setSuspDays(d)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${suspDays === d ? 'bg-orange-500 text-white' : 'bg-white border border-orange-300 text-orange-700 hover:bg-orange-100'}`}>
                            {d}d
                          </button>
                        ))}
                      </div>
                  </div>
                )}

                {/* Internal Notes */}
                {action !== 'REFUND' && (
                  <div>
                    <label className="text-[10px] font-bold text-zinc-400 uppercase"><Lock size={12} className="inline mr-1" />Internal Notes</label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Document investigation findings..."
                      className="w-full mt-0.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs focus:ring-2 focus:ring-zinc-400 focus:outline-none resize-none bg-white dark:bg-zinc-800" />
                  </div>
                )}

                {/* Message to Reporter */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-400 uppercase"><Send size={12} className="inline mr-1" />Message to Reporter</label>
                  <textarea value={reply} onChange={e => setReply(e.target.value)} rows={3}
                    placeholder="Write a response or click a template..."
                    className="w-full mt-0.5 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs focus:ring-2 focus:ring-zinc-400 focus:outline-none resize-none bg-white dark:bg-zinc-800" />
                </div>

                {/* Compliance Flags */}
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 cursor-pointer">
                    <input type="checkbox" className="rounded border-zinc-300" />
                    <Scale size={12} className="text-zinc-400" /> Legal Hold
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 cursor-pointer">
                    <input type="checkbox" className="rounded border-zinc-300" />
                    <Shield size={12} className="text-zinc-400" /> Law Enforcement
                  </label>
                </div>

                {/* Submit */}
                <button onClick={submit} disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold text-sm hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50 flex items-center justify-center gap-2 transition">
                  {busy ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <><Check size={16} /> Apply Action</>}
                </button>
              </div>
            </div>
          )}

          {/* Communication Hub */}
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
            <div className="bg-zinc-900 dark:bg-zinc-950 px-4 py-2.5">
              <h3 className="text-white font-bold text-sm flex items-center gap-2"><MessageSquare size={16} /> Communication Hub ({thread.length})</h3>
            </div>
            <div className="p-3">
              {thread.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto mb-2">
                  {thread.map((m, i) => (
                    <div key={i} className={`flex ${m.from === 'ADMIN' ? 'justify-end' : 'justify-start'}`}>
                      <div className={cn('max-w-[85%] rounded-lg px-3 py-2 text-xs',
                        m.from === 'ADMIN' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100' : 'bg-zinc-50 dark:bg-zinc-800/50 text-zinc-800 dark:text-zinc-200')}>
                        <p className="font-bold text-[10px] opacity-50 mb-0.5">{m.from === 'ADMIN' ? 'Admin' : 'Reporter'}</p>
                        <p>{m.message}</p>
                        <p className="text-[9px] opacity-30 mt-0.5 text-right">{new Date(m.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={threadEndRef} />
                </div>
              ) : (
                <p className="text-xs text-zinc-400 text-center py-4">No messages yet</p>
              )}
              <div className="flex gap-1.5">
                <input value={quickMsg} onChange={e => setQuickMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg()}
                  placeholder="Quick reply (Enter to send)..."
                  className="flex-1 px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs focus:ring-2 focus:ring-zinc-400 focus:outline-none bg-white dark:bg-zinc-800" />
                <button onClick={sendMsg} disabled={sendingMsg}
                  className="px-3 py-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-xs font-semibold hover:bg-zinc-800 dark:hover:bg-zinc-200 disabled:opacity-50">
                  {sendingMsg ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Evidence Lightbox */}
      {lightboxImg && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6" onClick={() => setLightboxImg(null)}>
          <img src={lightboxImg} className="max-w-full max-h-[85vh] rounded-lg" alt="Evidence" />
          <button onClick={() => setLightboxImg(null)} className="absolute top-6 right-6 text-white text-3xl hover:opacity-80">×</button>
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   INCIDENT QUEUE CARD
   Priority-sorted cards with SLA countdown — like Uber's incident queue
   ═══════════════════════════════════════════════════════════════════════════════ */
const IncidentCard = ({ report, onSelect }) => {
  const cat = getCat(report.category);
  const tier = getTier(report.investigation?.tier);
  const sla = getSLACountdown(report);
  const ai = analyseReport(report);
  const closed = ['RESOLVED', 'DISMISSED'].includes(report.status);

  return (
    <div
      className={cn('bg-white dark:bg-zinc-900 rounded-lg border transition cursor-pointer border-l-4 p-4 hover:border-zinc-300',
        report.severity === 'HIGH' ? 'border-l-red-500' : report.severity === 'MEDIUM' ? 'border-l-yellow-400' : 'border-l-blue-300',
        sla.urgent && !closed && 'ring-2 ' + tier.ring)}
      onClick={() => onSelect(report)}>

      {/* Row 1: Badges */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`px-2 py-0.5 rounded-md ring-1 ring-inset text-[10px] font-black ${tier.color}`}>{tier.label}</span>
          <span className={`px-2 py-0.5 rounded-md ring-1 ring-inset text-[10px] font-bold ${cat.color}`}>{cat.label}</span>
          {report.refundRequested && (
            <span className={`px-1.5 py-0.5 rounded-md ring-1 ring-inset text-[9px] font-bold ${report.refundStatus === 'PROCESSED' ? 'bg-green-100 text-green-700 ring-green-200' : 'bg-blue-100 text-blue-700 ring-blue-200'}`}>
              {report.refundStatus === 'PROCESSED' ? 'Refunded' : 'Refund Req'}
            </span>
          )}
          {ai.score >= 70 && <span className="px-1.5 py-0.5 rounded-md ring-1 ring-inset text-[9px] font-bold bg-red-100 text-red-700 ring-red-200"><Flame size={10} className="inline mr-0.5" />High Risk</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-md ring-1 ring-inset text-[10px] font-bold ${sla.color}`}>{sla.label}</span>
          <span className={cn('px-2 py-0.5 rounded-md ring-1 ring-inset text-[10px] font-bold',
            closed ? 'bg-green-100 text-green-700 ring-green-200' : report.status === 'UNDER_REVIEW' ? 'bg-yellow-100 text-yellow-700 ring-yellow-200' : 'bg-red-100 text-red-700 ring-red-200')}>
            {report.status?.replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      {/* Row 2: Parties & Description */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="flex -space-x-2">
            <img src={report.reporter?.profile?.photo || '/images/default-avatar.png'} className="w-7 h-7 rounded-lg border-2 border-zinc-200 dark:border-zinc-700 object-cover" title="Reporter" alt="" />
            <img src={report.reportedUser?.profile?.photo || '/images/default-avatar.png'} className="w-7 h-7 rounded-lg border-2 border-zinc-200 dark:border-zinc-700 object-cover" title="Reported" alt="" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">{uname(report.reporter)} → {uname(report.reportedUser)}</p>
          </div>
        </div>
        <span className="text-[10px] text-zinc-400 flex-shrink-0"><Clock size={10} className="inline mr-1" />{new Date(report.createdAt).toLocaleDateString()}</span>
      </div>

      {/* Row 3: Description */}
      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2 mb-2">{report.description}</p>

      {/* Row 4: AI Strip */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
          <Lightbulb size={10} className="inline mr-1" /><strong>AI:</strong> {ai.suggestedLabel}
          {ai.needsRef && <span className="ml-1 text-emerald-600 font-semibold">· Refund needed</span>}
        </span>
        <div className="flex items-center gap-2 text-zinc-400">
          {report.messages?.length > 0 && <span><MessageSquare size={10} className="inline mr-0.5" />{report.messages.length}</span>}
          {report.evidence?.length > 0 && <span><Paperclip size={10} className="inline mr-0.5" />{report.evidence.length}</span>}
          <ChevronRight size={12} className="text-zinc-300" />
        </div>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   SAFETY COMMAND BAR — Uber-style ops metrics
   ═══════════════════════════════════════════════════════════════════════════════ */
const SafetyCommandBar = ({ metrics, allReports }) => {
  const m = metrics || {};
  const stats = [
    { label: 'Active Incidents', value: m.activeIncidents ?? allReports.filter(r => !['RESOLVED', 'DISMISSED'].includes(r.status)).length, Icon: Flame },
    { label: 'Avg Resolution', value: m.avgResolutionMinutes ? (m.avgResolutionMinutes < 60 ? m.avgResolutionMinutes + 'm' : (m.avgResolutionMinutes / 60).toFixed(1) + 'h') : '—', Icon: Clock },
    { label: 'SLA Compliance', value: (m.slaCompliance ?? 100) + '%', Icon: Shield },
    { label: 'SLA Breached', value: m.slaBreached ?? allReports.filter(r => !['RESOLVED', 'DISMISSED'].includes(r.status) && r.sla?.resolutionDeadline && new Date() > new Date(r.sla.resolutionDeadline)).length, Icon: AlertTriangle },
    { label: 'Repeat Offenders', value: m.repeatOffenders ?? '—', Icon: UserMinus },
    { label: 'Refunds (30d)', value: m.refundsProcessed ?? '—', Icon: Undo2 },
    { label: 'Resolved (30d)', value: m.resolvedThisMonth ?? allReports.filter(r => r.status === 'RESOLVED').length, Icon: CheckCheck },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-5">
      {stats.map(s => (
        <div key={s.label} className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-center">
          <s.Icon size={16} className="mx-auto text-zinc-400 mb-0.5" />
          <p className="text-xl font-black text-zinc-900 dark:text-zinc-100">{s.value}</p>
          <p className="text-[10px] text-zinc-500 leading-tight">{s.label}</p>
        </div>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT — TRUST & SAFETY OPERATIONS CENTER
   ═══════════════════════════════════════════════════════════════════════════════ */
const AdminReports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(searchParams.get('status') || 'PENDING');
  const [metrics, setMetrics] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportDetail, setReportDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (statusKey) => {
    setLoading(true);
    try {
      const [byStatus, all] = await Promise.all([
        adminService.getReports({ status: statusKey !== 'all' ? statusKey : undefined }),
        adminService.getReports({ limit: 500 }),
      ]);
      setReports(byStatus?.reports || []);
      setAllReports(all?.reports || []);
      // Load safety metrics (non-blocking)
      adminService.getSafetyMetrics().then(res => setMetrics(res.metrics)).catch(() => {});
    } catch (e) {
      if (e.response?.status !== 401) setError(e.message || 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const s = searchParams.get('status') || 'PENDING';
    setTab(s);
    load(s);
  }, [searchParams, load]);

  const handleFilter = (s) => { setSearchParams({ status: s }); setSelectedReport(null); };

  const onSuccess = (msg) => { setSuccess(msg); setSelectedReport(null); setReportDetail(null); load(tab); };

  const openInvestigation = async (report) => {
    setSelectedReport(report);
    setDetailLoading(true);
    try {
      const detail = await adminService.getReportById(report._id);
      setReportDetail(detail);
    } catch { setReportDetail(null); }
    finally { setDetailLoading(false); }
  };

  const localStats = {
    total: allReports.length,
    pending: allReports.filter(r => r.status === 'PENDING').length,
    review: allReports.filter(r => r.status === 'UNDER_REVIEW').length,
    resolved: allReports.filter(r => r.status === 'RESOLVED').length,
    dismissed: allReports.filter(r => r.status === 'DISMISSED').length,
    t1: allReports.filter(r => r.investigation?.tier === 'T1_CRITICAL' && !['RESOLVED', 'DISMISSED'].includes(r.status)).length,
    t2: allReports.filter(r => r.investigation?.tier === 'T2_MAJOR' && !['RESOLVED', 'DISMISSED'].includes(r.status)).length,
  };

  const TABS = [
    { key: 'PENDING',      label: 'Pending',    count: localStats.pending },
    { key: 'UNDER_REVIEW', label: 'In Review',  count: localStats.review },
    { key: 'RESOLVED',     label: 'Resolved',   count: localStats.resolved },
    { key: 'DISMISSED',    label: 'Dismissed',  count: localStats.dismissed },
    { key: 'all',          label: 'All',        count: localStats.total },
  ];

  // Sort by tier priority then by SLA urgency
  const sortedReports = [...reports].sort((a, b) => {
    const tierOrder = { T1_CRITICAL: 0, T2_MAJOR: 1, T3_MINOR: 2, T4_COSMETIC: 3 };
    const aTier = tierOrder[a.investigation?.tier] ?? 2;
    const bTier = tierOrder[b.investigation?.tier] ?? 2;
    if (aTier !== bTier) return aTier - bTier;
    return new Date(a.createdAt) - new Date(b.createdAt);
  });

  if (loading) return (
    <div className="p-6 flex items-center justify-center min-h-96">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="animate-spin text-zinc-400" />
        <p className="text-zinc-500 text-sm">Loading Trust & Safety data...</p>
      </div>
    </div>
  );

  return (
    <div className="p-5 min-h-screen">

      {selectedReport ? (
        /* ═══════ INVESTIGATION WORKSPACE VIEW ═══════ */
        <InvestigationWorkspace
            key="workspace"
            report={selectedReport}
            reportDetail={reportDetail}
            onBack={() => { setSelectedReport(null); setReportDetail(null); }}
            onSuccess={onSuccess}
          />
        ) : (
          /* ═══════ QUEUE VIEW ═══════ */
        <div>
          {/* Header */}
          <div className="mb-5 flex items-start justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Shield size={24} /> Trust & Safety Operations Center
              </h1>
              <p className="text-zinc-500 text-sm mt-0.5">Protecting the LoopLane community — Investigate, resolve, and ensure rider/driver safety</p>
            </div>
            {localStats.t1 > 0 && (
              <div className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                <ShieldAlert size={16} /> {localStats.t1} Critical Incident{localStats.t1 > 1 ? 's' : ''} — Immediate Action Required
              </div>
            )}
          </div>

          {error && <div className="mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg px-4 py-2 flex gap-2 text-sm"><span className="flex-1">{error}</span><button onClick={() => setError('')}>×</button></div>}
          {success && <div className="mb-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 rounded-lg px-4 py-2 flex gap-2 text-sm"><span className="flex-1">{success}</span><button onClick={() => setSuccess('')}>×</button></div>}

            <AIInsightCard context="reports" metrics={{
              totalReports: allReports.length,
              pendingReports: allReports.filter(r => r.status === 'PENDING').length,
              safetyReports: allReports.filter(r => ['safety_concern', 'sos', 'harassment', 'violence'].includes(r.type)).length,
              resolvedReports: allReports.filter(r => r.status === 'RESOLVED').length,
              avgResponseTime: metrics?.avgResponseTime || 'N/A',
              topCategory: metrics?.topCategory || 'N/A',
            }} title="Reports Intelligence" />

            {/* Safety Command Bar */}
            <SafetyCommandBar metrics={metrics} allReports={allReports} />

            {/* Filter Tabs */}
            <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-2 mb-5 flex flex-wrap gap-1.5">
              {TABS.map(t => (
                <button key={t.key} onClick={() => handleFilter(t.key)}
                  className={cn('flex items-center gap-1.5 px-4 py-2 rounded-lg font-semibold text-sm transition',
                    tab === t.key ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700')}>
                  {t.label}
                  <span className={cn('px-2 py-0.5 rounded-md text-[10px] font-bold',
                    tab === t.key ? 'bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900' : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400')}>{t.count}</span>
                </button>
              ))}
            </div>

            {/* Incident Queue */}
            {sortedReports.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 p-16 text-center">
                <CheckCheck size={48} className="mx-auto text-zinc-200 dark:text-zinc-700 mb-4" />
                <h3 className="text-xl font-semibold text-zinc-500">Queue Clear</h3>
                <p className="text-zinc-400 mt-1">All {tab.replace(/_/g, ' ').toLowerCase()} incidents resolved</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedReports.map(r => <IncidentCard key={r._id} report={r} onSelect={openInvestigation} />)}
              </div>
            )}
          </div>
        )}
    </div>
  );
};

export default AdminReports;
