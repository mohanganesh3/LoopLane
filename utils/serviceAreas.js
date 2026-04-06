/**
 * ═══════════════════════════════════════════════════════════════════
 *  SERVICE AREAS + H3 HEXAGONAL GRID — Single Source of Truth
 *  LoopLane — Uber-style H3 spatial indexing for all locations
 *
 *  Every service area, office, and employee location is H3-indexed.
 *  The map is divided into hierarchical hexagons:
 *    Res 4 → ~1,770 km²  Region (South India, North India)
 *    Res 5 → ~252 km²    Metro (Chennai metro, Bangalore metro)
 *    Res 7 → ~5.16 km²   Zone (OMR corridor, Koramangala) ← DEFAULT
 *    Res 8 → ~0.74 km²   Neighborhood
 *    Res 9 → ~0.105 km²  Block
 *
 *  All rides, employees, permission scopes resolve through hex indexes.
 * ═══════════════════════════════════════════════════════════════════
 */

const {
    coordsToHex, hexToCoords, hexFillBBox, hexDisk, hexParent,
    hexDistance, hexPath, coverServiceArea, classifyRideHex,
    isValidHex, hexBoundary, hexToGeoJSON,
    RES, DEFAULT_RES, zoomToResolution, hexEdgeKm, hexAreaKm2,
} = require('./hexGrid');

// ─── SERVICE AREA DEFINITIONS ─────────────────────────────────────
// Each area has: real coords, bbox, H3 center hex, coverage hex set
// Offices have real addresses and their own H3 indexes

const SERVICE_AREAS = {
    chennai: {
        key: 'chennai',
        name: 'Chennai',
        center: [80.2707, 13.0827],
        bbox: [80.05, 12.85, 80.50, 13.30],
        zone: 'SOUTH',
        state: 'Tamil Nadu',
        color: '#ef4444', // red
        offices: [
            { name: 'LoopLane HQ — OMR',           address: 'Tidel Park, Rajiv Gandhi Salai, Taramani, Chennai 600113',  coordinates: [80.2270, 12.9825] },
            { name: 'Anna Nagar Hub',                address: '2nd Ave, Y Block, Anna Nagar, Chennai 600040',             coordinates: [80.2095, 13.0878] },
            { name: 'Porur Operations Center',       address: 'Grand Square Mall, Mount Poonamallee Rd, Chennai 600116',  coordinates: [80.1567, 13.0382] },
        ]
    },
    bangalore: {
        key: 'bangalore',
        name: 'Bangalore',
        center: [77.5946, 12.9716],
        bbox: [77.40, 12.80, 77.80, 13.15],
        zone: 'SOUTH',
        state: 'Karnataka',
        color: '#f97316', // orange
        offices: [
            { name: 'Koramangala Tech Park',         address: '80 Feet Rd, Koramangala 4th Block, Bangalore 560034',      coordinates: [77.6197, 12.9352] },
            { name: 'Whitefield Hub',                address: 'ITPL Main Rd, Whitefield, Bangalore 560066',               coordinates: [77.7480, 12.9698] },
            { name: 'Electronic City Base',          address: 'Hosur Rd, Electronic City Phase 1, Bangalore 560100',      coordinates: [77.6590, 12.8456] },
        ]
    },
    mumbai: {
        key: 'mumbai',
        name: 'Mumbai',
        center: [72.8777, 19.0760],
        bbox: [72.75, 18.88, 73.10, 19.35],
        zone: 'WEST',
        state: 'Maharashtra',
        color: '#eab308', // yellow
        offices: [
            { name: 'BKC Corporate Office',          address: 'G Block, Bandra Kurla Complex, Mumbai 400051',             coordinates: [72.8675, 19.0656] },
            { name: 'Andheri West Hub',              address: 'Veera Desai Rd, Andheri West, Mumbai 400053',              coordinates: [72.8296, 19.1371] },
            { name: 'Navi Mumbai Operations',        address: 'Palm Beach Rd, Vashi, Navi Mumbai 400703',                 coordinates: [72.9868, 19.0709] },
        ]
    },
    delhi_ncr: {
        key: 'delhi_ncr',
        name: 'Delhi NCR',
        center: [77.1025, 28.7041],
        bbox: [76.80, 28.35, 77.50, 28.95],
        zone: 'NORTH',
        state: 'Delhi / Haryana / UP',
        color: '#22c55e', // green
        offices: [
            { name: 'Connaught Place HQ',            address: 'Barakhamba Rd, Connaught Place, New Delhi 110001',         coordinates: [77.2195, 28.6315] },
            { name: 'Gurgaon Cyber Hub',             address: 'DLF Cyber City, Sector 24, Gurgaon 122002',               coordinates: [77.0888, 28.4946] },
            { name: 'Noida Sector 62',               address: 'Sector 62, Institutional Area, Noida 201309',             coordinates: [77.3648, 28.6269] },
        ]
    },
    hyderabad: {
        key: 'hyderabad',
        name: 'Hyderabad',
        center: [78.4867, 17.3850],
        bbox: [78.28, 17.25, 78.70, 17.58],
        zone: 'SOUTH',
        state: 'Telangana',
        color: '#3b82f6', // blue
        offices: [
            { name: 'HITEC City Office',             address: 'Cyber Towers, HITEC City, Hyderabad 500081',               coordinates: [78.3772, 17.4486] },
            { name: 'Gachibowli Hub',                address: 'Financial District, Gachibowli, Hyderabad 500032',         coordinates: [78.3531, 17.4256] },
        ]
    },
    pune: {
        key: 'pune',
        name: 'Pune',
        center: [73.8567, 18.5204],
        bbox: [73.70, 18.40, 74.10, 18.70],
        zone: 'WEST',
        state: 'Maharashtra',
        color: '#8b5cf6', // violet
        offices: [
            { name: 'Hinjewadi Tech Park',           address: 'Rajiv Gandhi Infotech Park, Hinjewadi, Pune 411057',       coordinates: [73.7379, 18.5913] },
            { name: 'Kharadi Hub',                   address: 'EON IT Park, Kharadi, Pune 411014',                        coordinates: [73.9401, 18.5536] },
        ]
    },
    kolkata: {
        key: 'kolkata',
        name: 'Kolkata',
        center: [88.3639, 22.5726],
        bbox: [88.20, 22.40, 88.58, 22.78],
        zone: 'EAST',
        state: 'West Bengal',
        color: '#06b6d4', // cyan
        offices: [
            { name: 'Salt Lake Sector V',            address: 'Block EP, Sector V, Salt Lake City, Kolkata 700091',       coordinates: [88.4344, 22.5727] },
            { name: 'Park Street Office',            address: 'Park Street, Kolkata 700016',                              coordinates: [88.3494, 22.5541] },
        ]
    },
    ahmedabad: {
        key: 'ahmedabad',
        name: 'Ahmedabad',
        center: [72.5714, 23.0225],
        bbox: [72.40, 22.90, 72.78, 23.18],
        zone: 'WEST',
        state: 'Gujarat',
        color: '#ec4899', // pink
        offices: [
            { name: 'SG Highway Office',             address: 'Sindhubhavan Rd, SG Highway, Ahmedabad 380054',            coordinates: [72.5009, 23.0276] },
            { name: 'Prahlad Nagar Hub',             address: 'Corporate Rd, Prahlad Nagar, Ahmedabad 380015',            coordinates: [72.5174, 23.0134] },
        ]
    },
    jaipur: {
        key: 'jaipur',
        name: 'Jaipur',
        center: [75.7873, 26.9124],
        bbox: [75.60, 26.75, 76.02, 27.10],
        zone: 'NORTH',
        state: 'Rajasthan',
        color: '#14b8a6', // teal
        offices: [
            { name: 'Malviya Nagar Office',          address: 'Jawahar Lal Nehru Marg, Malviya Nagar, Jaipur 302017',     coordinates: [75.8050, 26.8564] },
        ]
    },
    kochi: {
        key: 'kochi',
        name: 'Kochi',
        center: [76.2673, 9.9312],
        bbox: [76.10, 9.80, 76.45, 10.12],
        zone: 'SOUTH',
        state: 'Kerala',
        color: '#a855f7', // purple
        offices: [
            { name: 'Infopark Kochi Office',         address: 'Infopark SEZ, Kakkanad, Kochi 682042',                     coordinates: [76.3561, 10.0108] },
        ]
    },
};

// ─── H3 ENRICHMENT — Compute hex indexes for every area & office ──

const enrichWithH3 = () => {
    for (const area of Object.values(SERVICE_AREAS)) {
        // Area center hex at zone resolution
        area.h3Center = coordsToHex(area.center, RES.ZONE);
        // Area center hex at metro resolution (for grouping)
        area.h3Metro = coordsToHex(area.center, RES.METRO);

        // Compute hex coverage for the area
        const coverage = coverServiceArea(area, RES.ZONE);
        area.h3Coverage = coverage.hexes;      // All hex indexes at res7 that tile this area
        area.h3Compact = coverage.compact;     // Compacted representation
        area.h3Count = coverage.count;

        // Enrich each office with its hex index
        for (const office of area.offices) {
            office.h3Index = coordsToHex(office.coordinates, RES.ZONE);
            office.h3Precise = coordsToHex(office.coordinates, RES.BLOCK);
        }
    }
};

// Run enrichment on module load
enrichWithH3();

// ─── GEO UTILITIES ────────────────────────────────────────────────

/**
 * Validate a [lng, lat] coordinate pair
 */
const isValidCoordinates = (coords) =>
    Array.isArray(coords) &&
    coords.length === 2 &&
    coords.every(v => Number.isFinite(Number(v))) &&
    Math.abs(Number(coords[0])) <= 180 &&
    Math.abs(Number(coords[1])) <= 90;

/**
 * Check if [lng, lat] falls within a bounding box [minLng, minLat, maxLng, maxLat]
 */
const isWithinBBox = (coords, bbox) => {
    if (!bbox || !isValidCoordinates(coords)) return false;
    const [lng, lat] = coords.map(Number);
    return lng >= bbox[0] && lat >= bbox[1] && lng <= bbox[2] && lat <= bbox[3];
};

/**
 * Haversine distance in km between two [lng, lat] pairs
 */
const haversineKm = (a, b) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const [lng1, lat1] = a.map(Number);
    const [lng2, lat2] = b.map(Number);
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// ─── DETECTION FUNCTIONS (H3-first) ──────────────────────────────

/**
 * Detect which service area a [lng, lat] coordinate falls in.
 * Uses H3 hex membership for fast, exact matching.
 */
const detectServiceArea = (coords) => {
    if (!isValidCoordinates(coords)) return null;
    const hex = coordsToHex(coords, RES.ZONE);
    if (!hex) return null;

    // Check if hex is in any area's coverage set
    for (const area of Object.values(SERVICE_AREAS)) {
        if (area.h3Coverage && area.h3Coverage.includes(hex)) return area;
    }

    // Fallback: bbox check (for hexes at boundaries)
    for (const area of Object.values(SERVICE_AREAS)) {
        if (isWithinBBox(coords, area.bbox)) return area;
    }
    return null;
};

/**
 * Get nearest service area even if outside all coverage sets.
 * Uses H3 grid distance for accuracy.
 */
const getNearestServiceArea = (coords) => {
    if (!isValidCoordinates(coords)) return null;

    const exact = detectServiceArea(coords);
    if (exact) return exact;

    const hex = coordsToHex(coords, RES.ZONE);
    let nearest = null;
    let minDist = Infinity;
    for (const area of Object.values(SERVICE_AREAS)) {
        const dist = haversineKm(coords, area.center);
        if (dist < minDist) {
            minDist = dist;
            nearest = area;
        }
    }
    return minDist <= 100 ? nearest : null; // 100 km catchment
};

/**
 * Auto-detect zone from coordinates.
 */
const detectZone = (coords) => {
    const area = getNearestServiceArea(coords);
    if (area) return area.zone;
    if (!isValidCoordinates(coords)) return 'CENTRAL';
    const [lng, lat] = coords.map(Number);
    if (lat > 23.5) return lng < 76 ? 'NORTH' : 'EAST';
    if (lat > 15.0) return lng < 76 ? 'WEST' : 'SOUTH';
    return 'SOUTH';
};

/**
 * Classify a ride by its coordinates — with full hex path analysis.
 */
const classifyRide = (startCoords, destCoords, intermediateStops = []) => {
    const origin = getNearestServiceArea(startCoords);
    const destination = getNearestServiceArea(destCoords);

    const originKey = origin?.key || 'unknown';
    const destKey = destination?.key || 'unknown';
    const isCrossArea = originKey !== destKey;

    const areaSet = new Set([originKey, destKey]);
    for (const stop of intermediateStops) {
        if (stop?.coordinates) {
            const stopArea = getNearestServiceArea(stop.coordinates);
            if (stopArea) areaSet.add(stopArea.key);
        }
    }

    // H3 hex path analysis
    const hexAnalysis = classifyRideHex(startCoords, destCoords);

    return {
        origin: origin ? { key: origin.key, name: origin.name, zone: origin.zone, coordinates: origin.center } : null,
        destination: destination ? { key: destination.key, name: destination.name, zone: destination.zone, coordinates: destination.center } : null,
        isCrossArea,
        areas: [...areaSet].filter(a => a !== 'unknown'),
        distance: isValidCoordinates(startCoords) && isValidCoordinates(destCoords)
            ? haversineKm(startCoords, destCoords) : null,
        hex: hexAnalysis,
    };
};

/**
 * Match a city filter bbox against coordinate sets
 */
const matchesCityFilter = (bbox, ...coordinateSets) => {
    if (!bbox) return true;
    return coordinateSets.some(coords => isWithinBBox(coords, bbox));
};

/**
 * Get area key from city name (backward compat)
 */
const areaKeyFromName = (name) => {
    if (!name) return null;
    const normalized = name.toLowerCase().replace(/\s+/g, '_');
    if (SERVICE_AREAS[normalized]) return normalized;
    for (const [key, area] of Object.entries(SERVICE_AREAS)) {
        if (area.name.toLowerCase() === name.toLowerCase()) return key;
    }
    return null;
};

/**
 * Get area name from coordinates
 */
const areaNameFromCoords = (coords) => {
    const area = getNearestServiceArea(coords);
    return area ? area.name : 'Unknown';
};

/**
 * Resolve employee location from coordinates → auto-fills city, zone, hex, nearest office.
 * This is THE core function — given any [lng, lat], it returns everything needed.
 */
const resolveEmployeeLocation = (coords) => {
    if (!isValidCoordinates(coords)) return { city: 'Unknown', zone: 'CENTRAL', office: null, areaKey: null, coordinates: coords };

    const area = getNearestServiceArea(coords);
    if (!area) return { city: 'Unknown', zone: 'CENTRAL', office: null, areaKey: null, coordinates: coords };

    // H3 hex indexes at multiple resolutions
    const h3Zone = coordsToHex(coords, RES.ZONE);
    const h3Neighborhood = coordsToHex(coords, RES.NEIGHBORHOOD);
    const h3Block = coordsToHex(coords, RES.BLOCK);
    const h3Metro = coordsToHex(coords, RES.METRO);

    // Find nearest office
    let nearestOffice = area.offices[0];
    let minDist = Infinity;
    let nearestOfficeIndex = 0;
    for (let i = 0; i < area.offices.length; i++) {
        const dist = haversineKm(coords, area.offices[i].coordinates);
        if (dist < minDist) {
            minDist = dist;
            nearestOffice = area.offices[i];
            nearestOfficeIndex = i;
        }
    }

    return {
        coordinates: coords,
        city: area.name,
        zone: area.zone,
        state: area.state,
        areaKey: area.key,
        office: nearestOffice.name,
        officeAddress: nearestOffice.address,
        officeIndex: nearestOfficeIndex,
        distanceToOffice: Math.round(minDist * 10) / 10,
        h3Index: h3Zone,           // Primary hex (res 7)
        h3Neighborhood: h3Neighborhood, // Res 8
        h3Block: h3Block,          // Res 9
        h3Metro: h3Metro,          // Res 5
    };
};

/**
 * Resolve from a hex index directly (no raw coords needed)
 */
const resolveFromHex = (hexIndex) => {
    if (!isValidHex(hexIndex)) return null;
    const coords = hexToCoords(hexIndex);
    if (!coords) return null;
    return resolveEmployeeLocation(coords);
};

/**
 * Find which area a hex belongs to
 */
const areaFromHex = (hexIndex) => {
    if (!isValidHex(hexIndex)) return null;
    for (const area of Object.values(SERVICE_AREAS)) {
        if (area.h3Coverage?.includes(hexIndex)) return area;
    }
    // Fallback: resolve from coords
    const coords = hexToCoords(hexIndex);
    return coords ? detectServiceArea(coords) : null;
};

/**
 * Generate hex coverage data for frontend visualization.
 * Returns lightweight hex data for all service areas (for DeckGL H3HexagonLayer).
 */
const getHexVisualizationData = () => {
    const data = [];
    for (const area of Object.values(SERVICE_AREAS)) {
        // Send the coverage hexes with area metadata
        for (const hex of (area.h3Coverage || [])) {
            data.push({
                hex,
                area: area.key,
                name: area.name,
                color: area.color,
                zone: area.zone,
            });
        }
    }
    return data;
};

/**
 * Get lightweight service area data for frontend (without full hex coverage arrays)
 */
const getServiceAreasMeta = () => {
    const meta = {};
    for (const [key, area] of Object.entries(SERVICE_AREAS)) {
        meta[key] = {
            key: area.key,
            name: area.name,
            center: area.center,
            bbox: area.bbox,
            zone: area.zone,
            state: area.state,
            color: area.color,
            h3Center: area.h3Center,
            h3Metro: area.h3Metro,
            h3Count: area.h3Count,
            offices: area.offices.map(o => ({
                name: o.name,
                address: o.address,
                coordinates: o.coordinates,
                h3Index: o.h3Index,
            })),
        };
    }
    return meta;
};

// ─── CONVENIENCE LOOKUPS ──────────────────────────────────────────

const AREA_KEYS = Object.keys(SERVICE_AREAS);
const AREA_NAMES = Object.values(SERVICE_AREAS).map(a => a.name);
const NAME_TO_KEY = Object.fromEntries(Object.values(SERVICE_AREAS).map(a => [a.name, a.key]));
const KEY_TO_NAME = Object.fromEntries(Object.entries(SERVICE_AREAS).map(([k, a]) => [k, a.name]));
const getAreaCenter = (key) => SERVICE_AREAS[key]?.center || null;
const getAreaBBox = (keyOrName) => {
    const key = SERVICE_AREAS[keyOrName] ? keyOrName : areaKeyFromName(keyOrName);
    return key ? SERVICE_AREAS[key].bbox : null;
};

// ─── EXPORTS ──────────────────────────────────────────────────────

module.exports = {
    SERVICE_AREAS,
    AREA_KEYS,
    AREA_NAMES,
    NAME_TO_KEY,
    KEY_TO_NAME,
    isValidCoordinates,
    isWithinBBox,
    haversineKm,
    detectServiceArea,
    getNearestServiceArea,
    detectZone,
    classifyRide,
    matchesCityFilter,
    areaKeyFromName,
    areaNameFromCoords,
    resolveEmployeeLocation,
    resolveFromHex,
    areaFromHex,
    getAreaCenter,
    getAreaBBox,
    getHexVisualizationData,
    getServiceAreasMeta,
};
