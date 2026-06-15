import { Router } from 'express';
import tenderController from '../controllers/tender.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { tenderUpload } from '../middlewares/upload.middleware.js';

const router = Router();

// All tender routes require authentication


router.get('/approval-request-tenders', authMiddleware, tenderController.getApprovalRequestTenders);
router.get('/get-counter-offer-approval-request-tenders', authMiddleware, tenderController.getCounterOfferApprovalRequestTenders);
router.get('/get-counter-offer-rejected-tenders', authMiddleware, tenderController.getCounterOfferRejectedTenders);
router.get('/get-counter-offer-approved-tenders', authMiddleware, tenderController.getCounterOfferApprovedTenders);
router.get('/get-approved-tenders', authMiddleware, tenderController.getApprovedTenders);
router.get('/get-rejected-tenders', authMiddleware, tenderController.getRejectedTenders);
router.get('/get-tenders-accounts-team', authMiddleware, tenderController.getTendersForAccountsTeam);
router.get('/get-completed-tenders-accounts-team', authMiddleware, tenderController.getCompletedTendersForAccountsTeam);

router.get('/tender-cards-count-data', authMiddleware, tenderController.getTenderCardsCountData);

router.get('/assigned-by-accounts-team-to-stage4', authMiddleware, tenderController.getTendersAssignedByAccountsTeam);

router.post('/accounts-team-tender-update', authMiddleware, tenderController.updateTenderByAccountsTeam);
router.post('/accounts-team-tender-mark-complete', authMiddleware, tenderController.markTenderCompleteByAccountsTeam);

// this api is used to update tender details
router.post('/update-tender-details', authMiddleware, tenderController.updateTenderDetails);

router.get('/get-all', authMiddleware, tenderController.getAll);

router.get('/get-active-tenders', authMiddleware, tenderController.getActiveTenders);
router.get('/get-pending-md-approval-tenders', authMiddleware, tenderController.getPendingMDApprovalTenders);
router.get('/get-rejected-tenders-for-tender-agent', authMiddleware, tenderController.getRejectedTendersForTenderAgent);
router.get('/get-shortfall-tenders', authMiddleware, tenderController.getShortfallTenders);
router.get('/get-completed-tenders-for-tender-agent', authMiddleware, tenderController.getCompletedTendersForTenderAgent);
router.get('/get-approved-tenders-for-tender-agent', authMiddleware, tenderController.getApprovedTendersForTenderAgent);
router.get('/get-counter-offer-rejected-tender-agent', authMiddleware, tenderController.getCounterOfferRejectedTenderAgent);
router.put('/mark-as-complete-tender-after-approved-by-md/:id', authMiddleware, tenderController.markAsCompleteTenderAfterApprovedByMD);


router.delete('/delete-tender/:id', authMiddleware, tenderController.deleteTender);


router.get('/get-repetitive-tender-documents', authMiddleware, tenderController.getRepetitiveTenderDocuments);





router.get('/:id', authMiddleware, tenderController.getById);


// this api is used to approve/reject tender request by md
router.put('/approve-tender/:id', authMiddleware, tenderController.approveTender);

router.put('/approve-counter-offer-tender/:id', authMiddleware, tenderController.approveCounterOfferTender);
router.post('/create-tender', authMiddleware, tenderController.createTender);
router.put('/:id', authMiddleware, tenderUpload, tenderController.update);


// this api is used when tender agent send his tender for approval to md
router.put('/send-for-approval/:id', authMiddleware, tenderController.sendForApproval);



router.post('/upload-document', authMiddleware, tenderUpload, tenderController.uploadFileToS3);

export default router;
