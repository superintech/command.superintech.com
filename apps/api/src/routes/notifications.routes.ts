import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} from '../controllers/notifications.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/notifications - Get user notifications
router.get('/', getNotifications);

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', getUnreadCount);

// POST /api/notifications/mark-all-read - Mark all as read
router.post('/mark-all-read', markAllAsRead);

// PATCH /api/notifications/:id/read - Mark single notification as read
router.patch('/:id/read', markAsRead);

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', deleteNotification);

export default router;
