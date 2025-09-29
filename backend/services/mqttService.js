// services/mqttService.js
require('dotenv').config();
const mqtt = require('mqtt');

const moment = require('moment-timezone'); 
const MqttMessage = require('../models/message');
const logger = require('../services/logger');
const SOURCE_TZ = process.env.SOURCE_TZ || 'Europe/Belgrade'; // added

const mqttClient = mqtt.connect(`${process.env.MQTT_HOST}:${process.env.MQTT_PORT}`, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
});
const instanceId = Math.random().toString(36).substring(7);
logger.log(`MQTT Service started with Instance ID: ${instanceId}`);
mqttClient.on('connect', () => {
  logger.log('Connected to MQTT broker');
  mqttClient.subscribe(process.env.MQTT_TOPICS.split(','), (err, granted) => {
    if (!err) {
      logger.log(`Subscribed to topics: ${process.env.MQTT_TOPICS}`);
    } else {
      logger.error('Subscription error:', err);
    }
  });
});

mqttClient.on('error', (err) => {
  logger.error('MQTT connection error:', err);
});

mqttClient.on('offline', () => {
  logger.log('MQTT client is offline');
});

mqttClient.on('reconnect', () => {
  logger.log('MQTT client is reconnecting');
});

// Handle incoming MQTT messages
mqttClient.on('message', async (topic, message) => {
   logger.log(`[MQTT debug Instance: ${instanceId}] Message received on topic ${topic}`);
  const messageContent = message.toString();
  logger.log(`Received message from ${topic}: ${messageContent}`);

  let parsedMessage;

  if (topic === 'temperature') {
    // Parse the temperature message
    
    const [chipInfo, tempReading, timeReading] = messageContent.split('|').map(part => part.trim());
    const[chipID, macAddress] = chipInfo.split('@');
    const temperature = parseFloat(tempReading.split(':')[1].replace('°C', '').trim());
    // const timeString = timeReading.split(': ')[1].trim();
    const timeString = timeReading.replace(/^time\s*:\s*/i, '').trim(); // "14.08.2025 21:15:31"
    // Convert the timestamp to a Date object
   //  const timestamp = moment(timeString, 'DD.MM.YYYY HH:mm:ss').toDate();
    const m = moment.tz(timeString, 'DD.MM.YYYY HH:mm:ss', SOURCE_TZ);
    if (!m.isValid()) {
      logger.error('[MQTT temperature] Invalid timeString', { timeString, topic });
    }
    const timestamp = m.toDate();
    // Create the parsed message object
     logger.log('[MQTT temperature parse]', {
      raw: timeString,
      sourceTz: SOURCE_TZ,
      wallClockInSourceTz: m.isValid() ? m.format('YYYY-MM-DD HH:mm:ss Z') : null,
      storedIsoUtc: timestamp.toISOString(),
      offsetMinutes: m.utcOffset()
      });
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
    logger.log('[MQTT] Message saved to database');
  } catch (err) {
    logger.error('[MQTT] Error saving message to database: ', err);
  }
});
  
 // databaseService.saveMessage(topic, messageContent);

module.exports = mqttClient;

