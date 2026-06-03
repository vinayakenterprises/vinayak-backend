import { Router } from 'express';
import tenderController from '../controllers/tender.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { tenderUpload } from '../middlewares/upload.middleware.js';

const router = Router();

// All tender routes require authentication
router.get('/', authMiddleware, tenderController.getAll);
router.get('/:id', authMiddleware, tenderController.getById);
router.post('/', authMiddleware, tenderUpload, tenderController.create);
router.put('/:id', authMiddleware, tenderUpload, tenderController.update);

export default router;
