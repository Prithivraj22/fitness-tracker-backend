const refresh = require('./refreshController');
const { ACCESS_COOKIE } = require('./authCookies');
const { verifyAccessToken } = require('./authTokens');

module.exports = async (req, res, next) => {
    try {
        let token = req.cookies[ACCESS_COOKIE];
        let decodedToken;

        if (token) {
            try {
                decodedToken = verifyAccessToken(token);
            } catch (err) {
                if (err.name !== 'TokenExpiredError') {
                    throw err;
                }
            }
        }

        if (!decodedToken) {
            token = await refresh.RefreshController(req, res);
            if (!token) {
                return res.status(401).json({ error: 'Authentication failed' });
            }
            decodedToken = verifyAccessToken(token);
        }

        req.userData = { userId: decodedToken.sub, email: decodedToken.email };
        return next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Authentication failed' });
    }
};
