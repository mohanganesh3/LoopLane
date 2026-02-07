/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */

/**
 * Custom Error Class
 */
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Not Found Error Handler (404)
 * Handles requests to non-existent routes
 */
const notFound = (req, res, next) => {
    // Silently handle favicon requests
    if (req.originalUrl === '/favicon.ico') {
        return res.status(204).end();
    }
    
    // Provide helpful error message for API routes
    if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found',
            code: 'ROUTE_NOT_FOUND',
            path: req.originalUrl,
            method: req.method,
            availableEndpoints: {
                auth: '/api/auth/login, /api/auth/register, /api/auth/logout',
                users: '/api/user/profile, /api/user/update',
                rides: '/api/rides, /api/rides/:id',
                bookings: '/api/bookings, /api/bookings/:id',
                token: '/api/token/refresh, /api/token/revoke'
            }
        });
    }
    
    // For non-API routes, pass to error handler (will be caught by SPA fallback)
    const error = new AppError(`Route not found - ${req.originalUrl}`, 404);
    next(error);
};

/**
 * Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
    // Start with the error's own status code
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    // Log all errors for debugging via Render logs
    console.error(`[ErrorHandler] ${statusCode} ${req.method} ${req.originalUrl}:`, err.message);
    if (statusCode >= 500) console.error(err.stack);
    
    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        message = 'Resource not found';
        statusCode = 404;
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        message = `This ${field} is already registered`;
        statusCode = 400;
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        message = Object.values(err.errors).map(val => val.message).join(', ');
        statusCode = 400;
    }

    // JSON parsing errors (SyntaxError)
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        message = '❌ Invalid data format. Please check your input and try again.';
        statusCode = 400;
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        message = '🔐 Invalid authentication token. Please log in again.';
        statusCode = 401;
    }

    if (err.name === 'TokenExpiredError') {
        message = '🕒 Your session has expired. Please log in again.';
        statusCode = 401;
    }

    // Always return JSON response (React frontend handles all rendering)
    return res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
};

/**
 * Async handler wrapper
 * Eliminates need for try-catch blocks in async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    AppError,
    notFound,
    errorHandler,
    asyncHandler
};
