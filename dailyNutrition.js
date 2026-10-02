const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getNutritionDate = (date, now = new Date()) => {
    const value = date || now.toISOString().slice(0, 10);
    if (!DATE_PATTERN.test(value)) {
        throw new TypeError('Date must use YYYY-MM-DD format.');
    }
    const start = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== value) {
        throw new TypeError('Date must be a valid calendar date.');
    }
    return { value, start };
};

const calculateNutrition = (food, quantity) => {
    const parsedQuantity = Number(quantity);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0 || parsedQuantity > 100) {
        throw new TypeError('Quantity must be greater than 0 and no more than 100.');
    }

    const read = (field) => {
        const value = Number(food[field]);
        if (!Number.isFinite(value) || value < 0) {
            throw new TypeError(`Food ${field} must be a non-negative number.`);
        }
        return Math.round(value * parsedQuantity * 100) / 100;
    };

    return {
        calories: read('calorie'),
        protein: read('protein'),
        fat: read('fat'),
        carbs: read('carbs'),
    };
};

module.exports = { calculateNutrition, getNutritionDate };
