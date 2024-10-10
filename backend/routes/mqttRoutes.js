// routes/mqttRoutes.js
const express = require('express');
const moment = require('moment');
const MqttMessage = require('../models/message');

const router = express.Router();

/**
 * @swagger
 * /messages/temperature:
 *   get:
 *     summary: Get the last 25 messages from the "temperature" topic
 *     tags: [Messages]
 *     responses:
 *       200:
 *         description: A list of the last 25 temperature messages
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
router.get('/messages/temperature', async (req, res) => {
  try {
    const messages = await MqttMessage.find({ topic: 'temperature' })
      .sort({ receivedAt: -1 })
      .limit(25);
    res.status(200).json(messages);
  } catch (error) {
    console.error('Error retrieving temperature messages:', error);
    res.status(500).json({ error: 'Failed to retrieve temperature messages' });
  }
});

/**
 * @swagger
 * /messages/status/last:
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
 * /messages/error/today:
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
