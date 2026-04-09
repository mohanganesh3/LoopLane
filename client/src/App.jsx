import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './components/common/Toast';
import ErrorBoundary from './components/common/ErrorBoundary';
import Layout from './components/layout/Layout';
import AdminLayout from './components/layout/AdminLayout';
import ReassignmentAlert from './components/common/ReassignmentAlert';

// Protected Route Components (small, must be eager)
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';

// ---------- Lazy-loaded Pages (code-split per page) ----------

// Auth
const Login = React.lazy(() => import('./pages/auth/Login'));
const Register = React.lazy(() => import('./pages/auth/Register'));
const VerifyOtp = React.lazy(() => import('./pages/auth/VerifyOtp'));
const ForgotPassword = React.lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./pages/auth/ResetPassword'));
const ChangePassword = React.lazy(() => import('./pages/auth/ChangePassword'));

// Home & Legal
const Home = React.lazy(() => import('./pages/home/Home'));
const TermsOfService = React.lazy(() => import('./pages/legal/TermsOfService'));
const PrivacyPolicy = React.lazy(() => import('./pages/legal/PrivacyPolicy'));
const ContactSupport = React.lazy(() => import('./pages/legal/ContactSupport'));

// User
const Dashboard = React.lazy(() => import('./pages/user/Dashboard'));
const Profile = React.lazy(() => import('./pages/user/Profile'));
const Notifications = React.lazy(() => import('./pages/user/Notifications'));
const LicenseUpload = React.lazy(() => import('./pages/user/LicenseUpload'));
const Reviews = React.lazy(() => import('./pages/user/Reviews'));
const Settings = React.lazy(() => import('./pages/user/Settings'));
const TripHistory = React.lazy(() => import('./pages/user/TripHistory'));
const CarbonReport = React.lazy(() => import('./pages/user/CarbonReport'));
const EmergencyContacts = React.lazy(() => import('./pages/user/EmergencyContacts'));
const CompleteProfile = React.lazy(() => import('./pages/user/CompleteProfile'));
const DocumentUpload = React.lazy(() => import('./pages/user/DocumentUpload'));
const MyReports = React.lazy(() => import('./pages/user/MyReports'));
const Wallet = React.lazy(() => import('./pages/user/Wallet'));
const Earnings = React.lazy(() => import('./pages/user/Earnings'));
const Badges = React.lazy(() => import('./pages/user/Badges'));
const RouteAlerts = React.lazy(() => import('./pages/user/RouteAlerts'));
const RouteSuggestions = React.lazy(() => import('./pages/user/RouteSuggestions'));

// Rides
const PostRide = React.lazy(() => import('./pages/rides/PostRide'));
const SearchRides = React.lazy(() => import('./pages/rides/SearchRides'));
const RideDetails = React.lazy(() => import('./pages/rides/RideDetails'));
const MyRides = React.lazy(() => import('./pages/rides/MyRides'));
const EditRide = React.lazy(() => import('./pages/rides/EditRide'));

// Bookings
const MyBookings = React.lazy(() => import('./pages/bookings/MyBookings'));
const BookingDetails = React.lazy(() => import('./pages/bookings/BookingDetails'));
const Payment = React.lazy(() => import('./pages/bookings/Payment'));
const RateBooking = React.lazy(() => import('./pages/bookings/RateBooking'));
const PaymentSuccess = React.lazy(() => import('./pages/bookings/PaymentSuccess'));
const PaymentFailed = React.lazy(() => import('./pages/bookings/PaymentFailed'));

// Chat
const Chat = React.lazy(() => import('./pages/chat/Chat'));

// Tracking
const LiveTracking = React.lazy(() => import('./pages/tracking/LiveTracking'));
const Safety = React.lazy(() => import('./pages/tracking/Safety'));
const SOS = React.lazy(() => import('./pages/tracking/SOS'));
const DriverTracking = React.lazy(() => import('./pages/tracking/DriverTracking'));

// Admin
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const AdminUsers = React.lazy(() => import('./pages/admin/AdminUsers'));
const AdminUserDetails = React.lazy(() => import('./pages/admin/AdminUserDetails'));
const AdminRides = React.lazy(() => import('./pages/admin/AdminRides'));
const AdminRideDetails = React.lazy(() => import('./pages/admin/AdminRideDetails'));
const AdminVerifications = React.lazy(() => import('./pages/admin/AdminVerifications'));
const AdminBookings = React.lazy(() => import('./pages/admin/AdminBookings'));
const AdminBookingDetails = React.lazy(() => import('./pages/admin/AdminBookingDetails'));
const AdminSafety = React.lazy(() => import('./pages/admin/AdminSafety'));
const AdminReports = React.lazy(() => import('./pages/admin/AdminReports'));
const AdminAnalytics = React.lazy(() => import('./pages/admin/AdminAnalytics'));
const AdminEmployees = React.lazy(() => import('./pages/admin/AdminEmployees'));
const AdminAuditLogs = React.lazy(() => import('./pages/admin/AdminAuditLogs'));
const AdminSettings = React.lazy(() => import('./pages/admin/AdminSettings'));
const AdminGeoFencing = React.lazy(() => import('./pages/admin/AdminGeoFencing'));
const AdminBirdEye = React.lazy(() => import('./pages/admin/BirdEyeView'));
const AdminFinancials = React.lazy(() => import('./pages/admin/AdminFinancials'));
const AdminFraud = React.lazy(() => import('./pages/admin/AdminFraud'));
const AdminChurn = React.lazy(() => import('./pages/admin/AdminChurn'));
const AdminPromoCodes = React.lazy(() => import('./pages/admin/AdminPromoCodes'));
const AdminSustainability = React.lazy(() => import('./pages/admin/AdminSustainability'));
const AdminPricing = React.lazy(() => import('./pages/admin/AdminPricing'));
const AdminHealth = React.lazy(() => import('./pages/admin/AdminHealth'));
const AICommandCenter = React.lazy(() => import('./pages/admin/AICommandCenter'));

const NotFound = React.lazy(() => import('./pages/NotFound'));

// Suspense fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SocketProvider>
          <NotificationProvider>
            <ToastProvider>
              <Router>
                {/* Global Reassignment Alert Modal */}
                <ReassignmentAlert />
                
                <Suspense fallback={<PageLoader />}>
                <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify-otp" element={<VerifyOtp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/support" element={
                  <Layout>
                    <ContactSupport />
                  </Layout>
                } />
                <Route path="/contact" element={<Navigate to="/support" replace />} />
                <Route path="/terms" element={
                  <Layout>
                    <TermsOfService />
                  </Layout>
                } />
                <Route path="/terms-of-service" element={<Navigate to="/terms" replace />} />
                <Route path="/privacy" element={
                  <Layout>
                    <PrivacyPolicy />
                  </Layout>
                } />
                <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />
                
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
              <Route path="/search" element={<Navigate to="/find-ride" replace />} />
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
              <Route path="/my-reports" element={
                <ProtectedRoute>
                  <Layout>
                    <MyReports />
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
              <Route path="/change-password" element={
                <ProtectedRoute>
                  <Layout>
                    <ChangePassword />
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
              <Route path="/wallet" element={
                <ProtectedRoute>
                  <Layout>
                    <Wallet />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/earnings" element={
                <ProtectedRoute>
                  <Layout>
                    <Earnings />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/badges" element={
                <ProtectedRoute>
                  <Layout>
                    <Badges />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/route-alerts" element={
                <ProtectedRoute>
                  <Layout>
                    <RouteAlerts />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/route-suggestions" element={
                <ProtectedRoute>
                  <Layout>
                    <RouteSuggestions />
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
              {/* /payment/:bookingId redirects to canonical path */}
              <Route path="/tracking/:bookingId" element={
                <ProtectedRoute>
                  <Layout>
                    <LiveTracking />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/tracking/:bookingId/safety" element={
                <ProtectedRoute>
                  <Layout>
                    <Safety />
                  </Layout>
                </ProtectedRoute>
              } />
              <Route path="/tracking/:bookingId/sos" element={
                <ProtectedRoute>
                  <Layout>
                    <SOS />
                  </Layout>
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
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
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
              <Route path="/admin/licenses" element={<Navigate to="/admin/verifications" replace />} />
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
              <Route path="/admin/reports" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminReports />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/analytics" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminAnalytics />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/financials" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminFinancials />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/employees" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminEmployees />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/audit-logs" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminAuditLogs />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/settings" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminSettings />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/geo-fencing" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminGeoFencing />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/fraud" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminFraud />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/churn" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminChurn />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/promo-codes" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminPromoCodes />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/sustainability" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminSustainability />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/pricing" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminPricing />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/health" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminHealth />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/ai" element={
                <AdminRoute>
                  <AdminLayout>
                    <AICommandCenter />
                  </AdminLayout>
                </AdminRoute>
              } />
              <Route path="/admin/gods-eye" element={<Navigate to="/admin/bird-eye" replace />} />
              <Route path="/admin/bird-eye" element={
                <AdminRoute>
                  <AdminLayout>
                    <AdminBirdEye />
                  </AdminLayout>
                </AdminRoute>
              } />
              
              {/* Fallback */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </Router>
          </ToastProvider>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
