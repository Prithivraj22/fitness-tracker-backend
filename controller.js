const { User, Food } = require('./models');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios');
const secretKey = process.env.SECRET_KEY;
const refreshSecret = process.env.REFRESH_SECRET
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
        const acessToken = jwt.sign({ userId: user._id, email: user.email }, secretKey, { expiresIn: '24h' });
        const refreshToken=jwt.sign({ userId: user._id,email: user.email }, refreshSecret,{expiresIn:'7d'});
        res.cookie('acessToken', acessToken, {
            httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 24*3600000,
        });
        res.cookie('refreshToken',refreshToken,
            {
                httpOnly: true,
            secure: false,
            sameSite: 'strict',
            maxAge: 7*24*3600000,
            }
        )
        res.status(200).send(acessToken+','+refreshToken);
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
        const result = await fetchFitbitData(accessToken, date);
        res.json({
            message: 'Fitbit data fetched successfully!',
            result,
        });
    } catch (error) {
        console.error('Error fetching Fitbit data:', error.message);
        res.status(500).send('Failed to fetch Fitbit data.');
    }
};


exports.getFitbitActivities = async (req, res) => {
    const accessToken = req.cookies.fitbitAccessToken;

    if (!accessToken) {
        return res.status(401).json({ error: 'Access token is missing' });
    }

    const date = req.query.date || moment().format('YYYY-MM-DD');

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

        res.json({
            message: 'Fitbit data fetched successfully!',
            result,
        });
    } catch (error) {
        console.error('Failed to fetch Fitbit data:', error.response?.data || error.message);

        if (error.response?.status === 401) {
            return res.status(401).json({ error: 'Access token expired or invalid' });
        }

        res.status(500).json({ error: 'Failed to fetch Fitbit data' });
    }


};
