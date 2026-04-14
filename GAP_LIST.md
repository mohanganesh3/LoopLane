# GAP_LIST.md — LoopLane Issues & Gaps Ranked by Severity

> Every bug, security hole, and missing feature found during the codebase audit.
> Ranked by impact. Each item includes file location, root cause, and fix approach.

---

## CRITICAL — Security & Data Integrity

### C1. 2FA secrets stored in plaintext
- **File**: [models/User.js](models/User.js) → `preferences.security.twoFactorSecret`, `twoFactorBackupCodes`
- **Impact**: If database is compromised, all 2FA secrets are exposed, defeating the purpose of 2FA
- **Fix**: Encrypt at rest using `crypto.createCipheriv` with a separate encryption key from env

### C2. Password hash leaks in JSON serialization
- **File**: [models/User.js](models/User.js) → No `toJSON.transform` to strip sensitive fields
- **Impact**: `password`, `otpCode`, `twoFactorSecret`, `passwordResetToken` included in any JSON response that serializes a User document
- **Fix**: Add `toJSON: { transform }` that strips `password`, `otpCode`, `twoFactorSecret`, `twoFactorBackupCodes`, `passwordResetToken`, `loginAttempts`, `lockoutUntil`

### C3. Password reset token stored in plaintext
- **File**: [models/User.js](models/User.js) → `passwordResetToken` field
- **Impact**: DB access exposes all active reset tokens → account takeover
- **Fix**: Hash reset tokens with bcrypt before storage (like RefreshToken model does)

### C4. Auto-verify user on email failure
- **File**: [controllers/authController.js](controllers/authController.js) → `register()`
- **Impact**: If email service is down, users are auto-verified without OTP — bypasses email verification entirely
- **Fix**: On email failure, keep user UNVERIFIED and return error asking user to retry

### C5. Weak JWT refresh secret derivation
- **File**: [middleware/jwt.js](middleware/jwt.js) → `JWT_REFRESH_SECRET = JWT_SECRET + '_refresh'`
- **Impact**: If access secret is compromised, refresh secret is trivially guessable
- **Fix**: Use a separate `JWT_REFRESH_SECRET` environment variable

### C6. Liveness verification is a mock — always passes
- **File**: [controllers/livenessController.js](controllers/livenessController.js) → `mockStoredImageBuffer = imageBuffer`
- **Impact**: Any selfie passes face verification — zero identity assurance
- **Fix**: Implement real face comparison (e.g., AWS Rekognition, OpenCV face-api.js, or DeepFace)

### C7. Telematics engine corrupts rating data
- **File**: [utils/telematicsEngine.js](utils/telematicsEngine.js) → line ~88
- **Impact**: `$inc: { 'rating.breakdown.oneStar': 1 }` on non-critical events (harsh braking) inflates 1-star count in user's actual review rating breakdown
- **Fix**: Remove the `$inc` on `rating.breakdown` — use a separate `drivingEvents` counter if needed

---

## HIGH — Runtime Bugs & Wrong Field Names

### H1. 2dsphere indexes on plain `[Number]` arrays (not GeoJSON)
- **Files**: [models/Ride.js](models/Ride.js) → `route.start.coordinates`, `route.destination.coordinates`; [models/RideRequest.js](models/RideRequest.js); [models/SearchLog.js](models/SearchLog.js)
- **Impact**: MongoDB 2dsphere indexes require GeoJSON `{ type: 'Point', coordinates: [lng, lat] }` or legacy pairs. Plain `[Number]` arrays may cause index creation failures or silent query failures
- **Fix**: Either convert to proper GeoJSON format OR change indexes to `2d` (legacy)

### H2. `rejectVerification` clears wrong field names
- **File**: [controllers/adminController.js](controllers/adminController.js) → `rejectVerification()`
- **Impact**: Clears `drivingLicense`, `aadharCard`, `vehicleRC`, `vehicleInsurance` but model uses `driverLicense`, `governmentId`, `insurance` — rejected documents are NOT actually cleared
- **Fix**: Map to correct field names: `documents.driverLicense.status`, `documents.governmentId.status`, `documents.insurance.status`

### H3. RouteDeviation populates non-existent Ride fields
- **File**: [models/RouteDeviation.js](models/RouteDeviation.js) → `getDriverHistory()`, `getUnresolved()`
- **Impact**: Populates `ride` with `'startLocation endLocation'` but Ride schema uses `route.start` and `route.destination` — populated fields are always undefined
- **Fix**: Change populate to `'route.start route.destination'`

### H4. Duplicate auth middleware with inconsistent suspension logic
- **Files**: [middleware/auth.js](middleware/auth.js) → `isAuthenticated`; [middleware/jwt.js](middleware/jwt.js) → `isAuthenticatedJWT`
- **Impact**: `isAuthenticatedJWT` auto-lifts expired suspensions; `isAuthenticated` does not. Routes using different middleware behave differently for suspended users
- **Fix**: Consolidate into one middleware; add auto-suspension-lifting to `isAuthenticated` or remove from `isAuthenticatedJWT`

### H5. Inconsistent commission calculation
- **Files**: [controllers/bookingController.js](controllers/bookingController.js) → hardcoded 10% in `completeRide`/`markAsPaid` paths; [controllers/bookingController.js](controllers/bookingController.js) → Settings-based in `_finalizeBookingPayment`
- **Impact**: Commission differs depending on which code path finalizes payment
- **Fix**: Always fetch from `Settings.getSettings()` and use the configured percentage

### H6. Corporate geofence locations use non-standard GeoJSON
- **File**: [models/Corporate.js](models/Corporate.js) → `officeLocations.location`
- **Impact**: `radiusLimit` nested inside `location` alongside `coordinates` breaks standard GeoJSON — `$near`/`2dsphere` queries won't work; no geospatial index exists
- **Fix**: Move `radiusLimit` out of `location` subdoc; add 2dsphere index on `officeLocations.location`

### H7. Emergency model double-nested GeoJSON
- **File**: [models/Emergency.js](models/Emergency.js) → `location.coordinates.coordinates`
- **Impact**: The 2dsphere index on `'location.coordinates'` may not function correctly since the GeoJSON Point object is at `location.coordinates`, not `location`
- **Fix**: Restructure to standard GeoJSON at `location` level, or verify index path matches actual data structure

### H8. `mongoose.Types.ObjectId()` without `new` (deprecated)
- **File**: [models/RouteDeviation.js](models/RouteDeviation.js) → `getRideStats()`
- **Impact**: Deprecated in Mongoose 7+ — will throw in future versions
- **Fix**: Add `new` keyword: `new mongoose.Types.ObjectId(rideId)`

---

## MEDIUM — Performance, Scalability & Code Quality

### M1. In-memory rate limiting only
- **File**: [middleware/rateLimiter.js](middleware/rateLimiter.js)
- **Impact**: Rate limits reset on server restart, don't work across multiple instances
- **Fix**: Use `rate-limit-redis` store for production deployments

### M2. RouteAlert `findMatchingAlerts` does full collection scan
- **File**: [models/RouteAlert.js](models/RouteAlert.js) → `findMatchingAlerts()`
- **Impact**: Fetches ALL active alerts then haversine-filters in memory — O(n) per ride post
- **Fix**: Use MongoDB `$geoNear` aggregation for initial spatial filter, then schedule/price filter

### M3. RefreshToken `findValidToken` is O(n) bcrypt compares
- **File**: [models/RefreshToken.js](models/RefreshToken.js) → `findValidToken()`
- **Impact**: Iterates all user tokens, bcrypt-compares each. Slow for users with many sessions
- **Fix**: Store a token identifier (first 16 chars unmasked) alongside hash for direct lookup

### M4. Admin `getRides` in-memory search filtering
- **File**: [controllers/adminController.js](controllers/adminController.js) → `getRides()`
- **Impact**: Fetches all rides then filters by search term in JavaScript — doesn't scale
- **Fix**: Use MongoDB `$regex` or text index for search filtering in the query

### M5. Trust score calculator triggers unnecessary DB writes
- **File**: [utils/trustScoreCalculator.js](utils/trustScoreCalculator.js) → `calculateTrustScore()`
- **Impact**: Calls `user.save()` every time — writes even if score hasn't changed
- **Fix**: Only save if score actually changed: `if (user.trustScore.score !== newScore)`

### M6. N+1 queries in badge checking
- **File**: [utils/trustScoreCalculator.js](utils/trustScoreCalculator.js) → `checkAndAwardBadges()`
- **Impact**: 15 badge checks → up to 30 DB operations (findById + save per badge)
- **Fix**: Batch check all criteria in one pass, single save

### M7. Booking expiry without transactions
- **File**: [utils/scheduledJobs.js](utils/scheduledJobs.js) → `expirePendingBookings()`
- **Impact**: Individual `findByIdAndUpdate` calls in a loop without transactions — race conditions with concurrent booking operations
- **Fix**: Use MongoDB transactions or `bulkWrite` for atomicity

### M8. Chat messages embedded in single document
- **File**: [models/Chat.js](models/Chat.js)
- **Impact**: Can hit 16MB BSON limit for very active conversations
- **Fix**: Move messages to a separate collection with chat_id reference (pagination-friendly)

### M9. Dual auth state (Context + Redux)
- **File**: [client/src/context/AuthContext.jsx](client/src/context/AuthContext.jsx), [client/src/redux/slices/authSlice.js](client/src/redux/slices/authSlice.js)
- **Impact**: AuthContext owns state and syncs to Redux. Redux slice thunks (`loginUser`, `checkAuth`) are dead code
- **Fix**: Remove Redux auth thunks, use Context as single source; or remove Context and use Redux only

### M10. Dual notification state (Context + Redux)
- **File**: [client/src/context/NotificationContext.jsx](client/src/context/NotificationContext.jsx), [client/src/redux/slices/notificationsSlice.js](client/src/redux/slices/notificationsSlice.js)
- **Impact**: Duplicate state tracking with potential desync
- **Fix**: Consolidate to one source

### M11. Inconsistent password validation
- **File**: [middleware/validation.js](middleware/validation.js) → `validateResetPassword` vs `validateRegistration`
- **Impact**: Reset password doesn't require special characters that registration does
- **Fix**: Share the same password validation chain

### M12. `console.log` statements in production code
- **Files**: [models/Chat.js](models/Chat.js) → `markAsRead`; [models/User.js](models/User.js) → `getUserName()`; Various context files
- **Impact**: Noise in production logs, potential data leakage
- **Fix**: Remove or replace with proper logger

---

## LOW — Missing Features, Dead Code & DRY Violations

### L1. Wallet is fully simulated
- **File**: [controllers/userController.js](controllers/userController.js) → `getWallet`, `addWalletFunds`
- **Impact**: Hardcoded ₹500 balance — no real wallet functionality
- **Status**: Acceptable for MVP; document as simulated

### L2. Social graph is fully simulated
- **File**: [controllers/socialController.js](controllers/socialController.js) → `syncSocialGraph`
- **Impact**: Random connection count — no real OAuth
- **Status**: Acceptable for MVP; document as simulated

### L3. `cleanupOldChats` unimplemented
- **File**: [utils/scheduledJobs.js](utils/scheduledJobs.js)
- **Impact**: Dead code, chats accumulate indefinitely
- **Fix**: Implement 30-day archival or provide archival API

### L4. `markAsPaid` deprecated but still exported
- **File**: [controllers/bookingController.js](controllers/bookingController.js)
- **Impact**: Dead code, potentially confusing
- **Fix**: Remove export and route reference

### L5. Duplicate routes
- **Files**: [routes/reports.js](routes/reports.js) → `/my-reports` and `/my/reports`; [client/src/App.jsx](client/src/App.jsx) → `/find-ride` and `/search`, `/admin` and `/admin/dashboard`
- **Fix**: Consolidate with redirects

### L6. No TTL on RouteAlert, SearchLog, RideRequest
- **Impact**: Documents accumulate indefinitely
- **Fix**: Add TTL indexes or periodic cleanup cron jobs

### L7. Settings stores promo codes in singleton
- **File**: [models/Settings.js](models/Settings.js)
- **Impact**: Won't scale if promo codes grow
- **Fix**: Extract to separate PromoCode collection (long-term)

### L8. `updateCancellationRate` doesn't increment `totalBookings`
- **File**: [utils/trustScoreCalculator.js](utils/trustScoreCalculator.js)
- **Impact**: Rate calculation wrong if `totalBookings` isn't updated elsewhere
- **Fix**: Verify `totalBookings` is updated on every booking status change, or track it here

### L9. Loyalty tier progression logic missing
- **File**: [models/User.js](models/User.js) → `gamification.tier` (BLUE/GOLD/PLATINUM)
- **Impact**: Tiers exist in schema but no code progresses users between tiers
- **Fix**: Add tier progression logic based on ride count or loyalty points

### L10. Ride `calculateMatchScore` is a dead stub
- **File**: [models/Ride.js](models/Ride.js)
- **Impact**: Returns 0; actual matching logic is in `routeMatching.js`
- **Fix**: Remove the dead method or delegate to `routeMatching`

### L11. Corporate strict matching not enforced
- **File**: [models/Corporate.js](models/Corporate.js) → `rules.requireStrictMatching`
- **Impact**: Flag exists but ride search doesn't filter by corporate affiliation
- **Fix**: Add corporate cohort filter in `searchRides` when user's org has strict matching

### L12. Corporate ride subsidization not applied
- **File**: [models/Corporate.js](models/Corporate.js) → `rules.subsidyPercentage`
- **Impact**: Discount config exists but isn't used in booking creation
- **Fix**: Apply subsidy in `createBooking` when user is enrolled in a corporate org

### L13. `vehicles[].licensePlate` sparse unique index on subdocs
- **File**: [models/User.js](models/User.js)
- **Impact**: Sparse unique indexes on array subdocuments don't work reliably in MongoDB
- **Fix**: Remove unique constraint or extract vehicles to separate collection

### L14. Request logger captures body before auth
- **File**: [middleware/requestLogger.js](middleware/requestLogger.js)
- **Impact**: `userId` is always 'Guest' because logger runs before `attachUser` middleware
- **Fix**: Use `res.on('finish')` pattern to capture `req.user` after middleware chain

### L15. Hardcoded admin role lists in multiple files
- **Files**: [middleware/auth.js](middleware/auth.js), [utils/helpers.js](utils/helpers.js)
- **Impact**: DRY violation — role lists must be updated in sync
- **Fix**: Export role list from a single constants file
