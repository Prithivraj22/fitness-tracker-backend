const NUTRIENT_FIELDS = ['calorie', 'protein', 'fat', 'carbs'];

const validateFoodSeed = (foods) => {
    if (!Array.isArray(foods) || foods.length === 0) {
        throw new TypeError('Food seed must contain at least one item.');
    }

    const names = new Set();
    for (const food of foods) {
        if (!food.dish_name?.trim() || !food.servingDescription?.trim()) {
            throw new TypeError('Every food needs a name and serving description.');
        }
        const normalizedName = food.dish_name.trim().toLowerCase();
        if (names.has(normalizedName)) {
            throw new TypeError(`Duplicate food name: ${food.dish_name}`);
        }
        names.add(normalizedName);

        for (const field of NUTRIENT_FIELDS) {
            if (!Number.isFinite(food[field]) || food[field] < 0) {
                throw new TypeError(`${food.dish_name} has an invalid ${field} value.`);
            }
        }
    }
    return foods;
};

const buildFoodSeedOperations = (foods) => validateFoodSeed(foods).map((food) => ({
    updateOne: {
        filter: { dish_name: food.dish_name },
        update: { $set: food },
        upsert: true,
    },
}));

module.exports = { buildFoodSeedOperations, validateFoodSeed };
