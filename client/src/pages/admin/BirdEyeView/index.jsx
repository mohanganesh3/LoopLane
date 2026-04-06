import { useState, useCallback, useEffect, useMemo } from 'react';
import useBirdEyeData from './hooks/useBirdEyeData';
import useLayerVisibility from './hooks/useLayerVisibility';
import GlobeMode from './GlobeMode';
import MapMode from './MapMode';
import StatsHUD from './StatsHUD';
import LayerControlPanel from './LayerControlPanel';
import TimeRangeSlider from './TimeRangeSlider';
import RideAnalyticsPanel from './RideAnalyticsPanel';
import { UI_COLORS, CITY_VIEW_STATES } from './utils/colors';

const BirdEyeView = () => {
  const {
    data, loading, error, lastUpdated,
    selectedCity, weatherMeta,
    refresh, loadIsochrone, clearIsochrone, changeCity,
  } = useBirdEyeData();
  const { visibility, toggleLayer, activeCount } = useLayerVisibility();
  const [viewMode, setViewMode] = useState('map');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);

  const layerCounts = useMemo(() => ({
    arcs: data.arcData?.length || 0,
    heatmap: data.heatmapData?.length || 0,
    hexbins: data.densityData?.length || 0,
    pickups: data.pickupPoints?.length || 0,
    dropoffs: data.dropoffPoints?.length || 0,
    drivers: data.liveTelemetry?.length || 0,
    activeRoutes: data.activeRoutes?.length || 0,
    tripTrails: data.breadcrumbTrails?.length || 0,
    dangerZones: data.dangerZones?.length || 0,
    dangerLinks: data.dangerZones?.filter(zone => zone.expectedCoordinates?.length === 2)?.length || 0,
    emergencies: data.emergencies?.length || 0,
    unfulfilled: data.unfulfilledDemand?.length || 0,
    routeAlerts: data.routeAlerts?.length || 0,
    weather: data.weatherData?.features?.length || 0,
    forecast: data.forecastData?.length || 0,
    isochrone: data.isochroneData?.features?.length || 0,
    speedHeatmap: data.speedSegments?.length || 0,
    hardBrakes: data.hardBrakeEvents?.length || 0,
    rapidAccel: data.rapidAccelEvents?.length || 0,
    speedViolations: data.speedingEvents?.length || 0,
    idleZones: data.idleZones?.length || 0,
    surgeZones: data.surgeZones?.length || 0,
  }), [data]);

  // Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.getElementById('birdeye-root')?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Date range filter
  const handleDateRange = useCallback((range) => {
    refresh(range);
  }, [refresh]);

  // City change
  const handleCityChange = useCallback((cityKey) => {
    changeCity(cityKey);
  }, [changeCity]);

  // Isochrone on alt-click
  const handleLoadIsochrone = useCallback((lng, lat, minutes = 15) => {
    loadIsochrone(lng, lat, minutes);
  }, [loadIsochrone]);

  // Click location handler
  const handleClickLocation = useCallback((obj) => {
    // Future: detail panel, drill-down, etc.
  }, []);

  // Error state
  if (error && !data.arcData?.length) {
    return (
      <div style={{
        width: '100%', height: '100vh', background: UI_COLORS.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '"Space Grotesk", monospace', color: UI_COLORS.textDim,
        flexDirection: 'column', gap: 16,
      }}>
        <i className="fas fa-satellite-dish" style={{ fontSize: 48, color: UI_COLORS.red, opacity: 0.5 }} />
        <div style={{ color: UI_COLORS.red, fontSize: 14, fontWeight: 600 }}>TELEMETRY OFFLINE</div>
        <div style={{ fontSize: 12, maxWidth: 400, textAlign: 'center' }}>{error}</div>
        <button
          onClick={() => refresh()}
          style={{
            marginTop: 8, padding: '10px 24px', borderRadius: 8,
            background: 'rgba(14,173,105,0.1)', border: `1px solid ${UI_COLORS.cyan}`,
            color: UI_COLORS.cyan, fontFamily: 'inherit', fontSize: 12,
            fontWeight: 600, cursor: 'pointer', letterSpacing: 1,
          }}
        >
          <i className="fas fa-sync-alt" style={{ marginRight: 8 }} /> RECONNECT
        </button>
      </div>
    );
  }

  return (
    <div
      id="birdeye-root"
      style={{
        width: '100%', height: isFullscreen ? '100vh' : 'calc(100vh - 64px)',
        background: UI_COLORS.bg, position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Loading overlay */}
      {loading && !data.arcData?.length && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100,
          background: 'rgba(10,10,15,0.95)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16,
          fontFamily: '"Space Grotesk", monospace',
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: '50%',
            border: `3px solid ${UI_COLORS.border}`,
            borderTopColor: UI_COLORS.cyan,
            animation: 'spin 1s linear infinite',
          }} />
          <div style={{ color: UI_COLORS.cyan, fontSize: 13, letterSpacing: 3 }}>
            LOADING TELEMETRY...
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Main view */}
      {viewMode === 'globe' ? (
        <GlobeMode data={data} onSwitchToMap={() => setViewMode('map')} />
      ) : (
        <MapMode
          data={data}
          visibility={visibility}
          onSwitchToGlobe={() => setViewMode('globe')}
          onClickLocation={handleClickLocation}
          selectedCity={selectedCity}
          onLoadIsochrone={handleLoadIsochrone}
        />
      )}

      {/* Stats HUD */}
      {viewMode === 'map' && (
        <StatsHUD
          stats={data.stats}
          activeLayerCount={activeCount}
          weatherMeta={weatherMeta}
          lastUpdated={lastUpdated}
          leftOffset={layerPanelOpen ? 268 : 80}
          rightOffset={analyticsOpen ? 392 : 56}
        />
      )}

      {/* Layer Control Panel */}
      {viewMode === 'map' && (
        <LayerControlPanel
          visibility={visibility}
          toggleLayer={toggleLayer}
          activeCount={activeCount}
          open={layerPanelOpen}
          setOpen={setLayerPanelOpen}
          layerCounts={layerCounts}
        />
      )}

      {/* Time Range Slider */}
      {viewMode === 'map' && (
        <TimeRangeSlider onDateRangeChange={handleDateRange} />
      )}

      {/* Top-right utility buttons + city selector */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end',
      }}>
        {/* City Selector Dropdown */}
        <CitySelector
          selectedCity={selectedCity}
          cityPresets={data.cityPresets}
          onChange={handleCityChange}
        />
        <UtilBtn icon="fa-expand" onClick={toggleFullscreen} title="Fullscreen" />
        <UtilBtn icon="fa-sync-alt" onClick={() => refresh()} title="Refresh Data" spinning={loading} />
        {data.isochroneData && (
          <UtilBtn icon="fa-xmark" onClick={clearIsochrone} title="Clear Isochrone" color="#ff6b6b" />
        )}
      </div>

      {/* Error toast */}
      {error && data.arcData?.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 70, right: 16, zIndex: 20,
          background: 'rgba(25,10,10,0.92)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,0,64,0.3)', borderRadius: 10,
          padding: '10px 16px', fontFamily: '"Space Grotesk", monospace',
          color: '#fca5a5', fontSize: 11, maxWidth: 300,
        }}>
          <i className="fas fa-exclamation-circle" style={{ marginRight: 6, color: UI_COLORS.red }} />
          {error}
        </div>
      )}

      {/* Isochrone hint */}
      {viewMode === 'map' && !data.isochroneData && (
        <div style={{
          position: 'absolute', bottom: 20, right: 16, zIndex: 8,
          color: '#334155', fontSize: 10, fontFamily: '"Space Grotesk", monospace',
        }}>
          Alt+Click on map to generate reachability zone
        </div>
      )}

      {/* Analytics Panel Toggle Button */}
      {viewMode === 'map' && (
        <button
          onClick={() => setAnalyticsOpen(!analyticsOpen)}
          style={{
            position: 'absolute', bottom: 80, right: analyticsOpen ? 376 : 16, zIndex: 22,
            background: analyticsOpen ? 'rgba(14,173,105,0.15)' : 'rgba(10,10,20,0.85)',
            backdropFilter: 'blur(12px)',
            border: `1px solid ${analyticsOpen ? '#0ead69' : 'rgba(14,173,105,0.3)'}`,
            borderRadius: 10, padding: '10px 16px',
            color: '#0ead69', cursor: 'pointer',
            fontFamily: '"Space Grotesk", monospace', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'all 0.3s ease', letterSpacing: 0.5,
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = '#0ead69'; e.currentTarget.style.boxShadow = '0 0 20px rgba(14,173,105,0.15)'; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = analyticsOpen ? '#0ead69' : 'rgba(14,173,105,0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <i className={`fas fa-${analyticsOpen ? 'times' : 'chart-line'}`} />
          {analyticsOpen ? 'CLOSE' : 'ANALYTICS'}
        </button>
      )}

      {/* Ride Analytics Deep-Dive Panel */}
      {viewMode === 'map' && (
        <RideAnalyticsPanel
          stats={data.stats}
          open={analyticsOpen}
          onClose={() => setAnalyticsOpen(false)}
        />
      )}
    </div>
  );
};

/* ─── City Selector Dropdown ─── */
const CitySelector = ({ selectedCity, cityPresets, onChange }) => {
  const [open, setOpen] = useState(false);
  const rawCities = cityPresets || Object.keys(CITY_VIEW_STATES);
  // Ensure 'all' is always first
  const cities = ['all', ...(Array.isArray(rawCities) ? rawCities : Object.keys(rawCities)).filter(c => c !== 'all')];

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: UI_COLORS.bgPanel, backdropFilter: 'blur(12px)',
          border: `1px solid ${UI_COLORS.border}`, borderRadius: 10,
          padding: '8px 14px', color: UI_COLORS.cyan, cursor: 'pointer',
          fontFamily: '"Space Grotesk", monospace', fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8, letterSpacing: 0.5,
          transition: 'all 0.15s', minWidth: 130,
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = UI_COLORS.cyan; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = UI_COLORS.border; }}
      >
        <i className="fas fa-city" style={{ fontSize: 11 }} />
        <span style={{ textTransform: 'capitalize' }}>{selectedCity === 'all' ? 'All Cities' : (selectedCity || 'all')}</span>
        <i className={`fas fa-chevron-${open ? 'up' : 'down'}`} style={{ fontSize: 9, marginLeft: 'auto' }} />
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: 'rgba(10,10,20,0.95)', backdropFilter: 'blur(16px)',
          border: `1px solid ${UI_COLORS.border}`, borderRadius: 10,
          overflow: 'hidden', minWidth: 160, zIndex: 100,
        }}>
          {(Array.isArray(cities) ? cities : Object.keys(cities)).map(city => {
            const key = typeof city === 'string' ? city : city.key;
            const label = key === 'all' ? 'All Cities' : (typeof city === 'string' ? city : city.name);
            const isActive = key === selectedCity;
            return (
              <div
                key={key}
                onClick={() => { onChange(key); setOpen(false); }}
                style={{
                  padding: '8px 14px', cursor: 'pointer',
                  color: isActive ? '#0ead69' : '#94a3b8',
                  background: isActive ? 'rgba(14,173,105,0.1)' : 'transparent',
                  fontSize: 12, fontFamily: '"Space Grotesk", monospace',
                  fontWeight: isActive ? 700 : 400, textTransform: 'capitalize',
                  transition: 'background 0.1s', letterSpacing: 0.5,
                }}
                onMouseOver={e => { if (!isActive) e.currentTarget.style.background = 'rgba(14,173,105,0.05)'; }}
                onMouseOut={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                {isActive && <i className="fas fa-check" style={{ marginRight: 8, fontSize: 10 }} />}
                {label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ─── Utility Button ─── */
const UtilBtn = ({ icon, onClick, title, spinning, color }) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      width: 38, height: 38, borderRadius: 10,
      background: UI_COLORS.bgPanel, backdropFilter: 'blur(12px)',
      border: `1px solid ${UI_COLORS.border}`, color: color || UI_COLORS.cyan,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, transition: 'all 0.15s', padding: 0,
    }}
    onMouseOver={e => { e.currentTarget.style.borderColor = color || UI_COLORS.cyan; e.currentTarget.style.boxShadow = `0 0 15px ${(color || 'rgba(14,173,105,') + '0.15)'}` ; }}
    onMouseOut={e => { e.currentTarget.style.borderColor = UI_COLORS.border; e.currentTarget.style.boxShadow = 'none'; }}
  >
    <i className={`fas ${icon}`} style={{ animation: spinning ? 'spin 1s linear infinite' : 'none' }} />
  </button>
);

export default BirdEyeView;
