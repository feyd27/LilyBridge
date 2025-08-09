// services/recordAttempt.js
const crypto = require('crypto');
const UploadAttempt = require('../models/uploadAttempt');

function makeCorrelationId({ userId, blockchain, payloadHash, readingIds }) {
  const sorted = (readingIds || []).map(String).sort().join(',');
  return crypto.createHash('sha256')
    .update(`${blockchain}|${userId}|${payloadHash}|${sorted}`)
    .digest('hex');
}

async function recordAttempt({
  userId, blockchain, tag, nodeUrl, nodeHost, feePlanck,
  txId, payloadSize, payloadHash, readingIds, elapsedTime,
  httpStatusReturned, err, network = 'mainnet'
}) {
  const correlationId = makeCorrelationId({ userId, blockchain, payloadHash, readingIds });
  const attemptNo = await UploadAttempt.countDocuments({ user: userId, blockchain, correlationId }) + 1;

  return UploadAttempt.create({
    user: userId,
    blockchain,
    correlationId,
    attemptNo,
    status: 'FAILED',
    tag,
    nodeUrl,
    nodeHost,
    network,
    feePlanck,
    txId,
    payloadSize,
    payloadHash,
    readingCount: readingIds?.length || 0,
    readings: readingIds || [],
    occurredAt: new Date(),
    elapsedTime,
    httpStatusReturned,
    errorType: err?.name,
    errorCode: String(err?.status || err?.code || ''),
    errorMessage: err?.message || 'Unknown error',
    stack: err?.stack
  });
}

module.exports = { recordAttempt };
