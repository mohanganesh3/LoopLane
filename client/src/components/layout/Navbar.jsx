import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function Navbar({ adminTheme = false }) {
  const { user, logout, isAuthenticated } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { credentials: 'include' })
      logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // Admin navigation links
  const adminNavLinks = [
    { to: '/admin/dashboard', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/rides', label: 'Rides' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/licenses', label: 'Verifications' },
  ]

  return (
    <nav className={`${isAdminRoute || adminTheme ? 'bg-indigo-900' : 'bg-white'} shadow-lg fixed w-full top-0 z-50`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to={isAdminRoute ? '/admin/dashboard' : '/'} className="flex items-center space-x-2">
            <span className={`text-2xl ${isAdminRoute || adminTheme ? 'text-white' : 'text-emerald-500'}`}>🚗</span>
            <span className={`text-2xl font-bold ${isAdminRoute || adminTheme ? 'text-white' : 'text-gray-800'}`}>
              {isAdminRoute || adminTheme ? 'LOOPLANE Admin' : 'LOOPLANE'}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {(isAdminRoute || adminTheme) && user?.role === 'admin' ? (
              <>
                {adminNavLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`text-white/80 hover:text-white transition ${
                      location.pathname === link.to ? 'text-white font-semibold' : ''
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  to="/dashboard"
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition"
                >
                  User Mode
                </Link>
              </>
            ) : isAuthenticated ? (
              <>
                <Link to="/find-ride" className="text-gray-700 hover:text-emerald-500 transition">
                  Search Rides
                </Link>
                
                {user?.role === 'RIDER' && (
                  <>
                    <Link to="/post-ride" className="text-gray-700 hover:text-emerald-500 transition">
                      Post Ride
                    </Link>
                    <Link to="/my-rides" className="text-gray-700 hover:text-emerald-500 transition">
                      My Rides
                    </Link>
                  </>
                )}
                
                <Link to="/bookings" className="text-gray-700 hover:text-emerald-500 transition">
                  My Bookings
                </Link>
                
                <Link to="/chat" className="text-gray-700 hover:text-emerald-500 transition">
                  Messages
                </Link>

                {/* User Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 text-gray-700 hover:text-emerald-500"
                  >
                    <img
                      src={user.profile?.photo || '/images/default-avatar.png'}
                      alt={user.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <span>{user.profile?.firstName || 'User'}</span>
                  </button>

                  {userMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl py-2 z-50">
                      <Link to="/dashboard" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                        Dashboard
                      </Link>
                      <Link to="/profile" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                        Profile
                      </Link>
                      <Link to="/notifications" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                        Notifications
                      </Link>
                      <Link to="/reviews" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                        My Reviews
                      </Link>
                      {user.role === 'admin' && (
                        <>
                          <hr className="my-2" />
                          <Link to="/admin/dashboard" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                            Admin Panel
                          </Link>
                        </>
                      )}
                      <hr className="my-2" />
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50"
                      >
                        Logout
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
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg transition"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-gray-700"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <span className="text-2xl">☰</span>
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className={`md:hidden ${isAdminRoute || adminTheme ? 'bg-indigo-800' : 'bg-white'} border-t`}>
          <div className="px-4 py-4 space-y-3">
            {isAuthenticated ? (
              <>
                <Link to="/find-ride" className={`block ${isAdminRoute || adminTheme ? 'text-white' : 'text-gray-700'} hover:text-emerald-500`}>
                  Search Rides
                </Link>
                {user?.role === 'RIDER' && (
                  <>
                    <Link to="/post-ride" className={`block ${isAdminRoute || adminTheme ? 'text-white' : 'text-gray-700'} hover:text-emerald-500`}>
                      Post Ride
                    </Link>
                    <Link to="/my-rides" className={`block ${isAdminRoute || adminTheme ? 'text-white' : 'text-gray-700'} hover:text-emerald-500`}>
                      My Rides
                    </Link>
                  </>
                )}
                <Link to="/bookings" className={`block ${isAdminRoute || adminTheme ? 'text-white' : 'text-gray-700'} hover:text-emerald-500`}>
                  My Bookings
                </Link>
                <Link to="/dashboard" className={`block ${isAdminRoute || adminTheme ? 'text-white' : 'text-gray-700'} hover:text-emerald-500`}>
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="block w-full text-left text-red-600 hover:text-red-700"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="block text-gray-700 hover:text-emerald-500">
                  Login
                </Link>
                <Link to="/register" className="block text-emerald-500 hover:text-emerald-600">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

export default Navbar
