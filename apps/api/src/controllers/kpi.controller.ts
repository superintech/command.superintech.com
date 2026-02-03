import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { isManager } from '../middleware/rbac.js';

// KPI metric weights for total score calculation
const KPI_WEIGHTS = {
  attendance: 0.25,
  quality: 0.30,
  behaviour: 0.20,
  eodrScore: 0.25,
};

// Commission tiers based on overall score
const COMMISSION_TIERS = [
  { min: 90, tier: 'PLATINUM', bonus: 0.15 },
  { min: 80, tier: 'GOLD', bonus: 0.10 },
  { min: 70, tier: 'SILVER', bonus: 0.05 },
  { min: 60, tier: 'BRONZE', bonus: 0.02 },
  { min: 0, tier: 'NONE', bonus: 0 },
];

function getCommissionTier(score: number): { tier: string; bonus: number } {
  return COMMISSION_TIERS.find(t => score >= t.min) || COMMISSION_TIERS[COMMISSION_TIERS.length - 1];
}

function calculateTotalScore(attendance: number, quality: number, behaviour: number, eodrScore: number): number {
  return Math.round(
    attendance * KPI_WEIGHTS.attendance +
    quality * KPI_WEIGHTS.quality +
    behaviour * KPI_WEIGHTS.behaviour +
    eodrScore * KPI_WEIGHTS.eodrScore
  );
}

// Get KPI records
export async function getKPIRecords(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId, month, year, departmentId } = req.query;

    const where: Record<string, unknown> = {};

    // If not a manager, can only view their own records
    if (!isManager(req)) {
      where.userId = req.user!.id;
    } else {
      if (userId) where.userId = userId as string;
      if (departmentId) {
        where.user = { departmentId: departmentId as string };
      }
    }

    if (month) where.month = parseInt(month as string);
    if (year) where.year = parseInt(year as string);

    const records = await prisma.kPIRecord.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { id: true, name: true } },
          },
        },
        reviewer: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    res.json({ success: true, data: records });
  } catch (error) {
    console.error('Get KPI records error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch KPI records' });
  }
}

// Get single KPI record
export async function getKPIRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const record = await prisma.kPIRecord.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { id: true, name: true } },
          },
        },
        reviewer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    if (!record) {
      res.status(404).json({ success: false, error: 'KPI record not found' });
      return;
    }

    // Check access
    if (!isManager(req) && record.userId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    res.json({ success: true, data: record });
  } catch (error) {
    console.error('Get KPI record error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch KPI record' });
  }
}

// Create KPI record (managers only)
export async function createKPIRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can create KPI records' });
      return;
    }

    const { userId, month, year, attendance, quality, behaviour, eodrScore, comments } = req.body;

    // Check if record already exists
    const existing = await prisma.kPIRecord.findUnique({
      where: {
        userId_month_year: { userId, month, year },
      },
    });

    if (existing) {
      res.status(400).json({ success: false, error: 'KPI record already exists for this period' });
      return;
    }

    // Verify user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!targetUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const totalScore = calculateTotalScore(attendance, quality, behaviour, eodrScore);

    const record = await prisma.kPIRecord.create({
      data: {
        userId,
        reviewerId: req.user!.id,
        month,
        year,
        attendance,
        quality,
        behaviour,
        eodrScore,
        totalScore,
        comments,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { id: true, name: true } },
          },
        },
        reviewer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error('Create KPI record error:', error);
    res.status(500).json({ success: false, error: 'Failed to create KPI record' });
  }
}

// Update KPI record (managers only)
export async function updateKPIRecord(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can update KPI records' });
      return;
    }

    const { id } = req.params;
    const { attendance, quality, behaviour, eodrScore, comments } = req.body;

    const existing = await prisma.kPIRecord.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'KPI record not found' });
      return;
    }

    const newAttendance = attendance ?? existing.attendance;
    const newQuality = quality ?? existing.quality;
    const newBehaviour = behaviour ?? existing.behaviour;
    const newEodrScore = eodrScore ?? existing.eodrScore;
    const totalScore = calculateTotalScore(newAttendance, newQuality, newBehaviour, newEodrScore);

    const record = await prisma.kPIRecord.update({
      where: { id },
      data: {
        attendance: newAttendance,
        quality: newQuality,
        behaviour: newBehaviour,
        eodrScore: newEodrScore,
        totalScore,
        comments: comments ?? existing.comments,
        reviewerId: req.user!.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { id: true, name: true } },
          },
        },
        reviewer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    res.json({ success: true, data: record });
  } catch (error) {
    console.error('Update KPI record error:', error);
    res.status(500).json({ success: false, error: 'Failed to update KPI record' });
  }
}

// Get monthly KPI summary
export async function getMonthlySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId, month, year } = req.query;

    const targetUserId = isManager(req) && userId ? (userId as string) : req.user!.id;
    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);

    // Check if summary exists
    let summary = await prisma.monthlyKPISummary.findUnique({
      where: {
        userId_month_year: {
          userId: targetUserId,
          month: monthNum,
          year: yearNum,
        },
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    if (!summary) {
      // Generate summary from KPI record
      const kpiRecord = await prisma.kPIRecord.findUnique({
        where: {
          userId_month_year: {
            userId: targetUserId,
            month: monthNum,
            year: yearNum,
          },
        },
      });

      if (!kpiRecord) {
        res.status(404).json({ success: false, error: 'No KPI data found for this period' });
        return;
      }

      const tierInfo = getCommissionTier(kpiRecord.totalScore);

      // Create the summary
      await prisma.monthlyKPISummary.create({
        data: {
          userId: targetUserId,
          month: monthNum,
          year: yearNum,
          avgAttendance: kpiRecord.attendance,
          avgQuality: kpiRecord.quality,
          avgBehaviour: kpiRecord.behaviour,
          avgEodrScore: kpiRecord.eodrScore,
          overallScore: kpiRecord.totalScore,
          commissionTier: tierInfo.tier,
        },
      });

      // Fetch it with user included
      summary = await prisma.monthlyKPISummary.findUnique({
        where: {
          userId_month_year: {
            userId: targetUserId,
            month: monthNum,
            year: yearNum,
          },
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
        },
      });
    }

    if (!summary) {
      res.status(500).json({ success: false, error: 'Failed to create summary' });
      return;
    }

    const tierInfo = getCommissionTier(summary.overallScore);

    res.json({
      success: true,
      data: {
        ...summary,
        commissionBonus: tierInfo.bonus,
        tierDetails: tierInfo,
      },
    });
  } catch (error) {
    console.error('Get monthly summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to get monthly summary' });
  }
}

// Get KPI dashboard data
export async function getKPIDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { month, year } = req.query;

    const monthNum = parseInt(month as string) || new Date().getMonth() + 1;
    const yearNum = parseInt(year as string) || new Date().getFullYear();

    // If user is manager, get all team data
    // If regular employee, get only their own data
    const where: Record<string, unknown> = {
      month: monthNum,
      year: yearNum,
    };

    if (!isManager(req)) {
      where.userId = req.user!.id;
    }

    // Get all KPI records for the period
    const records = await prisma.kPIRecord.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
            role: true,
            department: { select: { name: true } },
          },
        },
      },
      orderBy: { totalScore: 'desc' },
    });

    // Calculate averages
    const avgAttendance = records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + r.attendance, 0) / records.length)
      : 0;
    const avgQuality = records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + r.quality, 0) / records.length)
      : 0;
    const avgBehaviour = records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + r.behaviour, 0) / records.length)
      : 0;
    const avgEodrScore = records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + r.eodrScore, 0) / records.length)
      : 0;
    const avgTotalScore = records.length > 0
      ? Math.round(records.reduce((sum, r) => sum + r.totalScore, 0) / records.length)
      : 0;

    // Tier distribution
    const tierDistribution = COMMISSION_TIERS.map(tier => ({
      tier: tier.tier,
      count: records.filter(r => getCommissionTier(r.totalScore).tier === tier.tier).length,
    }));

    // Top performers
    const topPerformers = records.slice(0, 5);

    res.json({
      success: true,
      data: {
        period: { month: monthNum, year: yearNum },
        totalEmployees: records.length,
        averages: {
          attendance: avgAttendance,
          quality: avgQuality,
          behaviour: avgBehaviour,
          eodrScore: avgEodrScore,
          totalScore: avgTotalScore,
        },
        tierDistribution,
        topPerformers,
        records,
      },
    });
  } catch (error) {
    console.error('Get KPI dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to get KPI dashboard' });
  }
}

// Get my KPI (for regular employees)
export async function getMyKPI(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { month, year } = req.query;

    const monthNum = parseInt(month as string) || new Date().getMonth() + 1;
    const yearNum = parseInt(year as string) || new Date().getFullYear();

    // Get KPI record
    const kpiRecord = await prisma.kPIRecord.findUnique({
      where: {
        userId_month_year: {
          userId: req.user!.id,
          month: monthNum,
          year: yearNum,
        },
      },
      include: {
        reviewer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Get historical records (last 6 months)
    const historicalRecords = await prisma.kPIRecord.findMany({
      where: {
        userId: req.user!.id,
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 6,
      select: {
        month: true,
        year: true,
        totalScore: true,
        attendance: true,
        quality: true,
        behaviour: true,
        eodrScore: true,
      },
    });

    // Get EODR entries for this month
    const startOfMonth = new Date(yearNum, monthNum - 1, 1);
    const endOfMonth = new Date(yearNum, monthNum, 0);

    const eodrEntries = await prisma.eODREntry.findMany({
      where: {
        userId: req.user!.id,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { date: 'desc' },
    });

    const tierInfo = kpiRecord ? getCommissionTier(kpiRecord.totalScore) : null;

    res.json({
      success: true,
      data: {
        currentPeriod: {
          month: monthNum,
          year: yearNum,
        },
        kpiRecord,
        commissionTier: tierInfo,
        historicalRecords,
        eodrEntries,
        eodrStats: {
          totalDays: eodrEntries.length,
          totalHours: eodrEntries.reduce((sum, e) => sum + e.totalHours, 0),
          totalTasksCompleted: eodrEntries.reduce((sum, e) => sum + e.tasksCompleted, 0),
        },
      },
    });
  } catch (error) {
    console.error('Get my KPI error:', error);
    res.status(500).json({ success: false, error: 'Failed to get KPI data' });
  }
}

// Auto-calculate and create KPI record from EODR data
export async function autoCalculateKPI(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can auto-calculate KPI' });
      return;
    }

    const { userId, month, year, quality, behaviour, comments } = req.body;

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    // Check if record already exists
    const existing = await prisma.kPIRecord.findUnique({
      where: {
        userId_month_year: { userId, month: monthNum, year: yearNum },
      },
    });

    if (existing) {
      res.status(400).json({ success: false, error: 'KPI record already exists for this period' });
      return;
    }

    // Calculate attendance from EODR entries
    const startOfMonth = new Date(yearNum, monthNum - 1, 1);
    const endOfMonth = new Date(yearNum, monthNum, 0);

    const eodrEntries = await prisma.eODREntry.findMany({
      where: {
        userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Calculate working days in month
    let workingDays = 0;
    const current = new Date(startOfMonth);
    while (current <= endOfMonth) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) workingDays++;
      current.setDate(current.getDate() + 1);
    }

    // Calculate metrics
    const attendance = workingDays > 0
      ? Math.round((eodrEntries.length / workingDays) * 100)
      : 0;

    // EODR score calculation
    const totalHours = eodrEntries.reduce((sum, e) => sum + e.totalHours, 0);
    const avgHoursPerDay = eodrEntries.length > 0 ? totalHours / eodrEntries.length : 0;
    const totalTasksCompleted = eodrEntries.reduce((sum, e) => sum + e.tasksCompleted, 0);

    // Score: 50% from attendance, 30% from avg hours (8h = 100%), 20% from productivity
    const hourScore = Math.min(avgHoursPerDay / 8, 1) * 30;
    const attendanceScore = (attendance / 100) * 50;
    const taskScore = Math.min(totalTasksCompleted / (eodrEntries.length * 3), 1) * 20;
    const eodrScore = Math.round(hourScore + attendanceScore + taskScore);

    // Use provided quality/behaviour or defaults
    const qualityScore = quality ?? 70; // Default to 70 if not provided
    const behaviourScore = behaviour ?? 70;

    const totalScore = calculateTotalScore(attendance, qualityScore, behaviourScore, eodrScore);

    const record = await prisma.kPIRecord.create({
      data: {
        userId,
        reviewerId: req.user!.id,
        month: monthNum,
        year: yearNum,
        attendance,
        quality: qualityScore,
        behaviour: behaviourScore,
        eodrScore,
        totalScore,
        comments: comments || `Auto-generated from ${eodrEntries.length} EODR entries`,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: { select: { name: true } },
          },
        },
        reviewer: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error('Auto-calculate KPI error:', error);
    res.status(500).json({ success: false, error: 'Failed to auto-calculate KPI' });
  }
}

// Calculate working days in a month
function getWorkingDaysInMonth(year: number, month: number): number {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0);

  let workingDays = 0;
  const current = new Date(startOfMonth);
  while (current <= endOfMonth) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) workingDays++;
    current.setDate(current.getDate() + 1);
  }
  return workingDays;
}

// Get Employee of the Month
export async function getEmployeeOfMonth(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { month, year } = req.query;

    const monthNum = parseInt(month as string) || new Date().getMonth() + 1;
    const yearNum = parseInt(year as string) || new Date().getFullYear();

    // Get all KPI records for this month
    const records = await prisma.kPIRecord.findMany({
      where: {
        month: monthNum,
        year: yearNum,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { totalScore: 'desc' },
    });

    if (records.length === 0) {
      res.json({
        success: true,
        data: {
          period: { month: monthNum, year: yearNum },
          workingDays: getWorkingDaysInMonth(yearNum, monthNum),
          avgPointsRequired: 88, // Base average point requirement
          employees: [],
          employeeOfMonth: null,
          message: 'No KPI records found for this period',
        },
      });
      return;
    }

    // Calculate average score
    const avgScore = Math.round(records.reduce((sum, r) => sum + r.totalScore, 0) / records.length);

    // Calculate points per working day
    const workingDays = getWorkingDaysInMonth(yearNum, monthNum);

    // Build employee list with difference calculations
    const employees = records.map(record => {
      const difference = record.totalScore - avgScore;
      return {
        user: record.user,
        points: record.totalScore,
        avgPoint: avgScore,
        difference,
        attendance: record.attendance,
        quality: record.quality,
        behaviour: record.behaviour,
        eodrScore: record.eodrScore,
        isEligible: difference >= 0, // Eligible only if difference is 0 or positive
      };
    });

    // Employee of the Month: Highest score among those with positive/zero difference
    const eligibleEmployees = employees.filter(e => e.isEligible);
    const employeeOfMonth = eligibleEmployees.length > 0 ? eligibleEmployees[0] : null;

    res.json({
      success: true,
      data: {
        period: { month: monthNum, year: yearNum },
        workingDays,
        avgPointsRequired: avgScore,
        employees,
        employeeOfMonth,
        stats: {
          totalEmployees: employees.length,
          eligibleCount: eligibleEmployees.length,
          ineligibleCount: employees.length - eligibleEmployees.length,
          highestScore: records[0]?.totalScore || 0,
          lowestScore: records[records.length - 1]?.totalScore || 0,
        },
      },
    });
  } catch (error) {
    console.error('Get employee of month error:', error);
    res.status(500).json({ success: false, error: 'Failed to get employee of month' });
  }
}

// Manager score KPI for a team member
export async function managerScoreKPI(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can score KPI' });
      return;
    }

    const { id } = req.params;
    const { attendance, quality, behaviour, eodrScore, comments } = req.body;

    const existing = await prisma.kPIRecord.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'KPI record not found' });
      return;
    }

    // Update scores
    const newAttendance = attendance ?? existing.attendance;
    const newQuality = quality ?? existing.quality;
    const newBehaviour = behaviour ?? existing.behaviour;
    const newEodrScore = eodrScore ?? existing.eodrScore;
    const totalScore = calculateTotalScore(newAttendance, newQuality, newBehaviour, newEodrScore);

    const record = await prisma.kPIRecord.update({
      where: { id },
      data: {
        attendance: newAttendance,
        quality: newQuality,
        behaviour: newBehaviour,
        eodrScore: newEodrScore,
        totalScore,
        comments: comments || existing.comments,
        reviewerId: req.user!.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { id: true, name: true } },
          },
        },
        reviewer: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    res.json({ success: true, data: record });
  } catch (error) {
    console.error('Manager score KPI error:', error);
    res.status(500).json({ success: false, error: 'Failed to score KPI' });
  }
}

// Create KPI record for a user (manager only) - for bulk creation
export async function createKPIForUser(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can create KPI records' });
      return;
    }

    const { userId, month, year, attendance, quality, behaviour, eodrScore, comments } = req.body;

    // Check if already exists
    const existing = await prisma.kPIRecord.findUnique({
      where: {
        userId_month_year: {
          userId,
          month: parseInt(month),
          year: parseInt(year),
        },
      },
    });

    if (existing) {
      res.status(400).json({ success: false, error: 'KPI record already exists for this user and period' });
      return;
    }

    const totalScore = calculateTotalScore(
      attendance || 0,
      quality || 70,
      behaviour || 70,
      eodrScore || 0
    );

    const record = await prisma.kPIRecord.create({
      data: {
        userId,
        reviewerId: req.user!.id,
        month: parseInt(month),
        year: parseInt(year),
        attendance: attendance || 0,
        quality: quality || 70,
        behaviour: behaviour || 70,
        eodrScore: eodrScore || 0,
        totalScore,
        comments,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: { select: { name: true } },
          },
        },
        reviewer: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({ success: true, data: record });
  } catch (error) {
    console.error('Create KPI for user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create KPI record' });
  }
}

// ============================================
// DAILY KPI SCORING FUNCTIONS
// ============================================

// Create or update daily KPI score (manager scores an employee for a specific date)
export async function createDailyKPIScore(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can score daily KPI' });
      return;
    }

    const { userId, date, attendance, quality, behaviour, eodrScore, comments } = req.body;

    // Parse the date
    const scoreDate = new Date(date);
    scoreDate.setHours(0, 0, 0, 0);

    // Calculate total score (sum of all 4 metrics, 0-2 each, max 8)
    const totalScore = (attendance || 0) + (quality || 0) + (behaviour || 0) + (eodrScore || 0);

    // Check if EODR entry exists for this user on this date
    const eodrEntry = await prisma.eODREntry.findUnique({
      where: {
        userId_date: {
          userId,
          date: scoreDate,
        },
      },
    });

    // Upsert the daily score
    const dailyScore = await prisma.dailyKPIScore.upsert({
      where: {
        userId_date: {
          userId,
          date: scoreDate,
        },
      },
      update: {
        attendance: attendance || 0,
        quality: quality || 0,
        behaviour: behaviour || 0,
        eodrScore: eodrScore || 0,
        totalScore,
        comments,
        scoredById: req.user!.id,
        eodrEntryId: eodrEntry?.id || null,
      },
      create: {
        userId,
        date: scoreDate,
        attendance: attendance || 0,
        quality: quality || 0,
        behaviour: behaviour || 0,
        eodrScore: eodrScore || 0,
        totalScore,
        comments,
        scoredById: req.user!.id,
        eodrEntryId: eodrEntry?.id || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        scoredBy: {
          select: { id: true, name: true },
        },
      },
    });

    res.status(201).json({ success: true, data: dailyScore });
  } catch (error) {
    console.error('Create daily KPI score error:', error);
    res.status(500).json({ success: false, error: 'Failed to create daily KPI score' });
  }
}

// Get daily KPI scores for a user (or all users for managers)
export async function getDailyKPIScores(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId, startDate, endDate, month, year } = req.query;

    let dateFilter: { gte?: Date; lte?: Date } = {};

    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    } else if (month && year) {
      const monthNum = parseInt(month as string);
      const yearNum = parseInt(year as string);
      dateFilter = {
        gte: new Date(yearNum, monthNum - 1, 1),
        lte: new Date(yearNum, monthNum, 0),
      };
    }

    const where: Record<string, unknown> = {};

    // Non-managers can only view their own scores
    if (!isManager(req)) {
      where.userId = req.user!.id;
    } else if (userId) {
      where.userId = userId as string;
    }

    if (Object.keys(dateFilter).length > 0) {
      where.date = dateFilter;
    }

    const scores = await prisma.dailyKPIScore.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            department: { select: { id: true, name: true } },
          },
        },
        scoredBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json({ success: true, data: scores });
  } catch (error) {
    console.error('Get daily KPI scores error:', error);
    res.status(500).json({ success: false, error: 'Failed to get daily KPI scores' });
  }
}

// Get team members with their EODR status for daily scoring (managers only)
export async function getTeamDailyScoring(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can access this' });
      return;
    }

    const { date } = req.query;
    const scoreDate = date ? new Date(date as string) : new Date();
    scoreDate.setHours(0, 0, 0, 0);

    // Get all active users
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Get EODR entries for this date
    const eodrEntries = await prisma.eODREntry.findMany({
      where: { date: scoreDate },
      select: {
        id: true,
        userId: true,
        totalHours: true,
        adjustedHours: true,
        tasksCompleted: true,
        tasks: true,
        isVerified: true,
        notes: true,
      },
    });
    const eodrMap = new Map(eodrEntries.map(e => [e.userId, e]));

    // Get existing daily scores for this date
    const existingScores = await prisma.dailyKPIScore.findMany({
      where: { date: scoreDate },
    });
    const scoreMap = new Map(existingScores.map(s => [s.userId, s]));

    // Build team list
    const team = users.map(user => {
      const eodrEntry = eodrMap.get(user.id);
      const dailyScore = scoreMap.get(user.id);

      return {
        user,
        date: scoreDate.toISOString().split('T')[0],
        eodrEntry: eodrEntry ? {
          id: eodrEntry.id,
          totalHours: eodrEntry.totalHours,
          adjustedHours: eodrEntry.adjustedHours,
          tasksCompleted: eodrEntry.tasksCompleted,
          isVerified: eodrEntry.isVerified,
          tasks: eodrEntry.tasks,
          notes: eodrEntry.notes,
        } : null,
        hasSubmittedEODR: !!eodrEntry,
        isVerified: eodrEntry?.isVerified || false,
        dailyScore: dailyScore ? {
          id: dailyScore.id,
          attendance: dailyScore.attendance,
          quality: dailyScore.quality,
          behaviour: dailyScore.behaviour,
          eodrScore: dailyScore.eodrScore,
          totalScore: dailyScore.totalScore,
          comments: dailyScore.comments,
        } : null,
        isScored: !!dailyScore,
      };
    });

    res.json({
      success: true,
      data: {
        date: scoreDate.toISOString().split('T')[0],
        team,
        stats: {
          totalUsers: users.length,
          submittedEODR: eodrEntries.length,
          pendingEODR: users.length - eodrEntries.length,
          scored: existingScores.length,
          pendingScoring: users.length - existingScores.length,
        },
      },
    });
  } catch (error) {
    console.error('Get team daily scoring error:', error);
    res.status(500).json({ success: false, error: 'Failed to get team data' });
  }
}

// Calculate monthly summary from daily scores
export async function calculateMonthlySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can calculate monthly summary' });
      return;
    }

    const { month, year, userId } = req.body;

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    const startOfMonth = new Date(yearNum, monthNum - 1, 1);
    const endOfMonth = new Date(yearNum, monthNum, 0);

    // Get target users (single user or all)
    const userIds = userId
      ? [userId]
      : (await prisma.user.findMany({
          where: { isActive: true },
          select: { id: true },
        })).map(u => u.id);

    const results = [];

    for (const uid of userIds) {
      // Get all daily scores for this user and month
      const dailyScores = await prisma.dailyKPIScore.findMany({
        where: {
          userId: uid,
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      if (dailyScores.length === 0) {
        results.push({ userId: uid, status: 'skipped', reason: 'No daily scores' });
        continue;
      }

      // Calculate averages
      const avgAttendance = Math.round(dailyScores.reduce((sum, s) => sum + s.attendance, 0) / dailyScores.length * 10) / 10;
      const avgQuality = Math.round(dailyScores.reduce((sum, s) => sum + s.quality, 0) / dailyScores.length * 10) / 10;
      const avgBehaviour = Math.round(dailyScores.reduce((sum, s) => sum + s.behaviour, 0) / dailyScores.length * 10) / 10;
      const avgEodrScore = Math.round(dailyScores.reduce((sum, s) => sum + s.eodrScore, 0) / dailyScores.length * 10) / 10;

      // Overall score using weighted average
      const overallScore = calculateTotalScore(avgAttendance * 10, avgQuality * 10, avgBehaviour * 10, avgEodrScore * 10);
      const tierInfo = getCommissionTier(overallScore);

      // Upsert monthly summary
      const summary = await prisma.monthlyKPISummary.upsert({
        where: {
          userId_month_year: {
            userId: uid,
            month: monthNum,
            year: yearNum,
          },
        },
        update: {
          avgAttendance,
          avgQuality,
          avgBehaviour,
          avgEodrScore,
          overallScore,
          commissionTier: tierInfo.tier,
        },
        create: {
          userId: uid,
          month: monthNum,
          year: yearNum,
          avgAttendance,
          avgQuality,
          avgBehaviour,
          avgEodrScore,
          overallScore,
          commissionTier: tierInfo.tier,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      results.push({ userId: uid, status: 'updated', summary, daysScored: dailyScores.length });
    }

    res.json({
      success: true,
      data: {
        period: { month: monthNum, year: yearNum },
        results,
        stats: {
          processed: results.length,
          updated: results.filter(r => r.status === 'updated').length,
          skipped: results.filter(r => r.status === 'skipped').length,
        },
      },
    });
  } catch (error) {
    console.error('Calculate monthly summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate monthly summary' });
  }
}

// Get Employee of the Month based on daily scores
export async function getEmployeeOfMonthFromDaily(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { month, year } = req.query;

    const monthNum = parseInt(month as string) || new Date().getMonth() + 1;
    const yearNum = parseInt(year as string) || new Date().getFullYear();
    const startOfMonth = new Date(yearNum, monthNum - 1, 1);
    const endOfMonth = new Date(yearNum, monthNum, 0);
    const workingDays = getWorkingDaysInMonth(yearNum, monthNum);

    // Get all daily scores grouped by user
    const dailyScores = await prisma.dailyKPIScore.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            department: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (dailyScores.length === 0) {
      res.json({
        success: true,
        data: {
          period: { month: monthNum, year: yearNum },
          workingDays,
          avgPointsRequired: 0,
          employees: [],
          employeeOfMonth: null,
          message: 'No daily KPI scores found for this period',
        },
      });
      return;
    }

    // Group scores by user and calculate totals
    const userScoresMap = new Map<string, { user: typeof dailyScores[0]['user']; scores: typeof dailyScores; totalPoints: number; daysScored: number }>();

    for (const score of dailyScores) {
      const userId = score.userId;
      if (!userScoresMap.has(userId)) {
        userScoresMap.set(userId, { user: score.user, scores: [], totalPoints: 0, daysScored: 0 });
      }
      const userData = userScoresMap.get(userId)!;
      userData.scores.push(score);
      userData.totalPoints += score.totalScore;
      userData.daysScored += 1;
    }

    // Calculate average score across all users
    const allTotals = Array.from(userScoresMap.values()).map(u => u.totalPoints);
    const avgScore = Math.round(allTotals.reduce((a, b) => a + b, 0) / allTotals.length * 10) / 10;

    // Build employee list
    const employees = Array.from(userScoresMap.values()).map(userData => {
      const avgPointPerDay = Math.round(userData.totalPoints / userData.daysScored * 10) / 10;
      const difference = Math.round((userData.totalPoints - avgScore) * 10) / 10;

      return {
        user: userData.user,
        points: userData.totalPoints,
        daysScored: userData.daysScored,
        avgPointPerDay,
        avgPoint: avgScore,
        difference,
        isEligible: difference >= 0,
      };
    }).sort((a, b) => b.points - a.points);

    // Employee of the Month: Highest total points among those with positive/zero difference
    const eligibleEmployees = employees.filter(e => e.isEligible);
    const employeeOfMonth = eligibleEmployees.length > 0 ? eligibleEmployees[0] : null;

    res.json({
      success: true,
      data: {
        period: { month: monthNum, year: yearNum },
        workingDays,
        avgPointsRequired: avgScore,
        employees,
        employeeOfMonth,
        stats: {
          totalEmployees: employees.length,
          eligibleCount: eligibleEmployees.length,
          ineligibleCount: employees.length - eligibleEmployees.length,
          highestScore: employees[0]?.points || 0,
          lowestScore: employees[employees.length - 1]?.points || 0,
        },
      },
    });
  } catch (error) {
    console.error('Get employee of month from daily error:', error);
    res.status(500).json({ success: false, error: 'Failed to get employee of month' });
  }
}

// Get team KPI for scoring (managers only)
export async function getTeamForScoring(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can access this' });
      return;
    }

    const { month, year } = req.query;

    const monthNum = parseInt(month as string) || new Date().getMonth() + 1;
    const yearNum = parseInt(year as string) || new Date().getFullYear();

    // Get all active users
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        role: true,
        department: { select: { id: true, name: true } },
      },
    });

    // Get existing KPI records for this period
    const existingRecords = await prisma.kPIRecord.findMany({
      where: {
        month: monthNum,
        year: yearNum,
      },
    });

    const recordMap = new Map(existingRecords.map(r => [r.userId, r]));

    // Get EODR summaries for each user
    const startOfMonth = new Date(yearNum, monthNum - 1, 1);
    const endOfMonth = new Date(yearNum, monthNum, 0);

    const eodrEntries = await prisma.eODREntry.groupBy({
      by: ['userId'],
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      _count: { id: true },
      _sum: { totalHours: true, tasksCompleted: true },
    });

    const eodrMap = new Map(eodrEntries.map(e => [e.userId, e]));

    // Build team list
    const workingDays = getWorkingDaysInMonth(yearNum, monthNum);

    const team = users.map(user => {
      const kpiRecord = recordMap.get(user.id);
      const eodrData = eodrMap.get(user.id);

      // Calculate suggested attendance from EODR
      const eodrDays = eodrData?._count?.id || 0;
      const suggestedAttendance = workingDays > 0 ? Math.round((eodrDays / workingDays) * 100) : 0;

      return {
        user,
        hasKPIRecord: !!kpiRecord,
        kpiRecord: kpiRecord ? {
          id: kpiRecord.id,
          attendance: kpiRecord.attendance,
          quality: kpiRecord.quality,
          behaviour: kpiRecord.behaviour,
          eodrScore: kpiRecord.eodrScore,
          totalScore: kpiRecord.totalScore,
        } : null,
        eodrStats: {
          daysSubmitted: eodrDays,
          totalHours: eodrData?._sum?.totalHours || 0,
          tasksCompleted: eodrData?._sum?.tasksCompleted || 0,
          suggestedAttendance,
        },
      };
    });

    res.json({
      success: true,
      data: {
        period: { month: monthNum, year: yearNum, workingDays },
        team,
        stats: {
          totalUsers: users.length,
          withKPIRecords: existingRecords.length,
          pendingScoring: users.length - existingRecords.length,
        },
      },
    });
  } catch (error) {
    console.error('Get team for scoring error:', error);
    res.status(500).json({ success: false, error: 'Failed to get team data' });
  }
}
