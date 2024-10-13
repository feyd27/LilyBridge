// models/message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  topic: String,
  chipID: String,
  macAddress: String,
  temperature: Number,
  timestamp: Date,
  message: String,
  receivedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MqttMessage', messageSchema);
