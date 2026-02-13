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

  // Get chats for a specific ride (rider's view - may have multiple bookings)
  getChatByRide: async (rideId) => {
    // Get all user chats and filter by ride
    const response = await api.get('/api/chat/my-chats');
    const chats = response.data.chats || [];
    // Find chats that belong to this ride
    const rideChats = chats.filter(chat => 
      chat.booking?.ride === rideId || chat.booking?.ride?._id === rideId
    );
    return {
      chats: rideChats
    };
  }
};

export default chatService;
