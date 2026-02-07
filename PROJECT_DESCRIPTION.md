# LoopLane — Full-Stack Real-Time Carpooling Platform

## Project Overview

LoopLane is a production-grade, full-stack carpooling and ride-sharing platform built for the Indian market. It connects riders (drivers) who post available rides with passengers who search, book, track, and pay for shared rides — all in real-time. The platform features a complete admin panel, SOS emergency system, trust scoring, carbon footprint tracking, gamification with badges, real-time chat, live GPS tracking with route deviation detection, and an intelligent ride-matching engine powered by geospatial algorithms.

**Repository:** [github.com/mohanganesh3/LoopLane](https://github.com/mohanganesh3/LoopLane)

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | Node.js (>=18), Express.js 4.x, Socket.IO (WebSocket real-time communication) |
| **Frontend** | React 18, Vite 7, Tailwind CSS 3.3, Redux Toolkit + redux-persist, React Router DOM 6 |
| **Database** | MongoDB with Mongoose ODM (12 collections, 2dsphere geospatial indexes, TTL indexes, compound indexes) |
| **Authentication** | JWT (access + refresh token rotation), bcrypt password hashing, HTTP-only cookies, Express sessions (MongoDB-backed via connect-mongo), OTP-based email verification, two-factor authentication |
| **Real-Time** | Socket.IO with room-based pub/sub architecture (user rooms, ride rooms, chat rooms, tracking rooms, admin room) |
| **Maps & Geospatial** | Leaflet + React-Leaflet, OSRM (Open Source Routing Machine) for route calculation, Nominatim (OpenStreetMap) for geocoding/reverse-geocoding/autocomplete, @turf/turf for geospatial analysis (geo-fencing, route corridors, point-in-polygon, bearing, buffer zones) |
| **Cloud Storage** | Cloudinary (cloud-based CDN) with Multer for multi-field document uploads (profile photos, driver licenses, Aadhaar, RC book, insurance, vehicle photos) |
| **Email** | Nodemailer via SMTP — 15 transactional email templates with user preference-aware sending |
| **SMS** | Twilio — 13 SMS notification types with graceful degradation when unconfigured |
| **Animation/3D** | Framer Motion, GSAP + ScrollTrigger, Three.js + React Three Fiber + Drei, Lenis smooth scroll, Lottie animations |
| **PDF Generation** | Puppeteer (headless Chromium) for server-side PDF rendering from Markdown |
| **Logging** | Morgan + rotating-file-stream (daily rotation, 14-day retention, gzip compression) |

---

## Architecture

### Backend Architecture

- **Monorepo structure** with `/client` (React SPA) and root (Express API server), co-deployed as a single service
- **MVC pattern**: 12 Mongoose models → 12 controllers (total ~11,000+ lines of controller logic) → 13 route files → middleware pipeline
- **158 REST API endpoints** across 13 route groups:
  - Admin: 26 endpoints
  - User: 38 endpoints
  - Rides: 11 endpoints
  - Bookings: 13 endpoints
  - Chat: 8 endpoints
  - Auth: 10 endpoints
  - SOS/Emergency: 8 endpoints
  - Reviews: 8 endpoints
  - Geo-Fencing: 7 endpoints
  - Token Management: 6 endpoints
  - Reports: 4 endpoints
  - Tracking: 3 endpoints
  - External API Integrations (Geocoding, Routing, ETA): 16 endpoints
- **SPA + API co-deployment**: Express serves the React build in production; Vite dev server proxies to backend in development

### Frontend Architecture

- **Hybrid state management**: Redux Toolkit for persistent/cached state (5 slices: auth, UI, rides, bookings, notifications) + React Context API for real-time operations (Auth, Socket, Notifications, Toast)
- **Provider hierarchy**: Redux → ErrorBoundary → AuthProvider → SocketProvider → NotificationProvider → ToastProvider → Router → SmoothScroll → Routes
- **51+ React page components** across 8 modules (Home, Auth, User, Rides, Bookings, Chat, Tracking/Safety, Admin)
- **30+ shared UI components** including Clay-morphism component variants
- **9 API service modules** with centralized Axios instance

---

## Security — 7-Layer Middleware Stack

### Layer 1: Helmet
HTTP security headers including Content-Security-Policy (CSP), HTTP Strict Transport Security (HSTS), X-Frame-Options (clickjacking prevention), X-Content-Type-Options, Referrer-Policy, and more.

### Layer 2: CORS
Configurable Cross-Origin Resource Sharing with allowed origins from environment variables, credentials support enabled for cookie-based auth.

### Layer 3: express-mongo-sanitize
Prevents NoSQL injection attacks by stripping MongoDB operators (`$gt`, `$ne`, `$in`, etc.) from request body, query string, and params.

### Layer 4: xss-clean
Sanitizes all user input against Cross-Site Scripting (XSS) payloads by escaping HTML entities and removing malicious scripts.

### Layer 5: hpp
HTTP Parameter Pollution prevention — blocks repeated query parameters that could bypass input validation or cause unexpected behavior.

### Layer 6: CSRF Protection (csurf)
Cross-Site Request Forgery protection for session-based (non-API) routes using synchronizer token pattern.

### Layer 7: Rate Limiting (8 Tiers)

| Limiter | Window | Max Requests | Purpose |
|---|---|---|---|
| API Limiter | 15 minutes | 100 | General API protection |
| Login Limiter | 15 minutes | 5 | Brute-force prevention (skips successful requests) |
| Register Limiter | 1 hour | 3 | Account creation spam prevention |
| OTP Limiter | 5 minutes | 3 | OTP request throttling |
| SOS Limiter | 1 minute | 5 | Emergency system spam prevention |
| Upload Limiter | 1 hour | 20 | File upload throttling |
| Search Limiter | 1 minute | 30 | Search query throttling |
| Chat Limiter | 1 minute | 20 | Message flood prevention |

### Additional Security Measures

- **JWT token rotation**: Access tokens (15 min expiry) + refresh tokens (7 days) — old refresh token invalidated on each refresh
- **Refresh token hashing**: All refresh tokens are bcrypt-hashed before database storage with device info and IP address tracking
- **HTTP-only cookies**: Tokens stored in `httpOnly`, `Secure` (production), `SameSite` (strict in production, lax in development) cookies — prevents JavaScript access and XSS token theft
- **Password hashing**: bcrypt with configurable salt rounds in Mongoose pre-save hooks
- **Input validation**: 1,082 lines of express-validator middleware covering 15+ validators with emoji-prefixed error messages
- **Account status enforcement**: Every authenticated request validates account status (SUSPENDED/DELETED/INACTIVE) with structured error codes
- **Socket.IO JWT authentication**: WebSocket connections require valid JWT tokens
- **Data anonymization on deletion**: Email replaced with `deleted_{id}@deleted.com`, phone cleared, password invalidated — GDPR-like compliance
- **Login attempt tracking with account lockout**: Brute-force protection at the model level
- **Session-based OTP flow**: Prevents OTP tampering by storing OTP verification state in server-side sessions
- **Timing attack prevention**: OTP expiry checked before value comparison
- **Password reset security**: OTP stored only after successful email delivery to prevent stale OTPs

---

## Authentication System

### Registration Flow
1. User submits email, phone, password, name, role (RIDER/PASSENGER)
2. Server deletes any previous unverified accounts with same email
3. 6-digit OTP generated (10-minute expiry) and sent via email
4. User verifies OTP → email/phone marked as verified
5. PASSENGER users auto-verified; RIDER users redirected to profile completion

### Login Flow
1. Email + password authentication
2. Account status check (SUSPENDED/DELETED/INACTIVE enforcement)
3. Optional two-factor authentication (generates email OTP if 2FA enabled)
4. JWT access token (15 min) + refresh token (7 days) generated
5. Refresh token hashed with bcrypt and stored in MongoDB with device info + IP
6. Tokens set as HTTP-only cookies

### Token Management (6 Endpoints)
- `POST /api/token/refresh` — Token rotation (public, revokes old token)
- `POST /api/token/revoke` — Single device logout
- `POST /api/token/revoke-all` — All-device logout
- `GET /api/token/sessions` — List active sessions with device info
- `DELETE /api/token/sessions/:sessionId` — Revoke specific session
- `POST /api/token/verify` — Verify access token validity

### Hybrid Auth Strategy
- `isAuthenticated` middleware: JWT-first (Bearer header or cookie) with session fallback
- `isAuthenticatedJWT` middleware: Strict JWT-only (no session fallback)
- Account status enforcement on every request with structured JSON error codes (`ACCOUNT_SUSPENDED`, `ACCOUNT_DELETED`, `ACCOUNT_INACTIVE`)

---

## Real-Time Features (Socket.IO)

### Room-Based Architecture

| Room | Pattern | Purpose |
|---|---|---|
| `user-{userId}` | Personal | User-specific notifications |
| `ride-{rideId}` | Per-ride | Ride status updates, location broadcasting |
| `booking-{bookingId}` | Per-booking | Booking lifecycle events |
| `chat-{chatId}` | Per-chat | Real-time messaging |
| `tracking-{bookingId}` | Per-tracking | Live GPS tracking for passengers |
| `admin-room` | Singleton | Platform-wide admin alerts |

### Live GPS Tracking
- Drivers broadcast GPS coordinates via `navigator.geolocation.watchPosition` at high accuracy
- Location updates emitted via Socket.IO to ride room and all booking tracking rooms
- Passengers receive real-time position updates rendered on Leaflet maps with animated car markers
- Breadcrumb trail stored (capped at 500-1000 points) for route history
- Speed (converted m/s → km/h), accuracy, heading, and altitude captured per update

### Real-Time Chat
- Instant messaging with Socket.IO events: `new-message`, `chat-notification`
- Typing indicators: `typing-start`, `typing-stop` events
- Read receipts: `messages-read` event with double-tick UI
- Online presence tracking: `users:online`, `user:online`, `user:offline` events
- Unread count badges with smart "current chat" tracking to prevent false unread dots
- Message types: TEXT, LOCATION, QUICK_REPLY, SYSTEM
- Soft delete: replaces content with "This message was deleted"
- Flagging/moderation support

### Real-Time Notifications
- 35+ notification types pushed instantly via Socket.IO
- Browser Notification API integration for desktop push notifications
- Special modals for ride reassignment scenarios
- Booking lifecycle events: `new-booking-request`, `booking-confirmed`, `booking-rejected`, `pickup-confirmed`, `dropoff-confirmed`, `payment-confirmed`, `booking-cancelled`
- Ride events: `ride-completed`, `ride-auto-completed`
- Emergency events: `emergency:new`, `emergency:cancelled`, `emergency:updated`
- Safety alerts: `safety-alert`, `driver-warning`

---

## Database Design (12 MongoDB Collections)

### 1. User Model (~100+ fields)

**Core fields:** email (unique), phone (unique), password (bcrypt-hashed), role (PASSENGER/RIDER/ADMIN)

**Profile:** firstName, lastName, photo (default avatar), bio (max 500 chars), dateOfBirth, gender (4 enums), structured address

**Documents (Embedded):**
- Driver license: number, images (front/back), expiry, verification status, verifiedBy (admin ref)
- Government ID: type (AADHAAR/PAN/PASSPORT), number, images, verification status
- Insurance: number, images, expiry, verification status

**Vehicles (Embedded Array):**
- make, model, year, color, licensePlate (sparse unique index), photos, seats, vehicleType (8 types: SEDAN/SUV/HATCHBACK/MINIVAN/VAN/MOTORCYCLE/ELECTRIC/OTHER), emissionFactor (default 120 g/km), isDefault, verification status

**Emergency Contacts (Embedded Array, max 5):**
- name, relationship, phone, email, isPrimary, verified (OTP-verified)

**Rating System (Embedded):**
- overall (0–5), totalRatings, breakdown (5-star distribution: {5: count, 4: count, ...})

**Trust Score (Embedded):**
- level (5 enums: NEWCOMER/REGULAR/EXPERIENCED/AMBASSADOR/EXPERT)
- score (0–100)
- lastCalculated timestamp
- factors: 5 scored categories each 0–20 (profile, verification, rating, experience, reliability)

**Badges (Embedded Array, 15 badge types):**
- EMAIL_VERIFIED, PHONE_VERIFIED, ID_VERIFIED, FIRST_RIDE, FREQUENT_RIDER, ECO_WARRIOR, FIVE_STAR_DRIVER, SUPER_HOST, EARLY_ADOPTER, TEN_RIDES, FIFTY_RIDES, HUNDRED_RIDES, QUICK_RESPONDER, RELIABLE_DRIVER, TOP_RATED

**Cancellation Tracking:**
- totalBookings, cancelledByUser, rate (0–100%), recentCancellations array with last-minute flags

**Response Metrics:**
- averageResponseTime (running average), totalResponses, quickResponder boolean, lastResponseAt

**Statistics (14 counters):**
- totalRidesPosted, totalRidesTaken, completedRides, cancelledRides, totalEarnings, totalSpent, carbonSaved, totalDistance, ridesAsDriver, ridesAsPassenger, totalPassengersCarried, memberSince, lastRideAt

**Preferences (Embedded):**
- Notifications: email, push, rideAlerts, sms toggles
- Privacy: shareLocation, profileVisibility (PUBLIC/VERIFIED_ONLY/PRIVATE), showPhone, showEmail
- Security: twoFactorEnabled, twoFactorMethod
- Ride Comfort: music (NO_MUSIC/SOFT_MUSIC/ANY_MUSIC/OPEN_TO_REQUESTS), smoking, pets, conversation (QUIET/SOME_CHAT/CHATTY/DEPENDS_ON_MOOD)
- Booking: instantBooking, verifiedUsersOnly, maxDetourKm (0-50), preferredCoRiderGender (ANY/MALE_ONLY/FEMALE_ONLY/SAME_GENDER)

**Account Management:**
- accountStatus (ACTIVE/SUSPENDED/DELETED/INACTIVE)
- accountStatusHistory array (audit trail with status, reason, changedBy, changedAt)
- Suspension tracking: reason, date, admin ref, appeal notes
- Reactivation tracking
- Soft delete: deletedAt, deletionReason

**Indexes:** email (unique), phone (unique), role, verificationStatus, rating.overall (descending)

**Pre-save hook:** bcrypt password hashing when password is modified

**Instance methods:** comparePassword(), toPublicJSON(), getName()

**Static methods:** getUserName() — resilient name extraction with cascading fallbacks (firstName → displayName → email local part → phone last 4 → "Unknown User")

**Virtuals:** fullName, name

---

### 2. Ride Model

**Route (Embedded):**
- start: name, coordinates [lon,lat] with `2dsphere` geospatial index
- destination: name, coordinates [lon,lat] with `2dsphere` geospatial index
- intermediateStops: [{name, address, coordinates, order}]
- geometry: GeoJSON LineString (complete route polyline from OSRM)
- distance (km), duration (minutes)

**Schedule:** date, time, departureDateTime, flexibleTiming, returnTrip subdoc

**Pricing:** pricePerSeat (INR, min 0), totalSeats (min 1), availableSeats, currency (INR), totalEarnings

**Preferences:** gender (4 enums), autoAcceptBookings, smoking, pets, music (5 enums), conversation (4 enums), luggage (3 enums), maxLuggagePerPassenger

**Carbon Tracking:** totalEmission, perPersonEmission, carbonSaved, equivalentTrees

**Status:** ACTIVE → IN_PROGRESS → COMPLETED/CANCELLED/EXPIRED

**Live Tracking (Embedded):**
- isLive boolean, startedAt/completedAt timestamps
- currentLocation: coordinates, timestamp, speed, accuracy
- breadcrumbs array (GPS trail)
- lastDeviation, deviationHistory

**Indexes:** route.start.coordinates (2dsphere), route.destination.coordinates (2dsphere), rider + status (compound), schedule.departureDateTime, status + departureDateTime (compound), availableSeats

**Pre-save hook:** Sets availableSeats = totalSeats for new documents

**Instance methods:** isBookable() — checks ACTIVE + seats available + future departure

**Virtuals:** formattedPrice (₹), seatsInfo (available/total)

---

### 3. Booking Model

**12-Status Lifecycle:**
PENDING → CONFIRMED → PICKED_UP → IN_PROGRESS → DROPPED_OFF → PAYMENT_CONFIRMED → COMPLETED
      ↘ REJECTED
      ↘ CANCELLED
      ↘ EXPIRED
      ↘ NO_SHOW

**Two-Phase OTP Verification:**
- Pickup verification: code, expiresAt, verified, verifiedAt, attempts
- Dropoff verification: code, expiresAt, verified, verifiedAt, attempts

**Payment (Embedded):**
- status (PENDING/PAID/REFUNDED/PAYMENT_CONFIRMED/FAILED)
- method (CASH/UPI/CARD/WALLET)
- rideFare, platformCommission (default ₹50), totalAmount
- riderConfirmedPayment boolean, riderConfirmedAt, riderConfirmedBy
- refundAmount, refundedAt
- riderPayout subdoc

**Reassignment (Embedded):**
- isReassigned, originalBooking (self-ref), originalRide
- chain: [{fromRide, toRide, reassignedAt, matchScore}]
- attempts count

**Co-Passengers:** name, phone, age (embedded array)

**Journey Tracking:** started, startedAt, completed, completedAt, duration, distance

**Indexes:** ride + passenger (compound), rider + status, passenger + status, status + createdAt

**Pre-save hook:** Auto-calculates riderResponse.respondedAt and responseTime on status change

**Instance methods:**
- canCancel() — checks if ride is >2 hours away and status permits
- calculateRefund() — tiered: 100% (>24h), 75% (>12h), 50% (>6h), 25% (>2h), 0% (<2h)

---

### 4. Chat Model

**Fields:** booking (unique constraint — one chat per booking), participants array, messages (embedded subdocs with sender, content, type, readBy, deleted flag), lastMessageAt, typing indicators, isActive, archivedBy, flagging/moderation

**Instance methods:** addMessage(), markAsRead() (atomic $addToSet), hasUnreadMessages(), getUnreadCount()

**Indexes:** booking, participants, lastMessageAt (descending), messages.timestamp (descending)

---

### 5. Emergency Model

**GeoJSON location** with `2dsphere` geospatial index for proximity queries

**State machine:** ACTIVE → ACKNOWLEDGED → RESOLVED/CANCELLED

**Severity levels:** LOW, MODERATE, HIGH, CRITICAL

**Types:** SOS, ACCIDENT, MEDICAL, SAFETY, OTHER

**Device info capture:** userAgent, platform, language

**Contact notification tracking:** name, email, phone, notifiedAt

**Instance methods:** markAcknowledged(), markResolved(), markCancelled()

**Static methods:** getOpenEmergencyForUser(), getStats() (aggregation pipeline)

---

### 6. Notification Model

- 35+ notification types covering bookings, rides, payments, reviews, verification, SOS, admin, system
- TTL index on expiresAt for automatic document expiration
- Multi-channel delivery: email, SMS, push, in-app booleans
- Priority levels: LOW, NORMAL, HIGH, URGENT
- Static methods: getUnreadCount(), markAllAsRead()

---

### 7. RefreshToken Model

- tokenHash (bcrypt-hashed, unique)
- deviceInfo, ipAddress for session tracking
- Pre-find hook auto-filters expired tokens
- Static methods: hashToken(), verifyToken(), createToken(), findValidToken() (iterates + bcrypt compare), revokeToken(), revokeAllUserTokens(), cleanupExpired(), getActiveSessions()

---

### 8. Report Model

- 14 categories: RECKLESS_DRIVING, HARASSMENT, FRAUD, NO_SHOW, WRONG_ROUTE, INAPPROPRIATE_BEHAVIOR, VEHICLE_CONDITION, EXCESSIVE_SPEED, INTOXICATION, OVERCHARGING, DISCRIMINATION, PRIVACY_VIOLATION, PROPERTY_DAMAGE, OTHER
- Severity: LOW, MEDIUM, HIGH
- Status: PENDING, UNDER_REVIEW, RESOLVED, DISMISSED, ESCALATED
- Admin review workflow: reviewedBy, notes, action (NO_ACTION/WARNING_ISSUED/TEMPORARY_SUSPENSION/PERMANENT_BAN/REFUND_ISSUED/FURTHER_INVESTIGATION)
- Communication thread: [{from, message, timestamp}]
- Static methods: getPendingCount(), getUserReportHistory()

---

### 9. Review Model

- Unique compound index: booking + reviewer (one review per booking per reviewer)
- Multi-category ratings: overall (1-5), punctuality, driving, cleanliness, communication, friendliness, respectfulness
- 17 quick tags (positive + negative)
- Reviewee response support (text + timestamp)
- Auto-hide after 3 reports
- Static method: calculateUserRating() — aggregation pipeline returning avgRating + star distribution

---

### 10. RouteDeviation Model

- GeoJSON deviation + expected locations with 2dsphere indexes
- Auto-escalation pre-save hook: CRITICAL if deviationDistance > 20km or duration > 900s (15 min)
- Admin review workflow with action types (DISMISSED/WARNING/SUSPENSION/ACCOUNT_REVIEW)
- Metadata: speed, heading, routeProgress (%), estimatedDelay (min)
- Static methods: getUnresolved(), getDriverHistory(), getPendingReview(), getRideStats()
- Instance methods: markReturned(), escalate(), adminResolve()

---

### 11. Transaction Model

- Types: BOOKING_PAYMENT, COMMISSION, RIDER_PAYOUT, REFUND
- Payment tracking: method (CASH/UPI/CARD/WALLET), gateway IDs, status, completedAt
- Commission tracking: collected boolean, collectedAt, pending
- Rider payout: amount, settled, method, transactionId
- Static methods: getFinancialSummary() (aggregation), getRiderEarnings() (aggregation)

---

### 12. Settings Model (Singleton)

- Platform-wide configuration with get-or-create pattern
- Pricing: commission (default 10%), baseFare (₹20), pricePerKm (₹5), pricePerMinute (₹1)
- Safety: maxSpeed (100 km/h), routeDeviation (500m), minRating (3.5), autoSuspendReports (3)
- Feature flags: 6 toggles including maintenanceMode
- Environmental: co2PerKm (0.12 kg), co2PerTree (22 kg/year)
- Booking: maxPassengersPerRide (4), cancellationWindow (60 min), autoAcceptRadius (5 km)

---

### Cross-Model Relationship Map

```
User ──┬── 1:N ──→ Ride (as rider)
       ├── 1:N ──→ Booking (as passenger or rider)
       ├── 1:N ──→ Review (as reviewer or reviewee)
       ├── 1:N ──→ Report (as reporter or reportedUser)
       ├── 1:N ──→ Emergency (as user/responder)
       ├── 1:N ──→ Notification
       ├── 1:N ──→ RefreshToken
       ├── 1:N ──→ Transaction (as passenger or rider)
       └── N:N ──→ Chat (via participants)

Ride ──┬── 1:N ──→ Booking
       ├── 1:N ──→ RouteDeviation
       └── 1:N ──→ Transaction

Booking ──┬── 1:1 ──→ Chat (unique constraint)
          ├── 1:N ──→ Review
          ├── 1:N ──→ Transaction
          ├── 0:N ──→ Report
          └── 0:1 ──→ Booking (self-ref via reassignment chain)

Settings ── Singleton (platform-wide config)
```

---

## Key Algorithms & Technical Implementations

### 1. Intelligent Route Matching Engine

Polyline-based ride matching using parametric point-on-segment projection:

**Algorithm:**
1. For each line segment in the ride's route polyline, project the passenger's pickup/dropoff point onto the segment using vector dot product:
   ```
   t = clamp( (P - A) · (B - A) / |B - A|², 0, 1 )
   closestPoint = A + t(B - A)
   ```
2. Calculate Haversine distance between query point and closest point on each segment. Take minimum.
3. Three match conditions: (a) pickup within 5km of route, (b) dropoff within 5km of route, (c) dropoff segment index > pickup segment index (ensures same-direction travel)
4. Scoring: `pickupScore = max(0, 50 - (pickupDist / threshold) × 50)` + `dropoffScore = max(0, 50 - (dropoffDist / threshold) × 50)`
5. Quality labels: PERFECT (≥90), EXCELLENT (≥75), GOOD (≥60), FAIR (≥40), POOR (<40)
6. Returns top 20 matches sorted by score

### 2. Geospatial Safety System

Real-time safety monitoring using @turf/turf geospatial library:

**Route Corridor Check:**
- Uses `turf.nearestPointOnLine()` to snap current location to route polyline
- Severity classification: MINOR (>500m), MAJOR (>1km), CRITICAL (>2km)
- Bearing calculation via `turf.bearing()` for direction analysis

**Speed Pattern Analysis:**
- Calculates mean and standard deviation of recent speeds
- Flags: DANGEROUS_SPEED (max > 140 km/h), TOO_SLOW (avg < 5 km/h), ERRATIC_DRIVING (σ > 30)

**Unusual Stop Detection:**
- Analyzes last 10 location updates within 50m radius
- Duration thresholds: suspicious (>10 min), extended (>30 min)

**Predictive Route Risk Scoring (0–100):**
- Time-of-day factor: +30 (night 22:00–05:00), +15 (dusk/dawn)
- Route length: +25 (>200km), +15 (>100km)
- Historical incidents within 5km of route: +40 (>10 incidents), +20 (>5)
- Uses `turf.pointToLineDistance()` for incident proximity

**Alert cooldown:** 300,000ms (5 min) between same alert types to prevent notification spam

### 3. Atomic Seat Reservation (Race Condition Prevention)

Prevents overselling in concurrent bookings using MongoDB's atomic operations:
```javascript
Ride.findOneAndUpdate(
  { _id: rideId, 'pricing.availableSeats': { $gte: seatsRequested } },
  { $inc: { 'pricing.availableSeats': -seatsRequested } },
  { new: true }
)
```
Single atomic operation validates seat availability AND decrements in one database call. If two users book simultaneously, only one succeeds — the other gets a "no seats available" response.

### 4. Smart Auto-Reassignment

When a driver cancels a ride, the system automatically finds alternative rides for affected passengers:

1. Query all ACTIVE rides within ±48 hours of original departure
2. Exclude same ride/rider, validate route geometry exists
3. Delegate to route matching engine for polyline-based scoring
4. Validate per candidate: seat availability, gender-preference compatibility, verified-user requirements
5. Greedy best-fit: assign to highest-scoring suitable match
6. Track multi-hop reassignment chains on booking documents
7. Configurable: MAX_REASSIGNMENT_ATTEMPTS=3, SEARCH_RADIUS_KM=30, MIN_MATCH_SCORE=40
8. Real-time Socket.IO notifications to both passenger and new rider

### 5. Carbon Footprint Calculator

**40-entry emission factor matrix** (8 vehicle types × 5 fuel types, in g CO₂/km):

| Vehicle | Petrol | Diesel | CNG | Electric | Hybrid |
|---------|--------|--------|-----|----------|--------|
| Sedan | 120 | 110 | 95 | 0 | 70 |
| SUV | 180 | 160 | 140 | 0 | 110 |
| Hatchback | 100 | 90 | 80 | 0 | 60 |
| Minivan | 160 | 145 | 125 | 0 | 95 |
| Van | 200 | 175 | 155 | 0 | 120 |
| Motorcycle | 50 | 45 | 40 | 0 | 30 |
| Electric | 0 | 0 | 0 | 0 | 0 |
| Other | 130 | 120 | 100 | 0 | 80 |

**Formulas:**
- Total emission: `E_total = distance × emissionFactor`
- Per-person: `E_person = E_total / (passengers + 1)`
- Carbon saved per person: `S_person = E_total - E_person`
- Total saved: `S_total = E_total × (n_people - 1)`
- Equivalent trees: `T = S_total / 21` (21 kg CO₂/tree/year)
- Fuel saved: `F = (distance / 15) × n_passengers` liters at ₹100/L
- Reduction percentage: `R = (S_person / E_total) × 100`

**Gamification:** Tiered eco-badges: GREEN (>1kg) → BRONZE (>10kg) → SILVER (>50kg) → GOLD (>100kg) → PLATINUM (>500kg) → LEGEND (>1000kg)

### 6. Five-Factor Trust Score System (0–100)

| Factor | Max Points | Components |
|--------|-----------|------------|
| Profile Completeness | 20 | Basic info (2), photo (2), bio (1), email verified (2.5), phone verified (2.5), DOB (1), gender (1), address (1), emergency contacts (2), vehicle (5) |
| Verification Level | 20 | Email (4), phone (4), driver license (4), government ID (4), vehicle docs (4) |
| Rating Quality | 20 | (rating/5) × 15 + volume bonus: min(totalRatings/20, 1) × 5. Neutral 5 for new users |
| Experience | 20 | Step function: 0→0, 1→2, 5→4, 10→8, 25→12, 50→16, 100→20 completed rides |
| Reliability | 20 | Cancellation-rate bands: ≤2%→20, ≤5%→16, ≤10%→12, ≤20%→8, ≤30%→4, >30%→0. Neutral 10 for <3 bookings |

**Trust Levels:** NEWCOMER (0–20), REGULAR (21–40), EXPERIENCED (41–60), AMBASSADOR (61–80), EXPERT (81–100)

### 7. Tiered Refund Calculation

Time-based refund policy calculated from booking time to ride departure:
- **>24 hours:** 100% refund
- **>12 hours:** 75% refund
- **>6 hours:** 50% refund
- **>2 hours:** 25% refund
- **<2 hours:** 0% refund (non-refundable)

### 8. Haversine Distance Formula

Used as fallback when OSRM routing service is unavailable:
```
a = sin²(Δφ/2) + cos(φ₁) × cos(φ₂) × sin²(Δλ/2)
d = R × 2 × atan2(√a, √(1-a))
```
Where R = 6,371 km (Earth's mean radius)

### 9. BlaBlaCar-Style Cost Calculator

Fair cost sharing for carpooling:
- Fuel cost: ₹105/L ÷ 15 km/L = ₹7/km
- Maintenance: ₹1/km
- Total: ₹8/km base cost
- Split between driver + passengers
- Suggested price range: 70%–140% of calculated fair share
- Includes carbon savings estimate per passenger
- Vehicle-type multipliers for different base rates

### 10. Response Time Analytics

Running average calculation for rider response times:
```
avg_new = (avg_old × count + new_response_time) / (count + 1)
```
Quick Responder threshold: average ≤ 60 minutes

---

## Feature Breakdown

### Ride Management

**Posting a Ride (Rider):**
- Requires verified rider status (approved documents + valid vehicle)
- Route calculated via OSRM with distance, duration, GeoJSON geometry
- Haversine fallback if OSRM unavailable
- Rider's comfort preferences (music, conversation, smoking, pets) copied to ride
- Intermediate stops support with ordering
- Carbon savings pre-calculated per ride

**Searching for Rides (Passenger):**
- Multi-filter search: date range (full day), seat count, smoking/pets/gender preferences
- Intelligent route matching via polyline geometry with match score and quality
- Respects verifiedUsersOnly and co-rider gender preferences
- Privacy-aware: hides phone/email per user privacy settings
- Carbon savings displayed per search result
- HTTP caching disabled for fresh results

**Ride Lifecycle:**
1. ACTIVE — Ride posted and visible to passengers
2. IN_PROGRESS — Ride started by rider (requires ≥1 confirmed booking)
3. COMPLETED — All bookings completed and payments confirmed
4. CANCELLED — Cancelled by rider or admin (triggers auto-reassignment)
5. EXPIRED — Auto-expired if departure was >30 minutes ago (scheduled job)

**Smart Cancellation:**
When a rider cancels, the system automatically:
1. Finds alternative rides for all affected passengers
2. Issues refunds for already-paid bookings
3. Sends real-time cancellation notifications
4. Tracks reassignment chains for audit

---

### Booking System

**Two-Phase OTP Verification Flow:**
1. Rider starts ride → Pickup OTPs generated for all confirmed passengers
2. At pickup: Rider enters passenger's pickup OTP → Booking transitions to PICKED_UP
3. Upon pickup: Dropoff OTP auto-generated and sent to passenger
4. At dropoff: Rider enters dropoff OTP → Booking transitions to DROPPED_OFF
5. Payment confirmation (rider confirms receipt) → PAYMENT_CONFIRMED → COMPLETED

**Atomic Seat Reservation:**
MongoDB `$inc` with `$gte` guard prevents race conditions in concurrent bookings

**Idempotency Support:**
Supports idempotency keys to handle network retries safely

**Payment Model:**
- rideFare (set by rider per seat)
- platformCommission: ₹50 per booking
- totalAmount = rideFare + platformCommission
- Methods: CASH, UPI, CARD, WALLET
- Two-step confirmation: passenger completes → rider confirms receipt

---

### Chat System

- One chat per booking (unique constraint)
- Real-time messaging via Socket.IO
- Typing indicators with live events
- Read receipts with double-tick display (atomic `$addToSet` to prevent race conditions)
- Message types: TEXT, LOCATION, QUICK_REPLY, SYSTEM
- Max message length: 1000 characters (model) / 5000 characters (controller validation)
- Soft delete: content replaced with "This message was deleted"
- Unread count optimized with early exit on first unread
- Participant-only access enforced on every operation
- Online presence tracking

---

### Review System

- Two-way reviews: DRIVER_REVIEW (by passenger) and PASSENGER_REVIEW (by rider)
- Multi-category ratings: overall (1–5), punctuality, communication, cleanliness, driving, friendliness, respectfulness
- 17 quick tags for fast feedback (positive + negative)
- Reviewee can respond (text + timestamp)
- Rating breakdown: 5-star distribution with aggregation pipeline
- Auto-hide after 3 reports
- Review deletion recalculates reviewee's cached rating on User model
- User review stats: average rating, per-category averages, top 10 most common tags

---

### Report & Safety System

- 14 report categories covering safety, behavior, vehicle, and financial concerns
- Severity levels: LOW, MEDIUM, HIGH
- Admin action workflow:
  - WARNING: notification sent to reported user
  - TEMPORARY_SUSPENSION: sets accountStatus with duration, cancels active rides/bookings
  - PERMANENT_BAN: permanent account lockout
  - REFUND: processes refund for booking
  - FURTHER_INVESTIGATION: escalation flag
- Communication thread between reporter and admin
- Auto-suspend threshold: configurable number of reports
- Relationship verification: only users who have interacted (shared ride/booking) can report each other

---

### SOS Emergency System

**Trigger Flow:**
1. User presses and holds SOS button for 3 seconds (animated SVG progress ring)
2. Device captures GPS location (with Nominatim reverse geocoding for address)
3. Falls back to India center coordinates if geolocation denied
4. Emergency document created with GeoJSON location, device info, contacts
5. Email alerts sent to all emergency contacts with Google Maps link
6. Real-time `emergency:new` event emitted to admin room
7. Guard against duplicate triggers

**Admin Management:**
- View all/active emergencies with filters (status, severity, type, date range)
- Acknowledge → Resolve state transitions
- Statistics with period filter (today/week/month/all)
- Resolution time tracking

**Emergency Contacts:**
- Up to 5 contacts per user
- OTP verification for each contact
- Primary contact designation
- CRUD with relationship field

---

### Admin Panel (26 Endpoints)

**Dashboard:**
- Platform KPIs: user counts, ride counts, booking counts
- Revenue via MongoDB `$aggregate` pipelines
- Platform commission: ₹50 × completed bookings
- Unresolved route deviations counter

**User Management:**
- Paginated user listing with role/status/search filters (regex)
- Suspend user: cascade cancellation of all active rides/bookings, HTML suspension email with appeal instructions
- Activate/reactivate users with notification
- Soft delete

**Rider Verification:**
- Review submitted documents (license, Aadhaar, RC, insurance, vehicle photos)
- Approve/reject with document status updates
- Batch approval of all documents + vehicles

**Financial Dashboard:**
- Transaction summaries via `Transaction.getFinancialSummary()` aggregation
- Pending payments list
- Rider earnings reports
- Refund processing

**Analytics:**
- Revenue analytics with date range filtering
- Activity analytics (rides posted, bookings, users)
- Ride analytics with completion rates
- User growth trends
- Environmental impact: CO₂ saved (120g/km formula), equivalent trees (21kg/tree/year)
- Popular routes
- Safety metrics

**Safety Dashboard:**
- Route deviation monitoring with driver risk scoring
  - Risk formula: `(critical × 10) + (unresolved × 5) + (total × 2)`
- Deviation resolution and escalation
- Emergency management: view, acknowledge, resolve
- Emergency statistics with period filters

**Platform Settings:**
- Pricing configuration (commission %, base fare, per-km, per-minute)
- Safety thresholds (max speed, deviation distance, min rating, auto-suspend reports)
- Feature flags (6 toggles including maintenance mode)
- Notification preferences (email/SMS/push/SOS toggles)
- Environmental constants (CO₂ per km, CO₂ per tree)
- Booking limits (max passengers, cancellation window, auto-accept radius)

---

### Geo-Fencing & Route Deviation Detection

**Real-time safety monitoring during rides:**

1. **Route Corridor Check:** Point-to-polyline distance with severity levels
   - MINOR: 500m–1km deviation
   - MAJOR: 1km–2km deviation
   - CRITICAL: 2km+ deviation

2. **Speed Pattern Analysis:**
   - Mean + standard deviation calculation over recent speeds
   - DANGEROUS_SPEED: max > 140 km/h
   - TOO_SLOW: average < 5 km/h
   - ERRATIC_DRIVING: σ > 30

3. **Unusual Stop Detection:**
   - Analyzes location clusters within 50m radius
   - Suspicious stops: >10 minutes
   - Extended stops: >30 minutes

4. **Alert System:**
   - Passengers receive `safety-alert` with action buttons (View Map, Contact Driver, SOS)
   - Driver receives `driver-warning`
   - Admin room notified for HIGH/CRITICAL severity
   - Rate-limited alerts (5-minute cooldown per alert type)

5. **RouteDeviation Records:**
   - Created/updated per deviation event
   - Distance-based severity: >5km=MEDIUM, >10km=HIGH, >15km=CRITICAL
   - Auto-escalation: >20km or >15min = CRITICAL
   - Admin review workflow with resolution tracking

---

### Location & Map Services (No Google Maps)

**Fully open-source map stack:**

| Service | Provider | Usage |
|---|---|---|
| Map tiles | OpenStreetMap | Leaflet map rendering |
| Geocoding | Nominatim | Forward/reverse geocoding, autocomplete |
| Routing | OSRM | Route calculation, distance/duration, GeoJSON geometry, ETA |
| Geospatial analysis | @turf/turf | Geo-fencing, route corridors, point-in-polygon, distance, bearing, buffer |

**Frontend Map Features:**
- Custom colored markers (green=pickup, red=dropoff, orange=user, animated car=driver)
- Auto-fit bounds on map view
- Route polylines from OSRM
- Real-time driver position via Socket.IO
- Location autocomplete with in-memory cache (5-min TTL), rate limiting (1.1s between requests), retry logic, abort controllers

---

### Email System (15 Templates)

**Security-Critical (always sent regardless of preferences):**
- OTP verification email
- Password reset OTP
- Password reset confirmation
- SOS/Emergency alerts

**Transactional (respects user notification preferences):**
- Booking confirmation
- Booking accepted/rejected
- Booking request notification
- Verification approval
- Ride reminder
- Ride started
- Pickup confirmed
- General ride alerts
- Generic notifications

**Notification Preference System:**
- Checks `user.preferences.notifications.email` before sending
- Security-critical emails bypass preferences
- Ride alerts also check `preferences.notifications.rideAlerts`

---

### SMS System (13 Types via Twilio)

- Registration OTP
- Booking request notification
- Booking confirmation
- Booking accepted/rejected
- SOS emergency alert with nearby services
- Ride departure reminder
- Route deviation warning
- Emergency contact verification
- Admin escalation alerts
- Live location updates during emergencies
- Generic messages

**Graceful degradation:** If Twilio credentials are not configured, SMS features are silently disabled without crashing the app.

---

### Gamification

**15 Badge Types:**
| Badge | Criteria |
|---|---|
| EMAIL_VERIFIED | Email verification complete |
| PHONE_VERIFIED | Phone verification complete |
| ID_VERIFIED | Government ID verified |
| FIRST_RIDE | ≥1 completed ride |
| FREQUENT_RIDER | ≥10 completed rides |
| FIFTY_RIDES | ≥50 completed rides |
| HUNDRED_RIDES | ≥100 completed rides |
| ECO_WARRIOR | ≥50kg CO₂ saved |
| FIVE_STAR_DRIVER | ≥4.8 average rating + ≥10 ratings |
| SUPER_HOST | ≥50 rides + ≥4.5 rating |
| EARLY_ADOPTER | Automatic for early users |
| QUICK_RESPONDER | Average response time ≤60 min |
| RELIABLE_DRIVER | Cancellation rate ≤2% |
| TOP_RATED | ≥4.8 rating + ≥20 ratings |
| COMMUNITY_HELPER | Community contribution metrics |

**Carbon badges** (separate system): GREEN → BRONZE → SILVER → GOLD → PLATINUM → LEGEND

**Trust levels** (score-based): NEWCOMER → REGULAR → EXPERIENCED → AMBASSADOR → EXPERT

---

### User Privacy System

**Profile Visibility Levels:**
- PUBLIC: Full profile visible to all authenticated users
- VERIFIED_ONLY: Full profile only visible to verified users
- PRIVATE: Only name + photo visible (unless booking relationship exists)

**Granular Privacy Controls:**
- shareLocation toggle
- showPhone toggle
- showEmail toggle
- profileVisibility selector

**Privacy enforcement:**
- `filterUserPrivacy()` utility applied across all user-facing responses
- Contact info (phone/email) hidden per preferences but overridden during active bookings for safety
- `canViewProfile()` checks visibility level + verification status
- `canShareLocation()` checks location sharing preference (overridden during active rides for safety)

---

### File Upload System (Cloudinary + Multer)

**6 pre-configured storage buckets:**

| Bucket | Cloudinary Folder | Allowed Formats | Max Size |
|---|---|---|---|
| Profile Images | profile-images/ | JPEG, PNG | 10 MB |
| Driver License | driver-licenses/ | JPEG, PNG, PDF | 10 MB |
| Government ID | government-ids/ | JPEG, PNG, PDF | 10 MB |
| Vehicle RC | vehicle-rc/ | JPEG, PNG, PDF | 10 MB |
| Insurance | insurance/ | JPEG, PNG, PDF | 10 MB |
| Vehicle Photos | vehicle-photos/ | JPEG, PNG | 10 MB |

**Upload middleware configurations:**
- Single file: `upload.single(fieldName)`
- Multiple same-field: `upload.multiple(fieldName, maxCount)`
- Multi-field: `upload.fields(config)` for rider document uploads (license, Aadhaar, RC, insurance, vehicle photos)
- Profile photo: separate config with GIF + WebP support
- Multer error handling middleware

---

### Scheduled Jobs (Server-Side Cron)

| Job | Interval | Logic |
|---|---|---|
| Expire old rides | ~5 minutes | Sets ACTIVE rides to EXPIRED if departure was >30 min ago |
| Expire pending bookings | ~5 minutes | Expires PENDING bookings older than 15 min, restores seats |
| Cleanup expired tokens | ~5 minutes | Purges expired refresh tokens from database |
| Cleanup old chats | Planned | Placeholder for 30-day chat cleanup |

---

### Frontend Design System

**3-Layer Styling Architecture:**

1. **Tailwind CSS 3.3** — Custom emerald/indigo palette, Inter font, custom animations
2. **index.css (1,257 lines)** — "LoopLane V4 Fresh Mint Premium" design system:
   - CSS custom properties (40+ design tokens)
   - Glassmorphism utilities (`.glass`, `.glass-dark`, `.glass-mint`, `.glass-card`)
   - Clay-morphism shadows (`.shadow-clay`, `.shadow-organic`)
   - Premium animations: float, blob-morph, pulse-glow, route-draw, marquee
   - Gradient text utilities
   - Noise/grain texture overlays
   - Card skew/tilt for organic feel
3. **design-system.css (980 lines)** — Extended tokens, fluid typography, warm palettes

**Clay Component Library:**
- ClayButton, ClayCard, ClayBadge, ClayInput
- Framer Motion-powered 3D tilt effects
- Multiple shadow variants: glass, mint, emerald, ink, warm

**Font Stack:** Instrument Serif (headlines), Space Grotesk (body), Caveat (handwritten accents)

**Animation Libraries:**
- Framer Motion: Declarative component animations
- GSAP + ScrollTrigger: Complex timeline animations, scroll-triggered reveals
- Three.js + React Three Fiber + Drei: 3D visual elements
- Lenis: Smooth scroll at 120fps
- Lottie: JSON-based vector animations

**Custom Hooks:**
- `useSmoothScroll` — Lenis + GSAP sync, auto-disables on nested scroll pages
- `useGeoFencing` — Browser geolocation tracking with fence violation callbacks
- `useLocationAutocomplete` — Nominatim search with cache, rate limiting, retry, abort
- `useLoopLaneAnimations` — 528-line library: scrollReveal, staggerReveal, tilt, countUp, magnetic
- `useMagneticEffect` — GSAP-powered magnetic pull on interactive elements
- `useCustomCursor` — Lerp-based custom cursor with ring + dot, disabled on touch

---

### Error Handling

**Backend:**
- `AppError` class: Custom operational error with statusCode and isOperational flag
- `asyncHandler`: Promise wrapper eliminating try-catch in route handlers
- Mongoose error normalization: CastError → 404, Duplicate key (11000) → 400, ValidationError → 400
- JWT errors: JsonWebTokenError / TokenExpiredError → 401
- 404 handler: Structured JSON with `availableEndpoints` hints for API routes
- SPA fallback for non-API 404s

**Frontend:**
- Class-based ErrorBoundary at app root with dev-mode error details
- Axios response interceptor for forced logout on 403/401
- Per-component error states in Redux slices

---

### Logging System

**Development:**
- Morgan dev format with colored output
- Request body logging (sanitized: masks password, OTP, token fields)

**Production:**
- Morgan combined format to rotating file streams
- Two streams: `access.log` and `error.log`
- Daily rotation with 14-day retention
- Gzip compression on rotated files
- Custom response-time token (nanosecond precision via `process.hrtime`)
- Skip paths: `/health`, `/favicon.ico`

---

### Development Tooling

- **Nodemon** with smart file watching (1s debounce), watches server files only (ignores client, node_modules, public, logs)
- **Require-cache invalidation** in development for hot-reloading models without server restart
- **Database seeding CLI**: `npm run seed:admin` (idempotent admin creation), `npm run seed:sample` (test data with pre-approved vehicles/documents)
- **8 migration/fix scripts**:
  - `clean-emergency-docs.js` — Remove legacy emergencyId field + index
  - `clear-active-emergencies.js` — Resolve all active emergencies (test reset)
  - `create-test-booking.js` — Generate Ride + Booking for tracking/chat testing
  - `delete-non-admin-users.js` — Purge non-admin users + cascading orphan cleanup
  - `fix-bookings.js` — Link orphaned bookings to rides
  - `fix-chat-read-status.js` — Mark all old messages as read
  - `fix-emergency-index.js` — Drop problematic index
  - `reset-emergency-indexes.js` — Full emergency collection index rebuild

---

### Deployment Architecture

**Development:**
- Backend: `nodemon` on port 3000
- Frontend: Vite dev server on port 5173 with proxy to backend
- Morgan dev logging, environment: `NODE_ENV=development`

**Production:**
- `node server.js` on port 3000
- Express serves pre-built React SPA from `client/dist`
- Morgan combined logging to rotating log files
- Helmet CSP enabled, secure cookies, gzip compression
- Graceful shutdown: SIGTERM/SIGINT handlers for clean MongoDB disconnection and HTTP server closure
- Engine constraints: Node >= 18, npm >= 9

---

## Scale & Complexity Summary

| Metric | Count |
|---|---|
| Backend code | ~25,000+ lines |
| Frontend code | ~15,000+ lines |
| Total codebase | ~40,000+ lines |
| REST API endpoints | 158 |
| MongoDB collections | 12 |
| Controller files | 12 (11,000+ lines) |
| Route files | 13 |
| Middleware files | 7 |
| Utility modules | 13 |
| React page components | 51+ |
| React shared components | 30+ |
| Redux slices | 5 |
| Context providers | 4 |
| Custom hooks | 6 |
| API service modules | 9 |
| Notification types | 35+ |
| Socket.IO event types | 30+ |
| Email templates | 15 |
| SMS notification types | 13 |
| Badge types | 15 |
| Trust levels | 5 |
| Report categories | 14 |
| Validation rules | 15+ validators (1,082 lines) |
| Rate limiter tiers | 8 |
| Cloudinary storage buckets | 6 |
| Scheduled jobs | 4 |
| Database migration scripts | 8 |
| Geospatial indexes | 5 (2dsphere) |
| User roles | 4 (Unauthenticated, Passenger, Rider, Admin) |

---

## Third-Party Integrations

| Service | Purpose | Library |
|---|---|---|
| MongoDB Atlas | Cloud database | mongoose |
| Cloudinary | Image/document CDN with auto-optimization | cloudinary, multer-storage-cloudinary |
| Twilio | SMS notifications (13 templates) | twilio |
| Nodemailer/SMTP | Email notifications (15 templates) | nodemailer |
| OSRM | Route calculation, distance, duration, ETA | axios (REST API) |
| Nominatim (OpenStreetMap) | Forward/reverse geocoding, autocomplete | axios (REST API) |
| OpenStreetMap | Map tiles for Leaflet | react-leaflet |
| Puppeteer | Server-side PDF generation | puppeteer |
