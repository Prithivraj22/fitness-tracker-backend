require('dotenv').config();
const mongoose = require('mongoose');
const { Food } = require('../models');
const starterFoods = require('../data/starterFoods');
const { buildFoodSeedOperations } = require('../foodSeed');

const run = async () => {
    const operations = buildFoodSeedOperations(starterFoods);
    if (process.argv.includes('--dry-run')) {
        console.log(`Validated ${operations.length} starter foods. No database changes were made.`);
        return;
    }

    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI is required. Copy .env.example to .env and configure it first.');
    }

    await mongoose.connect(process.env.MONGO_URI);
    const result = await Food.bulkWrite(operations, { ordered: true });
    console.log(
        `Food seed complete: ${result.upsertedCount} added, ${result.modifiedCount} updated, ${result.matchedCount} matched.`
    );
};

run()
    .catch((error) => {
        console.error(`Food seed failed: ${error.message}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        await mongoose.disconnect();
    });
