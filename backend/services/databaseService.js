// services/databaseService.js
const MqttMessage = require('../models/message');

// Function to save an MQTT message to the database
const saveMessage = async (topic, messageContent) => {
  const newMessage = new MqttMessage({ topic, message: messageContent });
  try {
    await newMessage.save();
    console.log('Message saved to database');
  } catch (error) {
    console.error('Error saving message to database:', error);
  }
};

module.exports = {
  saveMessage,
};
