/**
 * Email Service Configuration
 * Uses Nodemailer with Gmail SMTP
 */

const nodemailer = require('nodemailer');

// Create reusable transporter — use port 465 (SSL) for Gmail
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Only verify connection in development (Render startup check causes timeout)
if (process.env.NODE_ENV !== 'production') {
    transporter.verify((error, success) => {
        if (error) {
            console.error('❌ Email configuration error:', error);
        } else {
            console.log('✅ Email server is ready to send messages');
        }
    });
} else {
    console.log('📧 Email transporter configured (Gmail)');
}

module.exports = transporter;
