import api from './api';

const locationService = {
  // GeoFence check - this is a frontend-only feature using the geoFencing hook
  // No backend endpoint exists, handled by useGeoFencing hook
  checkGeoFence: async (latitude, longitude) => {
    // Uses OSRM for route matching instead of backend
    throw new Error('Use useGeoFencing hook for geo-fence checking');
  },

  // No backend endpoint - use frontend calculation
  getAllowedZones: async () => {
    return { zones: [] }; // Zones are configured client-side
  },

  // Location update - handled via socket.io, not REST API
  updateLocation: async (latitude, longitude) => {
    throw new Error('Use SocketContext for real-time location updates');
  },

  // Get nearby rides - use rides search API with coordinates
  getNearbyRides: async (latitude, longitude, radius = 10) => {
    const response = await api.get('/api/rides/nearby', {
      params: { lat: latitude, lng: longitude, radius }
    });
    return response.data;
  },

  // Calculate distance using OSRM (free, no backend needed)
  // Supports intermediate stops: calculateDistance(origin, destination, [stop1, stop2, ...])
  calculateDistance: async (origin, destination, intermediateStops = []) => {
    try {
      // Build waypoints: origin → intermediate stops → destination
      const waypoints = [];
      
      // Add origin
      waypoints.push(`${origin.lng},${origin.lat}`);
      
      // Add intermediate stops (in order)
      if (intermediateStops && intermediateStops.length > 0) {
        intermediateStops.forEach(stop => {
          if (stop && stop.lng && stop.lat) {
            waypoints.push(`${stop.lng},${stop.lat}`);
          } else if (stop && stop.coordinates) {
            // Handle [lon, lat] format
            waypoints.push(`${stop.coordinates[0]},${stop.coordinates[1]}`);
          }
        });
      }
      
      // Add destination
      waypoints.push(`${destination.lng},${destination.lat}`);
      
      const coordsString = waypoints.join(';');
      console.log('🗺️ Calculating route with waypoints:', coordsString);
      
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=false`
      );
      const data = await response.json();
      if (data.code === 'Ok' && data.routes?.[0]) {
        return {
          distance: data.routes[0].distance,
          duration: data.routes[0].duration,
          distanceKm: (data.routes[0].distance / 1000).toFixed(1),
          durationMins: Math.round(data.routes[0].duration / 60)
        };
      }
      throw new Error('Failed to calculate distance');
    } catch (error) {
      console.error('Distance calculation error:', error);
      throw error;
    }
  },

  // Reverse geocode using Nominatim (free, no backend needed)
  reverseGeocode: async (latitude, longitude) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
      );
      const data = await response.json();
      return {
        address: data.display_name,
        city: data.address?.city || data.address?.town || data.address?.village,
        state: data.address?.state,
        country: data.address?.country
      };
    } catch (error) {
      console.error('Reverse geocode error:', error);
      throw error;
    }
  },

  getCurrentPosition: () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy
        }),
        reject,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  },

  watchPosition: (callback, errorCallback) => {
    if (!navigator.geolocation) {
      errorCallback(new Error('Geolocation is not supported'));
      return null;
    }
    return navigator.geolocation.watchPosition(
      (position) => callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        heading: position.coords.heading,
        speed: position.coords.speed
      }),
      errorCallback,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  },

  clearWatch: (watchId) => {
    if (watchId && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
    }
  }
};

export default locationService;
