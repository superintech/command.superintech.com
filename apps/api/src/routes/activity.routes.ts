import { Router } from 'express';
import {
  getProjectActivity,
  getTaskActivity,
  getMyActivity,
  getActivityFeed,
} from '../controllers/activity.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Activity feed for dashboard
router.get('/feed', getActivityFeed);

// User's own activity
router.get('/me', getMyActivity);

// Project activity
router.get('/project/:projectId', getProjectActivity);

// Task activity
router.get('/task/:taskId', getTaskActivity);

export default router;
