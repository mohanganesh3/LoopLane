import { useEffect, useState, useCallback, useRef } from 'react';
import adminService from '../../../../services/adminService';
import { useSocket } from '../../../../context/SocketContext';

const useBirdEyeData = () => {
  const [data, setData] = useState({
    arcData: [],
    heatmapData: [],
    liveTelemetry: [],
    dangerZones: [],
    emergencies: [],
    activeRoutes: [],
    breadcrumbTrails: [],
    pickupPoints: [],
    dropoffPoints: [],
    densityData: [],
    weatherData: null,        // GeoJSON FeatureCollection or null
    forecastData: [],
    unfulfilledDemand: [],    // searches with 0 results
    routeAlerts: [],          // subscribed route corridors
    hourlyDistribution: [],   // 24h demand pattern
    cityPresets: {},
    detectedCenter: null,
    isochroneData: null,      // GeoJSON FeatureCollection or null
    // Ola/Uber-grade analytics layers
    speedSegments: [],        // road segments with computed speed
    hardBrakeEvents: [],      // hard braking locations
    rapidAccelEvents: [],     // harsh acceleration locations
    speedingEvents: [],       // speed violation locations
    idleZones: [],            // idle/stop locations
    surgeZones: [],           // supply-demand ratio zones
    stats: {}
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedCity, setSelectedCity] = useState('all');
  const [weatherMeta, setWeatherMeta] = useState(null);
  const { socket } = useSocket();
  const locationThrottleRef = useRef({});

  const loadData = useCallback(async (dateRange = null, city = null) => {
    try {
      setError('');
      setLoading(true);

      const cityParam = city || selectedCity;
      const params = {};
      if (cityParam && cityParam !== 'all') params.city = cityParam;
      if (dateRange?.startDate) params.startDate = dateRange.startDate;
      if (dateRange?.endDate) params.endDate = dateRange.endDate;

      const weatherCity = cityParam || 'all';

      const [mainRes, weatherRes, forecastRes] = await Promise.all([
        adminService.getBirdEyeData(params),
        adminService.getWeatherGrid({ city: weatherCity }).catch(() => ({ success: false, data: null })),
        adminService.getSupplyForecast({ city: weatherCity }).catch(() => ({ success: false, data: [] }))
      ]);

      if (!mainRes?.success) {
        throw new Error(mainRes?.message || 'Failed to load telemetry data');
      }

      // Weather returns a GeoJSON FeatureCollection directly
      const weatherGeoJson = weatherRes?.success && weatherRes?.data?.type === 'FeatureCollection'
        ? weatherRes.data
        : null;

      setWeatherMeta(
        weatherRes?.meta?.summary
          ? { ...weatherRes.meta, ...weatherRes.meta.summary }
          : (weatherRes?.meta || null)
      );

      setData(prev => ({
        ...prev,
        arcData: mainRes.data?.arcData || [],
        heatmapData: mainRes.data?.heatmapData || [],
        liveTelemetry: mainRes.data?.liveTelemetry || [],
        dangerZones: mainRes.data?.dangerZones || [],
        emergencies: mainRes.data?.emergencies || [],
        activeRoutes: mainRes.data?.activeRoutes || [],
        breadcrumbTrails: mainRes.data?.breadcrumbTrails || [],
        pickupPoints: mainRes.data?.pickupPoints || [],
        dropoffPoints: mainRes.data?.dropoffPoints || [],
        densityData: mainRes.data?.densityData || [],
        weatherData: weatherGeoJson,
        forecastData: forecastRes?.data || [],
        unfulfilledDemand: mainRes.data?.unfulfilledDemand || [],
        routeAlerts: mainRes.data?.routeAlerts || [],
        hourlyDistribution: mainRes.data?.hourlyDistribution || [],
        cityPresets: mainRes.data?.cityPresets || {},
        detectedCenter: mainRes.data?.detectedCenter || null,
        // Preserve any manually generated reachability zone until the admin clears it.
        isochroneData: prev.isochroneData,
        // Ola/Uber-grade analytics layers from backend
        speedSegments: mainRes.data?.speedSegments || [],
        hardBrakeEvents: mainRes.data?.hardBrakeEvents || [],
        rapidAccelEvents: mainRes.data?.rapidAccelEvents || [],
        speedingEvents: mainRes.data?.speedingEvents || [],
        idleZones: mainRes.data?.idleZones || [],
        surgeZones: mainRes.data?.surgeZones || [],
        stats: mainRes.data?.stats || prev.stats
      }));
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load Bird Eye data');
    } finally {
      setLoading(false);
    }
  }, [selectedCity]);

  // Load isochrone on-demand
  const loadIsochrone = useCallback(async (lng, lat, minutes = 15) => {
    try {
      const res = await adminService.getIsochrone({ lng, lat, minutes });
      const geoJson = res?.success ? res.data : res;
      if (geoJson?.type === 'FeatureCollection' || geoJson?.features) {
        setData(prev => ({ ...prev, isochroneData: geoJson }));
      }
    } catch (err) {
      console.warn('Isochrone fetch failed:', err.message);
    }
  }, []);

  // Clear isochrone
  const clearIsochrone = useCallback(() => {
    setData(prev => ({ ...prev, isochroneData: null }));
  }, []);

  // Change city
  const changeCity = useCallback((cityKey) => {
    setSelectedCity(cityKey);
    loadData(null, cityKey);
  }, [loadData]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Socket.IO real-time driver updates (throttled to 1 update/2s per driver)
  useEffect(() => {
    if (!socket) return;

    const handleLocationUpdate = (update) => {
      if (!update?.location?.coordinates) return;

      const driverId = update.driverId || update.rideId;
      const now = Date.now();
      if (locationThrottleRef.current[driverId] && now - locationThrottleRef.current[driverId] < 2000) return;
      locationThrottleRef.current[driverId] = now;

      setData(prev => {
        const telemetry = [...prev.liveTelemetry];
        const idx = telemetry.findIndex(i => i.id === update.rideId || i.driverId === update.driverId);

        const item = {
          id: update.rideId,
          driverId: update.driverId,
          driverName: telemetry[idx]?.driverName || 'Live Driver',
          coordinates: update.location.coordinates,
          speed: update.location.speed || 0,
          heading: update.location.heading || 0,
          updatedAt: new Date().toISOString()
        };

        if (idx >= 0) {
          telemetry[idx] = { ...telemetry[idx], ...item };
        } else {
          telemetry.unshift(item);
        }

        return {
          ...prev,
          liveTelemetry: telemetry.slice(0, 100),
          stats: { ...prev.stats, activeDrivers: Math.min(telemetry.length, 100) }
        };
      });
      setLastUpdated(new Date());
    };

    socket.on('driverLocationUpdated', handleLocationUpdate);
    return () => socket.off('driverLocationUpdated', handleLocationUpdate);
  }, [socket]);

  // Clean up throttle refs periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      Object.keys(locationThrottleRef.current).forEach(key => {
        if (now - locationThrottleRef.current[key] > 30000) {
          delete locationThrottleRef.current[key];
        }
      });
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    data, loading, error, lastUpdated,
    selectedCity, weatherMeta,
    refresh: loadData,
    loadIsochrone, clearIsochrone,
    changeCity
  };
};

export default useBirdEyeData;
