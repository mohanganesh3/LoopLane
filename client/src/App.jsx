import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Pages - will be created later
// import Home from './pages/Home'
// import Login from './pages/auth/Login'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<div>Home Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
        <Route path="/register" element={<div>Register Page</div>} />
        <Route path="/verify-otp" element={<div>Verify OTP</div>} />
        <Route path="/forgot-password" element={<div>Forgot Password</div>} />
        <Route path="/reset-password" element={<div>Reset Password</div>} />
        
        {/* Protected Routes - User */}
        <Route path="/dashboard" element={<div>Dashboard</div>} />
        <Route path="/profile" element={<div>Profile</div>} />
        <Route path="/settings" element={<div>Settings</div>} />
        
        {/* Rides */}
        <Route path="/rides/search" element={<div>Search Rides</div>} />
        <Route path="/rides/post" element={<div>Post Ride</div>} />
        <Route path="/rides/my-rides" element={<div>My Rides</div>} />
        <Route path="/rides/:id" element={<div>Ride Details</div>} />
        
        {/* Bookings */}
        <Route path="/bookings" element={<div>My Bookings</div>} />
        <Route path="/bookings/:id" element={<div>Booking Details</div>} />
        
        {/* Chat */}
        <Route path="/chat" element={<div>Chat</div>} />
        <Route path="/chat/:id" element={<div>Chat Room</div>} />
        
        {/* Tracking */}
        <Route path="/tracking/:bookingId" element={<div>Live Tracking</div>} />
        
        {/* SOS */}
        <Route path="/sos" element={<div>SOS Emergency</div>} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<div>Admin Dashboard</div>} />
        <Route path="/admin/users" element={<div>Manage Users</div>} />
        <Route path="/admin/rides" element={<div>Manage Rides</div>} />
        <Route path="/admin/bookings" element={<div>Manage Bookings</div>} />
        
        {/* 404 */}
        <Route path="*" element={<div>Page Not Found</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
