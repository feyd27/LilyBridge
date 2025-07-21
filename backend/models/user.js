const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true, // Trims any extra whitespace
        lowercase: true, // Stores email in lowercase for consistency
    },
    password: {
        type: String,
        required: true,
    },
    mqttBroker: {
        address: { type: String, required: false, default: null },
        username: { type: String, required: false, default: null },
        password: { type: String, required: false, default: null  },
        isPrivate: { type: Boolean, required: true, default: true }
    },
    role: {
        type: String,
        enum: ['reader', 'user', 'admin'],
        default: 'user', // Default role
        required: true,
    },
    refreshToken: {
        type: String,
        default: null
    },
    verificationToken: {
        type: String
    },
    isVerified: {
            type: Boolean,
            default: false
    },
    hasCompletedSetup: { type: Boolean, default: false }, // Add this field
    loginHistory: [{ 
      timestamp: { type: Date, default: Date.now } 
    }],
    passwordResetHistory: [{ 
      timestamp: { type: Date, default: Date.now } 
    }],
    // ← NEW FIELDS →
  iotaAddress:        { type: String, default: null },
  signumAddress:      { type: String, default: null },
  encryptedPassphrase:{ type: String, default: null },   
  passphraseSalt:     { type: String, default: null }    
}, {
  timestamps: true
});
module.exports = mongoose.model('User', userSchema);
