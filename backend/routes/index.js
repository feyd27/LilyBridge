// routes/index.js

const express = require('express');
const router = express.Router();
const statusRoutes = require('./statusRoutes');
const authMiddleware = require('../middleware/authMiddleware');

// Protect specific routes
router.get('/protected-route', authMiddleware, (req, res) => {
    res.json({ message: 'This route is protected' });
  });

  // Other routes
router.get('/public-route', (req, res) => {
    res.json({ message: 'This route is public' });
  });
  
router.use('/', statusRoutes);

module.exports = router;
