# CODEBASE_MAP.md — LoopLane Architecture Reference

> Auto-generated from full codebase audit. Last updated: Session 4.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥18 |
| Framework | Express 4.x |
| Database | MongoDB (Mongoose 8.x ODM) |
| Frontend | React 18, Vite 7, Tailwind CSS 3.3 |
| State | Redux Toolkit + Context API (dual-source) |
| Real-time | Socket.IO 4.x |
| Maps | Leaflet, OSRM, Nominatim, @turf/turf, h3-js, DeckGL + MapLibre |
| Auth | JWT (access 2h + refresh 7d), bcrypt, HTTP-only cookies |
| Uploads | Cloudinary + Multer |
| Email | Nodemailer (SMTP) |
| SMS | Twilio |
| AI | @google/genai (Gemini) |
| PDF | Puppeteer |
| Cron | node-cron (5-min cycle) |

---

## Directory Layout

```
LoopLane/
├── server.js                  # Express + Socket.IO entry (654 lines)
├── package.json               # Backend dependencies
├── config/
│   ├── database.js            # MongoDB connection (pool=10, auto-reconnect)
│   ├── cloudinary.js          # 7 storage buckets, auto quality
│   ├── email.js               # Re-exports utils/emailService
│   └── sms.js                 # Twilio init with graceful degradation
├── middleware/
│   ├── auth.js                # JWT auth, role guards, permission checks (352 lines)
│   ├── jwt.js                 # Token generation/verification, dual auth middleware (225 lines)
│   ├── errorHandler.js        # AppError, asyncHandler, Mongoose error normalization (109 lines)
│   ├── rateLimiter.js         # 9 rate limiter tiers (in-memory store)
│   ├── requestLogger.js       # Dev/prod logging with field redaction
│   ├── upload.js              # Multer + Cloudinary (6 upload configs)
│   └── validation.js          # 16 express-validator chains (1,070 lines)
├── models/ (18 files)
│   ├── User.js                # God object: profile, vehicles, documents, gamification, employees (~580 lines)
│   ├── Ride.js                # Route geometry, tracking, recurring rides
│   ├── Booking.js             # Full lifecycle, OTP verification, bidding, reassignment
│   ├── Chat.js                # 1:1 per booking, embedded messages, read receipts
│   ├── Review.js              # Multi-category ratings, 17 tags, response support
│   ├── Report.js              # 14 categories, SLA tracking, Uber-style investigation
│   ├── Emergency.js           # SOS with GeoJSON, contact notification tracking
│   ├── Notification.js        # 36 types, TTL auto-delete, multi-channel delivery
│   ├── Transaction.js         # Financial ledger: payments, commission, payouts
│   ├── RouteDeviation.js      # Geo-fence violations, admin review workflow
│   ├── RouteAlert.js          # "Notify me" ride alerts with geo matching
│   ├── RideRequest.js         # Bipartite matching pool (Epic 2)
│   ├── SearchLog.js           # Conversion funnel: search → view → book → pay
│   ├── Corporate.js           # B2B enterprise: office nodes, subsidies (Epic 4)
│   ├── AuditLog.js            # Admin action audit trail, 28 action types
│   ├── RefreshToken.js        # Bcrypt-hashed, multi-device sessions
│   ├── Counter.js             # Atomic sequence generator (booking refs)
│   └── Settings.js            # Singleton platform config, feature flags, promo codes
├── controllers/ (21 files, ~14,000 lines)
│   ├── adminController.js     # 50+ admin endpoints (3,580 lines)
│   ├── userController.js      # 40+ user endpoints (2,654 lines)
│   ├── rideController.js      # Ride CRUD, search, matching, recurring (1,788 lines)
│   ├── bookingController.js   # Booking lifecycle, OTP, payments (1,661 lines)
│   ├── employeeController.js  # Employee CRUD, H3 territory (1,096 lines)
│   ├── geospatialController.js# God's Eye, isochrone, weather, fleet (834 lines)
│   ├── trackingControllerEnhanced.js # Geo-fencing alerts, risk assessment (658 lines)
│   ├── reviewController.js    # Review CRUD, stats aggregation (596 lines)
│   ├── authController.js      # Register, login, OTP, password reset (590 lines)
│   ├── sosController.js       # Emergency lifecycle (420 lines)
│   ├── chatController.js      # Chat CRUD, Socket.IO messaging (380 lines)
│   ├── apiController.js       # Geocode/route proxies, notifications (330 lines)
│   ├── reportController.js    # Report filing, messaging (320 lines)
│   ├── aiController.js        # Gemini AI insights, chat, streaming (210 lines)
│   ├── trackingController.js  # Basic tracking endpoints (190 lines)
│   ├── biddingController.js   # Counter-offer bidding (155 lines)
│   ├── corporateController.js # B2B dashboard, enrollment (130 lines)
│   ├── corporateLocationController.js # Office location CRUD (90 lines)
│   ├── carbonReportController.js # ESG report generation (85 lines)
│   ├── livenessController.js  # Face verification MOCK (75 lines)
│   └── socialController.js    # Social graph SIMULATED (60 lines)
├── routes/ (15 files, 158 endpoints)
│   ├── admin.js               # ~70 endpoints — dashboard, users, rides, analytics, AI
│   ├── user.js                # ~50 endpoints — profile, vehicles, gamification, wallet
│   ├── rides.js               # 15 endpoints — CRUD, search, recurring, tracking
│   ├── bookings.js            # 14 endpoints — create, accept/reject, OTP, payment
│   ├── auth.js                # 9 endpoints — register, login, OTP, password
│   ├── reviews.js             # 11 endpoints — submit, respond, helpful, stats
│   ├── chat.js                # 9 endpoints — create, message, read, unread
│   ├── geoFencing.js          # 7 endpoints — deviation CRUD (inline handlers)
│   ├── reports.js             # 5 endpoints — file, list, message
│   ├── sos.js                 # 8 endpoints — trigger, status, admin manage
│   ├── token.js               # 6 endpoints — refresh, revoke, sessions (inline)
│   ├── corporate.js           # 5 endpoints — B2B dashboard, ESG, enrollment
│   ├── api.js                 # 12 endpoints — geo proxies, notifications
│   ├── tracking.js            # 2 endpoints — get/update location
│   └── social.js              # 1 endpoint — social sync
├── utils/ (29 files)
│   ├── routeMatching.js       # Polyline-based ride matching engine (265 lines)
│   ├── geoFencing.js          # Turf.js geo-safety: corridors, speed, stops (532 lines)
│   ├── trustScoreCalculator.js# 5-factor trust score, 15 badges (350 lines)
│   ├── serviceAreas.js        # 10 Indian city service areas + H3 enrichment (502 lines)
│   ├── hexGrid.js             # H3 hex grid utilities (380 lines)
│   ├── carbonCalculator.js    # 40-entry emission matrix, eco badges
│   ├── autoReassignment.js    # Smart ride reassignment on cancellation
│   ├── bipartiteMatcher.js    # Batch ride matching (Epic 2)
│   ├── fraudDetectionEngine.js# Adjacency matrix fraud scan (114 lines)
│   ├── churnPredictor.js      # At-risk user detection + winback (80 lines)
│   ├── supplyPredictor.js     # 24h supply forecast
│   ├── telematicsEngine.js    # IMU sensor processing, crash detection (130 lines)
│   ├── scheduledJobs.js       # 4 cron jobs: expire rides/bookings, cleanup (195 lines)
│   ├── emailService.js        # 15 email templates, Nodemailer
│   ├── smsService.js          # 13 SMS types, Twilio
│   ├── pricingEngine.js       # Dynamic pricing
│   ├── cacheManager.js        # In-memory cache with TTL
│   ├── helpers.js             # 25+ utility functions, privacy system (500 lines)
│   ├── otpService.js          # OTP generation and delivery
│   ├── aiAgent.js             # Gemini function calling agent
│   ├── geminiService.js       # Gemini AI integration
│   ├── routeSuggestionEngine.js # Demand-based suggestions for drivers
│   ├── rideAnalytics.js       # Ride performance analytics
│   ├── trustScoreEngine.js    # Alternative trust score implementation
│   ├── paymentService.js      # Payment gateway abstraction
│   ├── pushService.js         # Push notification service
│   ├── livenessVerifier.js    # Face verification utility
│   ├── userUtils.js           # User utility functions
│   └── logger.js              # Morgan + rotating file streams
└── client/                    # React SPA
    ├── vite.config.js         # Vite 7, proxy to :3000, chunk splitting
    ├── src/
    │   ├── App.jsx            # 60+ routes (lazy loaded), provider nesting
    │   ├── main.jsx           # Redux Provider + PersistGate entry
    │   ├── index.css          # "Fresh Mint Premium" design system (1,257 lines)
    │   ├── context/
    │   │   ├── AuthContext.jsx # Primary auth state, JWT login/logout
    │   │   ├── SocketContext.jsx # Socket.IO connection + room management
    │   │   └── NotificationContext.jsx # Real-time notifications
    │   ├── redux/
    │   │   ├── store.js       # Persist: auth + ui slices to localStorage
    │   │   └── slices/
    │   │       ├── authSlice.js        # User state (persisted)
    │   │       ├── ridesSlice.js       # Ride search/filters
    │   │       ├── bookingsSlice.js    # Booking state
    │   │       ├── notificationsSlice.js # Notifications (duplicates Context)
    │   │       └── uiSlice.js          # Theme, sidebar, modals (persisted)
    │   ├── services/
    │   │   ├── api.js          # Axios: token refresh interceptor, cookie auth
    │   │   ├── adminService.js # Admin API calls
    │   │   ├── authService.js  # Auth API calls
    │   │   ├── bookingService.js # Booking API calls
    │   │   ├── chatService.js  # Chat API calls
    │   │   ├── locationService.js # Geo/map API calls
    │   │   ├── reportService.js # Report API calls
    │   │   ├── reviewService.js # Review API calls
    │   │   ├── rideService.js  # Ride API calls
    │   │   └── userService.js  # User API calls
    │   ├── hooks/
    │   │   ├── useCustomCursor.js     # Lerp cursor with ring + dot
    │   │   ├── useGeoFencing.js       # Browser geolocation tracking
    │   │   ├── useLocationAutocomplete.js # Nominatim with cache/retry
    │   │   ├── useLoopLaneAnimations.js # 528-line animation library
    │   │   ├── useMagneticEffect.js   # GSAP magnetic pull
    │   │   ├── useRedux.js            # Typed dispatch/selector hooks
    │   │   └── useSmoothScroll.js     # Lenis + GSAP scroll sync
    │   ├── pages/
    │   │   ├── admin/ (25 pages)      # Full admin panel
    │   │   ├── auth/ (6 pages)        # Login, register, OTP, password
    │   │   ├── rides/ (5 pages)       # Post, search, details, edit
    │   │   ├── bookings/ (7 pages)    # List, details, payment, rating
    │   │   ├── chat/ (1 page)         # Real-time chat
    │   │   ├── user/ (18 pages)       # Dashboard, profile, settings, gamification
    │   │   ├── tracking/ (5 files)    # Live tracking, SOS, safety
    │   │   ├── home/ (4 files)        # Landing page sections
    │   │   └── legal/ (implied)       # Terms, privacy, support
    │   └── components/
    │       ├── admin/ (map/chart components)
    │       ├── clay/ (ClayButton, ClayCard, etc.)
    │       ├── common/ (reusable UI components)
    │       ├── layout/ (Header, Footer, Sidebar, AdminLayout)
    │       ├── rides/ (ride-specific components)
    │       ├── AdminRoute.jsx
    │       └── ProtectedRoute.jsx
```

---

## Database Schema Map

### Cross-Model Relationships

```
User ──┬── 1:N ──→ Ride (as rider)
       ├── 1:N ──→ Booking (as passenger or rider)
       ├── 1:N ──→ Review (as reviewer or reviewee)
       ├── 1:N ──→ Report (as reporter or reportedUser)
       ├── 1:N ──→ Emergency (as user/responder)
       ├── 1:N ──→ Notification
       ├── 1:N ──→ RefreshToken (multi-device)
       ├── 1:N ──→ Transaction (as passenger or rider)
       ├── 1:N ──→ RouteAlert (ride alert subscriptions)
       ├── 1:N ──→ SearchLog (conversion funnel)
       └── N:N ──→ Chat (via participants)

Ride ──┬── 1:N ──→ Booking
       ├── 1:N ──→ RouteDeviation
       └── 1:N ──→ Transaction

Booking ──┬── 1:1 ──→ Chat (unique constraint)
          ├── 1:N ──→ Review
          ├── 1:N ──→ Transaction
          ├── 0:N ──→ Report
          └── 0:1 ──→ Booking (self-ref via reassignment chain)

Corporate ── 1:N ──→ User (via corporate.orgId ref)

Settings ── Singleton (platform-wide config)
Counter  ── Singleton per sequence name
```

### Key Indexes

| Model | Index | Type |
|-------|-------|------|
| Ride | `route.start.coordinates` | 2dsphere ⚠️ (plain array, not GeoJSON) |
| Ride | `route.destination.coordinates` | 2dsphere ⚠️ (plain array, not GeoJSON) |
| Emergency | `location.coordinates` | 2dsphere |
| RouteDeviation | `deviationLocation` | 2dsphere |
| RouteAlert | `origin.coordinates`, `destination.coordinates` | 2dsphere (proper GeoJSON) |
| User | `employeeDetails.location.coordinates` | 2dsphere |
| SearchLog | `searchParams.origin/destination.coordinates` | 2dsphere ⚠️ (plain array) |
| Notification | `expiresAt` | TTL (auto-delete) |

---

## Auth Architecture

### Dual-Token JWT System
1. **Access token** — 2h expiry, sent via Bearer header or HTTP-only cookie
2. **Refresh token** — 7d expiry, bcrypt-hashed in DB, HTTP-only cookie
3. **Token rotation** — on refresh, old token revoked, new pair issued
4. **Cookie config** — httpOnly, sameSite: lax (strict), secure in production

### Middleware Stack
- `attachUser` — Optional: enriches `req.user` if token present, never blocks
- `isAuthenticated` — Required: verifies JWT, fetches user, checks account status
- `isRider` / `isPassenger` / `isAdmin` — Role guards
- `isAdminOrEmployee` — 7 employee roles accepted
- `hasPermission(...perms)` — ADMIN/SUPER_ADMIN bypass, others need explicit permissions
- `isVerifiedRider` — Documents approved check
- `canAccessResource(field)` — Owner-or-admin guard

### Frontend Auth Flow
1. `AuthContext` owns user state → syncs to Redux `authSlice`
2. Login → HTTP-only cookies set by server (no localStorage for tokens)
3. 401 → Axios interceptor → `POST /api/token/refresh` → retry queue
4. `ProtectedRoute` re-checks auth every 5 min on navigation
5. Force logout on 403 with `forceLogout` flag (suspension/deletion)

---

## Real-Time Architecture (Socket.IO)

### Room Structure
| Room Name | Subscribers | Events |
|-----------|------------|--------|
| `user-{id}` | Individual user | Notifications, booking updates |
| `ride-{id}` | Ride participants | Location updates, status changes |
| `booking-{id}` | Booking parties | Payment, status transitions |
| `tracking-{id}` | Tracking viewers | Live location stream |
| `chat-{id}` | Chat participants | Messages, typing, read receipts |
| `admin-room` | All admins | Emergencies, alerts, batch events |

### Key Events
- `location-update` / `driver-location` — Live GPS from rider
- `telematics-update` — IMU sensor data from driver device
- `ride-status-update` — Ride lifecycle transitions
- `emergency:new` — SOS triggered → admin room
- `safety-alert` / `driver-warning` — Geo-fence violations
- `chat-notification` — New message indicator
- `notification` / `notification:new` — Push notifications

---

## Scheduled Jobs (node-cron, every 5 min)

| Job | Action |
|-----|--------|
| `expireOldRides` | ACTIVE → EXPIRED if departure > 30 min ago; cascade bookings |
| `expirePendingBookings` | PENDING → EXPIRED if > 15 min old; restore seats |
| `autoCompleteStaleRides` | IN_PROGRESS → COMPLETED if stuck > 2× estimated duration |
| `cleanupExpiredTokens` | Purge expired refresh tokens |
| `cleanupOldChats` | **UNIMPLEMENTED** — placeholder |

---

## Key Algorithms

1. **Polyline Route Matching** — Parametric projection onto line segments, Haversine distance, score 0-100
2. **Atomic Seat Reservation** — MongoDB `findOneAndUpdate` with `$gte` guard
3. **Auto-Reassignment** — On cancellation: find alternatives within ±48h, polyline match, greedy best-fit
4. **Carbon Calculator** — 40-entry emission matrix (8 vehicles × 5 fuels), per-person savings
5. **5-Factor Trust Score** — Profile (20) + Verification (20) + Rating (20) + Experience (20) + Reliability (20)
6. **Geo-Fencing** — Turf.js corridor check, speed analysis, stop detection, predictive risk scoring
7. **Fraud Detection** — Adjacency matrix on completed bookings, isolation ratio flagging
8. **Churn Prediction** — Inactivity threshold + minimum ride count flagging
9. **BlaBlaCar Cost Calculator** — ₹8/km base, split by occupants, vehicle multipliers
10. **Bipartite Matching** — Batch ride-request matching (Epic 2)

---

## Frontend Design System

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Utility | Tailwind CSS 3.3 | Base layout, custom emerald/indigo palette |
| Design tokens | CSS custom properties (40+) | Spacing, color, typography |
| Glassmorphism | `.glass`, `.glass-dark`, `.glass-mint` | Translucent card effects |
| Clay | ClayButton, ClayCard, ClayBadge | 3D tilt components (Framer Motion) |
| Animations | Framer Motion + GSAP + Three.js | Motion, scroll reveals, 3D elements |
| Smooth scroll | Lenis (120fps) | Premium scroll experience |
| Typography | Instrument Serif + Space Grotesk + Caveat | Headlines, body, accents |
