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
router.post('/check-credit-limit', authMiddleware, o2dController.checkCreditLimit);

// credit limit approval phase
router.get('/get-credit-limit-reached-data', authMiddleware, o2dController.getCreditLimitReachedData);
router.post('/approve-credit-limit-exceeded-sale', authMiddleware, o2dController.approveCreditLimitExceededSale);


// sale order related 
router.post('/sale-order-slip-generation', authMiddleware, o2dController.generateSaleOrderSlip);


// so generator accounts team related
router.get('/get-so-generation-request-data', authMiddleware, o2dController.getSOGenerationRequestData);
router.post('/complete-so-generation-request', authMiddleware, o2dController.completeSOGenerationRequest);
router.get('/get-completed-so-generation-request-data', authMiddleware, o2dController.getCompletedSOGenerationRequestData);


// crm phase
router.get('/get-assigned-so-by-crm', authMiddleware, o2dController.getAssignedSOByCRM);
router.post('/update-dispatch-information', authMiddleware, o2dController.updateDispatchInformation);


// vehicle arrange phase
router.post('/assign-to-vehicle-executive', authMiddleware, o2dController.assignToVehicleExecutive);
router.get('/get-vehicle-executive-assigned-data', authMiddleware, o2dController.getVehicleExecutiveAssignedData);
router.get('/vehicle-executive-work-history', authMiddleware, o2dController.getVehicleExecutiveWorkHistory);
router.post('/mark-as-delivered-by-transport-executive', authMiddleware, o2dController.markAsDeliveredByTransportExecutive);


export default router;