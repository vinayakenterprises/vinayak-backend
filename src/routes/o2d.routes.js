import { Router } from 'express';
import o2dController from '../controllers/o2d.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();


// client information related
router.get('/get-client-name', authMiddleware, o2dController.getAllClientNamesList);
router.post('/create-new-customer', authMiddleware, o2dController.createNewCustomerProfile);
router.get('/retrieve-all-customers', authMiddleware, o2dController.retrieveAllCustomersList);
router.get('/retrieve-customer-by-id/:id', authMiddleware, o2dController.retrieveCustomerDetailsById);
router.put('/update-existing-customer/:id', authMiddleware, o2dController.updateExistingCustomerDetails);
router.delete('/remove-customer-record/:id', authMiddleware, o2dController.removeCustomerRecordById);


// sale order related
router.post('/create-sale-order', authMiddleware, o2dController.createSaleOrder);
router.get('/get-all-sale-order', authMiddleware, o2dController.getAllSaleOrder);
router.get('/get-sale-order-by-id/:id', authMiddleware, o2dController.getSaleOrderById);
router.put('/update-sale-order/:id', authMiddleware, o2dController.updateSaleOrder);
router.delete('/deleteSaleOrder/:id', authMiddleware, o2dController.deleteSaleOrder);


// sale order related 
router.post('/sale-order-slip-generation', authMiddleware, o2dController.generateSaleOrderSlip);


export default router;