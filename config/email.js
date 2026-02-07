/**
 * Email Service Configuration
 * Uses Nodemailer with Gmail SMTP
 */

const nodemailer = require('nodemailer');

// Create reusable transporter
const smtpPort = parseInt(process.env.SMTP_PORT) || 465;
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpPort === 465, // true for 465 (SSL), false for 587 (TLS)
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    },
    tls: {
        rejectUnauthorized: false
    },
    connectionTimeout: 10000, // 10 second connection timeout
    socketTimeout: 10000      // 10 second socket timeout
});

// Verify connection
transporter.verify((error, success) => {
    if (error) {
        console.error('❌ Email configuration error:', error);
    } else {
        console.log('✅ Email server is ready to send messages');
    }
});

module.exports = transporter;
