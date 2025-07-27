const uploadedMessageSchema = new mongoose.Schema({
  batchId: { type: String, required: true, unique: true, index: true },
  blockchain: { type: String, enum: ['IOTA', 'SIGNUM'], required: true }, // IOTA or Signum
  txId: { type: String, required: true }, // Transaction ID (works for both blockchains)
  index: { type: String }, // Optional for IOTA (Indexation key)
  nodeUrl: { type: String }, // Node endpoint used
  payloadHash: { type: String, required: true },
  readings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MqttMessage' }],
  sentAt: { type: Date, default: Date.now },
  status: { type: String, enum: ['PENDING', 'SENT', 'FAILED'], default: 'SENT' },
  confirmed: { type: Boolean, default: false },
  explorerUrl: { type: String },
  reUpload: { type: Boolean, default: false },
  uploadReason: { type: String },
  network: { type: String } // e.g., "mainnet", "testnet"
});
