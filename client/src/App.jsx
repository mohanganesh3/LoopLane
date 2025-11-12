import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/layout/Layout';

// Auth Pages
import { Login, Register, VerifyOtp, ForgotPassword, ResetPassword } from './pages/auth';

// Home Page
import { Home } from './pages/home';

// User Pages
import { Dashboard, Profile, Notifications, LicenseUpload, Reviews } from './pages/user';

// Rides Pages
import { PostRide, SearchRides, RideDetails, MyRides } from './pages/rides';

// Bookings Pages
import { MyBookings, BookingDetails, Payment } from './pages/bookings';

// Chat Pages
import { Chat } from './pages/chat';

// Tracking Pages
import { LiveTracking } from './pages/tracking';

// Admin Pages
import { AdminDashboard, AdminUsers, AdminRides, AdminReports, AdminVerifications } from './pages/admin';

// Protected Route Components
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-otp" element={<VerifyOtp />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
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
                    <SearchRides />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/search" element={
                <ProtectedRoute>
                  <Layout>
                    <SearchRides />
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
                    <MyBookings />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/booking/:id" element={
                <ProtectedRoute>
                  <Layout>
                    <BookingDetails />
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
                    <LiveTracking />
                  </Layout>
                </ProtectedRoute>
              } />
              
              {/* Admin Routes */}
              <Route path="/admin/login" element={<Login />} />
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
                    <AdminUsers />
                  </Layout>
                </AdminRoute>
              } />
              <Route path="/admin/rides" element={
                <AdminRoute>
                  <Layout adminTheme>
                    <AdminRides />
                  </Layout>
                </AdminRoute>
              } />
              <Route path="/admin/reports" element={
                <AdminRoute>
                  <Layout adminTheme>
                    <AdminReports />
                  </Layout>
                </AdminRoute>
              } />
              <Route path="/admin/licenses" element={
                <AdminRoute>
                  <Layout adminTheme>
                    <AdminVerifications />
                  </Layout>
                </AdminRoute>
              } />
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Router>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
