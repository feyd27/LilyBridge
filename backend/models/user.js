// models/user.js
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  mqttBroker: {
    address:   { type: String, required: false, default: null },
    username:  { type: String, required: false, default: null },
    password:  { type: String, required: false, default: null },
    isPrivate: { type: Boolean, required: true,  default: true },
  },
  role: {
    type: String,
    enum:  ['reader', 'user', 'admin'],
    default: 'user',
    required: true,
  },
  refreshToken: {
    type: String,
    default: null,
  },
  verificationToken: {
    type: String,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  hasCompletedSetup: {
    type: Boolean,
    default: false,
  },
  loginHistory: [{
    timestamp: { type: Date, default: Date.now }
  }],
  passwordResetHistory: [{
    timestamp: { type: Date, default: Date.now }
  }],

  iotaNodeAddress:   { type: String, required: false, default: 'https://api.shimmer.network' },
  signumNodeAddress: { type: String, required: false, default: 'https://europe.signum.network' },

  // ← NEW FIELD →
  iotaTagPrefix: {
    type: String,
    required: false,
    default: null,
    maxlength: 16,
    match: /^[A-Za-z0-9]+$/   // only alphanumeric
  },

  // ← NEW FIELD →
  signumTagPrefix: {
    type: String,
    required: false,
    default: null,
    maxlength: 16,
    match: /^[A-Za-z0-9]+$/   // only alphanumeric
  },

}, {
  timestamps: true
});

// (Optional) hash password pre-save left out for brevity…

module.exports = mongoose.model('User', userSchema);
