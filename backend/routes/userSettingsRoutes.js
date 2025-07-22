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
 *                   address:   { type: string }
 *                   username:  { type: string, nullable: true }
 *                   password:  { type: string, nullable: true }
 *                   isPrivate: { type: boolean }
 *               iotaAddress:
 *                 type: string
 *                 nullable: true
 *               signumAddress:
 *                 type: string
 *                 nullable: true
 *             example:
 *               mqttBroker:
 *                 address: "mqtt://broker.example.com"
 *                 username: "mqttuser"
 *                 password: "mqttpass"
 *                 isPrivate: true
 *               iotaAddress: "atoi1qxyz..."
 *               signumAddress: "S-ABCDE-12345"
 *     responses:
 *       200:
 *         description: Settings updated
 *       400:
 *         description: Bad payload
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Server error
 */
router.patch(
  '/me',
  authMiddleware,
  async (req, res) => {
    const updates = {};
    if (req.body.mqttBroker)   updates.mqttBroker   = req.body.mqttBroker;
    if (req.body.iotaAddress)  updates.iotaAddress  = req.body.iotaAddress;
    if (req.body.signumAddress)updates.signumAddress= req.body.signumAddress;
    try {
      const user = await User.findByIdAndUpdate(
        req.user.userId,
        { $set: updates },
        { new: true, runValidators: true }
      );
      return res.json({ message: 'Settings saved', user });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ message: 'Unable to update settings' });
    }
  }
);


module.exports = router;