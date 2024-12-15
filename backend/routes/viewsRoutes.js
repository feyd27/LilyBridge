const express = require('express');
const router = express.Router();
const logger = require('../services/logger');

// Route to serve the index.html file
router.get('/', (req, res) => {
    res.render('index', { title: 'Lily-Bridge.online' });
  });

// Route to render the registration page
router.get('/register', (req, res) => {
    res.render('register', { title: 'User Registration'});
  });
  
  // Route to render the login page
  router.get('/login', (req, res) => {
    res.render('login', { title: 'Login'});
  });
// Route to render the logout confirmation page
router.get('/login-confirmation', (req, res) => {
    res.render('loginConfirmation', { title: 'Logged Out' });
  });
// Route to render the logout confirmation page
router.get('/logout-confirmation', (req, res) => {
    const isAuthenticated = !!req.cookies.accessToken;
    res.render('logoutConfirmation', { isAuthenticated , title: 'Logged Out' });
    logger.log('testing if we get here');
  });
// Export
module.exports = router;