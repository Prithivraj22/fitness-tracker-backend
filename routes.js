const express=require('express');
const router=express.Router();
const controll = require('./controller')

    // console.log("hai")
router.post('/signup',controll.signup);
router.post('/update_macros',controll.updateMacros);
router.post('/meal',controll.CreateMeal);
module.exports=router;

// Strava OAuth configuration
const CLIENT_ID = '142586';
const CLIENT_SECRET = 'f37e14b40f14350e72688946dbc2263a1289b268';
const REDIRECT_URI = 'http://localhost:3000/exchange_token';

// Step 1: Redirect to Strava Authorization URL
router.get('/auth/strava', (req, res) => {
    const authURL = https://www.strava.com/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=read,activity:read_all;
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
        console.error('Error exchanging token:', error.message);
        res.status(500).send('Failed to exchange token');
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
                Authorization: Bearer ${accessToken},
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

router.get("/strava/activities",controll.getStravaActivities);
//router.get('/strava/activity/:activityId', controll.getStravaActivityDetails);


