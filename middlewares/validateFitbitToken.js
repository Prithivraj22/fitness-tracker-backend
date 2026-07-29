const axios = require('axios');

const CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;

// Tries the existing Fitbit access token first. Only refreshes if it's
// missing or expired — the old version always refreshed unconditionally
// (burning Fitbit's single-use refresh tokens on every request) and then
// validated using the stale pre-refresh cookie, which was backwards.
const validateFitbitToken = async (req, res, next) => {
    const accessToken = req.cookies.fitbitAccessToken;

    if (accessToken) {
        try {
            await axios.get('https://api.fitbit.com/1/user/-/profile.json', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            req.validAccessToken = accessToken;
            return next();
        } catch (error) {
            // Falls through to refresh below if this was an auth failure.
        }
    }

    const refreshToken = req.cookies.fitbitRefreshToken;
    if (!refreshToken) {
        return res.status(401).json({ error: 'Fitbit is not connected.' });
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

        res.cookie('fitbitAccessToken', access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: expires_in * 1000 });
        res.cookie('fitbitRefreshToken', refresh_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });

        req.validAccessToken = access_token;
        next();
    } catch (error) {
        console.error('Error refreshing Fitbit token:', error.response?.data || error.message);
        res.status(401).json({ error: 'Fitbit session expired. Please reconnect.' });
    }
};

module.exports = validateFitbitToken;
