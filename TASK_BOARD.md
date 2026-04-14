# TASK_BOARD.md — LoopLane Engineering Work Queue

> Ordered by priority. Each task references its GAP_LIST.md ID.
> Estimated effort: S (< 30 min), M (30 min – 2 hr), L (2 – 6 hr), XL (> 6 hr)

---

## Sprint 1 — Critical Security Fixes ✅ COMPLETE (committed: 3667f61)

| # | Task | Gap | Effort | Files | Status |
|---|------|-----|--------|-------|--------|
| 1.1 | Add `toJSON.transform` to User model to strip sensitive fields | C2 | S | models/User.js | ✅ |
| 1.2 | Encrypt 2FA secrets at rest | C1 | M | models/User.js, utils/crypto.js (new) | ✅ |
| 1.3 | Hash password reset tokens before storage | C3 | M | models/User.js, controllers/authController.js | ✅ |
| 1.4 | Fix auto-verify on email failure — keep UNVERIFIED | C4 | S | controllers/authController.js | ✅ |
| 1.5 | Separate JWT refresh secret env var | C5 | S | middleware/jwt.js | ✅ |
| 1.6 | Remove rating corruption from telematics engine | C7 | S | utils/telematicsEngine.js | ✅ |
| 1.7 | Fix `rejectVerification` wrong field names | H2 | S | controllers/adminController.js | ✅ |
| 1.8 | Fix RouteDeviation populate to correct Ride field names | H3 | S | models/RouteDeviation.js | ✅ |
| 1.9 | Consolidate duplicate auth middleware | H4 | M | middleware/auth.js | ✅ |
| 1.10 | Fix commission inconsistency — always use Settings | H5 | M | controllers/rideController.js | ✅ |

---

## Sprint 2 — Data Integrity & Index Fixes ✅ COMPLETE (committed: 8bdbdd8)

| # | Task | Gap | Effort | Files | Status |
|---|------|-----|--------|-------|--------|
| 2.1 | Fix 2dsphere indexes on Ride model (GeoJSON format) | H1 | L | models/Ride.js, controllers/rideController.js | ✅ |
| 2.2 | Fix 2dsphere indexes on RideRequest model | H1 | M | models/RideRequest.js | ✅ |
| 2.3 | Fix 2dsphere indexes on SearchLog model | H1 | M | models/SearchLog.js | ✅ |
| 2.4 | Fix Corporate geofence GeoJSON structure + add index | H6 | M | models/Corporate.js, controllers/corporateLocationController.js | ✅ |
| 2.5 | Fix Emergency model double-nested GeoJSON | H7 | M | models/Emergency.js | ✅ |
| 2.6 | Fix deprecated `mongoose.Types.ObjectId()` calls | H8 | S | models/RouteDeviation.js | ✅ |
| 2.7 | Fix inconsistent password validation (reset vs register) | M11 | S | middleware/validation.js | ✅ |
| 2.8 | Remove `console.log` from production model code | M12 | S | models/Chat.js, models/User.js | ✅ |

---

## Sprint 3 — Performance & Scalability ✅ COMPLETE (committed: 641f869)

| # | Task | Gap | Effort | Files | Status |
|---|------|-----|--------|-------|--------|
| 3.1 | Admin `getRides` — use MongoDB query instead of in-memory filter | M4 | M | controllers/adminController.js | ✅ |
| 3.2 | RouteAlert `findMatchingAlerts` — use `$geoNear` | M2 | M | models/RouteAlert.js | ✅ |
| 3.3 | RefreshToken `findValidToken` — add token identifier for O(1) lookup | M3 | L | models/RefreshToken.js | ✅ |
| 3.4 | Trust score — only save on change | M5 | S | utils/trustScoreCalculator.js | ✅ |
| 3.5 | Badge checking — batch in single pass | M6 | M | utils/trustScoreCalculator.js | ✅ |
| 3.6 | Booking expiry — use bulkWrite or transactions | M7 | M | utils/scheduledJobs.js | ✅ |

---

## Sprint 4 — Frontend Cleanup ✅ COMPLETE (committed: 221a9e4)

| # | Task | Gap | Effort | Files | Status |
|---|------|-----|--------|-------|--------|
| 4.1 | Consolidate auth dual state (Context primary, remove Redux thunks) | M9 | M | redux/slices/authSlice.js, redux/store.js, redux/index.js, hooks/useRedux.js | ✅ |
| 4.2 | Consolidate notification dual state | M10 | M | redux/store.js, redux/index.js | ✅ |
| 4.3 | Remove duplicate frontend routes | L5 | S | client/src/App.jsx | ✅ |
| 4.4 | Remove `console.log` from context/service files | M12 | S | AuthContext, NotificationContext, SocketContext, locationService | ✅ |

---

## Sprint 5 — Missing Feature Implementation ✅ COMPLETE (commit `71ce03a`)

| # | Task | Gap | Effort | Files | Status |
|---|------|-----|--------|-------|--------|
| 5.1 | Implement `cleanupOldChats` cron job | L3 | M | utils/scheduledJobs.js | ✅ |
| 5.2 | Remove deprecated `markAsPaid` endpoint | L4 | S | controllers/bookingController.js, routes/bookings.js | ✅ |
| 5.3 | Add TTL indexes for RouteAlert, SearchLog, RideRequest | L6 | M | models/RouteAlert.js, models/SearchLog.js, models/RideRequest.js | ✅ |
| 5.4 | Fix `updateCancellationRate` to track `totalBookings` | L8 | S | utils/trustScoreCalculator.js, controllers/bookingController.js | ✅ |
| 5.5 | Implement loyalty tier progression logic | L9 | M | utils/trustScoreCalculator.js | ✅ |
| 5.6 | Remove dead `calculateMatchScore` stub from Ride model | L10 | S | models/Ride.js | ✅ |
| 5.7 | Implement corporate strict matching in ride search | L11 | L | controllers/rideController.js | ✅ |
| 5.8 | Apply corporate ride subsidization in booking | L12 | M | controllers/bookingController.js | ✅ |
| 5.9 | Fix request logger userId capture timing | L14 | S | middleware/requestLogger.js | ✅ |
| 5.10 | Extract admin role constants to shared file | L15 | S | config/roles.js (new), middleware/auth.js, utils/helpers.js | ✅ |

---

## Sprint 6 — Production Hardening ✅ COMPLETE (commit `2df17b8`)

| # | Task | Gap | Effort | Files | Status |
|---|------|-----|--------|-------|--------|
| 6.1 | Implement real face verification (replace liveness mock) | C6 | XL | controllers/livenessController.js | ✅ |
| 6.2 | Add Redis store for rate limiting | M1 | M | middleware/rateLimiter.js, config/redis.js (new) | ✅ |
| 6.3 | Move emergency contact OTP to Redis with TTL | - | M | controllers/userController.js | ✅ |
| 6.4 | Fix ETA calculation to use route distance | - | M | utils/geoFencing.js | ✅ |
| 6.5 | Extract promo codes to separate collection | L7 | L | models/PromoCode.js (new), models/Settings.js, controllers/adminController.js, controllers/userController.js | ✅ |
| 6.6 | Fix `vehicles[].licensePlate` sparse unique index | L13 | M | models/User.js | ✅ |

---

## Backlog — Not Urgent

| # | Task | Gap | Effort | Notes |
|---|------|-----|--------|-------|
| B1 | Implement chat archival API | - | M | `archivedBy` field exists |
| B2 | Implement chat moderation/flagging API | - | M | `flagged` fields exist |
| B3 | Add LOCATION/QUICK_REPLY message type support in frontend | - | L | Chat.jsx |
| B4 | Implement real OAuth social graph | - | XL | socialController.js |
| B5 | Implement real wallet with payment gateway | - | XL | userController.js |
| B6 | Implement real payment gateway integration | - | XL | paymentService.js |
| B7 | Replace moment.js with date-fns | - | M | utils/helpers.js |
| B8 | Implement push notifications | - | L | utils/pushService.js |
| B9 | Move chat messages to separate collection | M8 | L | models/Chat.js, controllers/chatController.js |
| B10 | Add duplicate route consolidation | L5 | S | routes/reports.js |

---

## Summary

| Priority | Count | Est. Total Effort |
|----------|-------|-------------------|
| Sprint 1 (Critical) | 10 tasks | ~8 hours |
| Sprint 2 (Data Integrity) | 8 tasks | ~8 hours |
| Sprint 3 (Performance) | 6 tasks | ~6 hours |
| Sprint 4 (Frontend) | 4 tasks | ~3 hours |
| Sprint 5 (Features) | 10 tasks | ~8 hours |
| Sprint 6 (Hardening) | 6 tasks | ~10 hours |
| Backlog | 10 tasks | ~30+ hours |
| **Total** | **54 tasks** | **~73+ hours** |
