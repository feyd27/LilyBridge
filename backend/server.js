require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerJsDoc = require('swagger-jsdoc');
const cookieParser = require('cookie-parser');
const path = require('path');
const favicon = require('serve-favicon');
const connectToDatabase = require('./config/db_conn.js');
const logger = require('./services/logger');
const publicRoutes = require('./routes/publicRoutes');
const protectedRoutes = require('./routes/protectedRoutes');
const purgeMessagesRoutes = require('./routes/purgeMessages'); 
const mqttRoutes = require('./routes/mqttRoutes');
const authRoutes = require('./routes/authRoutes');
const viewsRoutes = require('./routes/viewsRoutes');
const userSettingsRoutes = require('./routes/userSettingsRoutes');
const statsRoutes = require('./routes/statsRoutes.js');
const iotaRoutes = require('./routes/iotaRoutes.js');
const authMiddleware = require('./middleware/authMiddleware');
const expressLayouts = require('express-ejs-layouts');
const signumConfirmPublic = require('./routes/signumConfirmPublic');
const cors = require('cors');
require('./services/mqttService');
require('./db');
// 1️⃣ Import and initialize SignumJS crypto
const { Crypto } = require('@signumjs/crypto');
const { NodeJSCryptoAdapter } = require('@signumjs/crypto/adapters');
Crypto.init(new NodeJSCryptoAdapter());
logger.log('[Signum] Crypto module initialized.');
// Connect to the database
connectToDatabase();

// Initialize Express app
const app = express();
app.use(cors()); 
const signumRoutes = require('./routes/signumRoutes.js');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded
app.use(cookieParser());

app.use(favicon(path.join(__dirname, '../frontend/images/favicon.ico')));

// Serve static files
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/js',     express.static(path.join(__dirname, '../frontend/js')));
// Set EJS as the template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/pages'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Content Security Policy (CSP)
app.use((req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-eval'; object-src 'none';"
  );
  next();
});
app.use('/', viewsRoutes); 
app.use('/internal/signum', signumConfirmPublic);


app.use((req, res, next) =>  {
    const publicPaths = [
        '/js/*',
        '/css/*',
        '/images/*',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/verify-email',
        '/api-docs',
        '/api-docs/*',
        '/api/public/*',
        '/api/auth/status',
        '/internal/signum/*',
        '/api/public/forgot-password',
        '/api/public/reset-password',
        '/api/iota/find/*',
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


app.use('/api/auth', authRoutes); 
app.use('/api/public', publicRoutes);  
app.use('/api/mqtt', mqttRoutes);
app.use('/api/protected', protectedRoutes); 
app.use('/api/messages', purgeMessagesRoutes);  
app.use('/api/settings', userSettingsRoutes); 
app.use('/internal/signum', signumConfirmPublic);
app.use('/iota', iotaRoutes);
app.use('/signum', signumRoutes);
app.use('/stats', statsRoutes);

// Define the server configuration based on the environment variable
let serverConfig;
if (process.env.ENVIRONMENT === 'local') {
  // If the environment is 'local', use the localhost URL
  serverConfig = [{
    url: 'http://localhost:3000',
    description: 'Local Development Server'
  }];
} else {
  // Otherwise, use the production URL
  serverConfig = [{
    url: 'https://lily-bridge.online',
    description: 'Production Server'
  }];
}

// Swagger configuration
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Lily-Bridge API Documentation',
            version: '1.0.0',
            description: 'API Documentation for Lily-Bridge MQTT backend',
        },
        // Use the dynamic server configuration here
        servers: serverConfig,
        components: {
            // 1. Define the 'cookieAuth' security scheme
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in: 'cookie',
                    name: 'accessToken', // The name of your access token cookie
                    description: 'Authentication cookie sent by the server after login.'
                },
            },
        },
        // 2. Apply 'cookieAuth' globally to all endpoints by default
        security: [
            {
                cookieAuth: [],
            },
        ],
    },
    apis: ['./routes/api/*.js', './routes/*.js'], 
};


// Initialize Swagger docs
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs, { deepLinking: false, explorer: true}));

// ──────────────────────────────────────────────────────────────────────────────
// In-process confirmation poller 
// ──────────────────────────────────────────────────────────────────────────────
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
const UploadedMessage = require('./models/uploadedMessage');

const ENABLED   = process.env.SIGNUM_CONFIRM_POLL_ENABLED === 'true';
const INTERVAL  = Number(process.env.SIGNUM_CONFIRM_POLL_MS || 60000);
const BASE_URL  = process.env.SELF_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
const JOB_KEY   = process.env.INTERNAL_JOB_KEY || 'dev-local-key';
const LIMIT     = Number(process.env.SIGNUM_CONFIRM_POLL_LIMIT || 50);
const CONCURRENCY = Number(process.env.SIGNUM_CONFIRM_POLL_CONCURRENCY || 5);
const CHECK_URL = `${BASE_URL}/internal/signum/confirm`;

async function checkPendingBatch() {
  try {
    const pending = await UploadedMessage
      .find({
        blockchain: 'SIGNUM',
        confirmed: false,
        status: { $in: ['SENT', 'pending', 'PENDING'] }
      })
      .select('txId')
      .limit(LIMIT)
      .lean();

    if (!pending.length) {
      logger.log(`[ConfirmPoller] No pending rows (limit=${LIMIT})`);
      return;
    }

    logger.log(`[ConfirmPoller] Checking ${pending.length} tx(s)…`);

    const queue = [...pending];
    const workers = Array.from({ length: CONCURRENCY }).map(async () => {
      while (queue.length) {
        const item = queue.shift();
        try {
          const res = await fetch(CHECK_URL, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-internal-key': JOB_KEY
            },
            body: JSON.stringify({ txId: item.txId })
          });
          const txt = await res.text();
          logger.log(`[ConfirmPoller] ${item.txId} → ${res.status} ${res.statusText} – ${txt}`);
        } catch (e) {
          logger.error('[ConfirmPoller] error for', item.txId, e.message);
        }
      }
    });

    await Promise.all(workers);
  } catch (err) {
    logger.error('[ConfirmPoller] batch error:', err);
  }
}

if (ENABLED) {
  logger.log(`[ConfirmPoller] enabled (interval=${INTERVAL}ms, conc=${CONCURRENCY}, limit=${LIMIT})`);
  setInterval(() => { void checkPendingBatch(); }, INTERVAL);
}

app.get('*', (req, res) => {
  res.status(404).render('404-page', {layout: 'layout-no-sidebar', title: 'O-O'});
});
// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.log(`Server is running on port ${PORT}`);
});


