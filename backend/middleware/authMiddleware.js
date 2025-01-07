// middleware/authMiddleware.js

const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    // Token is invalid or expired, try to refresh it
    if (error.name === 'TokenExpiredError') {
      const refreshToken = req.header('X-Refresh-Token'); // Get refresh token from header
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token missing.' });
      }

      jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
        if (err) {
          return res.status(403).json({ message: 'Invalid refresh token.' });
        }

        // Generate new access token
        const newAccessToken = jwt.sign(
          { userId: user.userId, role: user.role }, // Assuming userId and role are in the refresh token payload
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
        );

        // Send new access token in the response header
        res.setHeader('Authorization', `Bearer ${newAccessToken}`); 

        // Continue with the original request using the new access token
        req.headers['authorization'] = `Bearer ${newAccessToken}`;
        req.user = user;
        next();
      });
    } else {
      // Other token verification errors
      return res.status(403).json({ message: 'Invalid token.' });
    }
  }
}

module.exports = authMiddleware;