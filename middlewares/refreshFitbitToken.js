const axios = require('axios');

const CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;

const refreshFitbitToken = async (req, res, next) => {
    const { refreshToken } = req.query;

    if (!refreshToken) {
        return res.status(400).send('Refresh token is missing.');
    }

    try {
        const response = await axios.post('https://api.fitbit.com/oauth2/token', null, {
            headers: {
                Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            params: {
                grant_type: 'refresh_token',
                refresh_token: refreshToken,
            },
        });

        const { access_token, refresh_token, expires_in } = response.data;

        // Add new tokens and expiration time to the request object
        req.newAccessToken = access_token;
        req.newRefreshToken = refresh_token;
        req.newExpiresIn = expires_in;

        next();
    } catch (error) {
        console.error('Error refreshing Fitbit token:', error.response?.data || error.message);
        res.status(500).send('Failed to refresh Fitbit token.');
    }
};

module.exports = refreshFitbitToken;
