import api from './api';

const locationService = {
  checkGeoFence: async (latitude, longitude) => {
    const response = await api.post('/api/location/check-geofence', { latitude, longitude });
    return response.data;
  },

  getAllowedZones: async () => {
    const response = await api.get('/api/location/zones');
    return response.data;
  },

  updateLocation: async (latitude, longitude) => {
    const response = await api.post('/api/location/update', { latitude, longitude });
    return response.data;
  },

  getNearbyRides: async (latitude, longitude, radius = 10) => {
    const response = await api.get('/api/location/nearby-rides', {
      params: { latitude, longitude, radius }
    });
    return response.data;
  },

  calculateDistance: async (origin, destination) => {
    const response = await api.post('/api/location/calculate-distance', { origin, destination });
    return response.data;
  },

  reverseGeocode: async (latitude, longitude) => {
    const response = await api.get('/api/location/reverse-geocode', {
      params: { latitude, longitude }
    });
    return response.data;
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
