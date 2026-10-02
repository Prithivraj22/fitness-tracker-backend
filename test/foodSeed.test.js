const assert = require('node:assert/strict');
const test = require('node:test');

const starterFoods = require('../data/starterFoods');
const { buildFoodSeedOperations, validateFoodSeed } = require('../foodSeed');

test('starter foods have unique names, serving descriptions, and valid nutrients', () => {
    assert.equal(validateFoodSeed(starterFoods), starterFoods);
    assert.equal(new Set(starterFoods.map((food) => food.dish_name.toLowerCase())).size, starterFoods.length);
});

test('food seeding uses idempotent upserts keyed by dish name', () => {
    const operations = buildFoodSeedOperations(starterFoods);
    assert.equal(operations.length, starterFoods.length);
    assert.deepEqual(operations[0], {
        updateOne: {
            filter: { dish_name: starterFoods[0].dish_name },
            update: { $set: starterFoods[0] },
            upsert: true,
        },
    });
});

test('invalid and duplicate seed records are rejected', () => {
    assert.throws(() => validateFoodSeed([]), /at least one/);
    assert.throws(() => validateFoodSeed([
        starterFoods[0],
        { ...starterFoods[0], dish_name: starterFoods[0].dish_name.toUpperCase() },
    ]), /Duplicate food name/);
    assert.throws(() => validateFoodSeed([
        { ...starterFoods[0], calorie: -1 },
    ]), /invalid calorie/);
});
