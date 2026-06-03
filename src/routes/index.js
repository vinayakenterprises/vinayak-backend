import { Router } from 'express';
import healthRoutes from './health.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

// Central routing manager (can add auth.routes, users.routes, etc., here)
router.use('/health', healthRoutes);
router.use('/users', userRoutes);

export default router;
