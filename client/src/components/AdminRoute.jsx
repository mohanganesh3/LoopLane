import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * AdminRoute - Route guard for admin-only pages
 * Checks if user is authenticated AND has admin role
 */
const AdminRoute = ({ children }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking auth status
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // Redirect to admin login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  // Redirect to user dashboard if not an admin
  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated and is an admin
  return children;
};

export default AdminRoute;
