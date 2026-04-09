import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasAdminPanelAccess } from '../utils/roles';

/**
 * AdminRoute - Route guard for admin-only pages
 * Checks if user is authenticated AND has admin role
 */
const AdminRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth check is still in progress
  // (loading = true until the initial checkAuth completes)
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Also wait if user is not yet populated but we haven't finished checking
  // This prevents flashing a redirect before the auth cookie is validated
  if (!isAuthenticated && !user && loading === false) {
    // Auth check finished and user is genuinely not authenticated
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Check for suspended/deleted accounts
  if (user?.accountStatus === 'SUSPENDED' || user?.isSuspended || user?.accountStatus === 'DELETED') {
    return <Navigate to="/admin/login" replace />;
  }

  // Redirect to user dashboard if not an admin
  if (!hasAdminPanelAccess(user?.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated and is an admin
  return children;
};

export default AdminRoute;
