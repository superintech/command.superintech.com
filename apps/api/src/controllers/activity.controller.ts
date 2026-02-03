import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

// Get activity logs for a project
export async function getProjectActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { projectId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const activities = await prisma.activityLog.findMany({
      where: { projectId },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.activityLog.count({
      where: { projectId },
    });

    res.json({ success: true, data: activities, total });
  } catch (error) {
    console.error('Get project activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
}

// Get activity logs for a task
export async function getTaskActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { taskId } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const activities = await prisma.activityLog.findMany({
      where: { taskId },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.activityLog.count({
      where: { taskId },
    });

    res.json({ success: true, data: activities, total });
  } catch (error) {
    console.error('Get task activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
}

// Get recent activity for the current user
export async function getMyActivity(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { limit = '50', offset = '0' } = req.query;

    const activities = await prisma.activityLog.findMany({
      where: { userId: req.user!.id },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('Get my activity error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity' });
  }
}

// Get recent activity feed (for dashboard)
export async function getActivityFeed(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { limit = '20' } = req.query;

    // Get projects the user is a member of
    const memberProjects = await prisma.projectMember.findMany({
      where: { userId: req.user!.id },
      select: { projectId: true },
    });

    const ownedProjects = await prisma.project.findMany({
      where: { ownerId: req.user!.id },
      select: { id: true },
    });

    const projectIds = [
      ...memberProjects.map((p) => p.projectId),
      ...ownedProjects.map((p) => p.id),
    ];

    const activities = await prisma.activityLog.findMany({
      where: {
        OR: [
          { projectId: { in: projectIds } },
          { userId: req.user!.id },
        ],
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({ success: true, data: activities });
  } catch (error) {
    console.error('Get activity feed error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch activity feed' });
  }
}

// Helper function to log activity (exported for use in other controllers)
export async function logActivity({
  entityType,
  entityId,
  action,
  userId,
  projectId,
  taskId,
  changes,
  metadata,
}: {
  entityType: 'PROJECT' | 'TASK' | 'COMMENT' | 'FILE';
  entityId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'UNASSIGNED' | 'COMMENTED' | 'FILE_UPLOADED' | 'FILE_DELETED' | 'MEMBER_ADDED' | 'MEMBER_REMOVED' | 'TAG_ADDED' | 'TAG_REMOVED';
  userId: string;
  projectId?: string;
  taskId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        entityType,
        entityId,
        action,
        userId,
        projectId,
        taskId,
        changes: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - activity logging should not break main functionality
  }
}
