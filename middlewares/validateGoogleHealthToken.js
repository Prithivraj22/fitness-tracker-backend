const { User } = require('../models');
const { decryptToken, encryptToken } = require('../providerTokens');
const { refreshAccessToken } = require('../googleHealthClient');

const GOOGLE_FIELDS = [
    '+googleHealthAccessToken',
    '+googleHealthRefreshToken',
    '+googleHealthAccessTokenExpiresAt',
].join(' ');

const clearGoogleHealthConnection = (userId) => User.findByIdAndUpdate(userId, {
    $unset: {
        googleHealthAccessToken: 1,
        googleHealthRefreshToken: 1,
        googleHealthAccessTokenExpiresAt: 1,
        googleHealthUserId: 1,
        googleHealthLegacyUserId: 1,
        googleHealthScopes: 1,
        healthProvider: 1,
    },
});

const validateGoogleHealthToken = async (req, res, next) => {
    if (!req.userData?.userId) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    const user = await User.findById(req.userData.userId).select(GOOGLE_FIELDS);
    if (!user || !user.googleHealthRefreshToken) {
        return res.status(401).json({
            code: 'HEALTH_NOT_CONNECTED',
            error: 'Google Health is not connected.',
        });
    }

    const accessToken = decryptToken(user.googleHealthAccessToken);
    const expiresAt = new Date(user.googleHealthAccessTokenExpiresAt || 0).getTime();
    if (accessToken && expiresAt > Date.now() + 30000) {
        req.validGoogleHealthAccessToken = accessToken;
        return next();
    }

    try {
        const refreshToken = decryptToken(user.googleHealthRefreshToken);
        if (!refreshToken) throw new Error('Encrypted refresh token is unreadable.');
        const refreshed = await refreshAccessToken(refreshToken);
        if (!refreshed.access_token || !refreshed.expires_in) {
            throw new Error('Invalid Google token response.');
        }
        user.googleHealthAccessToken = encryptToken(refreshed.access_token);
        if (refreshed.refresh_token) {
            user.googleHealthRefreshToken = encryptToken(refreshed.refresh_token);
        }
        user.googleHealthAccessTokenExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
        await user.save();
        req.validGoogleHealthAccessToken = refreshed.access_token;
        return next();
    } catch (error) {
        if (error.response?.status === 400 || error.response?.status === 401) {
            await clearGoogleHealthConnection(req.userData.userId);
            return res.status(401).json({
                code: 'HEALTH_RECONNECT_REQUIRED',
                error: 'Google Health session expired. Please reconnect.',
            });
        }
        console.error('Google Health token refresh failed.');
        return res.status(502).json({ error: 'Google Health is temporarily unavailable.' });
    }
};

module.exports = { clearGoogleHealthConnection, validateGoogleHealthToken };
