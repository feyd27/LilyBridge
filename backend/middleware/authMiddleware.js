// backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
        }
        next();
    } catch (error) {
        res.status(400).json({ message: 'Invalid token.' });
    }
}

module.exports = authMiddleware;
