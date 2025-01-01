const express = require('express');
const router = express.Router();

// Apply auth middleware to all protected routes
// router.use(authMiddleware);




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