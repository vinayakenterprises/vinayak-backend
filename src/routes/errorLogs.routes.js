import { Router } from "express";
import errorLogsController from "../controllers/errorLogs.controller.js";

const router = Router();

router.get("/", (req, res) => errorLogsController.getAllErrorLogs(req, res));

router.get("/:id", (req, res) => errorLogsController.getErrorLogById(req, res));

router.post("/", (req, res) => errorLogsController.createErrorLog(req, res));

router.put("/:id", (req, res) => errorLogsController.updateErrorLog(req, res));

router.delete("/:id", (req, res) => errorLogsController.deleteErrorLog(req, res));

export default router;
