// routes/signumConfirmPublic.js
const express = require('express');
const router  = express.Router();

const { LedgerClientFactory } = require('@signumjs/core');
const UploadedMessage = require('../models/uploadedMessage');
const logger = require('../services/logger');

// ── Config ────────────────────────────────────────────────────────────────────
const INTERNAL_JOB_KEY = process.env.INTERNAL_JOB_KEY;
const nodeHost = process.env.SIGNUM_NODE_HOST || 'https://europe.signum.network';
// Signum mainnet genesis (ms since epoch)
const SIGNUM_GENESIS_TIMESTAMP = 1407722400000;

const ledger = LedgerClientFactory.createClient({ nodeHost });

// ── Tiny key-only guard for internal calls ────────────────────────────────────
function internalKeyOnly(req, res, next) {
  const hdr = req.get('x-internal-key') || req.get('x-inernal-key'); // accept common typo
  if (!INTERNAL_JOB_KEY || hdr !== INTERNAL_JOB_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

/**
 * @swagger
 * /internal/signum/confirm:
 *   post:
 *     summary: Internal — confirm a Signum transaction and update the DB
 *     description: Server-to-server endpoint used by the background poller. Requires `x-internal-key`.
 *     tags: [Signum]
 *     parameters:
 *       - in: header
 *         name: x-internal-key
 *         required: true
 *         schema: { type: string }
 *         description: Shared secret for internal jobs (INTERNAL_JOB_KEY).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [txId]
 *             properties:
 *               txId:
 *                 type: string
 *                 description: Numeric Signum transaction ID to confirm
 *           examples:
 *             sample: { value: { txId: "13207904750908933570" } }
 *     responses:
 *       200:
 *         description: Transaction confirmed and DB updated
 *       401:
 *         description: Missing/invalid x-internal-key
 *       404:
 *         description: Tx not yet included or no matching DB record
 *       400:
 *         description: Invalid txId
 *       500:
 *         description: Server error
 */
router.post('/confirm', internalKeyOnly, async (req, res) => {
  const { txId } = req.body || {};
  if (!txId || typeof txId !== 'string') {
    return res.status(400).json({ error: 'txId (string) is required' });
  }

  try {
    const txInfo = await ledger.transaction.getTransaction(txId);
    logger.log('[SignumConfirmPublic] getTransaction:', txId, txInfo?.height, txInfo?.blockTimestamp);

    // Not yet forged into a block
    if (txInfo.height == null || txInfo.blockTimestamp == null) {
      return res.status(404).json({ error: 'Transaction not yet included in a block' });
    }

    const blockIndex  = txInfo.height;
    const confirmedAt = new Date(SIGNUM_GENESIS_TIMESTAMP + txInfo.blockTimestamp * 1000);

    // Update by chain + txId (no user constraint here)
    const updated = await UploadedMessage.findOneAndUpdate(
      { blockchain: 'SIGNUM', txId },
      { confirmed: true, confirmedAt, blockIndex, status: 'CONFIRMED' },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'No matching upload record found for this txId' });
    }

    return res.json({
      success: true,
      txId: updated.txId,
      confirmedAt: updated.confirmedAt,
      blockIndex: updated.blockIndex
    });
  } catch (err) {
    logger.error('[SignumConfirmPublic] error:', err);
    if (err.name === 'HttpError' && err.status === 400) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }
    return res.status(500).json({ error: 'Failed to confirm transaction inclusion' });
  }
});

module.exports = router;
