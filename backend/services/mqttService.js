// services/mqttService.js
require('dotenv').config();
const mqtt = require('mqtt');
const moment = require('moment');
const config = require('../config/config');
const databaseService = require('./databaseService');
const MqttMessage = require('../models/message');

const mqttClient = mqtt.connect(`${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});

mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe(process.env.MQTT_TOPICS.split(','), (err, granted) => {
    if (!err) {
      console.log(`Subscribed to topics: ${process.env.MQTT_TOPICS}`);
    } else {
      console.error('Subscription error:', err);
    }
  });
});

mqttClient.on('error', (err) => {
  console.error('MQTT connection error:', err);
});

mqttClient.on('offline', () => {
  console.log('MQTT client is offline');
});

mqttClient.on('reconnect', () => {
  console.log('MQTT client is reconnecting');
});

// Handle incoming MQTT messages
mqttClient.on('message', async (topic, message) => {
  const messageContent = message.toString();
  console.log(`Received message from ${topic}: ${messageContent}`);

  let parsedMessage;

  if (topic === 'temperature') {
    // Parse the temperature message
    const[chipInfo, tempReading, timeReading] = messageContent.split('|').map(part => part.trim());
    const[chipID, macAddress] = chipInfo.split('@');
    const temperature = parseFloat(tempReading.split(':')[1].replace('°C', '').trim());
    const timeString = timeReading.split(': ')[1].trim();

    // Convert the timestamp to a Date object
    const timestamp = moment(timeString, 'DD.MM.YYYY HH:mm:ss').toDate();

    // Create the parsed message object

    parsedMessage = {
      topic,
      chipID: chipID.trim(),
      macAddress: macAddress.trim(),
      temperature,
      timestamp
    };
  } else {

    // Default message structure for other topics

    parsedMessage = { topic, message: messageContent, receivedAt: new Date()};
  }

  // Save the parsed message to the database
  try {
    const newMessage = new MqttMessage(parsedMessage);
    await newMessage.save();
    console.log('Message saved to database');
  } catch (err) {
    console.error('Error saving message to database: ', err);
  }
});
  
 // databaseService.saveMessage(topic, messageContent);

module.exports = mqttClient;

