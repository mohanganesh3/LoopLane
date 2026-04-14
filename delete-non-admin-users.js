/**
 * Script to delete all users except ADMIN accounts
 * Run with: node delete-non-admin-users.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

const ADMIN_PANEL_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'SUPPORT_AGENT',
  'FINANCE_MANAGER',
  'OPERATIONS_MANAGER',
  'CONTENT_MODERATOR',
  'FLEET_MANAGER'
];

const run = async () => {
  try {
    // Connect to MongoDB
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    const User = require('./models/User');

    // Count users before deletion
    const totalBefore = await User.countDocuments({});
    const adminCount = await User.countDocuments({ role: { $in: ADMIN_PANEL_ROLES } });
    const nonAdminCount = await User.countDocuments({ role: { $nin: ADMIN_PANEL_ROLES } });

    console.log('\n📊 Current User Stats:');
    console.log(`   Total users: ${totalBefore}`);
    console.log(`   Admin users: ${adminCount}`);
    console.log(`   Non-admin users: ${nonAdminCount}`);

    // Delete all non-admin-panel users
    console.log('\n🗑️  Deleting all non-admin users...');
    const result = await User.deleteMany({ role: { $nin: ADMIN_PANEL_ROLES } });

    console.log(`✅ Deleted ${result.deletedCount} non-admin users`);

    // Count users after deletion
    const totalAfter = await User.countDocuments({});
    console.log(`\n📊 Remaining users: ${totalAfter} (all admins)`);

    // List remaining admin users
    const admins = await User.find({ role: { $in: ADMIN_PANEL_ROLES } }).select('email role profile.firstName profile.lastName');
    console.log('\n👤 Remaining Admin Accounts:');
    admins.forEach(admin => {
      console.log(`   - ${admin.email} [${admin.role}] (${admin.profile?.firstName || 'N/A'} ${admin.profile?.lastName || ''})`);
    });

    // Also clean up related data (optional but recommended)
    console.log('\n🧹 Cleaning up related data...');
    
    const Booking = require('./models/Booking');
    const Ride = require('./models/Ride');
    const Chat = require('./models/Chat');
    const Review = require('./models/Review');
    const Notification = require('./models/Notification');

    const activeUserIds = await User.find().distinct('_id');
    
    // Delete bookings where passenger or rider no longer exists
    const bookingsDeleted = await Booking.deleteMany({
      $or: [
        { passenger: { $nin: activeUserIds } },
        { rider: { $nin: activeUserIds } }
      ]
    });
    console.log(`   Deleted ${bookingsDeleted.deletedCount} orphaned bookings`);
    
    // Delete rides where rider no longer exists
    const ridesDeleted = await Ride.deleteMany({
      rider: { $nin: activeUserIds }
    });
    console.log(`   Deleted ${ridesDeleted.deletedCount} orphaned rides`);
    
    // Delete chats with non-existent users
    const chatsDeleted = await Chat.deleteMany({
      participants: {
        $elemMatch: { $nin: activeUserIds }
      }
    });
    console.log(`   Deleted ${chatsDeleted.deletedCount} orphaned chats`);
    
    // Delete reviews with non-existent users
    const reviewsDeleted = await Review.deleteMany({
      $or: [
        { reviewer: { $nin: activeUserIds } },
        { reviewee: { $nin: activeUserIds } }
      ]
    });
    console.log(`   Deleted ${reviewsDeleted.deletedCount} orphaned reviews`);
    
    // Delete notifications for non-existent users
    const notificationsDeleted = await Notification.deleteMany({
      user: { $nin: activeUserIds }
    });
    console.log(`   Deleted ${notificationsDeleted.deletedCount} orphaned notifications`);

    console.log('\n✅ Cleanup complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 MongoDB connection closed');
    process.exit(0);
  }
};

run();
