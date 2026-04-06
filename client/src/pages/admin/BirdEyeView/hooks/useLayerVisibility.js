import { useState, useCallback, useMemo } from 'react';

// All available layer definitions with metadata
const LAYER_DEFS = {
  arcs:             { label: 'Ride Corridors',      icon: 'fa-route',           group: 'rides',    default: true,  description: 'Origin-to-destination arcs of completed rides' },
  heatmap:          { label: 'Demand Heatmap',      icon: 'fa-fire',            group: 'rides',    default: true,  description: 'Booking density heat map' },
  hexbins:          { label: '3D Hex Density',      icon: 'fa-cubes',           group: 'rides',    default: false, description: 'Extruded hexagonal bins showing ride concentration' },
  pickups:          { label: 'Pickup Hot Spots',    icon: 'fa-map-marker-alt',  group: 'rides',    default: false, description: 'Booking pickup locations' },
  dropoffs:         { label: 'Dropoff Hot Spots',   icon: 'fa-flag-checkered',  group: 'rides',    default: false, description: 'Booking dropoff locations' },
  drivers:          { label: 'Live Drivers',        icon: 'fa-car',             group: 'live',     default: true,  description: 'Real-time driver positions with pulse' },
  activeRoutes:     { label: 'Active Routes',       icon: 'fa-road',            group: 'live',     default: true,  description: 'Route geometry of in-progress rides' },
  tripTrails:       { label: 'Trip Trails',         icon: 'fa-shoe-prints',     group: 'live',     default: false, description: 'Animated breadcrumb trails (TripsLayer)' },
  dangerZones:      { label: 'Danger Zones',        icon: 'fa-exclamation-triangle', group: 'safety', default: true,  description: 'HIGH/CRITICAL route deviations' },
  dangerLinks:      { label: 'Deviation Links',     icon: 'fa-link',            group: 'safety', default: false, description: 'Actual vs expected route position for deviation alerts' },
  emergencies:      { label: 'SOS Emergencies',     icon: 'fa-ambulance',       group: 'safety',   default: true,  description: 'Active/Pending/Dispatched SOS alerts' },
  unfulfilled:      { label: 'Unfulfilled Demand',  icon: 'fa-search-minus',    group: 'demand',   default: false, description: 'Searches with 0 results \u2014 unserved corridors' },
  routeAlerts:      { label: 'Route Alert Zones',   icon: 'fa-bell',            group: 'demand',   default: false, description: 'User-subscribed route corridors awaiting rides' },
  // Ola/Uber-grade driving analytics layers
  speedHeatmap:     { label: 'Speed Heatmap',       icon: 'fa-tachometer-alt',  group: 'analytics', default: false, description: 'Road segment speeds \u2014 red=slow, green=fast' },
  hardBrakes:       { label: 'Hard Braking',        icon: 'fa-exclamation-circle', group: 'analytics', default: false, description: 'Harsh braking events from breadcrumbs' },
  rapidAccel:       { label: 'Rapid Accel',         icon: 'fa-arrow-up',        group: 'analytics', default: false, description: 'Aggressive acceleration events from breadcrumbs' },
  speedViolations:  { label: 'Speed Violations',    icon: 'fa-bolt',            group: 'analytics', default: false, description: 'Locations where drivers exceeded speed limit' },
  idleZones:        { label: 'Idle Zones',          icon: 'fa-pause-circle',    group: 'analytics', default: false, description: 'Where drivers stopped for >1 min' },
  surgeZones:       { label: 'Surge Zones',         icon: 'fa-fire-alt',        group: 'analytics', default: false, description: 'High demand / low supply ratio areas' },
  weather:          { label: 'Weather Overlay',     icon: 'fa-cloud-rain',      group: 'environment', default: false, description: 'Real/simulated weather grid (rain, storms)' },
  forecast:         { label: 'Demand Forecast',     icon: 'fa-chart-line',      group: 'environment', default: false, description: '24h predictive demand hexagons' },
  isochrone:        { label: 'Reachability Zone',   icon: 'fa-circle-notch',    group: 'environment', default: false, description: 'How far a driver can reach in X minutes' },
};

const GROUP_DEFS = {
  rides:       { label: 'Ride Analytics',    icon: 'fa-chart-bar',       layers: ['arcs', 'heatmap', 'hexbins', 'pickups', 'dropoffs'] },
  live:        { label: 'Live Tracking',     icon: 'fa-satellite',       layers: ['drivers', 'activeRoutes', 'tripTrails'] },
  safety:      { label: 'Trust & Safety',    icon: 'fa-shield-alt',      layers: ['dangerZones', 'dangerLinks', 'emergencies'] },
  demand:      { label: 'Demand Gaps',       icon: 'fa-search-location', layers: ['unfulfilled', 'routeAlerts'] },
  analytics:   { label: 'Driving Analytics', icon: 'fa-tachometer-alt',  layers: ['speedHeatmap', 'hardBrakes', 'rapidAccel', 'speedViolations', 'idleZones', 'surgeZones'] },
  environment: { label: 'Environment',       icon: 'fa-cloud-sun',       layers: ['weather', 'forecast', 'isochrone'] },
};

const useLayerVisibility = () => {
  const [visibility, setVisibility] = useState(() => {
    const initial = {};
    Object.entries(LAYER_DEFS).forEach(([key, def]) => {
      initial[key] = def.default;
    });
    return initial;
  });

  const toggleLayer = useCallback((layerKey) => {
    setVisibility(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  }, []);

  const setLayerVisible = useCallback((layerKey, visible) => {
    setVisibility(prev => ({ ...prev, [layerKey]: visible }));
  }, []);

  const toggleGroup = useCallback((groupKey) => {
    const group = GROUP_DEFS[groupKey];
    if (!group) return;
    setVisibility(prev => {
      const allOn = group.layers.every(l => prev[l]);
      const next = { ...prev };
      group.layers.forEach(l => { next[l] = !allOn; });
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    const defaults = {};
    Object.entries(LAYER_DEFS).forEach(([key, def]) => {
      defaults[key] = def.default;
    });
    setVisibility(defaults);
  }, []);

  const activeCount = useMemo(() =>
    Object.values(visibility).filter(Boolean).length,
  [visibility]);

  return {
    visibility,
    toggleLayer,
    setLayerVisible,
    toggleGroup,
    resetToDefaults,
    activeCount,
    LAYER_GROUPS: GROUP_DEFS,
    LAYER_META: LAYER_DEFS,
  };
};

export default useLayerVisibility;
