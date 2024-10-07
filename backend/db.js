// db.js
const mongoose = require('mongoose');
require('dotenv').config();  // To load the environment variables from .env
const mongoOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  };
  
  // Connect to MongoDB
  mongoose.connect(process.env.MONGO_URI, mongoOptions)
    .then(() => console.log('Connected to MongoDB with SSL/TLS'))
    .catch(err => console.error('MongoDB connection error:', err));
  
  // Export mongoose to use in other parts of the application
  module.exports = mongoose;