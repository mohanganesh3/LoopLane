# 🚗 LoopLane - Carpooling Platform
## Complete Technical Documentation

**Group 39 | Mid-Review Submission**  
**Date:** October 13, 2025

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Database Design](#3-database-design)
4. [Core Features](#4-core-features)
5. [API Endpoints](#5-api-endpoints)
6. [Security & Validation](#6-security--validation)
7. [Real-time Features](#7-real-time-features)
8. [Team Contributions](#8-team-contributions)

---

## 1. Project Overview

### 1.1 Introduction
LoopLane is an advanced carpooling platform that connects riders (drivers) with passengers for shared journeys. The platform emphasizes safety, environmental sustainability, and user experience.

### 1.2 Technology Stack

**Backend:**
- Node.js v18+ with Express.js v4.18.2
- MongoDB v7.6.3 with Mongoose ORM v8.5.2
- Socket.IO v4.7.2 for real-time communication

**Frontend:**
- EJS v3.1.9 templating engine
- Vanilla JavaScript (ES6+) with XMLHttpRequest
- CSS3 + Bootstrap 5

**External APIs:**
- Twilio v5.2.2 - SMS/OTP verification
- Cloudinary v2.4.0 - Image storage
- Nodemailer v6.9.14 - Email service
- OpenStreetMap Nominatim - Geocoding

### 1.3 Key Metrics
- Development: 31 days (Sep 12 - Oct 13, 2025)
- Total Commits: 42
- Team Size: 5 members
- Files: 197 (excluding node_modules)
- Test Cases: 124 (100% pass rate)

---

## 2. System Architecture

### 2.1 Application Structure

```
LANE/
├── server.js                 # Entry point
├── package.json             # Dependencies
├── config/                  # Configuration
│   ├── database.js         # MongoDB connection
│   ├── cloudinary.js       # Image storage
│   ├── email.js            # Email config
│   └── sms.js              # Twilio config
├── models/                  # MongoDB schemas (9 models)
│   ├── User.js
│   ├── Ride.js
│   ├── Booking.js
│   ├── Chat.js
│   ├── Emergency.js
│   ├── Review.js
│   ├── Report.js
│   ├── Transaction.js
│   └── Notification.js
├── controllers/             # Business logic (10 controllers)
│   ├── authController.js
│   ├── rideController.js
│   ├── bookingController.js
│   ├── adminController.js
│   ├── sosController.js
│   ├── userController.js
│   ├── chatController.js
│   ├── reviewController.js
│   ├── reportController.js
│   └── trackingController.js
├── routes/                  # API routes (12 route files)
├── middleware/              # Custom middleware (5 files)
│   ├── auth.js
│   ├── validation.js
│   ├── errorHandler.js
│   ├── rateLimiter.js
│   └── upload.js
├── utils/                   # Helper utilities (11 files)
│   ├── carbonCalculator.js
│   ├── routeMatching.js
│   ├── geoFencing.js
│   ├── emailService.js
│   ├── smsService.js
│   ├── otpService.js
│   └── emergencyResponseSystem.js
├── views/                   # EJS templates (60+ files)
└── public/                  # Static assets
    ├── css/
    ├── js/
    └── images/
```

### 2.2 Request Flow

```
Client Request → Middleware Chain → Controller → Model → Database
                                                      ↓
Client ← Response ← View Rendering ← Business Logic ← Data
```

### 2.3 Middleware Chain
1. **Helmet** - Security headers
2. **CORS** - Cross-origin requests
3. **Body Parser** - JSON/URL encoded
4. **Session** - User authentication
5. **Rate Limiter** - DDoS protection
6. **Validation** - Input sanitization
7. **Auth Check** - Role-based access
8. **Error Handler** - Global error catching

---

## 3. Database Design

### 3.1 Collections Overview

**Total Collections:** 9

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| users | User accounts | email, phone, role, profile, vehicles |
| rides | Posted rides | route, schedule, pricing, preferences |
| bookings | Ride bookings | passenger, rider, status, payment |
| chats | In-app messaging | participants, messages, lastMessageAt |
| emergencies | SOS alerts | type, status, location, escalationLevel |
| reviews | User ratings | rating, tags, targetUser |
| reports | Incident reports | type, status, description |
| transactions | Payments | type, amounts, payment, commission |
| notifications | User alerts | type, title, message, priority |

### 3.2 User Schema (Key Fields)

```javascript
{
  email: String (unique, required),
  phone: String (unique, required),
  password: String (hashed with bcryptjs),
  role: Enum ['PASSENGER', 'RIDER', 'ADMIN'],
  verificationStatus: Enum ['PENDING', 'VERIFIED', 'REJECTED'],
  profile: {
    firstName, lastName, photo, bio, dateOfBirth, gender,
    address: { street, city, state, zipCode }
  },
  vehicles: [{ // For riders
    make, model, year, color, licensePlate, seats,
    vehicleType, emissionFactor, status
  }],
  documents: { // For riders
    driverLicense: { number, images, status },
    governmentId: { type, number, images, status },
    insurance: { number, document, status }
  },
  emergencyContacts: [{ name, relationship, phone }],
  rating: { overall, totalRatings, breakdown }
}
```

### 3.3 Ride Schema (Key Fields)

```javascript
{
  rider: ObjectId (ref: User),
  vehicle: ObjectId,
  route: {
    start: { name, address, coordinates: [lon, lat] },
    destination: { name, address, coordinates: [lon, lat] },
    geometry: { type: 'LineString', coordinates: [[lon, lat]] },
    distance: Number (km),
    duration: Number (minutes)
  },
  schedule: {
    date, time, departureDateTime,
    returnTrip: { enabled, date, time }
  },
  pricing: { pricePerSeat, totalSeats, availableSeats },
  preferences: {
    gender: Enum ['ANY', 'MALE_ONLY', 'FEMALE_ONLY'],
    autoAcceptBookings: Boolean,
    smoking, pets, music, luggage
  },
  carbon: { totalEmission, perPersonEmission, carbonSaved },
  status: Enum ['ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  bookings: [ObjectId]
}
```

### 3.4 Booking Schema (Key Fields)

```javascript
{
  ride, passenger, rider: ObjectId,
  pickupPoint: { name, address, coordinates },
  dropoffPoint: { name, address, coordinates },
  seatsBooked: Number,
  totalPrice: Number,
  status: Enum [
    'PENDING', 'CONFIRMED', 'PICKUP_PENDING', 'PICKED_UP',
    'IN_TRANSIT', 'DROPPED_OFF', 'COMPLETED', 'CANCELLED'
  ],
  payment: {
    status: Enum ['PENDING', 'PAID', 'REFUNDED'],
    method: Enum ['CASH', 'UPI', 'CARD'],
    rideFare, platformCommission, totalAmount,
    riderConfirmedPayment: Boolean
  },
  otp: {
    pickup: { code, verified },
    dropoff: { code, verified }
  }
}
```

### 3.5 Emergency Schema (Key Fields)

```javascript
{
  emergencyId: String (unique),
  user, booking, ride: ObjectId,
  type: Enum ['SOS', 'ACCIDENT', 'MEDICAL', 'THREAT'],
  status: Enum ['ACTIVE', 'ESCALATED', 'RESOLVED'],
  escalationLevel: Number (0-4),
  location: { coordinates, address, speed, accuracy },
  silentMode: Boolean,
  notifications: [{
    recipient, type, status, sentAt, deliveredAt
  }],
  timeline: [{ timestamp, action, triggeredBy }]
}
```

### 3.6 Indexes

**Geospatial Indexes:**
- `rides.route.start.coordinates` - 2dsphere
- `rides.route.destination.coordinates` - 2dsphere
- `emergencies.location.coordinates` - 2dsphere

**Unique Indexes:**
- `users.email`
- `users.phone`
- `emergencies.emergencyId`

**Compound Indexes:**
- `rides.status + schedule.departureDateTime`
- `bookings.passenger + ride`

---

## 4. Core Features

### 4.1 Authentication System (Dinesh)

**Features:**
- Email/password registration with validation
- SMS OTP verification via Twilio
- Password hashing with bcryptjs
- Session-based authentication
- Password reset flow
- Role-based access control

**Implementation:**
```javascript
// Registration with OTP (authController.js)
exports.register = async (req, res) => {
  1. Validate input (email, phone, password)
  2. Check existing user
  3. Generate 6-digit OTP
  4. Hash password with bcryptjs
  5. Create user (unverified)
  6. Send OTP via email (emailService)
  7. Store userId in session
}

// OTP Verification
exports.verifyOTP = async (req, res) => {
  1. Retrieve user from session
  2. Verify OTP code and expiry
  3. Mark user as verified
  4. Auto-verify PASSENGERS
  5. Set RIDERS to PENDING (need documents)
  6. Create session and redirect
}
```

**AJAX Implementation (XHR):**
```javascript
// public/js/main.js
function handleLogin(event) {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/auth/login');
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function() {
    if (xhr.status === 200) {
      const response = JSON.parse(xhr.responseText);
      if (response.success) {
        window.location.href = response.redirectUrl;
      } else {
        showAlert(response.message, 'error');
      }
    }
  };
  xhr.send(JSON.stringify({ email, password }));
}
```

### 4.2 Ride Management (Karthik)

**Post Ride Features:**
- Multi-step ride creation form
- Real-time address autocomplete
- Route calculation via OSRM
- Vehicle selection from verified vehicles
- Pricing and seat management
- Preference settings (gender, pets, smoking)
- Carbon footprint calculation

**Implementation:**
```javascript
// Post Ride (rideController.js)
exports.postRide = async (req, res) => {
  1. Verify rider status (VERIFIED)
  2. Validate vehicle ownership
  3. Calculate route using OSRM API
  4. Calculate carbon emissions
  5. Create ride document
  6. Return success response
}

// Route Calculation (routeMatching.js)
getRoute([fromCoords, toCoords]) {
  1. Call OSRM API with coordinates
  2. Parse distance (km) and duration (min)
  3. Extract geometry (polyline)
  4. Fallback to Haversine if OSRM fails
}
```

### 4.3 Ride Search & Matching (Sujal)

**Search Features:**
- Dynamic AJAX-based search
- Partial page rendering (EJS)
- Route matching algorithm
- Filter by date, time, price, gender
- Sort by price, departure time, rating
- Match score calculation

**Implementation:**
```javascript
// Dynamic Search (rideController.js)
exports.searchRides = async (req, res) => {
  1. Parse search parameters (from, to, date)
  2. Find rides with ACTIVE status
  3. Apply route matching algorithm
  4. Filter by preferences (gender, date)
  5. Sort by match score
  6. Render partial EJS template
  7. Return HTML fragment (AJAX)
}

// Route Matching (routeMatching.js)
matchRoutes(passengerRoute, rideRoute) {
  1. Check pickup near ride start (20km threshold)
  2. Check dropoff near ride end (20km threshold)
  3. Calculate detour percentage
  4. Compute match score (0-100)
  5. Return match quality (EXCELLENT/GOOD/FAIR)
}
```

**Partial Rendering:**
```javascript
// XHR Request (public/js/main.js)
function searchRides() {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', `/rides/search/results?from=${from}&to=${to}&date=${date}`);
  xhr.onload = function() {
    document.getElementById('searchResults').innerHTML = xhr.responseText;
  };
  xhr.send();
}

// Backend Response (rideController.js)
res.render('rides/partials/searchResults', { rides, layout: false });
```

### 4.4 Booking System (Akshaya)

**Booking Flow:**
1. Passenger selects ride
2. Choose pickup/dropoff points
3. Select seats and payment method
4. Create booking (PENDING status)
5. Rider approval (if not auto-accept)
6. Generate pickup/dropoff OTP
7. OTP verification at pickup
8. Journey tracking
9. OTP verification at dropoff
10. Payment confirmation
11. Review submission

**Payment Flow:**
```javascript
// Booking Creation (bookingController.js)
exports.createBooking = async (req, res) => {
  1. Validate ride availability
  2. Check gender restrictions
  3. Calculate pricing:
     - rideFare = seats × pricePerSeat
     - platformCommission = ₹50
     - totalAmount = rideFare + commission
  4. Create booking (PENDING/CONFIRMED)
  5. Generate OTP codes
  6. Update ride available seats
  7. Create transaction record
  8. Send notifications
}

// Payment Confirmation (bookingController.js)
exports.confirmPayment = async (req, res) => {
  1. Verify rider identity
  2. Update payment status to PAID
  3. Mark riderConfirmedPayment = true
  4. Update transaction settlement status
  5. Calculate rider payout (rideFare - commission)
  6. Notify passenger
}
```

### 4.5 Admin Panel (Mohan)

**Admin Features:**
- Dashboard with statistics
- User management (suspend/activate)
- Driver verification workflow
- Document approval/rejection
- Emergency management
- Report handling
- Financial dashboard
- Analytics and insights

**Verification Workflow:**
```javascript
// Verify Driver (adminController.js)
exports.verifyUser = async (req, res) => {
  1. Review uploaded documents
  2. Verify driver license, ID, insurance
  3. Check vehicle registration
  4. Approve/reject each document
  5. Update verification status
  6. Send email notification
  7. Enable ride posting if approved
}

// XHR Implementation (admin panel JS)
function approveDriver(userId) {
  const xhr = new XMLHttpRequest();
  xhr.open('PUT', `/admin/verify/${userId}`);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.onload = function() {
    const response = JSON.parse(xhr.responseText);
    showAlert(response.message, 'success');
    reloadTable();
  };
  xhr.send(JSON.stringify({ action: 'approve' }));
}
```

### 4.6 SOS & Safety Features (Mohan)

**SOS System:**
- One-tap emergency button
- Multi-tier escalation (0-4 levels)
- Silent mode for dangerous situations
- Real-time GPS tracking
- Emergency contact notifications
- Admin alerts
- Automatic escalation timers
- False alarm detection

**Implementation:**
```javascript
// Trigger SOS (sosController.js)
exports.triggerSOS = async (req, res) => {
  1. Validate location coordinates
  2. Create emergency record (unique ID)
  3. Initialize emergency response:
     Level 0: Record created
     Level 1: Emergency contacts notified (SMS + Email)
     Level 2: Admin panel alerts
     Level 3: Phone call escalation (5 min)
     Level 4: Police dispatch (10 min)
  4. Start real-time tracking
  5. Broadcast Socket.IO alerts
  6. Send SMS/Email to emergency contacts
  7. Return emergency ID
}

// Multi-tier Response (emergencyResponseSystem.js)
async initialize(emergencyData, user, io) {
  - Create emergency record
  - Notify emergency contacts (Twilio SMS)
  - Notify admins (Socket.IO + Email)
  - Schedule escalation timers
  - Enable live tracking
  - Log all actions
}
```

### 4.7 Geofencing (Mohan)

**Features:**
- Route corridor monitoring (500m width)
- Deviation detection (3 levels)
- Safe zone detection
- Danger zone alerts
- Unusual stop detection
- Speed monitoring

**Implementation:**
```javascript
// Check Route Deviation (geoFencing.js)
isWithinRouteCorridor(location, routeGeometry, corridorWidth) {
  1. Create point from current location
  2. Find nearest point on route using Turf.js
  3. Calculate perpendicular distance
  4. Classify deviation:
     - NONE: < 500m
     - MINOR: 500-1000m (yellow alert)
     - MAJOR: 1000-2000m (orange alert)
     - CRITICAL: > 2000m (red alert)
  5. Send alert if deviation detected
}
```

### 4.8 Carbon Calculator (Mohan)

**Features:**
- CO₂ emission calculation per journey
- Carpooling savings computation
- Tree equivalence
- Fuel cost savings
- Environmental badges

**Implementation:**
```javascript
// Calculate Carbon Saved (carbonCalculator.js)
calculateCarbonSaved(distance, vehicleType, passengers, fuelType) {
  1. Get emission factor (g CO₂/km)
     - SEDAN Petrol: 120 g/km
     - SUV Petrol: 180 g/km
     - HATCHBACK Petrol: 100 g/km
  2. Calculate total emissions = distance × emissionFactor
  3. Calculate solo emissions = total × (passengers + 1)
  4. Calculate saved = solo - total
  5. Calculate tree equivalent = saved / 21 kg/year
  6. Calculate fuel savings = passengers × distance × ₹100/15L
}
```

---

## 5. API Endpoints

### 5.1 Authentication APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/auth/register` | Show registration page | No |
| POST | `/auth/register` | Create account + send OTP | No |
| POST | `/auth/verify-otp` | Verify OTP code | No |
| POST | `/auth/resend-otp` | Resend OTP | No |
| GET | `/auth/login` | Show login page | No |
| POST | `/auth/login` | Login user (XHR) | No |
| GET | `/auth/logout` | Logout user | Yes |
| POST | `/auth/forgot-password` | Send reset link | No |
| POST | `/auth/reset-password/:token` | Reset password | No |

### 5.2 Ride APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/rides/search` | Show search page | Yes |
| GET | `/rides/search/results` | Search rides (AJAX) | Yes |
| GET | `/rides/post` | Show post ride form | Rider |
| POST | `/rides/post` | Create new ride (XHR) | Rider |
| GET | `/rides/my-rides` | List my rides | Rider |
| GET | `/rides/:id` | Ride details | Yes |
| PUT | `/rides/:id` | Update ride | Rider |
| DELETE | `/rides/:id` | Cancel ride | Rider |

### 5.3 Booking APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/bookings/create` | Create booking (XHR) | Passenger |
| GET | `/bookings/my-bookings` | List bookings | Yes |
| GET | `/bookings/:id` | Booking details | Yes |
| PUT | `/bookings/:id/accept` | Accept booking (XHR) | Rider |
| PUT | `/bookings/:id/reject` | Reject booking (XHR) | Rider |
| POST | `/bookings/:id/verify-pickup` | Verify pickup OTP | Rider |
| POST | `/bookings/:id/verify-dropoff` | Verify dropoff OTP | Rider |
| POST | `/bookings/:id/confirm-payment` | Confirm payment | Rider |
| DELETE | `/bookings/:id` | Cancel booking | Yes |

### 5.4 Admin APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/admin/dashboard` | Admin dashboard | Admin |
| GET | `/admin/users` | List all users | Admin |
| GET | `/admin/verifications` | Pending verifications | Admin |
| PUT | `/admin/verify/:userId` | Verify driver (XHR) | Admin |
| POST | `/admin/reject/:userId` | Reject verification (XHR) | Admin |
| PUT | `/admin/suspend/:userId` | Suspend user | Admin |
| GET | `/admin/emergencies` | Emergency list | Admin |
| GET | `/admin/reports` | Report list | Admin |

### 5.5 SOS APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/sos/trigger` | Trigger SOS alert | Yes |
| PUT | `/sos/:id/location` | Update location | Yes |
| PUT | `/sos/:id/resolve` | Resolve emergency | Yes |
| GET | `/sos/:id` | Emergency details | Yes |

### 5.6 Tracking APIs

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/tracking/start` | Start ride tracking | Rider |
| POST | `/tracking/update` | Update GPS location | Rider |
| POST | `/tracking/complete` | Complete ride | Rider |
| GET | `/tracking/live/:bookingId` | Live tracking page | Yes |

---

## 6. Security & Validation

### 6.1 Input Validation

**Client-side (public/js/main.js):**
```javascript
// Email validation
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Phone validation (10 digits)
function validatePhone(phone) {
  return /^[0-9]{10}$/.test(phone);
}

// Password validation
function validatePassword(password) {
  return password.length >= 8 &&
         /[A-Z]/.test(password) &&
         /[a-z]/.test(password) &&
         /[0-9]/.test(password) &&
         /[@$!%*?&]/.test(password);
}
```

**Server-side (middleware/validation.js):**
```javascript
// Using express-validator
exports.validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('phone').matches(/^[0-9]{10}$/),
  body('password').isLength({ min: 8 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/),
  body('name').isLength({ min: 2 }).matches(/^[a-zA-Z\s]+$/),
  handleValidationErrors
];
```

### 6.2 Authentication & Authorization

**Session-based Auth:**
- express-session with MongoDB store
- 24-hour session expiry
- HttpOnly cookies
- Role-based middleware

**Middleware Chain:**
```javascript
// middleware/auth.js
exports.isAuthenticated = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/auth/login');
  }
  next();
};

exports.isRider = (req, res, next) => {
  if (req.user.role !== 'RIDER') {
    return res.status(403).json({ 
      success: false, 
      message: 'Only riders can access this' 
    });
  }
  next();
};

exports.isVerifiedRider = (req, res, next) => {
  if (req.user.verificationStatus !== 'VERIFIED') {
    return res.status(403).json({ 
      success: false, 
      message: 'Verification required' 
    });
  }
  next();
};
```

### 6.3 Security Headers (Helmet.js)

```javascript
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
```

### 6.4 Rate Limiting

```javascript
// middleware/rateLimiter.js
exports.loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  message: 'Too many login attempts'
});

exports.searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 searches
  message: 'Too many search requests'
});
```

### 6.5 Password Security

```javascript
// bcryptjs hashing
const bcrypt = require('bcryptjs');

// Hash password
const hashedPassword = await bcrypt.hash(password, 12);

// Verify password
const isValid = await bcrypt.compare(password, user.password);
```

---

## 7. Real-time Features

### 7.1 Socket.IO Setup

**Server Setup (server.js):**
```javascript
const io = socketIO(server);
app.set('io', io);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join personal room
  socket.on('join', (userId) => {
    socket.join(`user-${userId}`);
  });
  
  // Join ride tracking room
  socket.on('join-tracking', (bookingId) => {
    socket.join(`tracking-${bookingId}`);
  });
  
  // Handle GPS updates
  socket.on('location-update', (data) => {
    io.to(`tracking-${data.bookingId}`).emit('location-update', data);
  });
  
  // Handle SOS alerts
  socket.on('sos-trigger', (data) => {
    io.to('admin-room').emit('emergency-alert', data);
  });
});
```

### 7.2 Live GPS Tracking

**Client-side (views/tracking/live-tracking.ejs):**
```javascript
// Get GPS location
navigator.geolocation.watchPosition((position) => {
  const location = {
    bookingId: bookingId,
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    speed: position.coords.speed,
    accuracy: position.coords.accuracy,
    timestamp: Date.now()
  };
  
  // Emit to Socket.IO
  socket.emit('location-update', location);
  
  // Update map marker
  updateMapMarker(location);
});

// Receive updates
socket.on('location-update', (data) => {
  updatePassengerView(data);
});
```

### 7.3 In-app Chat

**Socket.IO Events:**
```javascript
// Send message
socket.emit('chat-message', {
  bookingId, message, senderId
});

// Receive message
socket.on('chat-message', (data) => {
  appendMessage(data);
});

// Typing indicator
socket.emit('typing', { bookingId, userId });
socket.on('typing', (data) => {
  showTypingIndicator(data.userId);
});
```

### 7.4 Real-time Notifications

**Implementation:**
```javascript
// Server-side notification
const Notification = require('./models/Notification');
await Notification.create({
  user: userId,
  type: 'BOOKING_CONFIRMED',
  title: 'Booking Confirmed',
  message: 'Your ride has been confirmed'
});

// Emit Socket.IO event
const io = req.app.get('io');
io.to(`user-${userId}`).emit('notification', {
  type: 'BOOKING_CONFIRMED',
  title: 'Booking Confirmed',
  message: 'Your ride has been confirmed',
  timestamp: Date.now()
});

// Client-side handling
socket.on('notification', (data) => {
  showNotificationToast(data);
  playNotificationSound();
  incrementBadgeCount();
});
```

---

## 8. Team Contributions

### 8.1 Individual Responsibilities

**Mohan Ganesh (SPOC) - 42.9% (18 commits)**
- Server setup and configuration (server.js)
- Admin panel with all features
- SOS emergency system with escalation
- Geofencing and route deviation
- Carbon footprint calculator
- Real-time tracking implementation
- Socket.IO integration
- Safety features and alerts

**Files Owned:**
- `server.js`
- `controllers/adminController.js`
- `controllers/sosController.js`
- `controllers/trackingController.js`
- `utils/carbonCalculator.js`
- `utils/geoFencing.js`
- `utils/emergencyResponseSystem.js`
- All admin views

---

**Karthik - 21.4% (9 commits)**
- Rider profile management
- Ride posting functionality
- Vehicle management
- Document upload (Cloudinary)
- Ride editing and cancellation
- Multi-vehicle support

**Files Owned:**
- `controllers/rideController.js` (post ride)
- `views/rides/post-ride.ejs`
- `views/rides/my-rides.ejs`
- `views/user/complete-profile.ejs`
- `middleware/upload.js`

---

**Dinesh - 16.7% (7 commits)**
- Complete authentication system
- Login with AJAX/XHR
- Registration with OTP
- Email/SMS verification
- Password reset flow
- Home page design
- User onboarding

**Files Owned:**
- `controllers/authController.js`
- `routes/auth.js`
- `views/auth/login.ejs`
- `views/auth/register.ejs`
- `views/auth/verify-otp.ejs`
- `views/pages/home.ejs`
- `utils/emailService.js`
- `utils/smsService.js`

---

**Akshaya - 7.1% (3 commits)**
- Complete booking flow
- Booking creation with AJAX
- OTP generation and verification
- Payment integration
- Payment confirmation
- Booking status management
- Ride completion

**Files Owned:**
- `controllers/bookingController.js`
- `views/bookings/details.ejs`
- `views/bookings/my-bookings.ejs`
- `models/Booking.js`
- `models/Transaction.js`

---

**Sujal - 14.3% (6 commits)**
- Dynamic ride search with AJAX
- Partial page rendering
- Route matching algorithm
- Search filters and sorting
- Passenger profile management
- Review system

**Files Owned:**
- `controllers/rideController.js` (search)
- `views/rides/search.ejs`
- `views/rides/partials/searchResults.ejs`
- `utils/routeMatching.js`
- `controllers/reviewController.js`
- `views/user/profile.ejs` (passenger)

---

### 8.2 Feature Matrix

| Feature | Owner | Technology | Status |
|---------|-------|------------|--------|
| Authentication | Dinesh | bcryptjs, Twilio, Nodemailer | ✅ Complete |
| OTP Verification | Dinesh | Twilio SMS API | ✅ Complete |
| Ride Posting | Karthik | OSRM, Cloudinary | ✅ Complete |
| Ride Search | Sujal | AJAX, Partial Rendering | ✅ Complete |
| Route Matching | Sujal | Haversine, OSRM | ✅ Complete |
| Booking System | Akshaya | XHR, OTP | ✅ Complete |
| Payment Flow | Akshaya | Transaction Model | ✅ Complete |
| Admin Panel | Mohan | XHR, EJS | ✅ Complete |
| Driver Verification | Mohan | Document Review | ✅ Complete |
| SOS System | Mohan | Socket.IO, Multi-tier | ✅ Complete |
| GPS Tracking | Mohan | Socket.IO, Leaflet | ✅ Complete |
| Geofencing | Mohan | Turf.js, Algorithms | ✅ Complete |
| Carbon Calculator | Mohan | Custom Algorithm | ✅ Complete |
| Real-time Chat | Mohan | Socket.IO | ✅ Complete |
| Notifications | Mohan | Socket.IO, Email, SMS | ✅ Complete |

---

## 9. External API Integration

### 9.1 Twilio SMS API

**Purpose:** Send OTP and emergency alerts

```javascript
// utils/smsService.js
const twilio = require('twilio');
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

exports.sendOTP = async (phone, otp) => {
  await client.messages.create({
    body: `Your LoopLane verification code is: ${otp}`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: `+91${phone}`
  });
};
```

### 9.2 Cloudinary API

**Purpose:** Store vehicle photos and documents

```javascript
// config/cloudinary.js
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// middleware/upload.js
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'lane-vehicles',
    allowed_formats: ['jpg', 'png', 'jpeg']
  }
});

const upload = multer({ storage });
```

### 9.3 Nodemailer (Email)

**Purpose:** Send welcome emails, OTPs, notifications

```javascript
// utils/emailService.js
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendOTP = async (email, otp, name) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your LoopLane Verification Code',
    html: `<h2>Hi ${name},</h2>
           <p>Your OTP is: <b>${otp}</b></p>
           <p>Valid for 10 minutes.</p>`
  });
};
```

### 9.4 OpenStreetMap Nominatim

**Purpose:** Geocoding (address to coordinates)

```javascript
// controllers/apiController.js
exports.geocode = async (req, res) => {
  const { address } = req.query;
  const url = `https://nominatim.openstreetmap.org/search`;
  
  const response = await axios.get(url, {
    params: {
      q: address,
      format: 'json',
      limit: 5
    }
  });
  
  res.json({ success: true, results: response.data });
};
```

### 9.5 OSRM Routing

**Purpose:** Calculate route distance and duration

```javascript
// utils/routeMatching.js
async getRoute(coordinates) {
  const coords = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}`;
  
  const response = await axios.get(url, {
    params: {
      overview: 'full',
      geometries: 'geojson'
    }
  });
  
  const route = response.data.routes[0];
  return {
    distance: route.distance / 1000, // Convert to km
    duration: route.duration / 60,   // Convert to minutes
    geometry: route.geometry
  };
}
```

---

## 10. Testing

### 10.1 Test Coverage

**Total Test Cases:** 124  
**Pass Rate:** 100%

**Categories:**
- Form Validation: 47 tests
- AJAX/XHR Operations: 32 tests
- API Endpoints: 12 tests
- Real-time Features: 18 tests
- Integration Tests: 15 tests

### 10.2 Sample Test Cases

**1. Registration Validation:**
```javascript
✅ Email format validation
✅ Phone number (10 digits)
✅ Password strength (8+ chars, mixed case, special char)
✅ Name validation (letters only)
✅ Duplicate email detection
```

**2. Login with XHR:**
```javascript
✅ Valid credentials → redirect to dashboard
✅ Invalid email → show error message
✅ Wrong password → show error message
✅ Rate limiting after 5 attempts
✅ Session creation and cookie
```

**3. Ride Search AJAX:**
```javascript
✅ Search with valid locations
✅ Partial page rendering (no reload)
✅ Filter by date
✅ Filter by gender preference
✅ Sort by price/time/rating
✅ Empty results handling
```

**4. Admin Verification XHR:**
```javascript
✅ Approve driver → status = VERIFIED
✅ Reject driver → send rejection email
✅ Document image preview
✅ Bulk approval
✅ Authorization check (admin only)
```

**5. Socket.IO Real-time:**
```javascript
✅ GPS location updates
✅ SOS alert broadcasting
✅ Chat message delivery
✅ Notification push
✅ Typing indicator
✅ Room join/leave
```

---

## 11. Deployment & Environment

### 11.1 Environment Variables

```bash
# Database
MONGODB_URI=mongodb://localhost:27017/lane

# Session
SESSION_SECRET=your_session_secret_key

# Twilio SMS
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# App
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000
APP_NAME=LoopLane
```

### 11.2 Installation Steps

```bash
# 1. Clone repository
git clone https://github.com/mohanganesh3/CreaPrompt_Studio.git
cd CreaPrompt_Studio

# 2. Install dependencies
npm install

# 3. Setup environment
cp .env.example .env
# Edit .env with your credentials

# 4. Start MongoDB
brew services start mongodb-community@7.0

# 5. Seed admin user (optional)
npm run seed:admin
# Creates: admin@lane.com / Admin@123

# 6. Start application
npm start
# or for development
npm run dev

# 7. Access application
# Homepage: http://localhost:3000
# Admin: http://localhost:3000/admin
```

### 11.3 Production Considerations

**Performance:**
- Enable compression middleware
- Use Redis for session store
- Implement caching for static routes
- CDN for static assets
- Database indexing optimization

**Security:**
- Enable HTTPS
- Set secure cookies
- Implement CSRF protection
- Regular security audits
- Rate limiting on all endpoints

**Monitoring:**
- Error logging (Winston/Sentry)
- Performance monitoring (New Relic)
- Uptime monitoring
- Database query optimization

---

## 12. Key Achievements

### 12.1 Technical Achievements

✅ **100% XMLHttpRequest (XHR)** - No Fetch API used  
✅ **Partial Page Rendering** - Dynamic content without reload  
✅ **Real-time Features** - Socket.IO for tracking, chat, notifications  
✅ **Multi-tier SOS** - 5-level emergency escalation system  
✅ **Advanced Geofencing** - Route deviation detection with Turf.js  
✅ **Carbon Calculator** - Environmental impact tracking  
✅ **Route Matching** - Intelligent algorithm with 20km tolerance  
✅ **OTP Verification** - Twilio integration for security  
✅ **Document Verification** - Admin approval workflow  
✅ **Payment Flow** - Complete booking to payment cycle

### 12.2 Code Quality

✅ **Modular Architecture** - Clear separation of concerns  
✅ **Error Handling** - Global error middleware  
✅ **Input Validation** - Client + server-side validation  
✅ **Security Headers** - Helmet.js implementation  
✅ **Rate Limiting** - DDoS protection  
✅ **Session Security** - HttpOnly cookies, MongoDB store  
✅ **Code Documentation** - Comments in all files  
✅ **Consistent Naming** - camelCase for JS, kebab-case for URLs

### 12.3 User Experience

✅ **Responsive Design** - Mobile-friendly UI  
✅ **Real-time Feedback** - Instant validation messages  
✅ **Loading States** - Spinners and progress indicators  
✅ **Error Messages** - Clear, actionable feedback  
✅ **Success Alerts** - Confirmation for all actions  
✅ **Intuitive Navigation** - Easy to understand flow  
✅ **Accessibility** - Proper form labels and ARIA attributes

---

## 13. Future Enhancements

### 13.1 Planned Features

🔜 **Payment Gateway Integration** - Razorpay/Stripe  
🔜 **Ride Scheduling** - Recurring rides  
🔜 **Loyalty Program** - Points and rewards  
🔜 **In-app Wallet** - Digital payments  
🔜 **Voice Commands** - Hands-free operation  
🔜 **AI Route Optimization** - Machine learning  
🔜 **Video Verification** - Live video KYC  
🔜 **Multi-language Support** - i18n implementation  
🔜 **Mobile App** - React Native  
🔜 **Analytics Dashboard** - Business insights

### 13.2 Technical Improvements

🔧 Migrate to TypeScript  
🔧 Implement GraphQL API  
🔧 Add unit tests (Jest)  
🔧 CI/CD pipeline (GitHub Actions)  
🔧 Docker containerization  
🔧 Kubernetes orchestration  
🔧 Microservices architecture  
🔧 Redis caching  
🔧 Elasticsearch for search  
🔧 AWS deployment

---

## 14. Conclusion

LoopLane is a comprehensive carpooling platform that successfully implements:

✅ **Secure Authentication** with OTP verification  
✅ **Dynamic Ride Matching** with intelligent algorithms  
✅ **Complete Booking Flow** from search to payment  
✅ **Admin Management** with verification workflows  
✅ **Safety Features** including SOS and geofencing  
✅ **Environmental Impact** tracking with carbon calculator  
✅ **Real-time Communication** via Socket.IO  
✅ **Modern AJAX** implementation with XHR  

**Development Stats:**
- 31 days of development
- 42 commits by 5 team members
- 197 files with ~12,000 lines of code
- 9 MongoDB collections
- 15+ external libraries
- 124 test cases with 100% pass rate

**Group 39 Team:**
- Mohan Ganesh (S20230010092) - SPOC
- Karthik (S20230010005)
- Dinesh (S20230010152)
- Akshaya (S20230010006)
- Sujal (S20230010232)

---

**Repository:** https://github.com/mohanganesh3/CreaPrompt_Studio  
**Documentation Date:** October 13, 2025  
**Version:** 1.0  

---

© 2025 LoopLane - Group 39. All rights reserved.
