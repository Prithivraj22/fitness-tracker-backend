require('dotenv').config();
const mongoose = require('mongoose');
const { User } = require('../models');

const missingDisplayName = {
    $or: [
        { displayName: { $exists: false } },
        { displayName: null },
        { displayName: '' },
    ],
};

const run = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required. Copy .env.example to .env and configure it first.');
    }

    await mongoose.connect(process.env.MONGO_URI);
    const count = await User.countDocuments(missingDisplayName);
    if (process.argv.includes('--dry-run')) {
        console.log(`${count} user profiles need a display-name migration. No changes were made.`);
        return;
    }

    const result = await User.updateMany(
        missingDisplayName,
        [{ $set: { displayName: '$username' } }]
    );
    console.log(`Profile migration complete: ${result.modifiedCount} users updated.`);
};

run()
    .catch((error) => {
        console.error(`Profile migration failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
