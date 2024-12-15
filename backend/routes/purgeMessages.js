// backend/routes/purgeMessages.js

const express = require('express');
const Message = require('../models/message'); // Replace with the actual model name if different
const router = express.Router();

/**
 * @swagger
 * /api/messages/purge:
 *   delete:
 *     summary: Purge all messages from the database
 *     tags: [Messages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All messages deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: All messages purged successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */

router.delete('/purge', async (req, res) => {
    try {
        await Message.deleteMany({});
        res.status(200).json({ message: 'All messages purged successfully' });
    } catch (error) {
        console.error('Error purging messages:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
