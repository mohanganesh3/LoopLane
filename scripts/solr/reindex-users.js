/* eslint-disable no-console */

/**
 * Reindex users from MongoDB into Solr.
 *
 * Usage:
 *   node scripts/solr/reindex-users.js
 *   node scripts/solr/reindex-users.js --delete-all
 *
 * Requires:
 *   - MONGODB_URI
 *   - SOLR_URL (e.g. http://localhost:8983/solr)
 */

require('dotenv').config();

const connectDB = require('../../config/database');
const User = require('../../models/User');
const { isSolrEnabled, deleteUsersByQuery, upsertUsers } = require('../../utils/solrClient');

const BATCH_SIZE = Number(process.env.SOLR_REINDEX_BATCH_SIZE || 500);

function toSolrDoc(user) {
    return {
        id: user._id.toString(),
        email_t: user.email || '',
        phone_t: user.phone || '',
        firstName_t: user.profile?.firstName || '',
        lastName_t: user.profile?.lastName || '',
        fullName_t: `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim(),
        role_s: user.role || '',
        accountStatus_s: user.accountStatus || '',
        verificationStatus_s: user.verificationStatus || ''
    };
}

async function main() {
    const args = new Set(process.argv.slice(2));
    const shouldDeleteAll = args.has('--delete-all');

    if (!isSolrEnabled()) {
        throw new Error('SOLR_URL is not set. Cannot reindex.');
    }

    await connectDB();

    if (shouldDeleteAll) {
        console.log('Deleting existing Solr docs (users core): *:*');
        await deleteUsersByQuery('*:*', { commit: true });
    }

    const filter = { role: { $ne: 'ADMIN' } };
    const cursor = User.find(filter)
        .select('email phone role accountStatus verificationStatus profile.firstName profile.lastName')
        .lean()
        .cursor();

    let batch = [];
    let total = 0;

    console.log('Indexing users into Solr...');

    for await (const user of cursor) {
        batch.push(toSolrDoc(user));

        if (batch.length >= BATCH_SIZE) {
            await upsertUsers(batch, { commit: true });
            total += batch.length;
            console.log(`Indexed ${total} users...`);
            batch = [];
        }
    }

    if (batch.length) {
        await upsertUsers(batch, { commit: true });
        total += batch.length;
    }

    console.log(`Done. Indexed ${total} users.`);
}

main().catch((err) => {
    console.error(`Reindex failed: ${err.message}`);
    process.exit(1);
});
