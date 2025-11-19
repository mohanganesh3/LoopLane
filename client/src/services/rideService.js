import api from './api';

const rideService = {
  // Search rides with filters
  searchRides: async (params) => {
    const queryParams = new URLSearchParams();
    if (params.origin) queryParams.append('origin', JSON.stringify(params.origin));
    if (params.destination) queryParams.append('destination', JSON.stringify(params.destination));
    if (params.date) queryParams.append('date', params.date);
    if (params.seats) queryParams.append('seats', params.seats);
    if (params.maxPrice) queryParams.append('maxPrice', params.maxPrice);
    if (params.departureTime) queryParams.append('departureTime', params.departureTime);
    if (params.preferences) queryParams.append('preferences', JSON.stringify(params.preferences));
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.sortBy) queryParams.append('sortBy', params.sortBy);
    
    const response = await api.get(`/api/rides/search/results?${queryParams.toString()}`);
    return response.data;
  },

  // Get ride by ID with full details
  getRideById: async (id) => {
    const response = await api.get(`/api/rides/${id}`);
    return response.data;
  },

  // Get my rides as driver
  getMyRides: async (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.append('status', params.status);
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    
    const response = await api.get(`/api/rides/my-rides?${queryParams.toString()}`);
    return response.data;
  },

  // Get bookings for a specific ride
  getRideBookings: async (rideId) => {
    const response = await api.get(`/api/rides/${rideId}/bookings`);
    return response.data;
  },

  // Post a new ride
  postRide: async (data) => {
    const response = await api.post('/api/rides/post', data);
    return response.data;
  },

  // Update ride details
  updateRide: async (id, data) => {
    const response = await api.put(`/api/rides/${id}`, data);
    return response.data;
  },

  // Cancel ride
  cancelRide: async (id, reason) => {
    const response = await api.post(`/api/rides/${id}/cancel`, { reason });
    return response.data;
  },

  // Delete ride (only if no bookings)
  deleteRide: async (id) => {
    const response = await api.delete(`/api/rides/${id}`);
    return response.data;
  },

  // Start ride (driver begins journey)
  startRide: async (id) => {
    const response = await api.post(`/api/rides/${id}/start`);
    return response.data;
  },

  // Complete ride (journey finished)
  completeRide: async (id) => {
    const response = await api.post(`/api/rides/${id}/complete`);
    return response.data;
  },

  // Accept booking request
  acceptBooking: async (rideId, bookingId) => {
    const response = await api.post(`/api/bookings/${bookingId}/accept`);
    return response.data;
  },

  // Reject booking request
  rejectBooking: async (rideId, bookingId, reason) => {
    const response = await api.post(`/api/bookings/${bookingId}/reject`, { reason });
    return response.data;
  },

  // Get nearby rides (for location-based search)
  getNearbyRides: async (lat, lng, radius = 10) => {
    const response = await api.get(`/api/rides/nearby?lat=${lat}&lng=${lng}&radius=${radius}`);
    return response.data;
  },

  // Get popular routes
  getPopularRoutes: async () => {
    const response = await api.get('/api/rides/popular-routes');
    return response.data;
  }
};

export default rideService;
