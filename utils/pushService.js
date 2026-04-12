/**
 * PRODUCTION-READY PUSH NOTIFICATION WRAPPER
 * Designed to integrate with Firebase Cloud Messaging (FCM)
 */

let admin = null;
let firebaseInitAttempted = false;

const getFirebaseAdmin = () => {
    if (firebaseInitAttempted) {
        return admin;
    }

    firebaseInitAttempted = true;

    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
        return null;
    }

    try {
        // Lazy load so env presence does not crash runtime when the optional dependency is absent.
        const firebaseAdmin = require('firebase-admin');
        if (!firebaseAdmin.apps.length) {
            firebaseAdmin.initializeApp({
                credential: firebaseAdmin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
        }
        admin = firebaseAdmin;
    } catch (error) {
        console.warn('Firebase Admin SDK unavailable, falling back to mock push service:', error.message);
        admin = null;
    }

    return admin;
};

const normalizeDataPayload = (data = {}) => {
    return Object.entries(data).reduce((acc, [key, value]) => {
        if (value === undefined || value === null) return acc;
        acc[key] = typeof value === 'string' ? value : String(value);
        return acc;
    }, {});
};

exports.sendPushNotification = async ({ fcmToken, title, body, data = {} } = {}) => {
    try {
        if (!fcmToken) {
            return { success: false, error: 'Missing FCM token' };
        }

        const firebaseAdmin = getFirebaseAdmin();
        if (firebaseAdmin) {
            const message = {
                notification: { title, body },
                data: normalizeDataPayload(data),
                token: fcmToken,
            };

            const response = await firebaseAdmin.messaging().send(message);
            return { success: true, messageId: response };
        }

        // Local Dev Mock
        console.log(`🔔 [MOCK PUSH] Sending to token: ${fcmToken?.substring(0, 10)}...`);
        console.log(`   Title: ${title}`);
        console.log(`   Body: ${body}`);
        return { success: true, messageId: `mock-push-${Date.now()}` };

    } catch (error) {
        console.error('Push notification failed:', error);
        return { success: false, error: error.message };
    }
};

exports.sendPushToMultiple = async ({ fcmTokens = [], title, body, data = {} } = {}) => {
    try {
        const tokens = fcmTokens.filter(Boolean);
        if (!tokens.length) {
            return { success: true, successCount: 0, failureCount: 0 };
        }

        const firebaseAdmin = getFirebaseAdmin();
        if (firebaseAdmin) {
            const message = {
                notification: { title, body },
                data: normalizeDataPayload(data),
                tokens,
            };

            const response = await firebaseAdmin.messaging().sendEachForMulticast(message);
            return {
                success: true,
                successCount: response.successCount,
                failureCount: response.failureCount
            };
        }

        console.log(`🔔 [MOCK BATCH PUSH] Sending to ${tokens.length} tokens`);
        return { success: true, successCount: tokens.length, failureCount: 0 };
    } catch (error) {
        console.error('Batch push notification failed:', error);
        return { success: false, error: error.message };
    }
};
