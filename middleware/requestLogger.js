/**
 * Request Logger Middleware
 * Logs details about incoming requests for debugging and monitoring
 */

const REDACT_FIELDS = ['password', 'confirmPassword', 'otp', 'token', 'refreshToken', 'imageBase64'];

const sanitizeBody = (body = {}) => {
    const bodyCopy = { ...body };
    REDACT_FIELDS.forEach((field) => {
        if (field in bodyCopy) {
            bodyCopy[field] = '********';
        }
    });
    return bodyCopy;
};

const requestLogger = (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    const method = req.method.toUpperCase();
    const url = req.originalUrl || req.url;
    const ip = req.ip || req.connection.remoteAddress;
    const bodySnapshot = ['POST', 'PUT', 'PATCH'].includes(method) ? sanitizeBody(req.body) : null;

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        // Read userId here (after auth middleware has run) so it reflects the authenticated user
        const userId = req.userId || req.user?._id || 'Guest';
        const logEntry = {
            timestamp: new Date().toISOString(),
            method,
            url,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            ip,
            userId
        };

        if (bodySnapshot && Object.keys(bodySnapshot).length > 0) {
            logEntry.body = bodySnapshot;
        }

        const logger = res.statusCode >= 500
            ? console.error
            : res.statusCode >= 400
                ? console.warn
                : console.info;

        logger(`[REQUEST] ${JSON.stringify(logEntry)}`);
    });

    next();
};

module.exports = requestLogger;
