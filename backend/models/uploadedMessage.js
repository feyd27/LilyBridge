// models/UploadedMessage.js
const mongoose = require('mongoose');

const uploadedMessageSchema = new mongoose.Schema({
  
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  batchId:      { type: String, required: true, unique: true, index: true },
  blockchain:   { type: String, enum: ['IOTA','SIGNUM'], required: true },
  txId:         { type: String, required: true },
  index:        { type: String },          // IOTA indexation tag
  nodeUrl:      { type: String },

  // payload fingerprint  
  payloadHash:  { type: String, required: true },

  // ◀— analytics fields
  payloadSize:    { type: Number, required: true }, // bytes
  elapsedTime:    { type: Number, required: true }, // ms taken to submit
  startTime:      { type: Date }, // for Signum uploads

  fee:            { type: Number },                // on-chain fee (if any)
  sentAt:         { type: Date,   default: Date.now },
  confirmedAt:    { type: Date },                  // when included
  blockIndex:     { type: Number },                // milestone or block height
  readingCount:   { type: Number, required: true },

  readings:       [{ type: mongoose.Schema.Types.ObjectId, ref: 'MqttMessage' }],
  status:         { type: String, enum: ['PENDING','SENT','FAILED'], default: 'SENT' },
  failureReason:  { type: String },                // last error if any

  // for chunking large batches:
  partIndex:      { type: Number },
  totalParts:     { type: Number },

  // metadata
  confirmed:      { type: Boolean, default: false },
  explorerUrl:    { type: String },
  reUpload:       { type: Boolean, default: false },
  uploadReason:   { type: String },
  network:        { type: String }                  // e.g. "mainnet","testnet"
}, {
  timestamps: true
});

// never upload the same reading twice to the same chain *for the same user*:
uploadedMessageSchema.index(
  { user: 1, blockchain: 1, readings: 1 },
  {
    partialFilterExpression: { readings: { $exists: true } }
  }
);

module.exports = mongoose.model('UploadedMessage', uploadedMessageSchema);

