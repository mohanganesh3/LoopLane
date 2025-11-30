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
 */
const notFound = (req, res, next) => {
    // Silently handle favicon requests
    if (req.originalUrl === '/favicon.ico') {
        return res.status(204).end();
    }
    
    const error = new AppError(`Route not found - ${req.originalUrl}`, 404);
    next(error);
};

/**
 * Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;
    error.statusCode = err.statusCode || 500;

    // Log error for debugging
    if (process.env.NODE_ENV === 'development') {
        console.error('Error:', err);
    }

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = new AppError(message, 404);
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        const message = `This ${field} is already registered`;
        error = new AppError(message, 400);
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = new AppError(message, 400);
    }

    // JSON parsing errors (SyntaxError)
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        const message = '❌ Invalid data format. Please check your input and try again.';
        error = new AppError(message, 400);
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = '🔐 Invalid authentication token. Please log in again.';
        error = new AppError(message, 401);
    }

    if (err.name === 'TokenExpiredError') {
        const message = '🕒 Your session has expired. Please log in again.';
        error = new AppError(message, 401);
    }

    // Always return JSON response (React frontend handles all rendering)
    return res.status(error.statusCode).json({
        success: false,
        message: error.message,
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
