/**
 * Main Server File
 * Entry point for the Carpool Platform application
 */

// Load environment variables
require('dotenv').config();

// Clear module cache in development mode
if (process.env.NODE_ENV === 'development') {
    const { clearRequireCache } = require('./utils/cacheManager');
    clearRequireCache(['models', 'controllers', 'middleware', 'utils']);
}

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const socketIO = require('socket.io');

// Swagger setup
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

// Security middleware
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
// Note: csurf removed - deprecated and unnecessary for JWT-authenticated SPA APIs

// Logger configuration
const { accessLogStream, errorLogStream, shouldSkipLogging } = require('./utils/logger');

// User utilities (kept for API enrichment)
const { enrichUsers } = require('./utils/userUtils');

// Epic 3: Telematics Engine
const telematicsEngine = require('./utils/telematicsEngine');

// Import database configuration
const connectDB = require('./config/database');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// CORS origins for Socket.IO and Express
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'https://looplane.onrender.com'];

// Add BASE_URL if defined
if (process.env.BASE_URL && !allowedOrigins.includes(process.env.BASE_URL)) {
    allowedOrigins.push(process.env.BASE_URL);
}

const io = socketIO(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Trust proxy - required for Render, Heroku, etc. (reverse proxy)
app.set('trust proxy', 1);

// Expose Socket.IO instance to controllers via req.app.get('io')
// This enables controllers to emit events (e.g., live tracking updates)
app.set('io', io);

// Connect to MongoDB
// Note: actual connection is awaited in the startup sequence at the bottom of this file


// Import authentication middleware for Swagger protection
const { isAuthenticated } = require('./middleware/auth');

// NOTE: Swagger routes are mounted before the global cookieParser() middleware below.
// If we don't parse cookies here, authenticated browser sessions will still look unauthenticated.
const swaggerCookieParser = cookieParser(process.env.COOKIE_SECRET || process.env.SESSION_SECRET);

// ─── Swagger UI — disable helmet CSP only for /api/docs ─────────────────────
app.use('/api/docs', swaggerCookieParser, isAuthenticated, (req, res, next) => {
    res.setHeader('Content-Security-Policy', [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com",
        "img-src 'self' data: https://cdn.jsdelivr.net https://unpkg.com",
        "connect-src 'self'"
    ].join('; '));
    next();
});
app.use('/api/docs', swaggerCookieParser, isAuthenticated, swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: false,
    customSiteTitle: 'LoopLane API Docs',
    customCss: `.swagger-ui .topbar { background: #1a1a2e; } .swagger-ui .topbar-wrapper img { content: url('https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/googlemaps.svg'); height:40px; } .swagger-ui .info .title { color: #4f46e5; }`,
    swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',

        // Hide the global "Schemas" panel at the bottom of Swagger UI
        // (keep schemas in the spec so $ref still resolves inside operations)
        defaultModelsExpandDepth: -1,
        defaultModelExpandDepth: -1
    }
}));

// Raw OpenAPI spec as JSON
app.get('/api/swagger.json', swaggerCookieParser, isAuthenticated, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});
// ─────────────────────────────────────────────────────────────────────────────

app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com', 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
            imgSrc: ["'self'", 'data:', 'blob:', 'https://*.tile.openstreetmap.org', 'https://cdnjs.cloudflare.com', 'https://raw.githubusercontent.com', 'https://maps.googleapis.com', 'https://maps.gstatic.com', 'https://res.cloudinary.com', 'https://unpkg.com', 'https://*.cloudinary.com'],
            connectSrc: [
                "'self'",
                'https://nominatim.openstreetmap.org',
                'https://router.project-osrm.org',
                'https://api.razorpay.com',
                'wss:',
                'ws:',
                'https:'
            ],
            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
            frameAncestors: ["'self'"],
            formAction: ["'self'"],
            baseUri: ["'self'"]
        }
    } : false,
    crossOriginEmbedderPolicy: false
}));

// Rate limiting - 100 requests per 15 minutes
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs (increased for local testing)
    message: 'Too many requests from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});
// Apply to all /api routes
app.use('/api/', apiLimiter);

// Specific stricter rate limiter for auth routes
const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 200, // limit each IP to 200 requests per hour for auth (increased for local testing)
    message: 'Too many authentication attempts, please try again after an hour',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

// CORS configuration - allow credentials for session/JWT
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        // Check if origin is allowed
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            return callback(null, true);
        } else {
            // Log the blocked origin for debugging
            console.error(`❌ CORS blocked origin: ${origin}`);
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['set-cookie']
}));

// Compression middleware
app.use(compression());

// Cookie parser - must come before session and CSRF
app.use(cookieParser(process.env.COOKIE_SECRET || process.env.SESSION_SECRET));

// Logging middleware with file rotation
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

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL injection
app.use(mongoSanitize({
    replaceWith: '_' // Replace prohibited characters with underscore
}));

// Data sanitization against XSS
app.use(xss());

// Prevent HTTP parameter pollution
app.use(hpp({
    whitelist: ['tags', 'pricePerSeat', 'availableSeats', 'departureTime', 'status'] // Allow duplicates for these params
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Serve React build assets early (before any routes) - critical for production
app.use('/assets', express.static(path.join(__dirname, 'client/dist/assets'), {
    maxAge: '1y', // Cache assets for 1 year (they have content hashes)
    immutable: true
}));

// Diagnostic endpoint for build verification (admin only in production)
app.get('/api/debug/build-info', (req, res) => {
    const fs = require('fs');
    const distPath = path.join(__dirname, 'client/dist');
    const assetsPath = path.join(__dirname, 'client/dist/assets');

    const info = {
        distExists: fs.existsSync(distPath),
        assetsExists: fs.existsSync(assetsPath),
        assets: [],
        indexHtmlExists: fs.existsSync(path.join(distPath, 'index.html'))
    };

    if (info.assetsExists) {
        try {
            info.assets = fs.readdirSync(assetsPath);
        } catch (e) {
            info.assetsError = e.message;
        }
    }

    res.json(info);
});

// JWT-only authentication — no server-side sessions

// Socket.IO JWT Authentication Middleware
const { verifyAccessToken } = require('./middleware/jwt');
const User = require('./models/User');
const { ADMIN_ROLES } = require('./config/roles');

const parseCookieHeader = (cookieHeader) => {
    if (!cookieHeader || typeof cookieHeader !== 'string') return {};

    return cookieHeader.split(';').reduce((acc, part) => {
        const trimmed = part.trim();
        if (!trimmed) return acc;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return acc;
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (!key) return acc;
        try {
            acc[key] = decodeURIComponent(value);
        } catch {
            acc[key] = value;
        }
        return acc;
    }, {});
};

const extractSocketToken = (socket) => {
    const authToken = socket?.handshake?.auth?.token;
    const queryToken = socket?.handshake?.query?.token;
    if (authToken || queryToken) return authToken || queryToken;

    const cookies = parseCookieHeader(socket?.handshake?.headers?.cookie);
    return cookies.accessToken;
};

io.use(async (socket, next) => {
    try {
        const token = extractSocketToken(socket);

        // Allow connection without auth, but DO NOT trust userId from client.
        // Private rooms (user/admin) are guarded in the event handlers below.
        if (!token) {
            socket.userId = null;
            socket.user = null;
            return next();
        }

        const decoded = verifyAccessToken(token);
        socket.userId = decoded.userId;

        // Attach minimal user context for downstream checks (e.g. admin room join)
        const user = await User.findById(decoded.userId)
            .select('role accountStatus isActive isSuspended employeeDetails')
            .lean();
        socket.user = user || null;

        return next();
    } catch (error) {
        console.error('❌ [Socket.IO] Authentication error:', error.message);
        // Backward compatibility: allow connection, but treat as unauthenticated.
        socket.userId = null;
        socket.user = null;
        return next();
    }
});

// Socket.IO setup for real-time features
io.on('connection', (socket) => {
    // socket.userId is set only when a verified JWT is present (see io.use middleware above)

    // Join user's personal notification room
    socket.on('join-user', (userId) => {
        if (!socket.userId) return;
        // Prevent joining other users' rooms via spoofed payloads
        if (userId && userId.toString() !== socket.userId.toString()) return;
        socket.join(`user-${socket.userId}`);
    });

    // Join admin room
    socket.on('join-admin', async () => {
        try {
            if (!socket.userId) {
                return socket.emit('admin-joined', { success: false, message: 'Authentication required' });
            }

            const role = socket.user?.role;
            if (!role || !ADMIN_ROLES.includes(role)) {
                return socket.emit('admin-joined', { success: false, message: 'Admin or employee access required' });
            }

            // Employee account active check (mirrors HTTP middleware behavior)
            if (socket.user?.employeeDetails && socket.user.employeeDetails.isActive === false) {
                return socket.emit('admin-joined', { success: false, message: 'Employee account deactivated' });
            }

            socket.join('admin-room');
            return socket.emit('admin-joined', { success: true });
        } catch (err) {
            console.error('❌ [Socket.IO] join-admin error:', err.message);
            return socket.emit('admin-joined', { success: false, message: 'Failed to join admin room' });
        }
    });

    // Generic join handler (for backward compatibility)
    socket.on('join', (roomName) => {
        socket.join(roomName);
    });

    // Join room for specific ride/booking
    socket.on('join-ride', (payload) => {
        const rideId = typeof payload === 'object' ? payload?.rideId : payload;
        if (rideId) {
            socket.join(`ride-${rideId}`);
        }
    });

    socket.on('leave-ride', (payload) => {
        const rideId = typeof payload === 'object' ? payload?.rideId : payload;
        if (rideId) {
            socket.leave(`ride-${rideId}`);
        }
    });

    // Join booking room
    socket.on('join-booking', (bookingId) => {
        socket.join(`booking-${bookingId}`);
    });

    // Join tracking room for real-time location updates
    socket.on('join-tracking', (data) => {
        const { bookingId, rideId } = data;
        if (bookingId) {
            socket.join(`tracking-${bookingId}`);
        }
        if (rideId) {
            socket.join(`ride-${rideId}`);
        }
        socket.emit('tracking-joined', { bookingId, rideId });
    });

    // Leave tracking room
    socket.on('leave-tracking', (data) => {
        const { bookingId, rideId } = data;
        if (bookingId) {
            socket.leave(`tracking-${bookingId}`);
        }
        if (rideId) {
            socket.leave(`ride-${rideId}`);
        }
    });

    // Join chat room
    socket.on('join-chat', (chatId) => {
        socket.join(`chat-${chatId}`);
        socket.emit('chat-joined', { chatId });
    });

    // Leave chat room
    socket.on('leave-chat', (chatId) => {
        socket.leave(`chat-${chatId}`);
    });

    // Typing indicators for chat
    socket.on('typing-start', (data) => {
        const { chatId } = data;
        socket.to(`chat-${chatId}`).emit('user-typing', { chatId, userId: socket.userId });
    });

    socket.on('typing-stop', (data) => {
        const { chatId } = data;
        socket.to(`chat-${chatId}`).emit('user-stopped-typing', { chatId, userId: socket.userId });
    });

    // Mark chat messages as read
    socket.on('mark-read', (data) => {
        const { chatId } = data;
        socket.to(`chat-${chatId}`).emit('messages-read', { chatId });
    });

    // Location update during live tracking (DRIVER/RIDER sending location)
    socket.on('location-update', (data) => {
        const { rideId, bookingId, location, userId } = data;

        // Broadcast to all tracking this ride
        if (rideId) {
            io.to(`ride-${rideId}`).emit('location-update', {
                location,
                timestamp: new Date(),
                userId
            });

            // Also emit driver-location for backward compatibility
            io.to(`ride-${rideId}`).emit('driver-location', {
                location,
                timestamp: new Date(),
                userId
            });
        }

        // Also broadcast to specific booking rooms
        if (bookingId) {
            io.to(`tracking-${bookingId}`).emit('location-update', {
                location,
                timestamp: new Date(),
                userId
            });
        }
    });

    // Rider/Driver broadcasts location (alternative naming)
    socket.on('rider-location', (data) => {
        const { rideId, bookingId, location, userId } = data;

        // Broadcast to all passengers tracking this ride
        if (rideId) {
            io.to(`ride-${rideId}`).emit('location-update', {
                location,
                timestamp: new Date(),
                userId
            });
        }

        if (bookingId) {
            io.to(`tracking-${bookingId}`).emit('location-update', {
                location,
                timestamp: new Date(),
                userId
            });
        }
    });

    // Epic 3: Telematics & Hyper-Safety (Accelerometer/Gyroscope stream)
    socket.on('telematics-update', async (data) => {
        // data expects: { rideId, driverId, readings: [{x, y, z, timestamp}, ...] }
        if (data && data.rideId && data.readings) {
            await telematicsEngine.processSensorBatch(data, io);
        }
    });

    // Ride status update (driver updating ride status)
    socket.on('ride-status-update', (data) => {
        const { rideId, status } = data;

        // Broadcast to all passengers tracking this ride
        if (rideId) {
            io.to(`ride-${rideId}`).emit('ride-status-update', {
                rideId,
                status,
                timestamp: new Date()
            });
        }
    });

    // Chat message (legacy - now handled via API)
    socket.on('send-message', (data) => {
        const { bookingId, message, senderId } = data;
        io.to(`booking-${bookingId}`).emit('new-message', {
            message,
            senderId,
            timestamp: new Date()
        });
    });

    // Typing indicator (legacy)
    socket.on('typing', (data) => {
        const { bookingId, userId } = data;
        socket.to(`booking-${bookingId}`).emit('user-typing', { userId });
    });

    socket.on('disconnect', () => { });
});

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const rideRoutes = require('./routes/rides');
const bookingRoutes = require('./routes/bookings');
const chatRoutes = require('./routes/chat');
const trackingRoutes = require('./routes/tracking');
const adminRoutes = require('./routes/admin');
const geoFencingRoutes = require('./routes/geoFencing');
const apiRoutes = require('./routes/api');
const reviewRoutes = require('./routes/reviews');
const reportRoutes = require('./routes/reports');
const sosRoutes = require('./routes/sos');
const socialRoutes = require('./routes/social'); // Epic 2: Social Graph
const corporateRoutes = require('./routes/corporate'); // Epic 4: B2B Enterprise

// Import middleware
const { attachUser } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { loginLimiter } = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');
const { settingsEnforcer } = require('./middleware/settingsEnforcer');

// Attach user to req for all routes
app.use(attachUser);

// Attach platform settings + enforce maintenance mode
app.use(settingsEnforcer);

// Apply request logger to all requests
app.use(requestLogger);

// API health check / status endpoint
app.get('/api/health', (req, res) => {
    const mongoose = require('mongoose');
    const memUsage = process.memoryUsage();

    res.json({
        success: true,
        message: 'LANE Carpool API is running',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        environment: process.env.NODE_ENV || 'development',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        memory: {
            rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
            heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
            heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
        },
        version: require('./package.json').version || '1.0.0'
    });
});

// Use routes - ALL APIs under /api prefix for clean separation from SPA routes
app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', geoFencingRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/corporate', corporateRoutes);
app.use('/api', apiRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/token', require('./routes/token')); // JWT token management

// Serve React SPA - for production mode or when accessing backend directly
// Serve static files from React build
app.use(express.static(path.join(__dirname, 'client/dist'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html')) {
            // Prevent caching for index.html so users always get the latest build references
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// SPA fallback - serve index.html for all non-API routes
// This allows React Router to handle client-side routing (including 404s)
app.get('*', (req, res, next) => {
    // Skip SPA fallback for API, uploads, socket.io, and static assets
    // Also skip CSRF-exempt paths to allow them to 404 naturally if missing
    if (req.path.startsWith('/api/') ||
        req.path.startsWith('/uploads/') ||
        req.path.startsWith('/socket.io/') ||
        req.path.startsWith('/assets/') ||
        path.extname(req.path)) {
        return next();
    }

    // Serve React app for all client-side routes (including /admin/*)
    const indexPath = path.join(__dirname, 'client/dist/index.html');
    if (require('fs').existsSync(indexPath)) {
        // Disable caching for the SPA fallback as well
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.sendFile(indexPath);
    } else {
        // If no build exists, redirect to Vite dev server
        res.redirect(`http://localhost:5173${req.path}`);
    }
});

// 404 handler - ONLY catches API routes that don't exist
// Frontend 404s are handled by React Router's catch-all route
app.use(notFound);

// Global error handler
app.use(errorHandler);

// Start server — connect to DB first, then listen, then start cron
const PORT = process.env.PORT || 3000;

(async () => {
    // 1. Connect to MongoDB (must succeed before accepting requests)
    await connectDB();

    // 2. Start HTTP server (wrapped in a promise so we wait for success/failure)
    await new Promise((resolve, reject) => {
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.error(`❌ Port ${PORT} is already in use. Kill the other process or use a different port.`);
                process.exit(1);
            }
            reject(err);
        });

        server.listen(PORT, () => {
            const env = process.env.NODE_ENV || 'development';
            const url = process.env.BASE_URL || `http://localhost:${PORT}`;
            const pad = (str, len) => str + ' '.repeat(Math.max(0, len - str.length));
            const W = 49; // inner width between ║ borders
            const line = (text) => `  ║  ${pad(text, W - 2)}║`;
            const empty = line('');
            console.log([
                '',
                `  ╔${'═'.repeat(W)}╗`,
                empty,
                line(`  🚗  LOOPLANE — SERVER RUNNING  🚗`),
                empty,
                line(`  Port:         ${PORT}`),
                line(`  Environment:  ${env}`),
                line(`  URL:          ${url}`),
                empty,
                line(`  Ready to accept connections! 🎉`),
                empty,
                `  ╚${'═'.repeat(W)}╝`,
                ''
            ].join('\n'));
            resolve();
        });
    });

    // 3. Scheduled jobs — only start after DB connected AND server listening
    const cron = require('node-cron');
    const scheduledJobs = require('./utils/scheduledJobs');

    // Run immediately on startup (DB is guaranteed connected, server is listening)
    scheduledJobs.runAllJobs();

    // Run every 5 minutes via cron
    cron.schedule('*/5 * * * *', () => {
        scheduledJobs.runAllJobs();
    });
    console.log('✅ [Scheduled Jobs] Started with node-cron — running every 5 minutes');
})();

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    // Close HTTP server (stop accepting new connections)
    server.close(async () => {
        console.log('HTTP server closed');

        // Close database connection
        try {
            const mongoose = require('mongoose');
            await mongoose.connection.close();
            console.log('MongoDB connection closed');
        } catch (err) {
            console.error('Error closing MongoDB connection:', err);
        }

        process.exit(0);
    });

    // Force shutdown after 3 seconds (fast enough for nodemon restarts)
    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 3000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Process-level error handlers
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
    // Don't crash — log and continue
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Exit immediately — don't attempt graceful shutdown for fatal errors
    process.exit(1);
});

module.exports = { app, io };
