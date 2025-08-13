// backend/routes/purgeMessages.js

const express = require('express');
const router = express.Router();
const logger = require('../services/logger');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/user');
const Message = require('../models/message'); // assumes your status messages use this model


/**
 * @swagger
 * /api/messages/purge:
 *   delete:
 *     summary: Purge all messages from the database
 *     tags: [Admin]
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
    logger.error('Error purging messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @swagger
 * /api/messages/status-all:
 *   delete:
 *     summary: Delete all status messages except the newest one
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Old status messages deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deletedCount:
 *                   type: integer
 *                   description: Number of status messages removed
 *                 keptId:
 *                   type: string
 *                   description: The ID of the message kept
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: No status messages found
 *       500:
 *         description: Server error
 */
router.delete(
  '/status-all',
  authMiddleware,
  async (req, res) => {
    try {
      // ensure admin role
      const user = await User.findById(req.user.userId).lean();
      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: admins only' });
      }

      // find the single newest status message
      const newest = await Message
        .findOne({ topic: 'status' })
        .sort({ receivedAt: -1 })
        .lean();

      if (!newest) {
        return res.status(404).json({ message: 'No status messages found' });
      }

      // delete all others
      const { deletedCount } = await Message.deleteMany({
        topic: 'status',
        _id: { $ne: newest._id }
      });

      return res.status(200).json({
        deletedCount,
        keptId: newest._id
      });
    } catch (err) {
      logger.error('Error deleting old status messages:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);

/**
 * @swagger
 * /api/messages/login-history:
 *   delete:
 *     summary: Trim login history for all users, keeping only their 3 most recent entries
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Login history trimmed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 usersProcessed:
 *                   type: integer
 *                   description: Number of users whose history was trimmed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.delete(
  '/login-history',
  authMiddleware,
  async (req, res) => {
    try {
      const me = await User.findById(req.user.userId).lean();
      if (me.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden: admins only' });
      }

      const users = await User.find({ 'loginHistory.3': { $exists: true } }).lean();
      let processed = 0;

      for (const u of users) {
        // sort descending by timestamp, keep top 3
        const keep = u.loginHistory
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 3);

        await User.updateOne(
          { _id: u._id },
          { $set: { loginHistory: keep } }
        );
        processed++;
      }

      return res.status(200).json({
        usersProcessed: processed
      });
    } catch (err) {
      logger.error('Error trimming login histories:', err);
      return res.status(500).json({ message: 'Server error' });
    }
  }
);


module.exports = router;
