const express = require('express');
const router = express.Router();
const logger = require('../services/logger');
const { layouts } = require('chart.js');
const fs = require('fs');
const path = require('path');

// Route to serve the index.html file
router.get('/', (req, res) => {
    res.render('index', { title: 'Lily-Bridge.online' });
  });

// Route to render the registration page
router.get('/register', (req, res) => {
    res.render('register', {layout: 'layout-no-sidebar'});
  });
  
  // Route to render the login page
  router.get('/login', (req, res) => {
    res.render('login', {layout: 'layout-no-sidebar'});
  });

// Route to render the logout confirmation page
router.get('/logout-confirmation', (req, res) => {
    const isAuthenticated = !!req.cookies.accessToken;
    res.render('logoutConfirmation', { isAuthenticated , title: 'Logged Out' });
    logger.log('testing if we get here');
  });
// Route to render the logout confirmation page
router.get('/login-confirmation', (req, res) => {
  res.render('loginConfirmation',  {layout: 'layout-no-sidebar'});
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
  res.render('verifyEmail', {layout: 'layout-no-sidebar'});
});

// Route to render user settings page
router.get('/user-settings', (req, res) => {
  res.render('userSettings', { title: 'User Settings'});
});

try {
    const viewsPath = path.join(__dirname, '../../frontend/pages');
    const files = fs.readdirSync(viewsPath);
    logger.log('--- Debug: Files in views directory ---');
    logger.log('Looking in:', viewsPath);
    logger.log('Files found:', files);
    logger.log('------------------------------------');
} catch (e) {
    logger.error('--- Debug: Error reading views directory ---', e);
}
// Route to render selection page
router.get('/select-messages-iota', (req, res) => {
  res.render('selectMessagesIOTA', { title: 'Select Messages For Upload'});
});
// Route to render selection page
router.get('/select-messages-signum', (req, res) => {
  res.render('selectMessagesSignum', { title: 'Select Messages For Upload'});
});
// Route to render global stats
router.get('/stats-global', (req, res) => {
  res.render('statsGlobal', { title: 'Global Upload Stats'});
});
// Route to render explorer links for Signum
router.get('/view-in-explorer-signum', (req, res) => {
  res.render('viewInExplorerSignum', { title: 'View Uploads In Signum Explorer'});
});
// Route to render explorer links for Iota
router.get('/view-on-iota-tangle', (req, res) => {
  res.render('viewOnTangleIota', { title: 'View Uploads On IOTA Tangle'});
});
// Route for password reset
router.get('/reset-password', (req, res) => {
  res.render('resetPassword', {layout: 'layout-no-sidebar'});
});
// Route for forgot password
router.get('/forgot-password', (req, res) => {
  res.render('forgotPassword', {layout: 'layout-no-sidebar'});
});
// Export
module.exports = router;