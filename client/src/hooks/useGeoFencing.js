import { useState, useEffect, useCallback, useRef } from 'react';
import locationService from '../services/locationService';

const useGeoFencing = (options = {}) => {
  const { enableTracking = false, checkGeoFence = false, onLocationUpdate, onGeoFenceViolation } = options;

  const [location, setLocation] = useState(null);
  const [isInsideGeoFence, setIsInsideGeoFence] = useState(true);
  const [allowedZones, setAllowedZones] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('prompt');
  
  const watchIdRef = useRef(null);

  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setPermissionStatus(result.state);
        result.onchange = () => setPermissionStatus(result.state);
      });
    }
  }, []);

  useEffect(() => {
    if (checkGeoFence) fetchAllowedZones();
  }, [checkGeoFence]);

  useEffect(() => {
    if (enableTracking && permissionStatus !== 'denied') startTracking();
    else stopTracking();
    return () => stopTracking();
  }, [enableTracking, permissionStatus]);

  const fetchAllowedZones = async () => {
    try {
      const data = await locationService.getAllowedZones();
      setAllowedZones(data.zones || []);
    } catch (err) {
      console.error('Failed to fetch geo-fence zones:', err);
    }
  };

  const getCurrentLocation = async () => {
    setLoading(true);
    setError(null);
    try {
      const position = await locationService.getCurrentPosition();
      setLocation(position);
      if (checkGeoFence) await checkGeoFenceStatus(position.latitude, position.longitude);
      return position;
    } catch (err) {
      setError(getLocationError(err));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const startTracking = () => {
    if (watchIdRef.current) return;
    watchIdRef.current = locationService.watchPosition(
      async (position) => {
        setLocation(position);
        setError(null);
        if (checkGeoFence) await checkGeoFenceStatus(position.latitude, position.longitude);
        if (onLocationUpdate) onLocationUpdate(position);
      },
      (err) => setError(getLocationError(err))
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current) {
      locationService.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  const checkGeoFenceStatus = async (latitude, longitude) => {
    try {
      const result = await locationService.checkGeoFence(latitude, longitude);
      const wasInside = isInsideGeoFence;
      setIsInsideGeoFence(result.isInside);
      if (wasInside && !result.isInside && onGeoFenceViolation) {
        onGeoFenceViolation({ latitude, longitude, nearestZone: result.nearestZone });
      }
      return result.isInside;
    } catch (err) {
      return true;
    }
  };

  const getLocationError = (error) => {
    switch (error.code) {
      case 1: return 'Location permission denied';
      case 2: return 'Unable to determine location';
      case 3: return 'Location request timed out';
      default: return error.message || 'Location error';
    }
  };

  return {
    location, isInsideGeoFence, allowedZones, error, loading, permissionStatus,
    getCurrentLocation, startTracking, stopTracking, checkGeoFenceStatus
  };
};

export default useGeoFencing;
