import { Router } from 'express';
import {
  getTags,
  createTag,
  updateTag,
  deleteTag,
  addTagToTask,
  removeTagFromTask,
} from '../controllers/tags.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Tag CRUD
router.get('/', getTags);
router.post('/', createTag);
router.patch('/:id', updateTag);
router.delete('/:id', deleteTag);

// Task-Tag relationships
router.post('/tasks/:taskId/tags/:tagId', addTagToTask);
router.delete('/tasks/:taskId/tags/:tagId', removeTagFromTask);

export default router;
