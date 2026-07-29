const jwt = require('jsonwebtoken');
const refresh = require('./refreshController');
const secretKey = process.env.SECRET_KEY

module.exports = (req, res, next) => {
    try {

        let token = req.cookies.acessToken;
        if (!token) {

            const result = refresh.RefreshController(req, res);
            if (result === 404) {
                return res.status(404).json({ error: 'No refresh token provided.' });
            }
            else if (result === 403) {
                return res.status(403).json({ error: 'Authentication failed: Invalid refresh token.' });
            }
            else {
                token = result;
                const decodedToken = jwt.verify(token, secretKey);
                req.userData = { userId: decodedToken.userId, email: decodedToken.email };
                next();
            }

        }
        else {
            // Access token is available, so just verify and proceed.
            const decodedToken = jwt.verify(token, secretKey);
            req.userData = { userId: decodedToken.userId, email: decodedToken.email };
            next();
        }
    }
    catch (err) {
        console.error('Error in Authorization middleware:', err);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};
