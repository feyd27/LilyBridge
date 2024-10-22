// services/database.js
const mongoose = require('mongoose');
const config = require('./config'); // Adjust the path as needed
const logger = require('../services/logger');

// Function to initialize the database connection
const connectToDatabase = () => {
    mongoose.connect(config.mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => {
        logger.log('Connected to MongoDB');
    })
    .catch(err => {
        logger.error('Error connecting to MongoDB:', err);
    });
};

module.exports = connectToDatabase;
