import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import purchaseController from "../controllers/purchase.controller.js";
import multer from "multer";
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
});

const router = Router();

// 1. Get all vendors list
router.get("/get-vendors-data", authMiddleware, purchaseController.getVendorsData);

// 2. Insert new purchase record
router.post("/create-purchase", authMiddleware, purchaseController.createPurchase);

// 3. Get all purchases with joined vendor names
router.get("/get-purchases", authMiddleware, purchaseController.getPurchases);

router.get("/get-po-creation-requests", authMiddleware, purchaseController.getPOCreationRequests);

router.post("/complete-po-creation-from-tally", purchaseController.completePOCreationFromTally);

router.post(
  "/completed-po-from-tally",
  authMiddleware,
  purchaseController.getCompletePOCreationFromTallyData
);

router.post("/deo-assigned-work-data", authMiddleware, purchaseController.getDEOAssignedWorkData);

router.post("/deo-work-history-data", authMiddleware, purchaseController.getDEOWorkHistoryData);

router.post(
  "/deo-quality-confirmation-data",
  authMiddleware,
  purchaseController.getDEOQualityConfirmationData
);

router.post(
  "/deo-pending-quality-confirmation-data",
  authMiddleware,
  purchaseController.getDEOPendingQualityConfirmationData
);

router.post(
  "/add-material-receive-entry",
  authMiddleware,
  upload.fields([
    { name: "kanta_parchi", maxCount: 1 },
    { name: "loaded_vehicle_image", maxCount: 1 },
    { name: "driver_photo", maxCount: 1 },
  ]),
  purchaseController.addMaterialReceiveEntry
);

export default router;
