const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
// const mongoose = require('mongoose');
const config = require('./config/config');  // Import your config file
const routes = require('./routes');
const  connectToDatabase = require('./config/db_conn.js');
require('./services/mqttService');
require('./db');

connectToDatabase();

// Initialize Express app
const app = express();

// Middleware to parse incoming JSON requests
app.use(express.json());

// Swagger config
const swaggerOptions = {
    swaggerDefinition: {
      openapi: '3.0.0',
      info: {
        title: 'Lily-Bridge API Documentation',
        version: '1.0.0',
        description: 'API Documentation for Lily-Bridge MQTT backend',
      },
      servers: [
        {
          url: 'http://localhost:3000', // your server URL
        },
      ],
      tags: [
        {
            name: 'Server and broker status',
            description: ' Endpoints for checking server and MQTT broker status',
        },
      ],
     },
    apis: ['./routes/*.js'], // Path to the API docs (use the path where you define your routes)
};
  
//Initialize Swagger docs
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.use(routes);



// // Database configuration (assuming MongoDB)
// mongoose.connect('mongodb://localhost:27017/mqtt-data', {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// });

// // Define a schema and model for saving messages
// const messageSchema = new mongoose.Schema({
//   topic: String,
//   message: String,
//   receivedAt: { type: Date, default: Date.now },
// });

// const MqttMessage = mongoose.model('MqttMessage', messageSchema);

//   // Save the message to the database
//   const newMessage = new MqttMessage({ topic, message: messageContent });
//   newMessage.save((err) => {
//     if (err) {
//       console.error('Error saving message to database:', err);
//     } else {
//       console.log('Message saved to database');
//     }
//   });
// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
