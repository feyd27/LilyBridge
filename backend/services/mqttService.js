// services/mqttService.js
require('dotenv').config();
const mqtt = require('mqtt');
const config = require('../config/config');
const MqttMessage = require('../models/message');


const mqttClient = mqtt.connect(`${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});
// console.log('MQTT_HOST:', process.env.MQTT_HOST);  // Debugging line
// console.log('MQTT_PORT:', process.env.MQTT_PORT);  // Debugging line
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe(process.env.MQTT_TOPICS, (err) => {
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
mqttClient.on('message', (topic, message) => {
  const messageContent = message.toString();
  console.log(`Received message from ${topic}: ${messageContent}`);

  // Save the message to the database
  const newMessage = new MqttMessage({ topic, message: messageContent });
  newMessage.save((err) => {
      if (err) {
          console.error('Error saving message to database:', err);
      } else {
          console.log('Message saved to database');
      }
  });
});

module.exports = mqttClient;
