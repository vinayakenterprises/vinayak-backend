import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import profileController  from "../controllers/profile.controller.js";

const router = Router();

router.get(
  "/get-profile-data",
  authMiddleware,
  profileController.getProfileData
);


export default router;
