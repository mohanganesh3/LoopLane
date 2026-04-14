/**
 * Force Drop ALL Emergency Indexes and Recreate Them
 */

const mongoose = require('mongoose');
require('dotenv').config();
const Emergency = require('./models/Emergency');

async function resetIndexes() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/looplane');
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('emergencies');

        console.log('\n📋 Current indexes:');
        const indexes = await collection.indexes();
        indexes.forEach(index => {
            console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
        });

        // Drop ALL indexes except _id (can't drop _id)
        console.log('\n🗑️  Dropping all indexes (except _id)...');
        for (const index of indexes) {
            if (index.name !== '_id_') {
                try {
                    await collection.dropIndex(index.name);
                    console.log(`  ✅ Dropped: ${index.name}`);
                } catch (error) {
                    console.log(`  ❌ Could not drop ${index.name}: ${error.message}`);
                }
            }
        }

        // Rebuild the current model-defined indexes instead of hardcoding stale ones.
        console.log('\n🔧 Recreating indexes from current Emergency model...');
        await Emergency.syncIndexes();
        console.log('  ✅ Model indexes synced successfully');

        console.log('\n📋 Final indexes:');
        const finalIndexes = await collection.indexes();
        finalIndexes.forEach(index => {
            console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
        });

        console.log('\n✅ Index reset completed successfully!');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error resetting indexes:', error);
        process.exit(1);
    }
}

resetIndexes();
