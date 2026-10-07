require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../models');

const fieldsToRemove = {
    country: 1,
    RHtype: 1,
    googleHealthScopes: 1,
    googleHealthLegacyUserId: 1,
    mobileno: 1,
    bloodGroup: 1,
};

const run = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required.');
    }

    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    const filter = { $or: Object.keys(fieldsToRemove).map((field) => ({ [field]: { $exists: true } })) };
    const count = await User.countDocuments(filter);

    if (process.argv.includes('--dry-run')) {
        console.log(`${count} user documents contain fields scheduled for removal. No changes were made.`);
        return;
    }

    const result = await User.updateMany(filter, { $unset: fieldsToRemove });
    console.log(`Unused user fields removed from ${result.modifiedCount} documents.`);
};

run()
    .catch((error) => {
        console.error(`User field cleanup failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
