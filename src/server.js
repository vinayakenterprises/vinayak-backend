import app from './app.js';
import config from './config/env.js';
import pool from './config/database.js';
import logger from './utils/logger.js';

const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`Server is running in ${config.nodeEnv} mode on port ${PORT}`);
});

// Graceful Shutdown handling
const shutdown = (signal) => {
  logger.info(`Received ${signal}. Shutting down server and releasing resources...`);
  
  server.close(async () => {
    logger.info('HTTP server closed.');
    try {
      await pool.end();
      logger.info('PostgreSQL connection pool drained and closed.');
      process.exit(0);
    } catch (err) {
      logger.error('Error draining PostgreSQL connection pool:', err);
      process.exit(1);
    }
  });

  // Force close after a timeout (10 seconds)
  setTimeout(() => {
    logger.error('Forceful shutdown triggered. Exiting process.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch any unhandled promise rejections and uncaught exceptions to log them before crash
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection detected:', { reason });
  shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception detected:', { message: error.message, stack: error.stack });
  shutdown('uncaughtException');
});
