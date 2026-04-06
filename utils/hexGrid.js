/**
 * ═══════════════════════════════════════════════════════════════════
 *  H3 HEXAGONAL GRID ENGINE — Uber's H3 Spatial Indexing
 *  LoopLane — Divides India's service map into hierarchical hexagons
 *
 *  Resolution Guide:
 *    Res 4  → ~1,770 km²  Region level (South India, North India)
 *    Res 5  → ~252 km²    Metro level (Chennai metro, Bangalore metro)
 *    Res 7  → ~5.16 km²   Zone level  (OMR corridor, Koramangala)
 *    Res 8  → ~0.74 km²   Neighborhood (Anna Nagar, Whitefield)
 *    Res 9  → ~0.105 km²  Block level  (specific street blocks)
 *
 *  Primary resolution: 7 (zone-level, ~2.5 km edge, same as Uber surge)
 *  Display resolution: adaptive (7-9 based on map zoom)
 * ═══════════════════════════════════════════════════════════════════
 */

const h3 = require('h3-js');

// ─── RESOLUTION CONSTANTS ─────────────────────────────────────────

const RES = {
    REGION: 4,       // ~1,770 km² — continent-level clusters
    METRO: 5,        // ~252 km²   — city/metro coverage
    ZONE: 7,         // ~5.16 km²  — primary operating zone (default)
    NEIGHBORHOOD: 8, // ~0.74 km²  — neighborhood precision
    BLOCK: 9,        // ~0.105 km² — block-level precision
};

const DEFAULT_RES = RES.ZONE; // Resolution 7

// ─── CORE CONVERSIONS ─────────────────────────────────────────────

/**
 * Convert [lng, lat] to H3 hex index at given resolution
 * @param {number[]} coords - [longitude, latitude]
 * @param {number} resolution - H3 resolution (0-15)
 * @returns {string} H3 index
 */
const coordsToHex = (coords, resolution = DEFAULT_RES) => {
    if (!coords || coords.length < 2) return null;
    const [lng, lat] = coords.map(Number);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    if (Math.abs(lng) > 180 || Math.abs(lat) > 90) return null;
    return h3.latLngToCell(lat, lng, resolution);
};

/**
 * Convert H3 index to [lng, lat] center coordinates
 * @param {string} hexIndex - H3 index
 * @returns {number[]} [longitude, latitude]
 */
const hexToCoords = (hexIndex) => {
    if (!hexIndex || !h3.isValidCell(hexIndex)) return null;
    const [lat, lng] = h3.cellToLatLng(hexIndex);
    return [lng, lat];
};

/**
 * Get hex boundary as array of [lng, lat] pairs (for rendering)
 * @param {string} hexIndex
 * @returns {number[][]} Array of [lng, lat] coordinate pairs forming the hex boundary
 */
const hexBoundary = (hexIndex) => {
    if (!hexIndex || !h3.isValidCell(hexIndex)) return [];
    return h3.cellToBoundary(hexIndex).map(([lat, lng]) => [lng, lat]);
};

/**
 * Get hex boundary as GeoJSON polygon (for map layers)
 */
const hexToGeoJSON = (hexIndex) => {
    const boundary = hexBoundary(hexIndex);
    if (!boundary.length) return null;
    return {
        type: 'Feature',
        properties: { h3Index: hexIndex, resolution: h3.getResolution(hexIndex) },
        geometry: {
            type: 'Polygon',
            coordinates: [[...boundary, boundary[0]]] // close the ring
        }
    };
};

/**
 * Get the resolution of a hex index
 */
const hexResolution = (hexIndex) => {
    if (!hexIndex || !h3.isValidCell(hexIndex)) return null;
    return h3.getResolution(hexIndex);
};

/**
 * Check if a hex index is valid
 */
const isValidHex = (hexIndex) => {
    if (!hexIndex || typeof hexIndex !== 'string') return false;
    return h3.isValidCell(hexIndex);
};

// ─── SPATIAL QUERIES ──────────────────────────────────────────────

/**
 * Get all hex indexes within k rings of a center hex
 * k=0 returns just the center hex, k=1 returns center + immediate neighbors (7 hexes), etc.
 * @param {string} hexIndex - Center hex
 * @param {number} k - Number of rings
 * @returns {string[]} Array of hex indexes
 */
const hexDisk = (hexIndex, k = 1) => {
    if (!isValidHex(hexIndex)) return [];
    return h3.gridDisk(hexIndex, k);
};

/**
 * Get only the ring at distance k (hollow ring, not filled disk)
 * @param {string} hexIndex - Center hex
 * @param {number} k - Ring distance
 * @returns {string[]}
 */
const hexRing = (hexIndex, k = 1) => {
    if (!isValidHex(hexIndex)) return [];
    try {
        return h3.gridRingUnsafe(hexIndex, k);
    } catch {
        // Fallback: compute ring from disk difference
        const diskK = h3.gridDisk(hexIndex, k);
        const diskKm1 = k > 0 ? new Set(h3.gridDisk(hexIndex, k - 1)) : new Set();
        return diskK.filter(h => !diskKm1.has(h));
    }
};

/**
 * Get all hexes that cover a bounding box at a given resolution.
 * Fills the rectangle with hexagons.
 * @param {number[]} bbox - [minLng, minLat, maxLng, maxLat]
 * @param {number} resolution
 * @returns {string[]}
 */
const hexFillBBox = (bbox, resolution = DEFAULT_RES) => {
    if (!bbox || bbox.length < 4) return [];
    const [minLng, minLat, maxLng, maxLat] = bbox.map(Number);

    // Create a GeoJSON polygon from the bbox
    const polygon = [
        [minLng, minLat],
        [maxLng, minLat],
        [maxLng, maxLat],
        [minLng, maxLat],
        [minLng, minLat], // close the ring
    ];

    // h3.polygonToCells expects [[lat, lng], ...] format
    const h3Polygon = polygon.map(([lng, lat]) => [lat, lng]);

    try {
        return h3.polygonToCells(h3Polygon, resolution);
    } catch {
        return [];
    }
};

/**
 * Get hexes along a path between two points (e.g., ride route)
 * @param {number[]} start - [lng, lat]
 * @param {number[]} end - [lng, lat]
 * @param {number} resolution
 * @returns {string[]}
 */
const hexPath = (start, end, resolution = DEFAULT_RES) => {
    const startHex = coordsToHex(start, resolution);
    const endHex = coordsToHex(end, resolution);
    if (!startHex || !endHex) return [];
    try {
        return h3.gridPathCells(startHex, endHex);
    } catch {
        // If direct path fails, return just start and end
        return [startHex, endHex].filter(Boolean);
    }
};

/**
 * Check if two hexes are neighbors (adjacent)
 */
const areNeighbors = (hex1, hex2) => {
    if (!isValidHex(hex1) || !isValidHex(hex2)) return false;
    return h3.areNeighborCells(hex1, hex2);
};

/**
 * Get distance between two hexes in hex steps (grid distance)
 */
const hexDistance = (hex1, hex2) => {
    if (!isValidHex(hex1) || !isValidHex(hex2)) return -1;
    try {
        return h3.gridDistance(hex1, hex2);
    } catch {
        return -1;
    }
};

// ─── HIERARCHY (resolution switching) ─────────────────────────────

/**
 * Get the parent hex at a coarser resolution
 * e.g., Res 7 hex → its Res 5 parent (metro-level)
 */
const hexParent = (hexIndex, parentRes) => {
    if (!isValidHex(hexIndex)) return null;
    const res = h3.getResolution(hexIndex);
    if (parentRes >= res) return hexIndex;
    return h3.cellToParent(hexIndex, parentRes);
};

/**
 * Get all child hexes at a finer resolution
 * e.g., Res 5 hex → all Res 7 children within it
 */
const hexChildren = (hexIndex, childRes) => {
    if (!isValidHex(hexIndex)) return [];
    const res = h3.getResolution(hexIndex);
    if (childRes <= res) return [hexIndex];
    return h3.cellToChildren(hexIndex, childRes);
};

// ─── AREA COVERAGE ────────────────────────────────────────────────

/**
 * Generate the complete hex coverage set for a service area.
 * Returns all hex indexes at the given resolution that tile the area's bbox.
 * Also computes compact representation for storage.
 *
 * @param {Object} area - Service area with .bbox and .center
 * @param {number} resolution
 * @returns {{ hexes: string[], compact: string[], center: string, count: number }}
 */
const coverServiceArea = (area, resolution = DEFAULT_RES) => {
    if (!area?.bbox || !area?.center) return { hexes: [], compact: [], center: null, count: 0 };

    const hexes = hexFillBBox(area.bbox, resolution);
    const centerHex = coordsToHex(area.center, resolution);

    // Compact representation: reduce hex count using H3's compaction
    let compact = [];
    try {
        compact = h3.compactCells(hexes);
    } catch {
        compact = hexes;
    }

    return {
        hexes,
        compact,
        center: centerHex,
        count: hexes.length,
    };
};

/**
 * Check if a hex index belongs to a service area's coverage set
 * More efficient than re-computing coverage each time.
 * Uses parent resolution check as fast pre-filter.
 */
const hexInArea = (hexIndex, areaBbox, resolution = DEFAULT_RES) => {
    if (!isValidHex(hexIndex)) return false;
    const center = hexToCoords(hexIndex);
    if (!center) return false;
    const [lng, lat] = center;
    return lng >= areaBbox[0] && lat >= areaBbox[1] && lng <= areaBbox[2] && lat >= areaBbox[3];
};

// ─── RIDE HEX CLASSIFICATION ─────────────────────────────────────

/**
 * Classify a ride by its H3 hex path.
 * Returns origin/destination hexes, all hexes along path, zone crossings.
 *
 * @param {number[]} startCoords - [lng, lat]
 * @param {number[]} endCoords - [lng, lat]
 * @param {number} resolution
 * @returns {{ originHex, destHex, path, pathLength, isCrossZone }}
 */
const classifyRideHex = (startCoords, endCoords, resolution = DEFAULT_RES) => {
    const originHex = coordsToHex(startCoords, resolution);
    const destHex = coordsToHex(endCoords, resolution);
    const path = hexPath(startCoords, endCoords, resolution);

    // Check if origin and destination share the same metro (res 5) parent
    const originMetro = originHex ? hexParent(originHex, RES.METRO) : null;
    const destMetro = destHex ? hexParent(destHex, RES.METRO) : null;
    const isCrossZone = originMetro !== destMetro;

    return {
        originHex,
        destHex,
        path,
        pathLength: path.length,
        isCrossZone,
        originMetro,
        destMetro,
    };
};

// ─── ZOOM-TO-RESOLUTION MAPPING ──────────────────────────────────

/**
 * Map a map zoom level to appropriate H3 resolution.
 * Used by the frontend to show hexes at the right granularity.
 *
 * @param {number} zoom - Map zoom (0-22)
 * @returns {number} H3 resolution (4-9)
 */
const zoomToResolution = (zoom) => {
    if (zoom >= 15) return RES.BLOCK;        // 9 — very close, street level
    if (zoom >= 13) return RES.NEIGHBORHOOD; // 8 — neighborhood
    if (zoom >= 10) return RES.ZONE;         // 7 — zone (default)
    if (zoom >= 7)  return RES.METRO;        // 5 — metro
    return RES.REGION;                        // 4 — region
};

/**
 * Get the recommended edge length (km) for a resolution
 */
const hexEdgeKm = (resolution) => {
    const edges = {
        4: 22.6, 5: 8.54, 6: 3.23, 7: 1.22, 8: 0.461, 9: 0.174
    };
    return edges[resolution] || 1.22;
};

/**
 * Get area (km²) of a single hex at a resolution
 */
const hexAreaKm2 = (resolution) => {
    const areas = {
        4: 1770.3, 5: 252.9, 6: 36.13, 7: 5.161, 8: 0.737, 9: 0.105
    };
    return areas[resolution] || 5.161;
};

// ─── EXPORTS ──────────────────────────────────────────────────────

module.exports = {
    // Constants
    RES,
    DEFAULT_RES,

    // Core conversions
    coordsToHex,
    hexToCoords,
    hexBoundary,
    hexToGeoJSON,
    hexResolution,
    isValidHex,

    // Spatial queries
    hexDisk,
    hexRing,
    hexFillBBox,
    hexPath,
    areNeighbors,
    hexDistance,

    // Hierarchy
    hexParent,
    hexChildren,

    // Area coverage
    coverServiceArea,
    hexInArea,

    // Ride classification
    classifyRideHex,

    // Display helpers
    zoomToResolution,
    hexEdgeKm,
    hexAreaKm2,
};
