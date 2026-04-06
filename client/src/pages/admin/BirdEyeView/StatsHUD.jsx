import { useMemo } from 'react';
import { formatNumber, formatCurrency } from './utils/colors';

// ═══════════════════════════════════════════════════
//  COMPACT STATUS RIBBON — single bar, no overlap
//  Positioned right of layer panel, clean & readable
// ═══════════════════════════════════════════════════

const Chip = ({ icon, label, value, color = '#94a3b8', accent }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 5, padding: '0 10px',
    borderRight: '1px solid rgba(255,255,255,0.06)',
  }}>
    <i className={`fas ${icon}`} style={{ color: accent || color, fontSize: 10, opacity: 0.8 }} />
    <span style={{ color: '#64748b', fontSize: 10, letterSpacing: 0.3 }}>{label}</span>
    <span style={{ color, fontSize: 13, fontWeight: 700, fontFamily: '"Space Grotesk", monospace' }}>{value}</span>
  </div>
);

const Badge = ({ label, value, color }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
    background: `${color}18`, borderRadius: 6, border: `1px solid ${color}30`,
  }}>
    <span style={{ color, fontSize: 11, fontWeight: 700, fontFamily: '"Space Grotesk", monospace' }}>{value}</span>
    <span style={{ color: '#64748b', fontSize: 9 }}>{label}</span>
  </div>
);

const StatsHUD = ({ stats, activeLayerCount, weatherMeta, lastUpdated, leftOffset = 80, rightOffset = 56 }) => {
  const metrics = useMemo(() => {
    if (!stats) return { primary: [], badges: [] };

    const primary = [
      { icon: 'fa-route', label: 'Rides', value: formatNumber(stats.totalRides || 0), color: '#0ead69', accent: '#0ead69' },
      { icon: 'fa-indian-rupee-sign', label: 'Rev', value: formatCurrency(stats.totalRevenue || 0), color: '#5a9c7c', accent: '#5a9c7c' },
      { icon: 'fa-car', label: 'Drivers', value: formatNumber(stats.activeDrivers || 0), color: '#06b6d4', accent: '#06b6d4' },
      { icon: 'fa-bolt', label: 'Active', value: formatNumber(stats.activeRides || 0), color: '#f4a261', accent: '#f4a261' },
    ];

    if (stats.emergencies > 0) {
      primary.push({ icon: 'fa-triangle-exclamation', label: 'SOS', value: formatNumber(stats.emergencies), color: '#ff0040', accent: '#ff0040' });
    }
    if (stats.dangerZones > 0) {
      primary.push({ icon: 'fa-skull-crossbones', label: 'Danger', value: formatNumber(stats.dangerZones), color: '#dc2626', accent: '#dc2626' });
    }

    const badges = [];
    if (stats.drivingScore !== undefined && stats.drivingScore > 0) {
      const score = Math.round(stats.drivingScore);
      badges.push({ label: 'score', value: score, color: score >= 80 ? '#0ead69' : score >= 60 ? '#f4a261' : '#ff4060' });
    }
    if (stats.fleetAvgSpeed > 0) {
      badges.push({ label: 'km/h', value: Math.round(stats.fleetAvgSpeed), color: '#06b6d4' });
    }
    if (stats.completionRate > 0) {
      badges.push({ label: 'done', value: `${Math.round(stats.completionRate)}%`, color: '#0ead69' });
    }
    if (stats.speedViolations > 0) {
      badges.push({ label: 'speed!', value: stats.speedViolations, color: '#ff8000' });
    }

    return { primary, badges };
  }, [stats]);

  return (
    <div style={{
      position: 'absolute', top: 12, left: leftOffset, right: rightOffset, zIndex: 10,
      pointerEvents: 'none',
    }}>
      {/* Main ribbon bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        background: 'rgba(10,10,20,0.82)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(14,173,105,0.1)', borderRadius: 10,
        padding: '8px 4px', pointerEvents: 'auto',
        overflow: 'hidden',
      }}>
        {metrics.primary.map((m, i) => (
          <Chip key={i} {...m} />
        ))}

        {metrics.badges.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '0 8px',
            borderRight: '1px solid rgba(255,255,255,0.06)',
          }}>
            {metrics.badges.map((b, i) => (
              <Badge key={i} {...b} />
            ))}
          </div>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px',
          marginLeft: 'auto', flexShrink: 0,
        }}>
          <span style={{ color: '#334155', fontSize: 9 }}>
            <i className="fas fa-layer-group" style={{ marginRight: 3, color: '#0ead69' }} />
            {activeLayerCount}
          </span>
          {(weatherMeta?.temperature ?? weatherMeta?.temp) && (
            <span style={{ color: '#334155', fontSize: 9 }}>
              <i className="fas fa-cloud" style={{ marginRight: 3, color: '#3b82f6' }} />
              {Math.round(weatherMeta?.temperature ?? weatherMeta?.temp)}°C
            </span>
          )}
          {lastUpdated && (
            <span style={{ color: '#1e293b', fontSize: 9 }}>
              {new Date(lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* Secondary info — only when meaningful data exists */}
      {stats && (stats.peakHour !== undefined || stats.avgDistance > 0 || stats.averageOccupancy > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginTop: 4,
          padding: '4px 12px', pointerEvents: 'auto',
          color: '#334155', fontSize: 9, fontFamily: '"Space Grotesk", monospace',
        }}>
          {stats.peakHour !== undefined && stats.peakHour !== null && (
            <span>
              <i className="fas fa-clock" style={{ marginRight: 3, color: '#e07a5f' }} />
              Peak: {stats.peakHour === 0 ? '12 AM' : stats.peakHour < 12 ? `${stats.peakHour} AM` : stats.peakHour === 12 ? '12 PM' : `${stats.peakHour - 12} PM`}
            </span>
          )}
          {stats.avgDistance > 0 && (
            <span>
              <i className="fas fa-ruler" style={{ marginRight: 3, color: '#94a3b8' }} />
              Avg: {stats.avgDistance.toFixed(1)}km
            </span>
          )}
          {stats.averageOccupancy > 0 && (
            <span>
              <i className="fas fa-users" style={{ marginRight: 3, color: '#06b6d4' }} />
              {stats.averageOccupancy.toFixed(1)} pax
            </span>
          )}
          {stats.unfulfilledSearches > 0 && (
            <span style={{ color: '#92400e' }}>
              <i className="fas fa-search-minus" style={{ marginRight: 3, color: '#ffbf00' }} />
              {stats.unfulfilledSearches} unfulfilled
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default StatsHUD;
