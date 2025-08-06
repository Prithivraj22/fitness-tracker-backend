const jwt = require('jsonwebtoken');
exports.RefreshController = (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    console.log('Refreshing')

    if (!refreshToken) {
        console.log("refesh not available");
        return 404; 
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
        console.log("refesh available");

        // Generate a new access token
        const acessToken = jwt.sign(
            { userId: decoded.userId, email: decoded.email },
            process.env.SECRET_KEY,
            { expiresIn: '0.5h' }
        );

        // Set the new access token as a cookie
        res.cookie('acessToken', acessToken, {
            httpOnly: true,
            secure: true, // Secure only in production
            sameSite: 'strict',
            maxAge: 0.5 * 3600000, // 24 hours
        });
        console.log('hurray')
        return (acessToken);
    } catch (err) {
        console.error('Error verifying refresh token:', err);
        return 403;
    }
};
