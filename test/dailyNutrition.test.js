const assert = require('node:assert/strict');
const test = require('node:test');

const { calculateNutrition, getNutritionDate } = require('../dailyNutrition');

test('daily nutrition is calculated from the server-side food record', () => {
    const nutrition = calculateNutrition({
        dish_name: 'Idli',
        calorie: 58,
        protein: 2,
        fat: 0.4,
        carbs: 12,
    }, 2.5);

    assert.deepEqual(nutrition, {
        calories: 145,
        protein: 5,
        fat: 1,
        carbs: 30,
    });
});

test('invalid quantities and invalid calendar dates are rejected', () => {
    const food = { dish_name: 'Idli', calorie: 58, protein: 2, fat: 0.4, carbs: 12 };
    assert.throws(() => calculateNutrition(food, 0), /Quantity/);
    assert.throws(() => calculateNutrition(food, 101), /Quantity/);
    assert.throws(() => getNutritionDate('2026-02-30'), /valid calendar date/);
});

test('nutrition dates use a stable UTC database key', () => {
    const result = getNutritionDate('2026-10-02');
    assert.equal(result.value, '2026-10-02');
    assert.equal(result.start.toISOString(), '2026-10-02T00:00:00.000Z');
});
