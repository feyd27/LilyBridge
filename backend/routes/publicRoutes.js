const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment');
const MqttMessage = require('../models/message');
const logger = require('../services/logger');
const jwt     = require('jsonwebtoken');
const User    = require('../models/user');
logger.log('🛣️  publicRoutes.js loaded');
/**
 * @swagger
 * /api/public/api/messages/temperature/last50:
 *   get:
 *     summary: Get the last 50 temperature messages
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: A list of the last 50 temperature messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   topic:
 *                     type: string
 *                     description: The MQTT topic (should be "temperature")
 *                   chipID:
 *                     type: string
 *                     description: The identifier of the ESP32 board
 *                   macAddress:
 *                     type: string
 *                     description: The MAC address of the ESP32 board
 *                   temperature:
 *                     type: number
 *                     description: The temperature reading in Celsius
 *                   timestamp:
 *                     type: string
 *                     format: date-time
 *                     description: The timestamp when the message was sent
 *                   receivedAt:
 *                     type: string
 *                     format: date-time
 *                     description: The time the message was received by the server
 *       500:
 *         description: Server error
 */
router.get('/api/messages/temperature/last50', async (req, res) => {
  try {
    const messages = await MqttMessage.find({ topic: 'temperature' })
      .sort({ receivedAt: -1 })
      .limit(50);

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error retrieving temperature messages:', error);
    res.status(500).json({ error: 'Failed to retrieve temperature messages' });
  }
});
/**
 * @swagger
 * /api/public/api/messages/status/last:
 *   get:
 *     summary: Get the last message from the "status" topic with the time since it was sent
 *     tags: [Public]
 *     responses:
 *       200:
 *         description: The last status message and the time since it was sent
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 topic:
 *                   type: string
 *                 chipID:
 *                   type: string
 *                 macAddress:
 *                   type: string
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                 receivedAt:
 *                   type: string
 *                   format: date-time
 *                 timeSinceReceived:
 *                   type: string
 *       404:
 *         description: No status message found
 *       500:
 *         description: Failed to retrieve last status message
 */

router.get('/api/messages/status/last', async (req, res) => {
    try {
      const lastMessage = await MqttMessage.findOne({ topic: 'status' }).sort({ receivedAt: -1 });
  
      if (!lastMessage) {
        return res.status(404).json({ error: 'No status message found' });
      }
  
      // Example message format: "ESP32-D0WD1@8C:4B:14:08:12:58| Wifi OK | MQTT OK | Time: 14.10.2024 20:57:29"
      const messageParts = lastMessage.message.split('|').map(part => part.trim());
  
      // Extract chipID, macAddress, status, and timestamp
      const [chipAndMac, ...statusParts] = messageParts;
      const [chipID, macAddress] = chipAndMac.split('@');
      
      // Join all status parts except the last one (Time), in case there are multiple
      const status = statusParts.slice(0, -1).join(' | ');
      
      // Extract timestamp from the last part
      const timestampMatch = statusParts[statusParts.length - 1].match(/Time: (.+)/);
      const timestamp = timestampMatch ? timestampMatch[1] : null;
  
      const timeSinceReceived = moment(lastMessage.receivedAt).fromNow();
  
      res.status(200).json({
        topic: lastMessage.topic,
        chipID: chipID || 'Unknown',
        macAddress: macAddress || 'Unknown',
        status: status || 'Unknown',
        timestamp: timestamp || 'Unknown',
        receivedAt: lastMessage.receivedAt,
        timeSinceReceived: timeSinceReceived,
      });
    } catch (error) {
      logger.error('Error retrieving last status message:', error);
      res.status(500).json({ error: 'Failed to retrieve last status message' });
    }
  });



/**
 * @swagger
 * /api/public/refresh:
 *   post:
 *     summary: Issue a new access token given a valid refresh token
 *     tags:
 *       - Public
 *     description: |
 *       Provide your refresh token (either in the `X-Refresh-Token` header
 *       or in the JSON body) and receive a fresh access token (4h lifespan).
 *       No Bearer header is required on this route.
 *     parameters:
 *       - in: header
 *         name: X-Refresh-Token
 *         required: true
 *         schema:
 *           type: string
 *         description: Your current refresh token
 *     requestBody:
 *       description: |
 *         Alternatively, send the refresh token in the JSON body, for example:
 *         {"refreshToken":"<token>"}
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token (if not using the header)
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: Fresh JWT access token (4h lifespan)
 *       400:
 *         description: Missing refresh token
 *       403:
 *         description: Invalid or expired refresh token
 *       404:
 *         description: User not found for that token payload
 */
router.post('/refresh', async (req, res) => {
   const incomingRefresh =
    (req.header('X-Refresh-Token') || '').trim() ||
    req.body.refreshToken;
    logger.log(req)
  if (!incomingRefresh) {
    return res
      .status(400)
      .json({ message: 'Refresh token required' });
  }

  let payload;
  try {
    // only verify against the refresh secret
    payload = jwt.verify(
      incomingRefresh,
      process.env.JWT_REFRESH_SECRET
    );
  } catch (err) {
    return res
      .status(403)
      .json({ message: 'Invalid or expired refresh token' });
  }

  // 2️⃣ Lookup user and compare stored token
  const user = await User.findById(payload.userId);
  if (!user || user.refreshToken !== incomingRefresh) {
    return res
      .status(403)
      .json({ message: 'Refresh token not recognized' });
  }

  // 3️⃣ Issue a new access token
  const newAccessToken = jwt.sign(
    { userId: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '4h' }
  );

  return res.json({ accessToken: newAccessToken });
});

module.exports = router;

