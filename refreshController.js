const { User } = require('./models');
const { REFRESH_COOKIE, setAuthCookies } = require('./authCookies');
const {
    hashToken,
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
} = require('./authTokens');

exports.RefreshController = async (req, res) => {
    const refreshToken = req.cookies[REFRESH_COOKIE];

    if (!refreshToken) {
        return null;
    }

    try {
        const decoded = verifyRefreshToken(refreshToken);
        const rotatedRefreshToken = signRefreshToken(decoded.sub);
        const user = await User.findOneAndUpdate(
            { _id: decoded.sub, refreshTokenHash: hashToken(refreshToken) },
            { $set: { refreshTokenHash: hashToken(rotatedRefreshToken) } },
            { new: true }
        ).select('email');
        if (!user) return null;

        const accessToken = signAccessToken(user);
        setAuthCookies(res, accessToken, rotatedRefreshToken);
        return accessToken;
    } catch (err) {
        return null;
    }
};
