require('dotenv').config();
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
const userSettingsRoutes = require('./routes/userSettingsRoutes');


const iotaRoutes = require('./routes/iotaRoutes.js');
const authMiddleware = require('./middleware/authMiddleware');
const expressLayouts = require('express-ejs-layouts');
const cors = require('cors');
require('./services/mqttService');
require('./db');
// 1️⃣ Import and initialize SignumJS crypto
const { Crypto } = require('@signumjs/crypto');
const { NodeJSCryptoAdapter } = require('@signumjs/crypto/adapters');
Crypto.init(new NodeJSCryptoAdapter());
console.log('[Signum] Crypto module initialized.');
// Connect to the database
connectToDatabase();

// Initialize Express app
const app = express();
const signumRoutes = require('./routes/signumRoutes.js');


// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(cookieParser());
app.use(cors()); 
// Serve favicon.ico explicitly before auth middleware
app.get('/frontend/images/favicon.ico', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/images/favicon.ico'));
});


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
app.use('/', viewsRoutes); 

app.use((req, res, next) =>  {
    const publicPaths = [
        '/',
        '/api/auth/login',
        '/api/auth/register',
        '/api-docs',
        '/api-docs/*',
        '/api/public/*',
        '/api/auth/status',
        ...publicRoutes.stack.map(r => r.route.path),
    ];

    if (publicPaths.includes(req.path)) {
        return next();
    }
   //  console.log(publicPaths);
    if (publicPaths.some(route => route.endsWith('*') && req.path.startsWith(route.slice(0, route.length - 1)))) {
        return next();
    }

    authMiddleware(req, res, next);
});

// Routes (without authentication)

app.use('/api/auth', cors(), authRoutes); 
app.use('/api/public', publicRoutes);  
app.use('/api/mqtt', mqttRoutes);
app.use('/api/protected', protectedRoutes); 
app.use('/api/messages', purgeMessagesRoutes);  
app.use('/api/settings', userSettingsRoutes); 
app.use('/iota', iotaRoutes);
app.use('/signum', signumRoutes);



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
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, { deepLinking: false, explorer: true}));

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.log(`Server is running on port ${PORT}`);
});


