import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useNavigate } from 'react-router-dom';
import userService from '../services/userService';

const NotificationContext = createContext(null);
const canUseBrowserNotifications = () => typeof window !== 'undefined' && 'Notification' in window;

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    // Return a safe default instead of throwing - prevents crashes
    return {
      notifications: [],
      unreadCount: 0,
      loading: false,
      markAsRead: async () => {},
      markAllAsRead: async () => {},
      deleteNotification: async () => {},
      requestPermission: async () => false,
      refresh: async () => {},
      reassignmentAlert: null,
      clearReassignmentAlert: () => {}
    };
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // Special state for reassignment alerts (shown as modal)
  const [reassignmentAlert, setReassignmentAlert] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (isAuthenticated) {
      // Abort any in-flight fetch from a previous user / re-render
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      fetchNotifications(ctrl.signal);
      return () => ctrl.abort();
    }

    setNotifications([]);
    setUnreadCount(0);
    setReassignmentAlert(null);
  }, [isAuthenticated, user?._id]);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('notification', handleNewNotification);
      socket.on('notification:new', handleNewNotification);
      socket.on('notification:read', handleNotificationRead);
      
      // NEW: Handle booking reassignment events
      socket.on('booking-reassigned', handleBookingReassigned);
      socket.on('ride-cancelled', handleRideCancelled);
      socket.on('new-booking', handleNewBooking);
      
      return () => {
        socket.off('notification', handleNewNotification);
        socket.off('notification:new', handleNewNotification);
        socket.off('notification:read', handleNotificationRead);
        socket.off('booking-reassigned', handleBookingReassigned);
        socket.off('ride-cancelled', handleRideCancelled);
        socket.off('new-booking', handleNewBooking);
      };
    }
  }, [socket, isConnected]);

  const fetchNotifications = async (signal) => {
    try {
      setLoading(true);
      const data = await userService.getNotifications();
      if (signal?.aborted) return;
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error) {
      if (signal?.aborted) return;
      console.error('Failed to fetch notifications:', error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const handleNewNotification = useCallback((notification) => {
    const nextNotification = notification?.notification || notification;
    if (!nextNotification?._id && !nextNotification?.title && !nextNotification?.message) {
      return;
    }

    setNotifications(prev => {
      const exists = prev.some(item => item._id && item._id === nextNotification._id);
      if (exists) {
        return prev;
      }
      return [nextNotification, ...prev];
    });
    setUnreadCount(prev => prev + (nextNotification.read ? 0 : 1));
    
    if (canUseBrowserNotifications() && Notification.permission === 'granted') {
      new Notification(nextNotification.title, {
        body: nextNotification.message,
        icon: '/logo192.png',
        tag: `notif-${nextNotification._id || Date.now()}`
      });
    }
  }, []);

  const handleNotificationRead = useCallback((notificationId) => {
    let decremented = false;
    setNotifications(prev =>
      prev.map(n => {
        if (n._id !== notificationId) {
          return n;
        }

        if (!n.read) {
          decremented = true;
        }

        return { ...n, read: true };
      })
    );
    if (decremented) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, []);

  // NEW: Handle booking reassignment - show prominent alert
  const handleBookingReassigned = useCallback((data) => {
    // Add to notifications
    if (data.notification) {
      setNotifications(prev => [data.notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    }
    
    // Show special reassignment alert modal
    setReassignmentAlert({
      type: 'REASSIGNED',
      title: '🔄 Your Ride Has Been Reassigned!',
      message: `Your original ride was cancelled, but we found you an alternative ride!`,
      newBooking: data.newBooking,
      originalBooking: data.originalBooking,
      matchScore: data.newBooking?.matchScore
    });
    
    // Browser notification
    if (canUseBrowserNotifications() && Notification.permission === 'granted') {
      new Notification('🔄 Ride Reassigned!', {
        body: `We found you an alternative ride. Tap to view details.`,
        icon: '/logo192.png',
        tag: 'reassignment'
      });
    }
  }, []);

  // NEW: Handle ride cancellation without alternative
  const handleRideCancelled = useCallback((data) => {
    // Add to notifications
    if (data.notification) {
      setNotifications(prev => [data.notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    }
    
    // Show cancellation alert if no alternative was found
    if (data.type === 'RIDE_CANCELLED_NO_ALTERNATIVE') {
      setReassignmentAlert({
        type: 'CANCELLED_NO_ALTERNATIVE',
        title: '❌ Ride Cancelled',
        message: data.message || 'Your ride was cancelled and no alternative rides are available.',
        booking: data.booking,
        refundAmount: data.booking?.refundAmount
      });
    } else {
      // Regular cancellation
      setReassignmentAlert({
        type: 'CANCELLED',
        title: '❌ Ride Cancelled',
        message: 'Your ride has been cancelled by the rider.',
        booking: data.booking,
        refundAmount: data.booking?.refundAmount
      });
    }
    
    // Browser notification
    if (canUseBrowserNotifications() && Notification.permission === 'granted') {
      new Notification('❌ Ride Cancelled', {
        body: data.message || 'Your ride has been cancelled.',
        icon: '/logo192.png',
        tag: 'cancellation'
      });
    }
  }, []);

  // NEW: Handle new booking for riders (when they receive reassigned passenger)
  const handleNewBooking = useCallback((data) => {
    if (data.notification) {
      setNotifications(prev => [data.notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    }
    
    // Show alert for reassigned passenger
    if (data.type === 'NEW_BOOKING_REASSIGNED') {
      setReassignmentAlert({
        type: 'NEW_PASSENGER_REASSIGNED',
        title: '📥 New Reassigned Passenger',
        message: `${data.booking?.passenger || 'A passenger'} has been reassigned to your ride.`,
        booking: data.booking
      });
    }
    
    // Browser notification
    if (canUseBrowserNotifications() && Notification.permission === 'granted' && data.booking?.isReassignment) {
      new Notification('📥 New Passenger (Reassigned)', {
        body: `${data.booking?.passenger || 'A passenger'} was reassigned to your ride.`,
        icon: '/logo192.png',
        tag: 'new-booking'
      });
    }
  }, []);

  // Clear the reassignment alert
  const clearReassignmentAlert = useCallback(() => {
    setReassignmentAlert(null);
  }, []);

  const markAsRead = async (notificationId) => {
    try {
      await userService.markNotificationRead(notificationId);
      handleNotificationRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await userService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      const notificationToDelete = notifications.find(n => n._id === notificationId);
      await userService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      if (notificationToDelete && !notificationToDelete.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const requestPermission = async () => {
    if (canUseBrowserNotifications()) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    requestPermission,
    refresh: () => fetchNotifications(),
    reassignmentAlert,
    clearReassignmentAlert
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;
