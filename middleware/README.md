# Middleware Architecture - LoopLane Carpool Platform

## Overview

This document provides a comprehensive overview of the middleware architecture implemented in the LoopLane carpool platform. The middleware is organized into multiple categories based on their function and scope.

---

## Table of Contents

1. [Middleware Categories](#middleware-categories)
2. [Application-Level Middleware](#application-level-middleware)
3. [Router-Level Middleware](#router-level-middleware)
4. [Built-In Middleware](#built-in-middleware)
5. [Third-Party Middleware](#third-party-middleware)
6. [Custom Middleware](#custom-middleware)
7. [Error Handling Middleware](#error-handling-middleware)
8. [Middleware Execution Order](#middleware-execution-order)
9. [JWT Token Authentication](#jwt-token-authentication)
10. [Security Best Practices](#security-best-practices)

---

## Middleware Categories

### 1. **Application-Level**
Middleware applied to all routes via `app.use()`. Executes for every request.

### 2. **Router-Level**
Middleware applied to specific routes or router instances via `router.use()` or as route parameters.

### 3. **Built-In**
Express.js native middleware (body parsers, static file serving).

### 4. **Third-Party**
External packages providing security, logging, and utility features.

### 5. **Custom**
Application-specific middleware for authentication, validation, error handling, etc.

### 6. **Error Handling**
Special middleware with 4 parameters `(err, req, res, next)` for centralized error management.

---

## Application-Level Middleware

These middleware are applied globally to all routes in `server.js`:

| Middleware | Package | Purpose | File Location |
|---|---|---|---|
| **helmet** | helmet | Security headers (XSS, clickjacking, etc.) | server.js:45 |
| **CORS** | cors | Cross-Origin Resource Sharing policy | server.js:48-63 |
| **compression** | compression | Response compression (gzip) | server.js:65 |
| **cookieParser** | cookie-parser | Parse cookies from requests | server.js:68 |
| **express.json** | Built-in | Parse JSON request bodies (10MB limit) | server.js:71 |
| **express.urlencoded** | Built-in | Parse URL-encoded bodies | server.js:72 |
| **mongoSanitize** | express-mongo-sanitize | Prevent NoSQL injection attacks | server.js:75-77 |
| **xss** | xss-clean | Sanitize user input against XSS | server.js:80 |
| **hpp** | hpp | Prevent HTTP parameter pollution | server.js:83-85 |
| **morgan** | morgan | HTTP request logging | server.js:88-97 |
| **express.static** | Built-in | Serve static files | server.js:100-101 |
| **session** | express-session | Session management with MongoDB store | server.js:104-116 |
| **flash** | connect-flash | Flash message support | server.js:119 |
| **csrfMiddleware** | csurf | CSRF protection (non-API only) | server.js:122-130 |
| **locals** | Custom | Make session data available in views | server.js:137-146 |
| **attachUser** | Custom | Attach user to req from session | middleware/auth.js |
| **requestLogger** | Custom | Detailed request logging | middleware/requestLogger.js |

---

## Router-Level Middleware

Applied to specific routes or route groups:

### Rate Limiting

| Middleware | Routes | Limit | File |
|---|---|---|---|
| **apiLimiter** | `/api/*` | 100 req/15min | middleware/rateLimiter.js |
| **loginLimiter** | `/api/auth/login` | 5 req/15min | middleware/rateLimiter.js |
| **registerLimiter** | Registration routes | 3 req/hour | middleware/rateLimiter.js |
| **otpLimiter** | OTP routes | 3 req/5min | middleware/rateLimiter.js |
| **sosLimiter** | SOS routes | 5 req/min | middleware/rateLimiter.js |
| **uploadLimiter** | File upload routes | 20 req/hour | middleware/rateLimiter.js |
| **searchLimiter** | Search routes | 30 req/min | middleware/rateLimiter.js |
| **chatLimiter** | Chat routes | 20 req/min | middleware/rateLimiter.js |

### Authentication & Authorization

| Middleware | Purpose | Routes | File |
|---|---|---|---|
| **isAuthenticated** | Verify user is logged in (JWT or session) | All protected routes | middleware/auth.js |
| **isAuthenticatedJWT** | Verify JWT token only | Token management routes | middleware/jwt.js |
| **isRider** | Verify user is a rider | Ride creation/management | middleware/auth.js |
| **isPassenger** | Verify user is a passenger | Booking routes | middleware/auth.js |
| **isAdmin** | Verify user is admin | Admin panel routes | middleware/auth.js |
| **isVerifiedRider** | Verify rider is verified | Active ride management | middleware/auth.js |
| **canAccessResource** | Verify resource ownership | Edit/delete operations | middleware/auth.js |
| **isGuest** | Verify user is not logged in | Public pages only | middleware/auth.js |

### Validation

| Middleware | Purpose | File |
|---|---|---|
| **validateRegistration** | Validate registration data | middleware/validation.js |
| **validateLogin** | Validate login credentials | middleware/validation.js |
| **validateOTP** | Validate OTP format | middleware/validation.js |
| **validateRide** | Validate ride creation data | middleware/validation.js |
| **validateBooking** | Validate booking data | middleware/validation.js |
| **validateReview** | Validate review data | middleware/validation.js |
| **validateProfileUpdate** | Validate profile updates | middleware/validation.js |
| **validateVehicle** | Validate vehicle data | middleware/validation.js |

### File Upload

| Middleware | Purpose | Max Size | File Types | File |
|---|---|---|---|---|
| **profilePhotoUpload** | Profile photo upload | 10MB | jpg, png | middleware/upload.js |
| **documentUpload** | Document upload | 10MB | jpg, png, pdf | middleware/upload.js |
| **vehiclePhotoUpload** | Vehicle photos (max 5) | 10MB | jpg, png | middleware/upload.js |

---

## Built-In Middleware

Express.js native middleware:

- **express.json()** - Parse JSON request bodies (limit: 10MB)
- **express.urlencoded()** - Parse URL-encoded form data (limit: 10MB)
- **express.static()** - Serve static files from `public/` directory

---

## Third-Party Middleware

External packages integrated into the application:

### Security

| Package | Version | Purpose | Configuration |
|---|---|---|---|
| **helmet** | ^7.2.0 | Security headers | CSP enabled in production |
| **cors** | ^2.8.5 | Cross-origin requests | Whitelist from env var |
| **express-mongo-sanitize** | ^2.2.0 | NoSQL injection prevention | Replace with `_` |
| **xss-clean** | ^0.1.4 | XSS attack prevention | Default config |
| **hpp** | ^0.2.3 | Parameter pollution prevention | Whitelist: tags, price, seats |
| **csurf** | ^1.11.0 | CSRF protection | Cookie-based, API exempt |
| **express-rate-limit** | ^7.1.5 | Rate limiting | Multiple configs |

### Utilities

| Package | Version | Purpose |
|---|---|---|
| **morgan** | ^1.10.0 | HTTP request logging |
| **compression** | ^1.7.4 | Response compression |
| **cookie-parser** | ^1.4.6 | Cookie parsing |
| **express-session** | ^1.18.0 | Session management |
| **connect-mongo** | ^5.1.0 | MongoDB session store |
| **connect-flash** | ^0.1.1 | Flash messages |
| **rotating-file-stream** | ^3.2.5 | Log file rotation |

### File Upload

| Package | Version | Purpose |
|---|---|---|
| **multer** | ^1.4.5-lts.1 | Multipart form data |
| **multer-storage-cloudinary** | ^4.0.0 | Cloudinary integration |

### Validation

| Package | Version | Purpose |
|---|---|---|
| **express-validator** | ^7.0.1 | Input validation & sanitization |

---

## Custom Middleware

Application-specific middleware files:

### 1. **auth.js** - Authentication & Authorization

**Location:** `middleware/auth.js`

**Exports:**
- `isAuthenticated` - Hybrid auth (JWT + session fallback)
- `isRider` - Verify rider role
- `isPassenger` - Verify passenger role
- `isAdmin` - Verify admin role
- `isVerifiedRider` - Check rider verification status
- `canAccessResource` - Verify resource ownership
- `attachUser` - Attach user to request from session
- `isGuest` - Verify unauthenticated user

**Key Features:**
- **Hybrid Authentication**: Tries JWT first, falls back to session
- **Account Status Checks**: Suspended, deleted, inactive
- **Error Codes**: Structured JSON responses with error codes

### 2. **jwt.js** - JWT Token Management

**Location:** `middleware/jwt.js`

**Exports:**
- `generateAccessToken(userId)` - Create 15-minute access token
- `generateRefreshToken(userId)` - Create 7-day refresh token
- `verifyAccessToken(token)` - Verify and decode access token
- `verifyRefreshToken(token)` - Verify and decode refresh token
- `isAuthenticatedJWT` - JWT-only authentication middleware
- `extractToken(req)` - Extract token from header or cookie
- `getCookieOptions(maxAge)` - Generate secure cookie options

**Token Rotation:**
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days
- Refresh tokens are single-use (rotated on refresh)
- Stored in database with device info and IP

### 3. **validation.js** - Input Validation

**Location:** `middleware/validation.js` (1082 lines)

**Features:**
- Express-validator integration
- Custom error messages per field
- Sanitization (trim, escape, normalize)
- Complex validation rules (phone, email, coordinates)
- Tag validation with 100+ predefined tags
- Field-specific character limits

### 4. **errorHandler.js** - Error Handling

**Location:** `middleware/errorHandler.js`

**Exports:**
- `AppError` - Custom error class with status codes
- `notFound` - 404 handler
- `errorHandler` - Global error handler
- `asyncHandler` - Async route wrapper

**Error Types Handled:**
- Mongoose CastError → 404
- Duplicate key (11000) → 400
- Validation errors → 400
- JSON parse errors → 400
- JWT errors → 401

### 5. **upload.js** - File Upload

**Location:** `middleware/upload.js`

**Features:**
- Cloudinary storage integration
- File type validation (jpg, png, pdf, doc, docx)
- File size limit: 10MB
- Multiple field configurations
- Custom error messages

### 6. **rateLimiter.js** - Rate Limiting

**Location:** `middleware/rateLimiter.js`

**Configurations:**
- API limiter: 100 requests/15min
- Login limiter: 5 attempts/15min (skips successful)
- Register limiter: 3 registrations/hour
- OTP limiter: 3 requests/5min
- SOS limiter: 5 requests/minute
- Upload limiter: 20 uploads/hour
- Search limiter: 30 searches/minute
- Chat limiter: 20 messages/minute

### 7. **requestLogger.js** - Request Logging

**Location:** `middleware/requestLogger.js`

**Features:**
- Logs timestamp, method, URL, IP, userId
- Sanitizes sensitive fields (password, otp, token)
- Body logging for POST/PUT/PATCH (truncated to 500 chars)
- Always active (unlike morgan)

---

## Error Handling Middleware

### Global Error Handler
**Location:** `middleware/errorHandler.js`

**Order:** Must be last in middleware chain

**Handles:**
1. Custom `AppError` instances
2. Mongoose errors (CastError, ValidationError, 11000)
3. JSON parsing errors
4. JWT errors (JsonWebTokenError, TokenExpiredError)
5. Unexpected errors (500)

**Response Format:**
```json
{
  "success": false,
  "message": "Error message",
  "code": "ERROR_CODE",
  "error": {} // Only in development
}
```

---

## Middleware Execution Order

**Correct order in `server.js` (critical for security):**

```
1. dotenv.config()               ✅ First
2. helmet                         ✅ Security headers
3. cors                           ✅ CORS policy
4. compression                    ✅ Response compression
5. cookieParser                   ✅ Parse cookies
6. express.json/urlencoded        ✅ Body parsers
7. mongoSanitize                  ✅ NoSQL injection prevention
8. xss                            ✅ XSS prevention
9. hpp                            ✅ Parameter pollution prevention
10. morgan/logger                 ✅ Logging
11. express.static                ✅ Static files
12. session                       ✅ Session management
13. flash                         ✅ Flash messages
14. csrfMiddleware                ✅ CSRF protection
15. attachUser                    ✅ User attachment
16. requestLogger                 ✅ Custom logging
17. Socket.IO JWT auth            ✅ WebSocket auth
18. Rate limiters                 ✅ Applied to routes
19. Routes                        ✅ Application routes
20. notFound (404)                ✅ Second to last
21. errorHandler                  ✅ Last
```

---

## JWT Token Authentication

### Token Flow

1. **Login** → Server generates access token (15m) + refresh token (7d)
2. **Store** → Refresh token saved to database with device info
3. **Response** → Tokens sent as HTTP-only cookies + JSON body
4. **Request** → Client sends access token in header or cookie
5. **Verify** → Middleware validates token, attaches user to req
6. **Expired** → Client uses refresh token to get new access token
7. **Refresh** → Old refresh token deleted, new pair generated (token rotation)
8. **Logout** → Refresh token deleted from database

### Token Storage

**Database Model:** `models/RefreshToken.js`

**Fields:**
- `userId` - User reference
- `tokenHash` - Bcrypt hash of token
- `deviceInfo` - User agent string
- `ipAddress` - Client IP
- `expiresAt` - Expiration date
- `lastUsedAt` - Last usage timestamp

**Indexes:**
- `{ tokenHash: 1 }` - Fast lookup
- `{ userId: 1, expiresAt: 1 }` - User sessions
- `{ expiresAt: 1 }` - Cleanup job

### Token Endpoints

**Routes:** `/api/token/*` (see `routes/token.js`)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/token/refresh` | POST | Rotate tokens |
| `/api/token/revoke` | POST | Logout current device |
| `/api/token/revoke-all` | POST | Logout all devices |
| `/api/token/sessions` | GET | List active sessions |
| `/api/token/sessions/:id` | DELETE | Revoke specific session |
| `/api/token/verify` | POST | Verify token validity |

### Hybrid Authentication

The `isAuthenticated` middleware supports both JWT and session authentication:

```javascript
// Priority 1: JWT token (header or cookie)
Authorization: Bearer <token>
req.cookies.accessToken

// Priority 2: Session fallback
req.session.userId
```

This ensures backward compatibility while enabling stateless API authentication.

---

## Security Best Practices

### ✅ Implemented

1. **Helmet** - Security headers (XSS, clickjacking, MIME sniffing)
2. **CORS** - Whitelist allowed origins, credentials support
3. **NoSQL Injection** - Sanitize MongoDB queries
4. **XSS Prevention** - Sanitize user input
5. **Parameter Pollution** - Prevent duplicate params
6. **CSRF Protection** - Token-based for non-API routes
7. **Rate Limiting** - Multiple tiers based on sensitivity
8. **JWT Tokens** - Short-lived access tokens, rotating refresh tokens
9. **Session Security** - HTTP-only cookies, secure flag in production
10. **Password Hashing** - Bcrypt with salt rounds
11. **Input Validation** - Comprehensive express-validator rules
12. **Error Handling** - No stack traces in production
13. **Logging** - Production logs with rotation, sensitive data sanitization

### 📋 Recommendations

1. **Enable CSP** - Content Security Policy in production (currently disabled)
2. **HTTPS Only** - Enforce HTTPS in production
3. **Secrets Rotation** - Rotate JWT_SECRET, SESSION_SECRET periodically
4. **IP Whitelisting** - Consider for admin routes
5. **Audit Logs** - Track admin actions and sensitive operations
6. **Two-Factor** - Implement 2FA for admin accounts
7. **Dependency Scanning** - Regular `npm audit` checks
8. **Web Application Firewall** - Consider Cloudflare or AWS WAF

---

## Environment Variables

Required environment variables for middleware configuration:

```env
# JWT
JWT_SECRET=min-32-chars-random-string
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
JWT_REFRESH_EXPIRY_DAYS=7

# Session & Cookies
SESSION_SECRET=different-from-jwt-secret
COOKIE_SECRET=different-from-session-secret

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,https://yourdomain.com

# Security
NODE_ENV=production  # Enables security features
```

---

## Testing Middleware

### Manual Testing

1. **Security Headers:**
   ```bash
   curl -I http://localhost:3000/api/health
   # Check for X-Content-Type-Options, X-Frame-Options, etc.
   ```

2. **CORS:**
   ```bash
   curl -H "Origin: http://unauthorized.com" http://localhost:3000/api
   # Should reject
   ```

3. **Rate Limiting:**
   ```bash
   for i in {1..101}; do curl http://localhost:3000/api/health; done
   # Should block after 100 requests
   ```

4. **JWT Authentication:**
   ```bash
   # Login
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password"}'
   
   # Use token
   curl http://localhost:3000/api/user/profile \
     -H "Authorization: Bearer <token>"
   ```

5. **Token Rotation:**
   ```bash
   curl -X POST http://localhost:3000/api/token/refresh \
     -H "Content-Type: application/json" \
     -d '{"refreshToken":"<token>"}'
   ```

---

## Troubleshooting

### Common Issues

1. **CORS errors:**
   - Add origin to `ALLOWED_ORIGINS` env var
   - Check credentials flag if using cookies

2. **JWT not working:**
   - Verify `JWT_SECRET` is set
   - Check token format: `Bearer <token>`
   - Verify token not expired

3. **Rate limit too restrictive:**
   - Adjust limits in `middleware/rateLimiter.js`
   - Check if IP is correctly detected

4. **Session not persisting:**
   - Verify MongoDB connection for session store
   - Check cookie settings (secure, sameSite)

5. **File upload failing:**
   - Verify Cloudinary credentials
   - Check file size < 10MB
   - Verify file type allowed

---

## Maintenance

### Regular Tasks

1. **Daily:** Cleanup expired refresh tokens (automated via scheduled job)
2. **Weekly:** Review rate limit logs for abuse patterns
3. **Monthly:** Rotate JWT_SECRET and SESSION_SECRET
4. **Quarterly:** Update security packages (`npm audit fix`)
5. **Yearly:** Review and update CORS whitelist

### Monitoring

**Key Metrics:**
- Rate limit hits (potential attacks)
- Failed JWT verifications
- Session store size
- Error handler invocations
- Log file sizes

**Log Files:**
- `logs/access.log` - All HTTP requests
- `logs/error.log` - Application errors
- Rotated daily, kept for 14 days

---

## References

- [Express.js Middleware Guide](https://expressjs.com/en/guide/using-middleware.html)
- [Helmet Security](https://helmetjs.github.io/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**Last Updated:** February 5, 2026  
**Version:** 2.0.0  
**Author:** LoopLane Development Team
