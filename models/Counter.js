/**
 * Counter Model
 * Provides atomic, ever-incrementing sequences for human-readable IDs.
 * Example: bookingRef counter drives  BK-YYYYMMDD-AAA001
 */

const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true }, // e.g. 'bookingRef'
    seq:  { type: Number, default: 0 }
});

/**
 * Atomically increment the counter and return the NEW value.
 * Creates the counter document if it doesn't exist yet.
 */
counterSchema.statics.nextSeq = async function (name) {
    const doc = await this.findOneAndUpdate(
        { name },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    return doc.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
