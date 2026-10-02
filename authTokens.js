const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ISSUER = 'nutrix-api';
const ACCESS_AUDIENCE = 'nutrix-web';
const REFRESH_AUDIENCE = 'nutrix-session';
const FITBIT_STATE_AUDIENCE = 'nutrix-fitbit-callback';
const GOOGLE_HEALTH_STATE_AUDIENCE = 'nutrix-google-health-callback';

const getPurposeSecret = (dedicatedName, rootName, purpose) => {
    const dedicatedSecret = process.env[dedicatedName];
    if (dedicatedSecret) return dedicatedSecret;

    const rootSecret = process.env[rootName];
    if (!rootSecret) {
        throw new Error(`${dedicatedName} or ${rootName} must be configured.`);
    }

    return crypto.createHmac('sha256', rootSecret).update(purpose).digest();
};

const accessSecret = () => getPurposeSecret('ACCESS_TOKEN_SECRET', 'SECRET_KEY', 'nutrix:access-token:v1');
const refreshSecret = () => getPurposeSecret('REFRESH_TOKEN_SECRET', 'REFRESH_SECRET', 'nutrix:refresh-token:v1');
const fitbitStateSecret = () => getPurposeSecret('FITBIT_OAUTH_STATE_SECRET', 'SECRET_KEY', 'nutrix:fitbit-oauth-state:v1');
const googleHealthStateSecret = () => getPurposeSecret(
    'GOOGLE_HEALTH_OAUTH_STATE_SECRET',
    'SECRET_KEY',
    'nutrix:google-health-oauth-state:v1'
);

const signAccessToken = (user, expiresIn = '12m') => jwt.sign(
    {
        email: user.email,
        tokenUse: 'access',
    },
    accessSecret(),
    {
        subject: String(user._id || user.id),
        issuer: ISSUER,
        audience: ACCESS_AUDIENCE,
        expiresIn,
        algorithm: 'HS256',
        jwtid: crypto.randomUUID(),
    }
);

const verifyAccessToken = (token) => {
    const decoded = jwt.verify(token, accessSecret(), {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: ACCESS_AUDIENCE,
    });
    if (decoded.tokenUse !== 'access' || !decoded.sub) {
        throw new jwt.JsonWebTokenError('Invalid access token purpose.');
    }
    return decoded;
};

const signRefreshToken = (userId, expiresIn = '7d') => jwt.sign(
    { tokenUse: 'refresh' },
    refreshSecret(),
    {
        subject: String(userId),
        issuer: ISSUER,
        audience: REFRESH_AUDIENCE,
        expiresIn,
        algorithm: 'HS256',
        jwtid: crypto.randomUUID(),
    }
);

const verifyRefreshToken = (token) => {
    const decoded = jwt.verify(token, refreshSecret(), {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: REFRESH_AUDIENCE,
    });
    if (decoded.tokenUse !== 'refresh' || !decoded.sub) {
        throw new jwt.JsonWebTokenError('Invalid refresh token purpose.');
    }
    return decoded;
};

const signFitbitOAuthState = ({ userId, returnTo }) => jwt.sign(
    {
        returnTo,
        tokenUse: 'fitbit_oauth_state',
    },
    fitbitStateSecret(),
    {
        subject: String(userId),
        issuer: ISSUER,
        audience: FITBIT_STATE_AUDIENCE,
        expiresIn: '10m',
        algorithm: 'HS256',
        jwtid: crypto.randomUUID(),
    }
);

const verifyFitbitOAuthState = (token) => {
    const decoded = jwt.verify(token, fitbitStateSecret(), {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: FITBIT_STATE_AUDIENCE,
    });
    if (decoded.tokenUse !== 'fitbit_oauth_state' || !decoded.sub) {
        throw new jwt.JsonWebTokenError('Invalid OAuth state purpose.');
    }
    return decoded;
};

const signGoogleHealthOAuthState = ({ userId, returnTo }) => jwt.sign(
    {
        returnTo,
        tokenUse: 'google_health_oauth_state',
    },
    googleHealthStateSecret(),
    {
        subject: String(userId),
        issuer: ISSUER,
        audience: GOOGLE_HEALTH_STATE_AUDIENCE,
        expiresIn: '10m',
        algorithm: 'HS256',
        jwtid: crypto.randomUUID(),
    }
);

const verifyGoogleHealthOAuthState = (token) => {
    const decoded = jwt.verify(token, googleHealthStateSecret(), {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: GOOGLE_HEALTH_STATE_AUDIENCE,
    });
    if (decoded.tokenUse !== 'google_health_oauth_state' || !decoded.sub) {
        throw new jwt.JsonWebTokenError('Invalid OAuth state purpose.');
    }
    return decoded;
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

module.exports = {
    hashToken,
    signAccessToken,
    signRefreshToken,
    signFitbitOAuthState,
    signGoogleHealthOAuthState,
    verifyAccessToken,
    verifyRefreshToken,
    verifyFitbitOAuthState,
    verifyGoogleHealthOAuthState,
};
