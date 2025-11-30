import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import chatService from '../../services/chatService';
import { LoadingSpinner, Alert } from '../../components/common';
import { getUserDisplayName, getInitials, getAvatarColor, getUserPhoto } from '../../utils/imageHelpers';

const Chat = () => {
  const { user } = useAuth();
  const { socket, isConnected, joinRoom, leaveRoom, sendMessage, markAsRead, sendTyping, isUserOnline, refreshUnreadCount, clearUnread, setCurrentChatId } = useSocket();
  const [searchParams] = useSearchParams();
  const { recipientId } = useParams(); // This could be a rideId or booking-related ID
  
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState('');
  const [typingUsers, setTypingUsers] = useState({});
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Clear current chat when leaving the page
  useEffect(() => {
    return () => {
      setCurrentChatId(null);
    };
  }, [setCurrentChatId]);

  // Fetch conversations on mount and clear unread indicator
  useEffect(() => {
    fetchConversations();
    // Clear unread indicator when entering chat page AND refresh from server
    clearUnread();
    refreshUnreadCount();

    // Check if we need to open a specific conversation
    const bookingId = searchParams.get('bookingId');
    const chatId = searchParams.get('chatId');
    const rideId = searchParams.get('rideId');
    
    if (bookingId) {
      openConversationForBooking(bookingId);
    } else if (chatId) {
      openChatById(chatId);
    } else if (rideId) {
      // For riders viewing chats from their ride
      openChatsForRide(rideId);
    } else if (recipientId) {
      // recipientId from path could be a rideId - try to find chats for it
      // For now, treat it as a potential chat/booking ID
      openChatById(recipientId);
    }
  }, [searchParams, recipientId]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // New message received - only add if NOT sent by current user (to avoid duplicates)
    socket.on('new-message', (data) => {
      const message = data.message || data;
      const senderId = message.sender?._id || message.sender;
      
      // Skip if this is our own message (we already added it when sending)
      if (senderId === user?._id) {
        console.log('🔵 [Chat] Skipping own message from socket');
        return;
      }
      
      if (message.conversationId === activeConversation?._id || data.chatId === activeConversation?._id) {
        // Check if message already exists to prevent duplicates
        setMessages(prev => {
          const exists = prev.some(m => m._id === message._id);
          if (exists) {
            console.log('🔵 [Chat] Message already exists, skipping');
            return prev;
          }
          return [...prev, message];
        });
        scrollToBottom();
        // Mark as read via API since we're viewing this chat
        chatService.markAsRead(activeConversation._id).then(async () => {
          markAsRead(activeConversation._id);
          // Always refresh from server to get accurate unread status
          await refreshUnreadCount();
        }).catch(err => console.error('Failed to mark as read:', err));
      }
      // Update conversations list
      updateConversationLastMessage(message);
    });

    // Chat notification - update conversation unread indicator
    // Note: The SocketContext now handles NOT showing the dot if viewing this chat
    socket.on('chat-notification', (data) => {
      // Update the conversation in the list to show unread indicator (if not current chat)
      setConversations(prev => prev.map(conv => {
        if (conv._id === data.chatId) {
          // Only mark as unread if NOT the active conversation
          const isActive = activeConversation?._id === data.chatId;
          return {
            ...conv,
            hasUnread: !isActive,
            lastMessage: data.message,
            updatedAt: new Date()
          };
        }
        return conv;
      }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
      
      // If this notification is for the active chat, mark as read immediately
      if (data.chatId === activeConversation?._id) {
        chatService.markAsRead(activeConversation._id).catch(err => 
          console.error('Failed to mark as read:', err)
        );
      }
    });

    // Typing indicator
    socket.on('user-typing', ({ chatId, userId }) => {
      if (chatId === activeConversation?._id) {
        setTypingUsers(prev => ({
          ...prev,
          [userId]: true
        }));
      }
    });

    socket.on('user-stopped-typing', ({ chatId, userId }) => {
      if (chatId === activeConversation?._id) {
        setTypingUsers(prev => ({
          ...prev,
          [userId]: false
        }));
      }
    });

    // Message read - update readBy to show double-tick
    socket.on('messages-read', ({ chatId, readBy, readAt }) => {
      if (chatId === activeConversation?._id) {
        setMessages(prev => prev.map(msg => {
          // Only update messages sent by current user (own messages)
          if (msg.sender?._id === user?._id || msg.sender === user?._id) {
            // Add the reader to readBy array if not already there
            const existingReadBy = msg.readBy || [];
            const alreadyRead = existingReadBy.some(r => 
              (r.user?._id || r.user || r) === readBy
            );
            if (!alreadyRead) {
              return {
                ...msg,
                readBy: [...existingReadBy, { user: readBy, readAt }]
              };
            }
          }
          return msg;
        }));
      }
    });

    return () => {
      socket.off('new-message');
      socket.off('chat-notification');
      socket.off('user-typing');
      socket.off('user-stopped-typing');
      socket.off('messages-read');
    };
  }, [socket, activeConversation]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Join/leave rooms when active conversation changes
  useEffect(() => {
    if (activeConversation) {
      joinRoom(activeConversation._id);
      // Mark messages as read via API (persists to database)
      chatService.markAsRead(activeConversation._id).then(() => {
        // Also emit socket event to notify other participants
        markAsRead(activeConversation._id);
        // Clear unread dot after marking as read
        clearUnread();
      }).catch(err => {
        console.error('Failed to mark messages as read:', err);
      });
    }
    return () => {
      if (activeConversation) {
        leaveRoom(activeConversation._id);
      }
    };
  }, [activeConversation?._id]);

  const fetchConversations = async () => {
    try {
      const data = await chatService.getConversations();
      setConversations(data.conversations || []);
    } catch (err) {
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const openConversationForBooking = async (bookingId) => {
    try {
      const data = await chatService.getOrCreateChatForBooking(bookingId);
      if (data.conversation) {
        setActiveConversation(data.conversation);
        fetchMessages(data.conversation._id);
      }
    } catch (err) {
      setError('Failed to open conversation');
    }
  };

  const openChatById = async (chatId) => {
    try {
      const data = await chatService.getChatDetails(chatId);
      if (data.chat) {
        setActiveConversation(data.chat);
        fetchMessages(data.chat._id);
      }
    } catch (err) {
      setError('Failed to open conversation');
    }
  };

  const openChatsForRide = async (rideId) => {
    try {
      const data = await chatService.getChatByRide(rideId);
      if (data.chats && data.chats.length > 0) {
        // If there are multiple chats for this ride, show the first one
        // and update the conversations list to highlight ride-related chats
        setActiveConversation(data.chats[0]);
        fetchMessages(data.chats[0]._id);
      }
    } catch (err) {
      setError('Failed to load chats for this ride');
    }
  };

  const fetchMessages = async (chatId) => {
    try {
      const data = await chatService.getMessages(chatId);
      setMessages(data.messages || []);
    } catch (err) {
      setError('Failed to load messages');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const updateConversationLastMessage = (message) => {
    setConversations(prev => prev.map(conv => 
      conv._id === message.conversationId
        ? { ...conv, lastMessage: message, updatedAt: new Date() }
        : conv
    ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSendingMessage(true);

    try {
      const data = await chatService.sendMessage(activeConversation._id, messageContent);
      setMessages(prev => [...prev, data.message]);
      sendMessage(activeConversation._id, data.message);
      updateConversationLastMessage(data.message);
    } catch (err) {
      setError('Failed to send message');
      setNewMessage(messageContent);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleTyping = useCallback((e) => {
    setNewMessage(e.target.value);

    if (activeConversation && isConnected) {
      sendTyping(activeConversation._id, true);

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing indicator
      typingTimeoutRef.current = setTimeout(() => {
        sendTyping(activeConversation._id, false);
      }, 2000);
    }
  }, [activeConversation, isConnected, sendTyping]);

  const selectConversation = async (conversation) => {
    setActiveConversation(conversation);
    // Set current chat ID in context so notifications know we're viewing this chat
    setCurrentChatId(conversation._id);
    fetchMessages(conversation._id);
    
    // Mark messages as read when selecting conversation
    try {
      await chatService.markAsRead(conversation._id);
      // Update local conversation to clear unread indicator
      setConversations(prev => prev.map(conv => {
        if (conv._id === conversation._id) {
          return { ...conv, unreadCount: 0, hasUnread: false };
        }
        return conv;
      }));
      // Clear local unread immediately, then verify with server
      clearUnread();
      // Refresh from server to check if there are other unread chats
      await refreshUnreadCount();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const getOtherParticipant = (conversation) => {
    return conversation.participants?.find(p => p._id !== user?._id);
  };

  if (loading) {
    return <LoadingSpinner fullScreen text="Loading chats..." />;
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex bg-gray-100 overflow-hidden">
      {/* Conversations Sidebar */}
      <ConversationsList
        conversations={conversations}
        activeConversation={activeConversation}
        onSelectConversation={selectConversation}
        getOtherParticipant={getOtherParticipant}
        isUserOnline={isUserOnline}
        currentUserId={user?._id}
      />

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <ChatHeader 
              participant={getOtherParticipant(activeConversation)}
              isOnline={isUserOnline(getOtherParticipant(activeConversation)?._id)}
            />

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 min-h-0">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message._id || index}
                  message={message}
                  isOwn={message.sender?._id === user?._id || message.sender === user?._id}
                  currentUserId={user?._id}
                />
              ))}
              
              {/* Typing Indicator */}
              {Object.values(typingUsers).some(Boolean) && (
                <div className="flex items-center space-x-2 text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm">typing...</span>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <MessageInput
              value={newMessage}
              onChange={handleTyping}
              onSubmit={handleSendMessage}
              disabled={sendingMessage}
            />
          </>
        ) : (
          <EmptyChat />
        )}
      </div>

      {error && (
        <div className="absolute bottom-4 right-4">
          <Alert type="error" message={error} onClose={() => setError('')} />
        </div>
      )}
    </div>
  );
};

// Helper function to get display name from participant (uses centralized helper)
const getDisplayName = (participant) => {
  return getUserDisplayName(participant);
};

// Helper function to get photo URL (uses centralized helper)
const getPhotoUrl = (participant) => {
  return getUserPhoto(participant);
};

// Avatar component with fallback for chat
const ChatAvatar = ({ participant, size = 'md', showOnline = false, isOnline = false }) => {
  const [imgError, setImgError] = useState(false);
  const photoUrl = getPhotoUrl(participant);
  const displayName = getDisplayName(participant);
  
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };
  
  const indicatorSizes = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-3 h-3'
  };
  
  return (
    <div className="relative">
      {photoUrl && !imgError ? (
        <img
          src={photoUrl}
          alt={displayName}
          className={`${sizeClasses[size]} rounded-full object-cover`}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={`${sizeClasses[size]} rounded-full ${getAvatarColor(displayName)} text-white flex items-center justify-center font-semibold`}>
          {getInitials(displayName)}
        </div>
      )}
      {showOnline && isOnline && (
        <div className={`absolute bottom-0 right-0 ${indicatorSizes[size]} bg-green-500 rounded-full border-2 border-white`}></div>
      )}
    </div>
  );
};

// Conversations List Component
const ConversationsList = ({ conversations, activeConversation, onSelectConversation, getOtherParticipant, isUserOnline, currentUserId }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredConversations = conversations.filter(conv => {
    const participant = getOtherParticipant(conv);
    const name = getDisplayName(participant).toLowerCase();
    return name.includes(searchTerm.toLowerCase());
  });

  return (
    <div className="w-80 bg-white border-r flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <h2 className="text-xl font-bold text-gray-800 flex items-center">
          <i className="fas fa-comments text-emerald-500 mr-2"></i>
          Messages
        </h2>
      </div>

      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <i className="fas fa-inbox text-4xl mb-2"></i>
            <p>No conversations yet</p>
          </div>
        ) : (
          filteredConversations.map(conversation => {
            const participant = getOtherParticipant(conversation);
            const isActive = activeConversation?._id === conversation._id;
            const isOnline = isUserOnline(participant?._id);

            return (
              <div
                key={conversation._id}
                onClick={() => onSelectConversation(conversation)}
                className={`flex items-center p-4 cursor-pointer transition border-b ${
                  isActive ? 'bg-emerald-50' : 'hover:bg-gray-50'
                }`}
              >
                <ChatAvatar 
                  participant={participant}
                  size="lg"
                  showOnline
                  isOnline={isOnline}
                />
                <div className="ml-3 flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-gray-800 truncate">
                      {getDisplayName(participant)}
                    </h3>
                    <span className="text-xs text-gray-500">
                      {formatTime(conversation.lastMessage?.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate">
                    {conversation.lastMessage?.content || 'Start a conversation'}
                  </p>
                </div>
                {(conversation.unreadCount > 0 || conversation.hasUnread) && (
                  <div className="ml-2 w-3 h-3 bg-emerald-500 rounded-full"></div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Chat Header Component
const ChatHeader = ({ participant, isOnline }) => {
  return (
    <div className="bg-white border-b p-4 flex items-center justify-between">
      <div className="flex items-center">
        <ChatAvatar 
          participant={participant}
          size="md"
          showOnline
          isOnline={isOnline}
        />
        <div className="ml-3">
          <h3 className="font-semibold text-gray-800">
            {getDisplayName(participant)}
          </h3>
          <p className="text-sm text-gray-500">
            {isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button className="p-2 text-gray-500 hover:text-emerald-500 rounded-full hover:bg-gray-100">
          <i className="fas fa-phone"></i>
        </button>
        <button className="p-2 text-gray-500 hover:text-emerald-500 rounded-full hover:bg-gray-100">
          <i className="fas fa-ellipsis-v"></i>
        </button>
      </div>
    </div>
  );
};

// Message Bubble Component
const MessageBubble = ({ message, isOwn, currentUserId }) => {
  // Check if message is read by checking readBy array
  const isRead = message.readBy && message.readBy.length > 0 && 
    message.readBy.some(r => {
      const readerId = r.user?._id || r.user || r;
      return readerId && readerId.toString() !== currentUserId?.toString();
    });
  
  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[70%] ${isOwn ? 'order-2' : ''}`}>
        <div
          className={`px-4 py-2 rounded-2xl ${
            isOwn
              ? 'bg-emerald-500 text-white rounded-br-sm'
              : 'bg-white text-gray-800 rounded-bl-sm shadow-sm'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className={`flex items-center mt-1 text-xs text-gray-400 ${isOwn ? 'justify-end' : ''}`}>
          <span>{formatTime(message.timestamp || message.createdAt)}</span>
          {isOwn && (
            <span className="ml-1">
              {isRead ? (
                <i className="fas fa-check-double text-blue-500"></i>
              ) : (
                <i className="fas fa-check"></i>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// Message Input Component
const MessageInput = ({ value, onChange, onSubmit, disabled }) => {
  return (
    <form onSubmit={onSubmit} className="bg-white border-t p-4">
      <div className="flex items-center space-x-3">
        <button type="button" className="p-2 text-gray-500 hover:text-emerald-500 rounded-full hover:bg-gray-100">
          <i className="fas fa-paperclip"></i>
        </button>
        <input
          type="text"
          value={value}
          onChange={onChange}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          className="p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="fas fa-paper-plane"></i>
        </button>
      </div>
    </form>
  );
};

// Empty Chat Component
const EmptyChat = () => {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-comments text-gray-400 text-4xl"></i>
        </div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Your Messages</h3>
        <p className="text-gray-500">Select a conversation to start chatting</p>
      </div>
    </div>
  );
};

// Helper function to format time
const formatTime = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

export default Chat;
