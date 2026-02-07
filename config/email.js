/**
 * Email Service Configuration
 * Uses Nodemailer with Gmail SMTP
 */

const nodemailer = require('nodemailer');

// Create reusable transporter — use Gmail service
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

console.log('📧 Email transporter configured (Gmail)');

module.exports = transporter;
