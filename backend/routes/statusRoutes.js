// routes/statusRoutes.js

const express = require('express');
const router = express.Router();
const mqttController = require('../controllers/mqttController');


/**
 * @swagger
 * /:
 *   get:
 *     summary: Returns a message indicating the server is running
 *     responses:
 *       200:
 *         description: A simple status message
 *       500:
 *         description: Server is not available or encountered an error
 */
router.get('/', (req, res) => {
  try {
    res.send('Lily-Bridge MQTT Backend is running');
  } catch (error) {
    console.error('Error occurred:', error);
    res.status(500).send('Server error, please try again later');
  }
});

/**
 * @swagger
 * /mqtt-status:
 *   get:
 *     summary: Checks the status of the MQTT broker connection
 *     responses:
 *       200:
 *         description: MQTT broker is connected
 *       500:
 *         description: MQTT broker is not connected
 */
router.get('/mqtt-status', mqttController.checkMqttStatus);

module.exports = router;
