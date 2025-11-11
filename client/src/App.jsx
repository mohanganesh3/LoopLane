import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/layout/Layout';

// User Pages
import Home from './pages/user/Home';
import Login from './pages/user/Login';
import Register from './pages/user/Register';
import Dashboard from './pages/user/Dashboard';
import PostRide from './pages/user/PostRide';
import FindRide from './pages/user/FindRide';
import SearchResults from './pages/user/SearchResults';
import RideDetails from './pages/user/RideDetails';
import MyRides from './pages/user/MyRides';
import Bookings from './pages/user/Bookings';
import Profile from './pages/user/Profile';
import Chat from './pages/user/Chat';
import Reviews from './pages/user/Reviews';
import Notifications from './pages/user/Notifications';
import LicenseUpload from './pages/user/LicenseUpload';
import Payment from './pages/user/Payment';
import Tracking from './pages/user/Tracking';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import UserManagement from './pages/admin/UserManagement';
import RideManagement from './pages/admin/RideManagement';
import Reports from './pages/admin/Reports';
import LicenseVerification from './pages/admin/LicenseVerification';

// Protected Route Component
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* User Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/post-ride" element={
              <ProtectedRoute>
                <Layout>
                  <PostRide />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/find-ride" element={
              <ProtectedRoute>
                <Layout>
                  <FindRide />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/search" element={
              <ProtectedRoute>
                <Layout>
                  <SearchResults />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/ride/:id" element={
              <ProtectedRoute>
                <Layout>
                  <RideDetails />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/my-rides" element={
              <ProtectedRoute>
                <Layout>
                  <MyRides />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/bookings" element={
              <ProtectedRoute>
                <Layout>
                  <Bookings />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Layout>
                  <Profile />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/chat" element={
              <ProtectedRoute>
                <Layout>
                  <Chat />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/chat/:recipientId" element={
              <ProtectedRoute>
                <Layout>
                  <Chat />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/reviews" element={
              <ProtectedRoute>
                <Layout>
                  <Reviews />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Layout>
                  <Notifications />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/license-upload" element={
              <ProtectedRoute>
                <Layout>
                  <LicenseUpload />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/payment/:bookingId" element={
              <ProtectedRoute>
                <Layout>
                  <Payment />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/tracking/:rideId" element={
              <ProtectedRoute>
                <Layout>
                  <Tracking />
                </Layout>
              </ProtectedRoute>
            } />
            
            {/* Admin Routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={
              <AdminRoute>
                <Layout adminTheme>
                  <AdminDashboard />
                </Layout>
              </AdminRoute>
            } />
            <Route path="/admin/users" element={
              <AdminRoute>
                <Layout adminTheme>
                  <UserManagement />
                </Layout>
              </AdminRoute>
            } />
            <Route path="/admin/rides" element={
              <AdminRoute>
                <Layout adminTheme>
                  <RideManagement />
                </Layout>
              </AdminRoute>
            } />
            <Route path="/admin/reports" element={
              <AdminRoute>
                <Layout adminTheme>
                  <Reports />
                </Layout>
              </AdminRoute>
            } />
            <Route path="/admin/licenses" element={
              <AdminRoute>
                <Layout adminTheme>
                  <LicenseVerification />
                </Layout>
              </AdminRoute>
            } />
            
            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
