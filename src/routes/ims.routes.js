import { Router } from 'express';
import imsController from '../controllers/ims.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Master Data Categories
router.post('/create-new-category', authMiddleware, imsController.createCategory);
router.get('/get-all-categories', authMiddleware, imsController.getAllCategories);
router.get('/get-category-by-id/:id', authMiddleware, imsController.getCategoryById);
router.put('/update-existing-category/:id', authMiddleware, imsController.updateCategory);
router.delete('/remove-category-record/:id', authMiddleware, imsController.removeCategory);

// MASTER DATA: SUB-MATERIALS
router.post('/create-new-material', authMiddleware, imsController.createMaterial);
router.get('/get-all-materials', authMiddleware, imsController.getAllMaterials);
router.get('/get-material-by-id/:id', authMiddleware, imsController.getMaterialById);
router.put('/update-existing-material/:id', authMiddleware, imsController.updateMaterial);
router.delete('/remove-material/:id', authMiddleware, imsController.removeMaterial);

// INVENTORY PHASE 1: GOODS RECEIPT
router.post('/receive-new-shipment', authMiddleware, imsController.receiveNewShipment);

// INVENTORY PHASE 2: QUALITY CHECK
router.get('/get-pending-quality-data', authMiddleware, imsController.getPendingQualityData);
router.post('/process-quality-check', authMiddleware, imsController.processQualityCheck);

// INVENTORY PHASE 3: DASHBOARD & REPORTING
router.get('/get-inventory-data', authMiddleware, imsController.getInventoryMatrixData);
router.get('/get-rejected-material-data', authMiddleware, imsController.getRejectedMaterialData);
router.get('/get-daily-summary-metrics', authMiddleware, imsController.getDailySummaryMetrics);

// INVENTORY PHASE 4: MANUAL ADJUSTMENTS
router.put('/update-daily-stock-count', authMiddleware, imsController.updateDailyStockCount);

// FILTER DATA BY DATE
router.get('/get-filtered-inventory', authMiddleware, imsController.getFilteredInventory);

// LOG PAST DATA
router.post('/log-past-data', authMiddleware, imsController.logPastData);

// GET DATA FROM TALLY
router.post(
    "/import-purchase-data",
    imsController.importPurchaseData
);


export default router;