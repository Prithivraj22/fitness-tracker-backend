const jwt = require('jsonwebtoken');
exports.RefreshController = (req, res) => {
    const refreshToken = req.cookies.refreshToken;
    console.log('Refreshing')

    if (!refreshToken) {
        return res.send(404);
    }

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);

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

        // return res.status(200).json({ message: 'Access token refreshed successfully' });
    } catch (err) {
        console.error('Error verifying refresh token:', err);
        return res.status(403).json({ message: 'Invalid refresh token' });
    }
};
