import { useMemo, useState, useCallback, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { MapView, FlyToInterpolator } from '@deck.gl/core';
import { ArcLayer, GeoJsonLayer, ScatterplotLayer, PathLayer, LineLayer } from '@deck.gl/layers';
import { HeatmapLayer, HexagonLayer } from '@deck.gl/aggregation-layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import Map from 'react-map-gl/maplibre';
import useAnimationFrame from './hooks/useAnimationFrame';
import {
  HEATMAP_COLORS, HEX_COLOR_RANGE, FORECAST_COLOR_RANGE,
  DRIVER_COLOR, ROUTE_COLOR, TRAIL_COLOR, PICKUP_COLOR, DROPOFF_COLOR,
  SOS_COLOR, UNFULFILLED_COLOR, ROUTE_ALERT_COLOR,
  ISOCHRONE_FILL, ISOCHRONE_STROKE,
  HARD_BRAKE_COLOR, RAPID_ACCEL_COLOR, SPEEDING_COLOR, IDLE_ZONE_COLOR,
  WEATHER_COLORS, UI_COLORS,
  getArcColor, getDangerColor, getPulseRadius, getSpeedColor, getSurgeColor,
  formatCoord,
  DEFAULT_VIEW_STATE, MAP_STYLE, CITY_VIEW_STATES
} from './utils/colors';

const TRANSITION_OPTS = { transitionDuration: 800, transitionInterpolator: new FlyToInterpolator() };

const MapMode = ({ data, visibility, onSwitchToGlobe, onClickLocation, selectedCity, onLoadIsochrone }) => {
  const [viewState, setViewState] = useState(() => {
    return CITY_VIEW_STATES[selectedCity] || DEFAULT_VIEW_STATE;
  });
  const [selectedObject, setSelectedObject] = useState(null);

  // Determine if any animation layers are active
  const hasTrips = visibility.tripTrails && data.breadcrumbTrails?.length > 0;
  const hasDriverPulse = visibility.drivers && data.liveTelemetry?.length > 0;
  const hasSosPulse = visibility.emergencies && data.emergencies?.length > 0;
  const hasDangerPulse = visibility.dangerZones && data.dangerZones?.length > 0;
  const hasBrakePulse = visibility.hardBrakes && data.hardBrakeEvents?.length > 0;
  const hasRapidAccelPulse = visibility.rapidAccel && data.rapidAccelEvents?.length > 0;
  const needsAnimation = hasTrips || hasDriverPulse || hasSosPulse || hasDangerPulse || hasBrakePulse || hasRapidAccelPulse;
  const currentTime = useAnimationFrame(needsAnimation);

  // Compute TripsLayer animation time
  const [trailTimeRange, setTrailTimeRange] = useState({ min: 0, max: 1 });
  useEffect(() => {
    if (data.breadcrumbTrails?.length > 0) {
      let maxDuration = 0;
      data.breadcrumbTrails.forEach(t => {
        if (t.totalDuration > maxDuration) maxDuration = t.totalDuration;
      });
      setTrailTimeRange({ min: 0, max: maxDuration || 60 });
    }
  }, [data.breadcrumbTrails]);

  const trailCurrentTime = useMemo(() => {
    const range = trailTimeRange.max - trailTimeRange.min || 1;
    return trailTimeRange.min + ((currentTime * 0.02) % range);
  }, [currentTime, trailTimeRange]);

  // Fly to city when selected city changes
  useEffect(() => {
    const cityVS = CITY_VIEW_STATES[selectedCity];
    if (cityVS) {
      setViewState(prev => ({ ...prev, ...cityVS, ...TRANSITION_OPTS }));
    }
  }, [selectedCity]);

  // Also fly to detected center from data
  useEffect(() => {
    if (data.detectedCenter && !CITY_VIEW_STATES[selectedCity]) {
      setViewState(prev => ({
        ...prev,
        longitude: data.detectedCenter.lng,
        latitude: data.detectedCenter.lat,
        zoom: 11,
        ...TRANSITION_OPTS
      }));
    }
  }, [data.detectedCenter, selectedCity]);

  const onViewStateChange = useCallback(({ viewState: vs }) => setViewState(vs), []);

  const flyTo = useCallback((lng, lat, zoom = 14) => {
    setViewState(prev => ({ ...prev, longitude: lng, latitude: lat, zoom, ...TRANSITION_OPTS }));
  }, []);

  const onClick = useCallback((info) => {
    const coords = info.object?.coordinates || info.object?.originCoords || info.object?.source || info.coordinate;

    if ((info.rightButton || info.srcEvent?.altKey) && coords && onLoadIsochrone) {
      onLoadIsochrone(coords[0], coords[1]);
    }

    if (info.object) {
      setSelectedObject({ ...info.object, _layer: info.layer?.id });
      if (coords) {
        flyTo(coords[0], coords[1]);
      }
      onClickLocation?.(info.object);
    } else {
      setSelectedObject(null);
    }
  }, [flyTo, onClickLocation, onLoadIsochrone]);

  // ═══════════════════════════════════════════════════
  //  BUILD ALL LAYERS
  // ═══════════════════════════════════════════════════
  const layers = useMemo(() => {
    const L = [];

    // ─── 1. ARC LAYER: Ride Corridors ───
    if (visibility.arcs && data.arcData?.length > 0) {
      L.push(new ArcLayer({
        id: 'arc-rides',
        data: data.arcData,
        getSourcePosition: d => d.source,
        getTargetPosition: d => d.target,
        getSourceColor: d => getArcColor(d.distance).source,
        getTargetColor: d => getArcColor(d.distance).target,
        getWidth: d => Math.max(1, Math.min((d.value || 1) * 0.6, 5)),
        greatCircle: true,
        widthMinPixels: 1,
        widthMaxPixels: 6,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 80],
      }));
    }

    // ─── 2. HEATMAP LAYER: Demand Density ───
    if (visibility.heatmap && data.heatmapData?.length > 0) {
      L.push(new HeatmapLayer({
        id: 'heatmap-demand',
        data: data.heatmapData,
        getPosition: d => d.coordinates,
        getWeight: d => d.weight || 1,
        radiusPixels: 60,
        intensity: 1.2,
        threshold: 0.05,
        colorRange: HEATMAP_COLORS,
        aggregation: 'SUM',
      }));
    }

    // ─── 3. HEXAGON LAYER: 3D Ride Density ───
    if (visibility.hexbins && data.densityData?.length > 0) {
      L.push(new HexagonLayer({
        id: 'hex-density',
        data: data.densityData,
        getPosition: d => d.coordinates,
        getElevationWeight: d => d.count || 1,
        getColorWeight: d => d.count || 1,
        elevationScale: 100,
        extruded: true,
        radius: 300,
        upperPercentile: 95,
        coverage: 0.88,
        material: { ambient: 0.64, diffuse: 0.6, shininess: 32, specularColor: [51, 51, 51] },
        colorRange: HEX_COLOR_RANGE,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 60],
        opacity: 0.85,
      }));
    }

    // ─── 4. PICKUP POINTS ───
    if (visibility.pickups && data.pickupPoints?.length > 0) {
      L.push(new ScatterplotLayer({
        id: 'scatter-pickups',
        data: data.pickupPoints,
        getPosition: d => d.coordinates,
        getRadius: d => 30 + (d.weight || 1) * 15,
        getFillColor: PICKUP_COLOR,
        stroked: true,
        getLineColor: [0, 255, 136, 80],
        lineWidthMinPixels: 1,
        radiusMinPixels: 3,
        radiusMaxPixels: 20,
        pickable: true,
        autoHighlight: true,
      }));
    }

    // ─── 5. DROPOFF POINTS ───
    if (visibility.dropoffs && data.dropoffPoints?.length > 0) {
      L.push(new ScatterplotLayer({
        id: 'scatter-dropoffs',
        data: data.dropoffPoints,
        getPosition: d => d.coordinates,
        getRadius: d => 30 + (d.weight || 1) * 15,
        getFillColor: DROPOFF_COLOR,
        stroked: true,
        getLineColor: [255, 51, 102, 80],
        lineWidthMinPixels: 1,
        radiusMinPixels: 3,
        radiusMaxPixels: 20,
        pickable: true,
        autoHighlight: true,
      }));
    }

    // ─── 6. LIVE DRIVERS (pulsing ScatterplotLayer) ───
    if (visibility.drivers && data.liveTelemetry?.length > 0) {
      const pulseRad = getPulseRadius(120, currentTime, 2);
      // Outer pulse ring
      L.push(new ScatterplotLayer({
        id: 'drivers-pulse',
        data: data.liveTelemetry,
        getPosition: d => d.coordinates,
        getRadius: pulseRad,
        getFillColor: [0, 245, 255, 30],
        stroked: true,
        getLineColor: [0, 245, 255, 60],
        lineWidthMinPixels: 1,
        radiusMinPixels: 10,
        radiusMaxPixels: 40,
        pickable: false,
      }));
      // Inner dot
      L.push(new ScatterplotLayer({
        id: 'drivers-dot',
        data: data.liveTelemetry,
        getPosition: d => d.coordinates,
        getRadius: 50,
        getFillColor: DRIVER_COLOR,
        stroked: true,
        getLineColor: [255, 255, 255, 200],
        lineWidthMinPixels: 1.5,
        radiusMinPixels: 5,
        radiusMaxPixels: 14,
        pickable: true,
        autoHighlight: true,
        highlightColor: [0, 245, 255, 180],
      }));
    }

    // ─── 7. ACTIVE ROUTES (PathLayer) ───
    if (visibility.activeRoutes && data.activeRoutes?.length > 0) {
      L.push(new PathLayer({
        id: 'path-active-routes',
        data: data.activeRoutes,
        getPath: d => d.path,
        getColor: ROUTE_COLOR,
        getWidth: 4,
        widthMinPixels: 2,
        widthMaxPixels: 8,
        jointRounded: true,
        capRounded: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [6, 182, 212, 255],
      }));
    }

    // ─── 8. TRIP TRAILS (TripsLayer from @deck.gl/geo-layers) ───
    if (visibility.tripTrails && data.breadcrumbTrails?.length > 0) {
      const trailData = data.breadcrumbTrails
        .filter(t => t.waypoints?.length > 1)
        .map(t => ({
          ...t,
          path: t.waypoints.map(w => w.coordinates),
          timestamps: t.waypoints.map(w => w.timestamp),
        }));

      if (trailData.length > 0) {
        L.push(new TripsLayer({
          id: 'trips-trails',
          data: trailData,
          getPath: d => d.path,
          getTimestamps: d => d.timestamps,
          getColor: TRAIL_COLOR,
          currentTime: trailCurrentTime,
          trailLength: 15,
          fadeTrail: true,
          capRounded: true,
          jointRounded: true,
          widthMinPixels: 3,
          widthMaxPixels: 8,
          pickable: true,
        }));
      }
    }

    // ─── 9. DANGER ZONES (pulsing) ───
    if (visibility.dangerZones && data.dangerZones?.length > 0) {
      const dangerPulse = getPulseRadius(150, currentTime, 1.5);
      L.push(new ScatterplotLayer({
        id: 'danger-pulse',
        data: data.dangerZones,
        getPosition: d => d.coordinates,
        getRadius: dangerPulse,
        getFillColor: d => {
          const c = getDangerColor(d.severity);
          return [c[0], c[1], c[2], 25];
        },
        stroked: false,
        radiusMinPixels: 10,
        radiusMaxPixels: 50,
        pickable: false,
      }));
      L.push(new ScatterplotLayer({
        id: 'danger-dot',
        data: data.dangerZones,
        getPosition: d => d.coordinates,
        getRadius: 80,
        getFillColor: d => getDangerColor(d.severity),
        stroked: true,
        getLineColor: [255, 255, 255, 180],
        lineWidthMinPixels: 1,
        radiusMinPixels: 5,
        radiusMaxPixels: 16,
        pickable: true,
        autoHighlight: true,
      }));
    }

    // ─── 10. DEVIATION LINKS (expected vs actual location) ───
    if (visibility.dangerLinks && data.dangerZones?.length > 0) {
      const deviationLinks = data.dangerZones.filter(d => d.expectedCoordinates?.length === 2);
      if (deviationLinks.length > 0) {
        L.push(new LineLayer({
          id: 'danger-links',
          data: deviationLinks,
          getSourcePosition: d => d.expectedCoordinates,
          getTargetPosition: d => d.coordinates,
          getColor: d => {
            const c = getDangerColor(d.severity);
            return [c[0], c[1], c[2], 180];
          },
          getWidth: d => Math.max(2, Math.min((d.distance || 0) * 0.5, 6)),
          widthMinPixels: 2,
          widthMaxPixels: 6,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 80],
        }));
      }
    }

    // ─── 11. EMERGENCIES (SOS — pulsing) ───
    if (visibility.emergencies && data.emergencies?.length > 0) {
      const sosPulse = getPulseRadius(200, currentTime, 3);
      L.push(new ScatterplotLayer({
        id: 'sos-pulse',
        data: data.emergencies,
        getPosition: d => d.coordinates,
        getRadius: sosPulse,
        getFillColor: [255, 0, 64, 40],
        stroked: true,
        getLineColor: [255, 0, 64, 80],
        lineWidthMinPixels: 1,
        radiusMinPixels: 12,
        radiusMaxPixels: 60,
        pickable: false,
      }));
      L.push(new ScatterplotLayer({
        id: 'sos-dot',
        data: data.emergencies,
        getPosition: d => d.coordinates,
        getRadius: 60,
        getFillColor: SOS_COLOR,
        stroked: true,
        getLineColor: [255, 255, 255, 255],
        lineWidthMinPixels: 2,
        radiusMinPixels: 6,
        radiusMaxPixels: 18,
        pickable: true,
        autoHighlight: true,
      }));
    }

    // ─── 12. UNFULFILLED DEMAND (searches with no results) ───
    if (visibility.unfulfilled && data.unfulfilledDemand?.length > 0) {
      // Origins of failed searches as amber scatter dots
      L.push(new ScatterplotLayer({
        id: 'unfulfilled-origins',
        data: data.unfulfilledDemand,
        getPosition: d => d.originCoords,
        getRadius: d => 40 + (d.seats || 1) * 20,
        getFillColor: UNFULFILLED_COLOR,
        stroked: true,
        getLineColor: [255, 191, 0, 80],
        lineWidthMinPixels: 1,
        radiusMinPixels: 4,
        radiusMaxPixels: 18,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 220, 80, 200],
      }));
      // If destination is available, show arcs from origin to destination (unfulfilled corridors)
      const withDest = data.unfulfilledDemand.filter(d => d.destCoords?.length === 2);
      if (withDest.length > 0) {
        L.push(new ArcLayer({
          id: 'unfulfilled-arcs',
          data: withDest,
          getSourcePosition: d => d.originCoords,
          getTargetPosition: d => d.destCoords,
          getSourceColor: [255, 191, 0, 150],
          getTargetColor: [255, 100, 0, 150],
          getWidth: 2,
          widthMinPixels: 1,
          widthMaxPixels: 4,
          greatCircle: false,
          pickable: true,
        }));
      }
    }

    // ─── 13. ROUTE ALERT ZONES (subscribed corridors) ───
    if (visibility.routeAlerts && data.routeAlerts?.length > 0) {
      L.push(new ScatterplotLayer({
        id: 'route-alert-origins',
        data: data.routeAlerts,
        getPosition: d => d.originCoords,
        getRadius: d => (d.radiusKm || 5) * 200,
        getFillColor: [139, 92, 246, 40],
        stroked: true,
        getLineColor: ROUTE_ALERT_COLOR,
        lineWidthMinPixels: 1.5,
        radiusMinPixels: 8,
        radiusMaxPixels: 40,
        pickable: true,
        autoHighlight: true,
      }));
      const withDest = data.routeAlerts.filter(d => d.destCoords?.length === 2);
      if (withDest.length > 0) {
        L.push(new ArcLayer({
          id: 'route-alert-arcs',
          data: withDest,
          getSourcePosition: d => d.originCoords,
          getTargetPosition: d => d.destCoords,
          getSourceColor: [139, 92, 246, 160],
          getTargetColor: [168, 85, 247, 160],
          getWidth: 2,
          widthMinPixels: 1,
          widthMaxPixels: 4,
          greatCircle: false,
          pickable: true,
        }));
      }
    }

    // ─── 14. WEATHER OVERLAY (GeoJsonLayer — proper FeatureCollection) ───
    if (visibility.weather && data.weatherData?.features?.length > 0) {
      L.push(new GeoJsonLayer({
        id: 'weather-grid',
        data: data.weatherData,
        filled: true,
        getFillColor: f => {
          const cond = f.properties?.condition || 'CLEAR';
          return WEATHER_COLORS[cond] || WEATHER_COLORS.CLEAR;
        },
        stroked: true,
        getLineColor: [100, 100, 140, 40],
        lineWidthMinPixels: 0.5,
        pickable: true,
        opacity: 0.5,
      }));
    }

    // ─── 15. DEMAND FORECAST (HexagonLayer) ───
    if (visibility.forecast && data.forecastData?.length > 0) {
      const forecastPoints = data.forecastData
        .filter(f => f.coordinates || f.geometry?.coordinates)
        .map(f => ({
          coordinates: f.coordinates || f.geometry?.coordinates,
          weight: f.predictedDemand || f.demand || 1
        }));
      if (forecastPoints.length > 0) {
        L.push(new HexagonLayer({
          id: 'hex-forecast',
          data: forecastPoints,
          getPosition: d => d.coordinates,
          getElevationWeight: d => d.weight,
          getColorWeight: d => d.weight,
          elevationScale: 60,
          extruded: true,
          radius: 400,
          coverage: 0.7,
          colorRange: FORECAST_COLOR_RANGE,
          pickable: true,
          opacity: 0.6,
        }));
      }
    }

    // ─── 16. ISOCHRONE ZONE (GeoJsonLayer — polygon) ───
    if (visibility.isochrone && data.isochroneData?.features?.length > 0) {
      L.push(new GeoJsonLayer({
        id: 'isochrone-zone',
        data: data.isochroneData,
        filled: true,
        getFillColor: ISOCHRONE_FILL,
        stroked: true,
        getLineColor: ISOCHRONE_STROKE,
        lineWidthMinPixels: 2,
        pickable: true,
        opacity: 0.6,
      }));
    }

    // ═══════════════════════════════════════════════════
    //  OLA/UBER-GRADE DRIVING ANALYTICS LAYERS
    // ═══════════════════════════════════════════════════

    // ─── 16. SPEED HEATMAP (PathLayer colored by speed) ───
    if (visibility.speedHeatmap && data.speedSegments?.length > 0) {
      L.push(new PathLayer({
        id: 'speed-heatmap',
        data: data.speedSegments,
        getPath: d => [d.from, d.to],
        getColor: d => getSpeedColor(d.speed),
        getWidth: d => Math.max(2, Math.min(d.speed / 15, 6)),
        widthMinPixels: 2,
        widthMaxPixels: 8,
        jointRounded: true,
        capRounded: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 100],
      }));
    }

    // ─── 17. HARD BRAKING EVENTS (pulsing ScatterplotLayer) ───
    if (visibility.hardBrakes && data.hardBrakeEvents?.length > 0) {
      const brakePulse = getPulseRadius(130, currentTime, 2.5);
      L.push(new ScatterplotLayer({
        id: 'hard-brake-pulse',
        data: data.hardBrakeEvents,
        getPosition: d => d.coordinates,
        getRadius: brakePulse,
        getFillColor: [255, 50, 50, 25],
        stroked: true,
        getLineColor: [255, 50, 50, 60],
        lineWidthMinPixels: 1,
        radiusMinPixels: 8,
        radiusMaxPixels: 35,
        pickable: false,
      }));
      L.push(new ScatterplotLayer({
        id: 'hard-brake-dot',
        data: data.hardBrakeEvents,
        getPosition: d => d.coordinates,
        getRadius: 60,
        getFillColor: HARD_BRAKE_COLOR,
        stroked: true,
        getLineColor: [255, 255, 255, 200],
        lineWidthMinPixels: 1.5,
        radiusMinPixels: 4,
        radiusMaxPixels: 14,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 100, 100, 200],
      }));
    }

    // ─── 18. RAPID ACCELERATION EVENTS (pulsing ScatterplotLayer) ───
    if (visibility.rapidAccel && data.rapidAccelEvents?.length > 0) {
      const accelPulse = getPulseRadius(130, currentTime, 2.2);
      L.push(new ScatterplotLayer({
        id: 'rapid-accel-pulse',
        data: data.rapidAccelEvents,
        getPosition: d => d.coordinates,
        getRadius: accelPulse,
        getFillColor: [244, 162, 97, 28],
        stroked: true,
        getLineColor: [244, 162, 97, 80],
        lineWidthMinPixels: 1,
        radiusMinPixels: 8,
        radiusMaxPixels: 35,
        pickable: false,
      }));
      L.push(new ScatterplotLayer({
        id: 'rapid-accel-dot',
        data: data.rapidAccelEvents,
        getPosition: d => d.coordinates,
        getRadius: 60,
        getFillColor: RAPID_ACCEL_COLOR,
        stroked: true,
        getLineColor: [255, 255, 255, 200],
        lineWidthMinPixels: 1.5,
        radiusMinPixels: 4,
        radiusMaxPixels: 14,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 200, 120, 220],
      }));
    }

    // ─── 19. SPEED VIOLATIONS (ScatterplotLayer) ───
    if (visibility.speedViolations && data.speedingEvents?.length > 0) {
      L.push(new ScatterplotLayer({
        id: 'speed-violation-dot',
        data: data.speedingEvents,
        getPosition: d => d.coordinates,
        getRadius: d => 40 + Math.min(d.speed / 5, 40),
        getFillColor: SPEEDING_COLOR,
        stroked: true,
        getLineColor: [255, 180, 50, 120],
        lineWidthMinPixels: 1,
        radiusMinPixels: 4,
        radiusMaxPixels: 18,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 200, 50, 200],
      }));
    }

    // ─── 20. IDLE ZONES (ScatterplotLayer — size by duration) ───
    if (visibility.idleZones && data.idleZones?.length > 0) {
      L.push(new ScatterplotLayer({
        id: 'idle-zone-dot',
        data: data.idleZones,
        getPosition: d => d.coordinates,
        getRadius: d => 60 + Math.min((d.durationSec || 30) * 2, 300),
        getFillColor: IDLE_ZONE_COLOR,
        stroked: true,
        getLineColor: [100, 116, 139, 100],
        lineWidthMinPixels: 1,
        radiusMinPixels: 5,
        radiusMaxPixels: 30,
        pickable: true,
        autoHighlight: true,
        highlightColor: [148, 163, 184, 150],
      }));
    }

    // ─── 21. SURGE ZONES (ScatterplotLayer — color by multiplier) ───
    if (visibility.surgeZones && data.surgeZones?.length > 0) {
      L.push(new ScatterplotLayer({
        id: 'surge-zone-dot',
        data: data.surgeZones,
        getPosition: d => d.center,
        getRadius: d => (d.gridSizeKm || 1) * 500,
        getFillColor: d => getSurgeColor(d.surgeMultiplier || 1),
        stroked: true,
        getLineColor: d => {
          const c = getSurgeColor(d.surgeMultiplier || 1);
          return [c[0], c[1], c[2], 120];
        },
        lineWidthMinPixels: 1,
        radiusMinPixels: 15,
        radiusMaxPixels: 60,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 60],
      }));
    }

    return L;
  }, [data, visibility, currentTime, trailCurrentTime]);

  // ─── Tooltip System ───
  const getTooltip = useCallback(({ object, layer }) => {
    if (!object) return null;
    const id = layer?.id;
    const base = 'font-family:"Space Grotesk","Fira Code",monospace;padding:10px 14px;border-radius:10px;font-size:12px;line-height:1.6;max-width:320px;';
    const dark = `${base}background:rgba(10,10,20,0.92);border:1px solid rgba(14,173,105,0.2);color:#e2e8f0;`;
    const danger = `${base}background:rgba(25,10,10,0.92);border:1px solid rgba(255,0,64,0.3);color:#fca5a5;`;
    const amber = `${base}background:rgba(25,20,10,0.92);border:1px solid rgba(255,191,0,0.3);color:#fde68a;`;
    const purple = `${base}background:rgba(20,10,30,0.92);border:1px solid rgba(139,92,246,0.3);color:#c4b5fd;`;
    const noStyle = { background: 'none', border: 'none', padding: 0 };

    if (id === 'arc-rides') {
      return {
        html: `<div style="${dark}">
          <div style="color:#0ead69;font-weight:700;margin-bottom:4px;letter-spacing:1px">RIDE CORRIDOR</div>
          <div>${object.sourceName || 'Origin'} &rarr; ${object.targetName || 'Destination'}</div>
          <div style="margin-top:4px;color:#94a3b8">Seats: ${object.value} &middot; &#8377;${object.price}/seat${object.totalPrice ? ` &middot; Total: &#8377;${object.totalPrice}` : ''}</div>
          ${object.distance ? `<div style="color:#64748b;margin-top:2px">${object.distance}km &middot; ${object.duration}min</div>` : ''}
        </div>`, style: noStyle
      };
    }
    if (id === 'scatter-pickups') {
      return { html: `<div style="${dark}"><span style="color:#5a9c7c">&#9679; PICKUP</span> &middot; ${object.weight || 1} pax${object.fare ? ` &middot; &#8377;${object.fare}` : ''}<br/><span style="color:#64748b">${formatCoord(object.coordinates)}</span></div>`, style: noStyle };
    }
    if (id === 'scatter-dropoffs') {
      return { html: `<div style="${dark}"><span style="color:#e07a5f">&#9679; DROPOFF</span> &middot; ${object.weight || 1} pax${object.fare ? ` &middot; &#8377;${object.fare}` : ''}<br/><span style="color:#64748b">${formatCoord(object.coordinates)}</span></div>`, style: noStyle };
    }
    if (id === 'drivers-dot') {
      return {
        html: `<div style="${dark}">
          <div style="color:#0ead69;font-weight:700">${object.driverName || 'Driver'}</div>
          <div style="color:#5a9c7c;font-size:11px">&#9679; ACTIVE${object.speed ? ` &middot; ${Math.round(object.speed)} km/h` : ''}${object.passengers ? ` &middot; ${object.passengers} pax` : ''}</div>
          ${object.startAddress ? `<div style="color:#64748b;font-size:11px;margin-top:2px">${object.startAddress} &rarr; ${object.destAddress}</div>` : ''}
          <div style="color:#64748b;font-size:11px;margin-top:2px">${formatCoord(object.coordinates)}</div>
        </div>`, style: noStyle
      };
    }
    if (id === 'path-active-routes') {
      return { html: `<div style="${dark}"><span style="color:#06b6d4;font-weight:700">ACTIVE ROUTE</span><br/>${object.driverName || 'Unknown'}${object.startAddress ? `<br/><span style="font-size:11px;color:#64748b">${object.startAddress} &rarr; ${object.destAddress}</span>` : ''}</div>`, style: noStyle };
    }
    if (id === 'trips-trails') {
      return { html: `<div style="${dark}"><span style="color:#f4a261;font-weight:700">TRIP TRAIL</span> &middot; ${object.driverName || 'Driver'}<br/>${object.waypoints?.length || 0} waypoints &middot; ${Math.round(object.totalDuration || 0)}s duration</div>`, style: noStyle };
    }
    if (id === 'danger-dot') {
      return {
        html: `<div style="${danger}"><span style="font-weight:700">&#9888; ${object.severity} DEVIATION</span><br/>
          ${object.type ? `${object.type.replace(/_/g, ' ')}<br/>` : ''}
          Drift: ${object.distance ? object.distance.toFixed(2) + 'km' : 'N/A'}
          ${object.speed !== null ? ` &middot; ${Math.round(object.speed)} km/h` : ''}
          ${object.duration ? `<br/>Duration: ${Math.round(object.duration / 60)} min` : ''}
          ${object.rideId ? `<br/><span style="font-size:10px;color:#64748b">Ride: ${object.rideId}</span>` : ''}
        </div>`, style: noStyle
      };
    }
    if (id === 'danger-links') {
      return {
        html: `<div style="${danger}">
          <span style="font-weight:700">&#128279; DEVIATION LINK</span><br/>
          Expected: ${formatCoord(object.expectedCoordinates)}<br/>
          Actual: ${formatCoord(object.coordinates)}<br/>
          Drift: ${object.distance ? object.distance.toFixed(2) + 'km' : 'N/A'}
        </div>`, style: noStyle
      };
    }
    if (id === 'sos-dot') {
      return { html: `<div style="${danger}"><span style="font-weight:700">&#128680; SOS: ${object.type || 'EMERGENCY'}</span><br/>Status: ${object.status}${object.severity ? ` &middot; ${object.severity}` : ''}${object.userName ? ` &middot; ${object.userName}` : ''}${object.phone ? `<br/>Phone: ${object.phone}` : ''}${object.description ? `<br/><span style="font-size:11px">${object.description}</span>` : ''}${object.adminNotes ? `<br/><span style="font-size:10px;color:#fecaca">Admin note: ${object.adminNotes}</span>` : ''}<br/>${formatCoord(object.coordinates)}</div>`, style: noStyle };
    }
    if (id === 'unfulfilled-origins' || id === 'unfulfilled-arcs') {
      return { html: `<div style="${amber}"><span style="font-weight:700">&#128269; UNFULFILLED DEMAND</span><br/>${object.originAddress || 'Origin'}${object.destAddress ? ` &rarr; ${object.destAddress}` : ''}<br/>Seats: ${object.seats || 1}${object.searchDate ? `<br/>Requested: ${new Date(object.searchDate).toLocaleDateString()}` : ''}<br/><span style="color:#92400e;font-size:11px">No rides found for this search</span></div>`, style: noStyle };
    }
    if (id === 'route-alert-origins' || id === 'route-alert-arcs') {
      const schedule = object.schedule?.timeRangeStart && object.schedule?.timeRangeEnd
        ? `${object.schedule.timeRangeStart}-${object.schedule.timeRangeEnd}`
        : 'Any time';
      return { html: `<div style="${purple}"><span style="font-weight:700">&#128276; ROUTE ALERT</span><br/>${object.originAddress || 'Origin'}${object.destAddress ? ` &rarr; ${object.destAddress}` : ''}<br/>Radius: ${object.radiusKm || 5}km &middot; By: ${object.userName || 'User'}<br/>Seats: ${object.minSeats || 1}${object.maxPricePerSeat ? ` &middot; Max &#8377;${object.maxPricePerSeat}/seat` : ''}<br/>Window: ${schedule}${object.triggerCount ? `<br/>Triggered ${object.triggerCount}x` : ''}</div>`, style: noStyle };
    }
    if (id === 'hex-density' || id === 'hex-forecast') {
      if (object.colorValue !== undefined) {
        return { html: `<div style="${dark}"><span style="font-weight:700">Zone Density</span><br/>${object.colorValue} rides &middot; ${object.elevationValue} weight</div>`, style: noStyle };
      }
    }
    if (id === 'weather-grid') {
      const p = object.properties || {};
      const src = p.realData ? '(Live)' : '(Sim)';
      return { html: `<div style="${dark}"><span style="color:#3b82f6;font-weight:700">WEATHER ${src}</span><br/>${p.condition || 'Unknown'} &middot; ${p.temperature || '--'}&deg;C<br/>Humidity: ${p.humidity || '--'}% &middot; Wind: ${p.windSpeed || '--'} m/s${p.rainIntensity > 0 ? `<br/>Rain: ${p.rainIntensity}%` : ''}</div>`, style: noStyle };
    }
    if (id === 'isochrone-zone') {
      const p = object.properties || {};
      return { html: `<div style="${dark}"><span style="color:#0ead69;font-weight:700">REACHABILITY ZONE</span><br/>${p.contour || 15} minute drive radius</div>`, style: noStyle };
    }

    // ─── Analytics Layer Tooltips ───
    if (id === 'speed-heatmap') {
      const spd = Math.round(object.speed || 0);
      const lbl = spd < 10 ? 'CRAWLING' : spd < 20 ? 'SLOW' : spd < 40 ? 'MODERATE' : spd < 60 ? 'NORMAL' : spd < 80 ? 'FAST' : 'HIGHWAY';
      return { html: `<div style="${dark}"><span style="color:#f4a261;font-weight:700">&#128668; SPEED SEGMENT</span><br/><span style="font-size:18px;font-weight:700">${spd} km/h</span> <span style="color:#64748b">${lbl}</span><br/>${object.distKm ? `Segment: ${object.distKm.toFixed(2)} km` : ''}</div>`, style: noStyle };
    }
    if (id === 'hard-brake-dot') {
      return { html: `<div style="${danger}"><span style="font-weight:700">&#9888; HARD BRAKING</span><br/>Deceleration: <b>${Math.abs(object.deceleration || 0).toFixed(1)} km/h/s</b><br/>Speed: ${Math.round(object.speedBefore || 0)} &rarr; ${Math.round(object.speedAfter || 0)} km/h${object.rideId ? `<br/><span style="font-size:10px;color:#64748b">Ride: ${object.rideId}</span>` : ''}<br/>${formatCoord(object.coordinates)}</div>`, style: noStyle };
    }
    if (id === 'rapid-accel-dot') {
      return { html: `<div style="${amber}"><span style="font-weight:700">&#128200; RAPID ACCELERATION</span><br/>Acceleration: <b>${Math.abs(object.acceleration || 0).toFixed(1)} km/h/s</b><br/>Speed: ${Math.round(object.speedBefore || 0)} &rarr; ${Math.round(object.speedAfter || 0)} km/h${object.rideId ? `<br/><span style="font-size:10px;color:#92400e">Ride: ${object.rideId}</span>` : ''}<br/>${formatCoord(object.coordinates)}</div>`, style: noStyle };
    }
    if (id === 'speed-violation-dot') {
      return { html: `<div style="${amber}"><span style="font-weight:700">&#9889; SPEED VIOLATION</span><br/>Speed: <b>${Math.round(object.speed || 0)} km/h</b> (limit: ${object.limit || 60} km/h)<br/>Over by: ${Math.round((object.speed || 0) - (object.limit || 60))} km/h${object.rideId ? `<br/><span style="font-size:10px;color:#64748b">Ride: ${object.rideId}</span>` : ''}<br/>${formatCoord(object.coordinates)}</div>`, style: noStyle };
    }
    if (id === 'idle-zone-dot') {
      const dur = object.durationSec || 0;
      const durStr = dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : `${dur}s`;
      return { html: `<div style="${dark}"><span style="color:#94a3b8;font-weight:700">&#9209; IDLE ZONE</span><br/>Duration: <b>${durStr}</b><br/>Avg Speed: ${(object.avgSpeed || 0).toFixed(1)} km/h${object.rideId ? `<br/><span style="font-size:10px;color:#64748b">Ride: ${object.rideId}</span>` : ''}<br/>${formatCoord(object.coordinates)}</div>`, style: noStyle };
    }
    if (id === 'surge-zone-dot') {
      const mult = (object.surgeMultiplier || 1).toFixed(1);
      const demand = object.demandCount || 0;
      const supply = object.supplyCount || 0;
      const ratio = supply > 0 ? (demand / supply).toFixed(1) : '∞';
      return { html: `<div style="${danger}"><span style="font-weight:700">&#128293; SURGE ZONE</span><br/>Multiplier: <b>${mult}x</b><br/>Demand: ${demand} &middot; Supply: ${supply} &middot; Ratio: ${ratio}<br/>${formatCoord(object.center)}</div>`, style: noStyle };
    }

    return null;
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <DeckGL
        views={new MapView({ repeat: true })}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={{ dragRotate: true, touchRotate: true }}
        layers={layers}
        getTooltip={getTooltip}
        onClick={onClick}
      >
        <Map mapStyle={MAP_STYLE} attributionControl={false} />
      </DeckGL>

      {/* Switch to Globe button */}
      <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
        <button
          onClick={onSwitchToGlobe}
          style={{
            background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(14,173,105,0.3)', borderRadius: 20,
            padding: '10px 28px', color: '#0ead69', fontFamily: '"Space Grotesk", monospace',
            fontSize: 13, fontWeight: 600, cursor: 'pointer', letterSpacing: 1,
            transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 8,
          }}
          onMouseOver={e => { e.currentTarget.style.borderColor = '#0ead69'; e.currentTarget.style.boxShadow = '0 0 20px rgba(14,173,105,0.2)'; }}
          onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(14,173,105,0.3)'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <i className="fas fa-globe-americas" style={{ fontSize: 14 }} /> SWITCH TO GLOBE
        </button>
      </div>

      {/* Map controls */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <MiniBtn icon="fa-compass" label="N" onClick={() => setViewState(v => ({ ...v, bearing: 0, pitch: 0, ...TRANSITION_OPTS }))} />
        <MiniBtn icon="fa-plus" onClick={() => setViewState(v => ({ ...v, zoom: Math.min(v.zoom + 1, 20), ...TRANSITION_OPTS }))} />
        <MiniBtn icon="fa-minus" onClick={() => setViewState(v => ({ ...v, zoom: Math.max(v.zoom - 1, 2), ...TRANSITION_OPTS }))} />
        <MiniBtn icon="fa-cube" label="3D" onClick={() => setViewState(v => ({ ...v, pitch: v.pitch > 0 ? 0 : 55, ...TRANSITION_OPTS }))} />
      </div>

      {/* Selected object detail card */}
      {selectedObject && (
        <div style={{
          position: 'absolute', bottom: 80, right: 20, zIndex: 10,
          background: 'rgba(10,10,20,0.92)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(14,173,105,0.2)', borderRadius: 12,
          padding: 16, minWidth: 240, maxWidth: 340,
          fontFamily: '"Space Grotesk", monospace', color: '#e2e8f0', fontSize: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ color: '#0ead69', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontSize: 11 }}>
              {selectedObject._layer?.replace(/-/g, ' ') || 'SELECTED'}
            </span>
            <button onClick={() => setSelectedObject(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 0 }}>x</button>
          </div>
          {selectedObject.driverName && <div style={{ color: '#5a9c7c' }}>{selectedObject.driverName}</div>}
          {selectedObject.userName && <div style={{ color: '#5a9c7c' }}>{selectedObject.userName}</div>}
          {selectedObject.sourceName && <div>{selectedObject.sourceName} &rarr; {selectedObject.targetName}</div>}
          {selectedObject.originAddress && <div>{selectedObject.originAddress}{selectedObject.destAddress ? ` \u2192 ${selectedObject.destAddress}` : ''}</div>}
          {selectedObject.coordinates && <div style={{ color: '#64748b', marginTop: 4 }}>{formatCoord(selectedObject.coordinates)}</div>}
          {selectedObject.originCoords && !selectedObject.coordinates && <div style={{ color: '#64748b', marginTop: 4 }}>{formatCoord(selectedObject.originCoords)}</div>}
          {selectedObject.expectedCoordinates && <div style={{ color: '#64748b' }}>Expected: {formatCoord(selectedObject.expectedCoordinates)}</div>}
          {selectedObject.speed !== undefined && selectedObject.speed !== null && <div>Speed: {Math.round(selectedObject.speed)} km/h</div>}
          {selectedObject.speedBefore !== undefined && selectedObject.speedAfter !== undefined && (
            <div>Speed Window: {Math.round(selectedObject.speedBefore)} &rarr; {Math.round(selectedObject.speedAfter)} km/h</div>
          )}
          {selectedObject.acceleration !== undefined && <div>Acceleration: {selectedObject.acceleration.toFixed(1)} km/h/s</div>}
          {selectedObject.deceleration !== undefined && <div>Deceleration: {selectedObject.deceleration.toFixed(1)} km/h/s</div>}
          {selectedObject.severity && <div style={{ color: '#e07a5f' }}>Severity: {selectedObject.severity}</div>}
          {selectedObject.type && <div style={{ color: '#f4a261' }}>Type: {selectedObject.type.replace(/_/g, ' ')}</div>}
          {selectedObject.distance !== undefined && <div>Distance: {selectedObject.distance.toFixed ? selectedObject.distance.toFixed(2) : selectedObject.distance} km</div>}
          {selectedObject.price !== undefined && <div>&#8377;{selectedObject.price}/seat</div>}
          {selectedObject.maxPricePerSeat !== null && selectedObject.maxPricePerSeat !== undefined && <div>Max Price: &#8377;{selectedObject.maxPricePerSeat}/seat</div>}
          {selectedObject.minSeats && <div>Min Seats: {selectedObject.minSeats}</div>}
          {selectedObject.phone && <div style={{ color: '#94a3b8' }}>Phone: {selectedObject.phone}</div>}
          {selectedObject.description && <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>{selectedObject.description}</div>}
          {selectedObject.radiusKm && <div>Alert Radius: {selectedObject.radiusKm}km</div>}
          {selectedObject.triggerCount ? <div>Triggered: {selectedObject.triggerCount}x</div> : null}
          {selectedObject.expiresAt && <div style={{ color: '#64748b' }}>Expires: {new Date(selectedObject.expiresAt).toLocaleDateString()}</div>}
          {selectedObject.adminNotes && <div style={{ color: '#fca5a5', fontSize: 11, marginTop: 4 }}>{selectedObject.adminNotes}</div>}
        </div>
      )}
    </div>
  );
};

const MiniBtn = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      width: 36, height: 36, borderRadius: 8,
      background: 'rgba(10,10,20,0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(14,173,105,0.2)', color: '#0ead69',
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontFamily: '"Space Grotesk", monospace', fontWeight: 600,
      transition: 'all 0.15s',
    }}
    onMouseOver={e => { e.currentTarget.style.borderColor = '#0ead69'; e.currentTarget.style.boxShadow = '0 0 12px rgba(14,173,105,0.15)'; }}
    onMouseOut={e => { e.currentTarget.style.borderColor = 'rgba(14,173,105,0.2)'; e.currentTarget.style.boxShadow = 'none'; }}
  >
    {label || <i className={`fas ${icon}`} />}
  </button>
);

export default MapMode;
