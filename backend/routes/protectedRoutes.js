const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

// Apply auth middleware to all protected routes
router.use(authMiddleware);

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



// Export
module.exports = router;