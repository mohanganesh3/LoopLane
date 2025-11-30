/**
 * Database Seeder
 * Creates initial admin user and sample data
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const connectDB = require('./config/database');

const seedAdmin = async () => {
    try {
        console.log('🌱 Starting database seeding...');

        // Connect to database
        await connectDB();

        // Check if admin already exists
        const existingAdmin = await User.findOne({ role: 'ADMIN' });

        if (existingAdmin) {
            console.log('✅ Admin user already exists:', existingAdmin.email);
            process.exit(0);
        }

        // Create admin user
        const admin = await User.create({
            email: 'admin@lanecarpool.com',
            password: 'Admin@123',
            phone: '9999999999',
            role: 'ADMIN',
            emailVerified: true,
            phoneVerified: true,
            profile: {
                firstName: 'Admin',
                lastName: 'User'
            }
        });

        console.log('✅ Admin user created successfully!');
        console.log('📧 Email: admin@lanecarpool.com');
        console.log('🔐 Password: Admin@123');
        console.log('⚠️  Please change the admin password after first login!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
};

const seedSampleData = async () => {
    try {
        console.log('🌱 Starting sample data seeding...');

        await connectDB();

        // Clear existing data
        console.log('Clearing existing data...');
        await User.deleteMany({ role: { $ne: 'ADMIN' } });

        // Create sample riders - use create() instead of insertMany() to trigger password hashing
        const rider1 = await User.create({
            email: 'john@example.com',
            phone: '9876543210',
            password: 'Password@123',
            role: 'RIDER',
            emailVerified: true,
            phoneVerified: true,
            verificationStatus: 'VERIFIED',
            profile: {
                firstName: 'John',
                lastName: 'Doe',
                bio: 'Experienced driver with 5 years of carpooling'
            },
            vehicles: [
                {
                    type: 'SEDAN',
                    make: 'Honda',
                    model: 'City',
                    year: 2020,
                    licensePlate: 'MH01AB1234',
                    color: 'White',
                    seats: 4,
                    status: 'APPROVED'
                }
            ],
            documents: {
                driverLicense: {
                    frontImage: '/uploads/sample-license.jpg',
                    status: 'APPROVED'
                }
            }
        });

        const rider2 = await User.create({
            email: 'sarah@example.com',
            phone: '9876543211',
            password: 'Password@123',
            role: 'RIDER',
            emailVerified: true,
            phoneVerified: true,
            verificationStatus: 'VERIFIED',
            profile: {
                firstName: 'Sarah',
                lastName: 'Smith',
                bio: 'Love driving and meeting new people'
            },
            vehicles: [
                {
                    type: 'SUV',
                    make: 'Toyota',
                    model: 'Fortuner',
                    year: 2021,
                    licensePlate: 'MH12CD5678',
                    color: 'Black',
                    seats: 6,
                    status: 'APPROVED'
                }
            ],
            documents: {
                driverLicense: {
                    frontImage: '/uploads/sample-license.jpg',
                    status: 'APPROVED'
                }
            }
        });

        console.log('✅ Sample riders created');

        // Create sample passengers (auto-verified, no documents needed)
        const passenger1 = await User.create({
            email: 'alice@example.com',
            phone: '9876543212',
            password: 'Password@123',
            role: 'PASSENGER',
            emailVerified: true,
            phoneVerified: true,
            verificationStatus: 'VERIFIED',
            profile: {
                firstName: 'Alice',
                lastName: 'Johnson',
                bio: 'Regular commuter looking for eco-friendly rides'
            }
        });

        const passenger2 = await User.create({
            email: 'bob@example.com',
            phone: '9876543213',
            password: 'Password@123',
            role: 'PASSENGER',
            emailVerified: true,
            phoneVerified: true,
            verificationStatus: 'VERIFIED',
            profile: {
                firstName: 'Bob',
                lastName: 'Williams',
                bio: 'Student traveling to campus daily'
            }
        });

        console.log('✅ Sample passengers created');

        console.log('\n✅ Sample data seeding completed!');
        console.log('\nSample Credentials:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('Rider 1: john@example.com / Password@123');
        console.log('Rider 2: sarah@example.com / Password@123');
        console.log('Passenger 1: alice@example.com / Password@123');
        console.log('Passenger 2: bob@example.com / Password@123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Sample data seeding error:', error);
        process.exit(1);
    }
};

// Run seeder based on argument
const command = process.argv[2];

if (command === 'admin') {
    seedAdmin();
} else if (command === 'sample') {
    seedSampleData();
} else {
    console.log('Usage:');
    console.log('  npm run seed:admin   - Create admin user');
    console.log('  npm run seed:sample  - Create sample data');
    process.exit(0);
}
