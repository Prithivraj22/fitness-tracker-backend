const express = require('express');
const router = express.Router();
const controll = require('./controller');
const auth = require('./Authorize');
const validateFitbitToken = require('./middlewares/validateFitbitToken');
const refreshFitbitToken = require('./middlewares/refreshFitbitToken');
const axios = require('axios'); 


    // console.log("hai")
// router.post('/signup',controll.signup);
// router.post('/update_macros',controll.updateMacros);
// router.post('/meal',auth,controll.CreateMeal);

router.get('/getCalH',auth,controll.getCalH);
const CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;
const REDIRECT_URI = process.env.FITBIT_REDIRECT_URI;

// POST routes
router.post('/signup', controll.signup);
router.post('/update_macros', auth,controll.updateMacros);
router.post('/meal', auth, controll.CreateMeal);
router.get('/user-data', auth, controll.getUserDetails);


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

        // Store tokens in cookies
        res.cookie('fitBitAccessToken', access_token, { httpOnly: true, secure: true, maxAge: expires_in * 1000 });
        res.cookie('fitbitRefreshToken', refresh_token, { httpOnly: true, secure: true, maxAge: 30 * 24 * 60 * 60 * 1000 });

        // Redirect to the React dashboard page
        return res.redirect('http://localhost:3000/dashboard');
    } catch (error) {
        console.error('Error exchanging token:', error.response?.data || error.message);

        // Make sure no additional response is sent if an error occurs
        if (!res.headersSent) {
            return res.status(500).send('Failed to exchange token');
        }
    }
});



// Step 3: Fetch Fitbit Activities (Middleware to handle token refresh and validation)
router.get(
    '/fitbit/activities',
    refreshFitbitToken,        // First, try to refresh the access token if expired
    validateFitbitToken,       // Validate the access token
    controll.getFitbitActivities
);
router.get('/authorize',controll.authorize)

module.exports = router;
