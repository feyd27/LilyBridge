// routes/userSettingsRoutes.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware'); // Import authentication middleware
const User = require('../models/user'); // Import the User model

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
 *                   description: Username of the user
 *                   example: user@example.com
 *                 role:
 *                   type: string
 *                   description: Role assigned to the user
 *                   example: user
 *                 mqttBroker:
 *                   type: object
 *                   description: MQTT broker configuration
 *                   properties:
 *                     address:
 *                       type: string
 *                       description: Address of the MQTT broker
 *                       example: "mqtt://broker.example.com"
 *                     username:
 *                       type: string
 *                       description: Username for the MQTT broker
 *                       example: "mqttuser"
 *                     password:
 *                       type: string
 *                       description: Password for the MQTT broker
 *                       example: "mqttpassword"
 *                     isPrivate:
 *                       type: boolean
 *                       description: Whether the MQTT broker is private
 *                       example: true
 *                 loginHistory:
 *                   type: array
 *                   description: Login history of the user
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp of the login event
 *                 passwordResetHistory:
 *                   type: array
 *                   description: Password reset history of the user
 *                   items:
 *                     type: object
 *                     properties:
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         description: Timestamp of the password reset event
 *       500:
 *         description: Error fetching user settings
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const settings = {
      username:             user.username,
      role:                 user.role,              
      mqttBroker:           user.mqttBroker,
      loginHistory:         user.loginHistory,
      passwordResetHistory: user.passwordResetHistory
    };
    res.json(settings);
  } catch (error) {
    console.error('Error fetching user settings:', error);
    res.status(500).json({ message: 'Error fetching user settings' });
  }
});


/**
 * @swagger
 * /api/settings/me:
 *   patch:
 *     summary: Update user settings
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       description: Send any subset of the following fields to update just those parts of your settings.
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mqttBroker:
 *                 type: object
 *                 nullable: true
 *                 description: MQTT broker configuration (omit or set to `null` to clear)
 *                 properties:
 *                   address:
 *                     type: string
 *                     example: "mqtt://broker.example.com"
 *                   username:
 *                     type: string
 *                     example: "mqttuser"
 *                   password:
 *                     type: string
 *                     example: "mqttpassword"
 *                   isPrivate:
 *                     type: boolean
 *                     example: true
 *               iotaAddress:
 *                 type: string
 *                 nullable: true
 *                 description: User's IOTA address (omit or set to `null` to clear)
 *                 example: "atoi1qyqszqgpqy..."
 *               signumAddress:
 *                 type: string
 *                 nullable: true
 *                 description: User's Signum address (omit or set to `null` to clear)
 *                 example: "S-ABCD-EFGH-IJKL-MNOP"
 *     responses:
 *       200:
 *         description: Settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mqttBroker:
 *                   $ref: '#/components/schemas/MqttBroker'
 *                 iotaAddress:
 *                   type: string
 *                   nullable: true
 *                 signumAddress:
 *                   type: string
 *                   nullable: true
 *       400:
 *         description: Invalid request payload
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         description: Server error while updating settings
 */


router.patch('/me', authMiddleware, async (req, res) => {
  try {
    const updates = {};
    // Only pick allowed fields if present
    if (req.body.mqttBroker !== undefined) {
      updates.mqttBroker = req.body.mqttBroker;
    }
    if (req.body.iotaAddress !== undefined) {
      updates.iotaAddress = req.body.iotaAddress;
    }
    if (req.body.signumAddress !== undefined) {
      updates.signumAddress = req.body.signumAddress;
    }

    // If nothing to update, 400
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: 'No valid fields provided for update' });
    }

    // Find-and-update
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Respond with the new settings subset
    res.json({
      mqttBroker:   user.mqttBroker,
      iotaAddress:  user.iotaAddress,
      signumAddress:user.signumAddress
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    res.status(500).json({ message: 'Error updating settings' });
  }
});

module.exports = router;