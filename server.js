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
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const socketIO = require('socket.io');

// Security middleware
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const csrf = require('csurf');

// Logger configuration
const { accessLogStream, errorLogStream, shouldSkipLogging } = require('./utils/logger');

// User utilities (kept for API enrichment)
const { enrichUsers } = require('./utils/userUtils');

// Import database configuration
const connectDB = require('./config/database');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Expose Socket.IO instance to controllers via req.app.get('io')
// This enables controllers to emit events (e.g., live tracking updates)
app.set('io', io);

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' // Enable in production
}));

// CORS configuration - allow credentials for session/JWT
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // Allow cookies
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        touchAfter: 24 * 3600 // Lazy session update (24 hours)
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
    }
}));

// Flash messages middleware
app.use(flash());

// CSRF Protection - only for non-API routes (API uses JWT)
const csrfProtection = csrf({ cookie: true });
const csrfMiddleware = (req, res, next) => {
    // Skip CSRF for API routes (they use JWT) and Socket.IO
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
        return next();
    }
    csrfProtection(req, res, next);
};
app.use(csrfMiddleware);

// CSRF token endpoint for non-API routes
app.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: req.csrfToken ? req.csrfToken() : null });
});

// Make session data available in req
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    res.locals.baseUrl = process.env.BASE_URL;
    res.locals.appName = process.env.APP_NAME;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    res.locals.warning = req.flash('warning');
    next();
});

// Socket.IO JWT Authentication Middleware
const { verifyAccessToken } = require('./middleware/jwt');

io.use(async (socket, next) => {
    try {
        // Extract token from auth object or query params
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (token) {
            // Verify JWT token
            const decoded = verifyAccessToken(token);
            socket.userId = decoded.userId;
            console.log('✅ [Socket.IO] JWT authenticated user:', socket.userId);
            return next();
        }
        
        // Fallback: allow connection without auth (for backward compatibility)
        // User can authenticate later via join-user event
        if (socket.handshake.auth && socket.handshake.auth.userId) {
            socket.userId = socket.handshake.auth.userId;
            console.log('✅ [Socket.IO] Session authenticated user:', socket.userId);
            return next();
        }
        
        console.log('⚠️ [Socket.IO] Unauthenticated connection allowed:', socket.id);
        next();
    } catch (error) {
        console.error('❌ [Socket.IO] Authentication error:', error.message);
        // Allow connection but log the error (backward compatibility)
        next();
    }
});

// Socket.IO setup for real-time features
io.on('connection', (socket) => {
    console.log('👤 New client connected:', socket.id);

    // Store userId from auth (if not already set by middleware)
    if (!socket.userId && socket.handshake.auth && socket.handshake.auth.userId) {
        socket.userId = socket.handshake.auth.userId;
        console.log('✅ User ID set for socket:', socket.userId);
    }

    // Join user's personal notification room
    socket.on('join-user', (userId) => {
        socket.userId = userId; // Also set here as fallback
        socket.join(`user-${userId}`);
        console.log(`✅ [Socket.IO] User joined personal room: user-${userId}`);
    });

    // Join admin room
    socket.on('join-admin', () => {
        socket.join('admin-room');
        console.log(`🛡️ [Socket.IO] Admin joined admin room: ${socket.id}`);
        socket.emit('admin-joined', { success: true });
    });

    // Generic join handler (for backward compatibility)
    socket.on('join', (roomName) => {
        socket.join(roomName);
        console.log(`✅ [Socket.IO] User joined room: ${roomName}`);
    });

    // Join room for specific ride/booking
    socket.on('join-ride', (rideId) => {
        socket.join(`ride-${rideId}`);
        console.log(`User joined ride room: ride-${rideId}`);
    });

    // Join booking room
    socket.on('join-booking', (bookingId) => {
        socket.join(`booking-${bookingId}`);
        console.log(`User joined booking room: booking-${bookingId}`);
    });

    // Join tracking room for real-time location updates
    socket.on('join-tracking', (data) => {
        const { bookingId, rideId } = data;
        if (bookingId) {
            socket.join(`tracking-${bookingId}`);
            console.log(`🗺️ [Tracking] User joined tracking room: tracking-${bookingId}`);
        }
        if (rideId) {
            socket.join(`ride-${rideId}`);
            console.log(`🗺️ [Tracking] User joined ride room: ride-${rideId}`);
        }
        socket.emit('tracking-joined', { bookingId, rideId });
    });

    // Leave tracking room
    socket.on('leave-tracking', (data) => {
        const { bookingId, rideId } = data;
        if (bookingId) {
            socket.leave(`tracking-${bookingId}`);
            console.log(`👋 [Tracking] User left tracking room: tracking-${bookingId}`);
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

        console.log(`📍 [Location Update] Ride: ${rideId}, User: ${userId}`, {
            lat: location?.latitude,
            lng: location?.longitude,
            speed: location?.speed
        });

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
        console.log(`🚗 [Rider Location] Broadcasting for ride: ${rideId}`);

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

    // Ride status update (driver updating ride status)
    socket.on('ride-status-update', (data) => {
        const { rideId, status } = data;
        console.log(`📊 [Ride Status] Updating ride ${rideId} to status: ${status}`);

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

    socket.on('disconnect', () => {
        console.log('👤 Client disconnected:', socket.id);
    });
});

// Make io available in routes
app.set('io', io);

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

// Import middleware
const { attachUser } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter, loginLimiter } = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');

// Attach user to req for all routes
app.use(attachUser);

// Apply request logger to all requests
app.use(requestLogger);

// API health check / status endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'LANE Carpool API is running',
        timestamp: new Date().toISOString()
    });
});

// Use routes - ALL APIs under /api prefix for clean separation from SPA routes
// Debug logging for all API requests
app.use('/api', (req, res, next) => {
    if (req.method === 'PUT' || req.method === 'POST') {
        console.log(`\n📥 [${req.method}] ${req.originalUrl}`);
        console.log('   Body:', JSON.stringify(req.body, null, 2).substring(0, 500));
    }
    next();
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', loginLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/rides', rideRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/tracking', trackingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', geoFencingRoutes);
app.use('/api', apiRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/sos', sosRoutes);
app.use('/api/token', require('./routes/token')); // JWT token management

// Serve React SPA - for production mode or when accessing backend directly
// Serve static files from React build
app.use(express.static(path.join(__dirname, 'client/dist')));

// SPA fallback - serve index.html for all non-API routes
// This allows React Router to handle client-side routing (including 404s)
app.get('*', (req, res, next) => {
    // All API routes are now under /api prefix
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/') || req.path.startsWith('/socket.io/')) {
        return next();
    }

    // Serve React app for all client-side routes (including /admin/*)
    const indexPath = path.join(__dirname, 'client/dist/index.html');
    if (require('fs').existsSync(indexPath)) {
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

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════════════════════╗
    ║                                                       ║
    ║   🚗  CARPOOL PLATFORM - SERVER RUNNING  🚗          ║
    ║                                                       ║
    ║   Port:        ${PORT}                                   ║
    ║   Environment: ${process.env.NODE_ENV || 'development'}                          ║
    ║   URL:         ${process.env.BASE_URL}      ║
    ║                                                       ║
    ║   Ready to accept connections! 🎉                    ║
    ║                                                       ║
    ╚═══════════════════════════════════════════════════════╝
    `);

    // ✅ EDGE CASE FIX: Run scheduled jobs to handle expired rides/bookings
    const scheduledJobs = require('./utils/scheduledJobs');

    // Run immediately on startup
    scheduledJobs.runAllJobs();

    // Run every 5 minutes
    setInterval(() => {
        scheduledJobs.runAllJobs();
    }, 5 * 60 * 1000); // 5 minutes

    console.log('✅ [Scheduled Jobs] Started - running every 5 minutes');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

module.exports = { app, io };
