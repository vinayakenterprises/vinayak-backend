import { Router } from 'express';
import o2dController from '../controllers/o2d.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { documentUpload } from '../middlewares/upload.middleware.js';

const router = Router();


// client information related
router.get('/get-client-name', authMiddleware, o2dController.getAllClientNamesList);
router.post('/create-new-customer', authMiddleware, o2dController.createNewCustomerProfile);
router.get('/retrieve-all-customers', authMiddleware, o2dController.retrieveAllCustomersList);
router.get('/retrieve-customer-by-id/:id', authMiddleware, o2dController.retrieveCustomerDetailsById);
router.put('/update-existing-customer/:id', authMiddleware, o2dController.updateExistingCustomerDetails);
router.post('/get-crm-and-sales-person', authMiddleware, o2dController.getCrmAndSalesPerson);
router.post('/update-crm-and-sales-person', authMiddleware, o2dController.updateCrmAndSalesPerson);
// router.delete('/remove-customer-record/:id', authMiddleware, o2dController.removeCustomerRecordById); - todo


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
// this api is used to get data for the crm dashbaord
router.get('/get-assigned-so-by-crm', authMiddleware, o2dController.getAssignedSOByCRM);
router.post('/update-dispatch-information', authMiddleware, o2dController.updateDispatchInformation);
router.post('/assign-to-vehicle-executive', authMiddleware, o2dController.assignToVehicleExecutive);
router.post('/assign-order-to-invoice-executive', authMiddleware, o2dController.assignOrderToInvoiceExecutive);
router.post('/intimation-and-thank-you-data-update', authMiddleware, o2dController.intimationAndThankYouData);
router.post('/update-payment-information', authMiddleware, o2dController.updatePaymentInformation);
router.post('/update-delivery-and-weight-information', authMiddleware, o2dController.updateDeliveryAndWeightInformation);
router.post('/update-po-related', authMiddleware, o2dController.updatePoRelated);
router.post("/sale-orders/:id/remarks", authMiddleware, o2dController.addRemarksToOrder);
router.get("/sale-orders/:id/remarks", authMiddleware, o2dController.getRemarksForOrder);
router.put("/sale-orders/:id/remarks/:remarkId", authMiddleware, o2dController.updateRemarksForOrder);
router.delete("/sale-orders/:id/remarks/:remarkId", authMiddleware, o2dController.deleteRemarksForOrder);
router.post('/get-specific-sale-order-information', authMiddleware, o2dController.getSpecificSaleOrderInformation);
router.post('/split-order-into-multiple-orders', authMiddleware, o2dController.splitOrderIntoMultipleOrders);


// vehicle arrange phase
router.get('/get-vehicle-executive-assigned-data', authMiddleware, o2dController.getVehicleExecutiveAssignedData);
router.get('/vehicle-executive-work-history', authMiddleware, o2dController.getVehicleExecutiveWorkHistory);
router.post('/mark-as-delivered-by-transport-executive', authMiddleware, o2dController.markAsDeliveredByTransportExecutive);

// invoice generation phase
router.get('/get-invoice-generation-request-data', authMiddleware, o2dController.getInvoiceGenerationRequestData);
router.post('/update-invoice-and-dispatch-info', authMiddleware, o2dController.updateInvoiceAndDispatchInfo);
router.get('/get-invoice-executive-completed-data', authMiddleware, o2dController.getInvoiceExecutiveCompletedData);


// complaints related 
router.post(
  "/sale-orders/:id/complaints",
  authMiddleware,
  o2dController.createComplaintForSaleOrder
);

router.get(
  "/sale-orders/:id/complaints",
  authMiddleware,
  o2dController.getAllComplaintsForSaleOrder
);

router.get(
  "/sale-orders/:id/complaints/:complaintId",
  authMiddleware,
  o2dController.getComplaintDetailsForSaleOrder
);

router.put(
  "/sale-orders/:id/complaints/:complaintId",
  authMiddleware,
  o2dController.updateComplaintDetailsForSaleOrder
);

router.delete(
  "/sale-orders/:id/complaints/:complaintId",
  authMiddleware,
  o2dController.deleteComplaintForSaleOrder
);

router.post("/update-callaction-information", authMiddleware, o2dController.updateCallActionInformation);
router.get("/get-call-complaint-data", authMiddleware, o2dController.getCallComplaintData);
router.post("/plant-visit-info-update", authMiddleware, o2dController.updatePlantVisitInformation);
router.post("/complaint-closure-info-update", authMiddleware, o2dController.updateComplaintClosureInformation);

// jatin dashboard related apis
router.get("/get-cn-dn-issue-data", authMiddleware, o2dController.getCnDnIssueData);
router.get("/get-cn-dn-work-history", authMiddleware, o2dController.getCnDnWorkHistory);
router.get("/get-interest-note-issue-data", authMiddleware, o2dController.getInterestNoteIssueData);
router.get("/get-interest-note-issue-work-history", authMiddleware, o2dController.getInterestNoteIssueWorkHistory);


// admin dashboard related apis
router.get("/get-admin-dashboard-cards-data", authMiddleware, o2dController.getAdminDashboardCardsData);
router.post("/get-all-sale-orders-admin-dashboard", authMiddleware, o2dController.getActiveSaleOrdersAdminDashboard);



// overdue summary 
router.get('/get-overdue-report-data', authMiddleware, o2dController.getOverdueReportData);
router.post('/update-overdue-summary-report-information', authMiddleware, o2dController.updateOverdueSummaryReportInformation);



// for tally integration
router.post('/test-api-for-tally-integration', o2dController.testApiForTallyIntegration);
router.post('/so-orders-from-tally', documentUpload, o2dController.receiveSoOrdersFromTally);
router.post('/invoice-details-from-tally', documentUpload, o2dController.receiveInvoiceDetailsFromTally);

// this api is used to upload the pdf for the invoice
router.post(
  "/invoice-pdf-url-update", 
  authMiddleware, 
  o2dController.updateInvoicePdfUrl
);



export default router;