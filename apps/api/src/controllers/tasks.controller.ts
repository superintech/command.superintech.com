import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { isManager } from '../middleware/rbac.js';
import { logActivity } from './activity.controller.js';
import { hasPermission } from './users.controller.js';

export async function getTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { projectId, status, priority, assigneeId, search } = req.query;

    const where: Record<string, unknown> = {};

    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;
    if (search) {
      where.OR = [
        { title: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Filter by user access if not a manager
    if (!isManager(req)) {
      where.OR = [
        { assigneeId: req.user!.id },
        { reporterId: req.user!.id },
        {
          project: {
            members: {
              some: { userId: req.user!.id },
            },
          },
        },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
        reporter: {
          select: { id: true, name: true, avatar: true },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        _count: {
          select: { comments: true, subtasks: true, timeEntries: true },
        },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tasks' });
  }
}

export async function getTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        reporter: {
          select: { id: true, name: true, email: true, avatar: true },
        },
        parent: {
          select: { id: true, title: true },
        },
        subtasks: {
          select: { id: true, title: true, status: true, assigneeId: true },
        },
        tags: {
          include: { tag: true },
        },
        comments: {
          include: {
            user: {
              select: { id: true, name: true, avatar: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        timeEntries: {
          select: {
            id: true,
            taskId: true,
            startTime: true,
            endTime: true,
            duration: true,
            description: true,
            user: {
              select: { id: true, name: true },
            },
          },
          orderBy: { startTime: 'desc' },
          take: 20,
        },
        files: {
          select: {
            id: true,
            name: true,
            originalName: true,
            mimeType: true,
            size: true,
            uploader: { select: { id: true, name: true } },
          },
        },
        dependsOn: {
          include: {
            dependencyTask: {
              select: { id: true, title: true, status: true },
            },
          },
        },
        dependentTasks: {
          include: {
            dependentTask: {
              select: { id: true, title: true, status: true },
            },
          },
        },
      },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch task' });
  }
}

export async function createTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    // Check permission
    if (!await hasPermission(userId, 'tasks.create')) {
      res.status(403).json({ success: false, error: 'Permission denied: Cannot create tasks' });
      return;
    }

    const {
      title,
      description,
      status,
      priority,
      projectId,
      assigneeId,
      parentTaskId,
      dueDate,
      estimatedHours,
      tagIds,
    } = req.body;

    if (!title || !projectId) {
      res.status(400).json({ success: false, error: 'Title and project are required' });
      return;
    }

    // Verify project exists and user has access
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Get max position
    const lastTask = await prisma.task.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
    });

    const task = await prisma.task.create({
      data: {
        title,
        description: description || undefined,
        status: status || 'TODO',
        priority: priority || 'MEDIUM',
        projectId,
        assigneeId: assigneeId || undefined,
        reporterId: req.user!.id,
        parentTaskId: parentTaskId || undefined,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        estimatedHours: estimatedHours || undefined,
        position: (lastTask?.position ?? -1) + 1,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
        reporter: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Add tags if provided
    if (tagIds && tagIds.length > 0) {
      await prisma.taskTag.createMany({
        data: tagIds.map((tagId: string) => ({
          taskId: task.id,
          tagId,
        })),
      });
    }

    // Create notification for assignee
    if (assigneeId && assigneeId !== req.user!.id) {
      await prisma.notification.create({
        data: {
          type: 'TASK_ASSIGNED',
          title: 'New Task Assigned',
          message: `You have been assigned to: ${title}`,
          userId: assigneeId,
          data: { taskId: task.id, projectId },
        },
      });
    }

    // Log activity
    await logActivity({
      entityType: 'TASK',
      entityId: task.id,
      action: 'CREATED',
      userId: req.user!.id,
      projectId,
      taskId: task.id,
      metadata: { title: task.title },
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
}

export async function updateTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const {
      title,
      description,
      status,
      priority,
      assigneeId,
      dueDate,
      estimatedHours,
      position,
    } = req.body;

    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Check permissions based on what's being updated
    const isStatusChangeOnly = status !== undefined &&
      title === undefined && description === undefined &&
      priority === undefined && assigneeId === undefined &&
      dueDate === undefined && estimatedHours === undefined;

    const isAssignmentChangeOnly = assigneeId !== undefined &&
      title === undefined && description === undefined &&
      status === undefined && priority === undefined &&
      dueDate === undefined && estimatedHours === undefined;

    if (isStatusChangeOnly) {
      // Check tasks.change_status permission
      if (!await hasPermission(userId, 'tasks.change_status')) {
        res.status(403).json({ success: false, error: 'Permission denied: Cannot change task status' });
        return;
      }
    } else if (isAssignmentChangeOnly) {
      // Check tasks.assign permission
      if (!await hasPermission(userId, 'tasks.assign')) {
        res.status(403).json({ success: false, error: 'Permission denied: Cannot assign tasks' });
        return;
      }
    } else {
      // General edit - check tasks.edit permission
      if (!await hasPermission(userId, 'tasks.edit')) {
        res.status(403).json({ success: false, error: 'Permission denied: Cannot edit tasks' });
        return;
      }
    }

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (estimatedHours !== undefined) updateData.estimatedHours = estimatedHours;
    if (position !== undefined) updateData.position = position;

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: { id: true, name: true },
        },
        assignee: {
          select: { id: true, name: true, avatar: true },
        },
        reporter: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Notify on assignment change
    if (assigneeId && assigneeId !== existingTask.assigneeId && assigneeId !== req.user!.id) {
      await prisma.notification.create({
        data: {
          type: 'TASK_ASSIGNED',
          title: 'Task Assigned',
          message: `You have been assigned to: ${task.title}`,
          userId: assigneeId,
          data: { taskId: task.id, projectId: task.projectId },
        },
      });
    }

    // Notify on completion
    if (status === 'COMPLETED' && existingTask.status !== 'COMPLETED' && existingTask.reporterId !== req.user!.id) {
      await prisma.notification.create({
        data: {
          type: 'TASK_COMPLETED',
          title: 'Task Completed',
          message: `Task completed: ${task.title}`,
          userId: existingTask.reporterId,
          data: { taskId: task.id, projectId: task.projectId },
        },
      });
    }

    // Log activity based on what changed
    if (status && status !== existingTask.status) {
      await logActivity({
        entityType: 'TASK',
        entityId: task.id,
        action: 'STATUS_CHANGED',
        userId: req.user!.id,
        projectId: task.projectId,
        taskId: task.id,
        changes: { from: existingTask.status, to: status },
        metadata: { title: task.title },
      });
    } else if (assigneeId !== undefined && assigneeId !== existingTask.assigneeId) {
      await logActivity({
        entityType: 'TASK',
        entityId: task.id,
        action: assigneeId ? 'ASSIGNED' : 'UNASSIGNED',
        userId: req.user!.id,
        projectId: task.projectId,
        taskId: task.id,
        changes: { from: existingTask.assigneeId, to: assigneeId },
        metadata: { title: task.title },
      });
    } else {
      await logActivity({
        entityType: 'TASK',
        entityId: task.id,
        action: 'UPDATED',
        userId: req.user!.id,
        projectId: task.projectId,
        taskId: task.id,
        changes: updateData,
        metadata: { title: task.title },
      });
    }

    res.json({ success: true, data: task });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
}

export async function deleteTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Check permission
    if (!await hasPermission(userId, 'tasks.delete')) {
      res.status(403).json({ success: false, error: 'Permission denied: Cannot delete tasks' });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    await prisma.task.delete({
      where: { id },
    });

    // Log activity
    await logActivity({
      entityType: 'TASK',
      entityId: id,
      action: 'DELETED',
      userId: req.user!.id,
      projectId: task.projectId,
      metadata: { title: task.title },
    });

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
}

export async function reorderTasks(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    // Check permission - reordering requires edit permission
    if (!await hasPermission(userId, 'tasks.edit')) {
      res.status(403).json({ success: false, error: 'Permission denied: Cannot reorder tasks' });
      return;
    }

    const { tasks } = req.body;

    if (!Array.isArray(tasks)) {
      res.status(400).json({ success: false, error: 'Tasks array is required' });
      return;
    }

    await prisma.$transaction(
      tasks.map((task: { id: string; position: number; status?: string }) =>
        prisma.task.update({
          where: { id: task.id },
          data: {
            position: task.position,
            ...(task.status && { status: task.status as 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED' }),
          },
        })
      )
    );

    res.json({ success: true, message: 'Tasks reordered successfully' });
  } catch (error) {
    console.error('Reorder tasks error:', error);
    res.status(500).json({ success: false, error: 'Failed to reorder tasks' });
  }
}

// Comments
export async function addComment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ success: false, error: 'Content is required' });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        taskId: id,
        userId: req.user!.id,
      },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    // Notify task participants
    const notifyUserIds = new Set<string>();
    if (task.reporterId !== req.user!.id) notifyUserIds.add(task.reporterId);
    if (task.assigneeId && task.assigneeId !== req.user!.id) notifyUserIds.add(task.assigneeId);

    for (const userId of notifyUserIds) {
      await prisma.notification.create({
        data: {
          type: 'COMMENT_ADDED',
          title: 'New Comment',
          message: `New comment on: ${task.title}`,
          userId,
          data: { taskId: id, commentId: comment.id },
        },
      });
    }

    // Log activity
    await logActivity({
      entityType: 'COMMENT',
      entityId: comment.id,
      action: 'COMMENTED',
      userId: req.user!.id,
      projectId: task.projectId,
      taskId: id,
      metadata: { taskTitle: task.title },
    });

    res.status(201).json({ success: true, data: comment });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, error: 'Failed to add comment' });
  }
}

export async function updateComment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ success: false, error: 'Content is required' });
      return;
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      res.status(404).json({ success: false, error: 'Comment not found' });
      return;
    }

    // Only allow the comment author to update
    if (comment.userId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Not authorized to update this comment' });
      return;
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: {
          select: { id: true, name: true, avatar: true },
        },
      },
    });

    res.json({ success: true, data: updatedComment });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({ success: false, error: 'Failed to update comment' });
  }
}

export async function deleteComment(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { commentId } = req.params;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { task: true },
    });

    if (!comment) {
      res.status(404).json({ success: false, error: 'Comment not found' });
      return;
    }

    // Allow comment author, task reporter, or CEO to delete
    const canDelete =
      comment.userId === req.user!.id ||
      comment.task.reporterId === req.user!.id ||
      req.user!.role === 'CEO';

    if (!canDelete) {
      res.status(403).json({ success: false, error: 'Not authorized to delete this comment' });
      return;
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    res.json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
}

// Time Entries
export async function startTimer(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { description } = req.body;

    // Check for active timer
    const activeTimer = await prisma.timeEntry.findFirst({
      where: {
        userId: req.user!.id,
        endTime: null,
      },
    });

    if (activeTimer) {
      res.status(400).json({
        success: false,
        error: 'You have an active timer. Please stop it first.',
        activeTimerId: activeTimer.id,
      });
      return;
    }

    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const timeEntry = await prisma.timeEntry.create({
      data: {
        taskId: id,
        userId: req.user!.id,
        description,
        startTime: new Date(),
      },
      include: {
        task: {
          select: { id: true, title: true, projectId: true },
        },
      },
    });

    // Log activity
    await logActivity({
      entityType: 'TASK',
      entityId: id,
      action: 'UPDATED',
      userId: req.user!.id,
      projectId: task.projectId,
      taskId: id,
      metadata: { title: task.title, action: 'Timer started', description },
    });

    res.status(201).json({ success: true, data: timeEntry });
  } catch (error) {
    console.error('Start timer error:', error);
    res.status(500).json({ success: false, error: 'Failed to start timer' });
  }
}

export async function stopTimer(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { timeEntryId } = req.params;

    const timeEntry = await prisma.timeEntry.findUnique({
      where: { id: timeEntryId },
    });

    if (!timeEntry) {
      res.status(404).json({ success: false, error: 'Time entry not found' });
      return;
    }

    if (timeEntry.userId !== req.user!.id) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    if (timeEntry.endTime) {
      res.status(400).json({ success: false, error: 'Timer already stopped' });
      return;
    }

    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - timeEntry.startTime.getTime()) / 60000);

    const updatedEntry = await prisma.timeEntry.update({
      where: { id: timeEntryId },
      data: {
        endTime,
        duration,
      },
      include: {
        task: {
          select: { id: true, title: true },
        },
      },
    });

    // Update task actual hours
    const totalMinutes = await prisma.timeEntry.aggregate({
      where: { taskId: timeEntry.taskId },
      _sum: { duration: true },
    });

    const task = await prisma.task.update({
      where: { id: timeEntry.taskId },
      data: {
        actualHours: (totalMinutes._sum.duration || 0) / 60,
      },
    });

    // Log activity
    await logActivity({
      entityType: 'TASK',
      entityId: timeEntry.taskId,
      action: 'UPDATED',
      userId: req.user!.id,
      projectId: task.projectId,
      taskId: timeEntry.taskId,
      metadata: { title: task.title, action: 'Timer stopped', duration },
    });

    res.json({ success: true, data: updatedEntry });
  } catch (error) {
    console.error('Stop timer error:', error);
    res.status(500).json({ success: false, error: 'Failed to stop timer' });
  }
}

export async function getActiveTimer(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const activeTimer = await prisma.timeEntry.findFirst({
      where: {
        userId: req.user!.id,
        endTime: null,
      },
      select: {
        id: true,
        taskId: true,
        startTime: true,
        description: true,
        task: {
          select: { id: true, title: true, projectId: true },
        },
      },
    });

    res.json({ success: true, data: activeTimer });
  } catch (error) {
    console.error('Get active timer error:', error);
    res.status(500).json({ success: false, error: 'Failed to get active timer' });
  }
}
