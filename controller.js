const { User, Food } = require('./models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios');
const secretKey = process.env.SECRET_KEY;
const moment = require('moment');

const CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const FITBIT_CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const FITBIT_CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;

exports.signup = async (req, res) => {
    try {
        const hashed_pass = await bcrypt.hash(req.body.password, 10);
        const user = await User({
            username: req.body.username,
            password: hashed_pass,
            email: req.body.email,
            height: req.body.height,
            weight: req.body.weight,
            dob: req.body.dob,
            country: req.body.country,
            gender: req.body.gender,
            bloodGroup: req.body.bloodGroup,
            RHtype: req.body.RHtype
        });
        await user.save();
        const token = jwt.sign({ userId: user._id, email: user.email }, secretKey, { expiresIn: '1h' });
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 3600000,
        });
        res.send(token);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
};

exports.CreateMeal = async (req, res) => {
    try {
        const new_meal = await Food(req.body);
        await new_meal.save();
        res.send(new_meal);
    } catch (err) {
        console.error(err);
        res.status(500).send("Internal Server Error");
    }
};

exports.updateMacros = async (req, res) => {
    const user_id = req.body.user_id;
    try {
        await User.findOneAndUpdate(
            { _id: user_id },
            { $inc: { Calorie: req.body.calorie, Protein: req.body.protein, Fat: req.body.fat, Carbs: req.body.carbs } },
            { new: true },
        );
        const updatedUser = await User.findOne({ _id: user_id });
        res.send(updatedUser);
        console.log("User successfully updated");
    } catch (err) {
        console.error(err);
    }
};

// Fetch Strava Activities
exports.getStravaActivities = async (req, res) => {
    const accessToken = req.validAccessToken;

    if (!accessToken) {
        return res.status(400).send('Access token is missing.');
    }

    try {
        const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const strideLen = 0.82; // Default stride length
        const activities = response.data.map(activity => {
            let stepCount = 'N/A';
            if (activity.type === "Run" || activity.type === "Walk") {
                stepCount = Math.round(activity.distance / strideLen);
            }

            return {
                id: activity.id,
                name: activity.name,
                distance: activity.distance,
                duration: activity.elapsed_time,
                type: activity.type,
                start_date_local: activity.start_date_local,
                average_speed: activity.average_speed,
                calories: activity.calories || 'N/A',
                stepCount,
            };
        });

        res.json({
            message: 'Activities fetched successfully!',
            activities,
        });
    } catch (err) {
        console.error('Error fetching activities:', err.message);
        res.status(500).send('Failed to fetch activities.');
    }
};

// Fetch Fitbit Activities with Time Validation (beforetime, aftertime)
exports.getFitbitActivities = async (req, res) => {
    const accessToken = req.validAccessToken || req.newAccessToken;
    const date = req.query.date || moment().format('YYYY-MM-DD'); // Default to today if no date is provided

    if (!accessToken) {
        return res.status(400).send('Access token is missing.');
    }

    try {
        // Fetch daily activity summary
        const dailySummaryResponse = await axios.get(
            `https://api.fitbit.com/1/user/-/activities/date/${date}.json`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        // Fetch lifetime stats
        const lifetimeStatsResponse = await axios.get(
            'https://api.fitbit.com/1/user/-/activities.json',
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        // Fetch heart rate intraday data
        const heartRateResponse = await axios.get(
            `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d/1min.json`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        // Fetch activity log (if needed for exercise details)
        const activityLogResponse = await axios.get(
            `https://api.fitbit.com/1/user/-/activities/list.json`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                params: { beforeDate: date, limit: 10, offset: 0 },
            }
        );

        // Parse the responses
        const dailySummary = dailySummaryResponse.data;
        const lifetimeStats = lifetimeStatsResponse.data.lifetime.total;
        const activityLog = activityLogResponse.data.activities || [];
        const heartRateData = heartRateResponse.data['activities-heart-intraday'].dataset;

        // Construct the response object
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
            }
        };

        res.json({
            message: 'Fitbit data fetched successfully!',
            result,
        });
    } catch (error) {
        console.error('Error fetching Fitbit data:', error.response?.data || error.message);
        res.status(500).send('Failed to fetch Fitbit data.');
    }


};
