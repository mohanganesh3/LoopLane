const nodemailer = require('nodemailer');

/**
 * PRODUCTION-READY EMAIL SERVICE WRAPPER
 * Reuses a single transporter (connection pool) for the lifetime of the process.
 * Falls back to a console mock when SMTP credentials are not configured.
 */

let _transporter = null; // singleton
let _smtpVerified = false; // track if SMTP is working

const getTransporter = () => {
    if (_transporter) return _transporter;

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, ''); // strip accidental spaces

    if (host && user && pass) {
        _transporter = nodemailer.createTransport({
            host,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: { user, pass },
            // Gmail-friendly defaults
            pool: true,      // reuse connections
            maxConnections: 3,
            maxMessages: 50,
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 15_000,
        });

        // One-time connectivity check (non-blocking; warns on failure, switches to mock)
        _transporter.verify()
            .then(() => {
                _smtpVerified = true;
                console.log('✅ SMTP transporter verified — emails will send');
            })
            .catch((err) => {
                console.warn(`⚠️  SMTP verification warning — initial connection test failed, but will still attempt to send: ${err.message}`);
            });

        return _transporter;
    }

    // Console mock for local development (no SMTP vars set)
    console.warn('⚠️  SMTP not configured — emails will be printed to console');
    _transporter = {
        sendMail: async (mailOptions) => {
            console.log('📧 [MOCK EMAIL] To:', mailOptions.to, '| Subject:', mailOptions.subject);
            return { messageId: `mock-${Date.now()}` };
        }
    };
    return _transporter;
};

exports.sendEmail = async ({ to, subject, text, html }) => {
    try {
        const transporter = getTransporter();
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"LoopLane Carpool" <noreply@looplane.in>',
            to,
            subject,
            text,
            html
        };

        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Email sending failed:', error);
        return { success: false, error: error.message };
    }
};

const renderGreetingName = (firstName) => firstName || 'User';

exports.sendOTP = async (email, otp, firstName) => {
    const name = renderGreetingName(firstName);
    return exports.sendEmail({
        to: email,
        subject: 'Your LoopLane verification code',
        text: `Hi ${name}, your LoopLane verification code is ${otp}. It is valid for 10 minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937;">
                <h2 style="margin: 0 0 16px;">Verify your LoopLane account</h2>
                <p>Hi ${name},</p>
                <p>Your verification code is:</p>
                <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 24px 0; color: #059669;">
                    ${otp}
                </div>
                <p>This code expires in 10 minutes.</p>
            </div>
        `
    });
};

exports.sendOTPEmail = exports.sendOTP;

exports.sendPasswordResetOTP = async (email, otp, firstName) => {
    const name = renderGreetingName(firstName);
    return exports.sendEmail({
        to: email,
        subject: 'Reset your LoopLane password',
        text: `Hi ${name}, use ${otp} to reset your LoopLane password. This code is valid for 10 minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937;">
                <h2 style="margin: 0 0 16px;">Reset your password</h2>
                <p>Hi ${name},</p>
                <p>Use this code to reset your LoopLane password:</p>
                <div style="font-size: 32px; font-weight: 700; letter-spacing: 8px; margin: 24px 0; color: #2563eb;">
                    ${otp}
                </div>
                <p>This code expires in 10 minutes.</p>
            </div>
        `
    });
};

exports.sendPasswordResetConfirmation = async (email, firstName) => {
    const name = renderGreetingName(firstName);
    return exports.sendEmail({
        to: email,
        subject: 'Your LoopLane password was changed',
        text: `Hi ${name}, your LoopLane password was changed successfully. If this was not you, contact support immediately.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937;">
                <h2 style="margin: 0 0 16px;">Password changed successfully</h2>
                <p>Hi ${name},</p>
                <p>Your LoopLane password has been changed.</p>
                <p>If you did not make this change, contact support immediately.</p>
            </div>
        `
    });
};

// Ready-to-use templates
exports.templates = {
    bookingConfirmation: (user, booking, ride) => ({
        subject: `Booking Confirmed: ${ride.origin.city} to ${ride.destination.city}`,
        text: `Hi ${user.firstName}, your booking for ${booking.seatsBooked} seats is confirmed! Booking ID: ${booking._id}`
    }),
    paymentReceipt: (user, payment) => ({
        subject: `Payment Receipt: ₹${payment.amount}`,
        text: `Hi ${user.firstName}, your payment of ₹${payment.amount} was successful. Transaction ID: ${payment.transactionId}`
    }),
    rideStarted: (user, ride) => ({
        subject: `Your Ride is Starting Soon!`,
        text: `Hi ${user.firstName}, your ride from ${ride.origin.city} to ${ride.destination.city} is starting soon. Have a safe journey!`
    })
};

// ─────────────────── TRUST & SAFETY EMAIL TEMPLATES ───────────────────

/**
 * Email to reporter when their report is submitted
 */
exports.sendReportSubmittedEmail = async (email, firstName, { category, severity, reportId }) => {
    const name = renderGreetingName(firstName);
    const categoryLabel = (category || 'OTHER').replace(/_/g, ' ').toLowerCase();
    return exports.sendEmail({
        to: email,
        subject: 'LoopLane — Your safety report has been received',
        text: `Hi ${name}, we've received your ${categoryLabel} report (${severity} priority). Our Trust & Safety team will review it within ${severity === 'HIGH' ? '2 hours' : '24 hours'}. Track your report at: https://looplane.in/my-reports`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
                    <h2 style="margin: 0;">🛡️ Safety Report Received</h2>
                </div>
                <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                    <p>Hi ${name},</p>
                    <p>We've received your <strong>${categoryLabel}</strong> report and take it seriously.</p>
                    <div style="background: #fef3cd; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p style="margin: 0; font-weight: bold; color: #92400e;">⏱️ Expected Response Time</p>
                        <p style="margin: 8px 0 0; color: #92400e;">${severity === 'HIGH' ? 'Within 2 hours (Critical Priority)' : severity === 'MEDIUM' ? 'Within 8 hours' : 'Within 24 hours'}</p>
                    </div>
                    <p><strong>What happens next:</strong></p>
                    <ol style="padding-left: 20px; color: #4b5563;">
                        <li>A Trust & Safety agent will review the details</li>
                        <li>We may contact you for additional information</li>
                        <li>You'll receive a notification once resolved</li>
                    </ol>
                    <a href="https://looplane.in/my-reports" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 12px;">Track Your Report</a>
                    <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">Report ID: ${reportId}</p>
                </div>
            </div>`
    });
};

/**
 * Email to reporter when admin resolves their report
 */
exports.sendReportResolvedEmail = async (email, firstName, { category, action, adminMessage, refundAmount, reportId }) => {
    const name = renderGreetingName(firstName);
    const categoryLabel = (category || 'OTHER').replace(/_/g, ' ').toLowerCase();
    const actionLabels = {
        'NO_ACTION': 'further investigation scheduled',
        'WARNING_ISSUED': 'a formal warning has been issued to the reported user',
        'TEMPORARY_SUSPENSION': 'the reported user\'s account has been temporarily suspended',
        'PERMANENT_BAN': 'the reported user has been permanently removed from LoopLane',
        'REFUND_ISSUED': `a refund of ₹${refundAmount || 0} has been processed to your account`,
        'FURTHER_INVESTIGATION': 'further investigation is underway'
    };
    const actionText = actionLabels[action] || 'appropriate action has been taken';

    return exports.sendEmail({
        to: email,
        subject: 'LoopLane — Your safety report has been resolved',
        text: `Hi ${name}, your ${categoryLabel} report has been reviewed. Resolution: ${actionText}. ${adminMessage || ''}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
                    <h2 style="margin: 0;">✅ Report Resolved</h2>
                </div>
                <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                    <p>Hi ${name},</p>
                    <p>Your <strong>${categoryLabel}</strong> report has been reviewed by our Trust & Safety team.</p>
                    <div style="background: #ecfdf5; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #059669;">
                        <p style="margin: 0; font-weight: bold; color: #065f46;">Outcome</p>
                        <p style="margin: 8px 0 0; color: #065f46;">${actionText.charAt(0).toUpperCase() + actionText.slice(1)}</p>
                    </div>
                    ${adminMessage ? `<div style="background: #f0f9ff; padding: 16px; border-radius: 8px; margin: 16px 0;"><p style="margin: 0; font-weight: bold; color: #1e40af;">Message from our team:</p><p style="margin: 8px 0 0; color: #1e3a5f;">${adminMessage}</p></div>` : ''}
                    ${refundAmount ? `<div style="background: #ecfdf5; padding: 16px; border-radius: 8px; margin: 16px 0;"><p style="margin: 0; font-weight: bold; color: #059669;">💰 Refund: ₹${refundAmount}</p><p style="margin: 4px 0 0; color: #059669; font-size: 13px;">This will be credited to your original payment method within 3-5 business days.</p></div>` : ''}
                    <p style="color: #6b7280; font-size: 13px;">Thank you for helping keep the LoopLane community safe.</p>
                    <a href="https://looplane.in/my-reports" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 8px;">View Report Details</a>
                </div>
            </div>`
    });
};

/**
 * Email to reported user when they receive a WARNING
 */
exports.sendWarningEmail = async (email, firstName, { reason, category }) => {
    const name = renderGreetingName(firstName);
    return exports.sendEmail({
        to: email,
        subject: '⚠️ LoopLane Community Guidelines Warning',
        text: `Hi ${name}, you have received a warning for violating LoopLane Community Guidelines. Reason: ${reason}. Repeated violations may lead to account suspension.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
                    <h2 style="margin: 0;">⚠️ Community Guidelines Warning</h2>
                </div>
                <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                    <p>Hi ${name},</p>
                    <p>We've received a report regarding your conduct on LoopLane. After investigation, we've found a violation of our <strong>Community Guidelines</strong>.</p>
                    <div style="background: #fffbeb; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
                        <p style="margin: 0; font-weight: bold; color: #92400e;">Reason</p>
                        <p style="margin: 8px 0 0; color: #78350f;">${reason || 'Violation of Community Guidelines'}</p>
                    </div>
                    <p><strong>What this means:</strong></p>
                    <ul style="padding-left: 20px; color: #4b5563;">
                        <li>This is a formal warning on your account</li>
                        <li>Your trust score has been adjusted</li>
                        <li>Repeated violations will result in account suspension</li>
                    </ul>
                    <p style="color: #6b7280; font-size: 13px;">If you believe this is a mistake, you can reply to the report in your notifications.</p>
                </div>
            </div>`
    });
};

/**
 * Email to reported user when their account is SUSPENDED
 */
exports.sendSuspensionEmail = async (email, firstName, { reason, durationDays, suspensionEnd }) => {
    const name = renderGreetingName(firstName);
    const endDate = suspensionEnd ? new Date(suspensionEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A';
    return exports.sendEmail({
        to: email,
        subject: '🚫 LoopLane — Account Suspended',
        text: `Hi ${name}, your LoopLane account has been suspended for ${durationDays} days. Reason: ${reason}. Your account will be automatically reactivated on ${endDate}. If you believe this is an error, reply to this email.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #dc2626, #ef4444); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
                    <h2 style="margin: 0;">🚫 Account Suspended</h2>
                </div>
                <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                    <p>Hi ${name},</p>
                    <p>Your LoopLane account has been <strong>temporarily suspended</strong> due to a violation of our safety policies.</p>
                    <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #dc2626;">
                        <p style="margin: 0; font-weight: bold; color: #991b1b;">Reason: ${reason || 'Policy violation'}</p>
                        <p style="margin: 8px 0 0; color: #991b1b;">Duration: <strong>${durationDays} days</strong></p>
                        <p style="margin: 4px 0 0; color: #991b1b;">Reactivation date: <strong>${endDate}</strong></p>
                    </div>
                    <p><strong>During suspension:</strong></p>
                    <ul style="padding-left: 20px; color: #4b5563;">
                        <li>You cannot post rides or make bookings</li>
                        <li>Your active rides and bookings have been paused</li>
                        <li>Your account will be <strong>automatically reactivated</strong> on ${endDate}</li>
                    </ul>
                    <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p style="margin: 0; font-weight: bold; color: #1e40af;">📧 Appeal Process</p>
                        <p style="margin: 8px 0 0; color: #1e3a5f;">If you believe this suspension was made in error, reply to this email with evidence supporting your case. Our team will review appeals within 48 hours.</p>
                    </div>
                </div>
            </div>`
    });
};

/**
 * Email to reported user when their account is PERMANENTLY BANNED
 */
exports.sendBanEmail = async (email, firstName, { reason }) => {
    const name = renderGreetingName(firstName);
    return exports.sendEmail({
        to: email,
        subject: '🚫 LoopLane — Account Permanently Banned',
        text: `Hi ${name}, your LoopLane account has been permanently banned. Reason: ${reason}. If you believe this is an error, contact support@looplane.in.`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #7f1d1d, #991b1b); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
                    <h2 style="margin: 0;">🚫 Account Permanently Banned</h2>
                </div>
                <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                    <p>Hi ${name},</p>
                    <p>Your LoopLane account has been <strong>permanently banned</strong> due to severe or repeated violations of our safety policies and Community Guidelines.</p>
                    <div style="background: #fef2f2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #7f1d1d;">
                        <p style="margin: 0; font-weight: bold; color: #991b1b;">Reason: ${reason || 'Severe policy violation'}</p>
                    </div>
                    <p>This action is irreversible. If you believe this was a mistake, contact <a href="mailto:support@looplane.in">support@looplane.in</a>.</p>
                </div>
            </div>`
    });
};

/**
 * Email to rider when a refund is deducted from their ride
 */
exports.sendRefundDeductionEmail = async (email, firstName, { amount, reason, bookingRef }) => {
    const name = renderGreetingName(firstName);
    return exports.sendEmail({
        to: email,
        subject: `LoopLane — Refund of ₹${amount} issued from your ride`,
        text: `Hi ${name}, a refund of ₹${amount} has been issued to a passenger from your ride (${bookingRef}). Reason: ${reason}`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 24px; color: #1f2937; max-width: 600px;">
                <div style="background: linear-gradient(135deg, #2563eb, #3b82f6); padding: 20px; border-radius: 12px 12px 0 0; color: white;">
                    <h2 style="margin: 0;">💸 Refund Processed From Your Ride</h2>
                </div>
                <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
                    <p>Hi ${name},</p>
                    <p>A refund of <strong>₹${amount}</strong> has been processed from your ride.</p>
                    <div style="background: #eff6ff; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #2563eb;">
                        <p style="margin: 0; color: #1e40af;"><strong>Amount:</strong> ₹${amount}</p>
                        ${bookingRef ? `<p style="margin: 4px 0 0; color: #1e40af;"><strong>Booking:</strong> ${bookingRef}</p>` : ''}
                        <p style="margin: 4px 0 0; color: #1e40af;"><strong>Reason:</strong> ${reason || 'Passenger complaint resolved'}</p>
                    </div>
                    <p style="color: #6b7280; font-size: 13px;">This amount will be adjusted from your earnings. If you have questions, contact support.</p>
                </div>
            </div>`
    });
};

// Epic 6: Winback Email logic
exports.sendWinbackEmail = async (user, data) => {
    try {
        const transporter = getTransporter();
        const mailOptions = {
            from: process.env.EMAIL_FROM || '"LoopLane Carpool" <noreply@looplane.in>',
            to: user.email,
            subject: `We Miss You, ${user.profile.firstName}! Here's ${data.discountPercent}% Off`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2>We noticed you haven't taken a ride lately.</h2>
                    <p>Hi ${user.profile.firstName},</p>
                    <p>As one of our VIP riders, your empty seat is waiting. Come back and save ${data.discountPercent}% on your next ride!</p>
                    <div style="background-color: #f4f4f4; padding: 15px; margin: 20px 0; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                        ${data.promoCode}
                    </div>
                    <p>Just enter this code at checkout.</p>
                    <a href="https://looplane.in/search" style="display: inline-block; background-color: #2563EB; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Find a Ride</a>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Marketing Auto-Ops] Winback email sent to ${user.email}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Winback email sending failed:', error);
        return { success: false, error: error.message };
    }
};
