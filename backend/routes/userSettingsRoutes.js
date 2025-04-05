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
 *                 mqttBroker:
 *                   type: object
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

/**
 * @swagger
 * /api/settings/me:
 *   put:
 *     summary: Update user settings
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
 *               username:
 *                 type: string
 *                 description: New username for the user
 *                 example: "newuser@example.com"
 *               mqttBroker:
 *                 type: object
 *                 properties:
 *                   address:
 *                     type: string
 *                     description: New address of the MQTT broker
 *                     example: "mqtt://newbroker.example.com"
 *                   username:
 *                     type: string
 *                     description: New username for the MQTT broker
 *                     example: "newmqttuser"
 *                   password:
 *                     type: string
 *                     description: New password for the MQTT broker
 *                     example: "newmqttpassword"
 *                   isPrivate:
 *                     type: boolean
 *                     description: Whether the new MQTT broker is private
 *                     example: false
 *     responses:
 *       200:
 *         description: User settings updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "User settings updated successfully"
 *       400:
 *         description: Invalid input data
 *       500:
 *         description: Error updating user settings
 */

// Get user settings
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        // Select the data you want to send to the frontend
        const settings = {
            username: user.username,
            mqttBroker: user.mqttBroker,
            loginHistory: user.loginHistory,
            passwordResetHistory: user.passwordResetHistory
        };
        res.json(settings);
    } catch (error) {
        console.error('Error fetching user settings:', error);
        res.status(500).json({ message: 'Error fetching user settings' });
    }
});

// Update user settings (you'll need to implement this based on your settings structure)
router.put('/me', authMiddleware, async (req, res) => {
    try {
        //... logic to update user settings...
    } catch (error) {
        //... error handling...
    }
});

module.exports = router;