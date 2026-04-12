/**
 * Swagger / OpenAPI 3.0 Configuration
 * Central spec definition for LoopLane API documentation
 */

const swaggerJSDoc = require('swagger-jsdoc');
const path = require('path');

// Endpoints that can be hidden from Swagger UI (routes still exist).
// NOTE: Hiding is opt-in via SWAGGER_HIDE_PATHS=true. By default we expose all endpoints
// so Swagger coverage reflects the full API surface.
const HIDDEN_SWAGGER_PATHS = new Set([
    // Social
    '/api/social/sync/{provider}',

    // Rides
    '/api/rides/nearby',
    '/api/rides/recommendations',
    '/api/rides/recurring',

    // Corporate
    '/api/corporate/dashboard',
    '/api/corporate/esg-report',
    '/api/corporate/locations',
    '/api/corporate/enroll',

    // Geocoding & Notifications (External API)
    '/api/autocomplete',
    '/api/distance-matrix',
    '/api/eta',
    '/api/geocode',
    '/api/reverse-geocode',
    '/api/route',
    '/api/snap-to-road',

    // Notifications (External API)
    '/api/notifications',
    '/api/notifications/all',
    '/api/notifications/count',
    '/api/notifications/mark-all-read',
    '/api/notifications/{notificationId}',
    '/api/notifications/{notificationId}/read',

    // Users (External API)
    '/api/users/account',
    '/api/users/change-password',
    '/api/users/profile',

    // Admin — Reports & Emergencies
    '/api/admin/analytics/churn-predict',
    '/api/admin/analytics/fraud-detect',
    '/api/admin/emergencies',
    '/api/admin/emergencies/{emergencyId}/resolve',
    '/api/admin/reports',
    '/api/admin/reports/{reportId}',
    '/api/admin/reports/{reportId}/action',
    '/api/admin/reports/{reportId}/message',
    '/api/admin/reports/{reportId}/playbook',
    '/api/admin/reports/{reportId}/timeline',
    '/api/admin/safety-metrics',

    // Admin — Requested removals
    '/api/admin/analytics/rides',
    '/api/admin/analytics/trigger-batch-match',
    '/api/admin/promo-codes',
    '/api/admin/promo-codes/{id}',
    '/api/admin/promo-codes/{id}/toggle',
    '/api/admin/settings',
    '/api/admin/settings/audit',
    '/api/admin/sustainability',
    '/api/admin/notifications/bulk',

    // Admin — AI
    '/api/admin/ai/insights',
    '/api/admin/ai/batch-insights',
    '/api/admin/ai/explain-anomaly',
    '/api/admin/ai/dashboard-narrative',
    '/api/admin/ai/chat',
    '/api/admin/ai/chat/stream',
    '/api/admin/ai/chat/history',
    '/api/admin/ai/chat/suggestions',

    // SOS admin endpoints
    '/api/sos/admin/active',
    '/api/sos/admin/all',
    '/api/sos/admin/stats',
    '/api/sos/admin/{emergencyId}/update',
    '/api/sos/admin/{emergencyId}/escalate',

    // Previously hidden endpoint batches
    '/api/admin/export',
    '/api/admin/payments/simulate',
    '/api/admin/bookings/{bookingId}/refund',
    '/api/admin/reports/{reportId}/refund',
    '/api/admin/settlements/batch',
    '/api/admin/analytics/forecast',
    '/api/admin/analytics/funnel',
    '/api/admin/analytics/isochrone',
    '/api/admin/analytics/ride-analytics',
    '/api/admin/analytics/unbooked-routes',
    '/api/admin/analytics/user-ltv',
    '/api/admin/analytics/weather',
    '/api/bookings/{id}/bid',
    '/api/bookings/{id}/bid/resolve',
    '/api/reviews/{reviewId}/helpful',
    '/api/reviews/{reviewId}/report',
    '/api/reviews/{reviewId}/respond',
    '/api/reports/create',
    '/api/reports/my-reports',
    '/api/reports/{reportId}',
    '/api/reports/{reportId}/message'
]);

const EMOJI_REGEX = /[\p{Extended_Pictographic}\uFE0F]/gu;
const ZWJ_REGEX = /\u200D/gu;

function stripEmojisFromString(value) {
    if (typeof value !== 'string') return value;
    return value.replace(EMOJI_REGEX, '').replace(ZWJ_REGEX, '');
}

function stripEmojisDeep(value) {
    if (typeof value === 'string') return stripEmojisFromString(value);
    if (Array.isArray(value)) return value.map(stripEmojisDeep);
    if (value && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            value[key] = stripEmojisDeep(value[key]);
        }
        return value;
    }
    return value;
}

function normalizeTagName(tag) {
    if (typeof tag !== 'string') return tag;
    return tag.replace(/[ \t]{2,}/g, ' ').trim();
}

function collectUsedTags(spec) {
    const used = new Set();
    const paths = spec?.paths || {};
    for (const pathKey of Object.keys(paths)) {
        const pathItem = paths[pathKey];
        if (!pathItem || typeof pathItem !== 'object') continue;
        for (const method of Object.keys(pathItem)) {
            const operation = pathItem[method];
            if (!operation || typeof operation !== 'object') continue;
            const tags = operation.tags;
            if (!Array.isArray(tags)) continue;
            for (const tag of tags) {
                if (typeof tag === 'string' && tag.trim()) used.add(tag);
            }
        }
    }
    return used;
}

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'LoopLane API',
            version: '2.0.0',
            description: `
## LoopLane — Ride Sharing Platform API

This is the complete API documentation for the LoopLane backend.

### Authentication
All protected endpoints require a valid **JWT Access Token**.

**How to authenticate in Swagger UI:**
1. Call \`POST /api/auth/login\` at the bottom of the **Auth** section (no lock icon)
2. Copy the \`accessToken\` from the response body
3. Click the **Authorize** button at the top of this page
4. In the \`BearerAuth\` field, paste your token *(without the "Bearer " prefix)*
5. Click **Authorize** and close the dialog
6. You are now authenticated and can call all endpoints your role allows

### Role-Based Access
| Role | Access Level |
|------|-------------|
| **Unauthenticated** | Auth endpoints only (register, login, OTP, forgot-password) |
| **PASSENGER** | User profile, search rides, book rides, chat, reviews, reports, SOS, wallet, promo |
| **RIDER** | All PASSENGER endpoints + post rides, accept bookings, verify OTP, vehicle/document management |
| **ADMIN / SUPER_ADMIN** | Full access to all endpoints including admin panel |
| **EMPLOYEE** | Admin panel access scoped by assigned permissions |

### Employee Permissions
\`manage_users\` · \`manage_rides\` · \`manage_finances\` · \`manage_reports\` · \`manage_settings\`
            `.trim(),
            contact: {
                name: 'LoopLane Development Team',
                email: 'dev@looplane.in'
            },
            license: {
                name: 'Private'
            }
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Local Development Server'
            },
            {
                url: 'https://looplane.onrender.com',
                description: 'Production Server'
            }
        ],
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Paste your accessToken here (obtained from POST /api/auth/login)'
                },
                CookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'accessToken',
                    description: 'HTTP-only cookie set automatically by the browser app'
                }
            },
            schemas: {
                // ---- Common ----
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string', example: 'Operation successful' }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string', example: 'An error occurred' },
                        code: { type: 'string', example: 'AUTH_REQUIRED' }
                    }
                },
                PaginationMeta: {
                    type: 'object',
                    properties: {
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 20 },
                        total: { type: 'integer', example: 150 },
                        pages: { type: 'integer', example: 8 }
                    }
                },

                // ---- Auth ----
                RegisterRequest: {
                    type: 'object',
                    required: ['name', 'email', 'phone', 'password', 'confirmPassword', 'role'],
                    properties: {
                        name: { type: 'string', example: 'Ravi Kumar' },
                        email: { type: 'string', format: 'email', example: 'ravi@example.com' },
                        phone: { type: 'string', pattern: '^[0-9]{10}$', example: '9876543210', description: '10-digit phone number (digits only)' },
                        password: { type: 'string', format: 'password', minLength: 8, example: 'SecurePass@123', description: 'At least 8 chars with uppercase, lowercase, number, and special character' },
                        confirmPassword: { type: 'string', format: 'password', example: 'SecurePass@123', description: 'Must match password' },
                        role: { type: 'string', enum: ['PASSENGER', 'RIDER'], example: 'PASSENGER' }
                    }
                },
                LoginRequest: {
                    type: 'object',
                    required: ['email', 'password'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'ravi@example.com' },
                        password: { type: 'string', format: 'password', example: 'SecurePass123' }
                    }
                },
                LoginResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        message: { type: 'string', example: 'Login successful' },
                        accessToken: { type: 'string', example: 'eyJhbGci...' },
                        refreshToken: { type: 'string', example: 'eyJhbGci...' },
                        user: { $ref: '#/components/schemas/UserProfile' }
                    }
                },
                OTPRequest: {
                    type: 'object',
                    required: ['phone', 'otp'],
                    properties: {
                        phone: { type: 'string', example: '+919876543210' },
                        otp: { type: 'string', example: '123456' }
                    }
                },
                ForgotPasswordRequest: {
                    type: 'object',
                    required: ['email'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'ravi@example.com' }
                    }
                },
                ResetPasswordRequest: {
                    type: 'object',
                    required: ['email', 'otp', 'newPassword'],
                    properties: {
                        email: { type: 'string', format: 'email', example: 'ravi@example.com' },
                        otp: { type: 'string', example: '123456' },
                        newPassword: { type: 'string', format: 'password', example: 'NewSecurePass123' }
                    }
                },
                ChangePasswordRequest: {
                    type: 'object',
                    required: ['currentPassword', 'newPassword', 'confirmNewPassword'],
                    properties: {
                        currentPassword: { type: 'string', format: 'password', example: 'OldPass123' },
                        newPassword: { type: 'string', format: 'password', example: 'NewPass456' },
                        confirmNewPassword: { type: 'string', format: 'password', example: 'NewPass456', description: 'Must match newPassword' }
                    }
                },

                // ---- User ----
                UserProfile: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '64a1b2c3d4e5f6g7h8i9j0k1' },
                        email: { type: 'string', example: 'ravi@example.com' },
                        role: { type: 'string', enum: ['PASSENGER', 'RIDER', 'ADMIN', 'SUPER_ADMIN', 'EMPLOYEE'], example: 'PASSENGER' },
                        profile: {
                            type: 'object',
                            properties: {
                                firstName: { type: 'string', example: 'Ravi' },
                                lastName: { type: 'string', example: 'Kumar' },
                                phone: { type: 'string', example: '+919876543210' },
                                profilePhoto: { type: 'string', example: 'https://cdn.looplane.in/photos/user.jpg' },
                                bio: { type: 'string', example: 'Eco-friendly commuter' }
                            }
                        },
                        verificationStatus: { type: 'string', enum: ['PENDING', 'VERIFIED', 'REJECTED'], example: 'VERIFIED' },
                        trustScore: { type: 'number', example: 87.5 },
                        accountStatus: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DELETED'], example: 'ACTIVE' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                ProfileUpdateRequest: {
                    type: 'object',
                    properties: {
                        firstName: { type: 'string', example: 'Ravi' },
                        lastName: { type: 'string', example: 'Kumar' },
                        bio: { type: 'string', example: 'Eco-friendly commuter from Bangalore' },
                        profilePhoto: { type: 'string', format: 'binary', description: 'Profile image file (multipart/form-data)' }
                    }
                },

                // ---- Rides ----
                PostRideRequest: {
                    type: 'object',
                    required: ['startLocation', 'endLocation', 'departureTime', 'availableSeats', 'pricePerSeat'],
                    properties: {
                        startLocation: {
                            type: 'object',
                            required: ['address', 'coordinates'],
                            properties: {
                                address: { type: 'string', example: 'Koramangala, Bangalore' },
                                coordinates: {
                                    type: 'array',
                                    items: { type: 'number' },
                                    example: [77.6296, 12.9352]
                                }
                            }
                        },
                        endLocation: {
                            type: 'object',
                            properties: {
                                address: { type: 'string', example: 'Whitefield, Bangalore' },
                                coordinates: { type: 'array', items: { type: 'number' }, example: [77.7480, 12.9698] }
                            }
                        },
                        departureTime: { type: 'string', format: 'date-time', example: '2026-03-25T08:30:00Z' },
                        availableSeats: { type: 'integer', minimum: 1, maximum: 6, example: 2 },
                        pricePerSeat: { type: 'number', minimum: 0, example: 120 },
                        notes: { type: 'string', example: 'No smoking. AC available.' },
                        vehicleId: { type: 'string', example: '64a1b2c3d4e5f6g7h8i9j0k1' }
                    }
                },
                RideResponse: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        rider: { $ref: '#/components/schemas/UserProfile' },
                        startLocation: { type: 'object' },
                        endLocation: { type: 'object' },
                        departureTime: { type: 'string', format: 'date-time' },
                        availableSeats: { type: 'integer' },
                        pricePerSeat: { type: 'number' },
                        status: { type: 'string', enum: ['ACTIVE', 'FULL', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], example: 'ACTIVE' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },

                // ---- Bookings ----
                CreateBookingRequest: {
                    type: 'object',
                    required: ['seats'],
                    properties: {
                        seats: { type: 'integer', minimum: 1, example: 1 },
                        pickupPoint: {
                            type: 'object',
                            properties: {
                                address: { type: 'string', example: '5th Cross, Koramangala' },
                                coordinates: { type: 'array', items: { type: 'number' }, example: [77.6296, 12.9352] }
                            }
                        },
                        dropoffPoint: {
                            type: 'object',
                            properties: {
                                address: { type: 'string' },
                                coordinates: { type: 'array', items: { type: 'number' } }
                            }
                        },
                        promoCode: { type: 'string', example: 'GREENRIDE20' }
                    }
                },
                BookingResponse: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        ride: { $ref: '#/components/schemas/RideResponse' },
                        passenger: { $ref: '#/components/schemas/UserProfile' },
                        seats: { type: 'integer' },
                        status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED'], example: 'PENDING' },
                        totalAmount: { type: 'number', example: 120 },
                        pickupOTP: { type: 'string', example: '4521' },
                        dropoffOTP: { type: 'string', example: '8764' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },

                // ---- Chat ----
                SendMessageRequest: {
                    type: 'object',
                    required: ['content'],
                    properties: {
                        content: { type: 'string', example: 'Hi, I am near the entrance!' },
                        type: { type: 'string', enum: ['TEXT', 'IMAGE', 'LOCATION'], default: 'TEXT' }
                    }
                },

                // ---- Reviews ----
                SubmitReviewRequest: {
                    type: 'object',
                    required: ['rating'],
                    properties: {
                        rating: { type: 'integer', minimum: 1, maximum: 5, example: 5 },
                        comment: { type: 'string', example: 'Great ride, very punctual and friendly!' },
                        tags: { type: 'array', items: { type: 'string' }, example: ['PUNCTUAL', 'CLEAN_CAR'] }
                    }
                },

                // ---- Reports ----
                SubmitReportRequest: {
                    type: 'object',
                    required: ['type', 'description'],
                    properties: {
                        type: { type: 'string', enum: ['HARASSMENT', 'UNSAFE_DRIVING', 'FRAUD', 'NO_SHOW', 'OTHER'], example: 'UNSAFE_DRIVING' },
                        description: { type: 'string', example: 'Driver drove recklessly on the highway' },
                        rideId: { type: 'string', example: '64a1b2c3d4e5f6g7h8i9j0k1' },
                        bookingId: { type: 'string', example: '64a1b2c3d4e5f6g7h8i9j0k2' },
                        reportedUserId: { type: 'string', example: '64a1b2c3d4e5f6g7h8i9j0k3' }
                    }
                },

                // ---- SOS ----
                TriggerSOSRequest: {
                    type: 'object',
                    properties: {
                        rideId: { type: 'string', example: '64a1b2c3d4e5f6g7h8i9j0k1' },
                        bookingId: { type: 'string' },
                        location: {
                            type: 'object',
                            properties: {
                                coordinates: { type: 'array', items: { type: 'number' }, example: [77.6296, 12.9352] },
                                address: { type: 'string', example: 'Near Silk Board Junction' }
                            }
                        },
                        message: { type: 'string', example: 'Feeling unsafe. Driver taking unknown route.' }
                    }
                },

                // ---- Admin ----
                AdminUserListResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: true },
                        users: { type: 'array', items: { $ref: '#/components/schemas/UserProfile' } },
                        pagination: { $ref: '#/components/schemas/PaginationMeta' }
                    }
                },
                UpdateUserStatusRequest: {
                    type: 'object',
                    required: ['status'],
                    properties: {
                        status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DELETED'], example: 'ACTIVE' },
                        reason: { type: 'string', example: 'Policy violation resolved' }
                    }
                },
                SuspendUserRequest: {
                    type: 'object',
                    required: ['reason'],
                    properties: {
                        reason: { type: 'string', example: 'Repeated cancellations without notice' },
                        durationDays: { type: 'integer', example: 7, description: 'Leave empty for permanent suspension' }
                    }
                },
                AdminSettingsUpdateRequest: {
                    type: 'object',
                    properties: {
                        rideSharingEnabled: { type: 'boolean', example: true },
                        chatEnabled: { type: 'boolean', example: true },
                        reviewsEnabled: { type: 'boolean', example: true },
                        maxSeatsPerRide: { type: 'integer', example: 6 },
                        platformFeePercent: { type: 'number', example: 10 }
                    }
                },
                CreateEmployeeRequest: {
                    type: 'object',
                    required: ['name', 'email', 'password', 'permissions'],
                    properties: {
                        name: { type: 'string', example: 'Priya Operations' },
                        email: { type: 'string', format: 'email', example: 'priya@looplane.in' },
                        password: { type: 'string', format: 'password', example: 'Temp@Pass123' },
                        department: { type: 'string', example: 'Trust & Safety' },
                        permissions: {
                            type: 'array',
                            items: { type: 'string', enum: ['manage_users', 'manage_rides', 'manage_finances', 'manage_reports', 'manage_settings'] },
                            example: ['manage_users', 'manage_reports']
                        }
                    }
                },
                PromoCodeRequest: {
                    type: 'object',
                    required: ['code', 'discountType', 'discountValue'],
                    properties: {
                        code: { type: 'string', example: 'GREENRIDE20' },
                        discountType: { type: 'string', enum: ['PERCENT', 'FLAT'], example: 'PERCENT' },
                        discountValue: { type: 'number', example: 20 },
                        maxUses: { type: 'integer', example: 500 },
                        validUntil: { type: 'string', format: 'date', example: '2026-12-31' },
                        minRideAmount: { type: 'number', example: 50 }
                    }
                },

                // ---- Vehicle ----
                VehicleRequest: {
                    type: 'object',
                    required: ['make', 'model', 'year', 'registrationNumber', 'color'],
                    properties: {
                        make: { type: 'string', example: 'Maruti' },
                        model: { type: 'string', example: 'Swift' },
                        year: { type: 'integer', example: 2021 },
                        registrationNumber: { type: 'string', example: 'KA01AB1234' },
                        color: { type: 'string', example: 'White' },
                        type: { type: 'string', enum: ['HATCHBACK', 'SEDAN', 'SUV', 'MPV'], example: 'HATCHBACK' }
                    }
                },

                // ---- Wallet ----
                AddFundsRequest: {
                    type: 'object',
                    required: ['amount'],
                    properties: {
                        amount: { type: 'number', minimum: 1, example: 500 },
                        paymentMethod: { type: 'string', enum: ['UPI', 'CARD', 'NETBANKING'], example: 'UPI' }
                    }
                }
            }
        },
        tags: [
            { name: 'Auth', description: 'Registration, login, OTP verification, password management' },
            { name: 'Token', description: 'JWT token refresh, revocation, and session management' },
            { name: 'User', description: 'User profiles, documents, vehicles, wallet, settings (PASSENGER & RIDER)' },
            { name: 'Rides', description: 'Post, search, manage rides — Riders post, Passengers search' },
            { name: 'Bookings', description: 'Booking lifecycle — create, accept, reject, OTP verify, complete' },
            { name: 'Chat', description: 'In-ride messaging between passenger and rider' },
            { name: 'Reviews', description: 'Submit and view ride reviews and ratings' },
            { name: 'SOS', description: 'Emergency alert triggering and management' },
            { name: 'Tracking', description: 'Real-time ride location tracking' },
            { name: 'Corporate', description: 'B2B corporate cohort, ESG reporting, office locations' },
            { name: 'Social', description: 'Social provider sync (LinkedIn, Facebook)' },
            { name: 'Geocoding & Notifications', description: 'Maps geocoding, routing, ETA, and notification APIs' },
            { name: 'Admin — Dashboard', description: 'ADMIN/EMPLOYEE ONLY — Stats, system health, notifications' },
            { name: 'Admin — Users', description: 'ADMIN/EMPLOYEE ONLY (manage_users) — User & employee management, verifications' },
            { name: 'Admin — Rides', description: 'ADMIN/EMPLOYEE ONLY (manage_rides) — Ride and booking management' },
            { name: 'Admin — Finance', description: 'ADMIN/EMPLOYEE ONLY (manage_finances) — Refunds, promo codes, invoices, settlements' },
            { name: 'Admin — Analytics', description: 'ADMIN/EMPLOYEE ONLY — Revenue, activity, geospatial, demand/supply analytics' },
            { name: 'Admin — Reports & Emergencies', description: 'ADMIN/EMPLOYEE ONLY (manage_reports) — Reports, SOS admin, fraud, churn' },
            { name: 'Admin — Settings', description: 'ADMIN/EMPLOYEE ONLY (manage_settings) — Platform configuration' },
            { name: 'Admin — AI', description: 'ADMIN/EMPLOYEE ONLY — Gemini AI insights, ops agent chat' },
            { name: 'Admin — GeoFencing', description: 'ADMIN/EMPLOYEE ONLY (manage_rides) — Route deviation monitoring' }
        ]
    },
    apis: [
        path.join(__dirname, '../routes/*.js')
    ]
};

const swaggerSpec = swaggerJSDoc(options);

const shouldHidePaths = String(process.env.SWAGGER_HIDE_PATHS || '').toLowerCase() === 'true';

// Hide selected endpoints from Swagger UI (opt-in).
if (shouldHidePaths && swaggerSpec?.paths) {
    for (const hiddenPath of HIDDEN_SWAGGER_PATHS) {
        // eslint-disable-next-line no-prototype-builtins
        if (Object.prototype.hasOwnProperty.call(swaggerSpec.paths, hiddenPath)) {
            delete swaggerSpec.paths[hiddenPath];
        }
    }
}

// Strip emojis from ALL text rendered in Swagger UI (tags, summaries, descriptions, etc.).
stripEmojisDeep(swaggerSpec);

// Normalize tag strings after emoji removal so grouping is consistent.
if (Array.isArray(swaggerSpec?.tags)) {
    swaggerSpec.tags = swaggerSpec.tags
        .map((t) => ({
            ...t,
            name: normalizeTagName(t.name),
            description: typeof t.description === 'string' ? t.description.trim() : t.description
        }))
        .filter((t) => t.name);
}

if (swaggerSpec?.paths) {
    for (const pathKey of Object.keys(swaggerSpec.paths)) {
        const pathItem = swaggerSpec.paths[pathKey];
        if (!pathItem || typeof pathItem !== 'object') continue;

        for (const method of Object.keys(pathItem)) {
            const operation = pathItem[method];
            if (!operation || typeof operation !== 'object') continue;
            if (!Array.isArray(operation.tags)) continue;
            operation.tags = operation.tags.map(normalizeTagName).filter(Boolean);
        }
    }
}

// Remove unused tags so hidden sections don’t show up in Swagger UI.
if (Array.isArray(swaggerSpec?.tags)) {
    const usedTags = collectUsedTags(swaggerSpec);
    swaggerSpec.tags = swaggerSpec.tags.filter((t) => usedTags.has(t.name));
}

module.exports = swaggerSpec;
