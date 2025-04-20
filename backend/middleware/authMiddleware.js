// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/user'); // Import the User model

async function authMiddleware(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Record login event
    // const user = await User.findById(req.user.userId);
    // user.loginHistory.push({ timestamp: new Date() });
    // await user.save();

    next();
  } catch (error) {
    // Token is invalid or expired, try to refresh it
    if (error.name === 'TokenExpiredError') {
      const refreshToken = req.header('X--Refresh-Token');
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token missing.' });
      }
      try {
        const decodedRefreshToken = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        const user = await User.findById(decodedRefreshToken.userId);

        if (!user) {
          return res.status(404).json({ message: 'User not found'}); 
        }
        // Generate new access token
        const newAccessToken = jwt.sign(
          { userId: user._id, role: user.role},
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '4h'}
        );

        // Send new access token in the response header
        res.setHeader('Authorization', `Bearer ${newAccessToken}`);

        // COntinue with the original request using the new access token
        req.headers['authorization'] =`Bearer ${newAccessToken}`;
        req.user = { userId: user._id, role: user.role};
        next();
      }
      catch (refreshError) {
        return res.status(403).json({ message: 'Invalid refresh token'});
      }
    } else {
      // Otter token verification errors
      return res.status(403).json({ message: 'Invalid token'});
    }
  }
}

module.exports = authMiddleware;