const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = 'http://localhost:3099/api';
const LOG_FILE = '/tmp/verify_trace_final.log';
const User = require('../models/User');
const { hashToken } = require('../utils/crypto');

const log = (msg) => {
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync(LOG_FILE, entry);
};

process.on('uncaughtException', (err) => {
    log(`FATAL: Uncaught Exception: ${err.message}\n${err.stack}`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    log(`FATAL: Unhandled Rejection: ${reason}`);
    process.exit(1);
});

async function injectOTP(email, otp = '123456') {
    const hashed = hashToken(otp);
    await User.updateOne({ email }, { otpCode: hashed, otpExpires: new Date(Date.now() + 600000) });
    return otp;
}

async function waitForServer(retries = 15) {
    for (let i = 0; i < retries; i++) {
        try {
            await axios.get(`${BASE_URL}/health`);
            log('Server is healthy and ready');
            return true;
        } catch (e) {
            log(`Waiting for server at ${BASE_URL}... (attempt ${i + 1}/${retries})`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
    throw new Error('Server did not become ready in time');
}

async function runTest() {
    try {
        if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
        log('--- STARTING FULL SYSTEM VERIFICATION ---');
        await waitForServer();

        log('Connecting to DB...');
        if (mongoose.connection.readyState !== 1) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        log('Cleaning existing test users...');
        await User.deleteMany({ email: { $in: ['p@test.com', 'r@test.com'] } });
        log('Cleaned test users from DB');

        const TEST_PASSWORD = 'Password123!';
        const TEST_OTP = '123456';

        // 1. REGISTER PASSENGER
        log('Phase 1: Passenger Registration');
        await axios.post(`${BASE_URL}/auth/register`, {
            name: 'Test Passenger',
            email: 'p@test.com',
            phone: '1111111111',
            password: TEST_PASSWORD,
            confirmPassword: TEST_PASSWORD,
            role: 'PASSENGER'
        });
        await injectOTP('p@test.com', TEST_OTP);
        log(`Injected OTP ${TEST_OTP} for passenger`);

        await axios.post(`${BASE_URL}/auth/verify-otp`, { email: 'p@test.com', otp: TEST_OTP });
        const pLogin = await axios.post(`${BASE_URL}/auth/login`, { email: 'p@test.com', password: TEST_PASSWORD });
        const pAuth = { Authorization: `Bearer ${pLogin.data.accessToken}` };
        log('Passenger logged in');

        // 2. REGISTER RIDER
        log('Phase 2: Rider Registration');
        await axios.post(`${BASE_URL}/auth/register`, {
            name: 'Test Rider',
            email: 'r@test.com',
            phone: '2222222222',
            password: TEST_PASSWORD,
            confirmPassword: TEST_PASSWORD,
            role: 'RIDER'
        });
        await injectOTP('r@test.com', TEST_OTP);
        log(`Injected OTP ${TEST_OTP} for rider`);

        await axios.post(`${BASE_URL}/auth/verify-otp`, { email: 'r@test.com', otp: TEST_OTP });
        const rLogin = await axios.post(`${BASE_URL}/auth/login`, { email: 'r@test.com', password: TEST_PASSWORD });
        const rAuth = { Authorization: `Bearer ${rLogin.data.accessToken}` };
        log('Rider logged in');

        // 3. ADMIN VERIFY RIDER
        log('Phase 3: Admin Verification');
        const aLogin = await axios.post(`${BASE_URL}/auth/login`, { email: 'admin@looplane.com', password: 'AdminPassword123!' });
        const aAuth = { Authorization: `Bearer ${aLogin.data.accessToken}` };

        const meR = await axios.get(`${BASE_URL}/auth/me`, { headers: rAuth });
        const riderId = meR.data.user._id;

        // Simulating document submission
        await User.updateOne({ _id: riderId }, { verificationStatus: 'PENDING' });
        log('Rider status set to PENDING for verification');

        await axios.post(`${BASE_URL}/admin/verifications/${riderId}/verify`, {
            notes: 'Verified by system test'
        }, { headers: aAuth });
        log('Rider verified by Admin');

        // 4. POST RIDE
        log('Phase 4: Ride Lifecycle');
        log('Adding vehicle for rider...');
        // Correct path for vehicle addition based on routes/user.js (singular)
        await axios.post(`${BASE_URL}/user/vehicle`, {
            make: 'Tesla', model: 'Model 3', year: 2024, color: 'White', licensePlate: `TEST-${Date.now()}`,
            seats: 4, vehicleType: 'SEDAN'
        }, { headers: rAuth });

        const meR2 = await axios.get(`${BASE_URL}/auth/me`, { headers: rAuth });
        const vehicleId = meR2.data.user.vehicles[0]._id;

        // Simulating vehicle approval
        await User.updateOne(
            { _id: riderId, "vehicles._id": vehicleId },
            { $set: { "vehicles.$.status": 'APPROVED' } }
        );
        log('Vehicle set to APPROVED for ride posting');

        const rideResp = await axios.post(`${BASE_URL}/rides/post`, {
            fromLocation: 'Koramangala, Bangalore', toLocation: 'Whitefield, Bangalore',
            originCoordinates: { coordinates: [77.6296, 12.9352] },
            destinationCoordinates: { coordinates: [77.7480, 12.9698] },
            departureTime: new Date(Date.now() + 3600000).toISOString(),
            availableSeats: 4,
            pricePerSeat: 100,
            vehicleId
        }, { headers: rAuth });
        const rideId = rideResp.data.ride._id;
        log(`Ride posted: ${rideId}`);

        // 5. BOOKING
        log('Phase 5: Booking Lifecycle');
        const bookResp = await axios.post(`${BASE_URL}/bookings/create/${rideId}`, {
            seats: 1, pickupLocation: { name: 'Koramangala', coordinates: [77.6296, 12.9352] }
        }, { headers: pAuth });
        const bookingId = bookResp.data.booking._id;
        log(`Booking created: ${bookingId}`);

        log('Rider accepting booking...');
        await axios.post(`${BASE_URL}/bookings/${bookingId}/accept`, {}, { headers: rAuth });
        log('Booking accepted');

        log('--- ALL PHASES SUCCESSFUL ---');
        process.exit(0);
    } catch (error) {
        log('--- TEST FAILED ---');
        if (error.response) {
            log(`Status: ${error.response.status}`);
            log(`Data: ${JSON.stringify(error.response.data)}`);
            if (error.response.data.errorsByField) {
                log(`Validation Errors: ${JSON.stringify(error.response.data.errorsByField)}`);
            }
        } else {
            log(`Error: ${error.message}`);
            log(error.stack);
        }
        process.exit(1);
    }
}

runTest();
