/**
 * Request Logger Middleware
 * Logs details about incoming requests for debugging and monitoring
 */

const requestLogger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.originalUrl;
    const ip = req.ip || req.connection.remoteAddress;
    const userId = req.session?.userId || 'Guest';

    console.log(`[${timestamp}] ${method} ${url} - IP: ${ip} - User: ${userId}`);

    // Log body for POST/PUT requests (excluding sensitive data)
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
        const bodyCopy = { ...req.body };
        // Remove sensitive fields
        ['password', 'confirmPassword', 'otp', 'token'].forEach(field => {
            if (bodyCopy[field]) bodyCopy[field] = '********';
        });

        if (Object.keys(bodyCopy).length > 0) {
            console.log('   Body:', JSON.stringify(bodyCopy, null, 2).substring(0, 500));
        }
    }

    next();
};

module.exports = requestLogger;
