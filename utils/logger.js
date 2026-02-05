/**
 * Logger Configuration
 * Configures rotating file streams for production logging
 */

const path = require('path');
const rfs = require('rotating-file-stream');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

/**
 * Create rotating write stream for access logs
 * Rotates daily, keeps 14 days of logs, compresses old logs
 */
const accessLogStream = rfs.createStream('access.log', {
    interval: '1d', // Rotate daily
    maxFiles: 14, // Keep 14 days of logs
    compress: 'gzip', // Compress rotated files
    path: logsDir
});

/**
 * Create rotating write stream for error logs
 * Rotates daily, keeps 14 days of logs, compresses old logs
 */
const errorLogStream = rfs.createStream('error.log', {
    interval: '1d', // Rotate daily
    maxFiles: 14, // Keep 14 days of logs
    compress: 'gzip', // Compress rotated files
    path: logsDir
});

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

/**
 * Skip logging for certain paths (e.g., health checks)
 */
const skipPaths = ['/health', '/favicon.ico'];

const shouldSkipLogging = (req) => {
    return skipPaths.some(path => req.url.startsWith(path));
};

module.exports = {
    accessLogStream,
    errorLogStream,
    morganTokens,
    shouldSkipLogging,
    logsDir
};
