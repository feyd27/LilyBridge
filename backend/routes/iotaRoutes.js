// /routes/iotaRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../services/logger');


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
 *       description: A JSON object to store. The tag is provided in the request body.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tag
 *               - data
 *             properties:
 *               tag:
 *                 type: string
 *                 description: The tag to index the data with.
 *               data:
 *                 type: object
 *                 description: The JSON payload to store.
 *             example:
 *               tag: "my-custom-tag"
 *               data:
 *                 sensorId: "TEMP-001"
 *                 temperature: 21.5
 *     responses:
 *       '201':
 *         description: Block posted successfully.
 *       '400':
 *         description: Invalid or missing JSON body/properties.
 *       '500':
 *         description: Error storing data on the Tangle.
 */
router.post('/upload', authMiddleware, async (req, res) => {
    try {
        const { tag, data } = req.body;
        if (!tag || !data || typeof data !== 'object') {
            return res.status(400).json({ error: 'Request body must be a JSON object with "tag" and "data" properties.' });
        }

        // Dynamically import the Node.js binding
        const { Client, utf8ToHex } = await import('@iota/sdk');

        // Connect to the Shimmer Mainnet
        const client = new Client({
            nodes: ['https://api.shimmer.network'],
        });

        // Prepare tag and data
        const hexTag = utf8ToHex(tag);
        const hexData = utf8ToHex(JSON.stringify(data));
        const dataSizeBytes = (hexData.length - 2) / 2; // Each byte is 2 hex chars, minus '0x'

        // Measure submission time
        const startTime = Date.now();
        const [blockId] = await client.buildAndPostBlock(undefined, { tag: hexTag, data: hexData });
        const elapsedTime = Date.now() - startTime;
        
        const explorerUrl = `https://explorer.testnet.shimmer.network/shimmer/block/${blockId}`;

        console.info(`IOTA data uploaded with tag "${tag}", Block ID: ${blockId}`);

        return res.status(201).json({
            message: "Data uploaded successfully!",
            blockId,
            dataSizeBytes,
            elapsedTime,
            explorerUrl
        });

    } catch (err) {
        logger.error('IOTA Upload Error:', err);
        return res.status(500).json({ error: err.message });
    }
});
module.exports = router;
