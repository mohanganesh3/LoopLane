import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { _GlobeView as GlobeView } from '@deck.gl/core';
import { GeoJsonLayer, ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
import { ARC_SOURCE_COLOR, ARC_TARGET_COLOR, DRIVER_COLOR, SOS_COLOR, GLOBE_VIEW_STATE, getArcColor, getPulseRadius } from './utils/colors';

// Simplified world GeoJSON outline (countries)
const WORLD_GEOJSON_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';

const GlobeMode = ({ data, onSwitchToMap }) => {
  const [viewState, setViewState] = useState(GLOBE_VIEW_STATE);
  const [worldGeo, setWorldGeo] = useState(null);
  const [hoveredObject, setHoveredObject] = useState(null);
  const [animTime, setAnimTime] = useState(0);
  const animRef = useRef(null);
  const autoRotateRef = useRef(true);

  // Load world GeoJSON
  useEffect(() => {
    fetch(WORLD_GEOJSON_URL)
      .then(r => r.json())
      .then(setWorldGeo)
      .catch(() => setWorldGeo(null));
  }, []);

  // Animation loop for pulsing + rotation
  useEffect(() => {
    const animate = () => {
      setAnimTime(Date.now());
      if (autoRotateRef.current) {
        setViewState(prev => ({
          ...prev,
          longitude: prev.longitude + 0.015,
        }));
      }
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const onViewStateChange = useCallback(({ viewState: vs, interactionState }) => {
    if (interactionState?.isDragging || interactionState?.isZooming) {
      autoRotateRef.current = false;
    }
    setViewState(vs);
  }, []);

  // Resume auto-rotation after 10 seconds of no interaction
  useEffect(() => {
    if (!autoRotateRef.current) {
      const timer = setTimeout(() => { autoRotateRef.current = true; }, 10000);
      return () => clearTimeout(timer);
    }
  }, [viewState]);

  const layers = useMemo(() => {
    const allLayers = [];

    // Country outlines
    if (worldGeo) {
      allLayers.push(
        new GeoJsonLayer({
          id: 'globe-countries',
          data: worldGeo,
          filled: true,
          getFillColor: [12, 12, 25, 200],
          stroked: true,
          getLineColor: [0, 245, 255, 40],
          lineWidthMinPixels: 0.5,
          pickable: false,
        })
      );
    }

    // Ride arc corridors on globe
    if (data.arcData?.length > 0) {
      allLayers.push(
        new ArcLayer({
          id: 'globe-arcs',
          data: data.arcData,
          getSourcePosition: d => d.source,
          getTargetPosition: d => d.target,
          getSourceColor: d => {
            const c = getArcColor(d.distance);
            return c.source;
          },
          getTargetColor: d => {
            const c = getArcColor(d.distance);
            return c.target;
          },
          getHeight: 0.5,
          getWidth: d => Math.max(1, Math.min(d.value * 0.8, 5)),
          greatCircle: true,
          widthMinPixels: 1,
          widthMaxPixels: 6,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 100],
        })
      );
    }

    // Live driver positions
    if (data.liveTelemetry?.length > 0) {
      const pulseSize = getPulseRadius(80000, animTime, 1.5);
      allLayers.push(
        new ScatterplotLayer({
          id: 'globe-drivers-pulse',
          data: data.liveTelemetry,
          getPosition: d => d.coordinates,
          getRadius: pulseSize,
          getFillColor: [0, 245, 255, 40],
          stroked: false,
          radiusUnits: 'meters',
          pickable: false,
        }),
        new ScatterplotLayer({
          id: 'globe-drivers',
          data: data.liveTelemetry,
          getPosition: d => d.coordinates,
          getRadius: 30000,
          getFillColor: DRIVER_COLOR,
          stroked: true,
          getLineColor: [255, 255, 255, 200],
          lineWidthMinPixels: 1,
          radiusUnits: 'meters',
          pickable: true,
          autoHighlight: true,
        })
      );
    }

    // SOS emergencies
    if (data.emergencies?.length > 0) {
      const sosRadius = getPulseRadius(60000, animTime, 2);
      allLayers.push(
        new ScatterplotLayer({
          id: 'globe-sos-pulse',
          data: data.emergencies,
          getPosition: d => d.coordinates,
          getRadius: sosRadius,
          getFillColor: [255, 0, 64, 60],
          stroked: false,
          radiusUnits: 'meters',
          pickable: false,
        }),
        new ScatterplotLayer({
          id: 'globe-sos',
          data: data.emergencies,
          getPosition: d => d.coordinates,
          getRadius: 25000,
          getFillColor: SOS_COLOR,
          stroked: true,
          getLineColor: [255, 255, 255, 255],
          lineWidthMinPixels: 2,
          radiusUnits: 'meters',
          pickable: true,
        })
      );
    }

    return allLayers;
  }, [data, worldGeo, animTime]);

  const getTooltip = useCallback(({ object, layer }) => {
    if (!object) return null;
    if (layer?.id === 'globe-arcs') {
      return {
        html: `<div style="font-family:monospace;padding:8px;background:#0a0a1a;border:1px solid #0ead6940;border-radius:8px;color:#e2e8f0">
          <div style="color:#0ead69;font-weight:bold;margin-bottom:4px">RIDE CORRIDOR</div>
          <div>Seats: ${object.value} | Price: ₹${object.price}</div>
          <div style="color:#64748b;font-size:11px;margin-top:4px">${object.sourceName || 'Origin'} → ${object.targetName || 'Dest'}</div>
          ${object.distance ? `<div style="color:#64748b;font-size:11px">${object.distance}km | ${object.duration}min</div>` : ''}
        </div>`,
        style: { background: 'none', border: 'none', padding: 0 }
      };
    }
    if (layer?.id === 'globe-drivers') {
      return {
        html: `<div style="font-family:monospace;padding:8px;background:#0a0a1a;border:1px solid #0ead6940;border-radius:8px;color:#e2e8f0">
          <div style="color:#0ead69;font-weight:bold">${object.driverName}</div>
          <div style="color:#5a9c7c;font-size:12px">● ACTIVE</div>
        </div>`,
        style: { background: 'none', border: 'none', padding: 0 }
      };
    }
    if (layer?.id === 'globe-sos') {
      return {
        html: `<div style="font-family:monospace;padding:8px;background:#1a0a0a;border:1px solid #ff004040;border-radius:8px;color:#e07a5f">
          <div style="font-weight:bold">⚠ SOS ALERT</div>
          <div style="font-size:12px">${object.type} — ${object.status}</div>
        </div>`,
        style: { background: 'none', border: 'none', padding: 0 }
      };
    }
    return null;
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000008' }}>
      <DeckGL
        views={new GlobeView({ resolution: 10 })}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={true}
        layers={layers}
        getTooltip={getTooltip}
        parameters={{
          blend: true,
          blendColorSrcFactor: 'src-alpha',
          blendColorDstFactor: 'one',
          depthWriteEnabled: true,
          depthCompare: 'less-equal',
        }}
      />

      {/* Globe HUD Overlay */}
      <div style={{
        position: 'absolute', top: 20, left: 20,
        fontFamily: '"Space Grotesk", "Fira Code", monospace',
        color: '#e2e8f0', zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{
          background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(14,173,105,0.15)', borderRadius: 12,
          padding: '16px 20px', minWidth: 260,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#5a9c7c', boxShadow: '0 0 8px #5a9c7c' }} />
            <span style={{ color: '#0ead69', fontWeight: 700, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' }}>
              LoopLane Global
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
            <StatItem label="RIDES" value={data.stats?.totalRides || data.arcData?.length || 0} color="#0ead69" />
            <StatItem label="LIVE DRIVERS" value={data.stats?.activeDrivers || data.liveTelemetry?.length || 0} color="#5a9c7c" />
            <StatItem label="DEMAND" value={data.stats?.demandSignals || data.heatmapData?.length || 0} color="#f4a261" />
            <StatItem label="ALERTS" value={(data.stats?.dangerZones || 0) + (data.stats?.emergencies || 0)} color="#e07a5f" />
          </div>
        </div>
      </div>

      {/* Switch to Map button */}
      <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <button
          onClick={onSwitchToMap}
          style={{
            background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(14,173,105,0.3)', borderRadius: 20,
            padding: '10px 28px', color: '#0ead69', fontFamily: 'monospace',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: 1,
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8,
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = '#0ead69'; e.currentTarget.style.boxShadow = '0 0 20px rgba(14,173,105,0.2)'; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(14,173,105,0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <i className="fas fa-map" style={{ fontSize: 14 }} /> SWITCH TO MAP VIEW
        </button>
      </div>

      {/* Fly to Bangalore button */}
      <div style={{ position: 'absolute', bottom: 24, right: 24, zIndex: 10 }}>
        <button
          onClick={() => {
            autoRotateRef.current = false;
            setViewState(prev => ({
              ...prev,
              longitude: 77.5946,
              latitude: 12.9716,
              zoom: 5,
              transitionDuration: 2000,
            }));
            setTimeout(() => {
              onSwitchToMap?.();
            }, 2500);
          }}
          style={{
            background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,255,136,0.3)', borderRadius: 8,
            padding: '8px 16px', color: '#5a9c7c', fontFamily: 'monospace',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: 1,
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = '#5a9c7c'; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(0,255,136,0.3)'; }}
        >
          <i className="fas fa-crosshairs" style={{ marginRight: 6 }} /> FLY TO BANGALORE
        </button>
      </div>
    </div>
  );
};

const StatItem = ({ label, value, color }) => (
  <div>
    <div style={{ fontSize: 10, color: '#64748b', letterSpacing: 1.5, marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color, textShadow: `0 0 10px ${color}40` }}>{value}</div>
  </div>
);

export default GlobeMode;
