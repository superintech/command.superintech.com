import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getKPIRecords,
  getKPIRecord,
  createKPIRecord,
  updateKPIRecord,
  getMonthlySummary,
  getKPIDashboard,
  getMyKPI,
  autoCalculateKPI,
  getEmployeeOfMonth,
  managerScoreKPI,
  createKPIForUser,
  getTeamForScoring,
  // Daily KPI scoring functions
  createDailyKPIScore,
  getDailyKPIScores,
  getTeamDailyScoring,
  calculateMonthlySummary,
  getEmployeeOfMonthFromDaily,
} from '../controllers/kpi.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Employee routes
router.get('/my', getMyKPI);

// Dashboard and reports
router.get('/dashboard', getKPIDashboard);
router.get('/summary', getMonthlySummary);
router.get('/employee-of-month', getEmployeeOfMonth);
router.get('/employee-of-month-daily', getEmployeeOfMonthFromDaily); // Based on daily scores

// KPI records CRUD (monthly)
router.get('/records', getKPIRecords);
router.get('/records/:id', getKPIRecord);
router.post('/records', createKPIRecord);
router.patch('/records/:id', updateKPIRecord);

// Manager scoring routes (monthly)
router.get('/team-scoring', getTeamForScoring); // Get team members for scoring
router.post('/score', createKPIForUser); // Create KPI with scores
router.patch('/records/:id/score', managerScoreKPI); // Update scores for existing record

// Daily KPI scoring routes (managers score each employee daily)
router.get('/daily', getDailyKPIScores); // Get daily scores (filter by userId, date range)
router.get('/daily/team', getTeamDailyScoring); // Get team with EODR status for daily scoring
router.post('/daily/score', createDailyKPIScore); // Create/update daily score for an employee
router.post('/daily/calculate-monthly', calculateMonthlySummary); // Calculate monthly from daily

// Auto-calculate KPI from EODR data
router.post('/auto-calculate', autoCalculateKPI);

export default router;
