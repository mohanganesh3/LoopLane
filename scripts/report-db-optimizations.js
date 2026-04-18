/* eslint-disable no-console */

require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Ride = require('../models/Ride');
const SearchLog = require('../models/SearchLog');
const Emergency = require('../models/Emergency');

function collectIndexNames(plan, names = new Set()) {
    if (!plan || typeof plan !== 'object') return names;

    if (plan.indexName) {
        names.add(plan.indexName);
    }

    for (const value of Object.values(plan)) {
        if (Array.isArray(value)) {
            value.forEach((entry) => collectIndexNames(entry, names));
        } else if (value && typeof value === 'object') {
            collectIndexNames(value, names);
        }
    }

    return names;
}

function collectStages(plan, stages = new Set()) {
    if (!plan || typeof plan !== 'object') return stages;

    if (plan.stage) {
        stages.add(plan.stage);
    }

    for (const value of Object.values(plan)) {
        if (Array.isArray(value)) {
            value.forEach((entry) => collectStages(entry, stages));
        } else if (value && typeof value === 'object') {
            collectStages(value, stages);
        }
    }

    return stages;
}

function summarizeExplain(explain) {
    const winningPlan = explain?.queryPlanner?.winningPlan || {};
    const executionStats = explain?.executionStats || {};

    return {
        stages: Array.from(collectStages(winningPlan)),
        indexesUsed: Array.from(collectIndexNames(winningPlan)),
        totalKeysExamined: executionStats.totalKeysExamined ?? null,
        totalDocsExamined: executionStats.totalDocsExamined ?? null,
        executionTimeMillis: executionStats.executionTimeMillis ?? null,
        nReturned: executionStats.nReturned ?? null
    };
}

async function explainBookingHistory() {
    const sample = await Booking.findOne({ passenger: { $exists: true }, status: { $exists: true } })
        .sort({ createdAt: -1 })
        .select('passenger status')
        .lean();

    if (!sample) {
        return { skipped: 'No booking documents available for explain()' };
    }

    const explain = await Booking.collection
        .find({ passenger: sample.passenger, status: sample.status })
        .sort({ createdAt: -1 })
        .limit(10)
        .explain('executionStats');

    return {
        pattern: 'Booking history by passenger + status sorted by newest first',
        filter: {
            passenger: String(sample.passenger),
            status: sample.status
        },
        summary: summarizeExplain(explain)
    };
}

async function explainUpcomingRides() {
    const sample = await Ride.findOne({
        status: { $exists: true },
        'schedule.departureDateTime': { $type: 'date' }
    })
        .sort({ 'schedule.departureDateTime': 1 })
        .select('status schedule.departureDateTime')
        .lean();

    if (!sample) {
        return { skipped: 'No ride documents available for explain()' };
    }

    const explain = await Ride.collection
        .find({
            status: sample.status,
            'schedule.departureDateTime': { $gte: sample.schedule.departureDateTime }
        })
        .sort({ 'schedule.departureDateTime': 1 })
        .limit(10)
        .explain('executionStats');

    return {
        pattern: 'Upcoming rides by status + departureDateTime',
        filter: {
            status: sample.status,
            departureDateTimeGte: sample.schedule.departureDateTime
        },
        summary: summarizeExplain(explain)
    };
}

async function explainCorporateUsers() {
    const sample = await User.findOne({
        'corporate.organization': { $exists: true, $ne: null }
    })
        .select('corporate.organization')
        .lean();

    if (!sample) {
        return { skipped: 'No corporate users found for explain()' };
    }

    const explain = await User.collection
        .find({ 'corporate.organization': sample.corporate.organization })
        .limit(10)
        .explain('executionStats');

    return {
        pattern: 'Corporate/B2B user lookup by organization',
        filter: {
            organization: sample.corporate.organization
        },
        summary: summarizeExplain(explain)
    };
}

async function explainEmergencyLookup() {
    const sample = await Emergency.findOne({
        user: { $exists: true },
        status: { $exists: true }
    })
        .sort({ triggeredAt: -1 })
        .select('user status')
        .lean();

    if (!sample) {
        return { skipped: 'No emergency documents available for explain()' };
    }

    const explain = await Emergency.collection
        .find({ user: sample.user, status: sample.status })
        .limit(10)
        .explain('executionStats');

    return {
        pattern: 'Emergency lookups by user + status',
        filter: {
            user: String(sample.user),
            status: sample.status
        },
        summary: summarizeExplain(explain)
    };
}

async function getIndexSummary(model, label) {
    const indexes = await model.collection.indexes();

    return {
        collection: model.collection.collectionName,
        label,
        indexes: indexes.map((index) => ({
            name: index.name,
            key: index.key,
            unique: Boolean(index.unique),
            sparse: Boolean(index.sparse),
            expireAfterSeconds: index.expireAfterSeconds ?? null,
            partialFilterExpression: index.partialFilterExpression || null
        }))
    };
}

async function main() {
    await connectDB();

    const report = {
        generatedAt: new Date().toISOString(),
        databaseName: mongoose.connection.name,
        indexInventory: await Promise.all([
            getIndexSummary(User, 'Users'),
            getIndexSummary(Booking, 'Bookings'),
            getIndexSummary(Ride, 'Rides'),
            getIndexSummary(SearchLog, 'Search logs'),
            getIndexSummary(Emergency, 'Emergencies')
        ]),
        explainPlans: await Promise.all([
            explainCorporateUsers(),
            explainBookingHistory(),
            explainUpcomingRides(),
            explainEmergencyLookup()
        ])
    };

    console.log(JSON.stringify(report, null, 2));

    await mongoose.connection.close();
}

main().catch(async (error) => {
    console.error(`DB optimization report failed: ${error.message}`);

    try {
        await mongoose.connection.close();
    } catch {
        // ignore
    }

    process.exit(1);
});
