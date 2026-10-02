const ACCESS_COOKIE = 'accessToken';
const LEGACY_ACCESS_COOKIE = 'acessToken';
const REFRESH_COOKIE = 'refreshToken';

const cookieOptions = (maxAge) => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge,
    path: '/',
});

const setAuthCookies = (res, accessToken, refreshToken) => {
    res.cookie(ACCESS_COOKIE, accessToken, cookieOptions(12 * 60 * 1000));
    res.cookie(REFRESH_COOKIE, refreshToken, cookieOptions(7 * 24 * 60 * 60 * 1000));
    res.clearCookie(LEGACY_ACCESS_COOKIE, cookieOptions(0));
};

const clearAuthCookies = (res) => {
    res.clearCookie(ACCESS_COOKIE, cookieOptions(0));
    res.clearCookie(LEGACY_ACCESS_COOKIE, cookieOptions(0));
    res.clearCookie(REFRESH_COOKIE, cookieOptions(0));
};

module.exports = {
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    clearAuthCookies,
    cookieOptions,
    setAuthCookies,
};
