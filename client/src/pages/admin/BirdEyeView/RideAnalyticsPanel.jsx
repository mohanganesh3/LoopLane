import { useState, useMemo } from 'react';
import { formatNumber, formatCurrency } from './utils/colors';

// ═══════════════════════════════════════════════════
//  RIDE ANALYTICS DEEP-DIVE PANEL
//  Ola/Uber-grade: Speed, Revenue, Drivers, Behavior
// ═══════════════════════════════════════════════════

const TABS = [
  { key: 'overview', label: 'Overview', icon: 'fa-chart-pie' },
  { key: 'speed', label: 'Speed', icon: 'fa-gauge-high' },
  { key: 'revenue', label: 'Revenue', icon: 'fa-indian-rupee-sign' },
  { key: 'drivers', label: 'Drivers', icon: 'fa-users' },
  { key: 'safety', label: 'Safety', icon: 'fa-shield-halved' },
];

// ─── Inline Bar Chart ───
const BarChart = ({ data, labelKey, valueKey, maxBars = 10, color = '#0ead69', unit = '' }) => {
  if (!data || data.length === 0) return <div style={emptyStyle}>No data available</div>;
  const items = data.slice(0, maxBars);
  const maxVal = Math.max(...items.map(d => d[valueKey] || 0), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {items.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 10, width: 60, textAlign: 'right', flexShrink: 0, fontFamily: 'monospace' }}>
            {d[labelKey]}
          </span>
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 3, height: 16, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              width: `${(d[valueKey] / maxVal) * 100}%`, height: '100%',
              background: color, borderRadius: 3, opacity: 0.8,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ color: '#64748b', fontSize: 10, width: 50, flexShrink: 0, fontFamily: 'monospace' }}>
            {typeof d[valueKey] === 'number' ? d[valueKey].toFixed(1) : d[valueKey]}{unit}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Metric Row ───
const MetricRow = ({ label, value, sub, icon, color = '#94a3b8' }) => (
  <div style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
    {icon && <i className={`fas ${icon}`} style={{ color, fontSize: 11, width: 22, textAlign: 'center', opacity: 0.7 }} />}
    <span style={{ flex: 1, color: '#94a3b8', fontSize: 11 }}>{label}</span>
    <div style={{ textAlign: 'right' }}>
      <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700, fontFamily: '"Space Grotesk", monospace' }}>{value}</span>
      {sub && <div style={{ color: '#475569', fontSize: 9 }}>{sub}</div>}
    </div>
  </div>
);

// ─── Hourly Heatmap Row ───
const HourlyHeatmap = ({ hourlyMetrics }) => {
  if (!hourlyMetrics || hourlyMetrics.length === 0) return null;
  const maxRides = Math.max(...hourlyMetrics.map(h => h.rides || 0), 1);
  return (
    <div>
      <div style={{ color: '#64748b', fontSize: 10, marginBottom: 6, fontWeight: 600 }}>HOURLY RIDE DISTRIBUTION</div>
      <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 40 }}>
        {hourlyMetrics.map((h, i) => {
          const intensity = (h.rides || 0) / maxRides;
          const r = Math.round(14 + (209 - 14) * intensity);
          const g = Math.round(173 - (173 - 55) * intensity);
          const b = Math.round(105 - (105 - 78) * intensity);
          return (
            <div
              key={i}
              title={`${i}:00 — ${h.rides || 0} rides, avg speed ${(h.avgSpeed || 0).toFixed(1)} km/h`}
              style={{
                flex: 1, height: `${Math.max(intensity * 100, 5)}%`,
                background: `rgb(${r},${g},${b})`,
                borderRadius: '2px 2px 0 0', cursor: 'pointer', transition: 'height 0.3s',
              }}
            />
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ color: '#334155', fontSize: 8 }}>0h</span>
        <span style={{ color: '#334155', fontSize: 8 }}>6h</span>
        <span style={{ color: '#334155', fontSize: 8 }}>12h</span>
        <span style={{ color: '#334155', fontSize: 8 }}>18h</span>
        <span style={{ color: '#334155', fontSize: 8 }}>23h</span>
      </div>
    </div>
  );
};

const emptyStyle = { color: '#334155', fontSize: 11, textAlign: 'center', padding: 16, fontStyle: 'italic' };

// ─── Tab Content ───
const OverviewTab = ({ stats }) => {
  if (!stats) return <div style={emptyStyle}>No analytics data</div>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <HourlyHeatmap hourlyMetrics={stats.hourlyMetrics} />
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
        <MetricRow label="Total Rides" value={formatNumber(stats.totalRides || 0)} icon="fa-route" color="#0ead69" />
        <MetricRow label="Total Revenue" value={formatCurrency(stats.totalRevenue || 0)} icon="fa-indian-rupee-sign" color="#5a9c7c" />
        <MetricRow label="Active Drivers" value={formatNumber(stats.activeDrivers || 0)} icon="fa-car" color="#06b6d4" />
        <MetricRow label="Completion Rate" value={`${(stats.completionRate || 0).toFixed(1)}%`} icon="fa-check-circle" color="#0ead69" />
        <MetricRow label="Cancellation Rate" value={`${(stats.cancellationRate || 0).toFixed(1)}%`} icon="fa-times-circle" color="#ff4060" />
        <MetricRow label="Avg Occupancy" value={`${(stats.averageOccupancy || 0).toFixed(1)} pax`} icon="fa-users" color="#06b6d4" />
        <MetricRow label="Avg Trip Distance" value={`${(stats.avgDistance || 0).toFixed(1)} km`} icon="fa-ruler" color="#94a3b8" />
        <MetricRow label="Fleet Utilization" value={`${stats.activeRides || 0} / ${stats.activeDrivers || 0}`} icon="fa-chart-bar" color="#f4a261" sub="Active rides / drivers" />
      </div>
    </div>
  );
};

const SpeedTab = ({ stats }) => {
  if (!stats?.fleetAvgSpeed) return <div style={emptyStyle}>No speed data — rides need breadcrumbs</div>;
  const speedDist = stats.fleetSpeedDistribution ? 
    Object.entries(stats.fleetSpeedDistribution).map(([bucket, count]) => ({
      bucket: `${bucket}`, count
    })).sort((a, b) => parseInt(a.bucket) - parseInt(b.bucket)) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MiniGauge label="AVG SPEED" value={stats.fleetAvgSpeed.toFixed(1)} unit="km/h" color="#06b6d4" />
        <MiniGauge label="MAX SPEED" value={(stats.fleetMaxSpeed || 0).toFixed(0)} unit="km/h" color="#8b5cf6" />
      </div>
      <MetricRow label="Speed Violations" value={formatNumber(stats.speedViolations || 0)} icon="fa-bolt" color="#ff8000" sub="> city speed limit" />
      <MetricRow label="Route Efficiency" value={`${(stats.avgRouteEfficiency || 0).toFixed(1)}%`} icon="fa-road" color="#0ead69" sub="straight-line / actual" />
      <MetricRow label="Avg Detour" value={`${(stats.avgDetourPercent || 0).toFixed(1)}%`} icon="fa-shuffle" color="#f4a261" sub="actual vs planned route" />
      <MetricRow label="Idle Time / Ride" value={`${(stats.avgIdleMinPerRide || 0).toFixed(1)} min`} icon="fa-pause" color="#94a3b8" />
      {speedDist.length > 0 && (
        <div>
          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 6, fontWeight: 600 }}>SPEED DISTRIBUTION (km/h buckets)</div>
          <BarChart data={speedDist} labelKey="bucket" valueKey="count" color="#06b6d4" />
        </div>
      )}
    </div>
  );
};

const RevenueTab = ({ stats }) => {
  if (!stats?.totalRevenue) return <div style={emptyStyle}>No revenue data</div>;
  const hourlyRev = stats.hourlyMetrics?.map((h, i) => ({
    hour: `${i}:00`, revenue: h.revenue || 0
  })).filter(h => h.revenue > 0) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <MiniGauge label="REV / KM" value={`₹${(stats.revenuePerKm || 0).toFixed(1)}`} color="#5a9c7c" />
        <MiniGauge label="REV / HOUR" value={`₹${(stats.revenuePerHour || 0).toFixed(0)}`} color="#0ead69" />
      </div>
      <MetricRow label="Revenue / seat·km" value={`₹${(stats.revenuePerSeatKm || 0).toFixed(2)}`} icon="fa-chair" color="#8b5cf6" sub="Key unit economics metric" />
      <MetricRow label="Total Revenue" value={formatCurrency(stats.totalRevenue || 0)} icon="fa-indian-rupee-sign" color="#5a9c7c" />
      <MetricRow label="Avg Fare" value={formatCurrency(stats.avgFare || 0)} icon="fa-wallet" color="#06b6d4" />
      <MetricRow label="Avg Rides/Driver" value={(stats.avgRidesPerDriver || 0).toFixed(1)} icon="fa-truck" color="#f4a261" />
      {hourlyRev.length > 0 && (
        <div>
          <div style={{ color: '#64748b', fontSize: 10, marginBottom: 6, fontWeight: 600 }}>REVENUE BY HOUR</div>
          <BarChart data={hourlyRev.slice(0, 12)} labelKey="hour" valueKey="revenue" color="#5a9c7c" unit="₹" />
        </div>
      )}
    </div>
  );
};

const DriversTab = ({ stats }) => {
  const leaderboard = stats?.driverLeaderboard || [];
  if (leaderboard.length === 0) return <div style={emptyStyle}>No driver data</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <MetricRow label="Active Drivers" value={formatNumber(stats.activeDrivers || 0)} icon="fa-car" color="#06b6d4" />
      <MetricRow label="Rides / Driver" value={(stats.avgRidesPerDriver || 0).toFixed(1)} icon="fa-user-clock" color="#f4a261" />
      <MetricRow label="Avg Wait Time" value={`${(stats.avgWaitTimeMin || 0).toFixed(1)} min`} icon="fa-hourglass-half" color="#94a3b8" />
      <MetricRow label="Avg Response Time" value={`${(stats.avgResponseTimeMin || 0).toFixed(1)} min`} icon="fa-stopwatch" color="#e07a5f" />

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 8 }}>
        <div style={{ color: '#64748b', fontSize: 10, marginBottom: 8, fontWeight: 600, letterSpacing: 0.5 }}>
          TOP DRIVERS BY RIDE COUNT
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {leaderboard.slice(0, 15).map((driver, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px',
              background: i < 3 ? 'rgba(14,173,105,0.05)' : 'transparent',
              borderRadius: 4,
            }}>
              <span style={{
                color: i < 3 ? '#0ead69' : '#475569', fontSize: 10, fontWeight: 700,
                width: 18, textAlign: 'center',
              }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </span>
              <span style={{ flex: 1, color: '#e2e8f0', fontSize: 11, fontWeight: i < 3 ? 600 : 400 }}>
                {driver.name || 'Unknown Driver'}
              </span>
              <span style={{ color: '#0ead69', fontSize: 11, fontWeight: 700, fontFamily: 'monospace' }}>
                {driver.rides}
              </span>
              <span style={{ color: '#475569', fontSize: 9 }}>rides</span>
              {driver.avgSpeed > 0 && (
                <span style={{ color: '#334155', fontSize: 9, fontFamily: 'monospace' }}>
                  {driver.avgSpeed.toFixed(0)}km/h
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SafetyTab = ({ stats }) => {
  if (!stats) return <div style={emptyStyle}>No safety data</div>;
  const score = Math.round(stats.drivingScore || 0);
  const scoreColor = score >= 80 ? '#0ead69' : score >= 60 ? '#f4a261' : '#ff4060';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Driving score gauge */}
      <div style={{ textAlign: 'center', padding: '12px 0' }}>
        <div style={{ color: '#64748b', fontSize: 10, fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>FLEET DRIVING SCORE</div>
        <div style={{
          fontSize: 48, fontWeight: 800, fontFamily: '"Space Grotesk", monospace',
          color: scoreColor, lineHeight: 1,
        }}>
          {score}
        </div>
        <div style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>
          out of 100
          {score >= 80 ? ' — Excellent' : score >= 60 ? ' — Needs Improvement' : ' — Critical'}
        </div>
      </div>

      <MetricRow label="Hard Braking Events" value={formatNumber(stats.hardBrakeCount || 0)} icon="fa-exclamation-triangle" color="#ff4060" sub="> 15 km/h/s deceleration" />
      <MetricRow label="Speed Violations" value={formatNumber(stats.speedViolations || 0)} icon="fa-bolt" color="#ff8000" sub="Exceeding city limits" />
      <MetricRow label="Rapid Accelerations" value={formatNumber(stats.rapidAccelCount || 0)} icon="fa-up-long" color="#f4a261" sub="> 12 km/h/s acceleration" />
      <MetricRow label="Emergencies (SOS)" value={formatNumber(stats.emergencies || 0)} icon="fa-phone" color="#ff0040" />
      <MetricRow label="Danger Zones" value={formatNumber(stats.dangerZones || 0)} icon="fa-triangle-exclamation" color="#dc2626" sub="Route deviation alerts" />
      <MetricRow label="ETA Accuracy" value={`${(stats.avgETAAccuracy || 0).toFixed(1)}%`} icon="fa-bullseye" color="#06b6d4" />
      <MetricRow label="No-Show Rate" value={`${(stats.noShowRate || 0).toFixed(1)}%`} icon="fa-user-slash" color="#94a3b8" />
    </div>
  );
};

// ─── Mini Gauge (for speed/revenue highlights) ───
const MiniGauge = ({ label, value, unit, color = '#0ead69' }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.04)',
  }}>
    <div style={{ color: '#475569', fontSize: 9, fontWeight: 600, letterSpacing: 0.5, marginBottom: 4 }}>{label}</div>
    <div style={{ color, fontSize: 20, fontWeight: 800, fontFamily: '"Space Grotesk", monospace', lineHeight: 1.1 }}>
      {value}
    </div>
    {unit && <div style={{ color: '#334155', fontSize: 9, marginTop: 2 }}>{unit}</div>}
  </div>
);

// ═══════════════════════════════════════════════════
//  MAIN PANEL
// ═══════════════════════════════════════════════════
const RideAnalyticsPanel = ({ stats, open, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!open) return null;

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 20,
      width: 360, display: 'flex', flexDirection: 'column',
      background: 'rgba(10,10,18,0.94)', backdropFilter: 'blur(24px)',
      borderLeft: '1px solid rgba(14,173,105,0.12)',
      fontFamily: '"Space Grotesk", monospace',
      transition: 'transform 0.3s ease',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: '1px solid rgba(14,173,105,0.1)',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      }}>
        <i className="fas fa-chart-line" style={{ color: '#0ead69', fontSize: 14 }} />
        <span style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 700, letterSpacing: 1, flex: 1 }}>
          RIDE ANALYTICS
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
            color: '#94a3b8', cursor: 'pointer', width: 28, height: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = '#ff4060'; e.currentTarget.style.color = '#ff4060'; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#94a3b8'; }}
        >
          <i className="fas fa-times" style={{ fontSize: 11 }} />
        </button>
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex', borderBottom: '1px solid rgba(14,173,105,0.08)',
        padding: '0 8px', flexShrink: 0,
      }}>
        {TABS.map(tab => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '10px 4px', background: 'none', border: 'none',
                borderBottom: active ? '2px solid #0ead69' : '2px solid transparent',
                color: active ? '#0ead69' : '#475569', cursor: 'pointer',
                fontSize: 10, fontFamily: 'inherit', fontWeight: active ? 700 : 400,
                letterSpacing: 0.3, transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              }}
            >
              <i className={`fas ${tab.icon}`} style={{ fontSize: 11 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>
        {activeTab === 'overview' && <OverviewTab stats={stats} />}
        {activeTab === 'speed' && <SpeedTab stats={stats} />}
        {activeTab === 'revenue' && <RevenueTab stats={stats} />}
        {activeTab === 'drivers' && <DriversTab stats={stats} />}
        {activeTab === 'safety' && <SafetyTab stats={stats} />}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 16px', borderTop: '1px solid rgba(14,173,105,0.08)',
        color: '#334155', fontSize: 9, textAlign: 'center', flexShrink: 0,
      }}>
        Analytics computed from ride breadcrumb data · Thresholds: Brake &gt;15 km/h/s · Speed limit 60 km/h
      </div>
    </div>
  );
};

export default RideAnalyticsPanel;
