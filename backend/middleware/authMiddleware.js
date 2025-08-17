// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/user'); // Assuming you need this for refresh logic
const logger = require('../services/logger');

// Helper function to generate a new access token
function generateAccessToken(user) {
    return jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );
}

async function authMiddleware(req, res, next) {
    const { accessToken, refreshToken } = req.cookies;

    // If no access token is present, try to refresh immediately
    if (!accessToken) {
        return handleRefreshToken(req, res, next, refreshToken);
    }

    // If access token exists, try to verify it
    try {
        const decoded = jwt.verify(accessToken, process.env.JWT_SECRET);
        req.user = decoded;
        return next(); // Token is valid, proceed
    } catch (error) {
        // If token is expired, try to refresh it
        if (error.name === 'TokenExpiredError') {
            return handleRefreshToken(req, res, next, refreshToken);
        }
        // For any other error (e.g., malformed token), redirect to login
        return res.redirect('/login');
    }
}

async function handleRefreshToken(req, res, next, refreshToken) {
    // If there's no refresh token, the user is not authenticated
    if (!refreshToken) {
        return res.redirect('/login');
    }

    try {
        // Verify the refresh token
        const decodedRefresh = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        // Optional but recommended: Check if the refresh token is still valid in the database
        const user = await User.findById(decodedRefresh.userId);
        if (!user || user.refreshToken !== refreshToken) {
            // Clear cookies if the token is invalid
            res.clearCookie('accessToken');
            res.clearCookie('refreshToken');
            return res.redirect('/login');
        }

        // Issue a new access token
        const newAccessToken = generateAccessToken(user);
        logger.log('[Token mgmt]:', refreshToken);
        logger.log('[Token mgmt]: new access token issued');

        // Set the new access token in a cookie
        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 30 * 60 * 1000 // 15 minutes
        });

        // Attach user info to the request and proceed
        req.user = { userId: user._id, role: user.role };
        next();

    } catch (error) {
        // If the refresh token is invalid or expired
        res.clearCookie('accessToken');
        res.clearCookie('refreshToken');
        return res.redirect('/login');
    }
}

module.exports = authMiddleware;


