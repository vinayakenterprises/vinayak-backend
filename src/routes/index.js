import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

// Central routing manager (can add auth.routes, users.routes, etc., here)
router.use('/health', healthRoutes);

export default router;
