/**
 * Settings Enforcer Middleware
 * Loads platform settings from DB (cached 60s) and attaches to req.platformSettings.
 * Enforces: maintenance mode, feature toggles, safety thresholds.
 */
const Settings = require('../models/Settings');

let _cache = null;
let _cacheAt = 0;
const CACHE_TTL = 60_000; // 60 seconds

/** Get settings with caching */
async function getSettingsCached() {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL) return _cache;
  try {
    _cache = await Settings.getSettings();
    _cacheAt = now;
  } catch (err) {
    console.error('[SettingsEnforcer] Failed to load settings:', err.message);
  }
  return _cache;
}

/** Force refresh cache (call after settings update) */
function invalidateCache() {
  _cache = null;
  _cacheAt = 0;
}

/**
 * Attach settings to req and enforce maintenance mode.
 * Mount BEFORE route handlers: app.use(settingsEnforcer)
 */
async function settingsEnforcer(req, res, next) {
  try {
    const settings = await getSettingsCached();
    req.platformSettings = settings || {};
  } catch {
    req.platformSettings = {};
  }
  
  // ── Maintenance Mode ────────────────────────────────────
  // Block non-admin users from all /api routes (except health + auth)
  const isMaintenance = req.platformSettings?.features?.maintenanceMode;
  if (isMaintenance && req.path.startsWith('/api')) {
    // Allow: health endpoint, admin routes, auth login
    const allowed = ['/api/health', '/api/auth/login', '/api/auth/refresh'];
    const isAdmin = req.user?.role === 'ADMIN';
    const isAllowed = allowed.some(p => req.path.startsWith(p)) || req.path.startsWith('/api/admin');
    
    if (!isAdmin && !isAllowed) {
      return res.status(503).json({
        success: false,
        message: 'Platform is under maintenance. Please try again later.',
        maintenanceMode: true
      });
    }
  }

  next();
}

/**
 * Feature gate middleware factory.
 * Usage: router.post('/rides', featureGate('rideSharingEnabled'), rideController.postRide)
 */
function featureGate(featureName) {
  return (req, res, next) => {
    const features = req.platformSettings?.features || {};
    if (features[featureName] === false) {
      return res.status(403).json({
        success: false,
        message: `This feature is currently disabled by the platform administrator.`,
        feature: featureName,
        disabled: true
      });
    }
    next();
  };
}

module.exports = { settingsEnforcer, featureGate, invalidateCache, getSettingsCached };
