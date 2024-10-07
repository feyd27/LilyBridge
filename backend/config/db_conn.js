// services/database.js
const mongoose = require('mongoose');
const config = require('../config/config'); // Adjust the path as needed

// Function to initialize the database connection
const connectToDatabase = () => {
    mongoose.connect(config.mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => {
        console.log('Connected to MongoDB');
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
    });
};

module.exports = connectToDatabase;
