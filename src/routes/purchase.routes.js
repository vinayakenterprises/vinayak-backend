import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import purchaseController from "../controllers/purchase.controller.js";

const router = Router();

// 1. Get all vendors list
router.get("/get-vendors-data", authMiddleware, purchaseController.getVendorsData);

// 2. Insert new purchase record
router.post("/create-purchase", authMiddleware, purchaseController.createPurchase);

// 3. Get all purchases with joined vendor names
router.get("/get-purchases", authMiddleware, purchaseController.getPurchases);

router.get("/get-po-creation-requests", authMiddleware, purchaseController.getPOCreationRequests);

router.post(
  "/complete-po-creation-from-tally",
  authMiddleware,
  purchaseController.completePOCreationFromTally
);

export default router;
