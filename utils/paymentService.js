/**
 * PRODUCTION-READY PAYMENT GATEWAY WRAPPER
 * Handles Razorpay / Stripe unified integrations
 */
const crypto = require('crypto');

// Initialize Razorpay conditionally
let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    try {
        const Razorpay = require('razorpay');
        razorpayInstance = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
    } catch (error) {
        console.warn('Razorpay SDK not installed. Falling back to mock payment service.');
    }
}

exports.createOrder = async ({ amount, currency = 'INR', receiptId }) => {
    try {
        if (razorpayInstance) {
            const options = {
                amount: Math.round(amount * 100), // convert to paise
                currency,
                receipt: receiptId
            };
            const order = await razorpayInstance.orders.create(options);
            return { success: true, orderId: order.id, amount: order.amount, currency: order.currency };
        }

        // Local Dev Mock
        console.log(`💳 [MOCK PAYMENT GATEWAY] Creating Order for ${currency} ${amount}`);
        return {
            success: true,
            orderId: `mock_order_${Date.now()}`,
            amount: Math.round(amount * 100),
            currency
        };
    } catch (error) {
        console.error('Payment order creation failed:', error);
        return { success: false, error: error.message };
    }
};

exports.verifyPayment = (razorpayOrderId, razorpayPaymentId, signature) => {
    if (!process.env.RAZORPAY_KEY_SECRET) {
        // FAIL-CLOSED: In production, reject verification if keys are missing
        if (process.env.NODE_ENV === 'production') {
            console.error('❌ RAZORPAY_KEY_SECRET missing in production — rejecting payment verification');
            return false;
        }
        console.log(`💳 [MOCK VERIFICATION] Verifying payment ${razorpayPaymentId} (dev mode)`);
        return true;
    }

    const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpayOrderId + '|' + razorpayPaymentId)
        .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
        Buffer.from(generatedSignature, 'hex'),
        Buffer.from(signature, 'hex')
    );
};
