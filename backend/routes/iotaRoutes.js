// routes/iotaRoutes.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { URL } = require('url');

const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../services/logger');
const User = require('../models/user');
const MqttMessage = require('../models/message');
const UploadedMessage = require('../models/uploadedMessage');

const { data } = require('jquery');
const { recordAttempt } = require('../services/recordAttempt');

const DEFAULT_IOTA_NODE = 'https://api.shimmer.network';
// ─── Swagger JSDoc ────────────────────────────────────────────────────────────
/**
 * @swagger
 * tags:
 *   - name: IOTA
 *     description: IOTA Tangle operations
 */
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
  logger.log('[IOTA] Upload request received', { userId: req.user.userId, messageIds });

  // 2️⃣ Load user & node URL
  let user, nodeUrl;
  try {
    user = await User.findById(req.user.userId).lean();
    nodeUrl = (user?.iotaNodeAddress?.trim() || DEFAULT_IOTA_NODE);
    nodeUrl = new URL(nodeUrl).href;
  } catch (err) {
    logger.error('[IOTA] Invalid node URL or user load failed', { error: err.message });
    return res.status(400).json({ error: `Bad IOTA node URL: "${nodeUrl}"` });
  }
  logger.log('[IOTA] Using node URL', { nodeUrl });

  // 3️⃣ Build indexation tag
  const rawPrefix = user.iotaTagPrefix
    ? user.iotaTagPrefix.slice(0, 16).replace(/\W/g, '')
    : user._id.toString();
  const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('');
  const tag = `${rawPrefix}@lilybridge_${today}`;
  logger.log('[IOTA] Using indexation tag', { tag });

  // 4️⃣ Fetch exactly those messages
  let messages;
  try {
    messages = await MqttMessage.find({
      _id: { $in: messageIds },
      uploadedBy: { $ne: req.user.userId }
    })
      .select('chipID macAddress temperature timestamp')
      .sort({ timestamp: 1 })
      .lean();

    if (!messages.length) {
      return res.status(400).json({ error: 'No matching messages found (or already uploaded).' });
    }
  } catch (err) {
    logger.error('[IOTA] Failed to load messages', { error: err.message });
    return res.status(500).json({ error: 'Could not load messages.' });
  }
  logger.log('[IOTA] Loaded messages', { count: messages.length });

  // 5️⃣ Prepare payload
  const payload = {
    chipID: messages[0].chipID,
    macAddress: messages[0].macAddress,
    readings: messages.map(m => ({
      temperature: m.temperature,
      timestamp: m.timestamp?.toISOString() ?? null
    }))
  };
  logger.log('[IOTA] Raw payload', JSON.stringify(payload, null, 2));

  // 6️⃣ Submit to IOTA
  try {
    const { Client, utf8ToHex } = await import('@iota/sdk');
    const client = new Client({ nodes: [nodeUrl] });

    const hexTag = utf8ToHex(tag);
    const payloadStr = JSON.stringify(payload);
    const hexData = utf8ToHex(payloadStr);
    const dataSize = (hexData.length - 2) / 2;
    logger.log('[IOTA] Payload prepared', { dataSize });
    const MAX_BYTES = 32 * 1024;
    if (dataSize > MAX_BYTES) {
      await recordAttempt({
        userId: req.user.userId,
        blockchain: 'IOTA',
        tag,
        nodeUrl,
        payloadSize: dataSize,
        payloadHash: crypto.createHash('sha256').update(payloadStr).digest('hex'),
        readingIds: messages.map(m => m._id),
        httpStatusReturned: 400,
        err: new Error('Payload too large')
      });
      logger.error('[IOTA] Paylod too large, { dataSize}');
      return res.status(400).json({
        error: 'Payload too large, update the selection',
        dataSizeBytes: dataSize,
        maxAllowed: MAX_BYTES
      });
    }
    const start = Date.now();
    let [blockId] = [];
    try {
      [blockId] = await client.buildAndPostBlock(undefined, { tag: hexTag, data: hexData });
    } catch (netErr) {
      await recordAttempt({
        userId: req.user.userId,
        blockchain: 'IOTA',
        tag,
        nodeUrl,
        payloadSize: dataSize,
        payloadHash: crypto.createHash('sha256').update(payloadStr).digest('hex'),
        readingIds: messages.map(m => m._id),
        elapsedTime: Date.now() - start,
        httpStatusReturned: 502,
        err: netErr
      });
      logger.error('IOTA › network error', { error: netErr.message });
      return res.status(502).json({ error: `Node connection failed: ${netErr.message}` });
    }
    const elapsedMs = Date.now() - start;
    const explorer = `https://explorer.shimmer.network/shimmer/block/${blockId}`;
    logger.log('[IOTA] upload succeeded', { blockId, elapsedMs, explorer});

    // 7️⃣ Persist in DB & mark messages
    const batchId = `${req.user.userId}_${Date.now()}`;
    await UploadedMessage.create({
      user: req.user.userId,
      batchId,
      blockchain: 'IOTA',
      txId: blockId,
      index: tag,
      nodeUrl,
      payloadHash: crypto.createHash('sha256').update(payloadStr).digest('hex'),
      payloadSize: dataSize,
      elapsedTime: elapsedMs,
      sentAt: new Date(),
      readingCount: payload.readings.length,
      readings: messages.map(m => m._id),
      status: 'SENT',
      confirmed: true,
      explorerUrl: explorer,
      partIndex: 1,
      totalParts: 1,
      network: 'mainnet'
    });

    await MqttMessage.updateMany(
      { _id: { $in: messages.map(m => m._id) } },
      { $push: { uploadedBy: req.user.userId } }
    );

    // 8️⃣ Return success
    return res.status(201).json({
      message: 'Data uploaded successfully!',
      blockId,
      dataSizeBytes: dataSize,
      elapsedTime: elapsedMs,
      explorerUrl: explorer
    });
  } catch (err) {
    await recordAttempt({
      userId: req.user.userId,
      blockchain: 'IOTA',
      tag,
      nodeUrl,
      payloadSize: dataSize,                // guard if not defined
      payloadHash: payloadStr ? crypto.createHash('sha256').update(payloadStr).digest('hex') : undefined,
      readingIds: messages?.map(m => m._id) || [],
      httpStatusReturned: 500,
      err
    });
    logger.error('[IOTA] upload endpoint error', { error: err.stack });
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
        user: req.user.userId,
        blockchain: 'IOTA',
        readings: { $in: msgIds }
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
        totalPages: Math.ceil(totalItems / limitNum),
        currentPage: pageNum,
        messages: enriched
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
 *     summary: Finds and decodes data from the IOTA/Shimmer Tangle by a tag
 *     tags: [IOTA]
 *     security:
 *       - cookieAuth: []   # Use cookie-based authentication
 *     parameters:
 *       - in: path
 *         name: tag
 *         required: true
 *         schema:
 *           type: string
 *         description: The UTF-8 tag to search for on the Tangle.
 *     responses:
 *       200:
 *         description: An array of found data payloads, each linked to its block ID.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   blockId:
 *                     type: string
 *                     description: The ID of the block containing the payload.
 *                   data:
 *                     description: The decoded payload, which can be JSON or plain text.
 *                     oneOf:
 *                       - type: object
 *                       - type: string
 *       401:
 *         description: Unauthorized. User is not logged in.
 *       404:
 *         description: No data found for the specified tag.
 *       500:
 *         description: Internal server error or error communicating with the Tangle.
 */

router.get('/find/:tag', authMiddleware, async (req, res) => {
    const { tag } = req.params;

    try {
        // 1️⃣ Hex-encode the UTF-8 tag and add the "0x" prefix for the query
        const hexTag = '0x' + Buffer.from(tag, 'utf8').toString('hex');

        // 2️⃣ Query the modern Shimmer Mainnet Indexer for output IDs by tag
        const idxResp = await fetch(
            `https://api.shimmer.network/api/plugins/indexer/v1/outputs/basic?tag=${hexTag}`
        );
        if (!idxResp.ok) {
            // If the tag is not found, the indexer returns a 200 OK with an empty items array,
            // so any non-OK status is a server-side error.
            const errorBody = await idxResp.text();
            return res.status(500).json({ error: `Indexer error: ${errorBody}` });
        }

        // 3️⃣ Parse the list of output IDs from the 'items' array
        const { items: outputIds } = await idxResp.json();
        if (!outputIds || outputIds.length === 0) {
            return res.status(404).json({ message: 'No data found for this tag.' });
        }

        // 4️⃣ For each output, find its block and decode the payload
        const results = await Promise.all(outputIds.map(async (outputId) => {
            try {
                // 4a) Get the output's metadata to find the blockId it was included in
                const outputResp = await fetch(
                    `https://api.shimmer.network/api/core/v2/outputs/${outputId}`
                );
                if (!outputResp.ok) return null; // Skip if we can't get output metadata
                const { metadata } = await outputResp.json();
                const { blockId } = metadata;

                // 4b) Fetch the full block using the blockId
                const blockResp = await fetch(
                    `https://api.shimmer.network/api/core/v2/blocks/${blockId}`
                );
                if (!blockResp.ok) return null; // Skip if we can't fetch the block
                const blockData = await blockResp.json();

                // Check for a Tagged Data Payload (type 5)
                if (blockData.payload?.type !== 5) return null;

                // Decode the data from hex to a readable string
                const dataHex = (blockData.payload.data || '').replace(/^0x/, '');
                const utf8Str = Buffer.from(dataHex, 'hex').toString('utf8');

                // Try to parse as JSON, otherwise return as plain text
                let parsedData;
                try { parsedData = JSON.parse(utf8Str); }
                catch { parsedData = utf8Str; }

                return { blockId, data: parsedData };
            } catch (e) {
                // Ignore errors for individual items to not fail the whole request
                logger.warn(`Failed to process output ${outputId}:`, e.message);
                return null;
            }
        }));

        // 5️⃣ Filter out any nulls (failed lookups) and return the results
        const filteredResults = results.filter(r => r !== null);
        if (filteredResults.length === 0) {
            return res.status(404).json({ message: 'Data found but could not be decoded.' });
        }

        return res.status(200).json(filteredResults);

    } catch (err) {
        logger.error(`IOTA Find Error for tag "${tag}":`, err);
        return res.status(500).json({ error: err.message });
    }
});

module.exports = router;

