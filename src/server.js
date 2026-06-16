import express from 'express';
import cors from 'cors';
import { requestLogger } from './middlewares/requestLogger.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { NotFoundError } from './errors/customErrors.js';
import routes from './routes/index.js';
import config from './config/env.js';
import pool from './config/database.js';
import logger from './utils/logger.js';
import { initSocket } from './utils/socket.js';

const app = express();

// Global Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// API Routing
app.use('/api/v1', routes);

// Handle 404 - Not Found Routes
app.use((req, res, next) => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} not found`));
});

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start Server
const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`Server is running in ${config.nodeEnv} mode on port ${PORT}`);
});

initSocket(server);

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
