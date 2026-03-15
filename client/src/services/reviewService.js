import api from './api';

const reviewService = {
  getUserReviews: async (userId, page = 1, limit = 10) => {
    const response = await api.get(`/api/reviews/user/${userId}`, {
      params: { page, limit }
    });
    return response.data;
  },

  getMyGivenReviews: async (page = 1, limit = 10) => {
    const response = await api.get('/api/reviews/given', {
      params: { page, limit }
    });
    return response.data;
  },

  getMyReceivedReviews: async (page = 1, limit = 10) => {
    const response = await api.get('/api/reviews/received', {
      params: { page, limit }
    });
    return response.data;
  },

  submitReview: async (bookingId, reviewData) => {
    const response = await api.post(`/api/reviews/booking/${bookingId}`, reviewData);
    return response.data;
  },

  updateReview: async (reviewId, reviewData) => {
    const response = await api.put(`/api/reviews/${reviewId}`, reviewData);
    return response.data;
  },

  deleteReview: async (reviewId) => {
    const response = await api.delete(`/api/reviews/${reviewId}`);
    return response.data;
  },

  getUserReviewStats: async (userId) => {
    const response = await api.get(`/api/reviews/stats/${userId}`);
    return response.data;
  },

  respondToReview: async (reviewId, text) => {
    const response = await api.post(`/api/reviews/${reviewId}/respond`, { text });
    return response.data;
  },

  markAsHelpful: async (reviewId) => {
    const response = await api.post(`/api/reviews/${reviewId}/helpful`);
    return response.data;
  },

  reportReview: async (reviewId, reason) => {
    const response = await api.post(`/api/reviews/${reviewId}/report`, { reason });
    return response.data;
  }
};

export default reviewService;
