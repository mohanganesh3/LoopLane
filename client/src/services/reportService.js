import api from './api';

const reportService = {
  // Submit a new report
  createReport: async (data) => {
    const response = await api.post('/api/reports/create', data);
    return response.data;
  },

  // Get current user's reports
  getMyReports: async () => {
    const response = await api.get('/api/reports/my-reports');
    return response.data;
  },

  // Get single report details
  getReportById: async (reportId) => {
    const response = await api.get(`/api/reports/${reportId}`);
    return response.data;
  },

  // Send follow-up message on a report
  sendMessage: async (reportId, message) => {
    const response = await api.post(`/api/reports/${reportId}/message`, { message });
    return response.data;
  }
};

export default reportService;
