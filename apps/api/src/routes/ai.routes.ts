import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  generateTask,
  enhanceTask,
  extractTasks,
  suggestAssignee,
  summarizeActivity,
  chat,
  analyzeProject,
} from '../controllers/ai.controller.js';

const router = Router();

// All AI routes require authentication
router.use(authenticate);

// Task Generation & Enhancement
router.post('/generate-task', generateTask);
router.post('/enhance-task', enhanceTask);
router.post('/extract-tasks', extractTasks);

// Smart Suggestions
router.post('/suggest-assignee', suggestAssignee);

// Activity & Analysis
router.post('/summarize-activity', summarizeActivity);
router.get('/analyze-project/:projectId', analyzeProject);

// Chat Assistant
router.post('/chat', chat);

export default router;
