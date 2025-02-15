const axios = require('axios');

const validateFitbitToken = async (req, res, next) => {
    const accessToken = req.cookies.fitbitAccessToken;

    if (!accessToken) {
        return res.status(400).send('Access token is missing.');
    }

    try {
        const response = await axios.get('https://api.fitbit.com/1/user/-/profile.json', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

       
        req.validAccessToken = accessToken;
        next();
    } catch (error) {
        console.error('Error validating Fitbit token:', error.response?.data || error.message);
        res.status(401).send('Invalid or expired Fitbit access token.');
    }
};

module.exports = validateFitbitToken;
