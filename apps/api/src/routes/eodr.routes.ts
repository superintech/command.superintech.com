import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getEODREntries,
  getEODREntry,
  createEODREntry,
  generateEODR,
  getEODRSummary,
  getTodayPreview,
  managerUpdateEODR,
  bulkVerifyEODR,
  getTeamEODROverview,
} from '../controllers/eodr.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Employee routes
router.get('/entries', getEODREntries);
router.get('/entries/:id', getEODREntry);
router.post('/entries', createEODREntry);
router.post('/generate', generateEODR);
router.get('/summary', getEODRSummary);
router.get('/today', getTodayPreview);

// Manager routes
router.patch('/entries/:id/review', managerUpdateEODR); // Adjust hours, verify, add notes
router.post('/bulk-verify', bulkVerifyEODR);
router.get('/team-overview', getTeamEODROverview);

export default router;
