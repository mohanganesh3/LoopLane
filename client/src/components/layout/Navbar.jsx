import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { getUserDisplayName, getUserPhoto, getInitials, getAvatarColor } from '../../utils/imageHelpers'
import { hasAdminPanelAccess } from '../../utils/roles'

function Navbar({ adminTheme = false }) {
  const { user, logout, isAuthenticated } = useAuth()
  const { hasUnread, refreshUnreadCount, socket } = useSocket()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')
  const userMenuRef = useRef(null)
  const mobileMenuRef = useRef(null)

  // Refresh unread status when route changes (except chat page) or socket reconnects
  useEffect(() => {
    if (isAuthenticated && !location.pathname.startsWith('/chat')) {
      refreshUnreadCount();
    }
  }, [location.pathname, isAuthenticated, socket?.connected]);

  // Listen for chat notifications directly in Navbar for real-time updates
  // Note: SocketContext now handles not showing dot when viewing the chat
  useEffect(() => {
    if (socket && isAuthenticated) {
      const handleChatNotification = (data) => {
        console.log('🔴 Navbar received chat notification:', data);
        // SocketContext handles the logic - just trigger a refresh
        refreshUnreadCount();
      };
      
      socket.on('chat-notification', handleChatNotification);
      
      return () => {
        socket.off('chat-notification', handleChatNotification);
      };
    }
  }, [socket, isAuthenticated, refreshUnreadCount]);

  // Close menus on route change
  useEffect(() => {
    setMobileMenuOpen(false)
    setUserMenuOpen(false)
  }, [location.pathname])

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  const handleLogout = async () => {
    try {
      await logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
      navigate('/login')
    }
  }

  // Admin navigation links
  const adminNavLinks = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: 'fa-chart-line' },
    { to: '/admin/users', label: 'Users', icon: 'fa-users' },
    { to: '/admin/rides', label: 'Rides', icon: 'fa-car' },
    { to: '/admin/reports', label: 'Reports', icon: 'fa-flag' },
    { to: '/admin/licenses', label: 'Verifications', icon: 'fa-check-circle' },
  ]

  // Get user display info
  const displayName = getUserDisplayName(user)
  const userPhoto = getUserPhoto(user)
  const initials = getInitials(displayName)
  const avatarColor = getAvatarColor(displayName)

  return (
    <>
      <nav className={`${isAdminRoute || adminTheme ? 'bg-indigo-900' : 'bg-white'} shadow-lg fixed w-full top-0 z-50`}>
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to={isAdminRoute ? '/admin/dashboard' : '/'} className="flex items-center space-x-2">
              <i className={`fas fa-car-side text-2xl ${isAdminRoute || adminTheme ? 'text-white' : 'text-emerald-500'}`} aria-hidden="true" />
              <span className={`text-2xl font-bold ${isAdminRoute || adminTheme ? 'text-white' : 'text-gray-800'}`}>
                {isAdminRoute || adminTheme ? 'LOOPLANE Admin' : 'LOOPLANE'}
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              {(isAdminRoute || adminTheme) && hasAdminPanelAccess(user?.role) ? (
                <>
                  {adminNavLinks.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={`flex items-center space-x-1 text-white/80 hover:text-white transition ${
                        location.pathname === link.to ? 'text-white font-semibold' : ''
                      }`}
                    >
                      <i className={`fas ${link.icon} text-sm`} aria-hidden="true" />
                      <span>{link.label}</span>
                    </Link>
                  ))}
                  <Link
                    to="/dashboard"
                    className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition flex items-center space-x-1"
                  >
                    <i className="fas fa-arrow-left text-sm" aria-hidden="true" />
                    <span>User Mode</span>
                  </Link>
                </>
              ) : isAuthenticated ? (
                <>
                  <Link to="/find-ride" className="flex items-center space-x-1 text-gray-700 hover:text-emerald-500 transition">
                    <i className="fas fa-search text-sm" aria-hidden="true" />
                    <span>Search Rides</span>
                  </Link>
                  
                  {user?.role === 'RIDER' && (
                    <>
                      <Link to="/post-ride" className="flex items-center space-x-1 text-gray-700 hover:text-emerald-500 transition">
                        <i className="fas fa-plus-circle text-sm" aria-hidden="true" />
                        <span>Post Ride</span>
                      </Link>
                      <Link to="/my-rides" className="flex items-center space-x-1 text-gray-700 hover:text-emerald-500 transition">
                        <i className="fas fa-route text-sm" aria-hidden="true" />
                        <span>My Rides</span>
                      </Link>
                    </>
                  )}
                  
                  <Link to="/bookings" className="flex items-center space-x-1 text-gray-700 hover:text-emerald-500 transition">
                    <i className="fas fa-ticket-alt text-sm" aria-hidden="true" />
                    <span>My Bookings</span>
                  </Link>
                  
                  <Link to="/chat" className="relative flex items-center space-x-1 text-gray-700 hover:text-emerald-500 transition">
                    <span className="relative">
                      <i className="fas fa-comments text-sm" aria-hidden="true" />
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </span>
                    <span>Messages</span>
                  </Link>

                  {/* User Dropdown */}
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center space-x-2 text-gray-700 hover:text-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 rounded-lg p-1"
                      aria-expanded={userMenuOpen}
                      aria-haspopup="true"
                    >
                      {userPhoto ? (
                        <img
                          src={userPhoto}
                          alt={displayName}
                          className="w-8 h-8 rounded-full object-cover border-2 border-emerald-200"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <span 
                        className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-semibold border-2 border-emerald-200`}
                        style={{ display: userPhoto ? 'none' : 'flex' }}
                      >
                        {initials}
                      </span>
                      <span>{displayName.split(' ')[0]}</span>
                      <i className={`fas fa-chevron-down text-xs transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl py-2 z-50 border animate-fade-in">
                        <div className="px-4 py-2 border-b">
                          <p className="font-semibold text-gray-800">{displayName}</p>
                          <p className="text-sm text-gray-500">{user?.email}</p>
                        </div>
                        <Link to="/dashboard" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100">
                          <i className="fas fa-tachometer-alt w-5 text-gray-400" aria-hidden="true" />
                          <span className="ml-2">Dashboard</span>
                        </Link>
                        <Link to="/profile" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100">
                          <i className="fas fa-user w-5 text-gray-400" aria-hidden="true" />
                          <span className="ml-2">Profile</span>
                        </Link>
                        <Link to="/notifications" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100">
                          <i className="fas fa-bell w-5 text-gray-400" aria-hidden="true" />
                          <span className="ml-2">Notifications</span>
                        </Link>
                        <Link to="/wallet" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100">
                          <i className="fas fa-wallet w-5 text-gray-400" aria-hidden="true" />
                          <span className="ml-2">Wallet</span>
                        </Link>
                        {user?.role === 'RIDER' && (
                          <Link to="/earnings" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100">
                            <i className="fas fa-chart-line w-5 text-gray-400" aria-hidden="true" />
                            <span className="ml-2">Earnings</span>
                          </Link>
                        )}
                        <Link to="/reviews" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100">
                          <i className="fas fa-star w-5 text-gray-400" aria-hidden="true" />
                          <span className="ml-2">My Reviews</span>
                        </Link>
                        <Link to="/change-password" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100">
                          <i className="fas fa-key w-5 text-gray-400" aria-hidden="true" />
                          <span className="ml-2">Change Password</span>
                        </Link>
                        {hasAdminPanelAccess(user?.role) && (
                          <>
                            <hr className="my-2" />
                            <Link to="/admin/dashboard" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100">
                              <i className="fas fa-shield-alt w-5 text-gray-400" aria-hidden="true" />
                              <span className="ml-2">Admin Panel</span>
                            </Link>
                          </>
                        )}
                        <hr className="my-2" />
                        <button
                          onClick={handleLogout}
                          className="flex items-center w-full px-4 py-2 text-red-600 hover:bg-red-50"
                        >
                          <i className="fas fa-sign-out-alt w-5" aria-hidden="true" />
                          <span className="ml-2">Logout</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <Link to="/" className="text-gray-700 hover:text-emerald-500 transition">
                    Home
                  </Link>
                  <Link to="/find-ride" className="text-gray-700 hover:text-emerald-500 transition">
                    Search Rides
                  </Link>
                  <Link to="/login" className="text-gray-700 hover:text-emerald-500 transition">
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg transition shadow-sm"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation menu"
            >
              <i className={`fas ${mobileMenuOpen ? 'fa-times' : 'fa-bars'} text-xl ${isAdminRoute || adminTheme ? 'text-white' : 'text-gray-700'}`} aria-hidden="true" />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Menu Slide-over */}
      <div 
        ref={mobileMenuRef}
        className={`
          md:hidden fixed top-0 right-0 h-full w-80 max-w-[85vw] z-50
          ${isAdminRoute || adminTheme ? 'bg-indigo-900' : 'bg-white'} 
          shadow-2xl transform transition-transform duration-300 ease-out
          ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Mobile Menu Header */}
        <div className={`flex items-center justify-between p-4 border-b ${isAdminRoute || adminTheme ? 'border-indigo-700' : 'border-gray-200'}`}>
          <span className={`text-lg font-bold ${isAdminRoute || adminTheme ? 'text-white' : 'text-gray-800'}`}>
            Menu
          </span>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className={`p-2 rounded-lg ${isAdminRoute || adminTheme ? 'text-white hover:bg-indigo-800' : 'text-gray-700 hover:bg-gray-100'}`}
            aria-label="Close menu"
          >
            <i className="fas fa-times text-xl" aria-hidden="true" />
          </button>
        </div>

        {/* Mobile Menu Content */}
        <div className="p-4 space-y-2 overflow-y-auto h-[calc(100%-60px)]">
          {isAuthenticated ? (
            <>
              {/* User Info */}
              <div className={`flex items-center p-3 rounded-lg mb-4 ${isAdminRoute || adminTheme ? 'bg-indigo-800' : 'bg-gray-50'}`}>
                {userPhoto ? (
                  <img src={userPhoto} alt={displayName} className="w-12 h-12 rounded-full object-cover mr-3" />
                ) : (
                  <div className={`w-12 h-12 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold mr-3`}>
                    {initials}
                  </div>
                )}
                <div>
                  <p className={`font-semibold ${isAdminRoute || adminTheme ? 'text-white' : 'text-gray-800'}`}>{displayName}</p>
                  <p className={`text-sm ${isAdminRoute || adminTheme ? 'text-indigo-300' : 'text-gray-500'}`}>{user?.email}</p>
                </div>
              </div>

              <MobileNavLink to="/dashboard" icon="fa-tachometer-alt" adminTheme={isAdminRoute || adminTheme}>
                Dashboard
              </MobileNavLink>
              <MobileNavLink to="/find-ride" icon="fa-search" adminTheme={isAdminRoute || adminTheme}>
                Search Rides
              </MobileNavLink>
              {user?.role === 'RIDER' && (
                <>
                  <MobileNavLink to="/post-ride" icon="fa-plus-circle" adminTheme={isAdminRoute || adminTheme}>
                    Post Ride
                  </MobileNavLink>
                  <MobileNavLink to="/my-rides" icon="fa-route" adminTheme={isAdminRoute || adminTheme}>
                    My Rides
                  </MobileNavLink>
                </>
              )}
              <MobileNavLink to="/bookings" icon="fa-ticket-alt" adminTheme={isAdminRoute || adminTheme}>
                My Bookings
              </MobileNavLink>
              <MobileNavLink to="/chat" icon="fa-comments" adminTheme={isAdminRoute || adminTheme} showDot={hasUnread}>
                Messages
              </MobileNavLink>
              <MobileNavLink to="/profile" icon="fa-user" adminTheme={isAdminRoute || adminTheme}>
                Profile
              </MobileNavLink>
              <MobileNavLink to="/notifications" icon="fa-bell" adminTheme={isAdminRoute || adminTheme}>
                Notifications
              </MobileNavLink>
              <MobileNavLink to="/wallet" icon="fa-wallet" adminTheme={isAdminRoute || adminTheme}>
                Wallet
              </MobileNavLink>
              {user?.role === 'RIDER' && (
                <MobileNavLink to="/earnings" icon="fa-chart-line" adminTheme={isAdminRoute || adminTheme}>
                  Earnings
                </MobileNavLink>
              )}
              <MobileNavLink to="/change-password" icon="fa-key" adminTheme={isAdminRoute || adminTheme}>
                Change Password
              </MobileNavLink>

              {hasAdminPanelAccess(user?.role) && (
                <>
                  <hr className={`my-3 ${isAdminRoute || adminTheme ? 'border-indigo-700' : 'border-gray-200'}`} />
                  <MobileNavLink to="/admin/dashboard" icon="fa-shield-alt" adminTheme={isAdminRoute || adminTheme}>
                    Admin Panel
                  </MobileNavLink>
                </>
              )}

              <hr className={`my-3 ${isAdminRoute || adminTheme ? 'border-indigo-700' : 'border-gray-200'}`} />
              <button
                onClick={handleLogout}
                className="w-full flex items-center p-3 rounded-lg text-red-500 hover:bg-red-50"
              >
                <i className="fas fa-sign-out-alt w-6" aria-hidden="true" />
                <span className="ml-2">Logout</span>
              </button>
            </>
          ) : (
            <>
              <MobileNavLink to="/" icon="fa-home" adminTheme={false}>
                Home
              </MobileNavLink>
              <MobileNavLink to="/find-ride" icon="fa-search" adminTheme={false}>
                Search Rides
              </MobileNavLink>
              <MobileNavLink to="/login" icon="fa-sign-in-alt" adminTheme={false}>
                Login
              </MobileNavLink>
              <Link
                to="/register"
                className="block w-full text-center bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-semibold mt-4"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </>
  )
}

// Mobile Nav Link Component
const MobileNavLink = ({ to, icon, children, adminTheme, showDot }) => {
  const location = useLocation()
  const isActive = location.pathname === to
  
  return (
    <Link
      to={to}
      className={`
        flex items-center p-3 rounded-lg transition relative
        ${isActive 
          ? (adminTheme ? 'bg-indigo-800 text-white' : 'bg-emerald-50 text-emerald-600') 
          : (adminTheme ? 'text-white hover:bg-indigo-800' : 'text-gray-700 hover:bg-gray-100')
        }
      `}
    >
      <span className="relative">
        <i className={`fas ${icon} w-6`} aria-hidden="true" />
        {showDot && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
        )}
      </span>
      <span className="ml-2">{children}</span>
      {isActive && <i className="fas fa-chevron-right ml-auto text-sm" aria-hidden="true" />}
    </Link>
  )
}

export default Navbar
