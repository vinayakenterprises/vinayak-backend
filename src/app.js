import express from 'express';
import cors from 'cors';
import { requestLogger } from './middlewares/requestLogger.middleware.js';
import { errorHandler } from './middlewares/error.middleware.js';
import { NotFoundError } from './errors/customErrors.js';
import routes from './routes/index.js';

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

export default app;
