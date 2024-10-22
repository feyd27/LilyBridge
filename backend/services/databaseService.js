// services/databaseService.js
const MqttMessage = require('../models/message');
const logger = require('../services/logger');

// Function to save an MQTT message to the database
const saveMessage = async (topic, messageContent) => {
  const newMessage = new MqttMessage({ topic, message: messageContent });
  try {
    await newMessage.save();
    logger.log('Message saved to database');
  } catch (error) {
    logger.error('Error saving message to database:', error);
  }
};

module.exports = {
  saveMessage,
};
