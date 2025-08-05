// routes/signumRoutes.js

const express = require('express');
const router = express.Router();

const { LedgerClientFactory } = require('@signumjs/core');
const { generateSignKeys }    = require('@signumjs/crypto');

// ─── Environment & Client Setup ───────────────────────────────────────────────
const nodeHost          = process.env.SIGNUM_NODE_HOST    || 'https://europe.signum.network';
const SIGNUM_PASSPHRASE = process.env.SIGNUM_PASSPHRASE;
const SIGNUM_NUMERIC_ID = process.env.SIGNUM_NUMERIC_ID;

if (!SIGNUM_PASSPHRASE) console.error('[Signum] ERROR: SIGNUM_PASSPHRASE not set');
if (!SIGNUM_NUMERIC_ID) console.error('[Signum] ERROR: SIGNUM_NUMERIC_ID not set');

const ledger = LedgerClientFactory.createClient({ nodeHost });
console.log(`[Signum] Ledger client initialized for node: ${nodeHost}`);

// ─── Swagger JSDoc ────────────────────────────────────────────────────────────
/**
 * @swagger
 * tags:
 *   - name: Signum
 *     description: Signum blockchain operations
 */

/**
 * @swagger
 * /signum/upload:
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


router.post('/upload', async (req, res) => {
  console.log('[Signum] /upload hit, body:', req.body);
  const { message, feeType = 'standard' } = req.body;

  // 1️⃣ Validate inputs & env
  if (!message) {
    console.error('[Signum] Missing required parameter: message.');
    return res.status(400).json({ error: 'message is required' });
  }
  if (!SIGNUM_PASSPHRASE || !SIGNUM_NUMERIC_ID) {
    console.error('[Signum] ENV misconfigured.');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // 2️⃣ Select feePlanck
    console.log('[Signum] Fetching suggested fees...');
    const { cheap, standard, priority, minimum } = await ledger.network.getSuggestedFees();
    const plancks = { cheap, standard, priority, minimum };
    const feePlanck = String(plancks[feeType] || standard);
    console.log('[Signum] Selected feePlanck:', feePlanck);

    // 3️⃣ Derive keys from passphrase
    console.log('[Signum] Generating sign keys from passphrase...');
    const { publicKey, signPrivateKey } = generateSignKeys(SIGNUM_PASSPHRASE); 
    console.log('[Signum] publicKey:', publicKey);
    console.log('[Signum] signPrivateKey:', Boolean(signPrivateKey));

    // 4️⃣ Broadcast in one call via message.sendMessage()
    console.log('[Signum] Sending message via ledger.message.sendMessage()...');
    const txId = await ledger.message.sendMessage({
      feePlanck,                        // required string :contentReference[oaicite:1]{index=1}
      message,                          // required
      messageIsText: true,              // default
      recipientId: SIGNUM_NUMERIC_ID,   // required
      senderPublicKey: publicKey,       // SignKeys.publicKey
      senderPrivateKey: signPrivateKey  // SignKeys.signPrivateKey
    });
    console.log('[Signum] sendMessage txId:', txId);
    // 5️⃣ Return explorer URL
    const explorerURL = `https://explorer.signum.network/tx/${txId.transaction}`;
    console.log('[Signum] Explorer URL:', explorerURL);
    return res.status(201).json({ txId, explorerURL });

  } catch (error) {
    console.error('[Signum] upload error:', error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
