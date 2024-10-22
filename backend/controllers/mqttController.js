// controllers/mqttController.js


const mqttClient = require('../services/mqttService');
const logger = require('../services/logger');

exports.checkMqttStatus = (req, res) => {
  if (mqttClient.connected) {
    res.status(200).send('MQTT broker is connected');
  } else {
    logger.error('MQTT broker is not connected');
    res.status(500).send('MQTT broker is not connected');
  }
};
