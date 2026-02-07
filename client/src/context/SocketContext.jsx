import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import chatService from '../services/chatService';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    // Return a safe default instead of throwing - prevents crashes
    return {
      socket: null,
      isConnected: false,
      onlineUsers: [],
      hasUnread: false,
      joinRoom: () => {},
      leaveRoom: () => {},
      sendMessage: () => {},
      markAsRead: () => {},
      sendTyping: () => {},
      isUserOnline: () => false,
      refreshUnreadCount: async () => {},
      clearUnread: () => {},
      setHasUnread: () => {},
      currentChatId: null,
      setCurrentChatId: () => {}
    };
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  // Track which chat is currently being viewed
  const [currentChatId, setCurrentChatId] = useState(null);
  const currentChatIdRef = useRef(null);
  
  // Keep ref in sync with state for use in socket callbacks
  useEffect(() => {
    currentChatIdRef.current = currentChatId;
  }, [currentChatId]);

  // Initialize socket connection
  useEffect(() => {
    if (isAuthenticated && user) {
      // Fetch initial unread status
      chatService.getUnreadCount().then(data => {
        setHasUnread(data.hasUnread || false);
      }).catch(err => {
        console.error('Failed to fetch unread status:', err);
      });

      const socketBaseUrl = import.meta.env.VITE_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : '');

      const newSocket = io(socketBaseUrl, {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        auth: {
          userId: user._id
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
        // Join user's personal room for notifications
        newSocket.emit('join-user', user._id);
        console.log('Joining user room:', user._id);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      // Reconnect handler - rejoin rooms
      newSocket.on('reconnect', () => {
        console.log('Socket reconnected, rejoining user room');
        newSocket.emit('join-user', user._id);
      });

      // Online users list
      newSocket.on('users:online', (users) => {
        setOnlineUsers(users);
      });

      // User came online
      newSocket.on('user:online', (userId) => {
        setOnlineUsers(prev => [...new Set([...prev, userId])]);
      });

      // User went offline
      newSocket.on('user:offline', (userId) => {
        setOnlineUsers(prev => prev.filter(id => id !== userId));
      });

      // Chat notification - ONLY set hasUnread if NOT viewing that chat
      newSocket.on('chat-notification', (data) => {
        console.log('🔴 Chat notification received:', data, 'Current chat:', currentChatIdRef.current);
        // Only show unread dot if we're NOT currently viewing this chat
        if (currentChatIdRef.current !== data.chatId) {
          setHasUnread(true);
        }
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
        setIsConnected(false);
      }
      setHasUnread(false);
      setCurrentChatId(null);
    }
  }, [isAuthenticated, user?._id]);

  // Join a chat room
  const joinRoom = useCallback((roomId) => {
    if (socket && isConnected) {
      socket.emit('join-chat', roomId);
    }
  }, [socket, isConnected]);

  // Leave a chat room
  const leaveRoom = useCallback((roomId) => {
    if (socket && isConnected) {
      socket.emit('leave-chat', roomId);
    }
  }, [socket, isConnected]);

  // Send a message
  const sendMessage = useCallback((roomId, message) => {
    if (socket && isConnected) {
      socket.emit('send-message', { chatId: roomId, message });
    }
  }, [socket, isConnected]);

  // Mark messages as read
  const markAsRead = useCallback((roomId) => {
    if (socket && isConnected) {
      socket.emit('mark-read', { chatId: roomId });
    }
  }, [socket, isConnected]);

  // Send typing indicator
  const sendTyping = useCallback((roomId, isTyping) => {
    if (socket && isConnected) {
      if (isTyping) {
        socket.emit('typing-start', { chatId: roomId });
      } else {
        socket.emit('typing-stop', { chatId: roomId });
      }
    }
  }, [socket, isConnected]);

  // Check if user is online
  const isUserOnline = useCallback((userId) => {
    return onlineUsers.includes(userId);
  }, [onlineUsers]);

  // Refresh unread status from API
  const refreshUnreadCount = useCallback(async () => {
    try {
      const data = await chatService.getUnreadCount();
      setHasUnread(data.hasUnread || false);
    } catch (err) {
      console.error('Failed to refresh unread status:', err);
    }
  }, []);

  // Clear unread indicator
  const clearUnread = useCallback(() => {
    setHasUnread(false);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    socket,
    isConnected,
    onlineUsers,
    hasUnread,
    joinRoom,
    leaveRoom,
    sendMessage,
    markAsRead,
    sendTyping,
    isUserOnline,
    refreshUnreadCount,
    clearUnread,
    setHasUnread,
    currentChatId,
    setCurrentChatId
  }), [
    socket,
    isConnected,
    onlineUsers,
    hasUnread,
    joinRoom,
    leaveRoom,
    sendMessage,
    markAsRead,
    sendTyping,
    isUserOnline,
    refreshUnreadCount,
    clearUnread,
    currentChatId
  ]);

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
