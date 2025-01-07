const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const moment = require('moment');
const MqttMessage = require('../models/message');
const logger = require('../services/logger');
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



// Export
module.exports = router;