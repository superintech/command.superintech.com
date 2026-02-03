import { Router } from 'express';
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
} from '../controllers/projects.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

router.get('/', getProjects);
router.get('/:id', getProject);
router.post('/', createProject);
router.patch('/:id', updateProject);
router.delete('/:id', deleteProject);
router.post('/:id/members', addProjectMember);
router.delete('/:id/members/:userId', removeProjectMember);

export default router;
