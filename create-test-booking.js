#!/usr/bin/env node
/**
 * Create test data for Tracking & Chat functionality
 * Run: node create-test-booking.js
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('✅ Connected to MongoDB');
    createTestData();
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// Import models
const User = require('./models/User');
const Ride = require('./models/Ride');
const Booking = require('./models/Booking');

async function createTestData() {
    try {
        console.log('\n🔍 Finding users...');
        
        // Get two different users
        const rider = await User.findOne({ role: 'RIDER' });
        const passenger = await User.findOne({ 
            role: { $in: ['RIDER', 'PASSENGER'] },
            _id: { $ne: rider._id }
        });

        if (!rider || !passenger) {
            console.error('❌ Not enough users found. Please create at least 2 users.');
            process.exit(1);
        }

        console.log('✅ Found users:');
        console.log('  Rider:', rider.profile.firstName, rider.email);
        console.log('  Passenger:', passenger.profile.firstName, passenger.email);

        console.log('\n📍 Creating ride...');
        
        // Get rider's first vehicle or create a dummy reference
        let vehicleId = rider.vehicles && rider.vehicles.length > 0 
            ? rider.vehicles[0] 
            : new mongoose.Types.ObjectId(); // Dummy ID for testing
        
        // Create a ride with all required fields
        const departureDate = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours from now
        const ride = await Ride.create({
            rider: rider._id,
            vehicle: vehicleId,
            route: {
                start: {
                    name: 'IIIT Sri City',
                    address: 'IIIT Sri City, Chittoor, Andhra Pradesh',
                    coordinates: [80.0390, 13.5493]
                },
                destination: {
                    name: 'Tirupati Railway Station',
                    address: 'Tirupati, Andhra Pradesh',
                    coordinates: [79.4192, 13.6288]
                },
                distance: 65,
                duration: 90
            },
            schedule: {
                date: departureDate,
                time: departureDate.toTimeString().slice(0, 5), // "HH:MM"
                departureDateTime: departureDate,
                flexibleTiming: false
            },
            pricing: {
                pricePerSeat: 200,
                totalSeats: 4,
                availableSeats: 3,
                totalEarnings: 0
            },
            status: 'IN_PROGRESS',
            tracking: {
                isLive: true,
                currentLocation: {
                    coordinates: [80.0390, 13.5493],
                    timestamp: new Date()
                },
                startedAt: new Date(),
                breadcrumbs: []
            },
            preferences: {
                smoking: false,
                pets: false,
                music: 'OPEN_TO_REQUESTS'
            }
        });

        console.log('✅ Ride created:', ride._id);

        console.log('\n📝 Creating booking...');

        // Create a booking
        const booking = await Booking.create({
            ride: ride._id,
            rider: rider._id,
            passenger: passenger._id,
            pickupPoint: {
                name: 'IIIT Sri City Main Gate',
                address: 'IIIT Sri City, Chittoor',
                coordinates: [80.0390, 13.5493],
                distanceFromStart: 0,
                estimatedTime: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
            },
            dropoffPoint: {
                name: 'Tirupati Railway Station',
                address: 'Tirupati',
                coordinates: [79.4192, 13.6288],
                distanceFromEnd: 0,
                estimatedTime: new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString()
            },
            seatsBooked: 1,
            totalPrice: 200,
            status: 'PICKUP_PENDING',
            payment: {
                amount: 200,
                rideFare: 180,
                platformCommission: 20,
                totalAmount: 200,
                status: 'PAID',
                method: 'CASH',
                transactionId: `TEST_${Date.now()}`
            },
            verification: {
                pickup: {
                    code: '1234',
                    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
                },
                dropoff: {
                    code: '5678',
                    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
                }
            }
        });

        await Ride.findByIdAndUpdate(ride._id, {
            $set: {
                bookings: [booking._id],
                'pricing.totalEarnings': booking.totalPrice
            }
        });

        console.log('✅ Booking created:', booking._id);

        console.log('\n✨ Test data created successfully!\n');
        console.log('=' .repeat(60));
        console.log('TEST URLs:');
        console.log('=' .repeat(60));
        console.log(`\n📍 Tracking (with booking ID):`);
        console.log(`   http://localhost:5173/tracking/${booking._id}`);
        console.log(`\n🚨 Safety flow:`);
        console.log(`   http://localhost:5173/tracking/${booking._id}/safety`);
        console.log(`\n💬 Chat as passenger (talk to rider):`);
        console.log(`   http://localhost:5173/chat/${rider._id}`);
        console.log(`\n💬 Chat as rider (talk to passenger):`);
        console.log(`   http://localhost:5173/chat/${passenger._id}`);
        console.log('\n' + '='.repeat(60));
        console.log('\n💡 Login as either:');
        console.log(`   Rider: ${rider.email}`);
        console.log(`   Passenger: ${passenger.email}`);
        console.log('\n🔐 Test OTPs: pickup=1234, dropoff=5678');
        console.log('\n✅ Both users can access tracking and chat!\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating test data:', error);
        process.exit(1);
    }
}
