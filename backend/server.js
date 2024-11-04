const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
// const mongoose = require('mongoose');
const config = require('./config/config');  // Import your config file
const routes = require('./routes');
const  connectToDatabase = require('./config/db_conn.js');
const logger = require('./services/logger');
require('./services/mqttService');
require('./db');
const path = require('path');
connectToDatabase();


// Initialize Express app
const app = express();
const expressLayouts = require('express-ejs-layouts');
app.use(express.static(path.join(__dirname, '../frontend')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/pages'));
app.use(expressLayouts);

// Serve static files from the frontend folder
app.use(express.static(path.join(__dirname, '../frontend')));

// Route to serve the index.html file
app.get('/', (req, res) => {
  res.render('index', { title: 'Lily-Bridge.online' });
});

// Route to render the temperature messages page
app.get('/temperature', (req, res) => {
  res.render('temperature', { title: 'Temperature messages overview'});
});

// Route to render the status messages page
app.get('/status', (req, res) => {
  res.render('status', { title: 'Status messages overview'});
});

// Route to render the error messages page
app.get('/errors', (req, res) => {
  res.render('errors', { title: 'Error messages overview'});
});

// Route to render the page to delete temperature messages
app.get('/delete-temp-messages', (req, res) => {
  res.render('deleteTempMessages', { title: 'Delete Temperature Messages'});
});

// Route to render the page to delete status messages
app.get('/delete-status-messages', (req, res) => {
  res.render('deleteStatusMessages', { title: 'Delete Status Messages'});
});

// Route to render the page to delete error messages
app.get('/delete-error-messages', (req, res) => {
  res.render('deleteErrorMessages', { title: 'Delete Error Messages'});
});




// Middleware to parse incoming JSON requests
app.use(express.json());

const mqttRoutes = require('./routes/mqttRoutes');
app.use('/api/mqtt', mqttRoutes);

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
// Other middleware
app.use('/api', mqttRoutes);  // Prefix all routes in mqttRoutes with /api
app.use(routes);
// Start the Express server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.log(`Server is running on port ${PORT}`);
});
