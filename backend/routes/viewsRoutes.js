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
router.get('/logout-confirmation', (req, res) => {
    const isAuthenticated = !!req.cookies.accessToken;
    res.render('logoutConfirmation', { isAuthenticated , title: 'Logged Out' });
    logger.log('testing if we get here');
  });
// Route to render the logout confirmation page
router.get('/login-confirmation', (req, res) => {
  res.render('loginConfirmation', { title: 'Logged Out' });
});

// Route to render the temperature messages page
router.get('/temperature', (req, res) => {
  res.render('temperature', { title: 'Temperature messages overview' });
});

// Route to render the status messages page
router.get('/status', (req, res) => {
  res.render('status', { title: 'Status messages overview' });
});

// Route to render the error messages page
router.get('/errors', (req, res) => {
  res.render('errors', { title: 'Error messages overview' });
});

// Route to render the page to delete temperature messages
router.get('/delete-temp-messages', (req, res) => {
  res.render('deleteTempMessages', { title: 'Delete Temperature Messages' });
});

// Route to render the page to delete status messages
router.get('/delete-status-messages', (req, res) => {
  res.render('deleteStatusMessages', { title: 'Delete Status Messages' });
});

// Route to render the page to delete error messages
router.get('/delete-error-messages', (req, res) => {
  res.render('deleteErrorMessages', { title: 'Delete Error Messages' });
});

// Route to render the page for email verification
router.get('/verify-email', (req, res) => {
  res.render('verifyEmail', { title: 'Verify Email' });
});

// Export
module.exports = router;