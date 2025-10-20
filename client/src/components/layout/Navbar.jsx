import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

function Navbar() {
  const { user, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { credentials: 'include' })
      logout()
      navigate('/login')
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <nav className="bg-white shadow-lg fixed w-full top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-primary text-2xl">🚗</span>
            <span className="text-2xl font-bold text-gray-800">LANE</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-6">
            {user ? (
              <>
                <Link to="/rides/search" className="text-gray-700 hover:text-primary transition">
                  Search Rides
                </Link>
                
                {user.role === 'RIDER' && (
                  <>
                    <Link to="/rides/post" className="text-gray-700 hover:text-primary transition">
                      Post Ride
                    </Link>
                    <Link to="/rides/my-rides" className="text-gray-700 hover:text-primary transition">
                      My Rides
                    </Link>
                  </>
                )}
                
                <Link to="/bookings" className="text-gray-700 hover:text-primary transition">
                  My Bookings
                </Link>
                
                <Link to="/chat" className="text-gray-700 hover:text-primary transition">
                  Messages
                </Link>

                {/* User Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                    className="flex items-center space-x-2 text-gray-700 hover:text-primary"
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
                      <Link to="/settings" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
                        Settings
                      </Link>
                      {user.role === 'ADMIN' && (
                        <>
                          <hr className="my-2" />
                          <Link to="/admin" className="block px-4 py-2 text-gray-700 hover:bg-gray-100">
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

                {/* SOS Button */}
                <Link
                  to="/sos"
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
                >
                  SOS
                </Link>
              </>
            ) : (
              <>
                <Link to="/" className="text-gray-700 hover:text-primary transition">
                  Home
                </Link>
                <Link to="/rides/search" className="text-gray-700 hover:text-primary transition">
                  Search Rides
                </Link>
                <Link to="/login" className="text-gray-700 hover:text-primary transition">
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-primary hover:bg-green-600 text-white px-6 py-2 rounded-lg transition"
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
        <div className="md:hidden bg-white border-t">
          <div className="px-4 py-4 space-y-3">
            {user ? (
              <>
                <Link to="/rides/search" className="block text-gray-700 hover:text-primary">
                  Search Rides
                </Link>
                {user.role === 'RIDER' && (
                  <>
                    <Link to="/rides/post" className="block text-gray-700 hover:text-primary">
                      Post Ride
                    </Link>
                    <Link to="/rides/my-rides" className="block text-gray-700 hover:text-primary">
                      My Rides
                    </Link>
                  </>
                )}
                <Link to="/bookings" className="block text-gray-700 hover:text-primary">
                  My Bookings
                </Link>
                <Link to="/dashboard" className="block text-gray-700 hover:text-primary">
                  Dashboard
                </Link>
                <Link
                  to="/sos"
                  className="block bg-red-600 text-white text-center py-2 rounded-lg"
                >
                  SOS Emergency
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
                <Link to="/login" className="block text-gray-700 hover:text-primary">
                  Login
                </Link>
                <Link to="/register" className="block text-primary hover:text-green-600">
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
