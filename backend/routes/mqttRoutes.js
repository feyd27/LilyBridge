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
 * /api/messages/temperature:
 *   delete:
 *     summary: Delete multiple temperature messages by their IDs
 *     tags: [Messages]
 *     requestBody:
 *       description: An array of IDs of the temperature messages to delete
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
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
 *         description: The deleted messages and paginated remaining messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedMessages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
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
 *                 totalItems:
 *                   type: integer
 *                   description: Total number of remaining messages
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
 *         description: No messages found or no temperature messages found
 *       500:
 *         description: Server error
 */
router.delete('/messages/temperature', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of message IDs is required' });
    }

    const { limit = 25, page = 1 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
    const pageNum = Math.max(parseInt(page), 1);

    // Delete all messages with IDs in the array
    const deletedMessages = await MqttMessage.deleteMany({ _id: { $in: ids } });

    if (deletedMessages.deletedCount === 0) {
      return res.status(404).json({ error: 'No messages found with provided IDs' });
    }

    // After deletion, fetch the remaining paginated messages
    const totalItems = await MqttMessage.countDocuments({ topic: 'temperature' });

    if (totalItems === 0) {
      return res.status(404).json({ error: 'No temperature messages left in the database' });
    }

    const messages = await MqttMessage.find({ topic: 'temperature' })
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.status(200).json({
      message: 'Temperature messages deleted successfully',
      deletedCount: deletedMessages.deletedCount,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum),
      currentPage: pageNum,
      messages,
    });
  } catch (error) {
    console.error('Error deleting temperature messages:', error);
    res.status(500).json({ error: 'Failed to delete temperature messages' });
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
 *                       _id:
 *                         type: string
 *                         description: The unique identifier of the message
 *                       topic:
 *                         type: string
 *                       chipID:
 *                         type: string
 *                       macAddress:
 *                         type: string
 *                       status:
 *                         type: string
 *                       timestamp:
 *                         type: string
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

    const rawMessages = await MqttMessage.find(query)
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const messages = rawMessages.map((message) => {
      const messageParts = message.message.split('|').map(part => part.trim());
      const [chipAndMac, ...statusParts] = messageParts;
      const [chipID, macAddress] = chipAndMac.split('@');
      const status = statusParts.slice(0, -1).join(' | ');

      const timestampMatch = statusParts[statusParts.length - 1].match(/Time: (.+)/);
      const timestamp = timestampMatch ? timestampMatch[1] : null;

      return {
        _id: message._id,  // Include the unique identifier
        topic: message.topic,
        chipID: chipID || 'Unknown',
        macAddress: macAddress || 'Unknown',
        status: status || 'Unknown',
        timestamp: timestamp || 'Unknown',
        receivedAt: message.receivedAt,
      };
    });

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
 * /api/messages/status:
 *   delete:
 *     summary: Delete multiple status messages by their IDs
 *     tags: [Messages]
 *     requestBody:
 *       description: An array of IDs of the status messages to delete
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
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
 *         description: The deleted messages and paginated remaining messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedCount:
 *                   type: integer
 *                   description: Number of messages deleted
 *                 totalItems:
 *                   type: integer
 *                   description: Total number of remaining messages
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
 *         description: No messages found or no status messages found
 *       500:
 *         description: Server error
 */
router.delete('/messages/status', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Array of message IDs is required' });
    }

    const { limit = 25, page = 1 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
    const pageNum = Math.max(parseInt(page), 1);

    // Delete all messages with IDs in the array
    const deleteResult = await MqttMessage.deleteMany({ _id: { $in: ids }, topic: 'status' });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({ error: 'No messages found with provided IDs' });
    }

    // After deletion, fetch the remaining paginated messages
    const totalItems = await MqttMessage.countDocuments({ topic: 'status' });

    if (totalItems === 0) {
      return res.status(404).json({ error: 'No status messages left in the database' });
    }

    const messages = await MqttMessage.find({ topic: 'status' })
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.status(200).json({
      message: 'Status messages deleted successfully',
      deletedCount: deleteResult.deletedCount,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum),
      currentPage: pageNum,
      messages,
    });
  } catch (error) {
    console.error('Error deleting status messages:', error);
    res.status(500).json({ error: 'Failed to delete status messages' });
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
 * /api/messages/errors:
 *   delete:
 *     summary: Delete multiple error messages by their IDs
 *     tags: [Messages]
 *     requestBody:
 *       description: Array of message IDs to delete
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: An array of IDs of the error messages to delete
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
 *         description: Successfully deleted messages and retrieved remaining paginated messages
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 deletedMessages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       topic:
 *                         type: string
 *                       message:
 *                         type: string
 *                       receivedAt:
 *                         type: string
 *                         format: date-time
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
 *         description: No messages found or no error messages left after deletion
 *       500:
 *         description: Server error
 */
router.delete('/messages/errors', async (req, res) => {
  try {
    const { ids } = req.body;

    // Check if IDs array is provided
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'An array of message IDs is required for deletion' });
    }

    const { limit = 25, page = 1 } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit), 1), 100);
    const pageNum = Math.max(parseInt(page), 1);

    // Find and delete the messages by their IDs
    const deletedMessages = await MqttMessage.deleteMany({ _id: { $in: ids }, topic: 'errors' });

    if (deletedMessages.deletedCount === 0) {
      return res.status(404).json({ error: 'No messages found with the provided IDs' });
    }

    // Get updated count and remaining messages after deletion
    const totalItems = await MqttMessage.countDocuments({ topic: 'errors' });
    if (totalItems === 0) {
      return res.status(404).json({ error: 'No error messages left in the database' });
    }

    const messages = await MqttMessage.find({ topic: 'errors' })
      .sort({ receivedAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    res.status(200).json({
      message: 'Error messages deleted successfully',
      deletedMessages: deletedMessages.deletedCount,
      totalItems,
      totalPages: Math.ceil(totalItems / limitNum),
      currentPage: pageNum,
      messages,
    });
  } catch (error) {
    logger.error('Error deleting error messages:', error);
    res.status(500).json({ error: 'Failed to delete error messages' });
  }
});


module.exports = router;
