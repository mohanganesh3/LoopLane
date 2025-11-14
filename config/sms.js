/**
 * SMS Service Configuration
 * Uses Twilio for SMS notifications
 */

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

let client = null;

// Only initialize Twilio if credentials are properly configured
if (accountSid && accountSid.startsWith('AC') && authToken) {
    try {
        const twilio = require('twilio');
        client = twilio(accountSid, authToken);
        
        // Test connection
        client.api.accounts(accountSid)
            .fetch()
            .then(() => console.log('✅ Twilio SMS service connected'))
            .catch(err => console.error('❌ Twilio connection error:', err.message));
    } catch (error) {
        console.warn('⚠️ Twilio SMS service not configured:', error.message);
    }
} else {
    console.warn('⚠️ Twilio SMS service not configured - SMS features will be disabled');
}

module.exports = { client, twilioPhone };
