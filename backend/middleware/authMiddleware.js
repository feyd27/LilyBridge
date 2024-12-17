// backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');

// Define exempted routes
const exemptedRoutes = [
    '/api/auth/register',
    '/api/messages/temperature/last50'
];

function authMiddleware(req, res, next) {
    // Check if the current route is exempted
    if (exemptedRoutes.includes(req.path)) {
        return next(); // Skip authentication for these routes
    }

    // Extract the token from the Authorization header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;

        // Check if user has admin privileges
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
        }

        next(); // Proceed to the next middleware or route handler
    } catch (error) {
        res.status(400).json({ message: 'Invalid token.' });
    }
}

module.exports = authMiddleware;

