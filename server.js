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
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');

// User utilities for consistent display values
const { enrichUsers, getUserDisplay } = require('./utils/userUtils');

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
    contentSecurityPolicy: false // Disable for development
}));

// Enable CORS
app.use(cors());

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// Disable EJS caching in development
if (process.env.NODE_ENV !== 'production') {
    app.set('view cache', false);
}

// Disable client-side caching on auth pages to prevent stale templates/scripts
app.use('/auth', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    next();
});

// Disable view cache in development
if (process.env.NODE_ENV === 'development') {
    app.set('view cache', false);
}

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

// Import User model for helper function
const User = require('./models/User');

// Make session available in views + Add helper functions
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    res.locals.isAuthenticated = !!req.session.user;
    res.locals.baseUrl = process.env.BASE_URL;
    res.locals.appName = process.env.APP_NAME;
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.info = req.flash('info');
    res.locals.warning = req.flash('warning');
    
    // Helper function to safely get user name in EJS templates
    res.locals.getUserName = function(userObj) {
        return User.getUserName(userObj);
    };

    // Helper to retrieve name/photo/initials trio quickly
    res.locals.getUserDisplay = function(userObj) {
        return getUserDisplay(userObj);
    };
    
    next();
});

// Automatically enrich any user-like objects before rendering EJS templates
app.use((req, res, next) => {
    const originalRender = res.render.bind(res);

    res.render = function(view, options, callback) {
        let opts = options;
        let cb = callback;

        if (typeof opts === 'function') {
            cb = opts;
            opts = undefined;
        }

        if (opts && typeof opts === 'object') {
            enrichUsers(opts);
        } else if (!opts) {
            // When options omitted, Express will use res.locals. Ensure they are enriched too.
            enrichUsers(res.locals);
        }

        return originalRender(view, opts, cb);
    };

    next();
});

// Socket.IO setup for real-time features
io.on('connection', (socket) => {
    console.log('👤 New client connected:', socket.id);
    
    // Store userId from auth
    if (socket.handshake.auth && socket.handshake.auth.userId) {
        socket.userId = socket.handshake.auth.userId;
        console.log('✅ User ID set for socket:', socket.userId);
    }
    
    // Join user's personal notification room
    socket.on('join-user', (userId) => {
        socket.userId = userId; // Also set here as fallback
        socket.join(`user-${userId}`);
        console.log(`✅ [Socket.IO] User joined personal room: user-${userId}`);
    });
    
    // Join admin room for emergency alerts
    socket.on('join-admin', () => {
        socket.join('admin-room');
        console.log(`🛡️ [Socket.IO] Admin joined admin room: ${socket.id}`);
        socket.emit('admin-joined', { success: true });
    });
    
    // Join emergency tracking room
    socket.on('join-emergency', (emergencyId) => {
        socket.join(`emergency-${emergencyId}`);
        console.log(`🚨 [Socket.IO] User joined emergency room: emergency-${emergencyId}`);
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
    
    // Location update during live tracking
    socket.on('location-update', (data) => {
        const { rideId, location, userId } = data;
        io.to(`ride-${rideId}`).emit('driver-location', {
            location,
            timestamp: new Date(),
            userId
        });
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
    
    // SOS alert
    socket.on('sos-alert', (data) => {
        io.emit('emergency-alert', data); // Broadcast to all admins
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
const sosRoutes = require('./routes/sos');
const trackingRoutes = require('./routes/tracking');
const adminRoutes = require('./routes/admin');
const apiRoutes = require('./routes/api');
const reviewRoutes = require('./routes/reviews');
const reportRoutes = require('./routes/reports');

// Import middleware
const { attachUser } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Attach user to req for all routes
app.use(attachUser);

// Home page
app.get('/', (req, res) => {
    res.render('pages/home', {
        title: 'LANE - Carpool Platform',
        user: req.user
    });
});

// Use routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/rides', rideRoutes);
app.use('/bookings', bookingRoutes);
app.use('/chat', chatRoutes);
app.use('/sos', sosRoutes);
app.use('/tracking', trackingRoutes);
app.use('/admin', adminRoutes);
app.use('/api', apiRoutes);
app.use('/reviews', reviewRoutes);
app.use('/reports', reportRoutes);

// 404 handler
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
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('👋 SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});

module.exports = { app, io };
