/**
 * Email Service Utility
 * Functions to send various types of emails
 * ✅ RESPECTS USER NOTIFICATION PREFERENCES
 */

const transporter = require('../config/email');
const User = require('../models/User');

class EmailService {
    /**
     * ✅ CHECK IF USER ALLOWS EMAIL NOTIFICATIONS
     * @param {string|object} userOrId - User object or user ID
     * @returns {Promise<boolean>} - Whether email is allowed
     */
    static async canSendEmail(userOrId) {
        try {
            let user = userOrId;
            if (typeof userOrId === 'string') {
                user = await User.findById(userOrId).select('preferences.notifications.email');
            }
            // Default to true if preference not set
            return user?.preferences?.notifications?.email !== false;
        } catch (error) {
            console.error('Error checking email preference:', error);
            return true; // Default to sending if check fails
        }
    }

    /**
     * ✅ CHECK IF USER ALLOWS EMAIL NOTIFICATIONS (by email address)
     * @param {string} email - User email address
     * @returns {Promise<boolean>} - Whether email is allowed
     */
    static async canSendEmailByAddress(email) {
        try {
            const user = await User.findOne({ email }).select('preferences.notifications.email');
            if (!user) return true; // If user not found, send anyway
            return user?.preferences?.notifications?.email !== false;
        } catch (error) {
            console.error('Error checking email preference by address:', error);
            return true;
        }
    }
    /**
     * Send OTP verification email
     * ⚠️ OTP EMAILS ARE ALWAYS SENT (Security critical - no preference check)
     */
    static async sendOTP(email, otp, name) {
        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: 'Verify Your Email - OTP Code',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2ECC71;">Welcome to ${process.env.APP_NAME}!</h2>
                    <p>Hi ${name},</p>
                    <p>Thank you for registering. Please use the following OTP to verify your email address:</p>
                    <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
                        <h1 style="color: #2ECC71; font-size: 36px; margin: 0;">${otp}</h1>
                    </div>
                    <p>This OTP will expire in 10 minutes.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                    <hr style="margin: 30px 0;">
                    <p style="color: #888; font-size: 12px;">
                        This is an automated email. Please do not reply.
                    </p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ OTP email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending OTP email:', error);
            return false;
        }
    }

    /**
     * Send verification approval email (for riders)
     * ✅ RESPECTS EMAIL NOTIFICATION PREFERENCE
     */
    static async sendVerificationApproval(email, name) {
        // ✅ Check user preference before sending
        if (!await this.canSendEmailByAddress(email)) {
            console.log(`📧 Email skipped (user preference): Verification approval to ${email}`);
            return { skipped: true, reason: 'User disabled email notifications' };
        }

        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: '🎉 Verification Approved - Start Posting Rides!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2ECC71;">Congratulations ${name}!</h2>
                    <p>Your rider verification has been <strong>approved</strong>! ✅</p>
                    <p>You can now start posting rides and earning money while helping the environment.</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.BASE_URL}/ride/post" 
                           style="background-color: #2ECC71; color: white; padding: 15px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            Post Your First Ride
                        </a>
                    </div>
                    <p>Happy carpooling! 🚗</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('❌ Error sending approval email:', error);
            return false;
        }
    }

    /**
     * Send booking confirmation email
     * ✅ RESPECTS EMAIL NOTIFICATION PREFERENCE
     */
    static async sendBookingConfirmation(email, bookingDetails) {
        // ✅ Check user preference before sending
        if (!await this.canSendEmailByAddress(email)) {
            console.log(`📧 Email skipped (user preference): Booking confirmation to ${email}`);
            return { skipped: true, reason: 'User disabled email notifications' };
        }

        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: '✅ Booking Confirmed - Ride Details',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2ECC71;">Booking Confirmed!</h2>
                    <p>Your ride has been confirmed. Here are the details:</p>
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>From:</strong> ${bookingDetails.from}</p>
                        <p><strong>To:</strong> ${bookingDetails.to}</p>
                        <p><strong>Date:</strong> ${bookingDetails.date}</p>
                        <p><strong>Time:</strong> ${bookingDetails.time}</p>
                        <p><strong>Seats:</strong> ${bookingDetails.seats}</p>
                        <p><strong>Price:</strong> ₹${bookingDetails.price}</p>
                    </div>
                    <p><strong>Driver:</strong> ${bookingDetails.driverName}</p>
                    <p><strong>Contact:</strong> ${bookingDetails.driverPhone}</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${process.env.BASE_URL}/booking/${bookingDetails.bookingId}" 
                           style="background-color: #3498DB; color: white; padding: 15px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            View Booking Details
                        </a>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('❌ Error sending booking confirmation:', error);
            return false;
        }
    }

    /**
     * Send emergency SOS alert email
     * ⚠️ EMERGENCY EMAILS ARE ALWAYS SENT (Safety critical - no preference check)
     */
    static async sendSOSAlert(email, emergencyDetails) {
        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: '🚨 EMERGENCY ALERT - Immediate Action Required',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 3px solid red;">
                    <div style="background-color: red; color: white; padding: 20px; text-align: center;">
                        <h1>🚨 EMERGENCY ALERT 🚨</h1>
                    </div>
                    <div style="padding: 20px;">
                        <p><strong>${emergencyDetails.name}</strong> has triggered an SOS alert during a ride.</p>
                        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                            <p><strong>Emergency ID:</strong> ${emergencyDetails.emergencyId}</p>
                            <p><strong>Time:</strong> ${emergencyDetails.time}</p>
                            <p><strong>Location:</strong> ${emergencyDetails.location}</p>
                            <p><strong>Ride From:</strong> ${emergencyDetails.from}</p>
                            <p><strong>Ride To:</strong> ${emergencyDetails.to}</p>
                        </div>
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${emergencyDetails.trackingLink}" 
                               style="background-color: red; color: white; padding: 15px 30px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                🔴 TRACK LIVE LOCATION
                            </a>
                        </div>
                        <p><strong>Driver Details:</strong></p>
                        <p>Name: ${emergencyDetails.driverName}</p>
                        <p>Phone: ${emergencyDetails.driverPhone}</p>
                        <p>Vehicle: ${emergencyDetails.vehicle}</p>
                        <hr>
                        <p style="color: red; font-weight: bold;">
                            If you cannot reach ${emergencyDetails.name}, please contact local authorities immediately.
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('❌ Error sending SOS email:', error);
            return false;
        }
    }

    /**
     * Send ride starting reminder
     * ✅ RESPECTS EMAIL NOTIFICATION PREFERENCE
     */
    static async sendRideReminder(email, rideDetails, hoursUntil) {
        // ✅ Check user preference before sending
        if (!await this.canSendEmailByAddress(email)) {
            console.log(`📧 Email skipped (user preference): Ride reminder to ${email}`);
            return { skipped: true, reason: 'User disabled email notifications' };
        }

        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: `⏰ Ride Reminder - Departure in ${hoursUntil} hours`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #3498DB;">Ride Reminder</h2>
                    <p>Your ride is departing in <strong>${hoursUntil} hours</strong>!</p>
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>From:</strong> ${rideDetails.from}</p>
                        <p><strong>To:</strong> ${rideDetails.to}</p>
                        <p><strong>Date:</strong> ${rideDetails.date}</p>
                        <p><strong>Time:</strong> ${rideDetails.time}</p>
                        <p><strong>Meeting Point:</strong> ${rideDetails.meetingPoint}</p>
                    </div>
                    <p>Please be on time. Have a safe journey! 🚗</p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('❌ Error sending reminder:', error);
            return false;
        }
    }

    /**
     * Send booking request email to rider
     * ✅ RESPECTS EMAIL NOTIFICATION PREFERENCE
     */
    static async sendBookingRequestEmail(rider, bookingDetails) {
        // ✅ Check user preference before sending
        if (!await this.canSendEmail(rider)) {
            console.log(`📧 Email skipped (user preference): Booking request to ${rider.email}`);
            return { skipped: true, reason: 'User disabled email notifications' };
        }

        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: rider.email,
            subject: '🔔 New Booking Request for Your Ride',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #2ECC71;">New Booking Request!</h2>
                    <p>Hi ${rider.name},</p>
                    <p><strong>${bookingDetails.passengerName}</strong> wants to book <strong>${bookingDetails.seats} seat(s)</strong> in your ride.</p>
                    
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 5px; margin: 20px 0;">
                        <p><strong>📍 Pickup:</strong> ${bookingDetails.pickupLocation}</p>
                        <p><strong>📍 Dropoff:</strong> ${bookingDetails.dropoffLocation}</p>
                        <p><strong>💺 Seats:</strong> ${bookingDetails.seats}</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${bookingDetails.bookingUrl}" 
                           style="background-color: #2ECC71; color: white; padding: 15px 30px; 
                                  text-decoration: none; border-radius: 5px; display: inline-block;">
                            View Booking Request
                        </a>
                    </div>
                    
                    <p style="color: #666;">Please respond to this booking request as soon as possible.</p>
                    
                    <hr style="margin: 30px 0;">
                    <p style="color: #888; font-size: 12px;">
                        ${process.env.APP_NAME} - Ride together, save together 🌍
                    </p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Booking request email sent to ${rider.email}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending booking request email:', error);
            return false;
        }
    }

    /**
     * Send booking accepted notification
     * ✅ RESPECTS EMAIL NOTIFICATION PREFERENCE
     */
    static async sendBookingAcceptedEmail(passenger, bookingDetails) {
        // ✅ Check user preference before sending
        if (!await this.canSendEmail(passenger)) {
            console.log(`📧 Email skipped (user preference): Booking accepted to ${passenger.email}`);
            return { skipped: true, reason: 'User disabled email notifications' };
        }

        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: passenger.email,
            subject: `✅ Booking Confirmed - ${bookingDetails.bookingReference}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #2ECC71; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">🎉 Booking Confirmed!</h1>
                    </div>
                    <div style="padding: 30px; background-color: #f9f9f9;">
                        <p style="font-size: 16px;">Hi ${passenger.name},</p>
                        <p>Great news! Your booking request has been <strong>accepted</strong> by ${bookingDetails.riderName}.</p>
                        
                        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #2ECC71;">
                            <h3 style="margin-top: 0; color: #2ECC71;">Booking Details</h3>
                            <p><strong>Booking Reference:</strong> ${bookingDetails.bookingReference}</p>
                            <p><strong>Number of Seats:</strong> ${bookingDetails.seats}</p>
                            <p><strong>Total Amount:</strong> ₹${bookingDetails.price.toFixed(2)}</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
                            <p><strong>From:</strong> ${bookingDetails.from}</p>
                            <p><strong>To:</strong> ${bookingDetails.to}</p>
                            <p><strong>Date:</strong> ${new Date(bookingDetails.date).toLocaleString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })}</p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${bookingDetails.bookingUrl}" 
                               style="background-color: #2ECC71; color: white; padding: 15px 40px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                View Booking Details
                            </a>
                        </div>

                        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                            <p style="margin: 0;"><strong>⚠️ Important:</strong></p>
                            <p style="margin: 5px 0 0 0;">Please be at the pickup location on time. The driver will be contacted with your details soon.</p>
                        </div>

                        <p>Have a safe and pleasant journey!</p>
                        <p>Best regards,<br><strong>${process.env.APP_NAME} Team</strong></p>
                    </div>
                    <div style="background-color: #34495E; color: white; padding: 15px; text-align: center;">
                        <p style="margin: 0; font-size: 12px;">
                            ${process.env.APP_NAME} - Ride together, save together 🌍
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('❌ Error sending booking accepted email:', error);
            return false;
        }
    }

    /**
     * Send booking rejected notification
     * ✅ RESPECTS EMAIL NOTIFICATION PREFERENCE
     */
    static async sendBookingRejectedEmail(passenger, bookingDetails) {
        // ✅ Check user preference before sending
        if (!await this.canSendEmail(passenger)) {
            console.log(`📧 Email skipped (user preference): Booking rejected to ${passenger.email}`);
            return { skipped: true, reason: 'User disabled email notifications' };
        }

        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: passenger.email,
            subject: `❌ Booking Request Declined - ${bookingDetails.bookingReference}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #E74C3C; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">Booking Request Declined</h1>
                    </div>
                    <div style="padding: 30px; background-color: #f9f9f9;">
                        <p style="font-size: 16px;">Hi ${passenger.name},</p>
                        <p>Unfortunately, ${bookingDetails.riderName} has declined your booking request.</p>
                        
                        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #E74C3C;">
                            <p><strong>Booking Reference:</strong> ${bookingDetails.bookingReference}</p>
                            <p><strong>Route:</strong> ${bookingDetails.from} → ${bookingDetails.to}</p>
                            <p><strong>Date:</strong> ${new Date(bookingDetails.date).toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}</p>
                            <hr style="border: none; border-top: 1px solid #eee; margin: 15px 0;">
                            <p><strong>Reason:</strong> ${bookingDetails.reason}</p>
                        </div>

                        <div style="background-color: #d1ecf1; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #17a2b8;">
                            <p style="margin: 0;"><strong>💡 Don't worry!</strong></p>
                            <p style="margin: 5px 0 0 0;">You can search for other available rides or post your own ride request.</p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/rides/search" 
                               style="background-color: #3498DB; color: white; padding: 15px 40px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold; margin: 5px;">
                                Search Other Rides
                            </a>
                        </div>

                        <p>We're sorry this didn't work out. Keep looking for rides!</p>
                        <p>Best regards,<br><strong>${process.env.APP_NAME} Team</strong></p>
                    </div>
                    <div style="background-color: #34495E; color: white; padding: 15px; text-align: center;">
                        <p style="margin: 0; font-size: 12px;">
                            ${process.env.APP_NAME} - Ride together, save together 🌍
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('❌ Error sending booking rejected email:', error);
            return false;
        }
    }

    /**
     * Send generic notification email
     * ✅ RESPECTS EMAIL NOTIFICATION PREFERENCE
     */
    static async sendNotification(email, subject, message, buttonText = null, buttonUrl = null) {
        // ✅ Check user preference before sending
        if (!await this.canSendEmailByAddress(email)) {
            console.log(`📧 Email skipped (user preference): Notification to ${email}`);
            return { skipped: true, reason: 'User disabled email notifications' };
        }
        let buttonHtml = '';
        if (buttonText && buttonUrl) {
            buttonHtml = `
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${buttonUrl}" 
                       style="background-color: #2ECC71; color: white; padding: 15px 30px; 
                              text-decoration: none; border-radius: 5px; display: inline-block;">
                        ${buttonText}
                    </a>
                </div>
            `;
        }

        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: subject,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    ${message}
                    ${buttonHtml}
                    <hr style="margin: 30px 0;">
                    <p style="color: #888; font-size: 12px;">
                        ${process.env.APP_NAME} - Ride together, save together 🌍
                    </p>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('❌ Error sending email:', error);
            return false;
        }
    }

    /**
     * Send password reset OTP email
     * ⚠️ PASSWORD RESET EMAILS ARE ALWAYS SENT (Security critical - no preference check)
     */
    static async sendPasswordResetOTP(email, otp, name) {
        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: '🔒 Password Reset Code - LANE Carpool',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2ECC71; margin: 0;">🔒 Password Reset</h1>
                    </div>
                    
                    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 10px; border-left: 4px solid #2ECC71;">
                        <p style="font-size: 16px; color: #333; margin-bottom: 20px;">Hi ${name},</p>
                        
                        <p style="font-size: 14px; color: #666; line-height: 1.6;">
                            We received a request to reset your password. Use the code below to complete the process:
                        </p>
                        
                        <div style="background-color: #ffffff; padding: 25px; text-align: center; margin: 30px 0; border-radius: 8px; border: 2px dashed #2ECC71;">
                            <p style="margin: 0 0 10px 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Your Reset Code</p>
                            <h1 style="color: #2ECC71; font-size: 48px; margin: 0; letter-spacing: 8px; font-weight: bold;">${otp}</h1>
                        </div>
                        
                        <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107; margin: 20px 0;">
                            <p style="margin: 0; font-size: 13px; color: #856404;">
                                ⏰ <strong>This code will expire in 10 minutes</strong>
                            </p>
                        </div>
                        
                        <p style="font-size: 14px; color: #666; line-height: 1.6; margin-top: 20px;">
                            Enter this code on the password reset page to set your new password.
                        </p>
                    </div>
                    
                    <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin-top: 20px; border-left: 4px solid #dc3545;">
                        <p style="margin: 0; font-size: 13px; color: #721c24;">
                            🚨 <strong>Security Alert:</strong> If you didn't request this password reset, please ignore this email and your password will remain unchanged. Consider changing your password if you didn't initiate this request.
                        </p>
                    </div>
                    
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
                    
                    <div style="text-align: center;">
                        <p style="color: #888; font-size: 12px; margin: 5px 0;">
                            This is an automated email from LANE Carpool
                        </p>
                        <p style="color: #888; font-size: 12px; margin: 5px 0;">
                            Please do not reply to this email
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Password reset OTP email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending password reset OTP email:', error);
            throw error;
        }
    }

    /**
     * Send password reset confirmation email
     * ⚠️ PASSWORD RESET EMAILS ARE ALWAYS SENT (Security critical - no preference check)
     */
    static async sendPasswordResetConfirmation(email, name) {
        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: email,
            subject: '✅ Password Reset Successful - LANE Carpool',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2ECC71; margin: 0;">✅ Password Changed Successfully</h1>
                    </div>
                    
                    <div style="background-color: #d4edda; padding: 30px; border-radius: 10px; border-left: 4px solid #28a745;">
                        <p style="font-size: 16px; color: #155724; margin-bottom: 20px;">Hi ${name},</p>
                        
                        <p style="font-size: 14px; color: #155724; line-height: 1.6;">
                            This is to confirm that your password has been successfully reset. You can now log in to your LANE Carpool account using your new password.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.BASE_URL || 'http://localhost:3000'}/auth/login" 
                               style="display: inline-block; background-color: #2ECC71; color: white; padding: 15px 40px; 
                                      text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">
                                Login to Your Account
                            </a>
                        </div>
                        
                        <p style="font-size: 14px; color: #155724; line-height: 1.6;">
                            Your account security is important to us. Here are some tips:
                        </p>
                        
                        <ul style="font-size: 13px; color: #155724; line-height: 1.8;">
                            <li>Use a strong, unique password</li>
                            <li>Don't share your password with anyone</li>
                            <li>Enable two-factor authentication if available</li>
                            <li>Regularly update your password</li>
                        </ul>
                    </div>
                    
                    <div style="background-color: #f8d7da; padding: 15px; border-radius: 5px; margin-top: 20px; border-left: 4px solid #dc3545;">
                        <p style="margin: 0; font-size: 13px; color: #721c24;">
                            🚨 <strong>Important:</strong> If you did NOT change your password, please contact our support team immediately at 
                            <a href="mailto:${process.env.SUPPORT_EMAIL || 'support@lanecarpool.com'}" style="color: #721c24; font-weight: bold;">
                                ${process.env.SUPPORT_EMAIL || 'support@lanecarpool.com'}
                            </a>
                        </p>
                    </div>
                    
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
                    
                    <div style="text-align: center;">
                        <p style="color: #888; font-size: 12px; margin: 5px 0;">
                            Password changed at: ${new Date().toLocaleString('en-US', { 
                                dateStyle: 'full', 
                                timeStyle: 'short' 
                            })}
                        </p>
                        <p style="color: #888; font-size: 12px; margin: 5px 0;">
                            This is an automated email from LANE Carpool
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Password reset confirmation email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending password reset confirmation email:', error);
            return false;
        }
    }

    /**
     * Send Emergency SOS Alert to Guardian Emails
     * ⚠️ EMERGENCY EMAILS ARE ALWAYS SENT (Safety critical - no preference check)
     */
    static async sendEmergencyAlert(emails, emergencyDetails) {
        const { userName, userEmail, userPhone, location, locationUrl, time, emergencyId, type } = emergencyDetails;
        
        const mailOptions = {
            from: `"${process.env.APP_NAME} Emergency" <${process.env.EMAIL_FROM}>`,
            to: emails.join(', '),
            subject: `🚨 EMERGENCY ALERT: ${userName} needs help!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 3px solid #DC2626;">
                    <div style="background-color: #DC2626; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0; font-size: 28px;">🚨 EMERGENCY ALERT 🚨</h1>
                    </div>
                    
                    <div style="padding: 30px; background-color: #FEF2F2;">
                        <p style="font-size: 18px; font-weight: bold; color: #991B1B; margin-bottom: 20px;">
                            ${userName} has triggered an emergency SOS alert!
                        </p>
                        
                        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
                            <h3 style="margin-top: 0; color: #DC2626;">Emergency Details:</h3>
                            <p style="margin: 10px 0;"><strong>Type:</strong> ${type || 'SOS'}</p>
                            <p style="margin: 10px 0;"><strong>Time:</strong> ${time}</p>
                            <p style="margin: 10px 0;"><strong>Emergency ID:</strong> ${emergencyId}</p>
                        </div>

                        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
                            <h3 style="margin-top: 0; color: #DC2626;">Contact Information:</h3>
                            <p style="margin: 10px 0;"><strong>Name:</strong> ${userName}</p>
                            <p style="margin: 10px 0;"><strong>Email:</strong> ${userEmail}</p>
                            <p style="margin: 10px 0;"><strong>Phone:</strong> ${userPhone}</p>
                        </div>

                        <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #DC2626;">
                            <h3 style="margin-top: 0; color: #DC2626;">📍 Location:</h3>
                            <p style="margin: 10px 0;">${location}</p>
                            <div style="text-align: center; margin: 20px 0;">
                                <a href="${locationUrl}" 
                                   style="background-color: #DC2626; color: white; padding: 15px 30px; 
                                          text-decoration: none; border-radius: 5px; display: inline-block; 
                                          font-weight: bold; font-size: 16px;">
                                    📍 View Location on Map
                                </a>
                            </div>
                        </div>

                        <div style="background-color: #FEF2F2; padding: 20px; border-radius: 8px; border: 2px solid #FCA5A5; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #991B1B;">⚠️ Immediate Actions:</h3>
                            <ul style="margin: 10px 0; padding-left: 20px; color: #7F1D1D;">
                                <li style="margin: 8px 0;">Try calling ${userName} immediately at: <strong>${userPhone}</strong></li>
                                <li style="margin: 8px 0;">Click the location link above to see their exact position</li>
                                <li style="margin: 8px 0;">If you cannot reach them, contact local emergency services (112)</li>
                                <li style="margin: 8px 0;">The admin team at LANE has also been notified</li>
                            </ul>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <p style="color: #DC2626; font-weight: bold; font-size: 16px;">
                                This is an automated emergency alert from LANE Carpool
                            </p>
                            <p style="color: #991B1B; font-size: 14px;">
                                Please respond immediately
                            </p>
                        </div>
                    </div>

                    <div style="background-color: #7F1D1D; color: white; padding: 15px; text-align: center;">
                        <p style="margin: 5px 0; font-size: 12px;">
                            LANE Carpool Safety System | Emergency Response Team
                        </p>
                        <p style="margin: 5px 0; font-size: 12px;">
                            For support, contact: ${process.env.EMAIL_FROM}
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Emergency alert email sent to ${emails.length} guardian(s)`);
            return true;
        } catch (error) {
            console.error('❌ Error sending emergency alert email:', error);
            throw error;
        }
    }

    /**
     * Send ride started email with pickup OTP
     * ✅ RESPECTS EMAIL NOTIFICATION PREFERENCE
     */
    static async sendRideStartedEmail(passenger, rideDetails) {
        // ✅ Check user preference before sending
        if (!await this.canSendEmail(passenger)) {
            console.log(`📧 Email skipped (user preference): Ride started to ${passenger.email}`);
            return { skipped: true, reason: 'User disabled email notifications' };
        }

        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: passenger.email,
            subject: '🚗 Your Rider is On The Way!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #2ECC71; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">🚗 Rider On The Way!</h1>
                    </div>
                    <div style="padding: 30px; background-color: #f9f9f9;">
                        <p style="font-size: 16px;">Hi ${passenger.profile?.firstName || passenger.name || 'there'},</p>
                        <p><strong>${rideDetails.riderName}</strong> has started the ride and is on the way to pick you up!</p>
                        
                        <div style="background-color: #fff3cd; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ffc107; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">YOUR PICKUP OTP</p>
                            <h1 style="color: #856404; font-size: 48px; margin: 0; letter-spacing: 8px;">${rideDetails.pickupOTP}</h1>
                            <p style="margin: 10px 0 0 0; color: #856404; font-size: 12px;">Share this with the rider when they arrive</p>
                        </div>

                        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <p><strong>📍 Pickup Location:</strong> ${rideDetails.pickupLocation}</p>
                            <p><strong>⏰ Estimated Time:</strong> ${rideDetails.estimatedPickupTime}</p>
                            <p><strong>🎫 Booking Ref:</strong> ${rideDetails.bookingReference}</p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${rideDetails.trackingUrl}" 
                               style="background-color: #3498DB; color: white; padding: 15px 40px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                📍 Track Live Location
                            </a>
                        </div>

                        <p>Please be ready at the pickup location. Have a safe journey! 🚗</p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Ride started email sent to ${passenger.email}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending ride started email:', error);
            return false;
        }
    }

    /**
     * Send pickup confirmed email with dropoff OTP
     * ✅ RESPECTS EMAIL NOTIFICATION PREFERENCE
     */
    static async sendPickupConfirmedEmail(passenger, rideDetails) {
        // ✅ Check user preference before sending
        if (!await this.canSendEmail(passenger)) {
            console.log(`📧 Email skipped (user preference): Pickup confirmed to ${passenger.email}`);
            return { skipped: true, reason: 'User disabled email notifications' };
        }

        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: passenger.email,
            subject: '✅ Pickup Confirmed - You\'re On Your Way!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #2ECC71; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">✅ Pickup Confirmed!</h1>
                    </div>
                    <div style="padding: 30px; background-color: #f9f9f9;">
                        <p style="font-size: 16px;">Hi ${passenger.profile?.firstName || passenger.name || 'there'},</p>
                        <p>You've been picked up by <strong>${rideDetails.riderName}</strong>! Enjoy your ride.</p>
                        
                        <div style="background-color: #d4edda; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #28a745; text-align: center;">
                            <p style="margin: 0 0 10px 0; color: #155724; font-size: 14px;">YOUR DROPOFF OTP</p>
                            <h1 style="color: #155724; font-size: 48px; margin: 0; letter-spacing: 8px;">${rideDetails.dropoffOTP}</h1>
                            <p style="margin: 10px 0 0 0; color: #155724; font-size: 12px;">Share this with the rider when you reach your destination</p>
                        </div>

                        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
                            <p><strong>📍 Dropoff Location:</strong> ${rideDetails.dropoffLocation}</p>
                            <p><strong>🎫 Booking Ref:</strong> ${rideDetails.bookingReference}</p>
                        </div>

                        <p>Have a safe journey! 🚗</p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Pickup confirmed email sent to ${passenger.email}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending pickup confirmed email:', error);
            return false;
        }
    }

    /**
     * Send ride alert for matching routes
     * ✅ RESPECTS RIDE ALERTS PREFERENCE
     */
    static async sendRideAlert(user, rideDetails) {
        // ✅ Check user preference for ride alerts
        if (user?.preferences?.notifications?.rideAlerts === false) {
            console.log(`📧 Email skipped (ride alerts disabled): Ride alert to ${user.email}`);
            return { skipped: true, reason: 'User disabled ride alerts' };
        }
        
        // ✅ Also check general email preference
        if (!await this.canSendEmail(user)) {
            console.log(`📧 Email skipped (email disabled): Ride alert to ${user.email}`);
            return { skipped: true, reason: 'User disabled email notifications' };
        }

        const mailOptions = {
            from: `"${process.env.APP_NAME}" <${process.env.EMAIL_FROM}>`,
            to: user.email,
            subject: '🚗 New Ride Matches Your Route!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #3498DB; color: white; padding: 20px; text-align: center;">
                        <h1 style="margin: 0;">🚗 New Ride Alert!</h1>
                    </div>
                    <div style="padding: 30px; background-color: #f9f9f9;">
                        <p style="font-size: 16px;">Hi ${user.profile?.firstName || user.name || 'there'},</p>
                        <p>A new ride has been posted that matches your saved route!</p>
                        
                        <div style="background-color: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #3498DB;">
                            <p><strong>📍 From:</strong> ${rideDetails.from}</p>
                            <p><strong>📍 To:</strong> ${rideDetails.to}</p>
                            <p><strong>📅 Date:</strong> ${rideDetails.date}</p>
                            <p><strong>⏰ Time:</strong> ${rideDetails.time}</p>
                            <p><strong>💺 Available Seats:</strong> ${rideDetails.availableSeats}</p>
                            <p><strong>💰 Price:</strong> ₹${rideDetails.pricePerSeat}/seat</p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${rideDetails.rideUrl}" 
                               style="background-color: #2ECC71; color: white; padding: 15px 40px; 
                                      text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                View & Book Ride
                            </a>
                        </div>

                        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
                        <p style="color: #888; font-size: 12px; text-align: center;">
                            You're receiving this because you have ride alerts enabled.<br>
                            <a href="${process.env.APP_URL || 'http://localhost:3000'}/user/settings">Manage notification preferences</a>
                        </p>
                    </div>
                </div>
            `
        };

        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ Ride alert email sent to ${user.email}`);
            return true;
        } catch (error) {
            console.error('❌ Error sending ride alert email:', error);
            return false;
        }
    }
}

module.exports = EmailService;
