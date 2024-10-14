// routes/mqttRoutes.js
const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const moment = require('moment');
const MqttMessage = require('../models/message');


/**
 * @swagger
 * /api/messages/temperature:
 *   get:
 *     summary: Get paginated messages from the "temperature" topic
 *     tags: [Messages]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           enum: [25, 50, 100]
 *           default: 25
 *         description: Number of messages per page
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: A paginated list of temperature messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalItems:
 *                   type: integer
 *                   description: Total number of messages
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                 currentPage:
 *                   type: integer
 *                   description: Current page number
 *                 messages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       topic:
 *                         type: string
 *                       chipID:
 *                         type: string
 *                       macAddress:
 *                         type: string
 *                       temperature:
 *                         type: number
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       receivedAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: No temperature messages found
 *       500:
 *         description: Server error
 */
router.get('/messages/temperature', async (req, res) => {
  try {
    const { limit = 25, page = 1 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
    const pageNum = Math.max(parseInt(page), 1);

    const query = { topic: 'temperature' };

    // Check if the database connection is alive
    console.log('Database connection readyState:', mongoose.connection.readyState);

    // Debugging output for topic search
    console.log('Looking for messages with topic:', query.topic);

    // Count the total number of messages
    const totalItems = await MqttMessage.countDocuments(query);
    console.log(`Total temperature messages found: ${totalItems}`);

    if (totalItems === 0) {
      console.log('No messages found for topic temperature');
      return res.status(404).json({ error: 'No temperature messages found' });
    }

    // Fetch paginated messages
    const messages = await MqttMessage.find(query)
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    console.log(`Retrieved ${messages.length} messages for topic temperature`);

    res.status(200).json({
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum),
      currentPage: pageNum,
      messages,
    });
  } catch (error) {
    console.error('Error retrieving temperature messages:', error);
    res.status(500).json({ error: 'Failed to retrieve temperature messages' });
  }
});




/**
 * @swagger
 * /api/messages/status/last:
 *   get:
 *     summary: Get the last message from the "status" topic with the time since it was sent
 *     tags: [Messages]
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

router.get('/messages/status/last', async (req, res) => {
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
    console.error('Error retrieving last status message:', error);
    res.status(500).json({ error: 'Failed to retrieve last status message' });
  }
});



/**
 * @swagger
 * /api/messages/error/today:
 *   get:
 *     summary: Get all error messages from today
 *     tags: [Messages]
 *     responses:
 *       200:
 *         description: A list of today's error messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   topic:
 *                     type: string
 *                   message:
 *                     type: string
 *                   receivedAt:
 *                     type: string
 *                     format: date-time
 */
router.get('/messages/error/today', async (req, res) => {
  try {
    const startOfDay = moment().startOf('day').toDate();
    const messages = await MqttMessage.find({
      topic: 'errors',
      receivedAt: { $gte: startOfDay },
    }).sort({ receivedAt: -1 });
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error retrieving today\'s error messages:', error);
    res.status(500).json({ error: 'Failed to retrieve today\'s error messages' });
  }
});

module.exports = router;
