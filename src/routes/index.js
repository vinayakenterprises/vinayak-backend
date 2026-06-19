import { Router } from 'express';
import healthRoutes from './health.routes.js';
import userRoutes from './user.routes.js';
import authRoutes from './auth.routes.js';
import tenderRoutes from './tender.routes.js';
import notificationRoutes from './notification.routes.js';
import profileRoutes from './profile.routes.js';

const router = Router();

// Central routing manager (can add auth.routes, users.routes, etc., here)
router.use('/health', healthRoutes);
router.use('/users', userRoutes);
router.use('/auth', authRoutes);
router.use('/tenders', tenderRoutes);
router.use('/notifications', notificationRoutes);
router.use('/profile', profileRoutes);

export default router;
