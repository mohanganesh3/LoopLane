/**
 * API Controller
 * Handles external API integrations: Nominatim (geocoding) and OSRM (routing)
 */

const axios = require('axios');
const { AppError, asyncHandler } = require('../middleware/errorHandler');
const { buildCacheKey, getOrSetJson } = require('../utils/redisCache');

const NOMINATIM_URL = process.env.NOMINATIM_API_URL || 'https://nominatim.openstreetmap.org';
const OSRM_URL = process.env.OSRM_API_URL || 'https://router.project-osrm.org';

const GEO_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h
const AUTOCOMPLETE_CACHE_TTL_SECONDS = 6 * 60 * 60; // 6h
const ROUTING_CACHE_TTL_SECONDS = 24 * 60 * 60; // 24h

function parseJsonMaybe(value) {
    if (value === null || value === undefined) return value;
    if (typeof value !== 'string') return value;

    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

function normalizeLonLatPair(a, b) {
    const n1 = Number(a);
    const n2 = Number(b);

    if (!Number.isFinite(n1) || !Number.isFinite(n2)) {
        throw new Error('Invalid coordinate pair');
    }

    const looksLatIndia = (n) => n >= 6 && n <= 38;
    const looksLonIndia = (n) => n >= 68 && n <= 98;

    // Prefer India-specific heuristic since the app is India-focused.
    if (looksLatIndia(n1) && looksLonIndia(n2)) {
        return [n2, n1]; // [lon, lat]
    }

    // Fallback heuristic: if first looks like latitude and second is outside lat range, swap.
    if (Math.abs(n1) <= 90 && Math.abs(n2) > 90) {
        return [n2, n1];
    }

    return [n1, n2];
}

function parseCoordinatePair(input) {
    const value = parseJsonMaybe(input);

    if (Array.isArray(value) && value.length >= 2) {
        return normalizeLonLatPair(value[0], value[1]);
    }

    if (typeof value === 'string') {
        const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
            return normalizeLonLatPair(parts[0], parts[1]);
        }
    }

    throw new Error('Invalid coordinate format');
}

function parseCoordObject(input) {
    const value = parseJsonMaybe(input);

    if (Array.isArray(value)) {
        return { coordinates: parseCoordinatePair(value) };
    }

    if (value && typeof value === 'object' && Array.isArray(value.coordinates)) {
        return { ...value, coordinates: parseCoordinatePair(value.coordinates) };
    }

    throw new Error('Invalid coordinate format');
}

function cacheHeaders(res, cacheInfo) {
    if (!cacheInfo) return;
    res.set('X-Cache', cacheInfo.hit ? 'HIT' : 'MISS');
    if (cacheInfo.store) res.set('X-Cache-Store', cacheInfo.store);
}

/**
 * Geocode address to coordinates
 */
exports.geocodeAddress = asyncHandler(async (req, res) => {
    const address = (req.query.address || '').trim();

    if (!address) {
        throw new AppError('Address is required', 400);
    }

    try {
        const cacheKey = buildCacheKey('external:geocode', { address, provider: NOMINATIM_URL });
        const { value, cache } = await getOrSetJson(cacheKey, GEO_CACHE_TTL_SECONDS, async () => {
            const response = await axios.get(`${NOMINATIM_URL}/search`, {
                params: {
                    q: address,
                    format: 'json',
                    limit: 5,
                    countrycodes: 'in', // India only
                    addressdetails: 1
                },
                headers: {
                    'User-Agent': 'LANE-Carpool-App/1.0'
                }
            });

            const results = response.data.map(place => ({
                displayName: place.display_name,
                address: place.address,
                coordinates: [parseFloat(place.lon), parseFloat(place.lat)],
                city: place.address.city || place.address.town || place.address.village,
                state: place.address.state,
                country: place.address.country,
                placeId: place.place_id
            }));

            return {
                success: true,
                count: results.length,
                results
            };
        });

        cacheHeaders(res, cache);
        res.status(200).json(value);
    } catch (error) {
        console.error('Geocoding error:', error.message);
        throw new AppError('Geocoding failed', 500);
    }
});

/**
 * Reverse geocode coordinates to address
 */
exports.reverseGeocode = asyncHandler(async (req, res) => {
    const { lat } = req.query;
    const lon = req.query.lon ?? req.query.lng;

    if (!lat || !lon) {
        throw new AppError('Latitude and longitude are required', 400);
    }

    try {
        const latNum = parseFloat(lat);
        const lonNum = parseFloat(lon);

        const cacheKey = buildCacheKey('external:reverse-geocode', {
            lat: Number.isFinite(latNum) ? latNum.toFixed(6) : String(lat),
            lon: Number.isFinite(lonNum) ? lonNum.toFixed(6) : String(lon),
            provider: NOMINATIM_URL
        });

        const { value, cache } = await getOrSetJson(cacheKey, GEO_CACHE_TTL_SECONDS, async () => {
            const response = await axios.get(`${NOMINATIM_URL}/reverse`, {
                params: {
                    lat: latNum,
                    lon: lonNum,
                    format: 'json',
                    addressdetails: 1
                },
                headers: {
                    'User-Agent': 'LANE-Carpool-App/1.0'
                }
            });

            const place = response.data;

            return {
                success: true,
                result: {
                    displayName: place.display_name,
                    address: place.address,
                    coordinates: [parseFloat(place.lon), parseFloat(place.lat)],
                    city: place.address.city || place.address.town || place.address.village,
                    state: place.address.state,
                    country: place.address.country
                }
            };
        });

        cacheHeaders(res, cache);
        res.status(200).json(value);
    } catch (error) {
        console.error('Reverse geocoding error:', error.message);
        throw new AppError('Reverse geocoding failed', 500);
    }
});

/**
 * Get route between two points
 */
exports.getRoute = asyncHandler(async (req, res) => {
    const { origin, destination, waypoints } = req.body;

    if (!origin || !destination) {
        throw new AppError('Origin and destination are required', 400);
    }

    try {
        // Parse coordinates (support either raw JSON strings or already-parsed payloads)
        const originCoords = parseCoordObject(origin);
        const destCoords = parseCoordObject(destination);
        const waypointValue = waypoints ? parseJsonMaybe(waypoints) : [];
        const waypointCoords = Array.isArray(waypointValue)
            ? waypointValue.map((wp) => parseCoordObject(wp))
            : [];

        // Build coordinate string
        const allCoords = [
            originCoords,
            ...waypointCoords,
            destCoords
        ];

        const coordString = allCoords
            .map(c => `${c.coordinates[0]},${c.coordinates[1]}`)
            .join(';');

        const cacheKey = buildCacheKey('external:route', { coordString, provider: OSRM_URL });
        const { value, cache } = await getOrSetJson(cacheKey, ROUTING_CACHE_TTL_SECONDS, async () => {
            const response = await axios.get(`${OSRM_URL}/route/v1/driving/${coordString}`, {
                params: {
                    overview: 'full',
                    geometries: 'geojson',
                    steps: true,
                    alternatives: true
                }
            });

            if (response.data.code !== 'Ok') {
                throw new Error('OSRM routing failed');
            }

            const routes = response.data.routes.map(route => ({
                geometry: route.geometry,
                distance: route.distance / 1000, // Convert to km
                duration: route.duration / 60, // Convert to minutes
                legs: route.legs.map(leg => ({
                    distance: leg.distance / 1000,
                    duration: leg.duration / 60,
                    steps: leg.steps ? leg.steps.map(step => ({
                        instruction: step.maneuver?.instruction || '',
                        distance: step.distance / 1000,
                        duration: step.duration / 60
                    })) : []
                }))
            }));

            return {
                success: true,
                routes
            };
        });

        cacheHeaders(res, cache);
        res.status(200).json(value);
    } catch (error) {
        console.error('Routing error:', error.message);
        throw new AppError('Route calculation failed', 500);
    }
});

/**
 * Get distance matrix
 */
exports.getDistanceMatrix = asyncHandler(async (req, res) => {
    const { origins, destinations } = req.body;

    if (!origins || !destinations) {
        throw new AppError('Origins and destinations are required', 400);
    }

    try {
        const originCoords = parseJsonMaybe(origins);
        const destCoords = parseJsonMaybe(destinations);

        if (!Array.isArray(originCoords) || !Array.isArray(destCoords)) {
            throw new AppError('Origins and destinations must be arrays', 400);
        }

        const normalizedOrigins = originCoords.map((pair) => parseCoordinatePair(pair));
        const normalizedDestinations = destCoords.map((pair) => parseCoordinatePair(pair));

        // OSRM table service
        const allCoords = [...normalizedOrigins, ...normalizedDestinations];
        const coordString = allCoords
            .map(c => `${c[0]},${c[1]}`)
            .join(';');

        const originIndices = originCoords.map((_, i) => i).join(';');
        const destIndices = destCoords.map((_, i) => i + originCoords.length).join(';');

        const cacheKey = buildCacheKey('external:distance-matrix', {
            coordString,
            sources: originIndices,
            destinations: destIndices,
            provider: OSRM_URL
        });

        const { value, cache } = await getOrSetJson(cacheKey, ROUTING_CACHE_TTL_SECONDS, async () => {
            const response = await axios.get(`${OSRM_URL}/table/v1/driving/${coordString}`, {
                params: {
                    sources: originIndices,
                    destinations: destIndices
                }
            });

            if (response.data.code !== 'Ok') {
                throw new Error('Distance matrix calculation failed');
            }

            return {
                success: true,
                distances: response.data.distances, // 2D array in meters
                durations: response.data.durations // 2D array in seconds
            };
        });

        cacheHeaders(res, cache);
        res.status(200).json(value);
    } catch (error) {
        console.error('Distance matrix error:', error.message);
        throw new AppError('Distance matrix calculation failed', 500);
    }
});

/**
 * Autocomplete location search
 */
exports.autocomplete = asyncHandler(async (req, res) => {
    const query = (req.query.query || '').trim();

    if (!query || query.length < 3) {
        throw new AppError('Query must be at least 3 characters', 400);
    }

    try {
        const cacheKey = buildCacheKey('external:autocomplete', { query, provider: NOMINATIM_URL });

        const { value, cache } = await getOrSetJson(cacheKey, AUTOCOMPLETE_CACHE_TTL_SECONDS, async () => {
            const response = await axios.get(`${NOMINATIM_URL}/search`, {
                params: {
                    q: query,
                    format: 'json',
                    limit: 10,
                    countrycodes: 'in',
                    addressdetails: 1
                },
                headers: {
                    'User-Agent': 'LANE-Carpool-App/1.0'
                }
            });

            const suggestions = response.data.map(place => ({
                label: place.display_name,
                value: {
                    address: place.display_name,
                    coordinates: [parseFloat(place.lon), parseFloat(place.lat)],
                    city: place.address.city || place.address.town || place.address.village,
                    state: place.address.state
                }
            }));

            return {
                success: true,
                suggestions
            };
        });

        cacheHeaders(res, cache);
        res.status(200).json(value);
    } catch (error) {
        console.error('Autocomplete error:', error.message);
        throw new AppError('Autocomplete failed', 500);
    }
});

/**
 * Get nearest roads (snap to road)
 */
exports.snapToRoad = asyncHandler(async (req, res) => {
    const { coordinates } = req.body;

    if (!coordinates) {
        throw new AppError('Coordinates are required', 400);
    }

    try {
        const parsedCoords = parseJsonMaybe(coordinates);
        if (!Array.isArray(parsedCoords)) {
            throw new AppError('Coordinates must be an array', 400);
        }

        const coords = parsedCoords.map((pair) => parseCoordinatePair(pair));
        const coordString = coords
            .map(c => `${c[0]},${c[1]}`)
            .join(';');

        const cacheKey = buildCacheKey('external:snap-to-road', { coordString, provider: OSRM_URL });
        const { value, cache } = await getOrSetJson(cacheKey, ROUTING_CACHE_TTL_SECONDS, async () => {
            const response = await axios.get(`${OSRM_URL}/nearest/v1/driving/${coordString}`, {
                params: {
                    number: 1
                }
            });

            if (response.data.code !== 'Ok') {
                throw new Error('Snap to road failed');
            }

            const snapped = response.data.waypoints.map(wp => ({
                coordinates: [wp.location[0], wp.location[1]],
                distance: wp.distance,
                name: wp.name
            }));

            return {
                success: true,
                snapped
            };
        });

        cacheHeaders(res, cache);
        res.status(200).json(value);
    } catch (error) {
        console.error('Snap to road error:', error.message);
        throw new AppError('Snap to road failed', 500);
    }
});

/**
 * Calculate ETA
 */
exports.calculateETA = asyncHandler(async (req, res) => {
    const origin = req.query.origin ?? req.query.from;
    const destination = req.query.destination ?? req.query.to;

    if (!origin || !destination) {
        throw new AppError('Origin and destination are required', 400);
    }

    try {
        const originPair = parseCoordinatePair(origin);
        const destPair = parseCoordinatePair(destination);

        const coordString = `${originPair[0]},${originPair[1]};${destPair[0]},${destPair[1]}`;
        const cacheKey = buildCacheKey('external:eta-metrics', { coordString, provider: OSRM_URL });

        const { value: metrics, cache } = await getOrSetJson(cacheKey, ROUTING_CACHE_TTL_SECONDS, async () => {
            const response = await axios.get(`${OSRM_URL}/route/v1/driving/${coordString}`, {
                params: {
                    overview: 'false',
                    geometries: 'geojson'
                }
            });

            if (response.data.code !== 'Ok') {
                throw new Error('ETA calculation failed');
            }

            const route = response.data.routes[0];

            return {
                distanceKm: route.distance / 1000,
                durationSec: route.duration
            };
        });

        const eta = new Date(Date.now() + metrics.durationSec * 1000);

        cacheHeaders(res, cache);
        res.status(200).json({
            success: true,
            distance: metrics.distanceKm,
            duration: metrics.durationSec / 60,
            eta: eta.toISOString()
        });
    } catch (error) {
        console.error('ETA calculation error:', error.message);
        throw new AppError('ETA calculation failed', 500);
    }
});

/**
 * Get user notifications
 */
exports.getNotifications = asyncHandler(async (req, res) => {
    const Notification = require('../models/Notification');
    
    const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean();
    const unreadCount = notifications.filter(notification => !notification.read).length;
    
    res.status(200).json({
        success: true,
        notifications,
        unreadCount
    });
});

/**
 * Get all user notifications (for notifications page)
 */
exports.getAllNotifications = asyncHandler(async (req, res) => {
    const Notification = require('../models/Notification');
    
    const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .lean();
    const unreadCount = notifications.filter(notification => !notification.read).length;
    
    res.status(200).json({
        success: true,
        notifications,
        unreadCount
    });
});

/**
 * Get unread notification count
 */
exports.getNotificationCount = asyncHandler(async (req, res) => {
    const Notification = require('../models/Notification');
    
    const unreadCount = await Notification.countDocuments({
        user: req.user._id,
        read: false
    });
    
    res.status(200).json({
        success: true,
        unreadCount,
        count: unreadCount
    });
});

/**
 * Mark notification as read
 */
exports.markNotificationAsRead = asyncHandler(async (req, res) => {
    const Notification = require('../models/Notification');
    const { notificationId } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
        { _id: notificationId, user: req.user._id },
        { read: true, readAt: new Date() },
        { new: true }
    );
    
    if (!notification) {
        throw new AppError('Notification not found', 404);
    }
    
    res.status(200).json({
        success: true,
        notification
    });
});

/**
 * Mark all notifications as read
 */
exports.markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    const Notification = require('../models/Notification');
    
    const result = await Notification.updateMany(
        { user: req.user._id, read: false },
        { read: true, readAt: new Date() }
    );
    
    res.status(200).json({
        success: true,
        modifiedCount: result.modifiedCount
    });
});

/**
 * Delete a user notification
 */
exports.deleteNotification = asyncHandler(async (req, res) => {
    const Notification = require('../models/Notification');
    const { notificationId } = req.params;

    const notification = await Notification.findOneAndDelete({
        _id: notificationId,
        user: req.user._id
    });

    if (!notification) {
        throw new AppError('Notification not found', 404);
    }

    res.status(200).json({
        success: true,
        deletedId: notificationId
    });
});
