import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { isAdmin } from '../middleware/rbac.js';

// List holidays with optional year/month filters
export async function listHolidays(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { year, month } = req.query;

    const where: Record<string, unknown> = {};

    if (year) {
      where.year = parseInt(year as string);
    }

    if (month) {
      where.month = parseInt(month as string);
    }

    const holidays = await prisma.holiday.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json({ success: true, data: holidays });
  } catch (error) {
    console.error('List holidays error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch holidays' });
  }
}

// Get holidays for a specific year and month
export async function getHolidaysByMonth(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { year, month } = req.params;

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      res.status(400).json({ success: false, error: 'Invalid year or month' });
      return;
    }

    const holidays = await prisma.holiday.findMany({
      where: {
        year: yearNum,
        month: monthNum,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { date: 'asc' },
    });

    res.json({ success: true, data: holidays });
  } catch (error) {
    console.error('Get holidays by month error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch holidays' });
  }
}

// Create a new holiday (Admin only)
export async function createHoliday(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isAdmin(req)) {
      res.status(403).json({ success: false, error: 'Only admins can create holidays' });
      return;
    }

    const { date, name, type } = req.body;

    if (!date || !name) {
      res.status(400).json({ success: false, error: 'Date and name are required' });
      return;
    }

    const holidayDate = new Date(date);
    holidayDate.setHours(0, 0, 0, 0);

    // Validate type
    const holidayType = type === 'HALF' ? 'HALF' : 'FULL';

    // Check if holiday already exists for this date
    const existing = await prisma.holiday.findUnique({
      where: { date: holidayDate },
    });

    if (existing) {
      res.status(400).json({ success: false, error: 'A holiday already exists for this date' });
      return;
    }

    const holiday = await prisma.holiday.create({
      data: {
        date: holidayDate,
        name,
        type: holidayType,
        year: holidayDate.getFullYear(),
        month: holidayDate.getMonth() + 1,
        createdById: req.user!.id,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json({ success: true, data: holiday });
  } catch (error) {
    console.error('Create holiday error:', error);
    res.status(500).json({ success: false, error: 'Failed to create holiday' });
  }
}

// Update a holiday (Admin only)
export async function updateHoliday(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isAdmin(req)) {
      res.status(403).json({ success: false, error: 'Only admins can update holidays' });
      return;
    }

    const { id } = req.params;
    const { date, name, type } = req.body;

    const existing = await prisma.holiday.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Holiday not found' });
      return;
    }

    const updateData: Record<string, unknown> = {};

    if (date) {
      const holidayDate = new Date(date);
      holidayDate.setHours(0, 0, 0, 0);

      // Check if new date conflicts with another holiday
      const conflict = await prisma.holiday.findFirst({
        where: {
          date: holidayDate,
          id: { not: id },
        },
      });

      if (conflict) {
        res.status(400).json({ success: false, error: 'A holiday already exists for this date' });
        return;
      }

      updateData.date = holidayDate;
      updateData.year = holidayDate.getFullYear();
      updateData.month = holidayDate.getMonth() + 1;
    }

    if (name) {
      updateData.name = name;
    }

    if (type) {
      updateData.type = type === 'HALF' ? 'HALF' : 'FULL';
    }

    const holiday = await prisma.holiday.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ success: true, data: holiday });
  } catch (error) {
    console.error('Update holiday error:', error);
    res.status(500).json({ success: false, error: 'Failed to update holiday' });
  }
}

// Delete a holiday (Admin only)
export async function deleteHoliday(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isAdmin(req)) {
      res.status(403).json({ success: false, error: 'Only admins can delete holidays' });
      return;
    }

    const { id } = req.params;

    const existing = await prisma.holiday.findUnique({ where: { id } });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Holiday not found' });
      return;
    }

    await prisma.holiday.delete({ where: { id } });

    res.json({ success: true, message: 'Holiday deleted successfully' });
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete holiday' });
  }
}

// Bulk create holidays (Admin only)
export async function bulkCreateHolidays(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (!isAdmin(req)) {
      res.status(403).json({ success: false, error: 'Only admins can create holidays' });
      return;
    }

    const { holidays } = req.body;

    if (!Array.isArray(holidays) || holidays.length === 0) {
      res.status(400).json({ success: false, error: 'Holidays array is required' });
      return;
    }

    const createdHolidays = [];
    const errors = [];

    for (const h of holidays) {
      try {
        const holidayDate = new Date(h.date);
        holidayDate.setHours(0, 0, 0, 0);

        const holiday = await prisma.holiday.upsert({
          where: { date: holidayDate },
          update: {
            name: h.name,
            type: h.type === 'HALF' ? 'HALF' : 'FULL',
          },
          create: {
            date: holidayDate,
            name: h.name,
            type: h.type === 'HALF' ? 'HALF' : 'FULL',
            year: holidayDate.getFullYear(),
            month: holidayDate.getMonth() + 1,
            createdById: req.user!.id,
          },
        });

        createdHolidays.push(holiday);
      } catch (err) {
        errors.push({ date: h.date, error: 'Failed to create' });
      }
    }

    res.json({
      success: true,
      data: {
        created: createdHolidays.length,
        errors: errors.length > 0 ? errors : undefined,
        holidays: createdHolidays,
      },
    });
  } catch (error) {
    console.error('Bulk create holidays error:', error);
    res.status(500).json({ success: false, error: 'Failed to create holidays' });
  }
}
