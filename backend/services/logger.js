// services/logger.js
require('dotenv').config();

const isLoggingEnabled = process.env.LOGGING_ENABLED === 'true';

const logger = {
  log: (...args) => {
    if (isLoggingEnabled) {
      console.log(...args);
    }
  },
  error: (...args) => {
    if (isLoggingEnabled) {
      console.error(...args);
    }
  },
  warn: (...args) => {
    if (isLoggingEnabled) {
      console.warn(...args);
    }
  }
};

module.exports = logger;
