import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import userService from '../../services/userService';
import { Alert } from '../../components/common';

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await userService.getNotifications();
      if (response.success) {
        setNotifications(response.notifications || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredNotifications = useCallback(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.isRead);
    if (filter === 'booking') return notifications.filter(n => n.type?.includes('BOOKING'));
    if (filter === 'ride') return notifications.filter(n => n.type?.includes('RIDE'));
    return notifications;
  }, [notifications, filter]);

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read
      if (!notification.isRead) {
        await userService.markNotificationRead(notification._id);
        setNotifications(prev => 
          prev.map(n => n._id === notification._id ? { ...n, isRead: true } : n)
        );
      }

      // Navigate to relevant page
      const url = getNotificationUrl(notification);
      if (url !== '#') {
        navigate(url);
      }
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await userService.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setSuccess('All notifications marked as read');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to mark all as read');
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'BOOKING_REQUEST': 'fa-ticket-alt',
      'BOOKING_ACCEPTED': 'fa-check-circle',
      'BOOKING_REJECTED': 'fa-times-circle',
      'BOOKING_CANCELLED': 'fa-ban',
      'RIDE_STARTED': 'fa-play-circle',
      'RIDE_COMPLETED': 'fa-flag-checkered',
      'PAYMENT_RECEIVED': 'fa-money-bill-wave',
      'REVIEW_RECEIVED': 'fa-star',
      'MESSAGE_RECEIVED': 'fa-comment-dots',
      'SOS_ALERT': 'fa-exclamation-circle'
    };
    return icons[type] || 'fa-bell';
  };

  const getNotificationColor = (type) => {
    const colors = {
      'BOOKING_REQUEST': 'bg-blue-500',
      'BOOKING_ACCEPTED': 'bg-green-500',
      'BOOKING_REJECTED': 'bg-red-500',
      'BOOKING_CANCELLED': 'bg-gray-500',
      'RIDE_STARTED': 'bg-purple-500',
      'RIDE_COMPLETED': 'bg-green-600',
      'PAYMENT_RECEIVED': 'bg-yellow-500',
      'REVIEW_RECEIVED': 'bg-orange-500',
      'MESSAGE_RECEIVED': 'bg-indigo-500',
      'SOS_ALERT': 'bg-red-600'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getNotificationUrl = (notification) => {
    if (notification.data?.bookingId) return `/bookings/${notification.data.bookingId}`;
    if (notification.data?.rideId) return `/rides/${notification.data.rideId}`;
    return '#';
  };

  const timeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const filteredNotifications = getFilteredNotifications();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center">
              🔔 Notifications
              {unreadCount > 0 && (
                <span className="ml-3 bg-red-500 text-white text-sm px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </h1>
            <p className="text-gray-600 mt-2">Stay updated with all your ride activities</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="bg-emerald-500 text-white px-6 py-2 rounded-lg hover:bg-emerald-600 transition font-semibold"
            >
              ✓✓ Mark All as Read
            </button>
          )}
        </div>

        {error && <Alert type="error" message={error} className="mb-6" onClose={() => setError('')} />}
        {success && <Alert type="success" message={success} className="mb-6" />}

        {/* Filter Tabs */}
        <div className="flex space-x-1 mb-6 bg-white rounded-lg p-1 shadow">
          {[
            { key: 'all', label: 'All', count: notifications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'booking', label: 'Bookings', count: notifications.filter(n => n.type?.includes('BOOKING')).length },
            { key: 'ride', label: 'Rides', count: notifications.filter(n => n.type?.includes('RIDE')).length }
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-1 px-4 py-2 font-medium rounded-md transition ${
                filter === key
                  ? 'bg-emerald-500 text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                  filter === key ? 'bg-white text-emerald-500' : 'bg-gray-200'
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl text-gray-300 mb-4">🔕</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No notifications</h3>
            <p className="text-gray-500">
              {filter === 'unread'
                ? "You're all caught up! No unread notifications."
                : "You're all caught up! Check back later for updates."
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <div
                key={notification._id}
                onClick={() => handleNotificationClick(notification)}
                className={`bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition cursor-pointer ${
                  !notification.isRead ? 'border-l-4 border-emerald-500 bg-emerald-50' : ''
                }`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full ${getNotificationColor(notification.type)} flex items-center justify-center`}>
                      <i className={`fas ${getNotificationIcon(notification.type)} text-white text-xl`}></i>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-800">{notification.title}</h3>
                        <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                      </div>
                      {!notification.isRead && (
                        <span className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0 ml-4"></span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                      <span>🕐 {timeAgo(notification.createdAt)}</span>
                      {notification.isRead && <span>✓ Read</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
