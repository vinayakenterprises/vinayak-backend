import { Router } from 'express';
import tenderController from '../controllers/tender.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { tenderUpload } from '../middlewares/upload.middleware.js';

const router = Router();

// All tender routes require authentication
router.get('/approval-request-tenders', authMiddleware, tenderController.getApprovalRequestTenders);
router.get('/get-approved-tenders', authMiddleware, tenderController.getApprovedTenders);
router.get('/get-rejected-tenders', authMiddleware, tenderController.getRejectedTenders);
router.get('/get-tenders-accounts-team', authMiddleware, tenderController.getTendersForAccountsTeam);
router.get('/get-completed-tenders-accounts-team', authMiddleware, tenderController.getCompletedTendersForAccountsTeam);

router.get('/tender-cards-count-data', authMiddleware, tenderController.getTenderCardsCountData);

router.get('/assigned-by-accounts-team-to-stage4', authMiddleware, tenderController.getTendersAssignedByAccountsTeam);

router.post('/accounts-team-tender-update', authMiddleware, tenderController.updateTenderByAccountsTeam);
router.post('/accounts-team-tender-mark-complete', authMiddleware, tenderController.markTenderCompleteByAccountsTeam);

router.post('/update-tender-details', authMiddleware, tenderController.updateTenderDetails);

router.get('/get-all', authMiddleware, tenderController.getAll);

router.delete('/delete-tender/:id', authMiddleware, tenderController.deleteTender);

router.get('/:id', authMiddleware, tenderController.getById);
router.put('/approve-tender/:id', authMiddleware, tenderController.approveTender);
router.post('/create-tender', authMiddleware, tenderController.create);
router.put('/:id', authMiddleware, tenderUpload, tenderController.update);



router.put('/send-for-approval/:id', authMiddleware, tenderController.sendForApproval);



router.post('/upload-document', authMiddleware, tenderUpload, tenderController.uploadFileToS3);

export default router;
