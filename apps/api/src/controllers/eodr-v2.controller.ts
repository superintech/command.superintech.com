import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { isManager, isAdmin } from '../middleware/rbac.js';

// Constants
const HOURS_PER_TASK = 3;
const DAILY_TASK_TARGET = 3;
const WEEKLY_TASK_TARGET = 15;

// Commission Tiers
interface CommissionTier {
  tier: 'PLATINUM' | 'GOLD' | 'SILVER' | 'BRONZE' | 'NONE';
  percent: number;
}

function getCommissionTier(completionPercent: number): CommissionTier {
  if (completionPercent >= 150) return { tier: 'PLATINUM', percent: 0.15 };
  if (completionPercent >= 120) return { tier: 'GOLD', percent: 0.10 };
  if (completionPercent >= 110) return { tier: 'SILVER', percent: 0.05 };
  if (completionPercent >= 100) return { tier: 'BRONZE', percent: 0.02 };
  return { tier: 'NONE', percent: 0 };
}

// Task detail structure
interface TaskDetail {
  taskName: string;
  timeSpent: number; // in hours
  status: string;
  taskId?: string;
  projectName?: string;
}

// Helper: Check if two dates are the same day
function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
}

// Helper: Calculate working days in a month
async function calculateWorkingDays(month: number, year: number): Promise<{ totalDays: number; halfDays: number }> {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  let halfDays = 0;

  // Get holidays for this month
  const holidays = await prisma.holiday.findMany({
    where: { year, month },
  });

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();

    // Skip weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    // Check holidays
    const holiday = holidays.find(h => isSameDay(new Date(h.date), date));
    if (holiday?.type === 'FULL') continue;
    if (holiday?.type === 'HALF') {
      halfDays += 1;
      continue;
    }

    workingDays += 1;
  }

  return { totalDays: workingDays, halfDays };
}

// Helper: Get week number
function getWeekNumber(date: Date): number {
  const firstDayOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const dayOfMonth = date.getDate();
  const firstDayOfWeek = firstDayOfMonth.getDay();

  return Math.ceil((dayOfMonth + firstDayOfWeek) / 7);
}

// ============ DAILY EODR ENDPOINTS ============

// Submit or update daily EODR
export async function submitDailyEODR(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const {
      date,
      tasksAssigned,
      tasksCompleted,
      taskDetails,
      secondaryTasks,
      employeeComments,
    } = req.body;

    const eodrDate = new Date(date);
    eodrDate.setHours(0, 0, 0, 0);

    // Calculate task equivalent from time entries
    const nextDay = new Date(eodrDate);
    nextDay.setDate(nextDay.getDate() + 1);

    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        userId: req.user!.id,
        startTime: { gte: eodrDate, lt: nextDay },
        endTime: { not: null },
      },
    });

    const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    const totalHoursLogged = Math.round((totalMinutes / 60) * 100) / 100;
    const taskEquivalent = Math.round((totalHoursLogged / HOURS_PER_TASK) * 100) / 100;

    // Check if it's a holiday or half day
    const holiday = await prisma.holiday.findFirst({
      where: {
        date: eodrDate,
      },
    });

    const isHalfDay = holiday?.type === 'HALF';
    const isHoliday = holiday?.type === 'FULL';

    // Upsert the daily EODR
    const entry = await prisma.dailyEODR.upsert({
      where: {
        userId_date: {
          userId: req.user!.id,
          date: eodrDate,
        },
      },
      update: {
        tasksAssigned: tasksAssigned ?? 0,
        tasksCompleted: tasksCompleted ?? 0,
        taskDetails: (taskDetails || []) as Prisma.InputJsonValue,
        secondaryTasks: secondaryTasks ? (secondaryTasks as Prisma.InputJsonValue) : undefined,
        finalCount: tasksCompleted ?? 0,
        totalHoursLogged,
        taskEquivalent,
        employeeComments: employeeComments || null,
        isHalfDay,
        isHoliday,
        status: 'PENDING', // Reset verification on update
        verifiedById: null,
        verifiedAt: null,
      },
      create: {
        userId: req.user!.id,
        date: eodrDate,
        tasksAssigned: tasksAssigned ?? 0,
        tasksCompleted: tasksCompleted ?? 0,
        taskDetails: (taskDetails || []) as Prisma.InputJsonValue,
        secondaryTasks: secondaryTasks ? (secondaryTasks as Prisma.InputJsonValue) : null,
        finalCount: tasksCompleted ?? 0,
        totalHoursLogged,
        taskEquivalent,
        employeeComments: employeeComments || null,
        isHalfDay,
        isHoliday,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('Submit daily EODR error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit daily EODR' });
  }
}

// Auto-populate from timer entries
export async function autoPopulateFromTimer(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { date } = req.body;

    const eodrDate = new Date(date);
    eodrDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(eodrDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get time entries for this date
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        userId: req.user!.id,
        startTime: { gte: eodrDate, lt: nextDay },
        endTime: { not: null },
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            status: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Group by task
    const taskMap = new Map<string, TaskDetail>();

    for (const entry of timeEntries) {
      if (entry.task) {
        const existing = taskMap.get(entry.task.id);
        const hours = (entry.duration || 0) / 60;

        if (existing) {
          existing.timeSpent += hours;
        } else {
          taskMap.set(entry.task.id, {
            taskId: entry.task.id,
            taskName: entry.task.title,
            timeSpent: hours,
            status: entry.task.status,
            projectName: entry.task.project?.name || 'No Project',
          });
        }
      }
    }

    const taskDetails: TaskDetail[] = Array.from(taskMap.values()).map(t => ({
      ...t,
      timeSpent: Math.round(t.timeSpent * 100) / 100,
    }));

    const totalHoursLogged = taskDetails.reduce((sum, t) => sum + t.timeSpent, 0);
    const tasksCompleted = taskDetails.filter(t => t.status === 'COMPLETED').length;
    const taskEquivalent = Math.round((totalHoursLogged / HOURS_PER_TASK) * 100) / 100;

    res.json({
      success: true,
      data: {
        date: eodrDate,
        taskDetails,
        totalHoursLogged: Math.round(totalHoursLogged * 100) / 100,
        tasksCompleted,
        taskEquivalent,
        tasksAssigned: taskDetails.length,
      },
    });
  } catch (error) {
    console.error('Auto-populate error:', error);
    res.status(500).json({ success: false, error: 'Failed to auto-populate from timer' });
  }
}

// Get daily EODR entries
export async function getDailyEntries(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId, date, startDate, endDate, month, year, status } = req.query;

    const where: Record<string, unknown> = {};

    // If not a manager, can only view their own entries
    if (!isManager(req)) {
      where.userId = req.user!.id;
    } else if (userId) {
      where.userId = userId as string;
    }

    // Filter by specific date
    if (date) {
      where.date = new Date(date as string);
    }

    // Filter by date range
    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // Filter by month and year
    if (month && year) {
      const monthNum = parseInt(month as string);
      const yearNum = parseInt(year as string);
      const startOfMonth = new Date(yearNum, monthNum - 1, 1);
      const endOfMonth = new Date(yearNum, monthNum, 0);
      where.date = {
        gte: startOfMonth,
        lte: endOfMonth,
      };
    }

    // Filter by status
    if (status) {
      where.status = status as string;
    }

    const entries = await prisma.dailyEODR.findMany({
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
        verifiedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json({ success: true, data: entries });
  } catch (error) {
    console.error('Get daily entries error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch daily entries' });
  }
}

// Manager edit daily EODR
export async function managerEditDaily(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can edit EODR entries' });
      return;
    }

    const { id } = req.params;
    const {
      tasksAssigned,
      tasksCompleted,
      finalCount,
      adjustedHours,
      managerRemarks,
      status,
    } = req.body;

    const existing = await prisma.dailyEODR.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Daily EODR not found' });
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (tasksAssigned !== undefined) updateData.tasksAssigned = tasksAssigned;
    if (tasksCompleted !== undefined) updateData.tasksCompleted = tasksCompleted;
    if (finalCount !== undefined) updateData.finalCount = finalCount;
    if (adjustedHours !== undefined) {
      updateData.adjustedHours = adjustedHours;
      // Recalculate task equivalent based on adjusted hours
      updateData.taskEquivalent = Math.round((adjustedHours / HOURS_PER_TASK) * 100) / 100;
    }
    if (managerRemarks !== undefined) updateData.managerRemarks = managerRemarks;

    // Handle status changes
    if (status === 'VERIFIED') {
      updateData.status = 'VERIFIED';
      updateData.verifiedById = req.user!.id;
      updateData.verifiedAt = new Date();
    } else if (status === 'REJECTED') {
      updateData.status = 'REJECTED';
      updateData.verifiedById = req.user!.id;
      updateData.verifiedAt = new Date();
    } else if (status === 'PENDING') {
      updateData.status = 'PENDING';
      updateData.verifiedById = null;
      updateData.verifiedAt = null;
    }

    const entry = await prisma.dailyEODR.update({
      where: { id },
      data: updateData,
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
        verifiedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('Manager edit daily error:', error);
    res.status(500).json({ success: false, error: 'Failed to update daily EODR' });
  }
}

// Bulk update daily EODR entries
export async function bulkUpdateDaily(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can bulk update' });
      return;
    }

    const { updates } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ success: false, error: 'Updates array is required' });
      return;
    }

    const results = [];

    for (const update of updates) {
      const { id, ...data } = update;

      if (!id) continue;

      const updateData: Record<string, unknown> = {};

      if (data.tasksAssigned !== undefined) updateData.tasksAssigned = data.tasksAssigned;
      if (data.tasksCompleted !== undefined) updateData.tasksCompleted = data.tasksCompleted;
      if (data.finalCount !== undefined) updateData.finalCount = data.finalCount;
      if (data.adjustedHours !== undefined) {
        updateData.adjustedHours = data.adjustedHours;
        updateData.taskEquivalent = Math.round((data.adjustedHours / HOURS_PER_TASK) * 100) / 100;
      }
      if (data.managerRemarks !== undefined) updateData.managerRemarks = data.managerRemarks;

      if (data.status === 'VERIFIED') {
        updateData.status = 'VERIFIED';
        updateData.verifiedById = req.user!.id;
        updateData.verifiedAt = new Date();
      }

      try {
        const result = await prisma.dailyEODR.update({
          where: { id },
          data: updateData,
        });
        results.push({ id, success: true, data: result });
      } catch (err) {
        results.push({ id, success: false, error: 'Failed to update' });
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('Bulk update daily error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk update' });
  }
}

// Get daily table data (Excel-like format)
export async function getDailyTableData(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { month, year } = req.params;
    const { userId } = req.query;

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || isNaN(yearNum)) {
      res.status(400).json({ success: false, error: 'Invalid month or year' });
      return;
    }

    const startOfMonth = new Date(yearNum, monthNum - 1, 1);
    const endOfMonth = new Date(yearNum, monthNum, 0);

    // Determine which users to query
    let userFilter: string | undefined;

    if (!isManager(req)) {
      userFilter = req.user!.id;
    } else if (userId) {
      userFilter = userId as string;
    }

    // Get all daily entries
    const entries = await prisma.dailyEODR.findMany({
      where: {
        ...(userFilter ? { userId: userFilter } : {}),
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
            department: { select: { id: true, name: true } },
          },
        },
        verifiedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ userId: 'asc' }, { date: 'asc' }],
    });

    // Get holidays for context
    const holidays = await prisma.holiday.findMany({
      where: { year: yearNum, month: monthNum },
    });

    // Calculate working days
    const { totalDays: workingDays, halfDays } = await calculateWorkingDays(monthNum, yearNum);

    res.json({
      success: true,
      data: {
        month: monthNum,
        year: yearNum,
        workingDays,
        halfDays,
        dailyTarget: DAILY_TASK_TARGET,
        entries,
        holidays,
      },
    });
  } catch (error) {
    console.error('Get daily table data error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch daily table data' });
  }
}

// ============ WEEKLY SUMMARY ENDPOINTS ============

// Calculate weekly summary
export async function calculateWeeklySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can calculate summaries' });
      return;
    }

    const { userId, weekNumber, month, year } = req.body;

    if (!userId || !weekNumber || !month || !year) {
      res.status(400).json({ success: false, error: 'userId, weekNumber, month, and year are required' });
      return;
    }

    // Calculate start and end dates for the week
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Find the dates that belong to this week
    const startDay = (weekNumber - 1) * 7 - firstDayOfMonth.getDay() + 1;
    const startDate = new Date(year, month - 1, Math.max(1, startDay));
    const endDate = new Date(year, month - 1, Math.min(daysInMonth, startDay + 6));

    // Get daily entries for this week
    const dailyEntries = await prisma.dailyEODR.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Calculate totals
    const tasksAssigned = dailyEntries.reduce((sum, e) => sum + e.tasksAssigned, 0);
    const tasksCompleted = dailyEntries.reduce((sum, e) => sum + (e.adjustedHours ? e.taskEquivalent : e.tasksCompleted), 0);

    // Calculate adjusted target based on working days in the week
    let workingDaysInWeek = 0;
    let halfDaysInWeek = 0;

    const holidays = await prisma.holiday.findMany({
      where: { year, month },
    });

    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const holiday = holidays.find(h => isSameDay(new Date(h.date), d));
      if (holiday?.type === 'FULL') continue;
      if (holiday?.type === 'HALF') {
        halfDaysInWeek++;
        continue;
      }
      workingDaysInWeek++;
    }

    const adjustedTarget = (workingDaysInWeek * DAILY_TASK_TARGET) + (halfDaysInWeek * DAILY_TASK_TARGET * 0.5);
    const completionRate = adjustedTarget > 0 ? Math.round((tasksCompleted / adjustedTarget) * 100 * 100) / 100 : 0;

    // Upsert weekly summary
    const summary = await prisma.weeklyEODRSummary.upsert({
      where: {
        userId_weekNumber_month_year: {
          userId,
          weekNumber,
          month,
          year,
        },
      },
      update: {
        startDate,
        endDate,
        tasksAssigned,
        tasksCompleted,
        weeklyTarget: WEEKLY_TASK_TARGET,
        adjustedTarget,
        completionRate,
      },
      create: {
        userId,
        weekNumber,
        month,
        year,
        startDate,
        endDate,
        tasksAssigned,
        tasksCompleted,
        weeklyTarget: WEEKLY_TASK_TARGET,
        adjustedTarget,
        completionRate,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Calculate weekly summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate weekly summary' });
  }
}

// Get weekly table data
export async function getWeeklyTableData(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { month, year } = req.params;
    const { userId } = req.query;

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || isNaN(yearNum)) {
      res.status(400).json({ success: false, error: 'Invalid month or year' });
      return;
    }

    let userFilter: string | undefined;

    if (!isManager(req)) {
      userFilter = req.user!.id;
    } else if (userId) {
      userFilter = userId as string;
    }

    const summaries = await prisma.weeklyEODRSummary.findMany({
      where: {
        ...(userFilter ? { userId: userFilter } : {}),
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
            department: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ userId: 'asc' }, { weekNumber: 'asc' }],
    });

    res.json({
      success: true,
      data: {
        month: monthNum,
        year: yearNum,
        weeklyTarget: WEEKLY_TASK_TARGET,
        summaries,
      },
    });
  } catch (error) {
    console.error('Get weekly table data error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch weekly table data' });
  }
}

// ============ MONTHLY SUMMARY ENDPOINTS ============

// Calculate monthly summary with commission
export async function calculateMonthlySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can calculate summaries' });
      return;
    }

    const { userId, month, year } = req.body;

    if (!userId || !month || !year) {
      res.status(400).json({ success: false, error: 'userId, month, and year are required' });
      return;
    }

    // Check if already finalized
    const existingSummary = await prisma.monthlyEODRSummary.findUnique({
      where: {
        userId_month_year: { userId, month, year },
      },
    });

    if (existingSummary?.isFinalized) {
      res.status(400).json({ success: false, error: 'Monthly summary is already finalized' });
      return;
    }

    // Calculate working days
    const { totalDays: workingDays, halfDays } = await calculateWorkingDays(month, year);
    const effectiveWorkingDays = workingDays + (halfDays * 0.5);
    const taskTarget = effectiveWorkingDays * DAILY_TASK_TARGET;

    // Get all daily entries for the month
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);

    const dailyEntries = await prisma.dailyEODR.findMany({
      where: {
        userId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Calculate totals - use adjusted hours if available, otherwise use logged hours
    const totalHoursLogged = dailyEntries.reduce((sum, e) => sum + (e.adjustedHours ?? e.totalHoursLogged), 0);
    const taskEquivalent = Math.round((totalHoursLogged / HOURS_PER_TASK) * 100) / 100;

    // Tasks completed is the task equivalent (hours / 3)
    const tasksCompleted = taskEquivalent;
    const completionPercent = taskTarget > 0 ? Math.round((tasksCompleted / taskTarget) * 100 * 100) / 100 : 0;

    // Get commission tier
    const { tier: commissionTier, percent: commissionPercent } = getCommissionTier(completionPercent);

    // Upsert monthly summary
    const summary = await prisma.monthlyEODRSummary.upsert({
      where: {
        userId_month_year: { userId, month, year },
      },
      update: {
        totalWorkingDays: Math.round(effectiveWorkingDays),
        taskTarget,
        tasksCompleted,
        totalHoursLogged: Math.round(totalHoursLogged * 100) / 100,
        completionPercent,
        taskEquivalent,
        commissionTier,
        commissionPercent,
      },
      create: {
        userId,
        month,
        year,
        totalWorkingDays: Math.round(effectiveWorkingDays),
        taskTarget,
        tasksCompleted,
        totalHoursLogged: Math.round(totalHoursLogged * 100) / 100,
        completionPercent,
        taskEquivalent,
        commissionTier,
        commissionPercent,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
      },
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Calculate monthly summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to calculate monthly summary' });
  }
}

// Bulk calculate monthly summary for all users
export async function bulkCalculateMonthlySummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can calculate summaries' });
      return;
    }

    const { month, year } = req.body;

    if (!month || !year) {
      res.status(400).json({ success: false, error: 'month and year are required' });
      return;
    }

    // Get all active users
    const users = await prisma.user.findMany({
      where: { isActive: true, role: 'EMPLOYEE' },
      select: { id: true },
    });

    const results = [];

    for (const user of users) {
      try {
        // Check if already finalized
        const existingSummary = await prisma.monthlyEODRSummary.findUnique({
          where: {
            userId_month_year: { userId: user.id, month, year },
          },
        });

        if (existingSummary?.isFinalized) {
          results.push({ userId: user.id, success: true, skipped: true, reason: 'Already finalized' });
          continue;
        }

        // Calculate working days
        const { totalDays: workingDays, halfDays } = await calculateWorkingDays(month, year);
        const effectiveWorkingDays = workingDays + (halfDays * 0.5);
        const taskTarget = effectiveWorkingDays * DAILY_TASK_TARGET;

        // Get daily entries
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);

        const dailyEntries = await prisma.dailyEODR.findMany({
          where: {
            userId: user.id,
            date: { gte: startOfMonth, lte: endOfMonth },
          },
        });

        const totalHoursLogged = dailyEntries.reduce((sum, e) => sum + (e.adjustedHours ?? e.totalHoursLogged), 0);
        const taskEquivalent = Math.round((totalHoursLogged / HOURS_PER_TASK) * 100) / 100;
        const tasksCompleted = taskEquivalent;
        const completionPercent = taskTarget > 0 ? Math.round((tasksCompleted / taskTarget) * 100 * 100) / 100 : 0;
        const { tier: commissionTier, percent: commissionPercent } = getCommissionTier(completionPercent);

        await prisma.monthlyEODRSummary.upsert({
          where: {
            userId_month_year: { userId: user.id, month, year },
          },
          update: {
            totalWorkingDays: Math.round(effectiveWorkingDays),
            taskTarget,
            tasksCompleted,
            totalHoursLogged: Math.round(totalHoursLogged * 100) / 100,
            completionPercent,
            taskEquivalent,
            commissionTier,
            commissionPercent,
          },
          create: {
            userId: user.id,
            month,
            year,
            totalWorkingDays: Math.round(effectiveWorkingDays),
            taskTarget,
            tasksCompleted,
            totalHoursLogged: Math.round(totalHoursLogged * 100) / 100,
            completionPercent,
            taskEquivalent,
            commissionTier,
            commissionPercent,
          },
        });

        results.push({ userId: user.id, success: true });
      } catch (err) {
        results.push({ userId: user.id, success: false, error: 'Failed to calculate' });
      }
    }

    res.json({
      success: true,
      data: {
        total: users.length,
        calculated: results.filter(r => r.success && !r.skipped).length,
        skipped: results.filter(r => r.skipped).length,
        failed: results.filter(r => !r.success).length,
        results,
      },
    });
  } catch (error) {
    console.error('Bulk calculate monthly summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to bulk calculate' });
  }
}

// Finalize monthly summary (lock for edits)
export async function finalizeMonthly(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can finalize summaries' });
      return;
    }

    const { userId, month, year } = req.body;

    if (!userId || !month || !year) {
      res.status(400).json({ success: false, error: 'userId, month, and year are required' });
      return;
    }

    const existing = await prisma.monthlyEODRSummary.findUnique({
      where: {
        userId_month_year: { userId, month, year },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Monthly summary not found. Calculate first.' });
      return;
    }

    if (existing.isFinalized) {
      res.status(400).json({ success: false, error: 'Monthly summary is already finalized' });
      return;
    }

    const summary = await prisma.monthlyEODRSummary.update({
      where: {
        userId_month_year: { userId, month, year },
      },
      data: {
        isFinalized: true,
        finalizedById: req.user!.id,
        finalizedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        finalizedBy: {
          select: { id: true, name: true },
        },
      },
    });

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error('Finalize monthly error:', error);
    res.status(500).json({ success: false, error: 'Failed to finalize monthly summary' });
  }
}

// Get monthly table data
export async function getMonthlyTableData(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { year } = req.params;
    const { month, userId } = req.query;

    const yearNum = parseInt(year);

    if (isNaN(yearNum)) {
      res.status(400).json({ success: false, error: 'Invalid year' });
      return;
    }

    let userFilter: string | undefined;

    if (!isManager(req)) {
      userFilter = req.user!.id;
    } else if (userId) {
      userFilter = userId as string;
    }

    const where: Record<string, unknown> = {
      year: yearNum,
    };

    if (month) {
      where.month = parseInt(month as string);
    }

    if (userFilter) {
      where.userId = userFilter;
    }

    const summaries = await prisma.monthlyEODRSummary.findMany({
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
        finalizedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ month: 'asc' }, { user: { name: 'asc' } }],
    });

    // Commission tier stats
    const tierStats = {
      PLATINUM: summaries.filter(s => s.commissionTier === 'PLATINUM').length,
      GOLD: summaries.filter(s => s.commissionTier === 'GOLD').length,
      SILVER: summaries.filter(s => s.commissionTier === 'SILVER').length,
      BRONZE: summaries.filter(s => s.commissionTier === 'BRONZE').length,
      NONE: summaries.filter(s => s.commissionTier === 'NONE').length,
    };

    res.json({
      success: true,
      data: {
        year: yearNum,
        month: month ? parseInt(month as string) : null,
        summaries,
        tierStats,
        commissionTiers: {
          PLATINUM: { minPercent: 150, bonus: 0.15 },
          GOLD: { minPercent: 120, bonus: 0.10 },
          SILVER: { minPercent: 110, bonus: 0.05 },
          BRONZE: { minPercent: 100, bonus: 0.02 },
          NONE: { minPercent: 0, bonus: 0 },
        },
      },
    });
  } catch (error) {
    console.error('Get monthly table data error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch monthly table data' });
  }
}

// Get commission dashboard (for employees to view their own)
export async function getCommissionDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { year } = req.query;

    const yearNum = year ? parseInt(year as string) : new Date().getFullYear();

    // Get all monthly summaries for the user
    const summaries = await prisma.monthlyEODRSummary.findMany({
      where: {
        userId: req.user!.id,
        year: yearNum,
      },
      orderBy: { month: 'asc' },
    });

    // Get current month's daily entries
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const startOfMonth = new Date(yearNum, currentMonth - 1, 1);
    const endOfMonth = new Date(yearNum, currentMonth, 0);

    const dailyEntries = await prisma.dailyEODR.findMany({
      where: {
        userId: req.user!.id,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Calculate current progress
    const { totalDays: workingDays, halfDays } = await calculateWorkingDays(currentMonth, yearNum);
    const effectiveWorkingDays = workingDays + (halfDays * 0.5);
    const taskTarget = effectiveWorkingDays * DAILY_TASK_TARGET;

    const totalHoursLogged = dailyEntries.reduce((sum, e) => sum + (e.adjustedHours ?? e.totalHoursLogged), 0);
    const taskEquivalent = totalHoursLogged / HOURS_PER_TASK;
    const currentCompletion = taskTarget > 0 ? (taskEquivalent / taskTarget) * 100 : 0;
    const projectedTier = getCommissionTier(currentCompletion);

    res.json({
      success: true,
      data: {
        year: yearNum,
        monthlySummaries: summaries,
        currentMonth: {
          month: currentMonth,
          workingDays: Math.round(effectiveWorkingDays),
          taskTarget,
          hoursLogged: Math.round(totalHoursLogged * 100) / 100,
          taskEquivalent: Math.round(taskEquivalent * 100) / 100,
          completionPercent: Math.round(currentCompletion * 100) / 100,
          projectedTier: projectedTier.tier,
          projectedBonus: projectedTier.percent,
          daysTracked: dailyEntries.length,
        },
        commissionTiers: {
          PLATINUM: { minPercent: 150, bonus: 0.15 },
          GOLD: { minPercent: 120, bonus: 0.10 },
          SILVER: { minPercent: 110, bonus: 0.05 },
          BRONZE: { minPercent: 100, bonus: 0.02 },
          NONE: { minPercent: 0, bonus: 0 },
        },
      },
    });
  } catch (error) {
    console.error('Get commission dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch commission dashboard' });
  }
}

// Export data (Excel format data)
export async function exportData(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { type, month, year, userId } = req.query;

    const yearNum = parseInt(year as string);
    const monthNum = month ? parseInt(month as string) : undefined;

    // Check permissions
    let userFilter: string | undefined;
    if (!isManager(req)) {
      userFilter = req.user!.id;
    } else if (userId) {
      userFilter = userId as string;
    }

    let data: unknown;

    switch (type) {
      case 'daily': {
        const startOfMonth = new Date(yearNum, (monthNum || 1) - 1, 1);
        const endOfMonth = new Date(yearNum, monthNum || 12, 0);

        const entries = await prisma.dailyEODR.findMany({
          where: {
            ...(userFilter ? { userId: userFilter } : {}),
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: [{ user: { name: 'asc' } }, { date: 'asc' }],
        });

        data = entries.map(e => ({
          Employee: e.user.name,
          Email: e.user.email,
          Date: e.date.toISOString().split('T')[0],
          'Tasks Assigned': e.tasksAssigned,
          'Tasks Completed': e.tasksCompleted,
          'Hours Logged': e.totalHoursLogged,
          'Adjusted Hours': e.adjustedHours ?? '',
          'Task Equivalent': e.taskEquivalent,
          Status: e.status,
          'Employee Comments': e.employeeComments ?? '',
          'Manager Remarks': e.managerRemarks ?? '',
        }));
        break;
      }

      case 'weekly': {
        const summaries = await prisma.weeklyEODRSummary.findMany({
          where: {
            ...(userFilter ? { userId: userFilter } : {}),
            year: yearNum,
            ...(monthNum ? { month: monthNum } : {}),
          },
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: [{ user: { name: 'asc' } }, { month: 'asc' }, { weekNumber: 'asc' }],
        });

        data = summaries.map(s => ({
          Employee: s.user.name,
          Email: s.user.email,
          Month: s.month,
          Week: s.weekNumber,
          'Start Date': s.startDate.toISOString().split('T')[0],
          'End Date': s.endDate.toISOString().split('T')[0],
          'Tasks Assigned': s.tasksAssigned,
          'Tasks Completed': s.tasksCompleted,
          Target: s.adjustedTarget ?? s.weeklyTarget,
          'Completion Rate': `${s.completionRate}%`,
        }));
        break;
      }

      case 'monthly': {
        const summaries = await prisma.monthlyEODRSummary.findMany({
          where: {
            ...(userFilter ? { userId: userFilter } : {}),
            year: yearNum,
            ...(monthNum ? { month: monthNum } : {}),
          },
          include: {
            user: { select: { name: true, email: true } },
          },
          orderBy: [{ user: { name: 'asc' } }, { month: 'asc' }],
        });

        data = summaries.map(s => ({
          Employee: s.user.name,
          Email: s.user.email,
          Month: s.month,
          Year: s.year,
          'Working Days': s.totalWorkingDays,
          'Task Target': s.taskTarget,
          'Tasks Completed': s.tasksCompleted,
          'Hours Logged': s.totalHoursLogged,
          'Completion %': `${s.completionPercent}%`,
          'Commission Tier': s.commissionTier,
          'Commission %': `${(s.commissionPercent * 100).toFixed(0)}%`,
          Finalized: s.isFinalized ? 'Yes' : 'No',
        }));
        break;
      }

      default:
        res.status(400).json({ success: false, error: 'Invalid export type' });
        return;
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Export data error:', error);
    res.status(500).json({ success: false, error: 'Failed to export data' });
  }
}
