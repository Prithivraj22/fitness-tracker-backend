const assert = require('node:assert/strict');
const test = require('node:test');
const jwt = require('jsonwebtoken');

process.env.ACCESS_TOKEN_SECRET = 'test-access-secret-that-is-long-and-distinct';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-that-is-long-and-distinct';
process.env.FITBIT_OAUTH_STATE_SECRET = 'test-oauth-state-secret-that-is-long-and-distinct';
process.env.GOOGLE_HEALTH_OAUTH_STATE_SECRET = 'test-google-health-state-secret-that-is-distinct';

const {
    signAccessToken,
    signFitbitOAuthState,
    signGoogleHealthOAuthState,
    signRefreshToken,
    verifyAccessToken,
    verifyFitbitOAuthState,
    verifyGoogleHealthOAuthState,
    verifyRefreshToken,
} = require('../authTokens');

test('access tokens carry an access-only purpose and subject', () => {
    const token = signAccessToken({ _id: 'user-123', email: 'user@example.com' });
    const decoded = verifyAccessToken(token);

    assert.equal(decoded.sub, 'user-123');
    assert.equal(decoded.email, 'user@example.com');
    assert.equal(decoded.tokenUse, 'access');
});

test('Google Health OAuth state is isolated from Fitbit OAuth state', () => {
    const state = signGoogleHealthOAuthState({
        userId: 'user-123',
        returnTo: 'http://localhost:3000',
    });

    assert.equal(verifyGoogleHealthOAuthState(state).sub, 'user-123');
    assert.throws(() => verifyFitbitOAuthState(state));
    assert.throws(() => verifyAccessToken(state));
});

test('OAuth state cannot be used as an access token', () => {
    const state = signFitbitOAuthState({ userId: 'user-123', returnTo: 'http://localhost:3000' });

    assert.throws(() => verifyAccessToken(state));
    assert.equal(verifyFitbitOAuthState(state).sub, 'user-123');
});

test('refresh tokens cannot be used as access tokens', () => {
    const refreshToken = signRefreshToken('user-123');

    assert.throws(() => verifyAccessToken(refreshToken));
    assert.equal(verifyRefreshToken(refreshToken).sub, 'user-123');
});

test('legacy JWTs without issuer, audience, and purpose are rejected', () => {
    const legacyToken = jwt.sign(
        { userId: 'user-123', email: 'user@example.com' },
        process.env.ACCESS_TOKEN_SECRET,
        { algorithm: 'HS256', expiresIn: '10m' }
    );

    assert.throws(() => verifyAccessToken(legacyToken));
});
