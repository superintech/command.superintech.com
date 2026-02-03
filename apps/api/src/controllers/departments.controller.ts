import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export async function getDepartments(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const departments = await prisma.department.findMany({
      include: {
        _count: {
          select: { users: true, projects: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: departments });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch departments' });
  }
}

export async function getDepartment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatar: true,
            isActive: true,
          },
        },
        _count: {
          select: { users: true, projects: true },
        },
      },
    });

    if (!department) {
      res.status(404).json({ success: false, error: 'Department not found' });
      return;
    }

    res.json({ success: true, data: department });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch department' });
  }
}

export async function createDepartment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, code } = req.body;

    if (!name || !code) {
      res.status(400).json({ success: false, error: 'Name and code are required' });
      return;
    }

    const department = await prisma.department.create({
      data: { name, code: code.toUpperCase() },
    });

    res.status(201).json({ success: true, data: department });
  } catch (error: unknown) {
    console.error('Create department error:', error);
    if ((error as { code?: string }).code === 'P2002') {
      res.status(400).json({ success: false, error: 'Department name or code already exists' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create department' });
  }
}

export async function updateDepartment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, code } = req.body;

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(code && { code: code.toUpperCase() }),
      },
    });

    res.json({ success: true, data: department });
  } catch (error: unknown) {
    console.error('Update department error:', error);
    if ((error as { code?: string }).code === 'P2025') {
      res.status(404).json({ success: false, error: 'Department not found' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to update department' });
  }
}

export async function deleteDepartment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    // Check if department has users
    const userCount = await prisma.user.count({
      where: { departmentId: id },
    });

    if (userCount > 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete department with existing users'
      });
      return;
    }

    await prisma.department.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error: unknown) {
    console.error('Delete department error:', error);
    if ((error as { code?: string }).code === 'P2025') {
      res.status(404).json({ success: false, error: 'Department not found' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to delete department' });
  }
}
