require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const existingAdmin = await User.findOne({ email: 'admin@looplane.com' });
        if (existingAdmin) {
            console.log('Admin user already exists');
            process.exit(0);
        }

        const admin = new User({
            email: 'admin@looplane.com',
            phone: '9999988888',
            password: 'AdminPassword123!',
            role: 'SUPER_ADMIN',
            profile: {
                firstName: 'System',
                lastName: 'Admin'
            },
            emailVerified: true,
            phoneVerified: true,
            verificationStatus: 'VERIFIED'
        });

        await admin.save();
        console.log('✅ Super Admin created successfully: admin@looplane.com / AdminPassword123!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin:', error);
        process.exit(1);
    }
}

createAdmin();
