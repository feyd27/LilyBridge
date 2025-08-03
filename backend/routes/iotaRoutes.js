// routes/iotaRoutes.js
const express         = require('express');
const router          = express.Router();
const authMiddleware  = require('../middleware/authMiddleware');
const User            = require('../models/user');
const logger          = require('../services/logger');

// default if user hasn’t set one:
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
 *       description: JSON payload to store.  
 *                    The indexation tag is auto-generated from the user’s settings
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - data
 *             properties:
 *               data:
 *                 type: object
 *                 description: The JSON payload to store.
 *             example:
 *               data:
 *                 sensorId: "TEMP-001"
 *                 temperature: 21.5
 *     responses:
 *       201:
 *         description: Data uploaded successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 blockId:
 *                   type: string
 *                   description: The returned block ID on the Tangle
 *                 dataSizeBytes:
 *                   type: integer
 *                 elapsedTime:
 *                   type: integer
 *                   description: Time in ms taken to submit
 *                 explorerUrl:
 *                   type: string
 *       400:
 *         description: Bad request (missing/invalid body or node URL)
 *       502:
 *         description: Failed to connect to the configured IOTA node
 *       500:
 *         description: Internal server error
 */
router.post('/upload', authMiddleware, async (req, res) => {
  const { data } = req.body;
  if (!data || typeof data !== 'object') {
    return res.status(400).json({
      error: 'Request body must include "data" (object).'
    });
  }

  // 1️⃣ pick node URL
  let nodeUrl = DEFAULT_IOTA_NODE;
  let user;
  try {
    user = await User.findById(req.user.userId).lean();
    if (user?.iotaNodeAddress) nodeUrl = user.iotaNodeAddress.trim();
  } catch (err) {
    logger.error('IOTA › could not load user settings', {
      userId: req.user.userId,
      error: err.message
    });
  }

  // 2️⃣ validate node URL
  try {
    nodeUrl = new URL(nodeUrl).href;
  } catch {
    return res.status(400).json({
      error: `Configured IOTA node URL is invalid: "${nodeUrl}".`
    });
  }
  logger.log('IOTA › using node URL', { nodeUrl, userId: req.user.userId });

  // 3️⃣ build indexation tag
  let prefix = user?.iotaTagPrefix || user._id.toString();
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const dateStr = `${dd}${mm}${yyyy}`;
  const tag = `${prefix}@lilybridge_${dateStr}`;
  logger.log('IOTA › using indexation tag', { tag });

  try {
    // 4️⃣ import SDK & prepare client
    const { Client, utf8ToHex } = await import('@iota/sdk');
    const client = new Client({ nodes: [nodeUrl] });

    // 5️⃣ prepare payload
    const hexTag      = utf8ToHex(tag);
    const payloadStr  = JSON.stringify(data);
    const hexData     = utf8ToHex(payloadStr);
    const dataSizeBytes = (hexData.length - 2) / 2;
    logger.log('IOTA › payload prepared', { tag, dataSizeBytes });

    // 6️⃣ submit & time it
    const startTime = Date.now();
    let blockId;
    try {
      [blockId] = await client.buildAndPostBlock(undefined, { tag: hexTag, data: hexData });
    } catch (err) {
      logger.error('IOTA › network error submitting block', { error: err.message });
      return res.status(502).json({
        error: `Failed to connect to IOTA node: ${err.message}`
      });
    }
    const elapsedTime = Date.now() - startTime;
    const explorerUrl = `https://explorer.shimmer.network/shimmer/block/${blockId}`;
    logger.log('IOTA › upload succeeded', { blockId, elapsedTime });

    return res.status(201).json({
      message:      'Data uploaded successfully!',
      blockId,
      dataSizeBytes,
      elapsedTime,
      explorerUrl
    });
  } catch (err) {
    logger.error('IOTA › upload endpoint error', { error: err.stack });
    return res.status(500).json({
      error: `Internal error: ${err.message}`
    });
  }
});

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
