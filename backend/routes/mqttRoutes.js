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
 *                 message:
 *                   type: string
 *                 receivedAt:
 *                   type: string
 *                   format: date-time
 *                 timeSinceReceived:
 *                   type: string
 */
router.get('/messages/status/last', async (req, res) => {
  try {
    const lastMessage = await MqttMessage.findOne({ topic: 'status' })
      .sort({ receivedAt: -1 });
      
    if (!lastMessage) {
      return res.status(404).json({ error: 'No status message found' });
    }

    const timeSinceReceived = moment(lastMessage.receivedAt).fromNow();
    res.status(200).json({ ...lastMessage.toObject(), timeSinceReceived });
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
