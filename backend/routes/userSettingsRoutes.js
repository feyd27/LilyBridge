// routes/userSettingsRoutes.js
const express = require('express');
const router = express.Router();
const logger = require('../services/logger');
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/user');

/**
 * @swagger
 * /api/settings/me:
 *   get:
 *     summary: Get user settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User settings retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 username:
 *                   type: string
 *                   example: user@example.com
 *                 role:
 *                   type: string
 *                   example: user
 *                 iotaNodeAddress:
 *                   type: string
 *                   description: The IOTA node URL to which data will be uploaded
 *                   example: https://api.shimmer.network
 *                 signumNodeAddress:
 *                   type: string
 *                   description: The Signum node URL to which data will be uploaded
 *                   example: https://nodes.signum.network
 *                 iotaTagPrefix:
 *                   type: string
 *                   nullable: true
 *                   description: Optional alphanumeric (max 16 chars) prefix used in IOTA indexation tags
 *                   example: MYTAG123
 *                 mqttBroker:
 *                   type: object
 *                   properties:
 *                     address:
 *                       type: string
 *                       example: mqtt://broker.example.com
 *                     username:
 *                       type: string
 *                       example: mqttuser
 *                     password:
 *                       type: string
 *                       example: mqttpassword
 *                     isPrivate:
 *                       type: boolean
 *                       example: true
 *                 loginHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                 passwordResetHistory:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: User not found
 *       500:
 *         description: Error fetching user settings
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const settings = {
      username: user.username,
      role: user.role,
      iotaNodeAddress: user.iotaNodeAddress || 'https://api.shimmer.network',
      signumNodeAddress: user.signumNodeAddress || 'https://europe.signum.network',
      iotaTagPrefix: user.iotaTagPrefix || null,
      signumTagPrefix: user.signumTagPrefix || null,
      mqttBroker: user.mqttBroker,
      loginHistory: user.loginHistory,
      passwordResetHistory: user.passwordResetHistory
    };

    res.json(settings);
  } catch (error) {
    logger.error('Error fetching user settings:', error);
    res.status(500).json({ message: 'Error fetching user settings' });
  }
});

/**
 * @swagger
 * /api/settings/me:
 *   patch:
 *     summary: Update the authenticated user’s settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mqttBroker:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                   username:
 *                     type: string
 *                     nullable: true
 *                   password:
 *                     type: string
 *                     nullable: true
 *                   isPrivate:
 *                     type: boolean
 *               iotaNodeAddress:
 *                 type: string
 *                 nullable: false
 *                 description: URL of the IOTA node for uploads
 *                 example: https://api.shimmer.network
 *               signumNodeAddress:
 *                 type: string
 *                 nullable: true
 *                 description: URL of the Signum node for uploads
 *               iotaTagPrefix:
 *                 type: string
 *                 nullable: true
 *                 description: Optional alphanumeric (max 16 chars) prefix for IOTA indexation tags
 *                 example: MYTAG123
 *             example:
 *               mqttBroker:
 *                 address: mqtt://broker.example.com
 *                 username: mqttuser
 *                 password: mqttpass
 *                 isPrivate: true
 *               iotaNodeAddress: https://api.shimmer.network
 *               signumNodeAddress: https://nodes.signum.network
 *               iotaTagPrefix: MYTAG123
 *     responses:
 *       200:
 *         description: Settings updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Settings saved
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad payload
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.patch('/me', authMiddleware, async (req, res) => {
  const updates = {};
  if (req.body.mqttBroker) updates.mqttBroker = req.body.mqttBroker;
  if (req.body.iotaNodeAddress) updates.iotaNodeAddress = req.body.iotaNodeAddress;
  if (req.body.signumNodeAddress) updates.signumNodeAddress = req.body.signumNodeAddress;
  if ('iotaTagPrefix' in req.body) updates.iotaTagPrefix = req.body.iotaTagPrefix;
  if ('signumTagPrefix' in req.body) updates.signumTagPrefix = req.body.signumTagPrefix;


  try {
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    return res.json({ message: 'Settings saved', user });
  } catch (err) {
    logger.error('Error updating user settings:', err);
    return res.status(500).json({ message: 'Unable to update settings' });
  }
});

module.exports = router;
