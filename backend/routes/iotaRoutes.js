// routes/iotaRoutes.js
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { URL } = require('url');

const authMiddleware     = require('../middleware/authMiddleware');
const logger             = require('../services/logger');
const User               = require('../models/user');
const MqttMessage        = require('../models/message');
const UploadedMessage    = require('../models/uploadedMessage');

const DEFAULT_IOTA_NODE = 'https://api.shimmer.network';

/**
 * @swagger
 * /iota/upload:
 *   post:
 *     summary: Store a JSON object on the Shimmer Mainnet Tangle
 *     tags:
 *       - IOTA
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: JSON object containing a tag and data payload.  
 *                    Node URL is taken from user settings or default.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mode
 *             properties:
 *               mode:
 *                 type: string
 *                 description: "selected = specific messageIds, batch = 50 oldest unsent"
 *                 enum: [selected, batch]
 *               messageIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Required when mode=selected
 *             example:
 *               mode: "batch"
 *     responses:
 *       201:
 *         description: Data uploaded successfully.
 *       400:
 *         description: Bad request (missing/invalid body or node URL)
 *       502:
 *         description: Failed to connect to the configured IOTA node
 *       500:
 *         description: Internal server error
 */



router.post('/upload', authMiddleware, async (req, res) => {
  const { messageIds } = req.body;

  // 1️⃣ Validate input
  if (!Array.isArray(messageIds) || messageIds.length === 0) {
    return res.status(400).json({ error: 'You must supply an array of messageIds to upload.' });
  }
  logger.log('IOTA › upload request received', { userId: req.user.userId, messageIds });

  // 2️⃣ Load user & node URL
  let user, nodeUrl;
  try {
    user = await User.findById(req.user.userId).lean();
    nodeUrl = (user?.iotaNodeAddress?.trim() || DEFAULT_IOTA_NODE);
    nodeUrl = new URL(nodeUrl).href;
  } catch (err) {
    logger.error('IOTA › invalid node URL or user load failed', { error: err.message });
    return res.status(400).json({ error: `Bad IOTA node URL: "${nodeUrl}"` });
  }
  logger.log('IOTA › using node URL', { nodeUrl });

  // 3️⃣ Build indexation tag
  const rawPrefix = user.iotaTagPrefix
    ? user.iotaTagPrefix.slice(0,16).replace(/\W/g,'')
    : user._id.toString();
  const today = new Date().toISOString().slice(0,10).split('-').reverse().join('');
  const tag = `${rawPrefix}@lilybridge_${today}`;
  logger.log('IOTA › using indexation tag', { tag });

  // 4️⃣ Fetch exactly those messages
  let messages;
  try {
    messages = await MqttMessage.find({
      _id:         { $in: messageIds },
      uploadedBy:  { $ne: req.user.userId }
    })
    .select('chipID macAddress temperature timestamp')
    .sort({ timestamp: 1 })
    .lean();

    if (!messages.length) {
      return res.status(400).json({ error: 'No matching messages found (or already uploaded).' });
    }
  } catch (err) {
    logger.error('IOTA › failed loading messages', { error: err.message });
    return res.status(500).json({ error: 'Could not load messages.' });
  }
  logger.log('IOTA › loaded messages', { count: messages.length });

  // 5️⃣ Prepare payload
  const payload = {
    chipID:     messages[0].chipID,
    macAddress: messages[0].macAddress,
    readings:   messages.map(m => ({
      temperature: m.temperature,
      timestamp:   m.timestamp?.toISOString() ?? null
    }))
  };
  logger.log('IOTA › raw payload', { payload });

  // 6️⃣ Submit to IOTA
  try {
    const { Client, utf8ToHex } = await import('@iota/sdk');
    const client = new Client({ nodes: [nodeUrl] });

    const hexTag     = utf8ToHex(tag);
    const payloadStr = JSON.stringify(payload);
    const hexData    = utf8ToHex(payloadStr);
    const dataSize   = (hexData.length - 2) / 2;
    logger.log('IOTA › payload prepared', { dataSize });

    const start   = Date.now();
    let [blockId] = [];
    try {
      [blockId] = await client.buildAndPostBlock(undefined, { tag: hexTag, data: hexData });
    } catch (netErr) {
      logger.error('IOTA › network error', { error: netErr.message });
      return res.status(502).json({ error: `Node connection failed: ${netErr.message}` });
    }
    const elapsedMs = Date.now() - start;
    const explorer  = `https://explorer.shimmer.network/shimmer/block/${blockId}`;
    logger.log('IOTA › upload succeeded', { blockId, elapsedMs });

    // 7️⃣ Persist in DB & mark messages
    const batchId = `${req.user.userId}_${Date.now()}`;
    await UploadedMessage.create({
      user:         req.user.userId,
      batchId,
      blockchain:   'IOTA',
      txId:         blockId,
      index:        tag,
      nodeUrl,
      payloadHash:  crypto.createHash('sha256').update(payloadStr).digest('hex'),
      payloadSize:  dataSize,
      elapsedTime:  elapsedMs,
      sentAt:       new Date(),
      readingCount: payload.readings.length,
      readings:     messages.map(m => m._id),
      status:       'SENT',
      explorerUrl:  explorer,
      partIndex:    1,
      totalParts:   1,
      network:      'mainnet'
    });

    await MqttMessage.updateMany(
      { _id: { $in: messages.map(m => m._id) } },
      { $push: { uploadedBy: req.user.userId } }
    );

    // 8️⃣ Return success
    return res.status(201).json({
      message:       'Data uploaded successfully!',
      blockId,
      dataSizeBytes: dataSize,
      elapsedTime:   elapsedMs,
      explorerUrl:   explorer
    });
  } catch (err) {
    logger.error('IOTA › upload endpoint error', { error: err.stack });
    return res.status(500).json({ error: `Internal error: ${err.message}` });
  }
});

/**
 * @swagger
 * /iota/temperature-extended:
 *   get:
 *     summary: Get paginated temperature messages with upload‐to‐IOTA flag
 *     tags: [IOTA]
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
 *         description: Page of temperature messages, each with `uploadedToIOTA` flag
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
 *                       uploadedToIOTA:
 *                         type: boolean
 *                         description: Whether this message has been uploaded by you to IOTA
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
      // 1️⃣ Pagination
      const limitNum = Math.min(
        Math.max(parseInt(req.query.limit) || 25, 1),
        100
      );
      const pageNum = Math.max(parseInt(req.query.page) || 1, 1);

      // 2️⃣ Only temperature topic
      const query = { topic: 'temperature' };
      const totalItems = await MqttMessage.countDocuments(query);
      if (!totalItems) {
        return res.status(404).json({ error: 'No temperature messages found' });
      }

      // 3️⃣ Fetch messages
      const messages = await MqttMessage.find(query)
        .sort({ receivedAt: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
        .lean();
      logger.log(`Fetched ${messages.length}/${totalItems} temperature messages`);

      // 4️⃣ Find which of these have been uploaded by this user to IOTA
      const msgIds = messages.map(m => m._id);
      const uploads = await UploadedMessage.find({
        user:       req.user.userId,
        blockchain: 'IOTA',
        readings:  { $in: msgIds }
      })
      .select('readings')
      .lean();

      const uploadedSet = new Set(
        uploads.flatMap(u => u.readings.map(id => id.toString()))
      );

      // 5️⃣ Attach flag
      const enriched = messages.map(m => ({
        ...m,
        uploadedToIOTA: uploadedSet.has(m._id.toString())
      }));

      // 6️⃣ Return
      res.json({
        totalItems,
        totalPages:  Math.ceil(totalItems / limitNum),
        currentPage: pageNum,
        messages:    enriched
      });
    } catch (err) {
      logger.error('Error in /iota/temperature-extended', err);
      res.status(500).json({ error: 'Failed to retrieve temperature messages' });
    }
  }
);

/**
 * @swagger
 * /iota/find/{tag}:
 *   get:
 *     summary: Finds and decodes data from the Tangle by a given tag
 *     tags:
 *       - IOTA
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tag
 *         required: true
 *         schema:
 *           type: string
 *         description: The tag to search for on the Tangle.
 *     responses:
 *       '200':
 *         description: An array of found data payloads.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   messageId:
 *                     type: string
 *                   data:
 *                     description: Decoded JSON or text
 *                     oneOf:
 *                       - type: object
 *                       - type: string
 *       '404':
 *         description: No data found for the specified tag.
 *       '500':
 *         description: Error finding data on the Tangle.
 */
router.get('/find/:tag', authMiddleware, async (req, res) => {
  const { tag } = req.params;

  try {
    // 1️⃣ Hex-encode the UTF-8 tag (no "0x" prefix)
    const hexTag = Buffer.from(tag, 'utf8').toString('hex');

    // 2️⃣ Query the Shimmer Mainnet message indexer
    const idxResp = await fetch(
      `https://api.shimmer.network/api/indexer/v1/messages?index=${hexTag}`
    );

    // 2a) Tag not found → 404
    if (idxResp.status === 404) {
      return res.status(404).json({ message: 'No data found for this tag.' });
    }
    // 2b) Other non-OK → 500 + upstream error
    if (!idxResp.ok) {
      const errorBody = await idxResp.text();
      return res.status(500).json({ error: errorBody });
    }

    // 3️⃣ Parse the list of message IDs
    const { messageIds } = await idxResp.json();
    if (!messageIds.length) {
      // (defensive) if indexer returns an empty array
      return res.status(404).json({ message: 'No data found for this tag.' });
    }

    // 4️⃣ Fetch each block and decode its TaggedData payload
    const results = await Promise.all(messageIds.map(async (messageId) => {
      const coreResp = await fetch(
        `https://api.shimmer.network/api/core/v2/blocks/${messageId}`
      );
      if (!coreResp.ok) {
        // skip blocks we can’t fetch
        return null;
      }
      const { blockId, block } = await coreResp.json();
      if (block.payload?.type !== 5) {
        // skip non-TaggedData payloads
        return null;
      }

      // strip "0x", hex→utf8
      const dataHex = (block.payload.data || '').replace(/^0x/, '');
      const utf8Str = Buffer.from(dataHex, 'hex').toString('utf8');

      // try JSON.parse, else plain text
      let parsed;
      try { parsed = JSON.parse(utf8Str); }
      catch { parsed = utf8Str; }

      return { messageId: blockId, data: parsed };
    }));

    // 5️⃣ Filter out nulls and return
    const filtered = results.filter(r => r !== null);
    return res.status(200).json(filtered);

  } catch (err) {
    logger.error(`IOTA Find Error for tag "${tag}":`, err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;