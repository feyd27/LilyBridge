// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/user'); // Import the User model

function authMiddleware(req, res, next) {
  const header = req.header('Authorization') || '';
  const token  = header.replace('Bearer ', '').trim();
  if (!token) {
    return res
      .status(401)
      .json({ message: 'Access denied. No token provided.' });
  }

  try {
    // Will throw if expired or invalid
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      // Let the client know it’s an expiry case
      return res
        .status(401)
        .json({ message: 'Access token expired.' });
    }
    // Any other verification error
    return res
      .status(403)
      .json({ message: 'Invalid access token.' });
  }
}

module.exports = authMiddleware;