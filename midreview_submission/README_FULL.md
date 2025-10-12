# LoopLane - Carpooling Platform

## 📋 Project Information

**Group ID:** 39

**Project Title:** LoopLane - Advanced Carpooling Platform with Safety Features

**SPOC (Single Point of Contact):**
- **Name:** Mohan Ganesh
- **Roll Number:** S20230010092
- **Email:** mohanganesh165577@gmail.com

---

## 👥 Team Members & Roles

| Roll Number | Name | Email | Primary Role | Responsibilities |
|------------|------|-------|--------------|------------------|
| S20230010092 | Mohan Ganesh | mohanganesh165577@gmail.com | **Team Lead & Backend Architect** | Server setup (server.js), Admin panel (complete), SOS system, Geofencing, Carbon calculator, Real-time tracking, Chat, Security features |
| S20230010005 | Karthik | karthikagisam353570@gmail.com | **Rider Features Developer** | Rider profile, Ride posting with AJAX, Ride filtering UI, Vehicle management, Code refactoring |
| S20230010152 | Dinesh | mudedineshnaik7@gmail.com | **Authentication & User Journey** | Complete auth (Login/Register/OTP), Home page, Rider & Passenger onboarding flows, Password reset, Session management |
| S20230010006 | Akshaya | akshaya.aienavolu@gmail.com | **Booking & Payment Developer** | Complete booking flow (ride start to payment), Status management, OTP pickup verification, Payment integration |
| S20230010232 | Sujal | sujalpcmb123@gmail.com | **Search & Passenger Features** | Ride search with AJAX, Passenger profile, Partial EJS rendering, Search filters, Dynamic results |

---

## 🚀 Project Overview

LoopLane is a comprehensive carpooling platform designed to facilitate eco-friendly ride-sharing with advanced safety features including:

- **Real-time GPS Tracking** with live location updates
- **SOS Emergency Alert System** with instant notifications
- **Smart Ride Matching** based on routes and preferences
- **Secure Booking System** with OTP verification
- **Admin Dashboard** for user verification and management
- **Carbon Footprint Calculator** for environmental impact
- **In-app Chat System** for rider-passenger communication
- **Geofencing** for safety zones
- **Multi-role System** (Riders, Passengers, Admin)

---

## 🛠️ Technology Stack

### Backend
- **Runtime:** Node.js v18+
- **Framework:** Express.js v4.18.2
- **Database:** MongoDB v7.6.3 (NoSQL)
- **Real-time:** Socket.IO v4.7.2
- **Authentication:** bcryptjs, express-session
- **Validation:** express-validator v7.0.1
- **File Upload:** Multer + Cloudinary

### Frontend
- **Template Engine:** EJS v3.1.9
- **JavaScript:** Vanilla JS with XMLHttpRequest (XHR)
- **Maps:** Leaflet.js for interactive mapping
- **CSS:** Custom responsive design
- **AJAX:** XMLHttpRequest-based async operations

### External Services
- **SMS/OTP:** Twilio API
- **Email:** Nodemailer
- **Image Storage:** Cloudinary
- **Geocoding:** OpenStreetMap Nominatim API

### DevOps & Security
- **Security:** Helmet.js, CORS
- **Rate Limiting:** express-rate-limit
- **Session Store:** connect-mongo
- **Compression:** compression middleware
- **Logging:** Morgan

---

## 📦 Prerequisites

Before running the project locally, ensure you have:

1. **Node.js** (v18.0.0 or higher)
   ```bash
   node --version  # Should show v18.0.0+
   ```

2. **MongoDB** (v7.0 or higher)
   ```bash
   mongod --version  # Should show v7.0+
   ```

3. **npm** (v9.0.0 or higher)
   ```bash
   npm --version
   ```

4. **Git** (for version control)
   ```bash
   git --version
   ```

---

## 🏃‍♂️ How to Run Locally

### Step 1: Clone the Repository

```bash
git clone https://github.com/mohanganesh3/CreaPrompt_Studio.git
cd CreaPrompt_Studio
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages from `package.json`:
- express, ejs, mongoose
- socket.io, twilio, nodemailer
- express-validator, multer, cloudinary
- bcryptjs, helmet, cors, compression
- And more...

### Step 3: Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://127.0.0.1:27017/carpool-platform

# Session Secret
SESSION_SECRET=your_super_secret_session_key_here_change_in_production

# Twilio Configuration (SMS/OTP)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Email Configuration (Gmail/SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password

# Cloudinary Configuration (Image Upload)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# App URL
APP_URL=http://localhost:3000
```

**Note:** For testing, you can use default MongoDB connection without credentials.

### Step 4: Start MongoDB

**On macOS:**
```bash
brew services start mongodb-community@7.0
# OR
mongod --config /opt/homebrew/etc/mongod.conf
```

**On Windows:**
```bash
net start MongoDB
```

**On Linux:**
```bash
sudo systemctl start mongod
```

Verify MongoDB is running:
```bash
brew services list | grep mongodb  # macOS
# OR
mongosh  # Should connect successfully
```

### Step 5: Seed Admin User (Optional)

Create an admin account for testing:

```bash
npm run seed:admin
```

This creates:
- **Admin Email:** admin@lane.com
- **Password:** Admin@123

### Step 6: Start the Application

**Development Mode (with auto-reload):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

You should see:
```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚗  CARPOOL PLATFORM - SERVER RUNNING  🚗          ║
║                                                       ║
║   Port:        3000                                   ║
║   Environment: development                          ║
║   URL:         http://localhost:3000      ║
║                                                       ║
║   Ready to accept connections! 🎉                    ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝

✅ MongoDB Connected: 127.0.0.1
✅ Twilio SMS service connected
✅ Email server is ready to send messages
```

### Step 7: Access the Application

Open your browser and navigate to:
- **Homepage:** http://localhost:3000
- **Login:** http://localhost:3000/auth/login
- **Register:** http://localhost:3000/auth/register
- **Admin Panel:** http://localhost:3000/admin (use seeded admin credentials)

---

## 📁 Project Structure

```
LANE/
├── server.js                      # Main entry point
├── package.json                   # Dependencies & scripts
├── nodemon.json                   # Nodemon configuration
├── .env                           # Environment variables (not in repo)
│
├── config/                        # Configuration files
│   ├── database.js               # MongoDB connection
│   ├── cloudinary.js             # Image upload config
│   ├── email.js                  # Email service config
│   └── sms.js                    # Twilio SMS config
│
├── models/                        # Mongoose schemas
│   ├── User.js                   # User model (auth, profile, roles)
│   ├── Ride.js                   # Ride posting model
│   ├── Booking.js                # Booking model
│   ├── Chat.js                   # Chat messages
│   ├── Review.js                 # User reviews/ratings
│   ├── Report.js                 # Incident reports
│   ├── Emergency.js              # SOS emergencies
│   ├── Transaction.js            # Payment records
│   └── Notification.js           # User notifications
│
├── controllers/                   # Business logic
│   ├── authController.js         # Login, register, OTP (Dinesh)
│   ├── userController.js         # Profile, dashboard, settings
│   ├── rideController.js         # Post, search, filter rides (Karthik)
│   ├── bookingController.js      # Booking logic (Akshaya)
│   ├── chatController.js         # In-app messaging
│   ├── reviewController.js       # Rating system
│   ├── reportController.js       # Incident reporting
│   ├── sosController.js          # Emergency SOS (Mohan)
│   ├── trackingController.js     # Real-time GPS (Mohan)
│   ├── adminController.js        # Admin panel (Dinesh)
│   └── apiController.js          # External API integrations
│
├── routes/                        # Express routes
│   ├── auth.js                   # /auth/* routes
│   ├── user.js                   # /user/* routes
│   ├── rides.js                  # /rides/* routes
│   ├── bookings.js               # /bookings/* routes
│   ├── chat.js                   # /chat/* routes
│   ├── tracking.js               # /tracking/* routes
│   ├── sos.js                    # /sos/* routes
│   ├── admin.js                  # /admin/* routes
│   ├── reviews.js                # /reviews/* routes
│   └── reports.js                # /reports/* routes
│
├── middleware/                    # Custom middleware
│   ├── auth.js                   # Authentication & authorization
│   ├── validation.js             # express-validator rules
│   ├── errorHandler.js           # Global error handling
│   ├── rateLimiter.js            # Rate limiting configs
│   └── upload.js                 # Multer file upload
│
├── utils/                         # Utility functions
│   ├── emailService.js           # Email sending
│   ├── smsService.js             # SMS/OTP sending
│   ├── otpService.js             # OTP generation
│   ├── routeMatching.js          # Ride matching algorithm
│   ├── carbonCalculator.js       # CO2 footprint calculator
│   ├── geoFencing.js             # Safety zone validation (Mohan)
│   ├── emergencyResponseSystem.js # SOS escalation (Mohan)
│   ├── sosEscalationSystem.js    # Emergency notifications
│   ├── helpers.js                # General helpers
│   └── cacheManager.js           # Module cache clearing
│
├── views/                         # EJS templates
│   ├── auth/                     # Login, register, OTP
│   │   ├── login.ejs            # XHR-based login (Dinesh)
│   │   ├── register.ejs         # XHR-based register (Dinesh)
│   │   ├── verify-otp.ejs       # XHR-based OTP (Dinesh)
│   │   ├── forgot-password.ejs
│   │   └── reset-password.ejs
│   │
│   ├── user/                     # User dashboard & profile
│   │   ├── dashboard.ejs
│   │   ├── profile.ejs
│   │   ├── complete-profile.ejs
│   │   └── settings.ejs
│   │
│   ├── rides/                    # Ride management
│   │   ├── search.ejs           # AJAX ride search (Sujal)
│   │   ├── post-ride.ejs        # XHR post ride (Karthik)
│   │   ├── my-rides.ejs
│   │   ├── details.ejs
│   │   └── partials/
│   │       └── searchResults.ejs # Partial rendering (Sujal)
│   │
│   ├── bookings/                 # Booking views
│   │   ├── details.ejs          # Booking details (Akshaya)
│   │   └── my-bookings.ejs
│   │
│   ├── tracking/                 # Real-time tracking
│   │   └── live.ejs             # Socket.IO tracking (Mohan)
│   │
│   ├── sos/                      # Emergency SOS
│   │   └── active.ejs           # SOS interface (Mohan)
│   │
│   ├── admin/                    # Admin panel
│   │   ├── dashboard.ejs
│   │   ├── verifications.ejs    # XHR approval (Dinesh)
│   │   ├── verification-details.ejs
│   │   ├── users.ejs
│   │   ├── rides.ejs
│   │   └── emergencies.ejs
│   │
│   ├── chat/                     # Chat interface
│   │   └── conversation.ejs
│   │
│   └── partials/                 # Reusable components
│       ├── header.ejs
│       ├── footer.ejs
│       ├── navbar.ejs
│       └── flash.ejs
│
├── public/                        # Static assets
│   ├── css/
│   │   └── style.css            # Main stylesheet
│   ├── js/
│   │   ├── main.js              # Global JavaScript
│   │   ├── sos.js               # SOS client logic (Mohan)
│   │   └── permissions.js       # Geolocation permissions (Mohan)
│   ├── images/
│   │   ├── default-avatar.png
│   │   └── hero-illustration.svg
│   ├── sounds/
│   │   └── emergency-alert.mp3
│   └── uploads/                  # Local file uploads
│       ├── profiles/
│       ├── vehicles/
│       └── documents/
│
└── docs/                          # Documentation
    ├── API.md                    # API documentation
    ├── ARCHITECTURE.md           # System architecture
    └── DEPLOYMENT.md             # Deployment guide
```

---

## 🔑 Key Files and Functions

### 1. **Validation Middleware** (`middleware/validation.js`)

**Purpose:** Input validation using express-validator

**Key Functions:**
- `validateRegistration` - Validates user registration (email, password strength, name)
- `validateLogin` - Validates login credentials
- `validateOTP` - Validates 6-digit OTP format
- `validateRidePost` - Validates ride posting (locations, coordinates, dates)
- `validateRideSearch` - Validates search parameters
- `validateBooking` - Validates booking creation
- `validateReview` - Validates review submission
- `handleValidationErrors` - Centralized error handler for validation

**Example Usage:**
```javascript
router.post('/register',
    registerLimiter,
    validateRegistration,
    handleValidationErrors,
    authController.register
);
```

**Location in Code:**
- File: `middleware/validation.js`
- Lines: 1-400+
- Used in: All route files (`routes/*.js`)

---

### 2. **AJAX/XHR Dynamic Operations**

#### **A. Login Form (XMLHttpRequest)** - By Dinesh

**File:** `views/auth/login.ejs`
**Lines:** 85-130

**Function:**
```javascript
document.getElementById('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/auth/login', true);
    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    xhr.send(JSON.stringify(data));
});
```

**Features:**
- Async form submission without page reload
- Loading spinner during request
- JSON response handling
- Redirect to dashboard on success
- Error message display

---

#### **B. Register Form (XMLHttpRequest)** - By Dinesh

**File:** `views/auth/register.ejs`
**Lines:** 102-135

**Function:** Async registration with OTP redirect
```javascript
xhr.open('POST', '/auth/register', true);
xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 300 && res.success) {
        window.location.href = res.redirectUrl || '/auth/verify-otp';
    }
};
```

---

#### **C. Ride Search (AJAX)** - By Sujal

**File:** `views/rides/search.ejs`
**Lines:** 450-520

**Function:** Dynamic ride search with partial rendering
```javascript
xhr.open('GET', `/rides/search/results?${params}`, true);
xhr.onload = function() {
    if (xhr.status === 200) {
        document.getElementById('searchResults').innerHTML = xhr.responseText;
    }
};
```

**Partial Template:** `views/rides/partials/searchResults.ejs`

---

#### **D. Admin Verification Approval (XHR)** - By Dinesh

**File:** `views/admin/verification-details.ejs`
**Lines:** 740-775

**Function:**
```javascript
function approveVerification() {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/admin/verifications/<%= userToVerify._id %>/approve', true);
    xhr.setRequestHeader('Content-Type', 'application/json;charset=UTF-8');
    xhr.send(JSON.stringify({ notes }));
}
```

---

### 3. **Real-time Tracking (Socket.IO)** - By Mohan

**Backend:** `controllers/trackingController.js`
**Frontend:** `views/tracking/live.ejs`
**Client Script:** `public/js/main.js`

**Socket.IO Events:**
```javascript
// Driver sends location updates
socket.emit('driver:location', { bookingId, lat, lng });

// Passenger receives updates
socket.on('tracking:update', (data) => {
    updateMapMarker(data.latitude, data.longitude);
});
```

**Key Features:**
- Real-time GPS tracking
- Location breadcrumbs
- Leaflet.js map integration
- Auto-start on READY_FOR_PICKUP status

**Files:**
- `controllers/trackingController.js` (Lines: 1-500+)
- `views/tracking/live.ejs` (Lines: 1-400+)
- `server.js` (Socket.IO setup, Lines: 32-36)

---

### 4. **SOS Emergency System** - By Mohan

**Controller:** `controllers/sosController.js`
**Client:** `public/js/sos.js`
**View:** `views/sos/active.ejs`

**Key Functions:**

**Backend (sosController.js):**
```javascript
exports.triggerSOS = async (req, res) => {
    const { latitude, longitude, emergencyType, message } = req.body;
    // Create emergency record
    // Notify emergency contacts
    // Alert admin
    // Send SMS via Twilio
};
```

**Frontend (sos.js):**
```javascript
function getCurrentLocation() {
    navigator.geolocation.getCurrentPosition((pos) => {
        sendSOSRequest(pos.coords.latitude, pos.coords.longitude);
    });
}
```

**Features:**
- One-click SOS button
- Automatic location capture
- SMS to emergency contacts
- Admin dashboard alert
- Real-time notification via Socket.IO

**Files:**
- `controllers/sosController.js` (Lines: 1-300+)
- `public/js/sos.js` (Lines: 1-200+)
- `utils/emergencyResponseSystem.js` (Lines: 1-150+)

---

### 5. **API Integration**

**File:** `controllers/apiController.js`

**Functions:**
- `geocodeAddress()` - Convert address to coordinates
- `reverseGeocode()` - Convert coordinates to address
- `getRoute()` - Calculate route between two points
- `calculateETA()` - Estimate arrival time
- `autocomplete()` - Location search suggestions

**External APIs Used:**
- OpenStreetMap Nominatim (Geocoding)
- Leaflet Routing Machine (Route calculation)

---

### 6. **Carbon Calculator** - By Mohan

**File:** `utils/carbonCalculator.js`

**Function:**
```javascript
exports.calculateCarbonSaved = (distance, passengers) => {
    const carEmissionPerKm = 0.192; // kg CO2
    const savedEmissions = distance * carEmissionPerKm * (passengers - 1);
    return savedEmissions.toFixed(2);
};
```

**Usage:** Displayed on ride details and user dashboard

---

### 7. **Route Matching Algorithm**

**File:** `utils/routeMatching.js`

**Function:**
```javascript
exports.matchRides = async (searchParams) => {
    // Calculate distance between origin/destination
    // Filter by date/time window
    // Sort by proximity
    // Return matched rides
};
```

**Turf.js Integration:** Geospatial calculations

---

## 🧪 Test Plan Reference

See `test_plan.md` for detailed:
- Form validation test cases
- API endpoint testing
- Async operation testing
- Screenshots in `network_evidence/`

---

## 🎥 Demo Video

**Link:** [See `demo_link.txt`]

### Key Timestamps:
- **0:00-1:00** - Registration & Login (XHR forms)
- **1:00-2:30** - User dashboard & profile completion
- **2:30-4:00** - Post a ride (AJAX form)
- **4:00-5:30** - Search rides (Dynamic AJAX search)
- **5:30-7:00** - Booking flow & OTP verification
- **7:00-9:00** - Real-time GPS tracking (Socket.IO)
- **9:00-10:00** - SOS emergency system
- **10:00-12:00** - Admin panel (XHR verification approval)
- **12:00-13:00** - In-app chat
- **13:00-14:00** - Reviews & ratings

---

## 📊 Evidence Locations

- **Git Logs:** `git-logs.txt` (Filtered by each team member)
- **Network Evidence:** `network_evidence/` (Screenshots of XHR calls)
- **Test Results:** `test_plan.md` (Validation & async test cases)
- **Task Assignment:** `task_assignment.md` (Who did what)
- **Database Schema:** `schema.sql` or MongoDB dump
- **Documentation:** This file (`README_FULL.md`)

---

## 🗄️ Database Schema

**Collections:**
1. **users** - User accounts, profiles, roles
2. **rides** - Posted rides with origin/destination
3. **bookings** - Ride bookings with status
4. **chats** - Chat messages
5. **reviews** - User ratings
6. **emergencies** - SOS records
7. **reports** - Incident reports
8. **transactions** - Payment records
9. **notifications** - User notifications

See MongoDB dump in submission package for sample data.

---

## 🔒 Security Features

- Password hashing with bcryptjs (10 rounds)
- Session-based authentication
- CSRF protection
- Rate limiting on sensitive routes
- Input validation with express-validator
- XSS prevention with Helmet.js
- SQL injection prevention (NoSQL)
- File upload restrictions (size, type)

---

## 📈 Performance Optimizations

- Compression middleware
- Database indexing on frequently queried fields
- Image optimization with Cloudinary
- Static asset caching
- Lazy loading of ride results
- Socket.IO room-based messaging

---

## 🐛 Known Issues & Future Improvements

**Current Limitations:**
- Payment integration not yet implemented
- Mobile app not available (web-only)

**Future Enhancements:**
- Payment gateway integration (Razorpay/Stripe)
- Machine learning for route optimization
- React/React Native mobile app
- Multi-language support

---

## 📞 Support & Contact

For any issues or queries, contact:

**Team Lead:** Mohan Ganesh (S20230010092)
- Email: mohanganesh165577@gmail.com
- GitHub: [@mohanganesh3](https://github.com/mohanganesh3)

