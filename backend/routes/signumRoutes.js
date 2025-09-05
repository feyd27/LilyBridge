// routes/signumRoutes.js

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const authMiddleware = require('../middleware/authMiddleware');
const MqttMessage = require('../models/message');
const UploadedMessage = require('../models/uploadedMessage');
const User = require('../models/user');
const logger = require('../services/logger');
const { composeApi } = require('@signumjs/core');
const { recordAttempt } = require('../services/recordAttempt');
const { LedgerClientFactory } = require('@signumjs/core');
const { generateSignKeys } = require('@signumjs/crypto');


const nodeHost = process.env.SIGNUM_NODE_HOST || 'https://europe.signum.network';
const SIGNUM_PASSPHRASE = process.env.SIGNUM_PASSPHRASE;
const SIGNUM_NUMERIC_ID = process.env.SIGNUM_NUMERIC_ID;
const SIGNUM_GENESIS_TIMESTAMP = Date.parse('2014-08-11T02:00:00Z');
const INTERNAL_JOB_KEY = process.env.INTERNAL_JOB_KEY;

if (!SIGNUM_PASSPHRASE) logger.error('[Signum] ERROR: SIGNUM_PASSPHRASE not set');
if (!SIGNUM_NUMERIC_ID) logger.error('[Signum] ERROR: SIGNUM_NUMERIC_ID not set');

// Initialize SignumJS client
const signumClient = composeApi({
  nodeHost: process.env.SIGNUM_NODE_HOST,
  network: process.env.SIGNUM_NETWORK || 'mainnet'
});


const ledger = LedgerClientFactory.createClient({ nodeHost });
logger.log(`[Signum] Ledger client initialized for node: ${nodeHost}`);


// Let internal jobs through with x-internal-key; otherwise require JWT
const internalOrAuth = (req, res, next) => {
  const hdr = req.get('x-internal-key') || req.get('x-inernal-key'); // accept common typo too
  if (INTERNAL_JOB_KEY && hdr === INTERNAL_JOB_KEY) {
    req.isInternalJob = true;
    return next();
  }
  return authMiddleware(req, res, next);
};


/**
 * @swagger
 * /signum/upload:
 *   post:
 *     summary: Upload selected temperature readings to the Signum blockchain
 *     tags:
 *       - Signum
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messageIds
 *             properties:
 *               messageIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of MqttMessage _id values to upload
 *               feeType:
 *                 type: string
 *                 enum: [cheap, standard, priority, minimum]
 *                 default: standard
 *     responses:
 *       201:
 *         description: Data uploaded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 explorerUrl:
 *                   type: string
 *                   description: Explorer link to the Signum transaction
 *                 payloadSize:
 *                   type: integer
 *                   description: Size of the payload in bytes
 *                 elapsedTime:
 *                   type: integer
 *                   description: Time elapsed (ms) between submission and response
 *                 fee:
 *                   type: number
 *                   description: Fee paid (in Planck)
 *       400:
 *         description: Bad request (e.g. payload too large or invalid messageIds)
 *       500:
 *         description: Server error
 */

router.post(
  '/upload',
  authMiddleware,
  async (req, res) => {
    logger.log('[Signum] /signum/upload start');
    logger.log('[Signum] Request body:', req.body);

    const { messageIds, feeType = 'priority' } = req.body;
    logger.log('[Signum] messageIds:', messageIds, 'feeType:', feeType);

    if (!Array.isArray(messageIds) || messageIds.length === 0) {
      logger.error('[Signum] messageIds array missing or empty');
      return res.status(400).json({ error: 'messageIds array required' });
    }
    // 1️⃣ Fetch user & tag prefix
    logger.log('[Signum] Fetching user with ID:', req.user.userId);
    let user;
    try {
      user = await User.findById(req.user.userId).lean();
      logger.log('[Signum] Loaded user:', user._id);
    } catch (err) {
      logger.error('[Signum] Error loading user:', err);
      return res.status(500).json({ error: 'Failed to load user' });
    }
    const rawPrefix = user.signumTagPrefix
      ? user.signumTagPrefix.slice(0, 16).replace(/\W/g, '')
      : user._id.toString();
    const dateStr = new Date().toISOString().slice(0, 10).split('-').reverse().join('');
    const tag = `${rawPrefix}@lilybridge_${dateStr}`;
    logger.log('[Signum] Generated tag:', tag);

    // 2️⃣ Load selected messages
    logger.log('[Signum] Loading MqttMessages for upload...');
    let messages;
    try {
      messages = await MqttMessage.find({
        _id: { $in: messageIds },
        uploadedBy: { $ne: req.user.userId }
      })
        .select('chipID macAddress temperature timestamp')
        .sort({ timestamp: 1 })
        .lean();
      logger.log(`[Signum] Found ${messages.length} messages to upload`);
      if (!messages.length) {
        logger.warn('[Signum] No matching or unuploaded messages found');
        return res.status(400).json({ error: 'No matching or already-uploaded messages' });
      }
    } catch (err) {
      logger.error('[Signum] Error loading messages:', err);
      return res.status(500).json({ error: 'Failed to load messages' });
    }

    // 3️⃣ Build payload
    logger.log('[Signum] Building payload object');
    const payloadObj = {
      tag,
      chipID: messages[0].chipID,
      macAddress: messages[0].macAddress,
      readings: messages.map(m => ({
        temperature: m.temperature,
        timestamp: m.timestamp.toISOString()
      }))
    };
    const payloadStr = JSON.stringify(payloadObj);
    const payloadSize = Buffer.byteLength(payloadStr, 'utf8');
    logger.log('[Signum] Payload built:', payloadObj);
    logger.log('[Signum] Payload size:', payloadSize, 'bytes');
    if (payloadSize > 1000) {
      await recordAttempt({
        userId: req.user.userId,
        blockchain: 'SIGNUM',
        tag,
        nodeHost,                // from your file
        payloadSize,
        payloadHash: crypto.createHash('sha256').update(payloadStr).digest('hex'),
        readingIds: messages.map(m => m._id),
        httpStatusReturned: 400,
        err: new Error('Payload too large')
      });
      logger.error('[Signum] Payload too large:', payloadSize);
      return res.status(400).json({
        error: 'Payload too large',
        payloadSize
      });
    }

    // 4️⃣ Compute feePlanck
    // Rule: Split 0–1000 bytes into 6 equal buckets (X = 1000/6 bytes).
    // Fee = bucketIndex * 1,000,000 Planck, capped at 6,000,000.

    logger.log('[Signum] Calculating fee from payload size…');
    const MAX_BYTES = 1000;                // already enforced above
    const buckets = 6;
    const bucketIdx = Math.min(
      buckets,
      Math.max(1, Math.ceil((payloadSize * buckets) / MAX_BYTES))
    );
    const feePlanck = bucketIdx * 1000000; // 1–6 million Planck
    logger.log(`[Signum] payloadSize=${payloadSize}B → bucket=${bucketIdx}/6 → feePlanck=${feePlanck}`);


    // 5️⃣ Submit to Signum
    logger.log('[Signum] Sending transaction to Signum...');
    logger.log('[Signum] Generating sign keys from passphrase...');
    const { publicKey, signPrivateKey } = generateSignKeys(SIGNUM_PASSPHRASE);
    logger.log('[Signum] Derived publicKey:', publicKey);
    logger.log('[Signum] Derived signPrivateKey present:', Boolean(signPrivateKey));
    const start = Date.now();
    let txResponse;
    try {
      logger.log('[Signum] Sending message via ledger.message.sendMessage()...');
      txResponse = await ledger.message.sendMessage({
        feePlanck: feePlanck,                       // required Planck 
        deadline: 1440,                            // optional, defaults to 1440
        message: payloadStr,                      // JSON payload
        messageIsText: true,                            // send as text
        recipientId: SIGNUM_NUMERIC_ID,               // numeric account ID
        senderPublicKey: publicKey,                       // from generateSignKeys
        senderPrivateKey: signPrivateKey                  // from generateSignKeys
      });
      logger.log('[Signum] sendMessage response:', txResponse);
    } catch (err) {
      await recordAttempt({
        userId: req.user.userId,
        blockchain: 'SIGNUM',
        tag,
        nodeHost,
        nodeHost: nodeUrl,
        feePlanck,
        payloadSize,
        payloadHash: crypto.createHash('sha256').update(payloadStr).digest('hex'),
        readingIds: messages.map(m => m._id),
        elapsedTime: Date.now() - start,
        httpStatusReturned: 500,
      });
      logger.error('[Signum] Error during Signum upload:', err);
      return res.status(500).json({ error: `Signum upload failed: ${err.message}` });
    }
    const elapsedTime = Date.now() - start;
    logger.log('[Signum] Elapsed time (ms):', elapsedTime);

    const txNumericId = txResponse.transaction;
    const explorerUrl = `https://explorer.signum.network/tx/${txNumericId}`;
    logger.log('[Signum] Explorer URL:', explorerUrl);

    // 6️⃣ Persist upload record
    logger.log('[Signum] Persisting upload record to DB');
    const batchId = `${req.user.userId}_${Date.now()}`;
    const record = await UploadedMessage.create({
      user: req.user.userId,
      batchId,
      blockchain: 'SIGNUM',
      txId: txResponse.transaction,
      index: tag,
      nodeHost,
      payloadHash: crypto.createHash('sha256').update(payloadStr).digest('hex'),
      payloadSize,
      startTime: new Date(start),
      elapsedTime,
      fee: Number(feePlanck),
      status: 'PENDING',
      readingCount: messages.length,
      readings: messages.map(m => m._id),
      explorerUrl,
      network: 'mainnet'
    });
    logger.log('[Signum] UploadedMessage record created:', record._id);
    // mark messages as uploaded
    await MqttMessage.updateMany(
      { _id: { $in: messages.map(m => m._id) } },
      { $push: { uploadedBy: req.user.userId } }
    );

    // 7️⃣ Return success
    logger.log('[Signum] /signum/upload completed successfully');
    return res.status(201).json({
      blockId: txNumericId,
      explorerUrl,
      payloadSize,
      elapsedTime,
      fee: Number(feePlanck)
    });
  }
);

// ─── Swagger JSDoc ────────────────────────────────────────────────────────────
/**
 * @swagger
 * tags:
 *   - name: Signum
 *     description: Signum blockchain operations
 */

/**
 * @swagger
 * /signum/simple-upload:
 *   post:
 *     summary: Upload a text message to the Signum blockchain
 *     tags: [ Signum ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: Hello, Signum!
 *               feeType:
 *                 type: string
 *                 enum: [cheap, standard, priority, minimum]
 *                 default: standard
 *     responses:
 *       201:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 txId:
 *                   type: string
 *                   description: Full hash of the transaction
 *                 explorerURL:
 *                   type: string
 *                   description: URL to view the transaction on the Signum explorer
 *       400:
 *         description: Missing required parameters
 *       500:
 *         description: Server or blockchain error
 */


router.post('/simple-upload', async (req, res) => {
  logger.log('[Signum] /upload hit, body:', req.body);
  const { message, feeType = 'cheap' } = req.body;

  // 1️⃣ Validate inputs & env
  if (!message) {
    logger.error('[Signum] Missing required parameter: message.');
    return res.status(400).json({ error: 'message is required' });
  }
  if (!SIGNUM_PASSPHRASE || !SIGNUM_NUMERIC_ID) {
    logger.error('[Signum] ENV misconfigured.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // 2️⃣ Select feePlanck
    logger.log('[Signum] Fetching suggested fees...');
    const suggestedFees = await ledger.network.getSuggestedFees();
    logger.log('[Signum] suggestedFees:', suggestedFees);
    const key = feeType.toLowerCase();
    const feePlanck = suggestedFees[key] != null ? suggestedFees[key] : suggestedFees.standard;
    logger.log(`[Signum] Using suggestedFees.${key}:`, feePlanck);

    // 3️⃣ Derive keys from passphrase
    logger.log('[Signum] Generating sign keys from passphrase...');
    const { publicKey, signPrivateKey } = generateSignKeys(SIGNUM_PASSPHRASE);
    logger.log('[Signum] publicKey:', publicKey);
    logger.log('[Signum] signPrivateKey:', Boolean(signPrivateKey));

    // 4️⃣ Broadcast in one call via message.sendMessage()
    logger.log('[Signum] Sending message via ledger.message.sendMessage()...');
    const txId = await ledger.message.sendMessage({
      feePlanck,                        // required string :contentReference[oaicite:1]{index=1}
      message,                          // required
      messageIsText: true,              // default
      recipientId: SIGNUM_NUMERIC_ID,   // required
      senderPublicKey: publicKey,       // SignKeys.publicKey
      senderPrivateKey: signPrivateKey  // SignKeys.signPrivateKey
    });
    logger.log('[Signum] sendMessage txId:', txId);
    // 5️⃣ Return explorer URL
    const explorerURL = `https://explorer.signum.network/tx/${txId.transaction}`;
    logger.log('[Signum] Explorer URL:', explorerURL);
    return res.status(201).json({ txId, explorerURL });

  } catch (error) {
    logger.error('[Signum] upload error:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /signum/temperature-extended:
 *   get:
 *     summary: Get paginated temperature messages with upload‐to‐Signum flag
 *     tags: [Signum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           enum: [25, 50, 100]
 *           default: 25
 *         description: Number of messages per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Page of temperature messages, each with `uploadedToSignum` flag
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:
 *                   type: integer
 *                   description: Total number of messages
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                 currentPage:
 *                   type: integer
 *                   description: Current page number
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       topic:
 *                         type: string
 *                       chipID:
 *                         type: string
 *                       macAddress:
 *                         type: string
 *                       temperature:
 *                         type: number
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       receivedAt:
 *                         type: string
 *                         format: date-time
 *                       uploadedToSignum:
 *                         type: boolean
 *                         description: Whether this message has been uploaded by you to Signum
 *       404:
 *         description: No temperature messages found
 *       500:
 *         description: Server error
 */
router.get(
  '/temperature-extended',
  authMiddleware,
  async (req, res) => {
    try {
      // 1️⃣ Pagination parameters
      const limitNum = Math.min(
        Math.max(parseInt(req.query.limit, 10) || 25, 1),
        100
      );
      const pageNum = Math.max(parseInt(req.query.page, 10) || 1, 1);

      // 2️⃣ Only temperature topic
      const query = { topic: 'temperature' };
      const totalItems = await MqttMessage.countDocuments(query);
      if (!totalItems) {
        return res.status(404).json({ error: 'No temperature messages found' });
      }

      // 3️⃣ Fetch paginated messages
      const messages = await MqttMessage.find(query)
        .sort({ receivedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();
      logger.log(`Fetched ${messages.length}/${totalItems} temperature messages`);

      // 4️⃣ Determine which readings have been uploaded to Signum
      const msgIds = messages.map(m => m._id);
      const uploads = await UploadedMessage.find({
        user: req.user.userId,
        blockchain: 'SIGNUM',
        readings: { $in: msgIds }
      })
        .select('readings')
        .lean();

      const uploadedSet = new Set(
        uploads.flatMap(u => u.readings.map(id => id.toString()))
      );

      // 5️⃣ Attach flag to each message
      const enriched = messages.map(m => ({
        ...m,
        uploadedToSignum: uploadedSet.has(m._id.toString())
      }));

      // 6️⃣ Send response
      return res.json({
        totalItems,
        totalPages: Math.ceil(totalItems / limitNum),
        currentPage: pageNum,
        messages: enriched
      });
    } catch (err) {
      logger.error('Error in /signum/temperature-extended', err);
      return res.status(500).json({ error: 'Failed to retrieve temperature messages' });
    }
  }
);

module.exports = router;


