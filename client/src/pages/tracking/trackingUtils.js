import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

// Custom hook for live tracking functionality
export const useTracking = (bookingId) => {
  const socketRef = useRef(null);
  const [driverLocation, setDriverLocation] = useState(null);
  const [eta, setEta] = useState(null);
  const [rideStatus, setRideStatus] = useState('waiting');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      setError(null);
      socketRef.current.emit('join-tracking', { bookingId });
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
    });

    socketRef.current.on('connect_error', (err) => {
      setError('Connection failed. Retrying...');
      setIsConnected(false);
    });

    socketRef.current.on('driver-location', (data) => {
      setDriverLocation(data.location);
      if (data.eta) setEta(data.eta);
    });

    socketRef.current.on('ride-status-update', (data) => {
      setRideStatus(data.status);
    });

    socketRef.current.on('eta-update', (data) => {
      setEta(data.eta);
    });
  }, [bookingId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('leave-tracking', { bookingId });
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [bookingId]);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return {
    driverLocation,
    eta,
    rideStatus,
    isConnected,
    error,
    reconnect: connect
  };
};

// Custom hook for driver location broadcasting
export const useDriverTracking = (rideId) => {
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState(null);

  const startSharing = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }

    socketRef.current = io(import.meta.env.VITE_API_URL || 'http://localhost:5000', {
      withCredentials: true
    });

    socketRef.current.on('connect', () => {
      socketRef.current.emit('driver-start-tracking', { rideId });
      setIsSharing(true);

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp
          };
          socketRef.current.emit('driver-location-update', { rideId, location });
        },
        (err) => {
          setError(err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 10000
        }
      );
    });
  }, [rideId]);

  const stopSharing = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (socketRef.current) {
      socketRef.current.emit('driver-stop-tracking', { rideId });
      socketRef.current.disconnect();
    }
    setIsSharing(false);
  }, [rideId]);

  const updateRideStatus = useCallback((status) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('update-ride-status', { rideId, status });
    }
  }, [rideId]);

  useEffect(() => {
    return () => {
      stopSharing();
    };
  }, [stopSharing]);

  return {
    isSharing,
    error,
    startSharing,
    stopSharing,
    updateRideStatus
  };
};

// Calculate distance between two coordinates (Haversine formula)
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const toRad = (value) => value * Math.PI / 180;

// Estimate ETA based on distance
export const estimateETA = (distance, speedKmh = 30) => {
  const hours = distance / speedKmh;
  return Math.ceil(hours * 60); // Return in minutes
};

export default {
  useTracking,
  useDriverTracking,
  calculateDistance,
  estimateETA
};
