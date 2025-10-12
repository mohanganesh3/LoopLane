# 🚀 Quick README Template

**Use this template for future project submissions**

---

## 📋 Project Information

**Group ID:** `39`  
**Project Title:** `LoopLane - Advanced Carpooling Platform`  
**Submission Type:** `Mid-Review`  
**Date:** `October 12, 2025`

---

## 👤 SPOC (Single Point of Contact)

**Name:** `Mohan Ganesh`  
**Roll Number:** `S20230010092`  
**Email:** `mohanganesh.g23@iiits.in` 

---

## 👥 Team Members & Roles

| Name | Roll Number | Email | Primary Responsibilities |
|------|-------------|-------|--------------------------|
| **Mohan Ganesh** | S20230010092 | mohanganesh165577@gmail.com | Server setup, Admin panel, SOS, Geofencing, Safety features, Carbon calculator |
| Karthik | S20230010005 | karthikagisam353570@gmail.com | Rider profile management, Ride posting features |
| Dinesh | S20230010152 | mudedineshnaik7@gmail.com | Complete authentication (Login/Register/OTP), Home page, Rider & Passenger onboarding |
| Akshaya | S20230010006 | akshaya.aienavolu@gmail.com | Complete booking flow from ride start to payment |
| Sujal | S20230010232 | sujalpcmb123@gmail.com | Ride search functionality, Passenger profile management |

---

## 🛠️ How to Run Locally

### Prerequisites

```
- Node.js: v18.0.0 or higher
- MongoDB: v7.0.0 or higher
- npm: v9.0.0 or higher
- Git: Latest version
```

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/mohanganesh3/LANE
   cd LANE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration:
   # - MONGODB_URI=mongodb://localhost:27017/lane
   # - SESSION_SECRET=your_session_secret_key
   # - TWILIO_ACCOUNT_SID=your_twilio_account_sid
   # - TWILIO_AUTH_TOKEN=your_twilio_auth_token
   # - TWILIO_PHONE_NUMBER=your_twilio_phone_number
   # - CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   # - CLOUDINARY_API_KEY=your_cloudinary_api_key
   # - CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   # - EMAIL_USER=your_email@gmail.com
   # - EMAIL_PASS=your_app_password
   ```

4. **Start the database**
   ```bash
   # macOS
   brew services start mongodb-community@7.0
   
   # Linux
   sudo systemctl start mongod
   
   # Windows
   net start MongoDB
   ```

5. **Seed database (optional)**
   ```bash
   npm run seed:admin
   # or
   node seed.js
   ```

6. **Start the application**
   ```bash
   npm start
   # or
   npm run dev  # for development mode
   ```

7. **Access the application**
   - Homepage: `http://localhost:3000`
   - Admin Panel: `http://localhost:3000/admin`
   - API: `http://localhost:3000/api`

### Default Credentials (if applicable)

```
Admin:
- Email: admin@lane.com
- Password: Admin@123

Test Rider:
- Email: rider@test.com
- Password: Rider@123

Test Passenger:
- Email: passenger@test.com
- Password: Passenger@123
```

---

## 📁 Key Files and Functions

### 1. Client-Side Validation

**Purpose:** Form validation before submission

**Files:**
- `public/js/main.js` - Main validation logic
- `middleware/validation.js` - Server-side validation rules
- `public/js/permissions.js` - Permission handling

**Key Functions:**
```javascript
// Client-side validation examples from public/js/main.js
validateRegistrationForm()  // Validates user registration
validateLoginForm()         // Validates login credentials
validateRideForm()          // Validates ride posting data
validateBookingForm()       // Validates booking details
```

**Validation Rules:**
- Email: Valid email format, required, unique
- Password: Min 8 chars, uppercase, lowercase, number, special char
- Phone: 10 digits, Indian format (+91)
- License: Alphanumeric, 10-16 characters
- Vehicle Number: Valid Indian vehicle registration format

---

### 2. Dynamic Operations (AJAX/Fetch)

**Purpose:** Asynchronous data loading without page refresh (Uses XMLHttpRequest - XHR)

**Files:**
- `public/js/main.js` - AJAX/XHR request handlers
- `views/rides/partials/searchResults.ejs` - Partial rendering template
- `controllers/authController.js` - Backend auth handlers
- `controllers/rideController.js` - Backend ride handlers

**Key Operations:**

#### Login (AJAX/XHR)
```javascript
// File: public/js/main.js
function handleLogin(event) {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/auth/login');
    // XHR POST to /auth/login
    // Shows validation errors dynamically
}
```

#### Search (AJAX with Partial Rendering)
```javascript
// File: public/js/main.js (ride search page)
function searchRides() {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/rides/search?from=...&to=...');
    // XHR GET to /rides/search
    // Renders results in <div id="searchResults">
    // No page reload - partial EJS rendering
}
```

#### Form Submission (AJAX)
```javascript
// File: public/js/main.js
function submitRideForm() {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/rides/post');
    // XHR POST to /rides/post
    // Success/error handling without reload
}
```

**AJAX Endpoints:**
- `POST /auth/login` - User authentication (XHR)
- `POST /auth/register` - User registration (XHR)
- `POST /auth/verify-otp` - OTP verification (XHR)
- `GET /rides/search` - Dynamic search with partial rendering (XHR)
- `POST /rides/post` - Create ride (XHR)
- `PUT /admin/verify/:userId` - Admin approval (XHR)
- `POST /admin/reject/:userId` - Admin rejection (XHR)
- `DELETE /rides/:id` - Delete ride (XHR)

---

### 3. External API Integration

**Purpose:** Third-party service integration

**Files:**
- `utils/smsService.js` - Twilio SMS wrapper
- `utils/emailService.js` - Nodemailer email service
- `config/cloudinary.js` - Cloudinary image storage
- `controllers/apiController.js` - External API endpoints

**APIs Used:**

#### API 1: Twilio SMS/OTP Service
```javascript
// File: utils/smsService.js
async function sendOTP(phoneNumber, otp) {
    await twilioClient.messages.create({
        body: `Your LoopLane OTP is: ${otp}`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
    });
}
```
**Purpose:** Send SMS OTP for phone verification and emergency alerts  
**Documentation:** https://www.twilio.com/docs/sms

#### API 2: Cloudinary Image Storage
```javascript
// File: middleware/upload.js
const cloudinary = require('cloudinary').v2;
// Uploads vehicle photos and documents
// Returns secure URLs for storage
```
**Purpose:** Store and manage vehicle photos, documents, and profile images  
**Documentation:** https://cloudinary.com/documentation

#### API 3: Nodemailer Email Service
```javascript
// File: utils/emailService.js
async function sendWelcomeEmail(userEmail, userName) {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: userEmail,
        subject: 'Welcome to LoopLane',
        html: emailTemplate
    });
}
```
**Purpose:** Send welcome emails, booking confirmations, and password reset links  
**Documentation:** https://nodemailer.com/about/

#### API 4: OpenStreetMap Nominatim (Geocoding)
```javascript
// File: controllers/apiController.js
async function geocodeAddress(address) {
    const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${address}&format=json`
    );
    return response.json();
}
```
**Purpose:** Convert addresses to coordinates for geolocation and route matching  
**Documentation:** https://nominatim.org/release-docs/latest/api/Search/

**Environment Variables Required:**
```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_app_password
```

---

## 🎥 Demo Video

**Video Link:** `[TO BE ADDED - YouTube/Google Drive URL]`

**Video Duration:** `15-18` minutes

### Timestamps

| Time | Feature/Section | Developer |
|------|----------------|-----------|
| `0:00 - 1:00` | Introduction & Project Overview | All Members |
| `1:00 - 2:30` | Registration with Client Validation | Dinesh |
| `2:30 - 4:00` | Login with AJAX (XHR) | Dinesh |
| `4:00 - 5:30` | OTP Verification via Twilio | Dinesh |
| `5:30 - 7:00` | Post Ride with AJAX | Karthik |
| `7:00 - 8:30` | Dynamic Search with Partial Rendering | Sujal |
| `8:30 - 9:30` | Ride Booking Flow | Akshaya |
| `9:30 - 10:30` | Payment Integration | Akshaya |
| `10:30 - 11:30` | Real-time GPS Tracking (Socket.IO) | Mohan |
| `11:30 - 12:30` | SOS Emergency System | Mohan |
| `12:30 - 13:30` | Admin Panel with XHR Operations | Mohan |
| `13:30 - 14:30` | Carbon Footprint Calculator | Mohan |
| `14:30 - 15:30` | Network Tab Evidence (XHR Requests) | All Members |
| `15:30 - 17:00` | Database & API Integration Demo | All Members |
| `17:00 - 18:00` | Conclusion & Q&A | All Members |

**Important:** Ensure to show:
- ✅ Browser Developer Tools (Network tab)
- ✅ XHR/Fetch requests in action
- ✅ Request/Response payloads
- ✅ Validation error messages
- ✅ Partial page updates (no full reload)
- ✅ External API calls
- ✅ Database operations

---

## 📸 Evidence Locations

### Network Evidence Screenshots

**Location:** `network_evidence/`

**Required Screenshots:**

1. **Authentication** (`network_evidence/1-authentication/`)
   - `login-xhr.png` - Login XHR request
   - `register-xhr.png` - Registration XHR request
   - `validation-error.png` - Client-side validation

2. **Dynamic Operations** (`network_evidence/2-dynamic/`)
   - `search-ajax.png` - Search AJAX request
   - `partial-render.png` - Partial page update
   - `form-submit-xhr.png` - Form submission XHR

3. **API Integration** (`network_evidence/3-api/`)
   - `external-api-call.png` - External API request
   - `api-response.png` - API response data
   - `api-error-handling.png` - API error handling

4. **Admin Panel** (`network_evidence/4-admin/`)
   - `admin-approve-xhr.png` - Approval XHR
   - `admin-reject-xhr.png` - Rejection XHR
   - `admin-dashboard-load.png` - Dashboard data loading

5. **Validation** (`network_evidence/5-validation/`)
   - `client-validation.png` - Client-side validation
   - `server-validation.png` - Server-side validation
   - `validation-response.png` - Validation error response

**Screenshot Guidelines:**
- Resolution: 1920x1080 or higher
- Format: PNG (high quality)
- Show: Full browser with DevTools Network tab open
- Highlight: XHR/Fetch requests in red/yellow
- Annotate: Add arrows/labels if needed

---

### Git Logs

**Location:** `git-logs.txt`

**Contents:**
- Complete commit history
- Commits filtered by each team member
- Contribution statistics
- Branch strategy

**How to Generate:**
```bash
# All commits
git log --pretty=format:"%h - %an, %ar : %s" > git-logs.txt

# Commits by specific author
git log --author="<author-name>" --oneline >> git-logs.txt

# Statistics
git shortlog -sn >> git-logs.txt
```

---

### Test Plan

**Location:** `test_plan.md`

**Contents:**
- Test cases for all features
- Validation test cases
- AJAX operation test cases
- API integration test cases
- Test results (Pass/Fail)
- Test execution evidence

**Total Test Cases:** `124` *(Target: 100+)*  
**Pass Rate:** `100%` *(Target: 95%+)*

---

### Database Schema

**Location:** `database_schema.md`

**Contents:**
- All collection/table definitions
- Field types and validations
- Relationships and references
- Indexes
- Sample documents/records

---

### Source Code

**Location:** `source/`

**Structure:**
```
source/
├── config/          # Configuration files
├── controllers/     # Request handlers
├── models/          # Database models
├── routes/          # API routes
├── middleware/      # Custom middleware
├── utils/           # Utility functions
├── views/           # Frontend templates
├── public/          # Static assets
│   ├── css/
│   ├── js/
│   └── images/
├── package.json     # Dependencies
├── server.js        # Entry point
└── README.md        # This file
```

---

## 📊 Project Statistics

**Development Period:** `September 12, 2025` to `October 13, 2025` (31 days)  
**Total Commits:** `42`  
**Team Size:** `5` members  
**Lines of Code:** `~12,000+` lines  
**Files:** `197` files (excluding node_modules)  
**Technologies:** `15+` technologies  

**Contribution Breakdown:**
- Mohan Ganesh: `18` commits (`42.9%`)
- Karthik: `9` commits (`21.4%`)
- Dinesh: `7` commits (`16.7%`)
- Sujal: `6` commits (`14.3%`)
- Akshaya: `3` commits (`7.1%`)

---

## 🔧 Technologies Used

### Backend
- **Runtime:** Node.js v18+
- **Framework:** Express.js v4.18.2
- **Database:** MongoDB v7.6.3
- **ORM:** Mongoose v8.5.2
- **Authentication:** express-session + bcryptjs
- **Real-time:** Socket.IO v4.7.2

### Frontend
- **Template Engine:** EJS v3.1.9
- **Styling:** CSS3 + Bootstrap 5
- **JavaScript:** Vanilla JavaScript (ES6+)
- **AJAX:** XMLHttpRequest (XHR) - No Fetch API

### External Services
- **SMS/OTP:** Twilio v5.2.2 - Phone verification and emergency alerts
- **Email:** Nodemailer v6.9.14 - Welcome emails, notifications, password reset
- **Storage:** Cloudinary v2.4.0 - Vehicle photos and document storage
- **Geocoding:** OpenStreetMap Nominatim - Address to coordinates conversion
- **Maps:** Leaflet.js - Interactive maps for tracking

### Development Tools
- **Version Control:** Git + GitHub
- **Package Manager:** npm
- **Process Manager:** nodemon v3.1.4
- **Validation:** express-validator v7.1.0
- **Security:** helmet v7.1.0, express-rate-limit v7.4.0

---

## ✅ Submission Checklist

Before submitting, ensure:

- [ ] All source code is included (excluding node_modules)
- [ ] README with complete instructions
- [ ] Git logs with filtered commits
- [ ] Test plan with results
- [ ] Task assignment with roles
- [ ] Demo video uploaded with timestamps
- [ ] Network screenshots captured
- [ ] Database schema documented
- [ ] .env.example provided (not .env)
- [ ] Package.json with all dependencies
- [ ] Application runs on fresh installation
- [ ] All validation rules documented
- [ ] All AJAX operations documented
- [ ] All API integrations documented
- [ ] Proper naming: `group<id>_<title>_<type>.zip`

---

## 🚨 Common Issues & Solutions

### Issue 1: Dependencies not installing
**Solution:**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue 2: Database connection error
**Solution:**
- Check MongoDB is running: `brew services list | grep mongodb`
- Verify connection string in .env
- Ensure port 27017 is not blocked

### Issue 3: Port already in use
**Solution:**
```bash
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Using npx
npx kill-port 3000
```

### Issue 4: Environment variables not loading
**Solution:**
- Ensure .env file exists in root directory
- Install dotenv: `npm install dotenv`
- Load in entry file: `require('dotenv').config()`

---

## 📞 Contact Information

**For questions or issues, contact:**

**SPOC:** `Mohan Ganesh`  
**Email:** `mohanganesh165577@gmail.com`  
**Phone:** `+91 XXXXX XXXXX`  
**GitHub:** `https://github.com/mohanganesh3/CreaPrompt_Studio`

**Team Members:**
1. Mohan Ganesh (S20230010092) - mohanganesh165577@gmail.com
2. Karthik (S20230010005) - karthikagisam353570@gmail.com
3. Dinesh (S20230010152) - mudedineshnaik7@gmail.com
4. Akshaya (S20230010006) - akshaya.aienavolu@gmail.com
5. Sujal (S20230010232) - sujalpcmb123@gmail.com

---

## 📄 License

MIT License - See LICENSE file for details

---

## 🙏 Acknowledgments

- Course Instructor: `[Course Instructor Name]`
- Teaching Assistants: `[TA Names]`
- External APIs: Twilio, Cloudinary, Nodemailer, OpenStreetMap Nominatim
- Libraries & Frameworks: Express.js, Socket.IO, Mongoose, EJS, Bootstrap

---

**End of README**

---

**Package Name:** group39_looplane_midreview.zip  
**Group ID:** 39  
**Project Name:** LoopLane - Advanced Carpooling Platform  
**Submission Type:** Mid-Review Assessment  
**Date:** October 13, 2025  

**Package Prepared By:**  
Group 39 - LoopLane Team  
All 5 members contributed to this submission

**Template Version:** 1.0 (Filled)  
**Last Updated:** October 13, 2025  
**Repository:** https://github.com/mohanganesh3/CreaPrompt_Studio
