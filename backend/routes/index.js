// routes/index.js

const express = require('express');
const router = express.Router();
const statusRoutes = require('./statusRoutes');

router.use('/', statusRoutes);

module.exports = router;
