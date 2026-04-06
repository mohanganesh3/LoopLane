import { useState, useMemo } from 'react';

const GROUP_META = {
  rides: { label: 'Ride Data', icon: 'fa-route', color: '#0ead69' },
  live: { label: 'Live Tracking', icon: 'fa-satellite-dish', color: '#06b6d4' },
  safety: { label: 'Safety', icon: 'fa-shield-halved', color: '#ff0040' },
  demand: { label: 'Demand Intel', icon: 'fa-chart-line', color: '#ffbf00' },
  environment: { label: 'Environment', icon: 'fa-cloud-sun', color: '#3b82f6' },
  analytics: { label: 'Driving Analytics', icon: 'fa-tachometer-alt', color: '#8b5cf6' },
};

const LAYER_DEFS = [
  { key: 'arcs', label: 'Ride Arcs', icon: 'fa-bezier-curve', group: 'rides' },
  { key: 'heatmap', label: 'Demand Heatmap', icon: 'fa-fire', group: 'rides' },
  { key: 'hexbins', label: '3D Hexbins', icon: 'fa-cubes', group: 'rides' },
  { key: 'pickups', label: 'Pickups', icon: 'fa-arrow-up', group: 'rides' },
  { key: 'dropoffs', label: 'Dropoffs', icon: 'fa-arrow-down', group: 'rides' },
  { key: 'drivers', label: 'Live Drivers', icon: 'fa-car', group: 'live' },
  { key: 'activeRoutes', label: 'Routes', icon: 'fa-road', group: 'live' },
  { key: 'tripTrails', label: 'Trip Trails', icon: 'fa-timeline', group: 'live' },
  { key: 'dangerZones', label: 'Danger Zones', icon: 'fa-triangle-exclamation', group: 'safety' },
  { key: 'dangerLinks', label: 'Deviation Links', icon: 'fa-link', group: 'safety' },
  { key: 'emergencies', label: 'SOS Alerts', icon: 'fa-kit-medical', group: 'safety' },
  { key: 'unfulfilled', label: 'Unfulfilled', icon: 'fa-magnifying-glass-minus', group: 'demand' },
  { key: 'routeAlerts', label: 'Route Alerts', icon: 'fa-bell', group: 'demand' },
  { key: 'weather', label: 'Weather', icon: 'fa-cloud', group: 'environment' },
  { key: 'forecast', label: 'Forecast', icon: 'fa-brain', group: 'environment' },
  { key: 'isochrone', label: 'Isochrone', icon: 'fa-circle-dot', group: 'environment' },
  { key: 'speedHeatmap', label: 'Speed Map', icon: 'fa-tachometer-alt', group: 'analytics' },
  { key: 'hardBrakes', label: 'Hard Braking', icon: 'fa-exclamation-circle', group: 'analytics' },
  { key: 'rapidAccel', label: 'Rapid Accel', icon: 'fa-arrow-up', group: 'analytics' },
  { key: 'speedViolations', label: 'Speeding', icon: 'fa-bolt', group: 'analytics' },
  { key: 'idleZones', label: 'Idle Zones', icon: 'fa-pause-circle', group: 'analytics' },
  { key: 'surgeZones', label: 'Surge', icon: 'fa-fire-alt', group: 'analytics' },
];

const LayerControlPanel = ({ visibility, toggleLayer, activeCount, open, setOpen, layerCounts = {} }) => {
  // Only expand groups that have active layers
  const [expandedGroups, setExpandedGroups] = useState({
    rides: false, live: false, safety: false, demand: false, environment: false, analytics: false,
  });

  const grouped = useMemo(() => {
    const map = {};
    LAYER_DEFS.forEach(l => {
      if (!map[l.group]) map[l.group] = [];
      map[l.group].push(l);
    });
    return map;
  }, []);

  const toggleGroup = (group) => {
    setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const getLayerCount = (layerKey) => layerCounts[layerKey] || 0;
  const canToggleLayer = (layerKey) => layerKey === 'isochrone' || getLayerCount(layerKey) > 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'absolute', top: 12, left: 16, zIndex: 12,
          background: 'rgba(10,10,20,0.88)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(14,173,105,0.25)', borderRadius: 10,
          padding: '8px 14px', color: '#0ead69', cursor: 'pointer',
          fontFamily: '"Space Grotesk", monospace', fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
          transition: 'all 0.2s',
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = '#0ead69'; e.currentTarget.style.boxShadow = '0 0 16px rgba(14,173,105,0.12)'; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(14,173,105,0.25)'; e.currentTarget.style.boxShadow = 'none'; }}
      >
        <i className="fas fa-layer-group" />
        <span style={{
          background: '#0ead69', color: '#000', fontSize: 10, fontWeight: 700,
          borderRadius: 5, padding: '0 5px',
        }}>{activeCount}</span>
      </button>
    );
  }

  return (
    <div style={{
      position: 'absolute', top: 12, left: 16, zIndex: 12,
      background: 'rgba(10,10,18,0.92)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(14,173,105,0.12)', borderRadius: 12,
      width: 240, maxHeight: 'calc(100vh - 140px)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Space Grotesk", monospace',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid rgba(14,173,105,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <i className="fas fa-layer-group" style={{ color: '#0ead69', fontSize: 12 }} />
          <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>LAYERS</span>
          <span style={{
            background: '#0ead69', color: '#000', fontSize: 9, fontWeight: 700,
            borderRadius: 5, padding: '0 5px',
          }}>{activeCount}</span>
        </div>
        <button onClick={() => setOpen(false)} style={{
          background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, padding: '0 2px',
        }}>
          <i className="fas fa-times" />
        </button>
      </div>

      {/* Scrollable layer list */}
      <div style={{ overflowY: 'auto', flex: 1, padding: '4px 0' }}>
        {Object.entries(GROUP_META).map(([groupKey, meta]) => {
          const layers = grouped[groupKey] || [];
          const activeInGroup = layers.filter(l => visibility[l.key]).length;
          const availableInGroup = layers.filter(l => canToggleLayer(l.key)).length;
          const expanded = expandedGroups[groupKey];

          return (
            <div key={groupKey}>
              {/* Group header — compact */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', padding: '5px 12px', cursor: 'pointer',
                  gap: 6, borderLeft: `2px solid ${activeInGroup > 0 ? meta.color : '#1e293b'}`,
                  transition: 'border-color 0.15s',
                }}
                onClick={() => toggleGroup(groupKey)}
              >
                <i className={`fas ${meta.icon}`} style={{ color: activeInGroup > 0 ? meta.color : '#334155', fontSize: 10, width: 14, textAlign: 'center' }} />
                <span style={{
                  color: activeInGroup > 0 ? '#94a3b8' : '#475569', fontSize: 10, fontWeight: 600, flex: 1,
                  letterSpacing: 0.4, textTransform: 'uppercase',
                }}>
                  {meta.label}
                </span>
                <span style={{ color: activeInGroup > 0 ? meta.color : '#334155', fontSize: 9, fontWeight: 700 }}>
                  {activeInGroup}/{availableInGroup || layers.length}
                </span>
                <i className={`fas fa-chevron-${expanded ? 'up' : 'down'}`} style={{ color: '#334155', fontSize: 8 }} />
              </div>

              {/* Layer items — compact */}
              {expanded && layers.map(layer => {
                const isOn = visibility[layer.key];
                const count = getLayerCount(layer.key);
                const disabled = !canToggleLayer(layer.key);
                return (
                  <div
                    key={layer.key}
                    onClick={() => { if (!disabled) toggleLayer(layer.key); }}
                    style={{
                      display: 'flex', alignItems: 'center', padding: '4px 12px 4px 26px',
                      cursor: disabled ? 'not-allowed' : 'pointer', gap: 6, transition: 'background 0.15s',
                      background: isOn ? 'rgba(14,173,105,0.04)' : 'transparent',
                      opacity: disabled ? 0.45 : 1,
                    }}
                    onMouseOver={e => { if (!disabled) e.currentTarget.style.background = 'rgba(14,173,105,0.07)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = isOn ? 'rgba(14,173,105,0.04)' : 'transparent'; }}
                  >
                    <div style={{
                      width: 12, height: 12, borderRadius: 3,
                      border: `1.5px solid ${isOn ? meta.color : '#334155'}`,
                      background: isOn ? meta.color : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s', flexShrink: 0,
                    }}>
                      {isOn && <i className="fas fa-check" style={{ fontSize: 7, color: '#000' }} />}
                    </div>
                    <i className={`fas ${layer.icon}`} style={{ color: isOn ? '#c8d6e5' : '#475569', fontSize: 10, width: 14, textAlign: 'center' }} />
                    <span style={{ color: isOn ? '#e2e8f0' : '#64748b', fontSize: 11, fontWeight: isOn ? 600 : 400, flex: 1 }}>
                      {layer.label}
                    </span>
                    <span style={{
                      minWidth: 20, textAlign: 'right',
                      color: count > 0 ? meta.color : '#475569',
                      fontSize: 9, fontWeight: 700, fontFamily: '"Space Grotesk", monospace',
                    }}>
                      {layer.key === 'isochrone' && count === 0 ? 'ALT' : count}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Quick toggle footer */}
      <div style={{
        padding: '6px 12px', borderTop: '1px solid rgba(14,173,105,0.06)',
        display: 'flex', gap: 6, flexShrink: 0,
      }}>
        <button
          onClick={() => {
            const allExpanded = Object.values(expandedGroups).every(v => v);
            const next = {};
            Object.keys(GROUP_META).forEach(k => next[k] = !allExpanded);
            setExpandedGroups(next);
          }}
          style={{
            flex: 1, background: 'rgba(14,173,105,0.06)', border: 'none', borderRadius: 4,
            padding: '3px 0', color: '#475569', cursor: 'pointer', fontSize: 9, fontFamily: 'inherit',
            fontWeight: 600, letterSpacing: 0.3,
          }}
        >
          {Object.values(expandedGroups).every(v => v) ? 'COLLAPSE ALL' : 'EXPAND ALL'}
        </button>
      </div>
    </div>
  );
};

export default LayerControlPanel;
