import { Router } from "express";
import hrController from "../controllers/hr.controller.js";

const router = Router();

// ==========================================
// HIRING INFORMATION ENDPOINTS
// ==========================================
router.post("/create-hiring-record", hrController.createHiringRecord);
router.get("/hiring-records", hrController.getAllHiringRecords);
router.get("/hiring-records/summary", hrController.getHiringSummary);
router.get("/hiring-records/:id", hrController.getHiringRecordById);
router.put("/hiring-records/:id", hrController.updateHiringRecord);
router.delete("/hiring-records/:id", hrController.deleteHiringRecord);

// ==========================================
// HIRING TASK ENDPOINTS
// ==========================================
router.post("/create-hiring-task", hrController.createHiringTask);
router.get("/hiring-tasks", hrController.getAllHiringTasks);
router.get("/hiring-tasks-by-range", hrController.getTasksByRange);
router.get("/hiring-tasks/summary", hrController.getTaskSummary);
router.get("/tasks/summary", hrController.getTaskSummary);
router.get("/hiring-tasks/:id", hrController.getTaskById);
router.put("/hiring-tasks/:id", hrController.updateTask);
router.patch("/hiring-tasks/:id/status", hrController.updateTaskStatus);
router.delete("/hiring-tasks/:id", hrController.deleteTask);

export default router;
