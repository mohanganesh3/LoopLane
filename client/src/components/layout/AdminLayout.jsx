import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getUserDisplayName, getUserPhoto, getInitials, getAvatarColor } from '../../utils/imageHelpers';

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/login');
    }
  };

  const navItems = [
    { path: '/admin/dashboard', icon: 'fa-chart-line', label: 'Dashboard', description: 'Overview & stats' },
    { path: '/admin/users', icon: 'fa-users', label: 'Users', description: 'Manage users' },
    { path: '/admin/verifications', icon: 'fa-user-check', label: 'Verifications', description: 'Driver approvals' },
    { path: '/admin/rides', icon: 'fa-car-side', label: 'Rides', description: 'All rides' },
    { path: '/admin/bookings', icon: 'fa-clipboard-list', label: 'Bookings', description: 'All bookings' },
    { path: '/admin/safety', icon: 'fa-exclamation-triangle', label: 'Safety', description: 'Emergency alerts' },
  ];

  const isActive = (path) => {
    if (path === '/admin/dashboard') {
      return location.pathname === '/admin/dashboard' || location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const displayName = getUserDisplayName(user);
  const userPhoto = getUserPhoto(user);
  const initials = getInitials(displayName);
  const avatarColor = getAvatarColor(displayName);

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} bg-gradient-to-b from-indigo-900 via-indigo-800 to-purple-900 text-white fixed h-full z-40 transition-all duration-300 shadow-xl`}>
        {/* Logo */}
        <div className="p-4 border-b border-indigo-700/50">
          <Link to="/admin/dashboard" className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <i className="fas fa-car-side text-xl text-white"></i>
            </div>
            {!sidebarCollapsed && (
              <div>
                <h1 className="text-xl font-bold">LOOPLANE</h1>
                <p className="text-xs text-indigo-300">Admin Panel</p>
              </div>
            )}
          </Link>
        </div>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute -right-3 top-20 w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg hover:bg-indigo-500 transition"
        >
          <i className={`fas fa-chevron-${sidebarCollapsed ? 'right' : 'left'} text-xs`}></i>
        </button>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                isActive(item.path)
                  ? 'bg-white/20 shadow-lg'
                  : 'hover:bg-white/10'
              }`}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <i className={`fas ${item.icon} text-lg ${isActive(item.path) ? 'scale-110' : 'group-hover:scale-110'} transition-transform`}></i>
              {!sidebarCollapsed && (
                <div>
                  <p className="font-medium">{item.label}</p>
                  <p className="text-xs text-indigo-300">{item.description}</p>
                </div>
              )}
              {isActive(item.path) && !sidebarCollapsed && (
                <div className="ml-auto w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
              )}
            </Link>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-4 my-4 border-t border-indigo-700/50"></div>

        {/* Quick Actions */}
        {!sidebarCollapsed && (
          <div className="px-4 space-y-2">
            <p className="text-xs text-indigo-400 uppercase tracking-wider mb-2">Quick Actions</p>
            <Link
              to="/dashboard"
              className="flex items-center space-x-3 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition text-sm"
            >
              <i className="fas fa-arrow-left"></i>
              <span>User Dashboard</span>
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 transition text-sm text-red-300"
            >
              <i className="fas fa-sign-out-alt"></i>
              <span>Logout</span>
            </button>
          </div>
        )}

        {/* User Profile at Bottom */}
        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t border-indigo-700/50 bg-indigo-900/50`}>
          <div className="flex items-center space-x-3">
            {userPhoto ? (
              <img
                src={userPhoto}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full ${avatarColor} flex items-center justify-center text-white font-bold border-2 border-emerald-400`}>
                {initials}
              </div>
            )}
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{displayName}</p>
                <p className="text-xs text-indigo-300 truncate">{user?.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 ${sidebarCollapsed ? 'ml-20' : 'ml-64'} transition-all duration-300`}>
        {/* Top Header */}
        <header className="bg-white shadow-sm sticky top-0 z-30">
          <div className="px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                {navItems.find(item => isActive(item.path))?.label || 'Admin'}
              </h2>
              <p className="text-sm text-gray-500">
                {navItems.find(item => isActive(item.path))?.description || 'Manage your platform'}
              </p>
            </div>

            <div className="flex items-center space-x-4">
              {/* User Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition"
                >
                  {userPhoto ? (
                    <img src={userPhoto} alt={displayName} className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className={`w-8 h-8 rounded-full ${avatarColor} flex items-center justify-center text-white text-sm font-bold`}>
                      {initials}
                    </div>
                  )}
                  <span className="text-gray-700 font-medium">{displayName?.split(' ')[0]}</span>
                  <i className="fas fa-chevron-down text-xs text-gray-500"></i>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl py-2 z-50 border">
                    <Link to="/profile" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-50">
                      <i className="fas fa-user mr-3 text-gray-400"></i>Profile
                    </Link>
                    <Link to="/dashboard" className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-50">
                      <i className="fas fa-home mr-3 text-gray-400"></i>User Dashboard
                    </Link>
                    <hr className="my-2" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center px-4 py-2 text-red-600 hover:bg-red-50"
                    >
                      <i className="fas fa-sign-out-alt mr-3"></i>Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
