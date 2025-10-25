import api from './api';

const chatService = {
  // Get all conversations/chat rooms
  getConversations: async () => {
    const response = await api.get('/chat/conversations');
    return response.data;
  },

  // Get or create conversation with a user
  getOrCreateConversation: async (userId) => {
    const response = await api.post('/chat/conversations', { userId });
    return response.data;
  },

  // Get messages for a conversation
  getMessages: async (conversationId, page = 1, limit = 50) => {
    const response = await api.get(
      `/chat/conversations/${conversationId}/messages?page=${page}&limit=${limit}`
    );
    return response.data;
  },

  // Send a message
  sendMessage: async (conversationId, content, messageType = 'text') => {
    const response = await api.post(`/chat/conversations/${conversationId}/messages`, {
      content,
      messageType
    });
    return response.data;
  },

  // Mark conversation as read
  markAsRead: async (conversationId) => {
    const response = await api.post(`/chat/conversations/${conversationId}/read`);
    return response.data;
  },

  // Get unread message count
  getUnreadCount: async () => {
    const response = await api.get('/chat/unread-count');
    return response.data;
  },

  // Delete a message
  deleteMessage: async (conversationId, messageId) => {
    const response = await api.delete(`/chat/conversations/${conversationId}/messages/${messageId}`);
    return response.data;
  },

  // Get conversation by ride ID
  getConversationByRide: async (rideId) => {
    const response = await api.get(`/chat/ride/${rideId}`);
    return response.data;
  },

  // Block a user
  blockUser: async (userId) => {
    const response = await api.post(`/chat/block/${userId}`);
    return response.data;
  },

  // Unblock a user
  unblockUser: async (userId) => {
    const response = await api.delete(`/chat/block/${userId}`);
    return response.data;
  },

  // Get blocked users
  getBlockedUsers: async () => {
    const response = await api.get('/chat/blocked');
    return response.data;
  }
};

export default chatService;
