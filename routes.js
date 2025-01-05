const express=require('express');
const router=express.Router();
const controll = require('./controller')
const auth = require('./Authorize');
const validateFitbitToken= require('./middlewares/validateFitbitToken');
const refreshFitbitToken= require('./middlewares/refreshFitbitToken');
const axios = require('axios'); 


    // console.log("hai")

router.post('/signup',controll.signup);
router.post('/update_macros',controll.updateMacros);
router.post('/meal',auth,controll.CreateMeal);
router.post('/logout',controll.logout);

const CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;
const REDIRECT_URI = process.env.FITBIT_REDIRECT_URI;
/*
// Step 1: Redirect to Strava Authorization URL
router.get('/auth/strava', (req, res) => {
    const authURL = `https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=read,activity:read_all`;
    res.redirect(authURL);
});


// Step 2: Exchange Authorization Code for Access Token
router.get('/exchange_token', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send('Authorization code missing');
    }

    try {
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code',
        });

        const accessToken = response.data.access_token;
        const refreshToken = response.data.refresh_token;
        const expiresAt = response.data.expires_at;

        // Log the access token (save it securely in a database in real apps)
        console.log('Access Token:', accessToken);

        // Save tokens securely (you can store them in a database or session)
        res.json({
            message: 'Successfully authenticated with Strava!',
            accessToken,
            refreshToken,
            expiresAt,
        });
    } catch (error) {
            console.error('Error exchanging token:', error.response?.data || error.message);
            res.status(500).json({
            message: 'Failed to exchange token',
            error: error.response?.data || error.message,
        });
    }
});

// Fetch user activities
router.get('/activities', async (req, res) => {
    const accessToken = req.query.accessToken; // Use the access token for the authenticated user

    if (!accessToken) {
        return res.status(400).send('Access token missing');
    }

    try {
        const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        res.json({
            message: 'Fetched activities successfully',
            activities: response.data,
        });
    } catch (error) {
        console.error('Error fetching activities:', error.message);
        res.status(500).send('Failed to fetch activities');
    }
});

router.get("/activities",refreshAccessToken,validateAccessToken,controll.getStravaActivities);
//router.get('/strava/activity/:activityId', controll.getStravaActivityDetails);  added lately if needed

module.exports=router;
*/
// Step 1: Redirect to Fitbit Authorization URL
router.get('/auth/fitbit', (req, res) => {
    const authURL = `https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=activity%20heartrate%20profile%20sleep`;
    res.redirect(authURL);
});

// Step 2: Exchange Authorization Code for Access Token
router.get('/auth/fitbit/callback', async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send('Authorization code missing');
    }

    try {
        const response = await axios.post('https://api.fitbit.com/oauth2/token', null, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            params: {
                client_id: CLIENT_ID,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                code,
            },
        });

        const { access_token, refresh_token, expires_in } = response.data;

        // Save tokens securely (e.g., in the database or session)
        res.json({
            message: 'Successfully authenticated with Fitbit!',
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresIn: expires_in,
        });
    } catch (error) {
        console.error('Error exchanging token:', error.response?.data || error.message);
        res.status(500).send('Failed to exchange token');
    }
});

// Step 3: Fetch Fitbit Activities (Middleware to handle token refresh and validation)
router.get(
    '/fitbit/activities',
    refreshFitbitToken,        // First, try to refresh the access token if expired
    validateFitbitToken,       // Validate the access token
    controll.getFitbitActivities
);

module.exports = router;

