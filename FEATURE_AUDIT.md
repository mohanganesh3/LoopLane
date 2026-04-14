# FEATURE_AUDIT.md — LoopLane Feature Status Report

> Exhaustive audit of every feature: working, broken, partial, or simulated.

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ WORKING | Feature is implemented and functional end-to-end |
| ⚠️ PARTIAL | Feature exists but has known bugs, missing logic, or incomplete UI |
| ❌ BROKEN | Feature exists but fails at runtime (errors, wrong field names, etc.) |
| 🔧 SIMULATED | Feature has UI/API but returns hardcoded/mock data |
| 🚫 UNIMPLEMENTED | Feature is planned/referenced but has no actual implementation |

---

## 1. Authentication & Authorization

| Feature | Status | Notes |
|---------|--------|-------|
| Email/password registration | ✅ WORKING | OTP email verification, bcrypt hashing |
| OTP verification | ✅ WORKING | Constant-time comparison, rate limited |
| Login with JWT | ✅ WORKING | Access (2h) + Refresh (7d) tokens, HTTP-only cookies |
| Token refresh/rotation | ✅ WORKING | Old token revoked, concurrent request queue on frontend |
| 2FA (TOTP) | ⚠️ PARTIAL | Backend supports; 2FA secrets stored **plaintext** (security risk) |
| Password reset (forgot/reset) | ⚠️ PARTIAL | Works but reset password validation is **weaker** than registration (no special char) |
| Multi-device sessions | ✅ WORKING | RefreshToken tracks device info, revoke per session |
| Role-based access | ✅ WORKING | 9 roles, permission-based middleware |
| Account suspension | ✅ WORKING | Cascade: cancels rides/bookings, sends email |
| Auto-verify on email failure | ❌ BROKEN | `authController.register` auto-verifies if OTP email fails — security hole |
| Dual auth middleware | ⚠️ PARTIAL | `isAuthenticated` (auth.js) and `isAuthenticatedJWT` (jwt.js) have **different** suspension logic |

---

## 2. Ride Management

| Feature | Status | Notes |
|---------|--------|-------|
| Post a ride | ✅ WORKING | OSRM routing, Haversine fallback, preferences, carbon calc |
| Search rides | ✅ WORKING | Multi-filter, polyline matching, score/quality labels |
| Ride details | ✅ WORKING | Privacy-aware, view counter, funnel tracking |
| Update ride | ✅ WORKING | Field validation, owner check |
| Cancel ride | ✅ WORKING | Auto-reassignment for affected passengers, refunds |
| Delete ride | ✅ WORKING | Blocks if active bookings exist |
| Start ride | ✅ WORKING | Requires ≥1 confirmed booking, generates pickup OTPs |
| Complete ride | ✅ WORKING | Cascades to DROPPED_OFF bookings, processes payments |
| Recurring rides (Epic F1) | ⚠️ PARTIAL | Creates up to 90 rides; no UI for managing recurrence series |
| Ride expiry (cron) | ✅ WORKING | ACTIVE → EXPIRED after departure + 30 min |
| Auto-complete stale rides | ✅ WORKING | IN_PROGRESS → COMPLETED if stuck > 2× duration |
| Nearby rides (geo query) | ⚠️ PARTIAL | Uses `$geoWithin` but Ride coordinates are **plain arrays with 2dsphere index** — may not work |
| Popular routes | ✅ WORKING | Aggregation pipeline |
| Ride recommendations | ✅ WORKING | Based on past ride history |
| Route alerts | ✅ WORKING | "Notify me" subscriptions, triggered on new ride post |
| Route alert geo matching | ⚠️ PARTIAL | `findMatchingAlerts` does **full collection scan + in-memory haversine** — won't scale |

---

## 3. Booking System

| Feature | Status | Notes |
|---------|--------|-------|
| Create booking | ✅ WORKING | Atomic seat reservation, gender/verified checks, gamification discount |
| Accept/reject booking | ✅ WORKING | Atomic seat operations |
| Pickup OTP verification | ✅ WORKING | 5-attempt limit, rate limited |
| Dropoff OTP verification | ✅ WORKING | Auto-generated after pickup |
| Payment completion (passenger) | ✅ WORKING | Marks payment as paid |
| Payment confirmation (rider) | ✅ WORKING | Rider confirms receipt → COMPLETED |
| Cancel booking | ✅ WORKING | Tiered refunds, seat restoration, funnel tracking |
| Booking expiry (cron) | ✅ WORKING | PENDING → EXPIRED after 15 min, seats restored |
| Idempotency keys | ✅ WORKING | Handles network retries safely |
| Counter-offer bidding (Epic 5) | ⚠️ PARTIAL | Turn-based bidding works; no push notifications (code commented out) |
| Auto-reassignment | ✅ WORKING | On ride cancellation: find alternatives, polyline match, greedy assign |
| Co-passengers | ✅ WORKING | Embedded array with names/phone/age |

---

## 4. Chat System

| Feature | Status | Notes |
|---------|--------|-------|
| Create/get chat per booking | ✅ WORKING | Unique constraint enforced |
| Send messages | ✅ WORKING | HTML sanitization, 5000 char limit, Socket.IO broadcast |
| Read receipts | ✅ WORKING | Atomic `$addToSet`, double-tick display |
| Typing indicators | ✅ WORKING | Socket.IO events, visual indicator |
| Soft delete messages | ✅ WORKING | Content replaced with "This message was deleted" |
| Unread count | ✅ WORKING | Efficient aggregation with early exit |
| Chat archival | 🚫 UNIMPLEMENTED | `archivedBy` field exists but no API to archive |
| Chat moderation/flagging | 🚫 UNIMPLEMENTED | `flagged`/`flaggedReason` fields exist but no API |
| Chat cleanup (cron) | 🚫 UNIMPLEMENTED | `cleanupOldChats` returns 0 — placeholder only |
| Message types (LOCATION, QUICK_REPLY) | ⚠️ PARTIAL | Schema supports them but no frontend for non-TEXT types |

---

## 5. Review System

| Feature | Status | Notes |
|---------|--------|-------|
| Submit review | ✅ WORKING | Multi-category ratings, photos, tags |
| Two-way reviews | ✅ WORKING | DRIVER_REVIEW and PASSENGER_REVIEW types |
| Reviewee response | ✅ WORKING | Text + timestamp |
| Rating breakdown | ✅ WORKING | Star distribution via aggregation |
| Quick tags (17) | ✅ WORKING | Positive + negative, validated against allowlist |
| Mark as helpful | ⚠️ PARTIAL | No duplicate-vote prevention — unlimited votes |
| Auto-hide (3 reports) | ✅ WORKING | `isPublished` set to false |
| Review stats | ✅ WORKING | Average rating, per-category averages, top tags |
| Review update | ⚠️ PARTIAL | Updates both `review.rating` and `review.ratings.overall` — inconsistency |

---

## 6. Report & Safety System

| Feature | Status | Notes |
|---------|--------|-------|
| Submit report | ✅ WORKING | 14 categories, relationship validation |
| SLA tracking | ✅ WORKING | Auto-priority P1-P4, deadline calculation, breach detection |
| Investigation workflow | ✅ WORKING | Uber-style tiers T1-T4, timeline, playbook |
| Admin review actions | ✅ WORKING | WARNING, SUSPENSION, BAN, REFUND, INVESTIGATION |
| Dispute resolution (D7) | ⚠️ PARTIAL | Schema exists with full dispute lifecycle but no dedicated API endpoints |
| Communication thread | ✅ WORKING | Reporter ↔ Admin messages |
| Safety metrics dashboard | ✅ WORKING | SLA compliance, repeat offenders, category breakdown |

---

## 7. SOS Emergency System

| Feature | Status | Notes |
|---------|--------|-------|
| SOS trigger (3-sec hold) | ✅ WORKING | GPS + device info + animated progress ring |
| Email to emergency contacts | ✅ WORKING | Google Maps link included |
| Admin notification (Socket.IO) | ✅ WORKING | Real-time `emergency:new` event |
| Emergency lifecycle | ✅ WORKING | ACTIVE → ACKNOWLEDGED → RESOLVED/CANCELLED |
| Emergency stats | ✅ WORKING | Aggregation with period filter |
| Automated SOS (crash detection) | ⚠️ PARTIAL | Telematics engine creates Emergency on >3G impact; no 15-sec countdown |
| Emergency contact OTP verification | ⚠️ PARTIAL | OTP stored in MongoDB (should use Redis with TTL) |
| SMS alerts to contacts | ✅ WORKING | Via Twilio (graceful degradation if not configured) |

---

## 8. Tracking & Geo-Fencing

| Feature | Status | Notes |
|---------|--------|-------|
| Live location tracking | ✅ WORKING | Socket.IO broadcast, breadcrumbs (capped 500) |
| Route deviation detection | ✅ WORKING | Turf.js corridor check, MINOR/MAJOR/CRITICAL levels |
| Speed pattern analysis | ✅ WORKING | Dangerous (>140), too slow (<5), erratic (σ > 30) |
| Unusual stop detection | ✅ WORKING | 10 min suspicious, 30 min critical |
| Alert system with cooldown | ✅ WORKING | 5-min cooldown per alert type |
| ETA calculation | ⚠️ PARTIAL | Uses straight-line distance, not route distance |
| Predictive route risk | ✅ WORKING | Time-of-day, distance, historical incidents |
| Admin deviation management | ✅ WORKING | View, resolve, escalate with Socket.IO |
| Driver risk scoring | ✅ WORKING | `(critical × 10) + (unresolved × 5) + (total × 2)` |
| Telematics (IMU sensors) | ⚠️ PARTIAL | Works but **corrupts rating data** — harsh braking increments 1-star count |

---

## 9. Admin Panel

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard KPIs | ✅ WORKING | Users, rides, bookings, revenue |
| User management (CRUD) | ✅ WORKING | Paginated list, suspend, activate, soft delete |
| Rider verification | ⚠️ PARTIAL | Approve works; **Reject clears wrong field names** (`drivingLicense` vs `driverLicense`) |
| Ride management | ⚠️ PARTIAL | List search does **in-memory filtering** after fetching all rides |
| Booking management | ✅ WORKING | Detail with analytics, lifecycle timeline |
| Financial dashboard | ✅ WORKING | Transaction summaries, pending payments, earnings |
| Revenue/activity analytics | ✅ WORKING | Time-series with date range |
| Platform settings | ✅ WORKING | Pricing, safety, features, notifications |
| Geo-fencing dashboard | ✅ WORKING | Deviation CRUD with inline route handlers |
| Export data (CSV) | ✅ WORKING | Users/rides/bookings/transactions, 50K row limit |
| Simulate payment | 🔧 SIMULATED | Creates Transaction but no real gateway |
| Batch settlement | ✅ WORKING | Processes pending rider payouts |
| System health | ✅ WORKING | DB status, memory, uptime, OS info |
| Bulk notifications | ✅ WORKING | By role/segment with Socket.IO |
| Promo codes | ✅ WORKING | Create/list; embedded in Settings singleton |
| Fraud detection | ✅ WORKING | *(Fixed in Session 3)* AuditLog.log() now correct |
| Churn prediction | ✅ WORKING | *(Fixed in Session 3)* AuditLog.log() now correct |
| Route intelligence | ✅ WORKING | *(Fixed in Session 3)* Status enum + highDemand query fixed |
| Conversion funnel | ✅ WORKING | SearchLog aggregation: searched → booked → paid |
| AI Command Center | ✅ WORKING | Gemini-powered insights, streaming chat |
| Bird's Eye / God's Eye | ✅ WORKING | DeckGL arc layers, heatmaps, telemetry, surge |
| Employee management | ✅ WORKING | CRUD with H3 territory, permissions, audit logs |
| Hex map zone allocator | ✅ WORKING | *(Fixed in Session 1)* Viewport-based hex generation |
| Sustainability dashboard | ✅ WORKING | CO₂ savings, tree equivalents |
| Pricing dashboard | ✅ WORKING | Settings-based pricing config |
| Audit logs | ✅ WORKING | Paginated with filters |

---

## 10. Gamification

| Feature | Status | Notes |
|---------|--------|-------|
| 5-factor trust score | ✅ WORKING | Composite 0-100, 5 levels |
| 15 badge types | ✅ WORKING | Automated milestone-based awards |
| Carbon eco-badges | ✅ WORKING | GREEN → BRONZE → SILVER → GOLD → PLATINUM → LEGEND |
| Cancellation rate tracking | ⚠️ PARTIAL | `updateCancellationRate` doesn't increment `totalBookings` |
| Response time tracking | ✅ WORKING | Rolling average, Quick Responder threshold |
| Loyalty tiers | ⚠️ PARTIAL | BLUE/GOLD/PLATINUM tiers exist in schema but no progression logic |

---

## 11. Corporate / B2B (Epic 4)

| Feature | Status | Notes |
|---------|--------|-------|
| B2B dashboard | ⚠️ PARTIAL | Basic stats only, limited functionality |
| Employee enrollment | ✅ WORKING | Work email domain matching |
| Office locations (geofenced) | ⚠️ PARTIAL | CRUD works but **no 2dsphere index** on `officeLocations.location` |
| ESG report | ✅ WORKING | GHG Protocol Scope 3 format |
| Ride subsidization | ⚠️ PARTIAL | Config exists (`subsidyPercentage`) but not applied in booking flow |
| Strict matching (coworkers only) | 🚫 UNIMPLEMENTED | `requireStrictMatching` flag exists but not enforced |

---

## 12. Social Graph (Epic 2)

| Feature | Status | Notes |
|---------|--------|-------|
| OAuth social sync | 🔧 SIMULATED | Random connection count, no real OAuth |
| Friend-of-friend matching | 🚫 UNIMPLEMENTED | `socialConnections` field exists on User but unused in matching |
| Bipartite batch matching | ⚠️ PARTIAL | `bipartiteMatcher.js` exists; can be triggered manually by admin |

---

## 13. Privacy System

| Feature | Status | Notes |
|---------|--------|-------|
| Profile visibility levels | ✅ WORKING | PUBLIC/VERIFIED_ONLY/PRIVATE |
| Contact info hiding | ✅ WORKING | Phone/email toggle with booking override |
| Location sharing toggle | ✅ WORKING | Overridden during active rides for safety |
| Privacy filtering utility | ✅ WORKING | `filterUserPrivacy()` applied across responses |

---

## 14. File Uploads

| Feature | Status | Notes |
|---------|--------|-------|
| Profile photo | ✅ WORKING | Cloudinary, auto quality, GIF/WebP support |
| Driver license upload | ✅ WORKING | JPEG/PNG/PDF, 10MB limit |
| Government ID upload | ✅ WORKING | Aadhaar, PAN, Passport |
| Vehicle photos | ✅ WORKING | Multiple (max 5) |
| Insurance upload | ✅ WORKING | PDF/image |
| Liveness verification | 🔧 SIMULATED | **Always passes** — compares selfie to itself |

---

## 15. Notifications

| Feature | Status | Notes |
|---------|--------|-------|
| In-app notifications | ✅ WORKING | 36 types, read/unread, priority levels |
| Email notifications (15 templates) | ✅ WORKING | Respects user preferences, security emails bypass |
| SMS notifications (13 types) | ✅ WORKING | Twilio with graceful degradation |
| Push notifications | 🚫 UNIMPLEMENTED | `pushService.js` exists but may be stub |
| Browser Notification API | ✅ WORKING | Frontend NotificationContext requests permission |
| Real-time Socket.IO | ✅ WORKING | Instant delivery for online users |
| TTL auto-expiry | ✅ WORKING | MongoDB TTL index on `expiresAt` |
| Notification preferences | ✅ WORKING | Per-channel toggles |

---

## 16. Financial

| Feature | Status | Notes |
|---------|--------|-------|
| Transaction ledger | ✅ WORKING | 4 types: payment, commission, payout, refund |
| Platform commission | ⚠️ PARTIAL | **Inconsistent**: hardcoded 10% in some paths, Settings-based in others |
| Refund processing | ✅ WORKING | Tiered refund calculation |
| Rider earnings | ✅ WORKING | Aggregation pipeline |
| Wallet | 🔧 SIMULATED | Hardcoded ₹500 balance |
| Payment gateway | 🔧 SIMULATED | `simulatePayment` creates Transaction with no real gateway |
| BlaBlaCar pricing | ✅ WORKING | Cost calculator with vehicle multipliers |
| Invoice generation | ✅ WORKING | JSON format (no PDF for invoices) |

---

## 17. Maps & Geospatial

| Feature | Status | Notes |
|---------|--------|-------|
| Leaflet map rendering | ✅ WORKING | OpenStreetMap tiles |
| OSRM routing | ✅ WORKING | Distance, duration, GeoJSON geometry |
| Nominatim geocoding | ✅ WORKING | Forward/reverse, autocomplete with cache |
| H3 hex grid | ✅ WORKING | *(Fixed in Session 1)* Viewport-based coverage |
| DeckGL visualization | ✅ WORKING | Arc layers, heatmaps, hex layers |
| Isochrone analysis | ✅ WORKING | Mapbox + Turf.js fallback |
| Weather grid | ⚠️ PARTIAL | OpenWeatherMap with enhanced simulation |
| 2dsphere geo queries | ⚠️ PARTIAL | **Ride/RideRequest/SearchLog** use plain `[Number]` arrays — 2dsphere may not function |

---

## 18. Email & SMS

| Feature | Status | Notes |
|---------|--------|-------|
| 15 email templates | ✅ WORKING | HTML emails with branding |
| Security emails bypass prefs | ✅ WORKING | OTP, password reset, SOS always sent |
| 13 SMS types | ✅ WORKING | Twilio, graceful degradation |
| Notification preference respect | ✅ WORKING | Checks `user.preferences.notifications.email` |

---

## 19. Logging & Monitoring

| Feature | Status | Notes |
|---------|--------|-------|
| Morgan dev-mode logging | ✅ WORKING | Colored output with request body |
| Production rotating logs | ✅ WORKING | Daily rotation, 14-day retention, gzip |
| Request logger middleware | ✅ WORKING | Duration, IP, userId, field redaction |
| Error classification | ✅ WORKING | Mongoose/JWT/Syntax → appropriate status codes |

---

## 20. Deployment & DevOps

| Feature | Status | Notes |
|---------|--------|-------|
| SPA serving in production | ✅ WORKING | Express serves React build from `client/dist` |
| Graceful shutdown | ✅ WORKING | SIGTERM/SIGINT → close HTTP + MongoDB |
| Health check endpoint | ✅ WORKING | DB status, memory, uptime |
| Nodemon dev server | ✅ WORKING | Smart file watching, 1s debounce |
| Database seeding | ✅ WORKING | Admin + sample data scripts |
| 8 migration scripts | ✅ WORKING | Emergency cleanup, booking fixes, index rebuilds |
