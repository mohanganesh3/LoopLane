# MongoDB Database Schema - LoopLane

## 📊 Database Overview

**Database Name:** `carpool-platform`  
**Database Type:** MongoDB (NoSQL)  
**Version:** 7.6.3  
**ORM:** Mongoose v7.6.3

---

## 📋 Collections Overview

Total Collections: 9

1. **users** - User accounts (Riders, Passengers, Admin)
2. **rides** - Posted rides with origin/destination
3. **bookings** - Ride bookings and status tracking
4. **chats** - Chat messages between users
5. **reviews** - User ratings and reviews
6. **emergencies** - SOS emergency alerts
7. **reports** - Incident reports
8. **transactions** - Payment records
9. **notifications** - User notifications

---

## 1. Users Collection

**File:** `models/User.js`  
**Purpose:** Store user accounts, profiles, roles, verification status

### Schema Structure

```javascript
{
  _id: ObjectId,
  name: String (required, 2-50 chars),
  email: String (required, unique, lowercase),
  password: String (required, hashed with bcrypt),
  phone: String (required, unique),
  role: String (enum: ['RIDER', 'PASSENGER', 'ADMIN'], default: 'PASSENGER'),
  
  // Profile Information
  profilePhoto: String (Cloudinary URL),
  bio: String (max 500 chars),
  dateOfBirth: Date,
  gender: String (enum: ['MALE', 'FEMALE', 'OTHER']),
  
  // Address
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String (default: 'India')
  },
  
  // Rider-Specific Fields
  vehicles: [{
    _id: ObjectId (auto-generated),
    make: String (required),
    model: String (required),
    year: Number (required),
    color: String,
    licensePlate: String (required, unique),
    vehicleType: String (enum: ['CAR', 'SUV', 'HATCHBACK', 'SEDAN']),
    seats: Number (required, 1-8),
    photos: [String] (Cloudinary URLs),
    isDefault: Boolean (default: false)
  }],
  
  documents: {
    drivingLicense: String (Cloudinary URL),
    vehicleRC: String (Cloudinary URL),
    insurance: String (Cloudinary URL),
    aadharCard: String (Cloudinary URL)
  },
  
  verification: {
    status: String (enum: ['PENDING', 'VERIFIED', 'REJECTED'], default: 'PENDING'),
    verifiedAt: Date,
    verifiedBy: ObjectId (ref: 'User'),
    rejectionReason: String,
    documents: {
      drivingLicense: Boolean,
      vehicleRC: Boolean,
      insurance: Boolean
    }
  },
  
  // Preferences
  preferences: {
    music: Boolean (default: true),
    smoking: Boolean (default: false),
    pets: Boolean (default: false),
    luggage: Boolean (default: true),
    chatty: Boolean (default: true)
  },
  
  // Emergency Contacts
  emergencyContacts: [{
    _id: ObjectId (auto-generated),
    name: String (required),
    phone: String (required),
    relation: String (required)
  }],
  
  // Statistics
  stats: {
    totalRides: Number (default: 0),
    totalBookings: Number (default: 0),
    completedRides: Number (default: 0),
    cancelledRides: Number (default: 0),
    totalEarnings: Number (default: 0),
    totalSpent: Number (default: 0),
    carbonSaved: Number (default: 0)
  },
  
  // Ratings
  rating: {
    average: Number (default: 0, min: 0, max: 5),
    count: Number (default: 0)
  },
  
  // OTP & Authentication
  otp: String,
  otpExpiry: Date,
  otpVerified: Boolean (default: false),
  
  resetPasswordToken: String,
  resetPasswordExpiry: Date,
  
  // Account Status
  isActive: Boolean (default: true),
  isBlocked: Boolean (default: false),
  isDeleted: Boolean (default: false),
  
  lastLogin: Date,
  
  createdAt: Date (auto-generated),
  updatedAt: Date (auto-generated)
}
```

### Indexes
```javascript
email: unique
phone: unique
"vehicles.licensePlate": unique (sparse)
```

### Sample Document
```json
{
  "_id": "68ebd03900eb463c384c34d2",
  "name": "John Doe",
  "email": "john@example.com",
  "password": "$2a$10$hashed_password_here",
  "phone": "+919876543210",
  "role": "RIDER",
  "profilePhoto": "https://res.cloudinary.com/lane/image/upload/v1234567890/profile_abc123.jpg",
  "vehicles": [{
    "_id": "vehicleId123",
    "make": "Honda",
    "model": "City",
    "year": 2022,
    "color": "White",
    "licensePlate": "KA01AB1234",
    "vehicleType": "SEDAN",
    "seats": 4,
    "isDefault": true
  }],
  "verification": {
    "status": "VERIFIED",
    "verifiedAt": "2025-10-10T10:00:00.000Z"
  },
  "emergencyContacts": [{
    "name": "Jane Doe",
    "phone": "+919876543211",
    "relation": "Spouse"
  }],
  "stats": {
    "totalRides": 15,
    "completedRides": 12,
    "carbonSaved": 45.5
  },
  "rating": {
    "average": 4.5,
    "count": 10
  },
  "otpVerified": true,
  "isActive": true,
  "createdAt": "2025-09-15T08:30:00.000Z"
}
```

---

## 2. Rides Collection

**File:** `models/Ride.js`  
**Purpose:** Store posted rides with route details

### Schema Structure

```javascript
{
  _id: ObjectId,
  rider: ObjectId (ref: 'User', required),
  
  // Route Information
  fromLocation: String (required),
  toLocation: String (required),
  
  originCoordinates: {
    type: String (default: 'Point'),
    coordinates: [Number] // [longitude, latitude]
  },
  
  destinationCoordinates: {
    type: String (default: 'Point'),
    coordinates: [Number]
  },
  
  // Ride Details
  departureTime: Date (required),
  estimatedArrival: Date,
  distance: Number (kilometers, required),
  duration: Number (minutes),
  
  // Capacity
  totalSeats: Number (required, 1-8),
  availableSeats: Number (required),
  
  // Pricing
  pricePerSeat: Number (required, min: 0),
  
  // Vehicle
  vehicle: {
    make: String,
    model: String,
    licensePlate: String,
    color: String
  },
  
  // Preferences
  preferences: {
    music: Boolean (default: true),
    smoking: Boolean (default: false),
    pets: Boolean (default: false),
    luggage: Boolean (default: true)
  },
  
  // Special Options
  instantBooking: Boolean (default: false),
  ladiesOnly: Boolean (default: false),
  
  // Status
  status: String (enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE'),
  
  // Statistics
  totalBookings: Number (default: 0),
  confirmedBookings: Number (default: 0),
  
  // Carbon Footprint
  carbonSaved: Number (default: 0),
  
  notes: String,
  
  cancelledAt: Date,
  cancellationReason: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
```javascript
rider: 1
status: 1
departureTime: 1
originCoordinates: "2dsphere" (geospatial)
destinationCoordinates: "2dsphere"
```

### Sample Document
```json
{
  "_id": "ride123abc",
  "rider": "68ebd03900eb463c384c34d2",
  "fromLocation": "Bangalore, Karnataka",
  "toLocation": "Mysore, Karnataka",
  "originCoordinates": {
    "type": "Point",
    "coordinates": [77.5946, 12.9716]
  },
  "destinationCoordinates": {
    "type": "Point",
    "coordinates": [76.6394, 12.2958]
  },
  "departureTime": "2025-10-20T14:00:00.000Z",
  "distance": 145,
  "totalSeats": 4,
  "availableSeats": 2,
  "pricePerSeat": 250,
  "vehicle": {
    "make": "Honda",
    "model": "City",
    "licensePlate": "KA01AB1234"
  },
  "instantBooking": true,
  "status": "ACTIVE",
  "carbonSaved": 27.84
}
```

---

## 3. Bookings Collection

**File:** `models/Booking.js`  
**Purpose:** Track ride bookings and their lifecycle

### Schema Structure

```javascript
{
  _id: ObjectId,
  ride: ObjectId (ref: 'Ride', required),
  passenger: ObjectId (ref: 'User', required),
  rider: ObjectId (ref: 'User', required),
  
  // Booking Details
  seatsBooked: Number (required, min: 1),
  
  pickupLocation: {
    address: String,
    coordinates: {
      type: String (default: 'Point'),
      coordinates: [Number]
    }
  },
  
  dropoffLocation: {
    address: String,
    coordinates: {
      type: String (default: 'Point'),
      coordinates: [Number]
    }
  },
  
  // Pricing
  totalPrice: Number (required),
  paymentMethod: String (enum: ['CASH', 'UPI', 'CARD'], default: 'CASH'),
  paymentStatus: String (enum: ['PENDING', 'PAID', 'REFUNDED'], default: 'PENDING'),
  
  // Status Tracking
  status: String (enum: [
    'PENDING',
    'CONFIRMED',
    'READY_FOR_PICKUP',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'REJECTED'
  ], default: 'PENDING'),
  
  // OTP Verification
  pickupOTP: String (6 digits),
  otpVerified: Boolean (default: false),
  otpVerifiedAt: Date,
  
  // Timestamps
  confirmedAt: Date,
  pickupTime: Date,
  dropoffTime: Date,
  completedAt: Date,
  cancelledAt: Date,
  
  cancellationReason: String,
  cancelledBy: ObjectId (ref: 'User'),
  
  // Tracking
  tracking: {
    enabled: Boolean (default: false),
    startedAt: Date,
    currentLocation: {
      type: String (default: 'Point'),
      coordinates: [Number]
    },
    breadcrumbs: [{
      coordinates: [Number],
      timestamp: Date
    }]
  },
  
  // Reviews
  passengerReview: ObjectId (ref: 'Review'),
  riderReview: ObjectId (ref: 'Review'),
  
  notes: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
```javascript
ride: 1
passenger: 1
rider: 1
status: 1
```

### Sample Document
```json
{
  "_id": "booking456def",
  "ride": "ride123abc",
  "passenger": "passenger789ghi",
  "rider": "68ebd03900eb463c384c34d2",
  "seatsBooked": 2,
  "pickupLocation": {
    "address": "Koramangala, Bangalore",
    "coordinates": {
      "type": "Point",
      "coordinates": [77.6136, 12.9352]
    }
  },
  "totalPrice": 500,
  "paymentMethod": "UPI",
  "status": "CONFIRMED",
  "pickupOTP": "123456",
  "confirmedAt": "2025-10-15T10:30:00.000Z"
}
```

---

## 4. Chats Collection

**File:** `models/Chat.js`  
**Purpose:** Store chat messages between users

### Schema Structure

```javascript
{
  _id: ObjectId,
  booking: ObjectId (ref: 'Booking', required),
  
  participants: [{
    user: ObjectId (ref: 'User'),
    role: String (enum: ['RIDER', 'PASSENGER']),
    lastRead: Date
  }],
  
  messages: [{
    _id: ObjectId (auto-generated),
    sender: ObjectId (ref: 'User', required),
    content: String (required, max 1000 chars),
    timestamp: Date (default: now),
    read: Boolean (default: false),
    readAt: Date
  }],
  
  lastMessage: {
    content: String,
    sender: ObjectId (ref: 'User'),
    timestamp: Date
  },
  
  unreadCount: {
    type: Map,
    of: Number
  },
  
  isActive: Boolean (default: true),
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## 5. Reviews Collection

**File:** `models/Review.js`  
**Purpose:** User ratings and reviews after rides

### Schema Structure

```javascript
{
  _id: ObjectId,
  booking: ObjectId (ref: 'Booking', required, unique),
  
  reviewer: ObjectId (ref: 'User', required),
  reviewee: ObjectId (ref: 'User', required),
  
  rating: Number (required, min: 1, max: 5),
  comment: String (min: 10, max: 1000 chars),
  
  tags: [String] (e.g., 'Punctual', 'Friendly', 'Clean Car'),
  
  isReported: Boolean (default: false),
  reportReason: String,
  
  response: {
    comment: String,
    respondedAt: Date
  },
  
  isVisible: Boolean (default: true),
  
  createdAt: Date,
  updatedAt: Date
}
```

### Sample Document
```json
{
  "_id": "review789jkl",
  "booking": "booking456def",
  "reviewer": "passenger789ghi",
  "reviewee": "68ebd03900eb463c384c34d2",
  "rating": 5,
  "comment": "Excellent ride! Very punctual and friendly driver.",
  "tags": ["Punctual", "Friendly", "Safe Driver"],
  "createdAt": "2025-10-16T18:00:00.000Z"
}
```

---

## 6. Emergencies Collection

**File:** `models/Emergency.js`  
**Purpose:** SOS emergency alerts

### Schema Structure

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: 'User', required),
  
  location: {
    type: String (default: 'Point'),
    coordinates: [Number] (required)
  },
  
  address: String,
  
  emergencyType: String (enum: [
    'ACCIDENT',
    'HARASSMENT',
    'BREAKDOWN',
    'MEDICAL',
    'OTHER'
  ], required),
  
  message: String,
  
  booking: ObjectId (ref: 'Booking'),
  
  status: String (enum: [
    'ACTIVE',
    'ACKNOWLEDGED',
    'RESOLVED',
    'FALSE_ALARM'
  ], default: 'ACTIVE'),
  
  notificationsSent: {
    sms: Boolean (default: false),
    email: Boolean (default: false),
    admin: Boolean (default: false)
  },
  
  emergencyContacts: [{
    name: String,
    phone: String,
    notified: Boolean
  }],
  
  resolvedBy: ObjectId (ref: 'User'),
  resolvedAt: Date,
  resolutionNotes: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
```javascript
user: 1
status: 1
createdAt: -1
location: "2dsphere"
```

---

## 7. Reports Collection

**File:** `models/Report.js`  
**Purpose:** User incident reports

### Schema Structure

```javascript
{
  _id: ObjectId,
  reporter: ObjectId (ref: 'User', required),
  reportedUser: ObjectId (ref: 'User'),
  booking: ObjectId (ref: 'Booking'),
  
  type: String (enum: [
    'INAPPROPRIATE_BEHAVIOR',
    'SAFETY_CONCERN',
    'SCAM',
    'FAKE_PROFILE',
    'OTHER'
  ], required),
  
  description: String (required, min: 20, max: 2000),
  evidence: [String] (Cloudinary URLs),
  
  status: String (enum: [
    'PENDING',
    'UNDER_REVIEW',
    'RESOLVED',
    'DISMISSED'
  ], default: 'PENDING'),
  
  reviewedBy: ObjectId (ref: 'User'),
  reviewedAt: Date,
  reviewNotes: String,
  
  actionTaken: String,
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## 8. Transactions Collection

**File:** `models/Transaction.js`  
**Purpose:** Payment records

### Schema Structure

```javascript
{
  _id: ObjectId,
  booking: ObjectId (ref: 'Booking', required),
  
  from: ObjectId (ref: 'User', required),
  to: ObjectId (ref: 'User', required),
  
  amount: Number (required, min: 0),
  
  type: String (enum: ['PAYMENT', 'REFUND'], required),
  
  paymentMethod: String (enum: ['CASH', 'UPI', 'CARD']),
  
  status: String (enum: [
    'PENDING',
    'COMPLETED',
    'FAILED',
    'REFUNDED'
  ], default: 'PENDING'),
  
  transactionId: String (unique),
  
  metadata: Mixed,
  
  createdAt: Date,
  updatedAt: Date
}
```

---

## 9. Notifications Collection

**File:** `models/Notification.js`  
**Purpose:** User notifications

### Schema Structure

```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: 'User', required),
  
  type: String (enum: [
    'BOOKING_REQUEST',
    'BOOKING_CONFIRMED',
    'BOOKING_CANCELLED',
    'RIDE_STARTING',
    'PAYMENT_RECEIVED',
    'REVIEW_RECEIVED',
    'SOS_ALERT',
    'ADMIN_MESSAGE',
    'OTHER'
  ], required),
  
  title: String (required),
  message: String (required),
  
  data: Mixed,
  
  link: String,
  
  isRead: Boolean (default: false),
  readAt: Date,
  
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes
```javascript
user: 1
isRead: 1
createdAt: -1
```

---

## 🔗 Relationships

### User → Rides (One-to-Many)
- One user (rider) can post multiple rides
- `Ride.rider` references `User._id`

### User → Bookings (One-to-Many)
- One user can have multiple bookings (as passenger or rider)
- `Booking.passenger` and `Booking.rider` reference `User._id`

### Ride → Bookings (One-to-Many)
- One ride can have multiple bookings
- `Booking.ride` references `Ride._id`

### Booking → Chat (One-to-One)
- Each booking has one chat
- `Chat.booking` references `Booking._id`

### Booking → Reviews (One-to-Two)
- Each booking can have two reviews (one from passenger, one from rider)
- `Review.booking` references `Booking._id`

### User → Emergencies (One-to-Many)
- One user can trigger multiple SOS alerts
- `Emergency.user` references `User._id`

---

## 📊 Sample Data Statistics

```
Users: 50+ (10 Riders, 35 Passengers, 5 Admin)
Rides: 25+ active rides
Bookings: 40+ bookings (various statuses)
Chats: 30+ chat threads
Reviews: 20+ reviews
Emergencies: 5 SOS alerts (testing)
Reports: 3 incident reports
Transactions: 35+ payment records
Notifications: 200+ notifications
```

---

## 🔐 Data Security

- Passwords: Hashed with bcrypt (10 rounds)
- OTPs: 6-digit random numbers, expiry 10 minutes
- Tokens: Crypto-generated for password reset
- Sensitive data: Not indexed unnecessarily
- Geolocation: Indexed with 2dsphere for efficient queries

---

## 📝 Database Connection

```javascript
// File: config/database.js
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB Connection Error:', error);
    process.exit(1);
  }
};
```

**Connection String:** `mongodb://127.0.0.1:27017/carpool-platform`

---

**Schema Documentation Generated:** October 13, 2025  
**Prepared By:** Group 39 - LoopLane Team  
**Submission:** Mid-Review Assessment
