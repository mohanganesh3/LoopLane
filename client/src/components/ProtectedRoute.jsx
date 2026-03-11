import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from './common';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * ProtectedRoute - Route guard for authenticated users
 * Redirects to login if user is not authenticated or suspended
 */
const ProtectedRoute = ({ children }) => {
  const { user, loading, isAuthenticated, logout, refreshUser } = useAuth();
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const lastRefreshRef = useRef(0);
  const suspensionHandledRef = useRef(false);

  // Memoize logout to prevent infinite effect re-runs
  const stableLogout = useCallback(logout, []);

  // Check user status on mount and throttled on route changes
  useEffect(() => {
    let cancelled = false;

    const checkUserStatus = async () => {
      if (!isAuthenticated) {
        setChecking(false);
        return;
      }

      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshRef.current;

      // Only call refreshUser if enough time has passed (throttle to 5 min)
      if (timeSinceLastRefresh < REFRESH_INTERVAL_MS) {
        setChecking(false);
        return;
      }

      try {
        lastRefreshRef.current = now;
        const updatedUser = await refreshUser();
        if (cancelled) return;

        if (updatedUser) {
          if (updatedUser.accountStatus === 'SUSPENDED' || updatedUser.isSuspended) {
            console.warn('Account suspended:', updatedUser.suspensionReason || 'Policy violation');
            await stableLogout();
            return;
          }
          if (updatedUser.accountStatus === 'DELETED') {
            console.warn('Account deleted');
            await stableLogout();
            return;
          }
        }
      } catch (error) {
        // If refresh fails with 403, the API interceptor will handle logout
        console.log('User status check failed:', error.message);
      }

      if (!cancelled) setChecking(false);
    };

    checkUserStatus();
    return () => { cancelled = true; };
  }, [isAuthenticated, location.pathname, refreshUser, stableLogout]);

  // Check cached user data for suspension (no API call)
  useEffect(() => {
    if (!user || suspensionHandledRef.current) return;

    const isSuspended = user.accountStatus === 'SUSPENDED' || user.isSuspended;
    const isDeleted = user.accountStatus === 'DELETED';

    if (isSuspended || isDeleted) {
      suspensionHandledRef.current = true;
      console.warn(isSuspended ? 'Account suspended — logging out' : 'Account deleted — logging out');
      stableLogout();
    }
  }, [user, stableLogout]);

  // Show loading spinner while checking auth status
  if (loading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check account status - redirect if suspended or deleted
  if (user?.accountStatus === 'SUSPENDED' || user?.isSuspended || user?.accountStatus === 'DELETED') {
    return <Navigate to="/login" replace />;
  }

  // User is authenticated and account is active
  return children;
};

export default ProtectedRoute;
