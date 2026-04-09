import api from './api';

const chatService = {
  // Get all conversations/chat rooms
  getConversations: async () => {
    const response = await api.get('/api/chat/my-chats');
    // Map response to expected format for frontend
    return {
      conversations: response.data.chats || []
    };
  },

  // Get or create conversation with a user (via booking)
  getOrCreateConversation: async (userId, bookingId) => {
    // If bookingId is provided, use it; otherwise we need to find/create one
    if (bookingId) {
      const response = await api.post(`/api/chat/booking/${bookingId}`);
      return {
        conversation: response.data.chat
      };
    }
    // Without a booking, we can't create a chat in the current backend design
    throw new Error('Booking ID is required to create a conversation');
  },

  // Get or create chat for a booking
  getOrCreateChatForBooking: async (bookingId) => {
    const response = await api.post(`/api/chat/booking/${bookingId}`);
    return {
      conversation: response.data.chat
    };
  },

  // Get messages for a conversation/chat
  getMessages: async (chatId, page = 1, limit = 50) => {
    const response = await api.get(`/api/chat/${chatId}/messages?page=${page}&limit=${limit}`);
    return {
      messages: response.data.messages || []
    };
  },

  // Send a message
  sendMessage: async (chatId, content, messageType = 'TEXT') => {
    const response = await api.post(`/api/chat/${chatId}/messages`, {
      content,
      type: messageType.toUpperCase()
    });
    return {
      message: response.data.message
    };
  },

  // Mark conversation as read
  markAsRead: async (chatId) => {
    const response = await api.post(`/api/chat/${chatId}/read`);
    return response.data;
  },

  // Get unread message count
  getUnreadCount: async () => {
    const response = await api.get('/api/chat/unread-count');
    return response.data;
  },

  // Delete a message
  deleteMessage: async (chatId, messageId) => {
    const response = await api.delete(`/api/chat/${chatId}/messages/${messageId}`);
    return response.data;
  },

  // Get chat details by ID
  getChatDetails: async (chatId) => {
    const response = await api.get(`/api/chat/${chatId}/details`);
    return response.data;
  },

  // Get chats for a specific ride (server-side query)
  getChatByRide: async (rideId) => {
    const response = await api.get(`/api/chat/by-ride/${encodeURIComponent(rideId)}`);
    return {
      chats: response.data.chats || []
    };
  }
};

export default chatService;
