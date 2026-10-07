const { User, Food, CalorieHistory } = require('./models');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const axios = require('axios');
const refresh=require('./refreshController');
const moment = require('moment');
const { ACCESS_COOKIE, setAuthCookies } = require('./authCookies');
const { hashToken, signAccessToken, signRefreshToken, verifyAccessToken } = require('./authTokens');
const { fetchDashboardData } = require('./googleHealthClient');
const { calculateNutrition, getNutritionDate } = require('./dailyNutrition');

const calculateAge = (dob, now = new Date()) => {
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime()) || birthDate > now) return null;
    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    const birthdayPassed = now.getUTCMonth() > birthDate.getUTCMonth()
        || (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() >= birthDate.getUTCDate());
    if (!birthdayPassed) age -= 1;
    return age;
};

const publicUser = (user) => ({
    id: user._id,
    username: user.displayName || user.username,
    displayName: user.displayName || user.username,
    email: user.email,
    height: user.height,
    weight: user.weight,
    dob: user.dob,
    age: calculateAge(user.dob),
    gender: user.gender,
    Calorie: user.Calorie,
    Protein: user.Protein,
    Fat: user.Fat,
    Carbs: user.Carbs,
});

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const upsertCalorieHistory = async (filter, update) => {
    try {
        return await CalorieHistory.findOneAndUpdate(
            filter,
            update,
            { upsert: true, setDefaultsOnInsert: true }
        );
    } catch (error) {
        // Two dashboard requests can create today's row at the same time.
        if (error?.code !== 11000) throw error;
        return CalorieHistory.findOneAndUpdate(filter, update);
    }
};

const rollDailyNutrition = async (userId, date) => {
    let current = await User.findById(userId);
    if (!current) return null;

    if (!current.nutritionDate) {
        current = await User.findByIdAndUpdate(
            userId,
            { $set: { nutritionDate: date } },
            { new: true }
        );
        return current;
    }
    if (current.nutritionDate === date) return current;

    const previous = getNutritionDate(current.nutritionDate);
    await upsertCalorieHistory(
        { author: userId, date: previous.start },
        { $set: { calorie_in: Number(current.Calorie) || 0 } }
    );

    const reset = await User.findOneAndUpdate(
        { _id: userId, nutritionDate: current.nutritionDate },
        {
            $set: {
                nutritionDate: date,
                Calorie: 0,
                Protein: 0,
                Fat: 0,
                Carbs: 0,
            },
        },
        { new: true }
    );
    return reset || User.findById(userId);
};

const saveCaloriesBurned = (userId, date, calories) => {
    const amount = Number(calories);
    if (!Number.isFinite(amount) || amount < 0) return Promise.resolve();
    return upsertCalorieHistory(
        { author: userId, date: getNutritionDate(date).start },
        { $set: { calorie_burnt: amount } }
    );
};

const issueAuthCookies = async (res, user) => {
    const accessToken = signAccessToken(user);
    const refreshToken = signRefreshToken(user._id);

    await User.updateOne({ _id: user._id }, { refreshTokenHash: hashToken(refreshToken) });
    setAuthCookies(res, accessToken, refreshToken);
};


exports.signup = async (req, res) => {
    try {
        const { displayName, username, email, password, height, weight, dob, gender } = req.body;
        const displayNameInput = displayName !== undefined ? displayName : username;
        const normalizedDisplayName = typeof displayNameInput === 'string' ? displayNameInput.trim() : '';
        const normalizedEmail = String(email || '').trim().toLowerCase();
        const age = calculateAge(dob);
        if (!normalizedDisplayName || !/^\S+@\S+\.\S+$/.test(normalizedEmail) ||
            typeof password !== 'string' || password.length < 8 ||
            !isFiniteNumber(height) || Number(height) < 50 || Number(height) > 300 ||
            !isFiniteNumber(weight) || Number(weight) < 10 || Number(weight) > 500 ||
            age === null || age < 13 || age > 120 || typeof gender !== 'boolean') {
            return res.status(400).json({ error: 'Valid account and health profile details are required.' });
        }
        const hashed_pass = await bcrypt.hash(req.body.password, 10);
        const user = await User({
            username: normalizedEmail,
            displayName: normalizedDisplayName,
            password: hashed_pass,
            email: normalizedEmail,
            height: Number(req.body.height),
            weight: Number(req.body.weight),
            dob: req.body.dob,
            gender: req.body.gender,
        });
        await user.save();
        await issueAuthCookies(res, user);
        res.status(200).json({ authenticated: true });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'Username or email already exists.' });
        }
        console.error('Signup failed.');
        res.status(500).send("Internal Server Error");
    }
};

exports.getFoods = async (req, res) => {
    try {
        const foods = await Food.find({}).sort({ dish_name: 1 });
        res.send(foods);
    } catch (err) {
        console.error('Food lookup failed.');
        res.status(500).send("Internal Server Error");
    }
};

exports.updateProfile = async (req, res) => {
    const user_id = req.userData.userId;
    try {
        const { displayName, username, email, dob, height, weight } = req.body;
        const requestedDisplayName = displayName !== undefined ? displayName : username;
        const update = {};
        if (requestedDisplayName !== undefined) {
            if (typeof requestedDisplayName !== 'string') {
                return res.status(400).json({ error: 'Name must be text.' });
            }
            update.displayName = requestedDisplayName.trim();
        }
        if (email !== undefined) {
            if (typeof email !== 'string') {
                return res.status(400).json({ error: 'Valid email is required.' });
            }
            update.email = email.trim().toLowerCase();
        }
        if (dob !== undefined) update.dob = dob;
        if (height !== undefined) update.height = Number(height);
        if (weight !== undefined) update.weight = Number(weight);

        if (requestedDisplayName !== undefined && !update.displayName) {
            return res.status(400).json({ error: 'Name is required.' });
        }
        if (email !== undefined && !/^\S+@\S+\.\S+$/.test(update.email)) {
            return res.status(400).json({ error: 'Valid email is required.' });
        }
        for (const field of ['height', 'weight']) {
            if (update[field] !== undefined && !isFiniteNumber(update[field])) {
                return res.status(400).json({ error: `${field} must be numeric.` });
            }
        }
        if (dob !== undefined) {
            const age = calculateAge(dob);
            if (age === null || age < 13 || age > 120) {
                return res.status(400).json({ error: 'Date of birth must give an age between 13 and 120.' });
            }
        }

        const updatedUser = await User.findOneAndUpdate(
            { _id: user_id },
            update,
            { new: true, runValidators: true }
        );
        if (!updatedUser) return res.status(404).json({ error: 'User not found.' });
        res.json(publicUser(updatedUser));
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'An account with this email already exists.' });
        }
        if (err.name === 'ValidationError' || err.name === 'CastError') {
            return res.status(400).json({ error: 'Profile details are invalid.' });
        }
        console.error('Profile update failed.');
        res.status(500).send("Internal Server Error");
    }
};

exports.addDailyNutrition = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.body.foodId)) {
            return res.status(400).json({ error: 'A valid food is required.' });
        }
        const { value: date } = getNutritionDate(req.body.date);
        const food = await Food.findById(req.body.foodId);
        if (!food) return res.status(404).json({ error: 'Food not found.' });
        const nutrition = calculateNutrition(food, req.body.quantity);
        const user = await rollDailyNutrition(req.userData.userId, date);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        const updated = await User.findByIdAndUpdate(
            user._id,
            {
                $inc: {
                    Calorie: nutrition.calories,
                    Protein: nutrition.protein,
                    Fat: nutrition.fat,
                    Carbs: nutrition.carbs,
                },
            },
            { new: true, runValidators: true }
        );
        return res.status(200).json({ date, nutrition: publicUser(updated) });
    } catch (error) {
        if (error instanceof TypeError) {
            return res.status(400).json({ error: error.message });
        }
        console.error('Daily nutrition update failed.');
        return res.status(500).json({ error: 'Unable to update today\'s nutrition.' });
    }
};
exports.getUserDetails=async(req,res)=>

{
    try{
        // let token=req.cookies.acessToken;
        const user_data=req.userData;
        const { value: date } = getNutritionDate(req.query.date);
        const data = await rollDailyNutrition(user_data.userId, date);
        if (!data) return res.status(404).json({ error: 'User not found.' });
        res.json(publicUser(data));

    }
    catch(error)
    {
        if (error instanceof TypeError) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).send('Internal Server Error');
    }

}

exports.getFitbitActivities = async (req, res) => {

    const accessToken = req.validAccessToken;

    if (!accessToken) {
        return res.status(401).json({ error: 'Access token is missing' });
    }

    const date = req.query.date || moment().format('YYYY-MM-DD');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
        return res.status(400).json({ error: 'Date must use YYYY-MM-DD format.' });
    }

    try {
        const dailySummaryResponse = await axios.get(
            `https://api.fitbit.com/1/user/-/activities/date/${date}.json`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        const lifetimeStatsResponse = await axios.get(
            'https://api.fitbit.com/1/user/-/activities.json',
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        const heartRateResponse = await axios.get(
            `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d/1min.json`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        const activityLogResponse = await axios.get(
            `https://api.fitbit.com/1/user/-/activities/list.json`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: { beforeDate: date, limit: 10, offset: 0 },
            }
        );

        const dailySummary = dailySummaryResponse.data;
        const lifetimeStats = lifetimeStatsResponse.data.lifetime.total;
        const activityLog = activityLogResponse.data.activities || [];
        const heartRateData =
            heartRateResponse.data['activities-heart-intraday']?.dataset || [];

        const result = {
            dailySummary: {
                steps: dailySummary.summary.steps,
                distance: dailySummary.summary.distances,
                elevation: dailySummary.summary.elevation || 0,
                floors: dailySummary.summary.floors,
                caloriesBurned: dailySummary.summary.caloriesOut,
                activeMinutes: dailySummary.summary.activeMinutes,
                activityGoals: dailySummary.goals,
            },
            lifetimeStats: {
                steps: lifetimeStats.steps,
                distance: lifetimeStats.distance,
                caloriesBurned: lifetimeStats.caloriesOut,
            },
            activityLog: activityLog.map(activity => ({
                activityName: activity.activityName,
                duration: activity.duration,
                calories: activity.calories,
                steps: activity.steps || 0,
                distance: activity.distance || 0,
            })),
            heartRateData: heartRateData.map(entry => ({
                time: entry.time,
                bpm: entry.value,
            })),
        };

        await saveCaloriesBurned(req.userData.userId, date, result.dailySummary.caloriesBurned);

        res.json({
            message: 'Fitbit data fetched successfully!',
            provider: 'fitbit',
            migrationRequired: true,
            result,
        });
    } catch (error) {
        if (error.response?.status === 401) {
            return res.status(401).json({ error: 'Access token expired or invalid' });
        }

        res.status(500).json({ error: 'Failed to fetch Fitbit data' });
    }


};

exports.getGoogleHealthActivities = async (req, res) => {
    const accessToken = req.validGoogleHealthAccessToken;
    if (!accessToken) {
        return res.status(401).json({ error: 'Google Health access token is missing.' });
    }
    const date = req.query.date || moment().format('YYYY-MM-DD');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) {
        return res.status(400).json({ error: 'Date must use YYYY-MM-DD format.' });
    }
    try {
        const result = await fetchDashboardData(accessToken, date);
        await saveCaloriesBurned(req.userData.userId, date, result.dailySummary.caloriesBurned);
        return res.json({
            message: 'Google Health data fetched successfully!',
            provider: 'google',
            migrationRequired: false,
            result,
        });
    } catch (error) {
        if (error.response?.status === 401) {
            return res.status(401).json({
                code: 'HEALTH_RECONNECT_REQUIRED',
                error: 'Google Health access was rejected. Please reconnect.',
            });
        }
        console.error('Google Health data request failed.');
        return res.status(502).json({ error: 'Failed to fetch Google Health data.' });
    }
};
exports.authorize=async (req, res) => {
    try{
        const accessToken = req.cookies[ACCESS_COOKIE];
        if (accessToken) {
            verifyAccessToken(accessToken);
            return res.json({ authorized: true });
        }

        const result = await refresh.RefreshController(req, res);
        if (!result) {
            return res.status(401).send({ authorized: false });
        }
        return res.json({ authorized: true });
    }
    catch(error) {
        const result = await refresh.RefreshController(req, res);
        return res.status(result ? 200 : 401).send({ authorized: Boolean(result) });
    }
}

exports.getNutritionHistory=async(req,res)=>{
    try{
        const { value: date, start } = getNutritionDate(req.query.date);
        const user = await rollDailyNutrition(req.userData.userId, date);
        if (!user) return res.status(404).json({ error: 'User not found.' });
        await upsertCalorieHistory(
            { author: user._id, date: start },
            { $set: { calorie_in: Number(user.Calorie) || 0 } }
        );
        const data = await CalorieHistory.find({ author: user._id })
            .sort({ date: -1 })
            .limit(30)
            .select('-_id date calorie_in calorie_burnt')
            .lean();
        data.reverse();
        res.send(data)
    }
    catch(error) { res.status(500).send('Calorie history lookup failed.'); }
}
exports.login = async (req, res) => {
    try{
        const identifier = String(req.body.email || req.body.username || '').trim();
        if (!identifier || typeof req.body.password !== 'string') {
            return res.status(400).send('Email and password are required.');
        }
        const user = await User.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { username: identifier },
            ],
        }).select('+password');
        if (!user) {
            return res.status(401).send("Invalid credentials");
        }
        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (!isMatch) {
            return res.status(401).send("Invalid credentials");
        }
        await issueAuthCookies(res, user);
        res.status(200).json({ authenticated: true });
    }
    catch(err) {
        console.error('Login failed.');
        return res.status(500).send("Internal Server Error");
    }
   
}
