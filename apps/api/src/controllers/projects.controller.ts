import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { isManager, isAdmin } from '../middleware/rbac.js';
import { logActivity } from './activity.controller.js';
import { hasPermission } from './users.controller.js';

export async function getProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { status, departmentId, search } = req.query;

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (departmentId) where.departmentId = departmentId;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Non-managers see only their projects
    if (!isManager(req)) {
      where.OR = [
        { ownerId: req.user!.id },
        { members: { some: { userId: req.user!.id } } },
      ];
    }

    const projects = await prisma.project.findMany({
      where,
      include: {
        owner: {
          select: { id: true, name: true, avatar: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, role: true },
            },
          },
        },
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch projects' });
  }
}

export async function getProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatar: true, role: true },
            },
          },
        },
        tags: true,
        _count: {
          select: { tasks: true, files: true },
        },
      },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Check access
    if (!isManager(req)) {
      const isMember = project.members.some(m => m.userId === req.user!.id);
      if (!isMember && project.ownerId !== req.user!.id) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }
    }

    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch project' });
  }
}

export async function createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    // Check permission
    if (!await hasPermission(userId, 'projects.create')) {
      res.status(403).json({ success: false, error: 'Permission denied: Cannot create projects' });
      return;
    }

    const { name, description, status, startDate, endDate, departmentId, memberIds } = req.body;

    if (!name || !departmentId) {
      res.status(400).json({ success: false, error: 'Name and department are required' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        status: status || 'PLANNING',
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        ownerId: req.user!.id,
        departmentId,
      },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Add members if provided
    if (memberIds && memberIds.length > 0) {
      await prisma.projectMember.createMany({
        data: memberIds.map((userId: string) => ({
          projectId: project.id,
          userId,
        })),
        skipDuplicates: true,
      });
    }

    // Add owner as member
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: req.user!.id,
      },
    }).catch(() => {});

    // Create project chat room
    await prisma.chatRoom.create({
      data: {
        name: `${name} Chat`,
        type: 'PROJECT',
        projectId: project.id,
        createdById: req.user!.id,
        members: {
          create: {
            userId: req.user!.id,
          },
        },
      },
    });

    // Log activity
    await logActivity({
      entityType: 'PROJECT',
      entityId: project.id,
      action: 'CREATED',
      userId: req.user!.id,
      projectId: project.id,
      metadata: { name: project.name },
    });

    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
}

export async function updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Check permission
    if (!await hasPermission(userId, 'projects.edit')) {
      res.status(403).json({ success: false, error: 'Permission denied: Cannot edit projects' });
      return;
    }

    const { name, description, status, startDate, endDate } = req.body;

    // Check ownership
    const existingProject = await prisma.project.findUnique({
      where: { id },
      include: { members: true },
    });

    if (!existingProject) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(status && { status }),
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
      },
      include: {
        owner: {
          select: { id: true, name: true, avatar: true },
        },
        department: {
          select: { id: true, name: true, code: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true, role: true },
            },
          },
        },
      },
    });

    // Log activity
    if (status && status !== existingProject.status) {
      await logActivity({
        entityType: 'PROJECT',
        entityId: project.id,
        action: 'STATUS_CHANGED',
        userId: req.user!.id,
        projectId: project.id,
        changes: { from: existingProject.status, to: status },
        metadata: { name: project.name },
      });
    } else {
      await logActivity({
        entityType: 'PROJECT',
        entityId: project.id,
        action: 'UPDATED',
        userId: req.user!.id,
        projectId: project.id,
        metadata: { name: project.name },
      });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
}

export async function deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Check permission
    if (!await hasPermission(userId, 'projects.delete')) {
      res.status(403).json({ success: false, error: 'Permission denied: Cannot delete projects' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    await prisma.project.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
}

export async function addProjectMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const { id } = req.params;
    const { userId } = req.body;

    // Check permission
    if (!await hasPermission(currentUserId, 'projects.manage_members')) {
      res.status(403).json({ success: false, error: 'Permission denied: Cannot manage project members' });
      return;
    }

    if (!userId) {
      res.status(400).json({ success: false, error: 'User ID is required' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    await prisma.projectMember.create({
      data: {
        projectId: id,
        userId,
      },
    });

    // Add to project chat room
    const chatRoom = await prisma.chatRoom.findUnique({
      where: { projectId: id },
    });

    if (chatRoom) {
      await prisma.chatRoomMember.create({
        data: {
          roomId: chatRoom.id,
          userId,
        },
      }).catch(() => {});
    }

    // Log activity
    await logActivity({
      entityType: 'PROJECT',
      entityId: id,
      action: 'MEMBER_ADDED',
      userId: req.user!.id,
      projectId: id,
      metadata: { addedUserId: userId, name: project.name },
    });

    res.json({ success: true, message: 'Member added successfully' });
  } catch (error: unknown) {
    console.error('Add project member error:', error);
    if ((error as { code?: string }).code === 'P2002') {
      res.status(400).json({ success: false, error: 'User is already a member' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to add member' });
  }
}

export async function removeProjectMember(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const currentUserId = req.user!.id;
    const { id, userId } = req.params;

    // Check permission
    if (!await hasPermission(currentUserId, 'projects.manage_members')) {
      res.status(403).json({ success: false, error: 'Permission denied: Cannot manage project members' });
      return;
    }

    const project = await prisma.project.findUnique({
      where: { id },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Can't remove the owner
    if (userId === project.ownerId) {
      res.status(400).json({ success: false, error: 'Cannot remove project owner' });
      return;
    }

    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId: id,
          userId,
        },
      },
    });

    // Log activity
    await logActivity({
      entityType: 'PROJECT',
      entityId: id,
      action: 'MEMBER_REMOVED',
      userId: req.user!.id,
      projectId: id,
      metadata: { removedUserId: userId, name: project.name },
    });

    res.json({ success: true, message: 'Member removed successfully' });
  } catch (error: unknown) {
    console.error('Remove project member error:', error);
    if ((error as { code?: string }).code === 'P2025') {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
}
