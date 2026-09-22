import { Router } from "express";
import userController from "../controllers/user.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { avatarUpload } from "../middlewares/upload.middleware.js";

const router = Router();

router.get("/", authMiddleware, userController.getAll);
router.get("/profile", authMiddleware, userController.getProfile);
router.patch("/update-profile", authMiddleware, avatarUpload, userController.updateProfile);

export default router;
