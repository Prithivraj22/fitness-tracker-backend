const axios = require('axios');
const { User } = require('../models');
const { decryptToken, encryptToken } = require('../fitbitTokens');

const CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;

const refreshUserFitbitToken = async (user) => {
    const refreshToken = decryptToken(user.fitbitRefreshToken);
    if (!refreshToken) return null;

    const form = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });
    const response = await axios.post('https://api.fitbit.com/oauth2/token', form.toString(), {
        headers: {
            Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });

    const { access_token, refresh_token, expires_in } = response.data;
    if (!access_token || !expires_in) return null;

    user.fitbitAccessToken = encryptToken(access_token);
    if (refresh_token) {
        user.fitbitRefreshToken = encryptToken(refresh_token);
    }
    user.fitbitAccessTokenExpiresAt = new Date(Date.now() + expires_in * 1000);
    await user.save();
    return access_token;
};

const validateFitbitToken = async (req, res, next) => {
    if (!req.userData?.userId) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    const user = await User.findById(req.userData.userId)
        .select('+fitbitAccessToken +fitbitRefreshToken +fitbitAccessTokenExpiresAt');
    if (!user || !user.fitbitRefreshToken) {
        return res.status(401).json({ error: 'Fitbit is not connected.' });
    }

    const accessToken = decryptToken(user.fitbitAccessToken);
    if (accessToken && user.fitbitAccessTokenExpiresAt &&
        new Date(user.fitbitAccessTokenExpiresAt).getTime() > Date.now() + 30000) {
        req.validAccessToken = accessToken;
        return next();
    }

    try {
        const refreshedAccessToken = await refreshUserFitbitToken(user);
        if (!refreshedAccessToken) {
            return res.status(401).json({ error: 'Fitbit session expired. Please reconnect.' });
        }
        req.validAccessToken = refreshedAccessToken;
        return next();
    } catch (error) {
        if (error.response?.status === 400 || error.response?.status === 401) {
            await User.findByIdAndUpdate(req.userData.userId, {
                $unset: {
                    fitbitAccessToken: 1,
                    fitbitRefreshToken: 1,
                    fitbitAccessTokenExpiresAt: 1,
                },
            });
            return res.status(401).json({ error: 'Fitbit session expired. Please reconnect.' });
        }
        console.error('Fitbit token refresh failed.');
        return res.status(502).json({ error: 'Fitbit is temporarily unavailable.' });
    }
};

module.exports = validateFitbitToken;