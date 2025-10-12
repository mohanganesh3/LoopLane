# Network Evidence Documentation - Group 39 LoopLane

## 📸 Screenshot Collection Instructions

This folder contains instructions for capturing network evidence of AJAX/XHR operations and async features.

---

## Required Screenshots

### 1. Authentication Screenshots

#### 1.1 Login XHR Request
**Filename:** `login-xhr-request.png`

**How to Capture:**
1. Open Chrome DevTools (F12) → Network tab
2. Navigate to http://localhost:3000/auth/login
3. Enter credentials: test@lane.com / Test@123
4. Click "Login" button
5. Find XHR request to `/auth/login` in Network tab
6. Click on the request to see details
7. Take screenshot showing:
   - Request URL
   - Method: POST
   - Headers: `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`
   - Request Payload (JSON body)
   - Response (success with redirectUrl)
   - Status: 200

**Evidence Focus:** XMLHttpRequest usage, JSON headers, no page reload

---

#### 1.2 Register XHR Request
**Filename:** `register-xhr-request.png`

**How to Capture:**
1. DevTools → Network tab
2. Navigate to http://localhost:3000/auth/register
3. Fill valid registration data
4. Submit form
5. Capture XHR request to `/auth/register`

**Show:** Request method, headers, JSON payload, response with OTP redirect

---

#### 1.3 OTP Verification XHR
**Filename:** `otp-xhr-request.png`

**How to Capture:**
1. After registration, on OTP page
2. Enter 6-digit OTP
3. Capture XHR request to `/auth/verify-otp`

**Show:** OTP in request body, success response

---

### 2. Ride Management Screenshots

#### 2.1 Ride Search AJAX
**Filename:** `ride-search-xhr.png`

**How to Capture:**
1. DevTools → Network tab
2. Navigate to http://localhost:3000/rides/search
3. Enter search criteria:
   - From: Bangalore
   - To: Mysore
   - Date: Tomorrow
   - Seats: 2
4. Click "Search"
5. Capture XHR request to `/rides/search/results?from=Bangalore&to=Mysore&...`

**Evidence Focus:** 
- XHR request with query parameters
- Partial HTML response (not full page)
- No page reload
- Dynamic result injection

---

#### 2.2 Post Ride XHR
**Filename:** `post-ride-xhr.png`

**How to Capture:**
1. Login as rider
2. Navigate to http://localhost:3000/rides/post
3. Fill complete ride form
4. DevTools → Network tab
5. Submit form
6. Capture XHR request to `/rides/post`

**Show:** 
- Method: POST
- Content-Type: application/json
- JSON body with ride details (coordinates, date, seats, price)
- Success response

---

### 3. Admin Panel Screenshots

#### 3.1 Admin Approval XHR
**Filename:** `admin-approve-xhr.png`

**How to Capture:**
1. Login as admin (admin@lane.com / Admin@123)
2. Navigate to http://localhost:3000/admin/verifications
3. Click on a pending verification
4. DevTools → Network tab
5. Click "Approve" button
6. Capture XHR request to `/admin/verifications/:userId/approve`

**Evidence Focus:**
- XMLHttpRequest
- POST method
- JSON payload
- No page reload (stays on same page)

---

#### 3.2 Admin Rejection XHR
**Filename:** `admin-reject-xhr.png`

**How to Capture:**
1. Similar to approval
2. Click "Reject" button
3. Enter rejection reason
4. Capture XHR request to `/admin/verifications/:userId/reject`

---

#### 3.3 Notification Polling XHR
**Filename:** `notification-polling-xhr.png`

**How to Capture:**
1. Login as any user
2. Stay on dashboard
3. DevTools → Network tab
4. Wait 10 seconds
5. Observe periodic XHR request to `/chat/api/unread-count`
6. Capture showing:
   - Multiple requests (polling)
   - 10-second intervals
   - GET method
   - Unread count response

**Evidence Focus:** Periodic AJAX polling without user action

---

### 4. Real-time Features Screenshots

#### 4.1 Socket.IO Connection
**Filename:** `socket-io-connection.png`

**How to Capture:**
1. Login as user
2. DevTools → Network tab → WS (WebSocket) filter
3. Look for Socket.IO connection
4. Capture showing:
   - WebSocket connection established
   - ws://localhost:3000/socket.io/...
   - Connection status: 101 Switching Protocols

---

#### 4.2 Socket.IO Messages (Tracking)
**Filename:** `socket-io-tracking.png`

**How to Capture:**
1. Driver and passenger in active ride
2. Passenger opens live tracking
3. DevTools → Network → WS tab
4. Expand Socket.IO connection
5. Show WebSocket frames:
   - `driver:location` emit from driver
   - `tracking:update` received by passenger
   - Real-time lat/lng data

**Evidence Focus:** WebSocket messages, real-time data exchange

---

#### 4.3 SOS Alert Network
**Filename:** `sos-alert.png`

**How to Capture:**
1. User clicks SOS button
2. DevTools → Network tab
3. Capture XHR request to `/sos/trigger`
4. Show:
   - Location coordinates in payload
   - Emergency type
   - Success response with emergency ID

---

### 5. Form Validation Screenshots

#### 5.1 Client-side Validation
**Filename:** `validation-client-side.png`

**How to Capture:**
1. Registration form
2. Enter invalid data (e.g., weak password)
3. Try to submit
4. Capture error messages shown without network request

---

#### 5.2 Server-side Validation
**Filename:** `validation-server-side.png`

**How to Capture:**
1. Bypass client validation using DevTools console
2. Submit invalid data
3. Capture XHR request showing:
   - 400 status code
   - Error response from server
   - Validation error messages in JSON

---

### 6. Browser DevTools Screenshots

#### 6.1 Console Logs
**Filename:** `console-logs.png`

**How to Capture:**
1. DevTools → Console tab
2. Show logs for:
   - Socket.IO connection
   - AJAX request logs
   - Success/error messages

---

#### 6.2 Application Tab (Session/LocalStorage)
**Filename:** `storage-session.png`

**How to Capture:**
1. DevTools → Application tab
2. Show session storage
3. User session data

---

### 7. Response Headers Screenshot

#### 7.1 XHR Headers Detail
**Filename:** `xhr-headers-detail.png`

**How to Capture:**
1. Any XHR request in Network tab
2. Click on request
3. Go to Headers tab
4. Capture showing:
   - General: Request URL, Method, Status Code
   - Response Headers: Content-Type, etc.
   - Request Headers: Content-Type, X-Requested-With
   - Request Payload: JSON data

---

## Screenshot Naming Convention

Use this format for all screenshots:
```
{feature}-{action}-{type}.png

Examples:
- login-submit-xhr.png
- register-validation-error.png
- search-results-ajax.png
- admin-approve-xhr.png
- tracking-socketio-websocket.png
```

---

## Required Tools

1. **Browser:** Chrome (recommended) or Firefox
2. **DevTools Shortcuts:**
   - Open DevTools: F12 or Cmd+Option+I (Mac)
   - Network tab: F12 → Network
   - Console: F12 → Console
   - WebSocket: Network → WS filter

---

## Screenshot Specifications

- **Format:** PNG (lossless)
- **Resolution:** At least 1920x1080
- **Quality:** High (no compression)
- **Focus:** Clear, readable text
- **Annotations:** Use arrows/highlights if needed

---

## Annotation Guidelines

Use tools like Snagit, Greenshot, or macOS Screenshot to:
- ✅ Highlight important headers
- ✅ Circle XHR request in list
- ✅ Arrow pointing to "XHR" type
- ✅ Box around JSON payload
- ✅ Underline key values

---

## Verification Checklist

Before submission, ensure you have:

✅ Login XHR screenshot  
✅ Register XHR screenshot  
✅ OTP XHR screenshot  
✅ Ride search AJAX screenshot  
✅ Post ride XHR screenshot  
✅ Admin approve XHR screenshot  
✅ Admin reject XHR screenshot  
✅ Notification polling screenshot  
✅ Socket.IO WebSocket screenshot  
✅ Socket.IO tracking messages screenshot  
✅ SOS alert XHR screenshot  
✅ Validation error screenshots (2)  
✅ Headers detail screenshot  

**Total Required:** Minimum 13 screenshots

---

## Alternative: Screen Recording

If taking individual screenshots is tedious, you can:
1. Record a screen video showing all network operations
2. Extract key frames as screenshots
3. Tools: OBS Studio, QuickTime, Windows Game Bar

---

## Example Screenshot Annotations

### Good Example:
```
[Screenshot showing:]
- Red arrow → "XHR" in Type column
- Yellow highlight → Request Headers section
- Green box → JSON payload
- Blue underline → Status: 200 OK
```

### What to Avoid:
```
- Blurry text
- Cut-off request details
- No indication of what to look at
- Low resolution
```

---

## Submission Format

Organize in `network_evidence/` folder:
```
network_evidence/
├── README.md (this file)
├── 1-authentication/
│   ├── login-xhr-request.png
│   ├── register-xhr-request.png
│   └── otp-xhr-request.png
├── 2-ride-management/
│   ├── ride-search-xhr.png
│   └── post-ride-xhr.png
├── 3-admin-panel/
│   ├── admin-approve-xhr.png
│   ├── admin-reject-xhr.png
│   └── notification-polling-xhr.png
├── 4-realtime/
│   ├── socket-io-connection.png
│   ├── socket-io-tracking.png
│   └── sos-alert.png
└── 5-validation/
    ├── validation-client-side.png
    └── validation-server-side.png
```

---

## Tips for Better Screenshots

1. **Clear the Network tab** before each action (trash icon)
2. **Filter by XHR** to see only AJAX requests
3. **Preserve log** checkbox enabled
4. **Disable cache** for accurate testing
5. **Throttling:** Set to "No throttling" for speed
6. **Dark mode:** Use light theme for better readability in screenshots

---

## Common Issues & Solutions

### Issue: XHR not showing in Network tab
**Solution:** 
- Ensure DevTools open BEFORE form submission
- Check "Preserve log" checkbox
- Filter by XHR type

### Issue: Request details not visible
**Solution:**
- Click on the specific request in list
- Expand Headers, Payload, Preview tabs

### Issue: Screenshot too large
**Solution:**
- Crop to relevant area
- Focus on Network tab only
- Remove unnecessary browser chrome

---

## Contact for Questions

**SPOC:** Mohan Ganesh (S20230010092)  
**Email:** mohanganesh165577@gmail.com

If you need help capturing any specific screenshot, reach out to the team member responsible for that feature (see task_assignment.md).

---

**Document Prepared:** October 13, 2025  
**Prepared By:** Group 39 - LoopLane Team  
**Submission:** Mid-Review Assessment
