import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import Layout from './components/layout/Layout';
import AdminLayout from './components/layout/AdminLayout';
import ReassignmentAlert from './components/common/ReassignmentAlert';
import { useSmoothScroll } from './hooks/useSmoothScroll';

// Auth Pages
import { Login, Register, VerifyOtp, ForgotPassword, ResetPassword } from './pages/auth';

// Home Page
import { Home } from './pages/home';

// User Pages
import { Dashboard, Profile, Notifications, LicenseUpload, Reviews, Settings, TripHistory, CarbonReport, EmergencyContacts, CompleteProfile, DocumentUpload } from './pages/user';

// Rides Pages
import { PostRide, SearchRides, RideDetails, MyRides, EditRide } from './pages/rides';

// Bookings Pages
import { MyBookings, BookingDetails, Payment, RateBooking, PaymentSuccess, PaymentFailed } from './pages/bookings';

// Chat Pages
import { Chat } from './pages/chat';

// Tracking Pages
import { LiveTracking, Safety, DriverTracking } from './pages/tracking';

// Admin Pages
import { AdminDashboard, AdminUsers, AdminUserDetails, AdminRides, AdminRideDetails, AdminVerifications, AdminBookings, AdminBookingDetails, AdminSafety } from './pages/admin';

// 404 Page
import NotFound from './pages/NotFound';

// Protected Route Components
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// Smooth scroll wrapper - must be inside Router since useSmoothScroll uses useLocation
function SmoothScrollWrapper({ children }) {
  useSmoothScroll();
  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <ToastProvider>
              <Router>
                {/* Initialize smooth scroll inside Router context */}
                <SmoothScrollWrapper>
                  {/* Global Reassignment Alert Modal */}
                  <ReassignmentAlert />

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
                    <Route path="/rides/:id" element={
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
                    <Route path="/edit-ride/:id" element={
                      <ProtectedRoute>
                        <Layout>
                          <EditRide />
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
                    <Route path="/bookings/:id" element={
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
                        <Layout showFooter={false}>
                          <Chat />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/chat/:recipientId" element={
                      <ProtectedRoute>
                        <Layout showFooter={false}>
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
                    <Route path="/complete-profile" element={
                      <ProtectedRoute>
                        <Layout>
                          <CompleteProfile />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/user/documents" element={
                      <ProtectedRoute>
                        <Layout>
                          <DocumentUpload />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/settings" element={
                      <ProtectedRoute>
                        <Layout>
                          <Settings />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/trip-history" element={
                      <ProtectedRoute>
                        <Layout>
                          <TripHistory />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/carbon-report" element={
                      <ProtectedRoute>
                        <Layout>
                          <CarbonReport />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/emergency-contacts" element={
                      <ProtectedRoute>
                        <Layout>
                          <EmergencyContacts />
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
                    <Route path="/tracking/:bookingId" element={
                      <ProtectedRoute>
                        <Layout>
                          <LiveTracking />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/tracking/:bookingId/safety" element={
                      <ProtectedRoute>
                        <Safety />
                      </ProtectedRoute>
                    } />
                    <Route path="/driver-tracking/:rideId" element={
                      <ProtectedRoute>
                        <Layout>
                          <DriverTracking />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/bookings/:id/rate" element={
                      <ProtectedRoute>
                        <Layout>
                          <RateBooking />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/bookings/:bookingId/payment" element={
                      <ProtectedRoute>
                        <Layout>
                          <Payment />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/bookings/:bookingId/success" element={
                      <ProtectedRoute>
                        <Layout>
                          <PaymentSuccess />
                        </Layout>
                      </ProtectedRoute>
                    } />
                    <Route path="/bookings/:bookingId/failed" element={
                      <ProtectedRoute>
                        <Layout>
                          <PaymentFailed />
                        </Layout>
                      </ProtectedRoute>
                    } />

                    {/* Admin Routes */}
                    <Route path="/admin/login" element={<Login />} />
                    <Route path="/admin" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminDashboard />
                        </AdminLayout>
                      </AdminRoute>
                    } />
                    <Route path="/admin/dashboard" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminDashboard />
                        </AdminLayout>
                      </AdminRoute>
                    } />
                    <Route path="/admin/users" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminUsers />
                        </AdminLayout>
                      </AdminRoute>
                    } />
                    <Route path="/admin/users/:id" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminUserDetails />
                        </AdminLayout>
                      </AdminRoute>
                    } />
                    <Route path="/admin/rides" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminRides />
                        </AdminLayout>
                      </AdminRoute>
                    } />
                    <Route path="/admin/rides/:id" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminRideDetails />
                        </AdminLayout>
                      </AdminRoute>
                    } />
                    <Route path="/admin/licenses" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminVerifications />
                        </AdminLayout>
                      </AdminRoute>
                    } />
                    <Route path="/admin/verifications" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminVerifications />
                        </AdminLayout>
                      </AdminRoute>
                    } />
                    <Route path="/admin/bookings" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminBookings />
                        </AdminLayout>
                      </AdminRoute>
                    } />
                    <Route path="/admin/bookings/:id" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminBookingDetails />
                        </AdminLayout>
                      </AdminRoute>
                    } />
                    <Route path="/admin/safety" element={
                      <AdminRoute>
                        <AdminLayout>
                          <AdminSafety />
                        </AdminLayout>
                      </AdminRoute>
                    } />

                    {/* Fallback - 404 Page */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </SmoothScrollWrapper>
              </Router>
            </ToastProvider>
          </NotificationProvider>
        </SocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
