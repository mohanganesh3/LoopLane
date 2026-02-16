# Code Citations

## License: MIT
https://github.com/swimmadude66/YTRadio/blob/9cdeec76687caf692a94237d3cde8560195a8599/src/server/app.ts

```
## **Morgan Middleware - Detailed Explanation**

### **📍 Where It's Used**

**Locations:** [server.js](server.js#L132-L141)

```javascript
// Line 19: Import
const morgan = require('morgan');

// Lines 131-141: Environment-specific logging
if (process.env.NODE_ENV === 'production') {
    // Production: log to rotating files
    app.use(morgan('combined', { 
        stream: accessLogStream,
        skip: shouldSkipLogging
    }));
} else {
    // Development: log to console
    app.use(morgan('dev', {
        skip: shouldSkipLogging
    }));
}
```

**Logger utilities:** [utils/logger.js](utils/logger.js#L1-L65)

---

### **🎯 Purpose**

Morgan is an **HTTP request logger** middleware that automatically logs:
- **Request details:** HTTP method, URL, status code
- **Response metadata:** Response time, content length
- **Client info:** IP address, user agent
- **Timestamps:** When requests occurred

**Benefits:**
- **Debugging:** Track down issues by reviewing request logs
- **Monitoring:** Identify slow endpoints and performance bottlenecks
- **Security:** Detect suspicious access patterns
- **Compliance:** Maintain audit trails for regulated systems

---

### **⚙️ Configuration**

### **Two Environments, Two Formats:**

#### **1. Production Environment** (Lines 132-135)

```javascript
app.use(morgan('combined', { 
    stream: accessLogStream,        // Write to rotating file
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'combined'` (Apache Combined Log Format)
```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Example Output:**
```
192.168.1.100 - - [11/Feb/2026:10:30:45 +0000] "GET /api/rides/active HTTP/1.1" 200 3456 "https://yourapp.com/dashboard" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
192.168.1.101 - - [11/Feb/2026:10:30:46 +0000] "POST /api/bookings HTTP/1.1" 201 892 "https://yourapp.com/book-ride" "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
192.168.1.102 - - [11/Feb/2026:10:30:47 +0000] "GET /api/chat/messages/123 HTTP/1.1" 200 15234 "-" "LoopLane-Mobile/1.2.0"
```

**Why `combined` for production:**
- ✅ **Detailed:** Includes referrer and user-agent for debugging
- ✅ **Standard:** Compatible with log analysis tools (AWStats, GoAccess, ELK)
- ✅ **Audit-ready:** Comprehensive information for security reviews

---

#### **2. Development Environment** (Lines 138-141)

```javascript
app.use(morgan('dev', {
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'dev'` (Colored, concise output)
```
:method :url :status :response-time ms - :res[content-length]
```

**Example Output (with color coding):**
```
GET /api/rides/active 200 45.234 ms - 3456
POST /api/bookings 201 123.567 ms - 892
GET /api/chat/messages/123 200 234.890 ms - 15234
DELETE /api/bookings/456 404 12.345 ms - 156
```

**Color Coding:**
- 🟢 **Green:** 2xx Success (200, 201, 204)
- 🔵 **Cyan:** 3xx Redirect (301, 302, 304)
- 🟡 **Yellow:** 4xx Client Error (400, 401, 404)
- 🔴 **Red:** 5xx Server Error (500, 502, 503)

**Why `dev` for development:**
- ✅ **Readable:** Clean, colored output for quick visual scanning
- ✅ **Concise:** Only essential info (no referrer/user-agent clutter)
- ✅ **Fast:** Easy to spot slow requests and errors at a glance

---

### **🔄 Log Stream Configuration** ([utils/logger.js](utils/logger.js#L19-L26))

#### **Production: Rotating File Stream**

```javascript
const rfs = require('rotating-file-stream');

// Create rotating write stream for access logs
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',      // Rotate daily (creates new file each day)
    maxFiles: 14,        // Keep 14 days of logs (auto-delete older)
    compress: 'gzip',    // Compress rotated files (.gz to save space)
    path: logsDir        // Store in /logs directory
});
```

**File Structure:**
```
logs/
├── access.log             ← Current day's logs (active)
├── access.log.1.gz        ← Yesterday (compressed)
├── access.log.2.gz        ← 2 days ago
├── access.log.3.gz        ← 3 days ago
...
└── access.log.14.gz       ← 14 days ago (oldest kept)
```

**Automatic Behavior:**
- **Daily rotation:** At midnight, `access.log` → `access.log.1.gz`, new `access.log` created
- **Compression:** Saves ~90% disk space (100MB → 10MB)
- **Auto-cleanup:** Files older than 14 days automatically deleted
- **Zero downtime:** Rotation happens seamlessly while server runs

**Disk Usage Example:**
```
Daily average: 50 MB uncompressed
After compression: 5 MB × 14 days = 70 MB total
Without rotation: 50 MB × 30 days = 1.5 GB
Savings: 95%+ disk space
```

---

### **🚫 Skip Logging Function** ([utils/logger.js](utils/logger.js#L54-L59))

```javascript
const skipPaths = ['/health', '/favicon.ico'];

const shouldSkipLogging = (req) => {
    return skipPaths.some(path => req.url.startsWith(path));
};
```

**Purpose:** Exclude noisy, low-value requests from logs

**Skipped Paths:**
1. **`/health`** - Health check endpoint (hits every 10 seconds by monitoring tools)
2. **`/favicon.ico`** - Browser automatically requests this (not an API call)

**Example Impact:**
```
Without skip:
- 8,640 health checks/day (every 10s)
- ~500 favicon requests/day
- Total: 9,140 useless log entries/day

With skip:
- Only real API requests logged
- Cleaner logs, easier to find issues
```

---

### **📊 Log Format Comparison**

| Format | Use Case | Output Style | Info Included |
|--------|----------|--------------|---------------|
| **combined** | Production | Standard Apache format | IP, timestamp, method, URL, status, size, referrer, user-agent |
| **dev** | Development | Colored, concise | Method, URL, status, response time, size |
| **common** | Basic production | Apache Common Log | Like combined but no referrer/user-agent |
| **short** | Minimal logging | Brief format | IP, method, URL, status, size, response time |
| **tiny** | Ultra-minimal | One-liner | Method, URL, status, size, response time |

---

### **🔍 Real-World Examples from Your App**

#### **Production Log Entry (combined format):**

```
192.168.1.50 - - [11/Feb/2026:14:23:15 +0000] "POST /api/bookings HTTP/1.1" 201 1234 "https://looplane.onrender.com/book-ride" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Breaking it down:**
- `192.168.1.50` - Client IP address
- `-` - Remote user (not used)
- `-` - Authenticated user (could show JWT userId if logged)
- `[11/Feb/2026:14:23:15 +0000]` - Timestamp (Common Log Format)
- `"POST /api/bookings HTTP/1.1"` - Request method, path, protocol
- `201` - HTTP status (Created)
- `1234` - Response size in bytes
- `"https://looplane.onrender.com/book-ride"` - Referrer (previous page)
- `"Mozilla/5.0..."` - User agent (browser/device info)

---

#### **Development Console Output (dev format):**

```
POST /api/auth/login 200 156.234 ms - 456
GET /api/rides/active 200 45.123 ms - 3456
POST /api/bookings 201 234.567 ms - 1234
GET /api/users/profile 401 12.345 ms - 89
DELETE /api/bookings/123 404 8.901 ms - 67
GET /api/sos/emergencies 500 345.678 ms - 234
```

**Color coding in terminal:**
- Line 1: 🟢 Green (200 OK)
- Line 2: 🟢 Green (200 OK)
- Line 3: 🟢 Green (201 Created)
- Line 4: 🟡 Yellow (401 Unauthorized - auth issue)
- Line 5: 🟡 Yellow (404 Not Found - client error)
- Line 6: 🔴 Red (500 Internal Server Error - needs attention!)

---

### **🎛️ Middleware Stack Order**

**Current Position:** Lines 132-141 (after compression, before body parsers)

```javascript
app.use(helmet());              // Security headers
app.use(cors());                // Cross-origin
app.use(compression());         // Compress responses
app.use(cookieParser());        // Parse cookies
app.use(morgan(...));           // ← Log HTTP requests (early)
app.use(express.json());        // Parse JSON body
app.use(express.urlencoded());  // Parse URL-encoded body
app.use(mongoSanitize());       // NoSQL injection protection
app.use(xss());                 // XSS protection
app.use(hpp());                 // HPP protection
// ... routes ...
```

**Why this order matters:**
- **Before body parsers:** Logs raw request immediately (even if body parsing fails)
- **After security:** Lets helmet/CORS set headers first
- **Before routes:** Captures all requests including 404s
- Position is optimal ✅

---

### **💻 Custom Morgan Tokens** ([utils/logger.js](utils/logger.js#L39-L49))

```javascript
/**
 * Custom morgan token for response time in milliseconds
 */
const morganTokens = {
    'response-time-ms': (req, res) => {
        if (!req._startAt || !res._startAt) {
            return '-';
        }
        const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                   (res._startAt[1] - req._startAt[1]) * 1e-6;
        return ms.toFixed(3);
    }
};
```

**Purpose:** Define custom data to include in logs

**Usage (if you wanted to use it):**
```javascript
// Register custom token
morgan.token('response-time-ms', morganTokens['response-time-ms']);

// Use in custom format
app.use(morgan(':method :url :status :response-time-ms ms'));
```

**Output:**
```
GET /api/rides 200 45.234 ms
```

---

### **📈 Performance Impact**

#### **Logging Overhead:**
- **Console logging (dev):** ~0.5-1ms per request
- **File logging (production):** ~1-2ms per request
- **Rotating file stream:** Minimal (async writes)

#### **Disk I/O:**
- **Buffered writes:** Morgan doesn't block response
- **Async operations:** Logs written after response sent
- **Impact:** Negligible (<1% of response time)

---

### **🔍 Log Analysis Examples**

#### **Finding Slow Endpoints (Production):**
```bash
# Extract slow requests (>500ms)
cat logs/access.log | awk '{print $7, $9, $10}' | grep " 500 " | sort -k3 -rn | head -10
```

**Output:**
```
/api/chat/messages/123 200 1234ms
/api/rides/search 200 892ms
/api/reports/generate 200 645ms
```

#### **Error Rate Analysis:**
```bash
# Count 5xx errors
grep " 5[0-9][0-9] " logs/access.log | wc -l

# Find most common errors
grep " 5[0-9][0-9] " logs/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

**Output:**
```
45 /api/tracking/update
23 /api/sos/emergency
12 /api/bookings
```

#### **Traffic Patterns:**
```bash
# Requests per hour
awk '{print $4}' logs/access.log | cut -d: -f2 | sort | uniq -c
```

**Output:**
```
123 08 (8am)
456 09 (9am peak)
234 10 (10am)
```

---

### **🛠️ Advanced Configuration Options**

#### **Available Morgan Formats:**

```javascript
// If you wanted to customize further:

// 1. Custom format string
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 2. Custom function format
app.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), '
```


## License: MIT
https://github.com/swimmadude66/YTRadio/blob/9cdeec76687caf692a94237d3cde8560195a8599/src/server/app.ts

```
## **Morgan Middleware - Detailed Explanation**

### **📍 Where It's Used**

**Locations:** [server.js](server.js#L132-L141)

```javascript
// Line 19: Import
const morgan = require('morgan');

// Lines 131-141: Environment-specific logging
if (process.env.NODE_ENV === 'production') {
    // Production: log to rotating files
    app.use(morgan('combined', { 
        stream: accessLogStream,
        skip: shouldSkipLogging
    }));
} else {
    // Development: log to console
    app.use(morgan('dev', {
        skip: shouldSkipLogging
    }));
}
```

**Logger utilities:** [utils/logger.js](utils/logger.js#L1-L65)

---

### **🎯 Purpose**

Morgan is an **HTTP request logger** middleware that automatically logs:
- **Request details:** HTTP method, URL, status code
- **Response metadata:** Response time, content length
- **Client info:** IP address, user agent
- **Timestamps:** When requests occurred

**Benefits:**
- **Debugging:** Track down issues by reviewing request logs
- **Monitoring:** Identify slow endpoints and performance bottlenecks
- **Security:** Detect suspicious access patterns
- **Compliance:** Maintain audit trails for regulated systems

---

### **⚙️ Configuration**

### **Two Environments, Two Formats:**

#### **1. Production Environment** (Lines 132-135)

```javascript
app.use(morgan('combined', { 
    stream: accessLogStream,        // Write to rotating file
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'combined'` (Apache Combined Log Format)
```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Example Output:**
```
192.168.1.100 - - [11/Feb/2026:10:30:45 +0000] "GET /api/rides/active HTTP/1.1" 200 3456 "https://yourapp.com/dashboard" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
192.168.1.101 - - [11/Feb/2026:10:30:46 +0000] "POST /api/bookings HTTP/1.1" 201 892 "https://yourapp.com/book-ride" "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
192.168.1.102 - - [11/Feb/2026:10:30:47 +0000] "GET /api/chat/messages/123 HTTP/1.1" 200 15234 "-" "LoopLane-Mobile/1.2.0"
```

**Why `combined` for production:**
- ✅ **Detailed:** Includes referrer and user-agent for debugging
- ✅ **Standard:** Compatible with log analysis tools (AWStats, GoAccess, ELK)
- ✅ **Audit-ready:** Comprehensive information for security reviews

---

#### **2. Development Environment** (Lines 138-141)

```javascript
app.use(morgan('dev', {
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'dev'` (Colored, concise output)
```
:method :url :status :response-time ms - :res[content-length]
```

**Example Output (with color coding):**
```
GET /api/rides/active 200 45.234 ms - 3456
POST /api/bookings 201 123.567 ms - 892
GET /api/chat/messages/123 200 234.890 ms - 15234
DELETE /api/bookings/456 404 12.345 ms - 156
```

**Color Coding:**
- 🟢 **Green:** 2xx Success (200, 201, 204)
- 🔵 **Cyan:** 3xx Redirect (301, 302, 304)
- 🟡 **Yellow:** 4xx Client Error (400, 401, 404)
- 🔴 **Red:** 5xx Server Error (500, 502, 503)

**Why `dev` for development:**
- ✅ **Readable:** Clean, colored output for quick visual scanning
- ✅ **Concise:** Only essential info (no referrer/user-agent clutter)
- ✅ **Fast:** Easy to spot slow requests and errors at a glance

---

### **🔄 Log Stream Configuration** ([utils/logger.js](utils/logger.js#L19-L26))

#### **Production: Rotating File Stream**

```javascript
const rfs = require('rotating-file-stream');

// Create rotating write stream for access logs
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',      // Rotate daily (creates new file each day)
    maxFiles: 14,        // Keep 14 days of logs (auto-delete older)
    compress: 'gzip',    // Compress rotated files (.gz to save space)
    path: logsDir        // Store in /logs directory
});
```

**File Structure:**
```
logs/
├── access.log             ← Current day's logs (active)
├── access.log.1.gz        ← Yesterday (compressed)
├── access.log.2.gz        ← 2 days ago
├── access.log.3.gz        ← 3 days ago
...
└── access.log.14.gz       ← 14 days ago (oldest kept)
```

**Automatic Behavior:**
- **Daily rotation:** At midnight, `access.log` → `access.log.1.gz`, new `access.log` created
- **Compression:** Saves ~90% disk space (100MB → 10MB)
- **Auto-cleanup:** Files older than 14 days automatically deleted
- **Zero downtime:** Rotation happens seamlessly while server runs

**Disk Usage Example:**
```
Daily average: 50 MB uncompressed
After compression: 5 MB × 14 days = 70 MB total
Without rotation: 50 MB × 30 days = 1.5 GB
Savings: 95%+ disk space
```

---

### **🚫 Skip Logging Function** ([utils/logger.js](utils/logger.js#L54-L59))

```javascript
const skipPaths = ['/health', '/favicon.ico'];

const shouldSkipLogging = (req) => {
    return skipPaths.some(path => req.url.startsWith(path));
};
```

**Purpose:** Exclude noisy, low-value requests from logs

**Skipped Paths:**
1. **`/health`** - Health check endpoint (hits every 10 seconds by monitoring tools)
2. **`/favicon.ico`** - Browser automatically requests this (not an API call)

**Example Impact:**
```
Without skip:
- 8,640 health checks/day (every 10s)
- ~500 favicon requests/day
- Total: 9,140 useless log entries/day

With skip:
- Only real API requests logged
- Cleaner logs, easier to find issues
```

---

### **📊 Log Format Comparison**

| Format | Use Case | Output Style | Info Included |
|--------|----------|--------------|---------------|
| **combined** | Production | Standard Apache format | IP, timestamp, method, URL, status, size, referrer, user-agent |
| **dev** | Development | Colored, concise | Method, URL, status, response time, size |
| **common** | Basic production | Apache Common Log | Like combined but no referrer/user-agent |
| **short** | Minimal logging | Brief format | IP, method, URL, status, size, response time |
| **tiny** | Ultra-minimal | One-liner | Method, URL, status, size, response time |

---

### **🔍 Real-World Examples from Your App**

#### **Production Log Entry (combined format):**

```
192.168.1.50 - - [11/Feb/2026:14:23:15 +0000] "POST /api/bookings HTTP/1.1" 201 1234 "https://looplane.onrender.com/book-ride" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Breaking it down:**
- `192.168.1.50` - Client IP address
- `-` - Remote user (not used)
- `-` - Authenticated user (could show JWT userId if logged)
- `[11/Feb/2026:14:23:15 +0000]` - Timestamp (Common Log Format)
- `"POST /api/bookings HTTP/1.1"` - Request method, path, protocol
- `201` - HTTP status (Created)
- `1234` - Response size in bytes
- `"https://looplane.onrender.com/book-ride"` - Referrer (previous page)
- `"Mozilla/5.0..."` - User agent (browser/device info)

---

#### **Development Console Output (dev format):**

```
POST /api/auth/login 200 156.234 ms - 456
GET /api/rides/active 200 45.123 ms - 3456
POST /api/bookings 201 234.567 ms - 1234
GET /api/users/profile 401 12.345 ms - 89
DELETE /api/bookings/123 404 8.901 ms - 67
GET /api/sos/emergencies 500 345.678 ms - 234
```

**Color coding in terminal:**
- Line 1: 🟢 Green (200 OK)
- Line 2: 🟢 Green (200 OK)
- Line 3: 🟢 Green (201 Created)
- Line 4: 🟡 Yellow (401 Unauthorized - auth issue)
- Line 5: 🟡 Yellow (404 Not Found - client error)
- Line 6: 🔴 Red (500 Internal Server Error - needs attention!)

---

### **🎛️ Middleware Stack Order**

**Current Position:** Lines 132-141 (after compression, before body parsers)

```javascript
app.use(helmet());              // Security headers
app.use(cors());                // Cross-origin
app.use(compression());         // Compress responses
app.use(cookieParser());        // Parse cookies
app.use(morgan(...));           // ← Log HTTP requests (early)
app.use(express.json());        // Parse JSON body
app.use(express.urlencoded());  // Parse URL-encoded body
app.use(mongoSanitize());       // NoSQL injection protection
app.use(xss());                 // XSS protection
app.use(hpp());                 // HPP protection
// ... routes ...
```

**Why this order matters:**
- **Before body parsers:** Logs raw request immediately (even if body parsing fails)
- **After security:** Lets helmet/CORS set headers first
- **Before routes:** Captures all requests including 404s
- Position is optimal ✅

---

### **💻 Custom Morgan Tokens** ([utils/logger.js](utils/logger.js#L39-L49))

```javascript
/**
 * Custom morgan token for response time in milliseconds
 */
const morganTokens = {
    'response-time-ms': (req, res) => {
        if (!req._startAt || !res._startAt) {
            return '-';
        }
        const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                   (res._startAt[1] - req._startAt[1]) * 1e-6;
        return ms.toFixed(3);
    }
};
```

**Purpose:** Define custom data to include in logs

**Usage (if you wanted to use it):**
```javascript
// Register custom token
morgan.token('response-time-ms', morganTokens['response-time-ms']);

// Use in custom format
app.use(morgan(':method :url :status :response-time-ms ms'));
```

**Output:**
```
GET /api/rides 200 45.234 ms
```

---

### **📈 Performance Impact**

#### **Logging Overhead:**
- **Console logging (dev):** ~0.5-1ms per request
- **File logging (production):** ~1-2ms per request
- **Rotating file stream:** Minimal (async writes)

#### **Disk I/O:**
- **Buffered writes:** Morgan doesn't block response
- **Async operations:** Logs written after response sent
- **Impact:** Negligible (<1% of response time)

---

### **🔍 Log Analysis Examples**

#### **Finding Slow Endpoints (Production):**
```bash
# Extract slow requests (>500ms)
cat logs/access.log | awk '{print $7, $9, $10}' | grep " 500 " | sort -k3 -rn | head -10
```

**Output:**
```
/api/chat/messages/123 200 1234ms
/api/rides/search 200 892ms
/api/reports/generate 200 645ms
```

#### **Error Rate Analysis:**
```bash
# Count 5xx errors
grep " 5[0-9][0-9] " logs/access.log | wc -l

# Find most common errors
grep " 5[0-9][0-9] " logs/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

**Output:**
```
45 /api/tracking/update
23 /api/sos/emergency
12 /api/bookings
```

#### **Traffic Patterns:**
```bash
# Requests per hour
awk '{print $4}' logs/access.log | cut -d: -f2 | sort | uniq -c
```

**Output:**
```
123 08 (8am)
456 09 (9am peak)
234 10 (10am)
```

---

### **🛠️ Advanced Configuration Options**

#### **Available Morgan Formats:**

```javascript
// If you wanted to customize further:

// 1. Custom format string
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 2. Custom function format
app.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), '
```


## License: MIT
https://github.com/swimmadude66/YTRadio/blob/9cdeec76687caf692a94237d3cde8560195a8599/src/server/app.ts

```
## **Morgan Middleware - Detailed Explanation**

### **📍 Where It's Used**

**Locations:** [server.js](server.js#L132-L141)

```javascript
// Line 19: Import
const morgan = require('morgan');

// Lines 131-141: Environment-specific logging
if (process.env.NODE_ENV === 'production') {
    // Production: log to rotating files
    app.use(morgan('combined', { 
        stream: accessLogStream,
        skip: shouldSkipLogging
    }));
} else {
    // Development: log to console
    app.use(morgan('dev', {
        skip: shouldSkipLogging
    }));
}
```

**Logger utilities:** [utils/logger.js](utils/logger.js#L1-L65)

---

### **🎯 Purpose**

Morgan is an **HTTP request logger** middleware that automatically logs:
- **Request details:** HTTP method, URL, status code
- **Response metadata:** Response time, content length
- **Client info:** IP address, user agent
- **Timestamps:** When requests occurred

**Benefits:**
- **Debugging:** Track down issues by reviewing request logs
- **Monitoring:** Identify slow endpoints and performance bottlenecks
- **Security:** Detect suspicious access patterns
- **Compliance:** Maintain audit trails for regulated systems

---

### **⚙️ Configuration**

### **Two Environments, Two Formats:**

#### **1. Production Environment** (Lines 132-135)

```javascript
app.use(morgan('combined', { 
    stream: accessLogStream,        // Write to rotating file
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'combined'` (Apache Combined Log Format)
```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Example Output:**
```
192.168.1.100 - - [11/Feb/2026:10:30:45 +0000] "GET /api/rides/active HTTP/1.1" 200 3456 "https://yourapp.com/dashboard" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
192.168.1.101 - - [11/Feb/2026:10:30:46 +0000] "POST /api/bookings HTTP/1.1" 201 892 "https://yourapp.com/book-ride" "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
192.168.1.102 - - [11/Feb/2026:10:30:47 +0000] "GET /api/chat/messages/123 HTTP/1.1" 200 15234 "-" "LoopLane-Mobile/1.2.0"
```

**Why `combined` for production:**
- ✅ **Detailed:** Includes referrer and user-agent for debugging
- ✅ **Standard:** Compatible with log analysis tools (AWStats, GoAccess, ELK)
- ✅ **Audit-ready:** Comprehensive information for security reviews

---

#### **2. Development Environment** (Lines 138-141)

```javascript
app.use(morgan('dev', {
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'dev'` (Colored, concise output)
```
:method :url :status :response-time ms - :res[content-length]
```

**Example Output (with color coding):**
```
GET /api/rides/active 200 45.234 ms - 3456
POST /api/bookings 201 123.567 ms - 892
GET /api/chat/messages/123 200 234.890 ms - 15234
DELETE /api/bookings/456 404 12.345 ms - 156
```

**Color Coding:**
- 🟢 **Green:** 2xx Success (200, 201, 204)
- 🔵 **Cyan:** 3xx Redirect (301, 302, 304)
- 🟡 **Yellow:** 4xx Client Error (400, 401, 404)
- 🔴 **Red:** 5xx Server Error (500, 502, 503)

**Why `dev` for development:**
- ✅ **Readable:** Clean, colored output for quick visual scanning
- ✅ **Concise:** Only essential info (no referrer/user-agent clutter)
- ✅ **Fast:** Easy to spot slow requests and errors at a glance

---

### **🔄 Log Stream Configuration** ([utils/logger.js](utils/logger.js#L19-L26))

#### **Production: Rotating File Stream**

```javascript
const rfs = require('rotating-file-stream');

// Create rotating write stream for access logs
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',      // Rotate daily (creates new file each day)
    maxFiles: 14,        // Keep 14 days of logs (auto-delete older)
    compress: 'gzip',    // Compress rotated files (.gz to save space)
    path: logsDir        // Store in /logs directory
});
```

**File Structure:**
```
logs/
├── access.log             ← Current day's logs (active)
├── access.log.1.gz        ← Yesterday (compressed)
├── access.log.2.gz        ← 2 days ago
├── access.log.3.gz        ← 3 days ago
...
└── access.log.14.gz       ← 14 days ago (oldest kept)
```

**Automatic Behavior:**
- **Daily rotation:** At midnight, `access.log` → `access.log.1.gz`, new `access.log` created
- **Compression:** Saves ~90% disk space (100MB → 10MB)
- **Auto-cleanup:** Files older than 14 days automatically deleted
- **Zero downtime:** Rotation happens seamlessly while server runs

**Disk Usage Example:**
```
Daily average: 50 MB uncompressed
After compression: 5 MB × 14 days = 70 MB total
Without rotation: 50 MB × 30 days = 1.5 GB
Savings: 95%+ disk space
```

---

### **🚫 Skip Logging Function** ([utils/logger.js](utils/logger.js#L54-L59))

```javascript
const skipPaths = ['/health', '/favicon.ico'];

const shouldSkipLogging = (req) => {
    return skipPaths.some(path => req.url.startsWith(path));
};
```

**Purpose:** Exclude noisy, low-value requests from logs

**Skipped Paths:**
1. **`/health`** - Health check endpoint (hits every 10 seconds by monitoring tools)
2. **`/favicon.ico`** - Browser automatically requests this (not an API call)

**Example Impact:**
```
Without skip:
- 8,640 health checks/day (every 10s)
- ~500 favicon requests/day
- Total: 9,140 useless log entries/day

With skip:
- Only real API requests logged
- Cleaner logs, easier to find issues
```

---

### **📊 Log Format Comparison**

| Format | Use Case | Output Style | Info Included |
|--------|----------|--------------|---------------|
| **combined** | Production | Standard Apache format | IP, timestamp, method, URL, status, size, referrer, user-agent |
| **dev** | Development | Colored, concise | Method, URL, status, response time, size |
| **common** | Basic production | Apache Common Log | Like combined but no referrer/user-agent |
| **short** | Minimal logging | Brief format | IP, method, URL, status, size, response time |
| **tiny** | Ultra-minimal | One-liner | Method, URL, status, size, response time |

---

### **🔍 Real-World Examples from Your App**

#### **Production Log Entry (combined format):**

```
192.168.1.50 - - [11/Feb/2026:14:23:15 +0000] "POST /api/bookings HTTP/1.1" 201 1234 "https://looplane.onrender.com/book-ride" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Breaking it down:**
- `192.168.1.50` - Client IP address
- `-` - Remote user (not used)
- `-` - Authenticated user (could show JWT userId if logged)
- `[11/Feb/2026:14:23:15 +0000]` - Timestamp (Common Log Format)
- `"POST /api/bookings HTTP/1.1"` - Request method, path, protocol
- `201` - HTTP status (Created)
- `1234` - Response size in bytes
- `"https://looplane.onrender.com/book-ride"` - Referrer (previous page)
- `"Mozilla/5.0..."` - User agent (browser/device info)

---

#### **Development Console Output (dev format):**

```
POST /api/auth/login 200 156.234 ms - 456
GET /api/rides/active 200 45.123 ms - 3456
POST /api/bookings 201 234.567 ms - 1234
GET /api/users/profile 401 12.345 ms - 89
DELETE /api/bookings/123 404 8.901 ms - 67
GET /api/sos/emergencies 500 345.678 ms - 234
```

**Color coding in terminal:**
- Line 1: 🟢 Green (200 OK)
- Line 2: 🟢 Green (200 OK)
- Line 3: 🟢 Green (201 Created)
- Line 4: 🟡 Yellow (401 Unauthorized - auth issue)
- Line 5: 🟡 Yellow (404 Not Found - client error)
- Line 6: 🔴 Red (500 Internal Server Error - needs attention!)

---

### **🎛️ Middleware Stack Order**

**Current Position:** Lines 132-141 (after compression, before body parsers)

```javascript
app.use(helmet());              // Security headers
app.use(cors());                // Cross-origin
app.use(compression());         // Compress responses
app.use(cookieParser());        // Parse cookies
app.use(morgan(...));           // ← Log HTTP requests (early)
app.use(express.json());        // Parse JSON body
app.use(express.urlencoded());  // Parse URL-encoded body
app.use(mongoSanitize());       // NoSQL injection protection
app.use(xss());                 // XSS protection
app.use(hpp());                 // HPP protection
// ... routes ...
```

**Why this order matters:**
- **Before body parsers:** Logs raw request immediately (even if body parsing fails)
- **After security:** Lets helmet/CORS set headers first
- **Before routes:** Captures all requests including 404s
- Position is optimal ✅

---

### **💻 Custom Morgan Tokens** ([utils/logger.js](utils/logger.js#L39-L49))

```javascript
/**
 * Custom morgan token for response time in milliseconds
 */
const morganTokens = {
    'response-time-ms': (req, res) => {
        if (!req._startAt || !res._startAt) {
            return '-';
        }
        const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                   (res._startAt[1] - req._startAt[1]) * 1e-6;
        return ms.toFixed(3);
    }
};
```

**Purpose:** Define custom data to include in logs

**Usage (if you wanted to use it):**
```javascript
// Register custom token
morgan.token('response-time-ms', morganTokens['response-time-ms']);

// Use in custom format
app.use(morgan(':method :url :status :response-time-ms ms'));
```

**Output:**
```
GET /api/rides 200 45.234 ms
```

---

### **📈 Performance Impact**

#### **Logging Overhead:**
- **Console logging (dev):** ~0.5-1ms per request
- **File logging (production):** ~1-2ms per request
- **Rotating file stream:** Minimal (async writes)

#### **Disk I/O:**
- **Buffered writes:** Morgan doesn't block response
- **Async operations:** Logs written after response sent
- **Impact:** Negligible (<1% of response time)

---

### **🔍 Log Analysis Examples**

#### **Finding Slow Endpoints (Production):**
```bash
# Extract slow requests (>500ms)
cat logs/access.log | awk '{print $7, $9, $10}' | grep " 500 " | sort -k3 -rn | head -10
```

**Output:**
```
/api/chat/messages/123 200 1234ms
/api/rides/search 200 892ms
/api/reports/generate 200 645ms
```

#### **Error Rate Analysis:**
```bash
# Count 5xx errors
grep " 5[0-9][0-9] " logs/access.log | wc -l

# Find most common errors
grep " 5[0-9][0-9] " logs/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

**Output:**
```
45 /api/tracking/update
23 /api/sos/emergency
12 /api/bookings
```

#### **Traffic Patterns:**
```bash
# Requests per hour
awk '{print $4}' logs/access.log | cut -d: -f2 | sort | uniq -c
```

**Output:**
```
123 08 (8am)
456 09 (9am peak)
234 10 (10am)
```

---

### **🛠️ Advanced Configuration Options**

#### **Available Morgan Formats:**

```javascript
// If you wanted to customize further:

// 1. Custom format string
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 2. Custom function format
app.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), '
```


## License: MIT
https://github.com/swimmadude66/YTRadio/blob/9cdeec76687caf692a94237d3cde8560195a8599/src/server/app.ts

```
## **Morgan Middleware - Detailed Explanation**

### **📍 Where It's Used**

**Locations:** [server.js](server.js#L132-L141)

```javascript
// Line 19: Import
const morgan = require('morgan');

// Lines 131-141: Environment-specific logging
if (process.env.NODE_ENV === 'production') {
    // Production: log to rotating files
    app.use(morgan('combined', { 
        stream: accessLogStream,
        skip: shouldSkipLogging
    }));
} else {
    // Development: log to console
    app.use(morgan('dev', {
        skip: shouldSkipLogging
    }));
}
```

**Logger utilities:** [utils/logger.js](utils/logger.js#L1-L65)

---

### **🎯 Purpose**

Morgan is an **HTTP request logger** middleware that automatically logs:
- **Request details:** HTTP method, URL, status code
- **Response metadata:** Response time, content length
- **Client info:** IP address, user agent
- **Timestamps:** When requests occurred

**Benefits:**
- **Debugging:** Track down issues by reviewing request logs
- **Monitoring:** Identify slow endpoints and performance bottlenecks
- **Security:** Detect suspicious access patterns
- **Compliance:** Maintain audit trails for regulated systems

---

### **⚙️ Configuration**

### **Two Environments, Two Formats:**

#### **1. Production Environment** (Lines 132-135)

```javascript
app.use(morgan('combined', { 
    stream: accessLogStream,        // Write to rotating file
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'combined'` (Apache Combined Log Format)
```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Example Output:**
```
192.168.1.100 - - [11/Feb/2026:10:30:45 +0000] "GET /api/rides/active HTTP/1.1" 200 3456 "https://yourapp.com/dashboard" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
192.168.1.101 - - [11/Feb/2026:10:30:46 +0000] "POST /api/bookings HTTP/1.1" 201 892 "https://yourapp.com/book-ride" "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
192.168.1.102 - - [11/Feb/2026:10:30:47 +0000] "GET /api/chat/messages/123 HTTP/1.1" 200 15234 "-" "LoopLane-Mobile/1.2.0"
```

**Why `combined` for production:**
- ✅ **Detailed:** Includes referrer and user-agent for debugging
- ✅ **Standard:** Compatible with log analysis tools (AWStats, GoAccess, ELK)
- ✅ **Audit-ready:** Comprehensive information for security reviews

---

#### **2. Development Environment** (Lines 138-141)

```javascript
app.use(morgan('dev', {
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'dev'` (Colored, concise output)
```
:method :url :status :response-time ms - :res[content-length]
```

**Example Output (with color coding):**
```
GET /api/rides/active 200 45.234 ms - 3456
POST /api/bookings 201 123.567 ms - 892
GET /api/chat/messages/123 200 234.890 ms - 15234
DELETE /api/bookings/456 404 12.345 ms - 156
```

**Color Coding:**
- 🟢 **Green:** 2xx Success (200, 201, 204)
- 🔵 **Cyan:** 3xx Redirect (301, 302, 304)
- 🟡 **Yellow:** 4xx Client Error (400, 401, 404)
- 🔴 **Red:** 5xx Server Error (500, 502, 503)

**Why `dev` for development:**
- ✅ **Readable:** Clean, colored output for quick visual scanning
- ✅ **Concise:** Only essential info (no referrer/user-agent clutter)
- ✅ **Fast:** Easy to spot slow requests and errors at a glance

---

### **🔄 Log Stream Configuration** ([utils/logger.js](utils/logger.js#L19-L26))

#### **Production: Rotating File Stream**

```javascript
const rfs = require('rotating-file-stream');

// Create rotating write stream for access logs
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',      // Rotate daily (creates new file each day)
    maxFiles: 14,        // Keep 14 days of logs (auto-delete older)
    compress: 'gzip',    // Compress rotated files (.gz to save space)
    path: logsDir        // Store in /logs directory
});
```

**File Structure:**
```
logs/
├── access.log             ← Current day's logs (active)
├── access.log.1.gz        ← Yesterday (compressed)
├── access.log.2.gz        ← 2 days ago
├── access.log.3.gz        ← 3 days ago
...
└── access.log.14.gz       ← 14 days ago (oldest kept)
```

**Automatic Behavior:**
- **Daily rotation:** At midnight, `access.log` → `access.log.1.gz`, new `access.log` created
- **Compression:** Saves ~90% disk space (100MB → 10MB)
- **Auto-cleanup:** Files older than 14 days automatically deleted
- **Zero downtime:** Rotation happens seamlessly while server runs

**Disk Usage Example:**
```
Daily average: 50 MB uncompressed
After compression: 5 MB × 14 days = 70 MB total
Without rotation: 50 MB × 30 days = 1.5 GB
Savings: 95%+ disk space
```

---

### **🚫 Skip Logging Function** ([utils/logger.js](utils/logger.js#L54-L59))

```javascript
const skipPaths = ['/health', '/favicon.ico'];

const shouldSkipLogging = (req) => {
    return skipPaths.some(path => req.url.startsWith(path));
};
```

**Purpose:** Exclude noisy, low-value requests from logs

**Skipped Paths:**
1. **`/health`** - Health check endpoint (hits every 10 seconds by monitoring tools)
2. **`/favicon.ico`** - Browser automatically requests this (not an API call)

**Example Impact:**
```
Without skip:
- 8,640 health checks/day (every 10s)
- ~500 favicon requests/day
- Total: 9,140 useless log entries/day

With skip:
- Only real API requests logged
- Cleaner logs, easier to find issues
```

---

### **📊 Log Format Comparison**

| Format | Use Case | Output Style | Info Included |
|--------|----------|--------------|---------------|
| **combined** | Production | Standard Apache format | IP, timestamp, method, URL, status, size, referrer, user-agent |
| **dev** | Development | Colored, concise | Method, URL, status, response time, size |
| **common** | Basic production | Apache Common Log | Like combined but no referrer/user-agent |
| **short** | Minimal logging | Brief format | IP, method, URL, status, size, response time |
| **tiny** | Ultra-minimal | One-liner | Method, URL, status, size, response time |

---

### **🔍 Real-World Examples from Your App**

#### **Production Log Entry (combined format):**

```
192.168.1.50 - - [11/Feb/2026:14:23:15 +0000] "POST /api/bookings HTTP/1.1" 201 1234 "https://looplane.onrender.com/book-ride" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Breaking it down:**
- `192.168.1.50` - Client IP address
- `-` - Remote user (not used)
- `-` - Authenticated user (could show JWT userId if logged)
- `[11/Feb/2026:14:23:15 +0000]` - Timestamp (Common Log Format)
- `"POST /api/bookings HTTP/1.1"` - Request method, path, protocol
- `201` - HTTP status (Created)
- `1234` - Response size in bytes
- `"https://looplane.onrender.com/book-ride"` - Referrer (previous page)
- `"Mozilla/5.0..."` - User agent (browser/device info)

---

#### **Development Console Output (dev format):**

```
POST /api/auth/login 200 156.234 ms - 456
GET /api/rides/active 200 45.123 ms - 3456
POST /api/bookings 201 234.567 ms - 1234
GET /api/users/profile 401 12.345 ms - 89
DELETE /api/bookings/123 404 8.901 ms - 67
GET /api/sos/emergencies 500 345.678 ms - 234
```

**Color coding in terminal:**
- Line 1: 🟢 Green (200 OK)
- Line 2: 🟢 Green (200 OK)
- Line 3: 🟢 Green (201 Created)
- Line 4: 🟡 Yellow (401 Unauthorized - auth issue)
- Line 5: 🟡 Yellow (404 Not Found - client error)
- Line 6: 🔴 Red (500 Internal Server Error - needs attention!)

---

### **🎛️ Middleware Stack Order**

**Current Position:** Lines 132-141 (after compression, before body parsers)

```javascript
app.use(helmet());              // Security headers
app.use(cors());                // Cross-origin
app.use(compression());         // Compress responses
app.use(cookieParser());        // Parse cookies
app.use(morgan(...));           // ← Log HTTP requests (early)
app.use(express.json());        // Parse JSON body
app.use(express.urlencoded());  // Parse URL-encoded body
app.use(mongoSanitize());       // NoSQL injection protection
app.use(xss());                 // XSS protection
app.use(hpp());                 // HPP protection
// ... routes ...
```

**Why this order matters:**
- **Before body parsers:** Logs raw request immediately (even if body parsing fails)
- **After security:** Lets helmet/CORS set headers first
- **Before routes:** Captures all requests including 404s
- Position is optimal ✅

---

### **💻 Custom Morgan Tokens** ([utils/logger.js](utils/logger.js#L39-L49))

```javascript
/**
 * Custom morgan token for response time in milliseconds
 */
const morganTokens = {
    'response-time-ms': (req, res) => {
        if (!req._startAt || !res._startAt) {
            return '-';
        }
        const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                   (res._startAt[1] - req._startAt[1]) * 1e-6;
        return ms.toFixed(3);
    }
};
```

**Purpose:** Define custom data to include in logs

**Usage (if you wanted to use it):**
```javascript
// Register custom token
morgan.token('response-time-ms', morganTokens['response-time-ms']);

// Use in custom format
app.use(morgan(':method :url :status :response-time-ms ms'));
```

**Output:**
```
GET /api/rides 200 45.234 ms
```

---

### **📈 Performance Impact**

#### **Logging Overhead:**
- **Console logging (dev):** ~0.5-1ms per request
- **File logging (production):** ~1-2ms per request
- **Rotating file stream:** Minimal (async writes)

#### **Disk I/O:**
- **Buffered writes:** Morgan doesn't block response
- **Async operations:** Logs written after response sent
- **Impact:** Negligible (<1% of response time)

---

### **🔍 Log Analysis Examples**

#### **Finding Slow Endpoints (Production):**
```bash
# Extract slow requests (>500ms)
cat logs/access.log | awk '{print $7, $9, $10}' | grep " 500 " | sort -k3 -rn | head -10
```

**Output:**
```
/api/chat/messages/123 200 1234ms
/api/rides/search 200 892ms
/api/reports/generate 200 645ms
```

#### **Error Rate Analysis:**
```bash
# Count 5xx errors
grep " 5[0-9][0-9] " logs/access.log | wc -l

# Find most common errors
grep " 5[0-9][0-9] " logs/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

**Output:**
```
45 /api/tracking/update
23 /api/sos/emergency
12 /api/bookings
```

#### **Traffic Patterns:**
```bash
# Requests per hour
awk '{print $4}' logs/access.log | cut -d: -f2 | sort | uniq -c
```

**Output:**
```
123 08 (8am)
456 09 (9am peak)
234 10 (10am)
```

---

### **🛠️ Advanced Configuration Options**

#### **Available Morgan Formats:**

```javascript
// If you wanted to customize further:

// 1. Custom format string
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 2. Custom function format
app.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), '
```


## License: MIT
https://github.com/swimmadude66/YTRadio/blob/9cdeec76687caf692a94237d3cde8560195a8599/src/server/app.ts

```
## **Morgan Middleware - Detailed Explanation**

### **📍 Where It's Used**

**Locations:** [server.js](server.js#L132-L141)

```javascript
// Line 19: Import
const morgan = require('morgan');

// Lines 131-141: Environment-specific logging
if (process.env.NODE_ENV === 'production') {
    // Production: log to rotating files
    app.use(morgan('combined', { 
        stream: accessLogStream,
        skip: shouldSkipLogging
    }));
} else {
    // Development: log to console
    app.use(morgan('dev', {
        skip: shouldSkipLogging
    }));
}
```

**Logger utilities:** [utils/logger.js](utils/logger.js#L1-L65)

---

### **🎯 Purpose**

Morgan is an **HTTP request logger** middleware that automatically logs:
- **Request details:** HTTP method, URL, status code
- **Response metadata:** Response time, content length
- **Client info:** IP address, user agent
- **Timestamps:** When requests occurred

**Benefits:**
- **Debugging:** Track down issues by reviewing request logs
- **Monitoring:** Identify slow endpoints and performance bottlenecks
- **Security:** Detect suspicious access patterns
- **Compliance:** Maintain audit trails for regulated systems

---

### **⚙️ Configuration**

### **Two Environments, Two Formats:**

#### **1. Production Environment** (Lines 132-135)

```javascript
app.use(morgan('combined', { 
    stream: accessLogStream,        // Write to rotating file
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'combined'` (Apache Combined Log Format)
```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Example Output:**
```
192.168.1.100 - - [11/Feb/2026:10:30:45 +0000] "GET /api/rides/active HTTP/1.1" 200 3456 "https://yourapp.com/dashboard" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
192.168.1.101 - - [11/Feb/2026:10:30:46 +0000] "POST /api/bookings HTTP/1.1" 201 892 "https://yourapp.com/book-ride" "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
192.168.1.102 - - [11/Feb/2026:10:30:47 +0000] "GET /api/chat/messages/123 HTTP/1.1" 200 15234 "-" "LoopLane-Mobile/1.2.0"
```

**Why `combined` for production:**
- ✅ **Detailed:** Includes referrer and user-agent for debugging
- ✅ **Standard:** Compatible with log analysis tools (AWStats, GoAccess, ELK)
- ✅ **Audit-ready:** Comprehensive information for security reviews

---

#### **2. Development Environment** (Lines 138-141)

```javascript
app.use(morgan('dev', {
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'dev'` (Colored, concise output)
```
:method :url :status :response-time ms - :res[content-length]
```

**Example Output (with color coding):**
```
GET /api/rides/active 200 45.234 ms - 3456
POST /api/bookings 201 123.567 ms - 892
GET /api/chat/messages/123 200 234.890 ms - 15234
DELETE /api/bookings/456 404 12.345 ms - 156
```

**Color Coding:**
- 🟢 **Green:** 2xx Success (200, 201, 204)
- 🔵 **Cyan:** 3xx Redirect (301, 302, 304)
- 🟡 **Yellow:** 4xx Client Error (400, 401, 404)
- 🔴 **Red:** 5xx Server Error (500, 502, 503)

**Why `dev` for development:**
- ✅ **Readable:** Clean, colored output for quick visual scanning
- ✅ **Concise:** Only essential info (no referrer/user-agent clutter)
- ✅ **Fast:** Easy to spot slow requests and errors at a glance

---

### **🔄 Log Stream Configuration** ([utils/logger.js](utils/logger.js#L19-L26))

#### **Production: Rotating File Stream**

```javascript
const rfs = require('rotating-file-stream');

// Create rotating write stream for access logs
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',      // Rotate daily (creates new file each day)
    maxFiles: 14,        // Keep 14 days of logs (auto-delete older)
    compress: 'gzip',    // Compress rotated files (.gz to save space)
    path: logsDir        // Store in /logs directory
});
```

**File Structure:**
```
logs/
├── access.log             ← Current day's logs (active)
├── access.log.1.gz        ← Yesterday (compressed)
├── access.log.2.gz        ← 2 days ago
├── access.log.3.gz        ← 3 days ago
...
└── access.log.14.gz       ← 14 days ago (oldest kept)
```

**Automatic Behavior:**
- **Daily rotation:** At midnight, `access.log` → `access.log.1.gz`, new `access.log` created
- **Compression:** Saves ~90% disk space (100MB → 10MB)
- **Auto-cleanup:** Files older than 14 days automatically deleted
- **Zero downtime:** Rotation happens seamlessly while server runs

**Disk Usage Example:**
```
Daily average: 50 MB uncompressed
After compression: 5 MB × 14 days = 70 MB total
Without rotation: 50 MB × 30 days = 1.5 GB
Savings: 95%+ disk space
```

---

### **🚫 Skip Logging Function** ([utils/logger.js](utils/logger.js#L54-L59))

```javascript
const skipPaths = ['/health', '/favicon.ico'];

const shouldSkipLogging = (req) => {
    return skipPaths.some(path => req.url.startsWith(path));
};
```

**Purpose:** Exclude noisy, low-value requests from logs

**Skipped Paths:**
1. **`/health`** - Health check endpoint (hits every 10 seconds by monitoring tools)
2. **`/favicon.ico`** - Browser automatically requests this (not an API call)

**Example Impact:**
```
Without skip:
- 8,640 health checks/day (every 10s)
- ~500 favicon requests/day
- Total: 9,140 useless log entries/day

With skip:
- Only real API requests logged
- Cleaner logs, easier to find issues
```

---

### **📊 Log Format Comparison**

| Format | Use Case | Output Style | Info Included |
|--------|----------|--------------|---------------|
| **combined** | Production | Standard Apache format | IP, timestamp, method, URL, status, size, referrer, user-agent |
| **dev** | Development | Colored, concise | Method, URL, status, response time, size |
| **common** | Basic production | Apache Common Log | Like combined but no referrer/user-agent |
| **short** | Minimal logging | Brief format | IP, method, URL, status, size, response time |
| **tiny** | Ultra-minimal | One-liner | Method, URL, status, size, response time |

---

### **🔍 Real-World Examples from Your App**

#### **Production Log Entry (combined format):**

```
192.168.1.50 - - [11/Feb/2026:14:23:15 +0000] "POST /api/bookings HTTP/1.1" 201 1234 "https://looplane.onrender.com/book-ride" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Breaking it down:**
- `192.168.1.50` - Client IP address
- `-` - Remote user (not used)
- `-` - Authenticated user (could show JWT userId if logged)
- `[11/Feb/2026:14:23:15 +0000]` - Timestamp (Common Log Format)
- `"POST /api/bookings HTTP/1.1"` - Request method, path, protocol
- `201` - HTTP status (Created)
- `1234` - Response size in bytes
- `"https://looplane.onrender.com/book-ride"` - Referrer (previous page)
- `"Mozilla/5.0..."` - User agent (browser/device info)

---

#### **Development Console Output (dev format):**

```
POST /api/auth/login 200 156.234 ms - 456
GET /api/rides/active 200 45.123 ms - 3456
POST /api/bookings 201 234.567 ms - 1234
GET /api/users/profile 401 12.345 ms - 89
DELETE /api/bookings/123 404 8.901 ms - 67
GET /api/sos/emergencies 500 345.678 ms - 234
```

**Color coding in terminal:**
- Line 1: 🟢 Green (200 OK)
- Line 2: 🟢 Green (200 OK)
- Line 3: 🟢 Green (201 Created)
- Line 4: 🟡 Yellow (401 Unauthorized - auth issue)
- Line 5: 🟡 Yellow (404 Not Found - client error)
- Line 6: 🔴 Red (500 Internal Server Error - needs attention!)

---

### **🎛️ Middleware Stack Order**

**Current Position:** Lines 132-141 (after compression, before body parsers)

```javascript
app.use(helmet());              // Security headers
app.use(cors());                // Cross-origin
app.use(compression());         // Compress responses
app.use(cookieParser());        // Parse cookies
app.use(morgan(...));           // ← Log HTTP requests (early)
app.use(express.json());        // Parse JSON body
app.use(express.urlencoded());  // Parse URL-encoded body
app.use(mongoSanitize());       // NoSQL injection protection
app.use(xss());                 // XSS protection
app.use(hpp());                 // HPP protection
// ... routes ...
```

**Why this order matters:**
- **Before body parsers:** Logs raw request immediately (even if body parsing fails)
- **After security:** Lets helmet/CORS set headers first
- **Before routes:** Captures all requests including 404s
- Position is optimal ✅

---

### **💻 Custom Morgan Tokens** ([utils/logger.js](utils/logger.js#L39-L49))

```javascript
/**
 * Custom morgan token for response time in milliseconds
 */
const morganTokens = {
    'response-time-ms': (req, res) => {
        if (!req._startAt || !res._startAt) {
            return '-';
        }
        const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                   (res._startAt[1] - req._startAt[1]) * 1e-6;
        return ms.toFixed(3);
    }
};
```

**Purpose:** Define custom data to include in logs

**Usage (if you wanted to use it):**
```javascript
// Register custom token
morgan.token('response-time-ms', morganTokens['response-time-ms']);

// Use in custom format
app.use(morgan(':method :url :status :response-time-ms ms'));
```

**Output:**
```
GET /api/rides 200 45.234 ms
```

---

### **📈 Performance Impact**

#### **Logging Overhead:**
- **Console logging (dev):** ~0.5-1ms per request
- **File logging (production):** ~1-2ms per request
- **Rotating file stream:** Minimal (async writes)

#### **Disk I/O:**
- **Buffered writes:** Morgan doesn't block response
- **Async operations:** Logs written after response sent
- **Impact:** Negligible (<1% of response time)

---

### **🔍 Log Analysis Examples**

#### **Finding Slow Endpoints (Production):**
```bash
# Extract slow requests (>500ms)
cat logs/access.log | awk '{print $7, $9, $10}' | grep " 500 " | sort -k3 -rn | head -10
```

**Output:**
```
/api/chat/messages/123 200 1234ms
/api/rides/search 200 892ms
/api/reports/generate 200 645ms
```

#### **Error Rate Analysis:**
```bash
# Count 5xx errors
grep " 5[0-9][0-9] " logs/access.log | wc -l

# Find most common errors
grep " 5[0-9][0-9] " logs/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

**Output:**
```
45 /api/tracking/update
23 /api/sos/emergency
12 /api/bookings
```

#### **Traffic Patterns:**
```bash
# Requests per hour
awk '{print $4}' logs/access.log | cut -d: -f2 | sort | uniq -c
```

**Output:**
```
123 08 (8am)
456 09 (9am peak)
234 10 (10am)
```

---

### **🛠️ Advanced Configuration Options**

#### **Available Morgan Formats:**

```javascript
// If you wanted to customize further:

// 1. Custom format string
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 2. Custom function format
app.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), '
```


## License: MIT
https://github.com/swimmadude66/YTRadio/blob/9cdeec76687caf692a94237d3cde8560195a8599/src/server/app.ts

```
## **Morgan Middleware - Detailed Explanation**

### **📍 Where It's Used**

**Locations:** [server.js](server.js#L132-L141)

```javascript
// Line 19: Import
const morgan = require('morgan');

// Lines 131-141: Environment-specific logging
if (process.env.NODE_ENV === 'production') {
    // Production: log to rotating files
    app.use(morgan('combined', { 
        stream: accessLogStream,
        skip: shouldSkipLogging
    }));
} else {
    // Development: log to console
    app.use(morgan('dev', {
        skip: shouldSkipLogging
    }));
}
```

**Logger utilities:** [utils/logger.js](utils/logger.js#L1-L65)

---

### **🎯 Purpose**

Morgan is an **HTTP request logger** middleware that automatically logs:
- **Request details:** HTTP method, URL, status code
- **Response metadata:** Response time, content length
- **Client info:** IP address, user agent
- **Timestamps:** When requests occurred

**Benefits:**
- **Debugging:** Track down issues by reviewing request logs
- **Monitoring:** Identify slow endpoints and performance bottlenecks
- **Security:** Detect suspicious access patterns
- **Compliance:** Maintain audit trails for regulated systems

---

### **⚙️ Configuration**

### **Two Environments, Two Formats:**

#### **1. Production Environment** (Lines 132-135)

```javascript
app.use(morgan('combined', { 
    stream: accessLogStream,        // Write to rotating file
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'combined'` (Apache Combined Log Format)
```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Example Output:**
```
192.168.1.100 - - [11/Feb/2026:10:30:45 +0000] "GET /api/rides/active HTTP/1.1" 200 3456 "https://yourapp.com/dashboard" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
192.168.1.101 - - [11/Feb/2026:10:30:46 +0000] "POST /api/bookings HTTP/1.1" 201 892 "https://yourapp.com/book-ride" "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
192.168.1.102 - - [11/Feb/2026:10:30:47 +0000] "GET /api/chat/messages/123 HTTP/1.1" 200 15234 "-" "LoopLane-Mobile/1.2.0"
```

**Why `combined` for production:**
- ✅ **Detailed:** Includes referrer and user-agent for debugging
- ✅ **Standard:** Compatible with log analysis tools (AWStats, GoAccess, ELK)
- ✅ **Audit-ready:** Comprehensive information for security reviews

---

#### **2. Development Environment** (Lines 138-141)

```javascript
app.use(morgan('dev', {
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'dev'` (Colored, concise output)
```
:method :url :status :response-time ms - :res[content-length]
```

**Example Output (with color coding):**
```
GET /api/rides/active 200 45.234 ms - 3456
POST /api/bookings 201 123.567 ms - 892
GET /api/chat/messages/123 200 234.890 ms - 15234
DELETE /api/bookings/456 404 12.345 ms - 156
```

**Color Coding:**
- 🟢 **Green:** 2xx Success (200, 201, 204)
- 🔵 **Cyan:** 3xx Redirect (301, 302, 304)
- 🟡 **Yellow:** 4xx Client Error (400, 401, 404)
- 🔴 **Red:** 5xx Server Error (500, 502, 503)

**Why `dev` for development:**
- ✅ **Readable:** Clean, colored output for quick visual scanning
- ✅ **Concise:** Only essential info (no referrer/user-agent clutter)
- ✅ **Fast:** Easy to spot slow requests and errors at a glance

---

### **🔄 Log Stream Configuration** ([utils/logger.js](utils/logger.js#L19-L26))

#### **Production: Rotating File Stream**

```javascript
const rfs = require('rotating-file-stream');

// Create rotating write stream for access logs
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',      // Rotate daily (creates new file each day)
    maxFiles: 14,        // Keep 14 days of logs (auto-delete older)
    compress: 'gzip',    // Compress rotated files (.gz to save space)
    path: logsDir        // Store in /logs directory
});
```

**File Structure:**
```
logs/
├── access.log             ← Current day's logs (active)
├── access.log.1.gz        ← Yesterday (compressed)
├── access.log.2.gz        ← 2 days ago
├── access.log.3.gz        ← 3 days ago
...
└── access.log.14.gz       ← 14 days ago (oldest kept)
```

**Automatic Behavior:**
- **Daily rotation:** At midnight, `access.log` → `access.log.1.gz`, new `access.log` created
- **Compression:** Saves ~90% disk space (100MB → 10MB)
- **Auto-cleanup:** Files older than 14 days automatically deleted
- **Zero downtime:** Rotation happens seamlessly while server runs

**Disk Usage Example:**
```
Daily average: 50 MB uncompressed
After compression: 5 MB × 14 days = 70 MB total
Without rotation: 50 MB × 30 days = 1.5 GB
Savings: 95%+ disk space
```

---

### **🚫 Skip Logging Function** ([utils/logger.js](utils/logger.js#L54-L59))

```javascript
const skipPaths = ['/health', '/favicon.ico'];

const shouldSkipLogging = (req) => {
    return skipPaths.some(path => req.url.startsWith(path));
};
```

**Purpose:** Exclude noisy, low-value requests from logs

**Skipped Paths:**
1. **`/health`** - Health check endpoint (hits every 10 seconds by monitoring tools)
2. **`/favicon.ico`** - Browser automatically requests this (not an API call)

**Example Impact:**
```
Without skip:
- 8,640 health checks/day (every 10s)
- ~500 favicon requests/day
- Total: 9,140 useless log entries/day

With skip:
- Only real API requests logged
- Cleaner logs, easier to find issues
```

---

### **📊 Log Format Comparison**

| Format | Use Case | Output Style | Info Included |
|--------|----------|--------------|---------------|
| **combined** | Production | Standard Apache format | IP, timestamp, method, URL, status, size, referrer, user-agent |
| **dev** | Development | Colored, concise | Method, URL, status, response time, size |
| **common** | Basic production | Apache Common Log | Like combined but no referrer/user-agent |
| **short** | Minimal logging | Brief format | IP, method, URL, status, size, response time |
| **tiny** | Ultra-minimal | One-liner | Method, URL, status, size, response time |

---

### **🔍 Real-World Examples from Your App**

#### **Production Log Entry (combined format):**

```
192.168.1.50 - - [11/Feb/2026:14:23:15 +0000] "POST /api/bookings HTTP/1.1" 201 1234 "https://looplane.onrender.com/book-ride" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Breaking it down:**
- `192.168.1.50` - Client IP address
- `-` - Remote user (not used)
- `-` - Authenticated user (could show JWT userId if logged)
- `[11/Feb/2026:14:23:15 +0000]` - Timestamp (Common Log Format)
- `"POST /api/bookings HTTP/1.1"` - Request method, path, protocol
- `201` - HTTP status (Created)
- `1234` - Response size in bytes
- `"https://looplane.onrender.com/book-ride"` - Referrer (previous page)
- `"Mozilla/5.0..."` - User agent (browser/device info)

---

#### **Development Console Output (dev format):**

```
POST /api/auth/login 200 156.234 ms - 456
GET /api/rides/active 200 45.123 ms - 3456
POST /api/bookings 201 234.567 ms - 1234
GET /api/users/profile 401 12.345 ms - 89
DELETE /api/bookings/123 404 8.901 ms - 67
GET /api/sos/emergencies 500 345.678 ms - 234
```

**Color coding in terminal:**
- Line 1: 🟢 Green (200 OK)
- Line 2: 🟢 Green (200 OK)
- Line 3: 🟢 Green (201 Created)
- Line 4: 🟡 Yellow (401 Unauthorized - auth issue)
- Line 5: 🟡 Yellow (404 Not Found - client error)
- Line 6: 🔴 Red (500 Internal Server Error - needs attention!)

---

### **🎛️ Middleware Stack Order**

**Current Position:** Lines 132-141 (after compression, before body parsers)

```javascript
app.use(helmet());              // Security headers
app.use(cors());                // Cross-origin
app.use(compression());         // Compress responses
app.use(cookieParser());        // Parse cookies
app.use(morgan(...));           // ← Log HTTP requests (early)
app.use(express.json());        // Parse JSON body
app.use(express.urlencoded());  // Parse URL-encoded body
app.use(mongoSanitize());       // NoSQL injection protection
app.use(xss());                 // XSS protection
app.use(hpp());                 // HPP protection
// ... routes ...
```

**Why this order matters:**
- **Before body parsers:** Logs raw request immediately (even if body parsing fails)
- **After security:** Lets helmet/CORS set headers first
- **Before routes:** Captures all requests including 404s
- Position is optimal ✅

---

### **💻 Custom Morgan Tokens** ([utils/logger.js](utils/logger.js#L39-L49))

```javascript
/**
 * Custom morgan token for response time in milliseconds
 */
const morganTokens = {
    'response-time-ms': (req, res) => {
        if (!req._startAt || !res._startAt) {
            return '-';
        }
        const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                   (res._startAt[1] - req._startAt[1]) * 1e-6;
        return ms.toFixed(3);
    }
};
```

**Purpose:** Define custom data to include in logs

**Usage (if you wanted to use it):**
```javascript
// Register custom token
morgan.token('response-time-ms', morganTokens['response-time-ms']);

// Use in custom format
app.use(morgan(':method :url :status :response-time-ms ms'));
```

**Output:**
```
GET /api/rides 200 45.234 ms
```

---

### **📈 Performance Impact**

#### **Logging Overhead:**
- **Console logging (dev):** ~0.5-1ms per request
- **File logging (production):** ~1-2ms per request
- **Rotating file stream:** Minimal (async writes)

#### **Disk I/O:**
- **Buffered writes:** Morgan doesn't block response
- **Async operations:** Logs written after response sent
- **Impact:** Negligible (<1% of response time)

---

### **🔍 Log Analysis Examples**

#### **Finding Slow Endpoints (Production):**
```bash
# Extract slow requests (>500ms)
cat logs/access.log | awk '{print $7, $9, $10}' | grep " 500 " | sort -k3 -rn | head -10
```

**Output:**
```
/api/chat/messages/123 200 1234ms
/api/rides/search 200 892ms
/api/reports/generate 200 645ms
```

#### **Error Rate Analysis:**
```bash
# Count 5xx errors
grep " 5[0-9][0-9] " logs/access.log | wc -l

# Find most common errors
grep " 5[0-9][0-9] " logs/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

**Output:**
```
45 /api/tracking/update
23 /api/sos/emergency
12 /api/bookings
```

#### **Traffic Patterns:**
```bash
# Requests per hour
awk '{print $4}' logs/access.log | cut -d: -f2 | sort | uniq -c
```

**Output:**
```
123 08 (8am)
456 09 (9am peak)
234 10 (10am)
```

---

### **🛠️ Advanced Configuration Options**

#### **Available Morgan Formats:**

```javascript
// If you wanted to customize further:

// 1. Custom format string
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 2. Custom function format
app.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), '
```


## License: MIT
https://github.com/swimmadude66/YTRadio/blob/9cdeec76687caf692a94237d3cde8560195a8599/src/server/app.ts

```
## **Morgan Middleware - Detailed Explanation**

### **📍 Where It's Used**

**Locations:** [server.js](server.js#L132-L141)

```javascript
// Line 19: Import
const morgan = require('morgan');

// Lines 131-141: Environment-specific logging
if (process.env.NODE_ENV === 'production') {
    // Production: log to rotating files
    app.use(morgan('combined', { 
        stream: accessLogStream,
        skip: shouldSkipLogging
    }));
} else {
    // Development: log to console
    app.use(morgan('dev', {
        skip: shouldSkipLogging
    }));
}
```

**Logger utilities:** [utils/logger.js](utils/logger.js#L1-L65)

---

### **🎯 Purpose**

Morgan is an **HTTP request logger** middleware that automatically logs:
- **Request details:** HTTP method, URL, status code
- **Response metadata:** Response time, content length
- **Client info:** IP address, user agent
- **Timestamps:** When requests occurred

**Benefits:**
- **Debugging:** Track down issues by reviewing request logs
- **Monitoring:** Identify slow endpoints and performance bottlenecks
- **Security:** Detect suspicious access patterns
- **Compliance:** Maintain audit trails for regulated systems

---

### **⚙️ Configuration**

### **Two Environments, Two Formats:**

#### **1. Production Environment** (Lines 132-135)

```javascript
app.use(morgan('combined', { 
    stream: accessLogStream,        // Write to rotating file
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'combined'` (Apache Combined Log Format)
```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Example Output:**
```
192.168.1.100 - - [11/Feb/2026:10:30:45 +0000] "GET /api/rides/active HTTP/1.1" 200 3456 "https://yourapp.com/dashboard" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
192.168.1.101 - - [11/Feb/2026:10:30:46 +0000] "POST /api/bookings HTTP/1.1" 201 892 "https://yourapp.com/book-ride" "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
192.168.1.102 - - [11/Feb/2026:10:30:47 +0000] "GET /api/chat/messages/123 HTTP/1.1" 200 15234 "-" "LoopLane-Mobile/1.2.0"
```

**Why `combined` for production:**
- ✅ **Detailed:** Includes referrer and user-agent for debugging
- ✅ **Standard:** Compatible with log analysis tools (AWStats, GoAccess, ELK)
- ✅ **Audit-ready:** Comprehensive information for security reviews

---

#### **2. Development Environment** (Lines 138-141)

```javascript
app.use(morgan('dev', {
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'dev'` (Colored, concise output)
```
:method :url :status :response-time ms - :res[content-length]
```

**Example Output (with color coding):**
```
GET /api/rides/active 200 45.234 ms - 3456
POST /api/bookings 201 123.567 ms - 892
GET /api/chat/messages/123 200 234.890 ms - 15234
DELETE /api/bookings/456 404 12.345 ms - 156
```

**Color Coding:**
- 🟢 **Green:** 2xx Success (200, 201, 204)
- 🔵 **Cyan:** 3xx Redirect (301, 302, 304)
- 🟡 **Yellow:** 4xx Client Error (400, 401, 404)
- 🔴 **Red:** 5xx Server Error (500, 502, 503)

**Why `dev` for development:**
- ✅ **Readable:** Clean, colored output for quick visual scanning
- ✅ **Concise:** Only essential info (no referrer/user-agent clutter)
- ✅ **Fast:** Easy to spot slow requests and errors at a glance

---

### **🔄 Log Stream Configuration** ([utils/logger.js](utils/logger.js#L19-L26))

#### **Production: Rotating File Stream**

```javascript
const rfs = require('rotating-file-stream');

// Create rotating write stream for access logs
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',      // Rotate daily (creates new file each day)
    maxFiles: 14,        // Keep 14 days of logs (auto-delete older)
    compress: 'gzip',    // Compress rotated files (.gz to save space)
    path: logsDir        // Store in /logs directory
});
```

**File Structure:**
```
logs/
├── access.log             ← Current day's logs (active)
├── access.log.1.gz        ← Yesterday (compressed)
├── access.log.2.gz        ← 2 days ago
├── access.log.3.gz        ← 3 days ago
...
└── access.log.14.gz       ← 14 days ago (oldest kept)
```

**Automatic Behavior:**
- **Daily rotation:** At midnight, `access.log` → `access.log.1.gz`, new `access.log` created
- **Compression:** Saves ~90% disk space (100MB → 10MB)
- **Auto-cleanup:** Files older than 14 days automatically deleted
- **Zero downtime:** Rotation happens seamlessly while server runs

**Disk Usage Example:**
```
Daily average: 50 MB uncompressed
After compression: 5 MB × 14 days = 70 MB total
Without rotation: 50 MB × 30 days = 1.5 GB
Savings: 95%+ disk space
```

---

### **🚫 Skip Logging Function** ([utils/logger.js](utils/logger.js#L54-L59))

```javascript
const skipPaths = ['/health', '/favicon.ico'];

const shouldSkipLogging = (req) => {
    return skipPaths.some(path => req.url.startsWith(path));
};
```

**Purpose:** Exclude noisy, low-value requests from logs

**Skipped Paths:**
1. **`/health`** - Health check endpoint (hits every 10 seconds by monitoring tools)
2. **`/favicon.ico`** - Browser automatically requests this (not an API call)

**Example Impact:**
```
Without skip:
- 8,640 health checks/day (every 10s)
- ~500 favicon requests/day
- Total: 9,140 useless log entries/day

With skip:
- Only real API requests logged
- Cleaner logs, easier to find issues
```

---

### **📊 Log Format Comparison**

| Format | Use Case | Output Style | Info Included |
|--------|----------|--------------|---------------|
| **combined** | Production | Standard Apache format | IP, timestamp, method, URL, status, size, referrer, user-agent |
| **dev** | Development | Colored, concise | Method, URL, status, response time, size |
| **common** | Basic production | Apache Common Log | Like combined but no referrer/user-agent |
| **short** | Minimal logging | Brief format | IP, method, URL, status, size, response time |
| **tiny** | Ultra-minimal | One-liner | Method, URL, status, size, response time |

---

### **🔍 Real-World Examples from Your App**

#### **Production Log Entry (combined format):**

```
192.168.1.50 - - [11/Feb/2026:14:23:15 +0000] "POST /api/bookings HTTP/1.1" 201 1234 "https://looplane.onrender.com/book-ride" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Breaking it down:**
- `192.168.1.50` - Client IP address
- `-` - Remote user (not used)
- `-` - Authenticated user (could show JWT userId if logged)
- `[11/Feb/2026:14:23:15 +0000]` - Timestamp (Common Log Format)
- `"POST /api/bookings HTTP/1.1"` - Request method, path, protocol
- `201` - HTTP status (Created)
- `1234` - Response size in bytes
- `"https://looplane.onrender.com/book-ride"` - Referrer (previous page)
- `"Mozilla/5.0..."` - User agent (browser/device info)

---

#### **Development Console Output (dev format):**

```
POST /api/auth/login 200 156.234 ms - 456
GET /api/rides/active 200 45.123 ms - 3456
POST /api/bookings 201 234.567 ms - 1234
GET /api/users/profile 401 12.345 ms - 89
DELETE /api/bookings/123 404 8.901 ms - 67
GET /api/sos/emergencies 500 345.678 ms - 234
```

**Color coding in terminal:**
- Line 1: 🟢 Green (200 OK)
- Line 2: 🟢 Green (200 OK)
- Line 3: 🟢 Green (201 Created)
- Line 4: 🟡 Yellow (401 Unauthorized - auth issue)
- Line 5: 🟡 Yellow (404 Not Found - client error)
- Line 6: 🔴 Red (500 Internal Server Error - needs attention!)

---

### **🎛️ Middleware Stack Order**

**Current Position:** Lines 132-141 (after compression, before body parsers)

```javascript
app.use(helmet());              // Security headers
app.use(cors());                // Cross-origin
app.use(compression());         // Compress responses
app.use(cookieParser());        // Parse cookies
app.use(morgan(...));           // ← Log HTTP requests (early)
app.use(express.json());        // Parse JSON body
app.use(express.urlencoded());  // Parse URL-encoded body
app.use(mongoSanitize());       // NoSQL injection protection
app.use(xss());                 // XSS protection
app.use(hpp());                 // HPP protection
// ... routes ...
```

**Why this order matters:**
- **Before body parsers:** Logs raw request immediately (even if body parsing fails)
- **After security:** Lets helmet/CORS set headers first
- **Before routes:** Captures all requests including 404s
- Position is optimal ✅

---

### **💻 Custom Morgan Tokens** ([utils/logger.js](utils/logger.js#L39-L49))

```javascript
/**
 * Custom morgan token for response time in milliseconds
 */
const morganTokens = {
    'response-time-ms': (req, res) => {
        if (!req._startAt || !res._startAt) {
            return '-';
        }
        const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                   (res._startAt[1] - req._startAt[1]) * 1e-6;
        return ms.toFixed(3);
    }
};
```

**Purpose:** Define custom data to include in logs

**Usage (if you wanted to use it):**
```javascript
// Register custom token
morgan.token('response-time-ms', morganTokens['response-time-ms']);

// Use in custom format
app.use(morgan(':method :url :status :response-time-ms ms'));
```

**Output:**
```
GET /api/rides 200 45.234 ms
```

---

### **📈 Performance Impact**

#### **Logging Overhead:**
- **Console logging (dev):** ~0.5-1ms per request
- **File logging (production):** ~1-2ms per request
- **Rotating file stream:** Minimal (async writes)

#### **Disk I/O:**
- **Buffered writes:** Morgan doesn't block response
- **Async operations:** Logs written after response sent
- **Impact:** Negligible (<1% of response time)

---

### **🔍 Log Analysis Examples**

#### **Finding Slow Endpoints (Production):**
```bash
# Extract slow requests (>500ms)
cat logs/access.log | awk '{print $7, $9, $10}' | grep " 500 " | sort -k3 -rn | head -10
```

**Output:**
```
/api/chat/messages/123 200 1234ms
/api/rides/search 200 892ms
/api/reports/generate 200 645ms
```

#### **Error Rate Analysis:**
```bash
# Count 5xx errors
grep " 5[0-9][0-9] " logs/access.log | wc -l

# Find most common errors
grep " 5[0-9][0-9] " logs/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

**Output:**
```
45 /api/tracking/update
23 /api/sos/emergency
12 /api/bookings
```

#### **Traffic Patterns:**
```bash
# Requests per hour
awk '{print $4}' logs/access.log | cut -d: -f2 | sort | uniq -c
```

**Output:**
```
123 08 (8am)
456 09 (9am peak)
234 10 (10am)
```

---

### **🛠️ Advanced Configuration Options**

#### **Available Morgan Formats:**

```javascript
// If you wanted to customize further:

// 1. Custom format string
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 2. Custom function format
app.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), '
```


## License: MIT
https://github.com/swimmadude66/YTRadio/blob/9cdeec76687caf692a94237d3cde8560195a8599/src/server/app.ts

```
## **Morgan Middleware - Detailed Explanation**

### **📍 Where It's Used**

**Locations:** [server.js](server.js#L132-L141)

```javascript
// Line 19: Import
const morgan = require('morgan');

// Lines 131-141: Environment-specific logging
if (process.env.NODE_ENV === 'production') {
    // Production: log to rotating files
    app.use(morgan('combined', { 
        stream: accessLogStream,
        skip: shouldSkipLogging
    }));
} else {
    // Development: log to console
    app.use(morgan('dev', {
        skip: shouldSkipLogging
    }));
}
```

**Logger utilities:** [utils/logger.js](utils/logger.js#L1-L65)

---

### **🎯 Purpose**

Morgan is an **HTTP request logger** middleware that automatically logs:
- **Request details:** HTTP method, URL, status code
- **Response metadata:** Response time, content length
- **Client info:** IP address, user agent
- **Timestamps:** When requests occurred

**Benefits:**
- **Debugging:** Track down issues by reviewing request logs
- **Monitoring:** Identify slow endpoints and performance bottlenecks
- **Security:** Detect suspicious access patterns
- **Compliance:** Maintain audit trails for regulated systems

---

### **⚙️ Configuration**

### **Two Environments, Two Formats:**

#### **1. Production Environment** (Lines 132-135)

```javascript
app.use(morgan('combined', { 
    stream: accessLogStream,        // Write to rotating file
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'combined'` (Apache Combined Log Format)
```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Example Output:**
```
192.168.1.100 - - [11/Feb/2026:10:30:45 +0000] "GET /api/rides/active HTTP/1.1" 200 3456 "https://yourapp.com/dashboard" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
192.168.1.101 - - [11/Feb/2026:10:30:46 +0000] "POST /api/bookings HTTP/1.1" 201 892 "https://yourapp.com/book-ride" "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
192.168.1.102 - - [11/Feb/2026:10:30:47 +0000] "GET /api/chat/messages/123 HTTP/1.1" 200 15234 "-" "LoopLane-Mobile/1.2.0"
```

**Why `combined` for production:**
- ✅ **Detailed:** Includes referrer and user-agent for debugging
- ✅ **Standard:** Compatible with log analysis tools (AWStats, GoAccess, ELK)
- ✅ **Audit-ready:** Comprehensive information for security reviews

---

#### **2. Development Environment** (Lines 138-141)

```javascript
app.use(morgan('dev', {
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'dev'` (Colored, concise output)
```
:method :url :status :response-time ms - :res[content-length]
```

**Example Output (with color coding):**
```
GET /api/rides/active 200 45.234 ms - 3456
POST /api/bookings 201 123.567 ms - 892
GET /api/chat/messages/123 200 234.890 ms - 15234
DELETE /api/bookings/456 404 12.345 ms - 156
```

**Color Coding:**
- 🟢 **Green:** 2xx Success (200, 201, 204)
- 🔵 **Cyan:** 3xx Redirect (301, 302, 304)
- 🟡 **Yellow:** 4xx Client Error (400, 401, 404)
- 🔴 **Red:** 5xx Server Error (500, 502, 503)

**Why `dev` for development:**
- ✅ **Readable:** Clean, colored output for quick visual scanning
- ✅ **Concise:** Only essential info (no referrer/user-agent clutter)
- ✅ **Fast:** Easy to spot slow requests and errors at a glance

---

### **🔄 Log Stream Configuration** ([utils/logger.js](utils/logger.js#L19-L26))

#### **Production: Rotating File Stream**

```javascript
const rfs = require('rotating-file-stream');

// Create rotating write stream for access logs
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',      // Rotate daily (creates new file each day)
    maxFiles: 14,        // Keep 14 days of logs (auto-delete older)
    compress: 'gzip',    // Compress rotated files (.gz to save space)
    path: logsDir        // Store in /logs directory
});
```

**File Structure:**
```
logs/
├── access.log             ← Current day's logs (active)
├── access.log.1.gz        ← Yesterday (compressed)
├── access.log.2.gz        ← 2 days ago
├── access.log.3.gz        ← 3 days ago
...
└── access.log.14.gz       ← 14 days ago (oldest kept)
```

**Automatic Behavior:**
- **Daily rotation:** At midnight, `access.log` → `access.log.1.gz`, new `access.log` created
- **Compression:** Saves ~90% disk space (100MB → 10MB)
- **Auto-cleanup:** Files older than 14 days automatically deleted
- **Zero downtime:** Rotation happens seamlessly while server runs

**Disk Usage Example:**
```
Daily average: 50 MB uncompressed
After compression: 5 MB × 14 days = 70 MB total
Without rotation: 50 MB × 30 days = 1.5 GB
Savings: 95%+ disk space
```

---

### **🚫 Skip Logging Function** ([utils/logger.js](utils/logger.js#L54-L59))

```javascript
const skipPaths = ['/health', '/favicon.ico'];

const shouldSkipLogging = (req) => {
    return skipPaths.some(path => req.url.startsWith(path));
};
```

**Purpose:** Exclude noisy, low-value requests from logs

**Skipped Paths:**
1. **`/health`** - Health check endpoint (hits every 10 seconds by monitoring tools)
2. **`/favicon.ico`** - Browser automatically requests this (not an API call)

**Example Impact:**
```
Without skip:
- 8,640 health checks/day (every 10s)
- ~500 favicon requests/day
- Total: 9,140 useless log entries/day

With skip:
- Only real API requests logged
- Cleaner logs, easier to find issues
```

---

### **📊 Log Format Comparison**

| Format | Use Case | Output Style | Info Included |
|--------|----------|--------------|---------------|
| **combined** | Production | Standard Apache format | IP, timestamp, method, URL, status, size, referrer, user-agent |
| **dev** | Development | Colored, concise | Method, URL, status, response time, size |
| **common** | Basic production | Apache Common Log | Like combined but no referrer/user-agent |
| **short** | Minimal logging | Brief format | IP, method, URL, status, size, response time |
| **tiny** | Ultra-minimal | One-liner | Method, URL, status, size, response time |

---

### **🔍 Real-World Examples from Your App**

#### **Production Log Entry (combined format):**

```
192.168.1.50 - - [11/Feb/2026:14:23:15 +0000] "POST /api/bookings HTTP/1.1" 201 1234 "https://looplane.onrender.com/book-ride" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Breaking it down:**
- `192.168.1.50` - Client IP address
- `-` - Remote user (not used)
- `-` - Authenticated user (could show JWT userId if logged)
- `[11/Feb/2026:14:23:15 +0000]` - Timestamp (Common Log Format)
- `"POST /api/bookings HTTP/1.1"` - Request method, path, protocol
- `201` - HTTP status (Created)
- `1234` - Response size in bytes
- `"https://looplane.onrender.com/book-ride"` - Referrer (previous page)
- `"Mozilla/5.0..."` - User agent (browser/device info)

---

#### **Development Console Output (dev format):**

```
POST /api/auth/login 200 156.234 ms - 456
GET /api/rides/active 200 45.123 ms - 3456
POST /api/bookings 201 234.567 ms - 1234
GET /api/users/profile 401 12.345 ms - 89
DELETE /api/bookings/123 404 8.901 ms - 67
GET /api/sos/emergencies 500 345.678 ms - 234
```

**Color coding in terminal:**
- Line 1: 🟢 Green (200 OK)
- Line 2: 🟢 Green (200 OK)
- Line 3: 🟢 Green (201 Created)
- Line 4: 🟡 Yellow (401 Unauthorized - auth issue)
- Line 5: 🟡 Yellow (404 Not Found - client error)
- Line 6: 🔴 Red (500 Internal Server Error - needs attention!)

---

### **🎛️ Middleware Stack Order**

**Current Position:** Lines 132-141 (after compression, before body parsers)

```javascript
app.use(helmet());              // Security headers
app.use(cors());                // Cross-origin
app.use(compression());         // Compress responses
app.use(cookieParser());        // Parse cookies
app.use(morgan(...));           // ← Log HTTP requests (early)
app.use(express.json());        // Parse JSON body
app.use(express.urlencoded());  // Parse URL-encoded body
app.use(mongoSanitize());       // NoSQL injection protection
app.use(xss());                 // XSS protection
app.use(hpp());                 // HPP protection
// ... routes ...
```

**Why this order matters:**
- **Before body parsers:** Logs raw request immediately (even if body parsing fails)
- **After security:** Lets helmet/CORS set headers first
- **Before routes:** Captures all requests including 404s
- Position is optimal ✅

---

### **💻 Custom Morgan Tokens** ([utils/logger.js](utils/logger.js#L39-L49))

```javascript
/**
 * Custom morgan token for response time in milliseconds
 */
const morganTokens = {
    'response-time-ms': (req, res) => {
        if (!req._startAt || !res._startAt) {
            return '-';
        }
        const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                   (res._startAt[1] - req._startAt[1]) * 1e-6;
        return ms.toFixed(3);
    }
};
```

**Purpose:** Define custom data to include in logs

**Usage (if you wanted to use it):**
```javascript
// Register custom token
morgan.token('response-time-ms', morganTokens['response-time-ms']);

// Use in custom format
app.use(morgan(':method :url :status :response-time-ms ms'));
```

**Output:**
```
GET /api/rides 200 45.234 ms
```

---

### **📈 Performance Impact**

#### **Logging Overhead:**
- **Console logging (dev):** ~0.5-1ms per request
- **File logging (production):** ~1-2ms per request
- **Rotating file stream:** Minimal (async writes)

#### **Disk I/O:**
- **Buffered writes:** Morgan doesn't block response
- **Async operations:** Logs written after response sent
- **Impact:** Negligible (<1% of response time)

---

### **🔍 Log Analysis Examples**

#### **Finding Slow Endpoints (Production):**
```bash
# Extract slow requests (>500ms)
cat logs/access.log | awk '{print $7, $9, $10}' | grep " 500 " | sort -k3 -rn | head -10
```

**Output:**
```
/api/chat/messages/123 200 1234ms
/api/rides/search 200 892ms
/api/reports/generate 200 645ms
```

#### **Error Rate Analysis:**
```bash
# Count 5xx errors
grep " 5[0-9][0-9] " logs/access.log | wc -l

# Find most common errors
grep " 5[0-9][0-9] " logs/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

**Output:**
```
45 /api/tracking/update
23 /api/sos/emergency
12 /api/bookings
```

#### **Traffic Patterns:**
```bash
# Requests per hour
awk '{print $4}' logs/access.log | cut -d: -f2 | sort | uniq -c
```

**Output:**
```
123 08 (8am)
456 09 (9am peak)
234 10 (10am)
```

---

### **🛠️ Advanced Configuration Options**

#### **Available Morgan Formats:**

```javascript
// If you wanted to customize further:

// 1. Custom format string
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 2. Custom function format
app.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), '
```


## License: MIT
https://github.com/swimmadude66/YTRadio/blob/9cdeec76687caf692a94237d3cde8560195a8599/src/server/app.ts

```
## **Morgan Middleware - Detailed Explanation**

### **📍 Where It's Used**

**Locations:** [server.js](server.js#L132-L141)

```javascript
// Line 19: Import
const morgan = require('morgan');

// Lines 131-141: Environment-specific logging
if (process.env.NODE_ENV === 'production') {
    // Production: log to rotating files
    app.use(morgan('combined', { 
        stream: accessLogStream,
        skip: shouldSkipLogging
    }));
} else {
    // Development: log to console
    app.use(morgan('dev', {
        skip: shouldSkipLogging
    }));
}
```

**Logger utilities:** [utils/logger.js](utils/logger.js#L1-L65)

---

### **🎯 Purpose**

Morgan is an **HTTP request logger** middleware that automatically logs:
- **Request details:** HTTP method, URL, status code
- **Response metadata:** Response time, content length
- **Client info:** IP address, user agent
- **Timestamps:** When requests occurred

**Benefits:**
- **Debugging:** Track down issues by reviewing request logs
- **Monitoring:** Identify slow endpoints and performance bottlenecks
- **Security:** Detect suspicious access patterns
- **Compliance:** Maintain audit trails for regulated systems

---

### **⚙️ Configuration**

### **Two Environments, Two Formats:**

#### **1. Production Environment** (Lines 132-135)

```javascript
app.use(morgan('combined', { 
    stream: accessLogStream,        // Write to rotating file
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'combined'` (Apache Combined Log Format)
```
:remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"
```

**Example Output:**
```
192.168.1.100 - - [11/Feb/2026:10:30:45 +0000] "GET /api/rides/active HTTP/1.1" 200 3456 "https://yourapp.com/dashboard" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
192.168.1.101 - - [11/Feb/2026:10:30:46 +0000] "POST /api/bookings HTTP/1.1" 201 892 "https://yourapp.com/book-ride" "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)"
192.168.1.102 - - [11/Feb/2026:10:30:47 +0000] "GET /api/chat/messages/123 HTTP/1.1" 200 15234 "-" "LoopLane-Mobile/1.2.0"
```

**Why `combined` for production:**
- ✅ **Detailed:** Includes referrer and user-agent for debugging
- ✅ **Standard:** Compatible with log analysis tools (AWStats, GoAccess, ELK)
- ✅ **Audit-ready:** Comprehensive information for security reviews

---

#### **2. Development Environment** (Lines 138-141)

```javascript
app.use(morgan('dev', {
    skip: shouldSkipLogging         // Skip certain paths
}));
```

**Format:** `'dev'` (Colored, concise output)
```
:method :url :status :response-time ms - :res[content-length]
```

**Example Output (with color coding):**
```
GET /api/rides/active 200 45.234 ms - 3456
POST /api/bookings 201 123.567 ms - 892
GET /api/chat/messages/123 200 234.890 ms - 15234
DELETE /api/bookings/456 404 12.345 ms - 156
```

**Color Coding:**
- 🟢 **Green:** 2xx Success (200, 201, 204)
- 🔵 **Cyan:** 3xx Redirect (301, 302, 304)
- 🟡 **Yellow:** 4xx Client Error (400, 401, 404)
- 🔴 **Red:** 5xx Server Error (500, 502, 503)

**Why `dev` for development:**
- ✅ **Readable:** Clean, colored output for quick visual scanning
- ✅ **Concise:** Only essential info (no referrer/user-agent clutter)
- ✅ **Fast:** Easy to spot slow requests and errors at a glance

---

### **🔄 Log Stream Configuration** ([utils/logger.js](utils/logger.js#L19-L26))

#### **Production: Rotating File Stream**

```javascript
const rfs = require('rotating-file-stream');

// Create rotating write stream for access logs
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d',      // Rotate daily (creates new file each day)
    maxFiles: 14,        // Keep 14 days of logs (auto-delete older)
    compress: 'gzip',    // Compress rotated files (.gz to save space)
    path: logsDir        // Store in /logs directory
});
```

**File Structure:**
```
logs/
├── access.log             ← Current day's logs (active)
├── access.log.1.gz        ← Yesterday (compressed)
├── access.log.2.gz        ← 2 days ago
├── access.log.3.gz        ← 3 days ago
...
└── access.log.14.gz       ← 14 days ago (oldest kept)
```

**Automatic Behavior:**
- **Daily rotation:** At midnight, `access.log` → `access.log.1.gz`, new `access.log` created
- **Compression:** Saves ~90% disk space (100MB → 10MB)
- **Auto-cleanup:** Files older than 14 days automatically deleted
- **Zero downtime:** Rotation happens seamlessly while server runs

**Disk Usage Example:**
```
Daily average: 50 MB uncompressed
After compression: 5 MB × 14 days = 70 MB total
Without rotation: 50 MB × 30 days = 1.5 GB
Savings: 95%+ disk space
```

---

### **🚫 Skip Logging Function** ([utils/logger.js](utils/logger.js#L54-L59))

```javascript
const skipPaths = ['/health', '/favicon.ico'];

const shouldSkipLogging = (req) => {
    return skipPaths.some(path => req.url.startsWith(path));
};
```

**Purpose:** Exclude noisy, low-value requests from logs

**Skipped Paths:**
1. **`/health`** - Health check endpoint (hits every 10 seconds by monitoring tools)
2. **`/favicon.ico`** - Browser automatically requests this (not an API call)

**Example Impact:**
```
Without skip:
- 8,640 health checks/day (every 10s)
- ~500 favicon requests/day
- Total: 9,140 useless log entries/day

With skip:
- Only real API requests logged
- Cleaner logs, easier to find issues
```

---

### **📊 Log Format Comparison**

| Format | Use Case | Output Style | Info Included |
|--------|----------|--------------|---------------|
| **combined** | Production | Standard Apache format | IP, timestamp, method, URL, status, size, referrer, user-agent |
| **dev** | Development | Colored, concise | Method, URL, status, response time, size |
| **common** | Basic production | Apache Common Log | Like combined but no referrer/user-agent |
| **short** | Minimal logging | Brief format | IP, method, URL, status, size, response time |
| **tiny** | Ultra-minimal | One-liner | Method, URL, status, size, response time |

---

### **🔍 Real-World Examples from Your App**

#### **Production Log Entry (combined format):**

```
192.168.1.50 - - [11/Feb/2026:14:23:15 +0000] "POST /api/bookings HTTP/1.1" 201 1234 "https://looplane.onrender.com/book-ride" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
```

**Breaking it down:**
- `192.168.1.50` - Client IP address
- `-` - Remote user (not used)
- `-` - Authenticated user (could show JWT userId if logged)
- `[11/Feb/2026:14:23:15 +0000]` - Timestamp (Common Log Format)
- `"POST /api/bookings HTTP/1.1"` - Request method, path, protocol
- `201` - HTTP status (Created)
- `1234` - Response size in bytes
- `"https://looplane.onrender.com/book-ride"` - Referrer (previous page)
- `"Mozilla/5.0..."` - User agent (browser/device info)

---

#### **Development Console Output (dev format):**

```
POST /api/auth/login 200 156.234 ms - 456
GET /api/rides/active 200 45.123 ms - 3456
POST /api/bookings 201 234.567 ms - 1234
GET /api/users/profile 401 12.345 ms - 89
DELETE /api/bookings/123 404 8.901 ms - 67
GET /api/sos/emergencies 500 345.678 ms - 234
```

**Color coding in terminal:**
- Line 1: 🟢 Green (200 OK)
- Line 2: 🟢 Green (200 OK)
- Line 3: 🟢 Green (201 Created)
- Line 4: 🟡 Yellow (401 Unauthorized - auth issue)
- Line 5: 🟡 Yellow (404 Not Found - client error)
- Line 6: 🔴 Red (500 Internal Server Error - needs attention!)

---

### **🎛️ Middleware Stack Order**

**Current Position:** Lines 132-141 (after compression, before body parsers)

```javascript
app.use(helmet());              // Security headers
app.use(cors());                // Cross-origin
app.use(compression());         // Compress responses
app.use(cookieParser());        // Parse cookies
app.use(morgan(...));           // ← Log HTTP requests (early)
app.use(express.json());        // Parse JSON body
app.use(express.urlencoded());  // Parse URL-encoded body
app.use(mongoSanitize());       // NoSQL injection protection
app.use(xss());                 // XSS protection
app.use(hpp());                 // HPP protection
// ... routes ...
```

**Why this order matters:**
- **Before body parsers:** Logs raw request immediately (even if body parsing fails)
- **After security:** Lets helmet/CORS set headers first
- **Before routes:** Captures all requests including 404s
- Position is optimal ✅

---

### **💻 Custom Morgan Tokens** ([utils/logger.js](utils/logger.js#L39-L49))

```javascript
/**
 * Custom morgan token for response time in milliseconds
 */
const morganTokens = {
    'response-time-ms': (req, res) => {
        if (!req._startAt || !res._startAt) {
            return '-';
        }
        const ms = (res._startAt[0] - req._startAt[0]) * 1e3 +
                   (res._startAt[1] - req._startAt[1]) * 1e-6;
        return ms.toFixed(3);
    }
};
```

**Purpose:** Define custom data to include in logs

**Usage (if you wanted to use it):**
```javascript
// Register custom token
morgan.token('response-time-ms', morganTokens['response-time-ms']);

// Use in custom format
app.use(morgan(':method :url :status :response-time-ms ms'));
```

**Output:**
```
GET /api/rides 200 45.234 ms
```

---

### **📈 Performance Impact**

#### **Logging Overhead:**
- **Console logging (dev):** ~0.5-1ms per request
- **File logging (production):** ~1-2ms per request
- **Rotating file stream:** Minimal (async writes)

#### **Disk I/O:**
- **Buffered writes:** Morgan doesn't block response
- **Async operations:** Logs written after response sent
- **Impact:** Negligible (<1% of response time)

---

### **🔍 Log Analysis Examples**

#### **Finding Slow Endpoints (Production):**
```bash
# Extract slow requests (>500ms)
cat logs/access.log | awk '{print $7, $9, $10}' | grep " 500 " | sort -k3 -rn | head -10
```

**Output:**
```
/api/chat/messages/123 200 1234ms
/api/rides/search 200 892ms
/api/reports/generate 200 645ms
```

#### **Error Rate Analysis:**
```bash
# Count 5xx errors
grep " 5[0-9][0-9] " logs/access.log | wc -l

# Find most common errors
grep " 5[0-9][0-9] " logs/access.log | awk '{print $7}' | sort | uniq -c | sort -rn
```

**Output:**
```
45 /api/tracking/update
23 /api/sos/emergency
12 /api/bookings
```

#### **Traffic Patterns:**
```bash
# Requests per hour
awk '{print $4}' logs/access.log | cut -d: -f2 | sort | uniq -c
```

**Output:**
```
123 08 (8am)
456 09 (9am peak)
234 10 (10am)
```

---

### **🛠️ Advanced Configuration Options**

#### **Available Morgan Formats:**

```javascript
// If you wanted to customize further:

// 1. Custom format string
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// 2. Custom function format
app.use(morgan((tokens, req, res) => {
    return [
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens['response-time'](req, res), '
```

