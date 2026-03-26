/**
 * ═══════════════════════════════════════════════════════════════════
 *  HEX ZONE ALLOCATOR — Multi-Zone Territory Assignment System
 *  DeckGL + MapLibre + H3HexagonLayer
 *
 *  Allocate multiple H3 hex zones to an employee as their territory.
 *  Paint mode, bulk area select, role assignment (Primary/Backup/Escalation),
 *  jurisdiction config, cross-area corridor detection, undo stack.
 *  3,726 hexes · 10 service areas · Resolution 7 (~5.16 km² each)
 * ═══════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map as MapGL } from 'react-map-gl/maplibre';
import { DeckGL } from '@deck.gl/react';
import { FlyToInterpolator } from '@deck.gl/core';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer, TextLayer } from '@deck.gl/layers';
import { latLngToCell, cellToLatLng, polygonToCells } from 'h3-js';
import adminService from '../../services/adminService';

// ─── VIEWPORT HEX GENERATION ──────────────────────────────────

/** Map zoom → H3 resolution for viewport hex fill */
const viewportZoomToRes = (zoom) => {
  if (zoom >= 14) return 9;   // ~0.105 km²
  if (zoom >= 12) return 8;   // ~0.74 km²
  if (zoom >= 9)  return 7;   // ~5.16 km²  (default zone)
  if (zoom >= 6)  return 5;   // ~252 km²
  if (zoom >= 4)  return 4;   // ~1,770 km²
  if (zoom >= 2)  return 3;   // ~12,392 km²
  return 2;                    // ~86,745 km²
};

/** Max hexes we allow per viewport to keep rendering smooth */
const MAX_VIEWPORT_HEXES = 60000;

/**
 * Compute all H3 hexes visible in the current viewport bounding box.
 * Returns hex IDs at the given resolution. Falls back to coarser resolution
 * if the count would exceed MAX_VIEWPORT_HEXES.
 */
const computeViewportHexes = (bounds, zoom) => {
  if (!bounds) return { hexes: [], resolution: 7 };

  const { west, south, east, north } = bounds;
  let res = viewportZoomToRes(zoom);

  // Build a polygon ring [[lat,lng], ...] — h3 expects [lat, lng] order
  const ring = [
    [south, west],
    [south, east],
    [north, east],
    [north, west],
    [south, west], // close the ring
  ];

  // Try at the target resolution; step down if too many hexes
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const cells = polygonToCells(ring, res);
      if (cells.length <= MAX_VIEWPORT_HEXES) {
        return { hexes: cells, resolution: res };
      }
      res = Math.max(0, res - 1); // coarser
    } catch {
      res = Math.max(0, res - 1);
    }
  }
  return { hexes: [], resolution: res };
};


// ─── CONSTANTS ────────────────────────────────────────────────────

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const DEFAULT_VIEW = {
  longitude: 80.2707, latitude: 13.0827,
  zoom: 10, pitch: 40, bearing: -15,
  maxZoom: 18, minZoom: 4,
};

const TRANSITION_MS = 1200;

const parseColor = (hex) => {
  if (!hex) return [100, 100, 100];
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
};

const ZONE_ROLES = {
  PRIMARY: { fill: [16, 185, 129], border: [255, 255, 255], label: 'Primary', icon: 'fa-star', color: '#10b981' },
  BACKUP: { fill: [59, 130, 246], border: [147, 197, 253], label: 'Backup', icon: 'fa-shield-halved', color: '#3b82f6' },
  ESCALATION: { fill: [249, 115, 22], border: [253, 186, 116], label: 'Escalation', icon: 'fa-arrow-up', color: '#f97316' },
};

const JURISDICTION_TYPES = [
  { value: 'ZONE', label: 'Zone', desc: 'Specific hex zones only', icon: 'fa-hexagon-nodes' },
  { value: 'METRO', label: 'Metro', desc: 'Metro-wide (~252 km²)', icon: 'fa-city' },
  { value: 'REGION', label: 'Region', desc: 'Multiple metros combined', icon: 'fa-map' },
  { value: 'GLOBAL', label: 'Global', desc: 'All service areas', icon: 'fa-globe' },
];

const COVERAGE_MODES = [
  { value: 'EXCLUSIVE', label: 'Exclusive', desc: 'Sole owner', icon: 'fa-lock' },
  { value: 'SHARED', label: 'Shared', desc: 'Team overlap', icon: 'fa-users' },
  { value: 'BACKUP', label: 'Backup', desc: 'Fallback only', icon: 'fa-shield' },
];

// ─── MAIN COMPONENT ──────────────────────────────────────────────

export default function HexMapPicker({
  open,
  onClose,
  onConfirm,
  serviceAreas,
  initialCoords,
  existingZones = [],
  employeeName = '',
}) {
  // ── View ──
  const [viewState, setViewState] = useState(() => {
    if (initialCoords?.length === 2) {
      return { ...DEFAULT_VIEW, longitude: initialCoords[0], latitude: initialCoords[1], zoom: 12 };
    }
    return DEFAULT_VIEW;
  });

  // ── Data ──
  const [serviceHexData, setServiceHexData] = useState([]);  // hexes from API (service areas only)
  const [hexData, setHexData] = useState([]);                // ALL hexes (viewport + service areas merged)
  const [zoneAllocationMap, setZoneAllocationMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentRes, setCurrentRes] = useState(7);

  // ── Selection: Map<hexId, role> ──
  const [selectedZones, setSelectedZones] = useState(() => new Map());
  const [undoStack, setUndoStack] = useState([]);

  // ── Tools ──
  const [paintMode, setPaintMode] = useState(false);
  const [paintAction, setPaintAction] = useState('add');
  const [activeRole, setActiveRole] = useState('PRIMARY');
  const isPaintingRef = useRef(false);

  // ── Jurisdiction config ──
  const [jurisdictionType, setJurisdictionType] = useState('ZONE');
  const [coverageMode, setCoverageMode] = useState('SHARED');
  const [autoExpand, setAutoExpand] = useState(false);

  // ── UI ──
  const [hoverInfo, setHoverInfo] = useState(null);
  const [sideTab, setSideTab] = useState('zones');

  // ═══════════════ DERIVED DATA ═══════════════════════════════════

  const hexDataMap = useMemo(() => {
    const m = {};
    hexData.forEach(h => { m[h.hex] = h; });
    return m;
  }, [hexData]);

  const areaStats = useMemo(() => {
    const stats = {};
    hexData.forEach(h => {
      if (h.area === '__viewport__') return; // skip unserviced viewport hexes
      if (!stats[h.area]) stats[h.area] = { total: 0, name: h.name, color: h.color, selected: 0, assigned: 0 };
      stats[h.area].total++;
      if (selectedZones.has(h.hex)) stats[h.area].selected++;
      if (zoneAllocationMap[h.hex]) stats[h.area].assigned += zoneAllocationMap[h.hex].count;
    });
    return stats;
  }, [hexData, selectedZones, zoneAllocationMap]);

  const selectionSummary = useMemo(() => {
    const byRole = { PRIMARY: 0, BACKUP: 0, ESCALATION: 0 };
    const byArea = {};
    selectedZones.forEach((role, hex) => {
      byRole[role] = (byRole[role] || 0) + 1;
      const info = hexDataMap[hex];
      if (info && info.area !== '__viewport__') {
        if (!byArea[info.area]) byArea[info.area] = { count: 0, name: info.name, color: info.color };
        byArea[info.area].count++;
      }
    });
    return {
      count: selectedZones.size,
      coverageKm2: (selectedZones.size * 5.16).toFixed(1),
      byRole,
      byArea,
      areaCount: Object.keys(byArea).length,
    };
  }, [selectedZones, hexDataMap]);

  const detectedCorridors = useMemo(() => {
    const areas = new Set();
    selectedZones.forEach((_, hex) => {
      const info = hexDataMap[hex];
      if (info && info.area !== '__viewport__') areas.add(info.area);
    });
    const list = [...areas];
    const corrs = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        corrs.push({ fromArea: list[i], toArea: list[j] });
      }
    }
    return corrs;
  }, [selectedZones, hexDataMap]);

  const centroid = useMemo(() => {
    if (selectedZones.size === 0) return null;
    let sLat = 0, sLng = 0, n = 0;
    selectedZones.forEach((_, hex) => {
      try { const [lat, lng] = cellToLatLng(hex); sLat += lat; sLng += lng; n++; } catch { /* skip */ }
    });
    return n > 0 ? [sLng / n, sLat / n] : null;
  }, [selectedZones]);

  const primaryArea = useMemo(() => {
    const counts = {};
    selectedZones.forEach((_, hex) => {
      const info = hexDataMap[hex];
      if (info) counts[info.area] = (counts[info.area] || 0) + 1;
    });
    let best = null, max = 0;
    for (const [a, c] of Object.entries(counts)) { if (c > max) { max = c; best = a; } }
    return best;
  }, [selectedZones, hexDataMap]);

  // ═══════════════ DATA FETCHING ══════════════════════════════════

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await adminService.getHexCoverage();
        if (!cancelled && res.success) {
          setServiceHexData(res.hexData || []);
          setZoneAllocationMap(res.zoneAllocationMap || {});
        }
      } catch (err) {
        console.error('Hex coverage load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  // ═══════════════ VIEWPORT HEX GENERATION ═══════════════════════
  // Dynamically generate hexes for the entire visible viewport.
  // Service-area hexes retain their color; others get a neutral tint.

  const viewportTimerRef = useRef(null);

  // Build a lookup from service hex data
  const serviceHexLookup = useMemo(() => {
    const map = {};
    serviceHexData.forEach(h => { map[h.hex] = h; });
    return map;
  }, [serviceHexData]);

  // When the viewport (or service data) changes, recompute full hex coverage
  useEffect(() => {
    if (!open || loading) return;

    // Debounce so we don't recompute on every frame during pan/zoom
    clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(() => {
      // Approximate viewport bounds from viewState (DeckGL WebMercator)
      const { longitude, latitude, zoom } = viewState;

      // Rough bounds from center + zoom (degrees visible ≈ 360 / 2^zoom)
      const degSpan = 360 / Math.pow(2, zoom);
      const latSpan = degSpan * 0.5; // vertical is roughly half
      const bounds = {
        west:  longitude - degSpan / 2,
        east:  longitude + degSpan / 2,
        south: latitude  - latSpan / 2,
        north: latitude  + latSpan / 2,
      };

      const { hexes: vpHexes, resolution } = computeViewportHexes(bounds, zoom);
      setCurrentRes(resolution);

      // Merge: viewport hexes + service area info
      const merged = [];
      const seen = new Set();

      // If viewport resolution matches service data resolution (7), we can
      // directly cross-reference. Otherwise viewport hex IDs differ.
      const useServiceLookup = resolution === 7;

      for (const hex of vpHexes) {
        if (seen.has(hex)) continue;
        seen.add(hex);

        const svc = useServiceLookup ? serviceHexLookup[hex] : null;
        if (svc) {
          merged.push(svc);
        } else {
          merged.push({
            hex,
            area: '__viewport__',
            name: 'Unserviced',
            color: '#1e293b',   // neutral dark slate
            zone: null,
          });
        }
      }

      // Also ensure ALL service hexes are present (even if outside viewport)
      // so that existing selections referencing them still work
      if (useServiceLookup) {
        for (const sh of serviceHexData) {
          if (!seen.has(sh.hex)) {
            merged.push(sh);
            seen.add(sh.hex);
          }
        }
      }

      setHexData(merged);
    }, 250); // 250ms debounce

    return () => clearTimeout(viewportTimerRef.current);
  }, [open, loading, viewState.longitude, viewState.latitude, viewState.zoom, serviceHexData, serviceHexLookup]);

  // Load existing zones when editing
  useEffect(() => {
    if (!open) return;
    if (existingZones?.length > 0) {
      const m = new Map();
      existingZones.forEach(z => {
        const hex = typeof z === 'string' ? z : z.hex;
        const role = (typeof z === 'object' && z.role) || 'PRIMARY';
        if (hex) m.set(hex, role);
      });
      setSelectedZones(m);
    } else {
      setSelectedZones(new Map());
    }
    setUndoStack([]);
    setPaintMode(false);
    setSideTab('zones');
    setJurisdictionType('ZONE');
    setCoverageMode('SHARED');
    setAutoExpand(false);
  }, [open, existingZones]);

  useEffect(() => {
    if (open && initialCoords?.length === 2) {
      setViewState(prev => ({
        ...prev,
        longitude: initialCoords[0],
        latitude: initialCoords[1],
        zoom: 12,
        transitionDuration: TRANSITION_MS,
        transitionInterpolator: new FlyToInterpolator(),
      }));
    }
  }, [open, initialCoords]);

  // ═══════════════ ZONE ACTIONS ═══════════════════════════════════

  const pushUndo = useCallback(() => {
    setUndoStack(s => [...s.slice(-29), new Map(selectedZones)]);
  }, [selectedZones]);

  const toggleHex = useCallback((hex) => {
    pushUndo();
    setSelectedZones(prev => {
      const next = new Map(prev);
      next.has(hex) ? next.delete(hex) : next.set(hex, activeRole);
      return next;
    });
  }, [pushUndo, activeRole]);

  const addHex = useCallback((hex) => {
    setSelectedZones(prev => {
      if (prev.has(hex)) return prev;
      const next = new Map(prev);
      next.set(hex, activeRole);
      return next;
    });
  }, [activeRole]);

  const removeHex = useCallback((hex) => {
    setSelectedZones(prev => {
      if (!prev.has(hex)) return prev;
      const next = new Map(prev);
      next.delete(hex);
      return next;
    });
  }, []);

  const selectAllInArea = useCallback((areaKey) => {
    pushUndo();
    setSelectedZones(prev => {
      const next = new Map(prev);
      hexData.forEach(h => { if (h.area === areaKey) next.set(h.hex, activeRole); });
      return next;
    });
  }, [hexData, pushUndo, activeRole]);

  const deselectAllInArea = useCallback((areaKey) => {
    pushUndo();
    setSelectedZones(prev => {
      const next = new Map(prev);
      hexData.forEach(h => { if (h.area === areaKey) next.delete(h.hex); });
      return next;
    });
  }, [hexData, pushUndo]);

  const clearAll = useCallback(() => { pushUndo(); setSelectedZones(new Map()); }, [pushUndo]);

  const undo = useCallback(() => {
    setUndoStack(s => {
      if (!s.length) return s;
      setSelectedZones(s[s.length - 1]);
      return s.slice(0, -1);
    });
  }, []);

  const setRoleForAll = useCallback((role) => {
    pushUndo();
    setSelectedZones(prev => {
      const next = new Map();
      prev.forEach((_, hex) => next.set(hex, role));
      return next;
    });
  }, [pushUndo]);

  const setRoleForHex = useCallback((hex, role) => {
    setSelectedZones(prev => {
      const next = new Map(prev);
      if (next.has(hex)) next.set(hex, role);
      return next;
    });
  }, []);

  // ═══════════════ MAP INTERACTION ════════════════════════════════

  const flyToCity = useCallback((areaKey) => {
    const area = serviceAreas?.[areaKey];
    if (!area) return;
    setViewState(prev => ({
      ...prev,
      longitude: area.center[0],
      latitude: area.center[1],
      zoom: 11,
      transitionDuration: TRANSITION_MS,
      transitionInterpolator: new FlyToInterpolator(),
    }));
  }, [serviceAreas]);

  const handleHexClick = useCallback((info) => {
    if (info.object?.hex) toggleHex(info.object.hex);
  }, [toggleHex]);

  const handleMapClick = useCallback((info) => {
    if (info.layer) return;
    if (!info.coordinate) return;
    const [lng, lat] = info.coordinate;
    // Use current viewport resolution so clicks work at any zoom
    const hex = latLngToCell(lat, lng, currentRes);
    if (hexDataMap[hex]) toggleHex(hex);
  }, [hexDataMap, toggleHex, currentRes]);

  const handleHover = useCallback((info) => {
    if (info.object?.hex) {
      setHoverInfo({ x: info.x, y: info.y, object: info.object });
      if (isPaintingRef.current && paintMode) {
        paintAction === 'add' ? addHex(info.object.hex) : removeHex(info.object.hex);
      }
    } else if (info.object?.isOffice) {
      setHoverInfo({ x: info.x, y: info.y, object: info.object });
    } else {
      setHoverInfo(null);
    }
  }, [paintMode, paintAction, addHex, removeHex]);

  const handleMouseDown = useCallback(() => { if (paintMode) isPaintingRef.current = true; }, [paintMode]);
  const handleMouseUp = useCallback(() => {
    if (isPaintingRef.current) { isPaintingRef.current = false; pushUndo(); }
  }, [pushUndo]);

  // ═══════════════ DECK.GL LAYERS ═════════════════════════════════

  const layers = useMemo(() => {
    const result = [];
    const selSet = selectedZones;

    // 1. All 3,726 hex zones
    if (hexData.length > 0) {
      result.push(new H3HexagonLayer({
        id: 'hex-zones',
        data: hexData,
        getHexagon: d => d.hex,
        getFillColor: d => {
          const rgb = parseColor(d.color);
          const isSelected = selSet.has(d.hex);
          if (isSelected) {
            const rc = ZONE_ROLES[selSet.get(d.hex)] || ZONE_ROLES.PRIMARY;
            return [...rc.fill, 160];
          }
          const alloc = zoneAllocationMap[d.hex];
          if (alloc) return [...rgb, Math.min(50 + alloc.count * 25, 110)];
          return [...rgb, 22];
        },
        getLineColor: d => {
          if (selSet.has(d.hex)) return [255, 255, 255, 80];
          const rgb = parseColor(d.color);
          return [...rgb, 35];
        },
        lineWidthMinPixels: 1,
        extruded: false,
        filled: true,
        stroked: true,
        pickable: true,
        autoHighlight: true,
        highlightColor: [255, 255, 255, 40],
        onHover: handleHover,
        onClick: handleHexClick,
        updateTriggers: {
          getFillColor: [selectedZones, zoneAllocationMap],
          getLineColor: [selectedZones],
        },
      }));
    }

    // 2. Selected hex bright borders
    const selArr = [];
    selSet.forEach((role, hex) => {
      const info = hexDataMap[hex];
      if (info) selArr.push({ hex, role, color: info.color });
    });
    if (selArr.length > 0) {
      result.push(new H3HexagonLayer({
        id: 'selected-borders',
        data: selArr,
        getHexagon: d => d.hex,
        getFillColor: [0, 0, 0, 0],
        getLineColor: d => {
          const rc = ZONE_ROLES[d.role] || ZONE_ROLES.PRIMARY;
          return [...rc.border, 240];
        },
        lineWidthMinPixels: 3,
        extruded: false,
        filled: false,
        stroked: true,
        pickable: false,
        updateTriggers: { getLineColor: [selectedZones] },
      }));
    }

    // 3. Office markers
    const offices = [];
    if (serviceAreas) {
      Object.entries(serviceAreas).forEach(([key, area]) => {
        (area.offices || []).forEach(off => {
          if (off.coordinates) {
            offices.push({ position: off.coordinates, name: off.name, area: area.name, areaKey: key, color: area.color, isOffice: true });
          }
        });
      });
    }
    if (offices.length > 0) {
      result.push(new ScatterplotLayer({
        id: 'office-dots',
        data: offices,
        getPosition: d => d.position,
        getFillColor: d => [...parseColor(d.color), 220],
        getLineColor: [255, 255, 255, 200],
        getRadius: 500,
        radiusMinPixels: 4,
        radiusMaxPixels: 16,
        stroked: true,
        lineWidthMinPixels: 2,
        pickable: true,
        onHover: info => { if (info.object) setHoverInfo({ x: info.x, y: info.y, object: { ...info.object, isOffice: true } }); },
      }));
      if (viewState.zoom >= 11) {
        result.push(new TextLayer({
          id: 'office-labels',
          data: offices,
          getPosition: d => d.position,
          getText: d => d.name,
          getSize: 11,
          getColor: [255, 255, 255, 190],
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'top',
          getPixelOffset: [0, 14],
          fontFamily: 'Inter, system-ui, sans-serif',
          fontWeight: 600,
        }));
      }
    }

    return result;
  }, [hexData, selectedZones, zoneAllocationMap, serviceAreas, viewState.zoom, hexDataMap, handleHover, handleHexClick]);

  // ═══════════════ CONFIRM ════════════════════════════════════════

  const handleConfirm = useCallback(() => {
    if (selectedZones.size === 0) return;
    const zones = [];
    selectedZones.forEach((role, hex) => zones.push({ hex, role }));
    onConfirm({
      assignedZones: zones,
      jurisdictionType,
      jurisdictionCoverage: coverageMode,
      autoExpand,
      crossAreaCorridors: detectedCorridors,
      coordinates: centroid,
      h3Index: centroid ? latLngToCell(centroid[1], centroid[0], 7) : null,
      areaKey: primaryArea,
      areaName: primaryArea && serviceAreas?.[primaryArea]?.name,
    });
    onClose();
  }, [selectedZones, jurisdictionType, coverageMode, autoExpand, detectedCorridors, centroid, primaryArea, serviceAreas, onConfirm, onClose]);

  if (!open) return null;

  // ═══════════════════════════════════════════════════════════════
  //  R E N D E R
  // ═══════════════════════════════════════════════════════════════

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/90 flex">

        {/* ═══════ MAP ═══════ */}
        <div className="flex-1 relative" onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>

          {loading && (
            <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-3" />
                <p className="text-white/80 text-sm font-medium">Loading hex grid...</p>
                <p className="text-white/40 text-xs mt-1">Loading global hex grid...</p>
              </div>
            </div>
          )}

          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState: vs }) => setViewState(vs)}
            layers={layers}
            onClick={handleMapClick}
            controller={paintMode ? { dragPan: false, dragRotate: false, scrollZoom: true, keyboard: false } : { dragRotate: true, touchRotate: true }}
            getCursor={({ isHovering }) => paintMode ? (paintAction === 'add' ? 'cell' : 'not-allowed') : (isHovering ? 'pointer' : 'crosshair')}
          >
            <MapGL mapStyle={MAP_STYLE} />
          </DeckGL>

          {/* Hover tooltip */}
          {hoverInfo && (
            <div className="absolute pointer-events-none z-30 bg-gray-900/95 text-white px-3 py-2 rounded-lg shadow-xl text-xs max-w-[280px] backdrop-blur-sm border border-white/10"
              style={{ left: hoverInfo.x + 14, top: hoverInfo.y - 14 }}>
              {hoverInfo.object.isOffice ? (
                <>
                  <div className="font-bold">{hoverInfo.object.name}</div>
                  <div className="text-white/40 text-[10px]">{hoverInfo.object.area} Office</div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: hoverInfo.object.color }} />
                    <span className="font-semibold">{hoverInfo.object.name}</span>
                  </div>
                  <div className="font-mono text-[9px] text-white/30 mt-0.5">{hoverInfo.object.hex}</div>
                  <div className="flex items-center gap-3 mt-1 text-[10px]">
                    {selectedZones.has(hoverInfo.object.hex) ? (
                      <span className="text-emerald-400 font-semibold"><i className="fas fa-check-circle text-[8px] mr-0.5" /> Selected · {selectedZones.get(hoverInfo.object.hex)}</span>
                    ) : (
                      <span className="text-white/30">{paintMode ? (paintAction === 'add' ? 'Drag to paint' : 'Drag to erase') : 'Click to toggle'}</span>
                    )}
                    {zoneAllocationMap[hoverInfo.object.hex] && (
                      <span className="text-amber-400/80"><i className="fas fa-users text-[8px] mr-0.5" />{zoneAllocationMap[hoverInfo.object.hex].count} assigned</span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Title bar */}
          <div className="absolute top-4 left-4 z-20">
            <div className="bg-gray-900/95 text-white px-5 py-3 rounded-xl backdrop-blur-sm border border-white/10 shadow-2xl">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                <i className="fas fa-hexagon-nodes text-emerald-400" />
                Zone Allocator
                {employeeName && <span className="text-white/30 text-sm font-normal ml-1">— {employeeName}</span>}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-xs">
                <span className="text-emerald-400/80">
                  <i className="fas fa-hexagon-check mr-1" />{selectedZones.size} zones · {selectionSummary.coverageKm2} km²
                </span>
                {selectionSummary.areaCount > 1 && (
                  <span className="text-amber-400/70 text-[10px]"><i className="fas fa-route mr-0.5" />{selectionSummary.areaCount} areas</span>
                )}
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
            {/* Mode switcher */}
            <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl border border-white/10 flex items-center p-1 gap-0.5 shadow-xl">
              <button onClick={() => setPaintMode(false)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${!paintMode ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/70'}`}>
                <i className="fas fa-mouse-pointer text-[10px]" /> Click
              </button>
              <button onClick={() => { setPaintMode(true); setPaintAction('add'); }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${paintMode && paintAction === 'add' ? 'bg-emerald-600 text-white' : 'text-white/40 hover:text-white/70'}`}>
                <i className="fas fa-paintbrush text-[10px]" /> Paint
              </button>
              <button onClick={() => { setPaintMode(true); setPaintAction('remove'); }}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${paintMode && paintAction === 'remove' ? 'bg-red-600 text-white' : 'text-white/40 hover:text-white/70'}`}>
                <i className="fas fa-eraser text-[10px]" /> Erase
              </button>
              <div className="w-px h-5 bg-white/10 mx-0.5" />
              <button onClick={undo} disabled={!undoStack.length}
                className="px-2 py-2 rounded-lg text-xs text-white/40 hover:text-white/70 transition disabled:opacity-20" title="Undo">
                <i className="fas fa-undo" />
              </button>
              <button onClick={clearAll} disabled={!selectedZones.size}
                className="px-2 py-2 rounded-lg text-xs text-white/40 hover:text-red-400 transition disabled:opacity-20" title="Clear all">
                <i className="fas fa-trash" />
              </button>
            </div>

            {/* Role selector */}
            <div className="bg-gray-900/95 backdrop-blur-sm rounded-xl border border-white/10 flex items-center p-1 gap-0.5 shadow-xl">
              {Object.entries(ZONE_ROLES).map(([role, rc]) => (
                <button key={role} onClick={() => setActiveRole(role)}
                  className={`px-2.5 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1 ${activeRole === role ? 'text-white' : 'text-white/25 hover:text-white/50'}`}
                  style={activeRole === role ? { backgroundColor: `${rc.color}30`, color: rc.color } : {}}>
                  <i className={`fas ${rc.icon} text-[8px]`} /> {rc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Close */}
          <button onClick={onClose}
            className="absolute top-4 right-4 z-20 w-10 h-10 bg-gray-900/80 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition backdrop-blur-sm border border-white/10">
            <i className="fas fa-times" />
          </button>

          {/* Bottom info */}
          <div className="absolute bottom-4 left-4 z-20 bg-gray-900/90 text-white px-3 py-2 rounded-lg text-[10px] backdrop-blur-sm border border-white/10">
            <span className="text-white/40">Zoom {viewState.zoom.toFixed(1)} · Allocation at R{currentRes} (~{currentRes === 7 ? '5.16' : currentRes === 5 ? '252' : currentRes === 4 ? '1,770' : currentRes === 8 ? '0.74' : currentRes === 9 ? '0.105' : currentRes === 3 ? '12,392' : '86,745'} km² per hex)</span>
            <span className="text-white/25 ml-2">{hexData.length.toLocaleString()} hexes</span>
            {paintMode && <span className="ml-2 text-emerald-400 font-semibold">Paint: {paintAction === 'add' ? 'Adding' : 'Erasing'}</span>}
          </div>
        </div>

        {/* ═══════ SIDE PANEL ═══════ */}
        <motion.div initial={{ x: 420 }} animate={{ x: 0 }} exit={{ x: 420 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-[400px] bg-gray-950 text-white flex flex-col overflow-hidden border-l border-white/10">

          {/* Header */}
          <div className="p-4 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white/90 uppercase tracking-wider flex items-center gap-2">
                <i className="fas fa-map-location-dot text-emerald-400" /> Territory Allocation
              </h3>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 font-bold text-[11px]">
                {selectedZones.size} zones
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/10 flex-shrink-0">
            {[
              { key: 'zones', label: 'Areas', icon: 'fa-layer-group' },
              { key: 'config', label: 'Jurisdiction', icon: 'fa-sliders' },
              { key: 'list', label: 'Selected', icon: 'fa-list-check' },
            ].map(t => (
              <button key={t.key} onClick={() => setSideTab(t.key)}
                className={`flex-1 px-3 py-2.5 text-xs font-semibold transition flex items-center justify-center gap-1.5 border-b-2 ${sideTab === t.key ? 'text-emerald-400 border-emerald-400 bg-emerald-500/5' : 'text-white/40 border-transparent hover:text-white/60'}`}>
                <i className={`fas ${t.icon} text-[10px]`} /> {t.label}
              </button>
            ))}
          </div>

          {/* ── PANEL CONTENT ── */}
          <div className="flex-1 overflow-y-auto">

            {/* ──────── TAB: Areas ──────── */}
            {sideTab === 'zones' && (
              <div className="p-3 space-y-3">
                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                    <div className="text-xl font-bold text-emerald-400">{selectedZones.size}</div>
                    <div className="text-[9px] text-white/40 uppercase tracking-wider">Zones</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                    <div className="text-xl font-bold text-blue-400">{selectionSummary.coverageKm2}</div>
                    <div className="text-[9px] text-white/40 uppercase tracking-wider">km²</div>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
                    <div className="text-xl font-bold text-amber-400">{selectionSummary.areaCount}</div>
                    <div className="text-[9px] text-white/40 uppercase tracking-wider">Areas</div>
                  </div>
                </div>

                {/* Role breakdown */}
                {selectedZones.size > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {Object.entries(selectionSummary.byRole).filter(([, c]) => c > 0).map(([role, count]) => (
                      <span key={role} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold"
                        style={{ backgroundColor: `${ZONE_ROLES[role].color}20`, color: ZONE_ROLES[role].color }}>
                        <i className={`fas ${ZONE_ROLES[role].icon} text-[8px]`} />{count} {role.toLowerCase()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Area cards */}
                <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold">Service Areas</div>
                {serviceAreas && Object.entries(serviceAreas).map(([key, area]) => {
                  const st = areaStats[key] || { total: 0, selected: 0 };
                  const allSelected = st.selected === st.total && st.total > 0;
                  const partial = st.selected > 0 && st.selected < st.total;
                  const pct = st.total > 0 ? (st.selected / st.total * 100) : 0;

                  return (
                    <div key={key} className="bg-white/[.04] rounded-xl p-3 hover:bg-white/[.07] transition" style={{ borderLeft: `3px solid ${area.color}` }}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <button onClick={() => flyToCity(key)} className="text-sm font-bold text-white/90 hover:text-white transition truncate" title="Fly to city">
                            {area.name}
                          </button>
                          <span className="text-[9px] text-white/25 flex-shrink-0">{st.total}</span>
                          {partial && <span className="text-[10px] text-emerald-400 font-bold flex-shrink-0">{st.selected} sel</span>}
                        </div>
                        <button onClick={() => allSelected ? deselectAllInArea(key) : selectAllInArea(key)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex-shrink-0 ${allSelected ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'}`}>
                          {allSelected ? <><i className="fas fa-times mr-0.5" /> Deselect</> : <><i className="fas fa-check-double mr-0.5" /> Select All</>}
                        </button>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500 ease-out" style={{ width: `${pct}%`, backgroundColor: area.color }} />
                      </div>
                    </div>
                  );
                })}

                {/* Cross-area corridors */}
                {detectedCorridors.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
                      <i className="fas fa-route text-amber-400" /> Cross-Area Corridors Detected
                    </div>
                    <div className="bg-amber-500/10 rounded-xl p-3 space-y-2 border border-amber-500/20">
                      <p className="text-[10px] text-amber-400/80 leading-relaxed">
                        This employee monitors rides traveling between these areas — seamless handoff coverage.
                      </p>
                      {detectedCorridors.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs bg-white/5 rounded-lg px-2.5 py-1.5">
                          <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: serviceAreas?.[c.fromArea]?.color }} />
                          <span className="text-white/80 font-medium">{serviceAreas?.[c.fromArea]?.name || c.fromArea}</span>
                          <i className="fas fa-arrow-right-arrow-left text-[9px] text-amber-400/50" />
                          <span className="text-white/80 font-medium">{serviceAreas?.[c.toArea]?.name || c.toArea}</span>
                          <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: serviceAreas?.[c.toArea]?.color }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ──────── TAB: Jurisdiction ──────── */}
            {sideTab === 'config' && (
              <div className="p-4 space-y-5">
                {/* Type */}
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-2 block">Jurisdiction Scope</label>
                  <div className="space-y-1.5">
                    {JURISDICTION_TYPES.map(jt => (
                      <button key={jt.value} onClick={() => setJurisdictionType(jt.value)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs transition flex items-center gap-3 ${jurisdictionType === jt.value ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-white/[.04] text-white/50 hover:bg-white/[.08] border border-transparent'}`}>
                        <i className={`fas ${jt.icon} text-sm w-5 text-center`} />
                        <div className="flex-1">
                          <div className="font-bold">{jt.label}</div>
                          <div className="text-[10px] opacity-60">{jt.desc}</div>
                        </div>
                        {jurisdictionType === jt.value && <i className="fas fa-check text-sm" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Coverage */}
                <div>
                  <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-2 block">Coverage Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {COVERAGE_MODES.map(cm => (
                      <button key={cm.value} onClick={() => setCoverageMode(cm.value)}
                        className={`px-2 py-3 rounded-xl text-center text-xs transition ${coverageMode === cm.value ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-white/[.04] text-white/40 hover:bg-white/[.08] border border-transparent'}`}>
                        <i className={`fas ${cm.icon} text-lg mb-1.5 block`} />
                        <div className="font-bold">{cm.label}</div>
                        <div className="text-[9px] opacity-50 mt-0.5">{cm.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto expand */}
                <div className="flex items-center justify-between bg-white/[.04] rounded-xl p-3.5 cursor-pointer hover:bg-white/[.07] transition"
                  onClick={() => setAutoExpand(v => !v)}>
                  <div>
                    <div className="text-xs font-bold text-white/80">Auto-Expand Zones</div>
                    <div className="text-[10px] text-white/40 mt-0.5">Cover neighboring unassigned hexes during demand surges</div>
                  </div>
                  <div className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ml-3 flex items-center ${autoExpand ? 'bg-emerald-500' : 'bg-white/15'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${autoExpand ? 'translate-x-[22px]' : 'translate-x-[2px]'}`} />
                  </div>
                </div>

                {/* Bulk role reassign */}
                {selectedZones.size > 0 && (
                  <div>
                    <label className="text-[10px] text-white/40 uppercase tracking-wider font-bold mb-2 block">Bulk Role Change</label>
                    <p className="text-[10px] text-white/25 mb-2">Change all <span className="text-white/60 font-bold">{selectedZones.size}</span> zones to:</p>
                    <div className="flex gap-2">
                      {Object.entries(ZONE_ROLES).map(([role, rc]) => (
                        <button key={role} onClick={() => setRoleForAll(role)}
                          className="flex-1 px-2 py-2.5 rounded-xl text-[10px] font-bold text-center transition hover:scale-105 active:scale-95"
                          style={{ backgroundColor: `${rc.color}15`, color: rc.color, border: `1px solid ${rc.color}25` }}>
                          <i className={`fas ${rc.icon} block text-sm mb-1`} />{rc.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Edge case guide */}
                <div className="bg-blue-500/10 rounded-xl p-3 border border-blue-500/15">
                  <div className="text-[10px] text-blue-400/80 font-bold mb-1.5 flex items-center gap-1.5">
                    <i className="fas fa-circle-info" /> Zone Allocation Guide
                  </div>
                  <ul className="text-[10px] text-white/40 space-y-1 leading-relaxed">
                    <li><strong className="text-white/60">Primary:</strong> All rides, alerts, tickets in zone route here first.</li>
                    <li><strong className="text-white/60">Backup:</strong> Takes over when primary is offline or at capacity.</li>
                    <li><strong className="text-white/60">Escalation:</strong> Cross-area rides and unresolved issues escalate here.</li>
                    <li><strong className="text-white/60">Cross-Area:</strong> Rider starts in Zone A, ends in Zone B — both managers see the ride.</li>
                    <li><strong className="text-white/60">Auto-Expand:</strong> Auto-cover neighbor hexes during demand surges.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* ──────── TAB: Selected List ──────── */}
            {sideTab === 'list' && (
              <div className="p-3">
                {selectedZones.size === 0 ? (
                  <div className="text-center py-16">
                    <i className="fas fa-hexagon-nodes text-5xl text-white/[.07] mb-4" />
                    <p className="text-white/25 text-sm font-medium">No zones allocated</p>
                    <p className="text-white/15 text-xs mt-1">Click hexes on the map or use "Select All" on an area</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="text-[10px] text-white/25 mb-2">{selectedZones.size} zones across {selectionSummary.areaCount} area{selectionSummary.areaCount !== 1 ? 's' : ''}</div>
                    {Object.entries(selectionSummary.byArea).map(([area, info]) => (
                      <div key={area} className="mb-3">
                        <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-gray-950 py-1 z-10">
                          <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: info.color }} />
                          <span className="text-xs font-bold text-white/70">{info.name}</span>
                          <span className="text-[9px] text-white/25 bg-white/5 px-1.5 py-0.5 rounded">{info.count}</span>
                          <button onClick={() => deselectAllInArea(area)}
                            className="ml-auto text-[9px] text-red-400/50 hover:text-red-400 transition font-medium">
                            Remove all
                          </button>
                        </div>
                        {[...selectedZones.entries()]
                          .filter(([hex]) => hexDataMap[hex]?.area === area)
                          .map(([hex, role]) => (
                            <div key={hex} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition group text-[10px]">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ZONE_ROLES[role]?.color }} />
                              <span className="font-mono text-white/40 flex-1 truncate text-[9px]">{hex}</span>
                              <select value={role} onChange={e => setRoleForHex(hex, e.target.value)}
                                className="bg-gray-800 text-[9px] font-bold px-1.5 py-0.5 rounded border border-white/10 cursor-pointer"
                                style={{ color: ZONE_ROLES[role]?.color }}>
                                <option value="PRIMARY">Primary</option>
                                <option value="BACKUP">Backup</option>
                                <option value="ESCALATION">Escalation</option>
                              </select>
                              <button onClick={() => { pushUndo(); removeHex(hex); }}
                                className="opacity-0 group-hover:opacity-100 text-red-400/50 hover:text-red-400 transition w-5 text-center">
                                <i className="fas fa-times text-[8px]" />
                              </button>
                            </div>
                          ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── CONFIRM / CANCEL ── */}
          <div className="p-4 border-t border-white/10 space-y-2 flex-shrink-0 bg-gray-950">
            <button onClick={handleConfirm} disabled={!selectedZones.size}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white rounded-xl text-sm font-bold transition disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10">
              <i className="fas fa-check-double" />
              Confirm {selectedZones.size} Zone{selectedZones.size !== 1 ? 's' : ''} Allocation
            </button>
            <button onClick={onClose}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white/40 rounded-xl text-sm font-medium transition">
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
