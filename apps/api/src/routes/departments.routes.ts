import { Router } from 'express';
import {
  getDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from '../controllers/departments.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const router = Router();

router.use(authenticate);

router.get('/', getDepartments);
router.get('/:id', getDepartment);
router.post('/', requireRole('CEO', 'CFO', 'COO'), createDepartment);
router.patch('/:id', requireRole('CEO', 'CFO', 'COO'), updateDepartment);
router.delete('/:id', requireRole('CEO', 'CFO', 'COO'), deleteDepartment);

export default router;
