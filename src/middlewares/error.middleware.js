import config from '../config/env.js';
import logger from '../utils/logger.js';

export const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log the error
  logger.error(err.message, { stack: err.stack });

  // Response details depending on environment
  if (config.nodeEnv === 'development') {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      stack: err.stack,
      error: err,
    });
  }

  // Production response
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // Generic response for programming/system errors (do not leak stack details)
  return res.status(500).json({
    status: 'error',
    message: 'Something went wrong on the server',
  });
};
