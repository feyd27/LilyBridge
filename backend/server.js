const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const cookieParser = require('cookie-parser');
const path = require('path');
const connectToDatabase = require('./config/db_conn.js');
const logger = require('./services/logger');
const publicRoutes = require('./routes/publicRoutes');
const protectedRoutes = require('./routes/protectedRoutes');
const purgeMessagesRoutes = require('./routes/purgeMessages'); 
const mqttRoutes = require('./routes/mqttRoutes');
const authRoutes = require('./routes/authRoutes');
const viewsRoutes = require('./routes/viewsRoutes');
const authMiddleware = require('./middleware/authMiddleware');
const expressLayouts = require('express-ejs-layouts');
require('./services/mqttService');
require('./db');

// Connect to the database
connectToDatabase();

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(cookieParser());


// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));
// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/pages'));
app.use(expressLayouts);


// Content Security Policy (CSP)
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-eval'; object-src 'none';"
  );
  next();
});

// Pass authentication status to views
app.use((req, res, next) => {
  res.locals.isAuthenticated = !!req.cookies.accessToken;
  next();
});

// Routes
app.use('/api/auth', authRoutes);        // Authentication routes
app.use('/api', publicRoutes);             // Public routes (no authentication required)
app.use('/api/mqtt', mqttRoutes);       // MQTT API routes
app.use('/protected', authMiddleware, protectedRoutes); // Protected routes with authentication
app.use('/api/messages', authMiddleware, purgeMessagesRoutes); // Protect the route with the middleware
app.use('/', viewsRoutes);

// Swagger configuration
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
              url: 'http://localhost:3000',
          },
      ],
      components: {
          securitySchemes: {
              bearerAuth: {
                  type: 'http',
                  scheme: 'bearer',
                  bearerFormat: 'JWT',
              },
          },
      },
      security: [
          {
              bearerAuth: [],
          },
      ],
  },
  apis: ['./routes/*.js'],
};
// Initialize Swagger docs
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.log(`Server is running on port ${PORT}`);
});


