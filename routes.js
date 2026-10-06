const express = require('express');
const router = express.Router();
const controll = require('./controller');
const auth = require('./Authorize');
const validateFitbitToken = require('./middlewares/validateFitbitToken');
const { validateGoogleHealthToken, clearGoogleHealthConnection } = require('./middlewares/validateGoogleHealthToken');
const { User } = require('./models');
const { decryptToken, encryptToken } = require('./providerTokens');
const crypto = require('crypto');
const axios = require('axios'); 
const rateLimit = require('express-rate-limit');
const { clearAuthCookies, cookieOptions, REFRESH_COOKIE } = require('./authCookies');
const {
    hashToken,
    signFitbitOAuthState,
    signGoogleHealthOAuthState,
    verifyFitbitOAuthState,
    verifyGoogleHealthOAuthState,
    verifyRefreshToken,
} = require('./authTokens');
const {
    buildAuthorizationUrl: buildGoogleHealthAuthorizationUrl,
    exchangeAuthorizationCode: exchangeGoogleHealthAuthorizationCode,
    getIdentity: getGoogleHealthIdentity,
    revokeToken: revokeGoogleHealthToken,
} = require('./googleHealthClient');
const { getPrimaryFrontendOrigin, isAllowedFrontendOrigin } = require('./frontendOrigins');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
});

router.get('/nutrition/history', auth, controll.getNutritionHistory);
const CLIENT_ID = process.env.FITBIT_CLIENT_ID;
const CLIENT_SECRET = process.env.FITBIT_CLIENT_SECRET;
const REDIRECT_URI = process.env.FITBIT_REDIRECT_URI;

const oauthStateCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
    path: '/',
};

const statesMatch = (expected, received) => {
    if (!expected || !received) return false;
    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return expectedBuffer.length === receivedBuffer.length &&
        crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
};

const findAccountLinkingUrl = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
        try {
            const parsed = new URL(value);
            if (parsed.protocol === 'https:' &&
                (parsed.hostname === 'google.com' || parsed.hostname.endsWith('.google.com'))) {
                return parsed.toString();
            }
        } catch (error) {
            return null;
        }
        return null;
    }
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findAccountLinkingUrl(item);
            if (found) return found;
        }
        return null;
    }
    if (typeof value === 'object') {
        for (const item of Object.values(value)) {
            const found = findAccountLinkingUrl(item);
            if (found) return found;
        }
    }
    return null;
};

const summarizeGoogleHealthError = (error) => {
    const responseData = error.response?.data;
    const apiError = responseData?.error;
    const details = Array.isArray(apiError?.details) ? apiError.details : [];
    const errorInfo = details.find((detail) => detail && typeof detail === 'object' && detail.reason);

    return {
        status: error.response?.status || null,
        code: typeof apiError === 'string' ? apiError : apiError?.status || error.code || null,
        reason: errorInfo?.reason || null,
        message: responseData?.error_description || apiError?.message || error.message || 'Unknown error',
    };
};

const googleHealthFailureReason = ({ status, code, reason }) => {
    if (status === 403) return 'api-access-denied';
    if (reason === 'ACCOUNT_NOT_LINKED') return 'account-not-linked';
    if (code === 'invalid_client') return 'configuration-error';
    if (code === 'invalid_grant') return 'authorization-expired';
    return 'connection-failed';
};

const revokeFitbitRefreshToken = async (encryptedRefreshToken) => {
    if (!encryptedRefreshToken) return;
    const refreshToken = decryptToken(encryptedRefreshToken);
    if (!refreshToken) {
        console.warn('Skipping Fitbit token revocation because the stored token is unreadable.');
        return;
    }
    const form = new URLSearchParams({ token: refreshToken });
    try {
        await axios.post('https://api.fitbit.com/oauth2/revoke', form.toString(), {
            headers: {
                Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 10000,
        });
    } catch (error) {
        console.warn('Fitbit token revocation failed during Google Health migration.', {
            status: error.response?.status || null,
        });
    }
};

// POST routes
router.post('/signup', controll.signup);
router.post('/nutrition/intake', auth, controll.addDailyNutrition);
router.get('/user-data', auth, controll.getUserDetails);
router.post('/update_profile', auth, controll.updateProfile);
router.get('/foods', auth, controll.getFoods);
router.post('/login', loginLimiter, controll.login);
router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies[REFRESH_COOKIE];
    if (refreshToken) {
        let decoded;
        try {
            decoded = verifyRefreshToken(refreshToken);
        } catch (error) {
            // Invalid or expired cookies have no active session to revoke.
        }
        if (decoded) {
            try {
                await User.updateOne(
                    { _id: decoded.sub, refreshTokenHash: hashToken(refreshToken) },
                    { $unset: { refreshTokenHash: 1 } }
                );
            } catch (error) {
                return res.status(503).json({ error: 'Unable to end the session right now.' });
            }
        }
    }
    clearAuthCookies(res);
    return res.sendStatus(204);
});


// Step 1: Redirect to Fitbit Authorization URL
router.get('/auth/fitbit', auth, (req, res) => {
    const returnTo = isAllowedFrontendOrigin(req.query.returnTo)
        ? new URL(req.query.returnTo).origin
        : getPrimaryFrontendOrigin();
    const state = signFitbitOAuthState({
        userId: req.userData.userId,
        returnTo,
    });
    res.cookie('fitbitOAuthState', state, oauthStateCookieOptions);

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: 'activity heartrate profile sleep',
        state,
    });
    const authURL = `https://www.fitbit.com/oauth2/authorize?${params.toString()}`;
    res.redirect(authURL);
});
// Step 2: Exchange Authorization Code for Access Token
router.get('/auth/fitbit/callback', async (req, res) => {
    const code = req.query.code;
    const state = req.query.state;

    if (req.query.error) {
        return res.status(400).send('Fitbit authorization was denied.');
    }
    if (!code) {
        return res.status(400).send('Authorization code missing');
    }
    if (!state || !req.cookies.fitbitOAuthState) {
        return res.status(400).send('Invalid Fitbit authorization state');
    }

    res.clearCookie('fitbitOAuthState', { ...cookieOptions(0), sameSite: 'lax' });
    if (!statesMatch(req.cookies.fitbitOAuthState, state)) {
        return res.status(400).send('Invalid Fitbit authorization state');
    }
    let stateData;
    try {
        stateData = verifyFitbitOAuthState(state);
    } catch (error) {
        return res.status(400).send('Invalid Fitbit authorization state');
    }

    try {
        const form = new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            redirect_uri: REDIRECT_URI,
            code,
        });
        const response = await axios.post('https://api.fitbit.com/oauth2/token', form.toString(), {
            headers: {
                Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const { access_token, refresh_token, expires_in } = response.data;
        if (!access_token || !refresh_token || !expires_in) {
            return res.status(502).send('Invalid Fitbit token response');
        }

        await User.findByIdAndUpdate(stateData.sub, {
            fitbitAccessToken: encryptToken(access_token),
            fitbitRefreshToken: encryptToken(refresh_token),
            fitbitAccessTokenExpiresAt: new Date(Date.now() + expires_in * 1000),
            healthProvider: 'fitbit',
        });

        const frontendOrigin = isAllowedFrontendOrigin(stateData.returnTo)
            ? stateData.returnTo
            : getPrimaryFrontendOrigin();
        return res.redirect(`${frontendOrigin}/dashboard`);
    } catch (error) {
        console.error('Fitbit authorization exchange failed.');
        return res.status(502).send('Failed to connect Fitbit');
    }
});

router.get('/auth/google-health', auth, (req, res) => {
    try {
        const returnTo = isAllowedFrontendOrigin(req.query.returnTo)
            ? new URL(req.query.returnTo).origin
            : getPrimaryFrontendOrigin();
        const state = signGoogleHealthOAuthState({
            userId: req.userData.userId,
            returnTo,
        });
        res.cookie('googleHealthOAuthState', state, oauthStateCookieOptions);
        return res.redirect(buildGoogleHealthAuthorizationUrl(state));
    } catch (error) {
        console.error('Google Health authorization is not configured.');
        return res.status(503).send('Google Health connection is not configured yet.');
    }
});

router.get('/auth/google-health/callback', async (req, res) => {
    const { code, state } = req.query;
    const storedState = req.cookies.googleHealthOAuthState;
    res.clearCookie('googleHealthOAuthState', { ...cookieOptions(0), sameSite: 'lax' });
    if (req.query.error) return res.status(400).send('Google Health authorization was denied.');
    if (!code) return res.status(400).send('Authorization code missing.');
    if (!statesMatch(storedState, state)) {
        return res.status(400).send('Invalid Google Health authorization state.');
    }

    let stateData;
    try {
        stateData = verifyGoogleHealthOAuthState(state);
    } catch (error) {
        return res.status(400).send('Invalid Google Health authorization state.');
    }

    try {
        const tokenData = await exchangeGoogleHealthAuthorizationCode(code);
        if (!tokenData.access_token || !tokenData.refresh_token || !tokenData.expires_in) {
            return res.status(502).send('Invalid Google Health token response.');
        }

        let identity;
        try {
            identity = await getGoogleHealthIdentity(tokenData.access_token);
        } catch (error) {
            const linkingUrl = findAccountLinkingUrl(error.response?.data);
            if (error.response?.status === 400 && linkingUrl) {
                try {
                    await revokeGoogleHealthToken(tokenData.access_token);
                } catch (revokeError) {
                    console.error('Temporary Google Health token revocation failed.');
                }
                return res.redirect(linkingUrl);
            }
            throw error;
        }
        if (!identity.healthUserId) {
            return res.status(502).send('Google Health identity response is incomplete.');
        }

        const user = await User.findById(stateData.sub).select('+fitbitRefreshToken');
        if (!user) return res.status(404).send('User not found.');
        await revokeFitbitRefreshToken(user.fitbitRefreshToken);

        await User.findByIdAndUpdate(stateData.sub, {
            $set: {
                healthProvider: 'google',
                googleHealthAccessToken: encryptToken(tokenData.access_token),
                googleHealthRefreshToken: encryptToken(tokenData.refresh_token),
                googleHealthAccessTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
                googleHealthUserId: identity.healthUserId,
            },
            $unset: {
                fitbitAccessToken: 1,
                fitbitRefreshToken: 1,
                fitbitAccessTokenExpiresAt: 1,
            },
        });

        const frontendOrigin = isAllowedFrontendOrigin(stateData.returnTo)
            ? stateData.returnTo
            : getPrimaryFrontendOrigin();
        return res.redirect(`${frontendOrigin}/dashboard?health=connected`);
    } catch (error) {
        const details = summarizeGoogleHealthError(error);
        console.error('Google Health authorization exchange failed.', details);
        const frontendOrigin = isAllowedFrontendOrigin(stateData?.returnTo)
            ? stateData.returnTo
            : getPrimaryFrontendOrigin();
        const reason = googleHealthFailureReason(details);
        return res.redirect(`${frontendOrigin}/dashboard?health=${encodeURIComponent(reason)}`);
    }
});

router.post('/auth/google-health/disconnect', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userData.userId)
            .select('+googleHealthRefreshToken +googleHealthAccessToken');
        if (user) {
            const token = decryptToken(user.googleHealthRefreshToken)
                || decryptToken(user.googleHealthAccessToken);
            if (token) {
                try {
                    await revokeGoogleHealthToken(token);
                } catch (error) {
                    if (error.response?.status !== 400) throw error;
                }
            }
        }
        await clearGoogleHealthConnection(req.userData.userId);
        return res.sendStatus(204);
    } catch (error) {
        console.error('Google Health disconnect failed.');
        return res.status(502).json({ error: 'Unable to disconnect Google Health right now.' });
    }
});

router.get('/health/connection', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userData.userId)
            .select('+googleHealthRefreshToken +fitbitRefreshToken healthProvider');
        if (!user) return res.status(404).json({ error: 'User not found.' });
        const provider = user.googleHealthRefreshToken
            ? 'google'
            : (user.fitbitRefreshToken ? 'fitbit' : null);
        return res.json({
            connected: Boolean(provider),
            provider,
            migrationRequired: provider === 'fitbit',
        });
    } catch (error) {
        return res.status(500).json({ error: 'Unable to read health connection status.' });
    }
});

router.post('/auth/fitbit/disconnect', auth, async (req, res) => {
    await User.findByIdAndUpdate(req.userData.userId, {
        $unset: {
            fitbitAccessToken: 1,
            fitbitRefreshToken: 1,
            fitbitAccessTokenExpiresAt: 1,
        },
    });
    return res.sendStatus(204);
});



// Step 3: Fetch Fitbit Activities (Middleware to handle token refresh and validation)
router.get(
    '/fitbit/activities',
    auth,
    validateFitbitToken,       // Validates the existing token, refreshing only if needed
    controll.getFitbitActivities
);
router.get('/health/activities', auth, async (req, res, next) => {
    try {
        const user = await User.findById(req.userData.userId)
            .select('+googleHealthRefreshToken +fitbitRefreshToken healthProvider');
        if (!user) return res.status(404).json({ error: 'User not found.' });
        if (user.googleHealthRefreshToken || user.healthProvider === 'google') {
            return validateGoogleHealthToken(req, res, () => controll.getGoogleHealthActivities(req, res));
        }
        if (user.fitbitRefreshToken || user.healthProvider === 'fitbit') {
            return validateFitbitToken(req, res, () => controll.getFitbitActivities(req, res));
        }
        return res.status(401).json({
            code: 'HEALTH_NOT_CONNECTED',
            error: 'Connect Google Health to view activity data.',
        });
    } catch (error) {
        return next(error);
    }
});
router.get('/authorize',controll.authorize)

module.exports = router;
