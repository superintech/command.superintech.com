import { Router } from 'express';
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks,
  addComment,
  updateComment,
  deleteComment,
  startTimer,
  stopTimer,
  getActiveTimer,
} from '../controllers/tasks.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getTasks);
router.get('/timer/active', getActiveTimer);
router.get('/:id', getTask);
router.post('/', createTask);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);
router.post('/reorder', reorderTasks);
router.post('/:id/comments', addComment);
router.patch('/:id/comments/:commentId', updateComment);
router.delete('/:id/comments/:commentId', deleteComment);
router.post('/:id/timer/start', startTimer);
router.post('/:id/timer/:timeEntryId/stop', stopTimer);

export default router;
