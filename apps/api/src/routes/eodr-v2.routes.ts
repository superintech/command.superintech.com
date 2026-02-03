import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  // Daily EODR
  submitDailyEODR,
  autoPopulateFromTimer,
  getDailyEntries,
  managerEditDaily,
  bulkUpdateDaily,
  getDailyTableData,
  // Weekly
  calculateWeeklySummary,
  getWeeklyTableData,
  // Monthly
  calculateMonthlySummary,
  bulkCalculateMonthlySummary,
  finalizeMonthly,
  getMonthlyTableData,
  // Dashboard & Export
  getCommissionDashboard,
  exportData,
} from '../controllers/eodr-v2.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ============ DAILY EODR ROUTES ============

// Employee routes
router.post('/daily', submitDailyEODR);
router.post('/daily/auto-populate', autoPopulateFromTimer);
router.get('/daily', getDailyEntries);

// Manager routes
router.patch('/daily/:id/manager-edit', managerEditDaily);
router.patch('/table/daily/bulk-update', bulkUpdateDaily);

// Table data
router.get('/table/daily/:month/:year', getDailyTableData);

// ============ WEEKLY ROUTES ============

router.post('/weekly/calculate', calculateWeeklySummary);
router.get('/table/weekly/:month/:year', getWeeklyTableData);

// ============ MONTHLY ROUTES ============

router.post('/monthly/calculate', calculateMonthlySummary);
router.post('/monthly/bulk-calculate', bulkCalculateMonthlySummary);
router.post('/monthly/finalize', finalizeMonthly);
router.get('/table/monthly/:year', getMonthlyTableData);

// ============ DASHBOARD & EXPORT ============

router.get('/dashboard', getCommissionDashboard);
router.get('/export', exportData);

export default router;
