import { Router } from 'express';
import o2dController from '../controllers/o2d.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();



router.post('/create-sale-order', authMiddleware, o2dController.createSaleOrder);
router.get('/get-client-name', authMiddleware, o2dController.getAllClientNamesList);
router.get('/get-all-sale-order', authMiddleware, o2dController.getAllSaleOrder);
router.get('/get-sale-order-by-id/:id', authMiddleware, o2dController.getSaleOrderById);
router.put('/update-sale-order/:id', authMiddleware, o2dController.updateSaleOrder);
router.delete('/deleteSaleOrder/:id', authMiddleware, o2dController.deleteSaleOrder);

export default router;