import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/layout';
import { Login, Register, VerifyOtp, ForgotPassword, ResetPassword } from './pages/auth';

// Placeholder components for routes not yet implemented
const Placeholder = ({ title }) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{title}</h1>
      <p className="text-gray-600">Coming soon...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth Routes - No Layout */}
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/verify-otp" element={<VerifyOtp />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />

          {/* Public Routes with Layout */}
          <Route path="/" element={<Layout><Placeholder title="Home Page" /></Layout>} />

          {/* Protected Routes - User */}
          <Route path="/user/dashboard" element={<Layout><Placeholder title="Dashboard" /></Layout>} />
          <Route path="/user/profile" element={<Layout><Placeholder title="Profile" /></Layout>} />
          <Route path="/user/settings" element={<Layout><Placeholder title="Settings" /></Layout>} />

          {/* Rides */}
          <Route path="/rides/search" element={<Layout><Placeholder title="Search Rides" /></Layout>} />
          <Route path="/rides/post" element={<Layout><Placeholder title="Post a Ride" /></Layout>} />
          <Route path="/rides/my-rides" element={<Layout><Placeholder title="My Rides" /></Layout>} />
          <Route path="/rides/:id" element={<Layout><Placeholder title="Ride Details" /></Layout>} />

          {/* Bookings */}
          <Route path="/bookings" element={<Layout><Placeholder title="My Bookings" /></Layout>} />
          <Route path="/bookings/:id" element={<Layout><Placeholder title="Booking Details" /></Layout>} />

          {/* Chat */}
          <Route path="/chat" element={<Layout showFooter={false}><Placeholder title="Chat" /></Layout>} />
          <Route path="/chat/:id" element={<Layout showFooter={false}><Placeholder title="Chat Room" /></Layout>} />

          {/* Tracking */}
          <Route path="/tracking/:bookingId" element={<Layout showFooter={false}><Placeholder title="Live Tracking" /></Layout>} />

          {/* SOS */}
          <Route path="/sos" element={<Layout showFooter={false}><Placeholder title="SOS Emergency" /></Layout>} />

          {/* Admin Routes */}
          <Route path="/admin" element={<Layout><Placeholder title="Admin Dashboard" /></Layout>} />
          <Route path="/admin/users" element={<Layout><Placeholder title="Manage Users" /></Layout>} />
          <Route path="/admin/rides" element={<Layout><Placeholder title="Manage Rides" /></Layout>} />
          <Route path="/admin/bookings" element={<Layout><Placeholder title="Manage Bookings" /></Layout>} />
          <Route path="/admin/reports" element={<Layout><Placeholder title="Reports" /></Layout>} />

          {/* 404 */}
          <Route path="*" element={<Layout><Placeholder title="404 - Page Not Found" /></Layout>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
