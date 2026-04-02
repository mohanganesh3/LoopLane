import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import userService from '../../services/userService';
import { Alert } from '../../components/common';
import { ClayCard, ClayButton, ClayBadge, CountBadge } from '../../components/clay';
import { 
  BellIcon, CheckCircleIcon, CancelledIcon, EarningsIcon, StarIcon, 
  SosIcon, ShieldIcon, LockIcon, UserIcon, ClockIcon, TrashIcon, 
  LeafIcon, RouteIcon, ChatIcon 
} from '../../components/icons/AppIcons';

const isNotificationRead = (notification) => notification.read ?? notification.isRead ?? false;
const getErrorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

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
      setError(getErrorMessage(err, 'Failed to load notifications'));
    } finally {
      setLoading(false);
    }
  };

  const getFilteredNotifications = useCallback(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !isNotificationRead(n));
    if (filter === 'booking') return notifications.filter(n => n.type?.includes('BOOKING'));
    if (filter === 'ride') return notifications.filter(n => n.type?.includes('RIDE'));
    if (filter === 'safety') return notifications.filter(n => ['WARNING', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'NEW_REPORT', 'REPORT_UPDATE', 'REPORT_RESOLVED', 'SYSTEM_ALERT', 'REFUND_DEDUCTION'].includes(n.type));
    return notifications;
  }, [notifications, filter]);

  const handleNotificationClick = async (notification) => {
    try {
      // Mark as read
      if (!isNotificationRead(notification)) {
        await userService.markNotificationRead(notification._id);
        setNotifications(prev =>
          prev.map(n => n._id === notification._id ? { ...n, read: true } : n)
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
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setSuccess('All notifications marked as read');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to mark all as read'));
    }
  };

  const handleDeleteNotification = async (notificationId) => {
    try {
      await userService.deleteNotification(notificationId);
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      setSuccess('Notification deleted');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete notification'));
    }
  };

  const getNotificationIcon = (type) => {
    const icons = {
      'BOOKING_REQUEST': <RouteIcon />,
      'BOOKING_CONFIRMED': <CheckCircleIcon />,
      'BOOKING_ACCEPTED': <CheckCircleIcon />,
      'BOOKING_REJECTED': <CancelledIcon />,
      'BOOKING_CANCELLED': <CancelledIcon />,
      'BOOKING_REASSIGNED': <RouteIcon />,
      'RIDE_STARTED': <RouteIcon />,
      'RIDE_STARTING': <ClockIcon />,
      'RIDE_COMPLETED': <CheckCircleIcon />,
      'PAYMENT_RECEIVED': <EarningsIcon />,
      'PAYMENT_REFUNDED': <EarningsIcon />,
      'REVIEW_RECEIVED': <StarIcon />,
      'MESSAGE_RECEIVED': <ChatIcon />,
      'SOS_ALERT': <SosIcon />,
      'WARNING': <SosIcon />,
      'ACCOUNT_SUSPENDED': <LockIcon />,
      'ACCOUNT_BANNED': <LockIcon />,
      'ACCOUNT_ACTIVATED': <UserIcon />,
      'ACCOUNT_STATUS_CHANGE': <UserIcon />,
      'NEW_REPORT': <SosIcon />,
      'REPORT_UPDATE': <SosIcon />,
      'REPORT_RESOLVED': <CheckCircleIcon />,
      'SYSTEM_ALERT': <BellIcon />,
      'DOCUMENT_APPROVED': <ShieldIcon />,
      'DOCUMENT_REJECTED': <LockIcon />,
      'REFUND_DEDUCTION': <EarningsIcon />
    };
    return icons[type] || <BellIcon />;
  };

  const getNotificationColor = (type) => {
    const colors = {
      'BOOKING_REQUEST': 'bg-blue-500',
      'BOOKING_CONFIRMED': 'bg-green-500',
      'BOOKING_ACCEPTED': 'bg-green-500',
      'BOOKING_REJECTED': 'bg-red-500',
      'BOOKING_CANCELLED': 'bg-gray-500',
      'BOOKING_REASSIGNED': 'bg-amber-500',
      'RIDE_STARTED': 'bg-purple-500',
      'RIDE_STARTING': 'bg-purple-400',
      'RIDE_COMPLETED': 'bg-green-600',
      'PAYMENT_RECEIVED': 'bg-yellow-500',
      'PAYMENT_REFUNDED': 'bg-emerald-500',
      'REVIEW_RECEIVED': 'bg-orange-500',
      'MESSAGE_RECEIVED': 'bg-indigo-500',
      'SOS_ALERT': 'bg-red-600',
      // Trust & Safety types
      'WARNING': 'bg-amber-500',
      'ACCOUNT_SUSPENDED': 'bg-red-500',
      'ACCOUNT_BANNED': 'bg-red-700',
      'ACCOUNT_ACTIVATED': 'bg-green-500',
      'ACCOUNT_STATUS_CHANGE': 'bg-blue-500',
      'NEW_REPORT': 'bg-orange-500',
      'REPORT_UPDATE': 'bg-blue-400',
      'REPORT_RESOLVED': 'bg-green-600',
      'SYSTEM_ALERT': 'bg-gray-600',
      'DOCUMENT_APPROVED': 'bg-green-500',
      'DOCUMENT_REJECTED': 'bg-red-500',
      'REFUND_DEDUCTION': 'bg-red-400'
    };
    return colors[type] || 'bg-gray-500';
  };

  const getNotificationUrl = (notification) => {
    if (notification.data?.url) return notification.data.url;
    if (notification.data?.reportId) return '/my-reports';
    if (notification.data?.bookingId) return `/bookings/${notification.data.bookingId}`;
    if (notification.data?.rideId) return `/rides/${notification.data.rideId}`;
    // Type-based fallbacks
    if (['WARNING', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'ACCOUNT_ACTIVATED', 'ACCOUNT_STATUS_CHANGE'].includes(notification.type)) return '/notifications';
    if (['NEW_REPORT', 'REPORT_UPDATE', 'REPORT_RESOLVED'].includes(notification.type)) return '/my-reports';
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
  const unreadCount = notifications.filter(n => !isNotificationRead(n)).length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--ll-cream, #f5f0e8)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen py-8"
      style={{ background: 'var(--ll-cream, #f5f0e8)' }}
    >
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-8">
          <div>
            <h1
              className="text-3xl font-bold text-gray-800 flex items-center"
              style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}
            >
              <i className="fas fa-bell text-emerald-500 mr-3"></i>Notifications
              {unreadCount > 0 && (
                <CountBadge count={unreadCount} className="ml-3" />
              )}
            </h1>
            <p className="text-gray-600 mt-2">Stay updated with all your ride activities</p>
          </div>
          {unreadCount > 0 && (
            <ClayButton variant="primary" onClick={handleMarkAllRead}>
              <i className="fas fa-check-double mr-2"></i>Mark All as Read
            </ClayButton>
          )}
        </motion.div>

        {error && <Alert type="error" message={error} className="mb-6" onClose={() => setError('')} />}
        {success && <Alert type="success" message={success} className="mb-6" />}

        {/* Filter Tabs */}
        <ClayCard variant="flat" padding="sm" className="mb-6">
          <div className="flex space-x-1">
            {[
              { key: 'all', label: 'All', count: notifications.length },
              { key: 'unread', label: 'Unread', count: unreadCount },
              { key: 'booking', label: 'Bookings', count: notifications.filter(n => n.type?.includes('BOOKING')).length },
              { key: 'ride', label: 'Rides', count: notifications.filter(n => n.type?.includes('RIDE')).length },
              { key: 'safety', label: 'Safety', count: notifications.filter(n => ['WARNING', 'ACCOUNT_SUSPENDED', 'ACCOUNT_BANNED', 'NEW_REPORT', 'REPORT_UPDATE', 'REPORT_RESOLVED', 'SYSTEM_ALERT', 'REFUND_DEDUCTION'].includes(n.type)).length }
            ].map(({ key, label, count }) => (
              <ClayButton
                key={key}
                variant={filter === key ? 'primary' : 'ghost'}
                size="sm"
                className="flex-1"
                onClick={() => setFilter(key)}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${filter === key ? 'bg-white/20' : 'bg-gray-200'
                    }`}>
                    {count}
                  </span>
                )}
              </ClayButton>
            ))}
          </div>
        </ClayCard>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <motion.div variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }} initial="hidden" animate="visible">
            <ClayCard variant="default" padding="xl">
              <div className="flex flex-col items-center text-center max-w-md mx-auto py-8">
                <div className="w-24 h-24 bg-purple-50 rounded-full flex items-center justify-center mb-6">
                  <i className="fas fa-bell-slash text-purple-400 text-4xl"></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-3" style={{ fontFamily: 'var(--ll-font-display, "Instrument Serif", serif)' }}>
                  {filter === 'unread' ? "You're all caught up!" : "It's quiet here..."}
                </h3>
                <p className="text-gray-600 mb-8 text-lg">
                  {filter === 'unread'
                    ? "Great job staying on top of things! You have no new messages or alerts."
                    : "When you book a ride or someone requests to join your trip, you'll see the updates right here."
                  }
                </p>

                <div className="bg-gray-50 rounded-xl p-5 mb-8 w-full border border-gray-100 text-left flex gap-4">
                  <div className="text-emerald-500 mt-1"><i className="fas fa-check-circle text-xl"></i></div>
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-1">Stay Notified</h4>
                    <p className="text-sm text-gray-600">Make sure your push notifications are enabled so you never miss a ride update.</p>
                  </div>
                </div>

                <div className="flex gap-3 w-full justify-center">
                  <ClayButton variant="primary" as={Link} to="/find-ride">
                    <i className="fas fa-search mr-2"></i>Find a Ride
                  </ClayButton>
                  <ClayButton variant="ghost" as={Link} to="/post-ride">
                    Post a Ride
                  </ClayButton>
                </div>
              </div>
            </ClayCard>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notification, index) => (
              <motion.div
                key={notification._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
              >
                <ClayCard
                  variant={!isNotificationRead(notification) ? 'mint' : 'flat'}
                  padding="md"
                  hover
                  clickable
                  onClick={() => handleNotificationClick(notification)}
                  className="cursor-pointer"
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full ${getNotificationColor(notification.type)} flex items-center justify-center text-white`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800">{notification.title}</h3>
                          <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                        </div>
                        <div className="flex items-center gap-3 ml-4">
                          {!isNotificationRead(notification) && (
                            <span className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></span>
                          )}
                          <button
                            type="button"
                            aria-label="Delete notification"
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDeleteNotification(notification._id);
                            }}
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4 mt-3 text-xs text-gray-500">
                        <span className="flex items-center"><ClockIcon className="w-3 h-3 mr-1" />{timeAgo(notification.createdAt)}</span>
                        {isNotificationRead(notification) && <span className="flex items-center"><CheckCircleIcon className="w-3 h-3 mr-1" />Read</span>}
                        {notification.priority === 'HIGH' || notification.priority === 'URGENT' ? (
                          <ClayBadge variant="warning" size="sm">{notification.priority}</ClayBadge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </ClayCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Notifications;
