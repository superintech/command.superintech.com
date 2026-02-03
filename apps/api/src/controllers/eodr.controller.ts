import { Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { isManager } from '../middleware/rbac.js';

// Detailed task structure for EODR
interface EODRTaskDetail {
  taskId?: string;
  title: string;
  description: string; // What was the task - clear description
  completedAt?: string; // When completed - timestamp
  filesLocation?: string; // Files/Documents - location of assets
  pendingItems?: string; // What's pending - outstanding items
  projectName: string;
  hours: number;
  status: string;
}

// Get EODR entries
export async function getEODREntries(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId, date, startDate, endDate, month, year, unverifiedOnly } = req.query;

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

    // Filter unverified only (for manager review)
    if (unverifiedOnly === 'true') {
      where.isVerified = false;
    }

    const entries = await prisma.eODREntry.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true, department: { select: { id: true, name: true } } },
        },
        verifiedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json({ success: true, data: entries });
  } catch (error) {
    console.error('Get EODR entries error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch EODR entries' });
  }
}

// Get single EODR entry
export async function getEODREntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const entry = await prisma.eODREntry.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true, department: { select: { id: true, name: true } } },
        },
        verifiedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    if (!entry) {
      res.status(404).json({ success: false, error: 'EODR entry not found' });
      return;
    }

    // Check access
    if (!isManager(req) && entry.userId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('Get EODR entry error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch EODR entry' });
  }
}

// Create or update EODR entry (employee submission with detailed task info)
export async function createEODREntry(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { date, tasks, totalHours, tasksCompleted, notes } = req.body;

    const entryDate = new Date(date);
    entryDate.setHours(0, 0, 0, 0);

    // Validate tasks have required detailed fields
    const detailedTasks: EODRTaskDetail[] = (tasks || []).map((task: Partial<EODRTaskDetail>) => ({
      taskId: task.taskId || '',
      title: task.title || '',
      description: task.description || '', // What was the task
      completedAt: task.completedAt || new Date().toISOString(), // When completed
      filesLocation: task.filesLocation || '', // Files/Documents location
      pendingItems: task.pendingItems || '', // What's pending
      projectName: task.projectName || 'No Project',
      hours: task.hours || 0,
      status: task.status || 'IN_PROGRESS',
    }));

    // Check if entry already exists for this date
    const existing = await prisma.eODREntry.findUnique({
      where: {
        userId_date: {
          userId: req.user!.id,
          date: entryDate,
        },
      },
    });

    let entry;
    if (existing) {
      // Update existing entry (reset verification if employee updates)
      entry = await prisma.eODREntry.update({
        where: { id: existing.id },
        data: {
          tasks: detailedTasks as unknown as Prisma.InputJsonValue,
          totalHours: totalHours ?? existing.totalHours,
          tasksCompleted: tasksCompleted ?? existing.tasksCompleted,
          notes: notes || existing.notes,
          isVerified: false, // Reset verification when employee updates
          verifiedById: null,
          verifiedAt: null,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          verifiedBy: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });
    } else {
      // Create new entry
      entry = await prisma.eODREntry.create({
        data: {
          userId: req.user!.id,
          date: entryDate,
          tasks: detailedTasks as unknown as Prisma.InputJsonValue,
          totalHours: totalHours || 0,
          tasksCompleted: tasksCompleted || 0,
          notes: notes || null,
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatar: true },
          },
          verifiedBy: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });
    }

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('Create EODR entry error:', error);
    res.status(500).json({ success: false, error: 'Failed to create EODR entry' });
  }
}

// Manager update EODR entry (adjust hours, verify, add notes)
export async function managerUpdateEODR(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can update EODR entries' });
      return;
    }

    const { id } = req.params;
    const { adjustedHours, managerNotes, isVerified } = req.body;

    const existing = await prisma.eODREntry.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'EODR entry not found' });
      return;
    }

    const updateData: Record<string, unknown> = {};

    // Adjust hours if provided
    if (adjustedHours !== undefined) {
      updateData.adjustedHours = adjustedHours;
    }

    // Add manager notes
    if (managerNotes !== undefined) {
      updateData.managerNotes = managerNotes;
    }

    // Verify the entry
    if (isVerified === true) {
      updateData.isVerified = true;
      updateData.verifiedById = req.user!.id;
      updateData.verifiedAt = new Date();
    } else if (isVerified === false) {
      updateData.isVerified = false;
      updateData.verifiedById = null;
      updateData.verifiedAt = null;
    }

    const entry = await prisma.eODREntry.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true, department: { select: { id: true, name: true } } },
        },
        verifiedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('Manager update EODR error:', error);
    res.status(500).json({ success: false, error: 'Failed to update EODR entry' });
  }
}

// Bulk verify EODR entries (for managers)
export async function bulkVerifyEODR(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can verify EODR entries' });
      return;
    }

    const { entryIds, managerNotes } = req.body;

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      res.status(400).json({ success: false, error: 'Entry IDs required' });
      return;
    }

    await prisma.eODREntry.updateMany({
      where: {
        id: { in: entryIds },
      },
      data: {
        isVerified: true,
        verifiedById: req.user!.id,
        verifiedAt: new Date(),
        managerNotes: managerNotes || null,
      },
    });

    res.json({ success: true, message: `${entryIds.length} entries verified` });
  } catch (error) {
    console.error('Bulk verify EODR error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify entries' });
  }
}

// Auto-generate EODR from time entries for a specific date
export async function generateEODR(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { date } = req.body;
    const userId = req.user!.id;

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Get all time entries for this user on this date
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        userId,
        startTime: {
          gte: targetDate,
          lt: nextDay,
        },
        endTime: { not: null },
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { endTime: 'desc' },
    });

    // Calculate totals
    const totalMinutes = timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

    // Build detailed tasks summary
    const taskMap = new Map<string, EODRTaskDetail>();

    for (const entry of timeEntries) {
      if (entry.task) {
        const existing = taskMap.get(entry.task.id);
        if (existing) {
          existing.hours += (entry.duration || 0) / 60;
        } else {
          taskMap.set(entry.task.id, {
            taskId: entry.task.id,
            title: entry.task.title,
            description: entry.task.description || entry.task.title,
            completedAt: entry.endTime?.toISOString() || new Date().toISOString(),
            filesLocation: '', // To be filled by employee
            pendingItems: entry.task.status !== 'COMPLETED' ? 'Task still in progress' : '',
            projectName: entry.task.project?.name || 'No Project',
            hours: (entry.duration || 0) / 60,
            status: entry.task.status,
          });
        }
      }
    }

    const tasks: EODRTaskDetail[] = Array.from(taskMap.values()).map(t => ({
      ...t,
      hours: Math.round(t.hours * 100) / 100,
    }));

    // Count completed tasks for this date
    const completedTasksCount = tasks.filter(t => t.status === 'COMPLETED').length;

    // Create or update EODR entry
    const entry = await prisma.eODREntry.upsert({
      where: {
        userId_date: {
          userId,
          date: targetDate,
        },
      },
      update: {
        tasks: tasks as unknown as Prisma.InputJsonValue,
        totalHours,
        tasksCompleted: completedTasksCount,
        // Don't reset verification if manager already verified
      },
      create: {
        userId,
        date: targetDate,
        tasks: tasks as unknown as Prisma.InputJsonValue,
        totalHours,
        tasksCompleted: completedTasksCount,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        verifiedBy: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('Generate EODR error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate EODR' });
  }
}

// Get EODR summary for a user (for KPI calculation)
export async function getEODRSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { userId, month, year } = req.query;

    const targetUserId = isManager(req) && userId ? (userId as string) : req.user!.id;
    const monthNum = parseInt(month as string);
    const yearNum = parseInt(year as string);

    const startOfMonth = new Date(yearNum, monthNum - 1, 1);
    const endOfMonth = new Date(yearNum, monthNum, 0);

    // Get all EODR entries for this month
    const entries = await prisma.eODREntry.findMany({
      where: {
        userId: targetUserId,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Calculate statistics - use adjusted hours if available
    const totalDays = entries.length;
    const totalHours = entries.reduce((sum, e) => sum + (e.adjustedHours ?? e.totalHours), 0);
    const totalTasksCompleted = entries.reduce((sum, e) => sum + e.tasksCompleted, 0);
    const avgHoursPerDay = totalDays > 0 ? Math.round((totalHours / totalDays) * 100) / 100 : 0;

    // Count verified entries
    const verifiedEntries = entries.filter(e => e.isVerified).length;

    // Calculate working days in month (Mon-Fri)
    let workingDays = 0;
    const current = new Date(startOfMonth);
    while (current <= endOfMonth) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) workingDays++;
      current.setDate(current.getDate() + 1);
    }

    // Attendance rate
    const attendanceRate = workingDays > 0 ? Math.round((totalDays / workingDays) * 100) : 0;

    // EODR score (based on completion and hours)
    const hourScore = Math.min(avgHoursPerDay / 8, 1) * 30;
    const attendanceScore = (attendanceRate / 100) * 50;
    const taskScore = Math.min(totalTasksCompleted / (totalDays * 3), 1) * 20;
    const eodrScore = Math.round(hourScore + attendanceScore + taskScore);

    res.json({
      success: true,
      data: {
        userId: targetUserId,
        month: monthNum,
        year: yearNum,
        totalDays,
        workingDays,
        totalHours,
        avgHoursPerDay,
        totalTasksCompleted,
        attendanceRate,
        eodrScore,
        verifiedEntries,
        unverifiedEntries: totalDays - verifiedEntries,
      },
    });
  } catch (error) {
    console.error('Get EODR summary error:', error);
    res.status(500).json({ success: false, error: 'Failed to get EODR summary' });
  }
}

// Get today's EODR preview (from time entries)
export async function getTodayPreview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get time entries for today
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        userId,
        startTime: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            projectId: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
    });

    // Calculate totals
    const completedEntries = timeEntries.filter(e => e.endTime !== null);
    const totalMinutes = completedEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

    // Check for active timer
    const activeTimer = timeEntries.find(e => e.endTime === null);

    // Build tasks with taskId and projectId
    const taskMap = new Map<string, { taskId: string; projectId: string; title: string; description: string; projectName: string; minutes: number; status: string }>();
    for (const entry of completedEntries) {
      if (entry.task) {
        const existing = taskMap.get(entry.task.id);
        if (existing) {
          existing.minutes += entry.duration || 0;
        } else {
          taskMap.set(entry.task.id, {
            taskId: entry.task.id,
            projectId: entry.task.projectId || '',
            title: entry.task.title,
            description: entry.task.description || entry.task.title,
            projectName: entry.task.project?.name || 'No Project',
            minutes: entry.duration || 0,
            status: entry.task.status,
          });
        }
      }
    }

    const tasks = Array.from(taskMap.values()).map(t => ({
      taskId: t.taskId,
      projectId: t.projectId,
      title: t.title,
      description: t.description,
      projectName: t.projectName,
      hours: Math.round((t.minutes / 60) * 100) / 100,
      status: t.status,
    }));

    // Check if EODR already submitted for today
    const existingEodr = await prisma.eODREntry.findUnique({
      where: {
        userId_date: {
          userId,
          date: today,
        },
      },
      select: { id: true, isVerified: true, notes: true },
    });

    res.json({
      success: true,
      data: {
        date: today,
        totalHours,
        tasksCompleted: tasks.filter(t => t.status === 'COMPLETED').length,
        tasks,
        hasActiveTimer: !!activeTimer,
        activeTaskTitle: activeTimer?.task?.title || null,
        hasSubmittedEodr: !!existingEodr,
        eodrId: existingEodr?.id || null,
        isVerified: existingEodr?.isVerified || false,
      },
    });
  } catch (error) {
    console.error('Get today preview error:', error);
    res.status(500).json({ success: false, error: 'Failed to get today preview' });
  }
}

// Get team EODR overview for managers
export async function getTeamEODROverview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isManager(req)) {
      res.status(403).json({ success: false, error: 'Only managers can view team overview' });
      return;
    }

    const { date } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    // Get all users
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        department: { select: { id: true, name: true } },
      },
    });

    // Get EODR entries for this date
    const entries = await prisma.eODREntry.findMany({
      where: {
        date: targetDate,
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
        verifiedBy: {
          select: { id: true, name: true },
        },
      },
    });

    // Build overview
    const entryMap = new Map(entries.map(e => [e.userId, e]));

    const overview = users.map(user => {
      const entry = entryMap.get(user.id);
      return {
        user,
        hasSubmitted: !!entry,
        entry: entry ? {
          id: entry.id,
          totalHours: entry.totalHours,
          adjustedHours: entry.adjustedHours,
          tasksCompleted: entry.tasksCompleted,
          isVerified: entry.isVerified,
          verifiedBy: entry.verifiedBy,
          notes: entry.notes,
          managerNotes: entry.managerNotes,
        } : null,
      };
    });

    const stats = {
      totalUsers: users.length,
      submitted: entries.length,
      notSubmitted: users.length - entries.length,
      verified: entries.filter(e => e.isVerified).length,
      pendingVerification: entries.filter(e => !e.isVerified).length,
    };

    res.json({
      success: true,
      data: {
        date: targetDate,
        stats,
        overview,
      },
    });
  } catch (error) {
    console.error('Get team EODR overview error:', error);
    res.status(500).json({ success: false, error: 'Failed to get team overview' });
  }
}
