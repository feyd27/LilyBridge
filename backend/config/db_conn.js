const mongoose = require('mongoose');
const config = require('./config'); // Adjust the path as needed
const logger = require('../services/logger');

// Function to initialize the database connection
const connectToDatabase = () => {
    mongoose.connect(config.mongoURI)
        .then(() => {
            logger.log('Connected to MongoDB successfully');
        })
        .catch(err => {
            logger.error('Error connecting to MongoDB:', err);
            process.exit(1); // Exit process with failure if connection fails
        });

    // Log connection events for better monitoring
    mongoose.connection.on('connected', () => {
        logger.log('Mongoose connected to database');
    });

    mongoose.connection.on('error', (err) => {
        logger.error('Mongoose connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
        logger.warn('Mongoose connection disconnected');
    });

    // Handle Node.js process termination events
    process.on('SIGINT', async () => {
        await mongoose.connection.close();
        logger.log('Mongoose connection closed due to application termination');
        process.exit(0);
    });
};

module.exports = connectToDatabase;

