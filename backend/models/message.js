// models/message.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  topic: String,
  chipID: String,
  macAddress: String,
  temperature: Number,
  timestamp: Date,
  message: String,
  receivedAt: { type: Date, default: Date.now },
  uploadBatches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UploadedMessage' }],
  hash: { type: String }  
});

module.exports = mongoose.model('MqttMessage', messageSchema);
