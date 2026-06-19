import { Router } from "express";
import {
  getNotifications,
  markAllRead,
  markOneRead,
  createNotification
} from "../services/notification.service.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

const router = Router();


// ⚠️ REMOVE THIS AFTER TESTING
router.post('/test', authMiddleware, async (req, res) => {
  try {
    const { message, type } = req.body;
    const notif = await createNotification(req.user.id, message || 'Test notification', type || 'test');
    
    // Also push real-time
    const { emitToUser } = await import('../utils/socket.js');
    emitToUser(req.user.id, 'new_notification', notif);

    res.json({ success: true, data: notif });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const notifications = await getNotifications(req.user.id);
    res.json({ success: true, data: notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ⚠️ Must be before /:id/read to avoid route conflict
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    await markAllRead(req.user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    await markOneRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
