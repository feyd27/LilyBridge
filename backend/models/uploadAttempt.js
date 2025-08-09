// models/uploadAttempt.js
const mongoose = require('mongoose');

const UploadAttemptSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  blockchain:   { type: String, enum: ['IOTA', 'SIGNUM'], index: true },
  correlationId:{ type: String, index: true },   // hash(user|payloadHash|sortedReadingIds)
  attemptNo:    { type: Number },                // 1,2,3... per correlationId
  status:       { type: String, default: 'FAILED' },

  // context
  tag:          String,
  nodeUrl:      String,     // IOTA
  nodeHost:     String,     // Signum
  network:      { type: String, default: 'mainnet' },
  feePlanck:    Number,     // Signum only
  txId:         String,     // if available

  // payload
  payloadHash:  String,
  payloadSize:  Number,
  readingCount: Number,
  readings:     [{ type: mongoose.Schema.Types.ObjectId, ref: 'MqttMessage' }],

  // timings
  occurredAt:   { type: Date, default: Date.now },
  elapsedTime:  Number,     // ms until failure

  // error info
  httpStatusReturned: Number,
  errorType:    String,     // e.g. HttpError, MongoServerError
  errorCode:    String,     // e.g. 400 or provider-specific code
  errorMessage: String,
  stack:        String
}, { timestamps: true });

UploadAttemptSchema.index({ user: 1, blockchain: 1, correlationId: 1, attemptNo: 1 }, { unique: true });// In models/uploadAttempt.js
UploadAttemptSchema.index({ occurredAt: -1 });
UploadAttemptSchema.index({ blockchain: 1, occurredAt: -1 });
UploadAttemptSchema.index({ user: 1, occurredAt: -1 });
UploadAttemptSchema.index({ errorType: 1, occurredAt: -1 });



module.exports = mongoose.model('UploadAttempt', UploadAttemptSchema);
