# 🚗 LANE - Carpool Platform

A comprehensive carpooling web application built with Node.js, Express, MongoDB, and EJS. LANE connects riders and passengers for eco-friendly, cost-effective travel.

## ✨ Features

### For Riders (Drivers)
- 🚙 Post and manage rides with flexible scheduling
- 👥 Accept/reject booking requests
- 💰 Flexible pricing with custom rates
- 📍 Real-time location tracking during rides
- 🔐 Secure OTP-based pickup verification
- 💳 Multiple payment options (online/cash)
- ⭐ Rating and review system
- 🚨 Emergency SOS system

### For Passengers
- 🔍 Advanced ride search with filters
- 📱 Real-time ride tracking
- 💬 In-app chat with riders
- 📊 Carbon footprint tracking
- 🔔 Real-time notifications
- 💳 Secure payment integration
- ⭐ Rate and review rides
- 👤 Profile management

### Admin Features
- 📊 Comprehensive dashboard
- 👥 User management
- 🚗 Ride monitoring
- 💰 Payment tracking
- 📈 Analytics and reports
- 🔐 User verification system
- ⚠️ Content moderation

## 🛠️ Tech Stack

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB with Mongoose ODM
- **Authentication:** JWT + Session-based
- **Real-time:** Socket.IO
- **Payment:** Razorpay Integration
- **Email:** Nodemailer
- **SMS:** Twilio
- **File Upload:** Multer + Cloudinary

### Frontend
- **Template Engine:** EJS
- **CSS Framework:** Tailwind CSS
- **JavaScript:** Vanilla JS (ES6+)
- **Maps:** Leaflet.js
- **Charts:** Chart.js
- **Icons:** Font Awesome

### Development Tools
- **Process Manager:** Nodemon
- **Linting:** ESLint
- **Git:** Version Control
- **Environment:** dotenv

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn

### Steps

1. **Clone the repository**
```bash
git clone https://github.com/mohanganesh3/LANE.git
cd LANE
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
BASE_URL=http://localhost:3000
APP_NAME=LANE

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/lane-carpool

# Session Secret
SESSION_SECRET=your_session_secret_here

# JWT
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRE=7d

# Cloudinary (for file uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email Configuration (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password

# Twilio (SMS)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone

# Razorpay (Payment)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# Google Maps API (optional)
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

4. **Start MongoDB**
```bash
# macOS (using Homebrew)
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows
net start MongoDB
```

5. **Seed the database**
```bash
# Create admin user
npm run seed:admin

# Create sample data (optional)
npm run seed:sample
```

6. **Start the application**
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

7. **Access the application**

Open your browser and navigate to: `http://localhost:3000`

### Default Credentials

**Admin:**
- Email: `admin@lanecarpool.com`
- Password: `Admin@123`

**Sample Users (if seeded):**
- Rider 1: `john@example.com` / `Password@123`
- Rider 2: `sarah@example.com` / `Password@123`
- Passenger 1: `alice@example.com` / `Password@123`
- Passenger 2: `bob@example.com` / `Password@123`

## 🚀 Usage

### For Riders

1. **Register as a Rider**
   - Sign up with email and phone
   - Add vehicle details
   - Upload required documents
   - Wait for admin verification

2. **Post a Ride**
   - Enter start and destination locations
   - Set departure date and time
   - Specify available seats and price
   - Add preferences (ladies only, luggage allowed, etc.)

3. **Manage Bookings**
   - Accept or reject booking requests
   - Start ride when ready
   - Verify passenger pickup with OTP
   - Complete ride and mark payments

### For Passengers

1. **Register as a Passenger**
   - Sign up with email and phone
   - Complete profile
   - Start searching for rides

2. **Book a Ride**
   - Search for rides by location and date
   - View ride details and driver profile
   - Book seats and make payment
   - Receive confirmation and OTP

3. **Track Your Ride**
   - View real-time driver location
   - Chat with driver
   - Rate and review after completion

## 📁 Project Structure

```
LANE/
├── config/              # Configuration files
│   ├── database.js      # MongoDB connection
│   ├── cloudinary.js    # Cloudinary setup
│   ├── email.js         # Email configuration
│   └── sms.js           # Twilio SMS setup
│
├── controllers/         # Route controllers
│   ├── authController.js
│   ├── rideController.js
│   ├── bookingController.js
│   ├── chatController.js
│   ├── trackingController.js
│   ├── userController.js
│   ├── adminController.js
│   └── ...
│
├── models/             # Mongoose schemas
│   ├── User.js
│   ├── Ride.js
│   ├── Booking.js
│   ├── Chat.js
│   ├── Review.js
│   └── ...
│
├── routes/             # Express routes
│   ├── auth.js
│   ├── rides.js
│   ├── bookings.js
│   ├── chat.js
│   ├── tracking.js
│   └── ...
│
├── middleware/         # Custom middleware
│   ├── auth.js         # Authentication
│   ├── errorHandler.js # Error handling
│   └── upload.js       # File upload
│
├── views/              # EJS templates
│   ├── auth/           # Login, register, etc.
│   ├── rides/          # Ride management
│   ├── bookings/       # Booking management
│   ├── tracking/       # Live tracking
│   ├── admin/          # Admin dashboard
│   └── partials/       # Reusable components
│
├── public/             # Static files
│   ├── css/
│   ├── js/
│   ├── images/
│   └── uploads/
│
├── utils/              # Utility functions
│   ├── emailService.js
│   ├── smsService.js
│   ├── otpService.js
│   └── ...
│
├── scripts/            # Utility scripts
├── server.js           # Application entry point
├── seed.js             # Database seeder
├── package.json        # Dependencies
└── README.md          # Documentation
```

## 🔌 API Documentation

### Authentication Endpoints

```javascript
POST   /auth/register          # Register new user
POST   /auth/login             # User login
GET    /auth/logout            # User logout
POST   /auth/forgot-password   # Request password reset
POST   /auth/reset-password    # Reset password
POST   /auth/verify-email      # Verify email address
```

### Ride Endpoints

```javascript
GET    /rides/search           # Search rides
POST   /rides                  # Create new ride
GET    /rides/:id              # Get ride details
PUT    /rides/:id              # Update ride
DELETE /rides/:id              # Cancel ride
GET    /rides/my-rides         # Get user's rides
POST   /rides/:id/start        # Start ride
POST   /rides/:id/complete     # Complete ride
```

### Booking Endpoints

```javascript
POST   /bookings               # Create booking
GET    /bookings/:id           # Get booking details
GET    /bookings/my-bookings   # Get user's bookings
POST   /bookings/:id/accept    # Accept booking (rider)
POST   /bookings/:id/reject    # Reject booking (rider)
POST   /bookings/:id/cancel    # Cancel booking
POST   /bookings/:id/verify-pickup  # Verify pickup OTP
POST   /bookings/:id/mark-paid      # Mark payment as received
```

### Tracking Endpoints

```javascript
GET    /tracking/:bookingId         # View live tracking page
GET    /api/tracking/:bookingId     # Get tracking data (API)
POST   /api/tracking/:rideId/location  # Update location (driver)
```

### Chat Endpoints

```javascript
GET    /chat/:rideId            # Get chat for ride
POST   /chat/:rideId/messages   # Send message
GET    /chat/:rideId/messages   # Get messages
```

### User Endpoints

```javascript
GET    /user/profile            # View profile
PUT    /user/profile            # Update profile
POST   /user/vehicle            # Add vehicle
PUT    /user/vehicle/:id        # Update vehicle
DELETE /user/vehicle/:id        # Delete vehicle
```

## 🎯 Key Features Implementation

### 1. Real-time Tracking
- Uses Geolocation API for driver location
- Socket.IO for real-time updates
- Leaflet.js for interactive maps
- Breadcrumb trail visualization

### 2. Payment Integration
- Razorpay for online payments
- Cash payment option
- Commission calculation
- Payment verification

### 3. OTP Verification
- SMS-based OTP for pickup verification
- Time-based OTP expiry
- Secure 4-digit codes
- Twilio integration

### 4. Chat System
- Real-time messaging
- Socket.IO integration
- Unread message badges
- Typing indicators

### 5. Review System
- 5-star rating system
- Written reviews
- Average rating calculation
- Review moderation

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific modules
npm test -- auth
npm test -- rides
npm test -- bookings
```

## 📊 Database Schema

### User Schema
```javascript
{
  email: String,
  password: String (hashed),
  phone: String,
  role: ['RIDER', 'PASSENGER', 'ADMIN'],
  profile: {
    firstName, lastName, bio, photo
  },
  vehicles: [Vehicle],
  verificationStatus: String,
  rating: Object
}
```

### Ride Schema
```javascript
{
  rider: ObjectId (User),
  route: {
    start: { name, coordinates },
    destination: { name, coordinates }
  },
  schedule: {
    departureDateTime, estimatedDuration
  },
  pricing: {
    pricePerSeat, totalSeats, availableSeats
  },
  status: String,
  tracking: {
    isLive, currentLocation, breadcrumbs
  }
}
```

### Booking Schema
```javascript
{
  ride: ObjectId (Ride),
  passenger: ObjectId (User),
  rider: ObjectId (User),
  seatsBooked: Number,
  totalAmount: Number,
  status: String,
  payment: Object,
  verification: {
    pickup: { otp, verified }
  }
}
```
---

