// routes/mqttRoutes.js
const mongoose = require('mongoose');
const express = require('express');
const router = express.Router();
const moment = require('moment');
const MqttMessage = require('../models/message');
const logger = require('../services/logger');


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
    logger.log('Database connection readyState:', mongoose.connection.readyState);

    // Debugging output for topic search
    logger.log('Looking for messages with topic:', query.topic);

    // Count the total number of messages
    const totalItems = await MqttMessage.countDocuments(query);
    logger.log(`Total temperature messages found: ${totalItems}`);

    if (totalItems === 0) {
      logger.log('No messages found for topic temperature');
      return res.status(404).json({ error: 'No temperature messages found' });
    }

    // Fetch paginated messages
    const messages = await MqttMessage.find(query)
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    logger.log(`Retrieved ${messages.length} messages for topic temperature`);

    res.status(200).json({
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum),
      currentPage: pageNum,
      messages,
    });
  } catch (error) {
    logger.error('Error retrieving temperature messages:', error);
    res.status(500).json({ error: 'Failed to retrieve temperature messages' });
  }
});

/**
 * @swagger
 * /api/messages/temperature/last50:
 *   get:
 *     summary: Get the last 50 temperature messages
 *     tags: [Messages]
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
router.get('/messages/temperature/last50', async (req, res) => {
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
 * /api/messages/temperature/{id}:
 *   delete:
 *     summary: Delete a temperature message by its ID
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the temperature message to delete
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
 *         description: The deleted message and paginated remaining messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedMessage:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     topic:
 *                       type: string
 *                     chipID:
 *                       type: string
 *                     macAddress:
 *                       type: string
 *                     temperature:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                     receivedAt:
 *                       type: string
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
 *       404:
 *         description: Message not found or no temperature messages found
 *       500:
 *         description: Server error
 */
router.delete('/messages/temperature/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Debug: Log the received message ID for deletion
    logger.log('Received _id for deletion:', id);

    const { limit = 25, page = 1 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
    const pageNum = Math.max(parseInt(page), 1);

    // Find and delete the message by _id
    const deletedMessage = await MqttMessage.findByIdAndDelete(id);

    if (!deletedMessage) {
      logger.error('No message found with _id:', id);
      return res.status(404).json({ error: 'Message not found' });
    }

    // Log the deleted message for debugging
    logger.log('Deleted message:', deletedMessage);

    // After deletion, fetch the remaining paginated messages
    const totalItems = await MqttMessage.countDocuments({ topic: 'temperature' });

    if (totalItems === 0) {
      logger.log('No temperature messages left in the database');
      return res.status(404).json({ error: 'No temperature messages found' });
    }

    const messages = await MqttMessage.find({ topic: 'temperature' })
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Log the remaining messages for debugging
    logger.log('Remaining messages:', messages);

    res.status(200).json({
      message: 'Temperature message deleted successfully',
      deletedMessage,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum),
      currentPage: pageNum,
      messages,
    });
  } catch (error) {
    // Log the error if any
    logger.error('Error deleting temperature message:', error);
    res.status(500).json({ error: 'Failed to delete temperature message' });
  }
});


/**
 * @swagger
 * /api/messages/status:
 *   get:
 *     summary: Get paginated messages from the "status" topic
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
 *         description: A paginated list of status messages
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
 *                       status:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       receivedAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: No status messages found
 *       500:
 *         description: Server error
 */
router.get('/messages/status', async (req, res) => {
  try {
    const { limit = 25, page = 1 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
    const pageNum = Math.max(parseInt(page), 1);

    const query = { topic: 'status' };

    const totalItems = await MqttMessage.countDocuments(query);

    if (totalItems === 0) {
      return res.status(404).json({ error: 'No status messages found' });
    }

    const messages = await MqttMessage.find(query)
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.status(200).json({
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum),
      currentPage: pageNum,
      messages,
    });
  } catch (error) {
    logger.error('Error retrieving status messages:', error);
    res.status(500).json({ error: 'Failed to retrieve status messages' });
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
    logger.error('Error retrieving last status message:', error);
    res.status(500).json({ error: 'Failed to retrieve last status message' });
  }
});
/**
 * @swagger
 * /api/messages/status/{id}:
 *   delete:
 *     summary: Delete a status message by its ID
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the status message to delete
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
 *         description: The deleted message and paginated remaining messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedMessage:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     topic:
 *                       type: string
 *                     message:
 *                       type: string
 *                     receivedAt:
 *                       type: string
 *                       format: date-time
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
 *                       message:
 *                         type: string
 *                       receivedAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Message not found or no status messages found
 *       500:
 *         description: Server error
 */
router.delete('/messages/status/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Debug: Log the received message ID for deletion
    logger.log('Received _id for deletion:', id);

    const { limit = 25, page = 1 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
    const pageNum = Math.max(parseInt(page), 1);

    // Find and delete the status message by _id
    const deletedMessage = await MqttMessage.findByIdAndDelete(id);

    if (!deletedMessage) {
      logger.error('No message found with _id:', id);
      return res.status(404).json({ error: 'Message not found' });
    }

    // Log the deleted message for debugging
    logger.log('Deleted message:', deletedMessage);

    // After deletion, fetch the remaining paginated messages for the 'status' topic
    const totalItems = await MqttMessage.countDocuments({ topic: 'status' });

    if (totalItems === 0) {
      logger.log('No status messages left in the database');
      return res.status(404).json({ error: 'No status messages found' });
    }

    const messages = await MqttMessage.find({ topic: 'status' })
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Log the remaining messages for debugging
    logger.log('Remaining messages:', messages);

    res.status(200).json({
      message: 'Status message deleted successfully',
      deletedMessage,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum),
      currentPage: pageNum,
      messages,
    });
  } catch (error) {
    // Log the error if any
    logger.error('Error deleting status message:', error);
    res.status(500).json({ error: 'Failed to delete status message' });
  }
});

/**
 * @swagger
 * /api/messages/errors:
 *   get:
 *     summary: Get paginated messages from the "errors" topic
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
 *         description: A paginated list of error messages
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
 *                       message:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       receivedAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: No error messages found
 *       500:
 *         description: Server error
 */
router.get('/messages/errors', async (req, res) => {
  try {
    const { limit = 25, page = 1 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
    const pageNum = Math.max(parseInt(page), 1);

    const query = { topic: 'errors' };

    const totalItems = await MqttMessage.countDocuments(query);

    if (totalItems === 0) {
      return res.status(404).json({ error: 'No error messages found' });
    }

    const messages = await MqttMessage.find(query)
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.status(200).json({
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum),
      currentPage: pageNum,
      messages,
    });
  } catch (error) {
    logger.error('Error retrieving error messages:', error);
    res.status(500).json({ error: 'Failed to retrieve error messages' });
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
    logger.error('Error retrieving today\'s error messages:', error);
    res.status(500).json({ error: 'Failed to retrieve today\'s error messages' });
  }
});
/**
 * @swagger
 * /api/messages/errors/{id}:
 *   delete:
 *     summary: Delete an error message by its ID
 *     tags: [Messages]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the error message to delete
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
 *         description: The deleted message and paginated remaining messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedMessage:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     topic:
 *                       type: string
 *                     message:
 *                       type: string
 *                     receivedAt:
 *                       type: string
 *                       format: date-time
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
 *                       message:
 *                         type: string
 *                       receivedAt:
 *                         type: string
 *                         format: date-time
 *       404:
 *         description: Message not found or no error messages found
 *       500:
 *         description: Server error
 */
router.delete('/messages/errors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Debug: Log the received message ID for deletion
    logger.log('Received _id for deletion:', id);

    const { limit = 25, page = 1 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
    const pageNum = Math.max(parseInt(page), 1);

    // Find and delete the error message by _id
    const deletedMessage = await MqttMessage.findByIdAndDelete(id);

    if (!deletedMessage) {
      logger.error('No message found with _id:', id);
      return res.status(404).json({ error: 'Message not found' });
    }

    // Log the deleted message for debugging
    logger.log('Deleted message:', deletedMessage);

    // After deletion, fetch the remaining paginated messages for the 'errors' topic
    const totalItems = await MqttMessage.countDocuments({ topic: 'errors' });

    if (totalItems === 0) {
      logger.log('No error messages left in the database');
      return res.status(404).json({ error: 'No error messages found' });
    }

    const messages = await MqttMessage.find({ topic: 'errors' })
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    // Log the remaining messages for debugging
    logger.log('Remaining messages:', messages);

    res.status(200).json({
      message: 'Error message deleted successfully',
      deletedMessage,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum),
      currentPage: pageNum,
      messages,
    });
  } catch (error) {
    // Log the error if any
    logger.error('Error deleting error message:', error);
    res.status(500).json({ error: 'Failed to delete error message' });
  }
});

module.exports = router;
