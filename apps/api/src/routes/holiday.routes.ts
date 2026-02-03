import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listHolidays,
  getHolidaysByMonth,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  bulkCreateHolidays,
} from '../controllers/holiday.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Read routes (all authenticated users)
router.get('/', listHolidays);
router.get('/:year/:month', getHolidaysByMonth);

// Admin routes
router.post('/', createHoliday);
router.post('/bulk', bulkCreateHolidays);
router.put('/:id', updateHoliday);
router.delete('/:id', deleteHoliday);

export default router;
