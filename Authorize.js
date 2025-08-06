const jwt = require('jsonwebtoken');
const refresh = require('./refreshController');
const secretKey = process.env.SECRET_KEY

module.exports = (req, res, next) => {
    try {
        console.log("Checking-------");

        let token = req.cookies.acessToken;
        console.log("Checking-------");
        if (!token) {
            console.log("No access token, attempting to refresh...");

            const mes = refresh.RefreshController(req, res);
            console.log(mes)
            if (mes == 404) return res.send(404);
            else if (newToken === 403) {
                return res.status(403).send('Authentication failed: Invalid refresh token.');
            }
            else {
                token = newToken;
                const decodedToken = jwt.verify(token, secretKey);
                req.userData = { userId: decodedToken.userId, email: decodedToken.email };
                console.log("Token refreshed and authorized.");
                next();
            }

        }
        else {
            // Access token is available, so just verify and proceed.
            const decodedToken = jwt.verify(token, secretKey);
            req.userData = { userId: decodedToken.userId, email: decodedToken.email };
            console.log("Access token found and authorized.");
            next();
        }
    }
    catch (err) {
        console.error('Error in Authorization middleware:', err);
        return res.status(401).json({ error: 'Authentication failed' });
    }
};
