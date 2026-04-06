// Color scales for geospatial visualization layers
// LoopLane Brand: Emerald + Coral + Sage + Sand on dark

// Sequential: deep-teal -> emerald -> sage -> sand -> coral -> red
export const HEATMAP_COLORS = [
  [14, 173, 105],   // emerald
  [90, 156, 124],   // sage
  [129, 178, 154],  // light sage
  [244, 162, 97],   // sand
  [224, 122, 95],   // coral
  [209, 55, 78]     // danger red
];

// Ride arc gradient
export const ARC_SOURCE_COLOR = [14, 173, 105, 200];
export const ARC_TARGET_COLOR = [90, 156, 124, 200];

// Hex elevation palette: cool -> warm
export const HEX_COLOR_RANGE = [
  [14, 173, 105],
  [90, 156, 124],
  [129, 178, 154],
  [244, 162, 97],
  [224, 122, 95],
  [209, 55, 78]
];

// Weather colors (for GeoJsonLayer fill)
export const WEATHER_COLORS = {
  CLEAR: [14, 173, 105, 40],
  RAIN: [59, 130, 246, 120],
  STORM: [224, 122, 95, 180],
};

// Forecast purple range
export const FORECAST_COLOR_RANGE = [
  [168, 85, 247, 80],
  [168, 85, 247, 120],
  [168, 85, 247, 160],
  [168, 85, 247, 200],
  [139, 92, 246, 220],
  [124, 58, 237, 255]
];

// Safety colors
export const DANGER_COLOR_HIGH = [224, 122, 95, 200];
export const DANGER_COLOR_CRITICAL = [209, 55, 78, 255];
export const SOS_COLOR = [209, 55, 78, 255];

// Live tracking
export const DRIVER_COLOR = [14, 173, 105, 220];
export const ROUTE_COLOR = [90, 156, 124, 180];
export const TRAIL_COLOR = [244, 162, 97];

// Pickup/dropoff
export const PICKUP_COLOR = [14, 173, 105, 180];
export const DROPOFF_COLOR = [224, 122, 95, 180];

// NEW: Unfulfilled demand colors
export const UNFULFILLED_COLOR = [255, 191, 0, 200]; // amber
export const ROUTE_ALERT_COLOR = [139, 92, 246, 180]; // purple

// NEW: Isochrone fill
export const ISOCHRONE_FILL = [14, 173, 105, 30];
export const ISOCHRONE_STROKE = [14, 173, 105, 200];

// Ola/Uber-grade driving analytics colors
export const SPEED_COLORS = {
  CRAWL:   [209, 55, 78, 220],    // < 10 km/h — red (traffic jam)
  SLOW:    [224, 122, 95, 200],   // 10-20 km/h — coral
  MODERATE:[244, 162, 97, 180],   // 20-40 km/h — amber
  NORMAL:  [14, 173, 105, 160],   // 40-60 km/h — green
  FAST:    [59, 130, 246, 180],   // 60-80 km/h — blue
  HIGHWAY: [139, 92, 246, 200],   // > 80 km/h — purple
};
export const HARD_BRAKE_COLOR = [255, 50, 50, 230];  // bright red
export const RAPID_ACCEL_COLOR = [244, 162, 97, 230]; // amber
export const SPEEDING_COLOR = [255, 120, 0, 230];    // orange
export const IDLE_ZONE_COLOR = [100, 116, 139, 150]; // slate gray
export const SURGE_HIGH_COLOR = [209, 55, 78, 180];  // red (high surge)
export const SURGE_LOW_COLOR = [14, 173, 105, 80];   // green (balanced)

export const getSpeedColor = (speedKmh) => {
  if (speedKmh < 10) return SPEED_COLORS.CRAWL;
  if (speedKmh < 20) return SPEED_COLORS.SLOW;
  if (speedKmh < 40) return SPEED_COLORS.MODERATE;
  if (speedKmh < 60) return SPEED_COLORS.NORMAL;
  if (speedKmh < 80) return SPEED_COLORS.FAST;
  return SPEED_COLORS.HIGHWAY;
};

export const getSurgeColor = (multiplier) => {
  if (multiplier >= 2.5) return [209, 55, 78, 200];
  if (multiplier >= 2.0) return [224, 122, 95, 180];
  if (multiplier >= 1.5) return [244, 162, 97, 160];
  return [14, 173, 105, 80];
};

// UI accent colors
export const UI_COLORS = {
  primary: '#0ead69',
  secondary: '#5a9c7c',
  accent: '#e07a5f',
  warning: '#f4a261',
  purple: '#6366f1',
  blue: '#3b82f6',
  bg: '#0f1a1a',
  bgCard: 'rgba(15, 26, 26, 0.88)',
  bgPanel: 'rgba(10, 20, 20, 0.92)',
  border: 'rgba(14, 173, 105, 0.15)',
  borderActive: 'rgba(14, 173, 105, 0.4)',
  text: '#e2e8f0',
  textDim: '#64748b',
  textBright: '#f1f5f9',
  cyan: '#0ead69',
  green: '#0ead69',
  red: '#e07a5f',
  amber: '#f4a261',
};

// City presets for view centering
export const CITY_VIEW_STATES = {
  all:       { longitude: 79.0, latitude: 15.0, zoom: 6, pitch: 30, bearing: 0 },
  chennai:   { longitude: 80.2707, latitude: 13.0827, zoom: 11, pitch: 45, bearing: -17 },
  bangalore: { longitude: 77.5946, latitude: 12.9716, zoom: 11, pitch: 45, bearing: -17 },
  mumbai:    { longitude: 72.8777, latitude: 19.0760, zoom: 11, pitch: 45, bearing: -17 },
  delhi:     { longitude: 77.1025, latitude: 28.7041, zoom: 11, pitch: 45, bearing: -17 },
  hyderabad: { longitude: 78.4867, latitude: 17.3850, zoom: 11, pitch: 45, bearing: -17 },
  pune:      { longitude: 73.8567, latitude: 18.5204, zoom: 11, pitch: 45, bearing: -17 },
};

/**
 * Get arc color based on ride distance
 */
export const getArcColor = (distance) => {
  if (!distance || distance < 5) return { source: [14, 173, 105, 200], target: [90, 156, 124, 200] };
  if (distance < 15) return { source: [244, 162, 97, 200], target: [14, 173, 105, 200] };
  return { source: [224, 122, 95, 200], target: [209, 55, 78, 200] };
};

/**
 * Get danger zone color based on severity
 */
export const getDangerColor = (severity) => {
  return severity === 'CRITICAL' ? DANGER_COLOR_CRITICAL : DANGER_COLOR_HIGH;
};

/**
 * Pulsing radius for animated elements
 */
export const getPulseRadius = (baseRadius, time, speed = 1) => {
  return baseRadius * (1 + 0.3 * Math.sin(time * speed * 0.003));
};

/**
 * Format coordinate for display
 */
export const formatCoord = (coords) => {
  if (!Array.isArray(coords) || coords.length < 2) return 'Unknown';
  return `${coords[1].toFixed(4)}N, ${coords[0].toFixed(4)}E`;
};

/**
 * Format number with SI suffix
 */
export const formatNumber = (n) => {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
};

/**
 * Format currency
 */
export const formatCurrency = (n) => {
  return '\u20B9' + formatNumber(n);
};

// Default center: Chennai (user's primary city)
export const DEFAULT_CENTER = {
  longitude: 80.2707,
  latitude: 13.0827,
};

export const DEFAULT_VIEW_STATE = {
  longitude: 80.2707,
  latitude: 13.0827,
  zoom: 11,
  pitch: 45,
  bearing: -17,
  maxZoom: 20,
  minZoom: 2,
};

export const GLOBE_VIEW_STATE = {
  longitude: 80.2707,
  latitude: 13.0827,
  zoom: 2,
  pitch: 0,
  bearing: 0,
};

// Dark basemap style
export const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
