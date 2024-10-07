// config.js
require('dotenv').config();

module.exports = {
    mqtt: {
      host: process.env.MQTT_HOST,  // Replace with your MQTT broker's URL
      port: process.env.MQTT_PORT,  // Adjust this if necessary
      username: process.env.MQTT_USERNAME,  // Replace with your MQTT username
      password: process.env.MQTT_PASSWORD,  // Replace with your MQTT password
      topics: process.env.MQTT_TOPICS.split(','),  // List of topics to subscribe to
    }, 
    mongoURI: process.env.MONGO_URI
  };
  