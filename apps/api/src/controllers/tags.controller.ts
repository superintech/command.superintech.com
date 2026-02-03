import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logActivity } from './activity.controller.js';

// Get tags for a project
export async function getTags(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;

    const where: Record<string, unknown> = {};
    if (projectId) {
      where.projectId = projectId;
    }

    const tags = await prisma.tag.findMany({
      where,
      include: {
        _count: {
          select: { tasks: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: tags });
  } catch (error) {
    console.error('Get tags error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tags' });
  }
}

// Create a tag
export async function createTag(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { name, color, projectId } = req.body;

    if (!name || !projectId) {
      res.status(400).json({ success: false, error: 'Name and project are required' });
      return;
    }

    // Check if tag already exists in project
    const existingTag = await prisma.tag.findUnique({
      where: {
        name_projectId: { name, projectId },
      },
    });

    if (existingTag) {
      res.status(400).json({ success: false, error: 'Tag already exists in this project' });
      return;
    }

    const tag = await prisma.tag.create({
      data: {
        name,
        color: color || '#0ea5e9',
        projectId,
      },
    });

    res.status(201).json({ success: true, data: tag });
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ success: false, error: 'Failed to create tag' });
  }
}

// Update a tag
export async function updateTag(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    // Check for duplicate name if name is being changed
    if (name && name !== tag.name) {
      const existingTag = await prisma.tag.findUnique({
        where: {
          name_projectId: { name, projectId: tag.projectId },
        },
      });

      if (existingTag) {
        res.status(400).json({ success: false, error: 'Tag name already exists' });
        return;
      }
    }

    const updatedTag = await prisma.tag.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(color && { color }),
      },
    });

    res.json({ success: true, data: updatedTag });
  } catch (error) {
    console.error('Update tag error:', error);
    res.status(500).json({ success: false, error: 'Failed to update tag' });
  }
}

// Delete a tag
export async function deleteTag(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const tag = await prisma.tag.findUnique({ where: { id } });
    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    await prisma.tag.delete({ where: { id } });

    res.json({ success: true, message: 'Tag deleted' });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete tag' });
  }
}

// Add tag to task
export async function addTagToTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { taskId, tagId } = req.params;

    // Verify task and tag exist
    const [task, tag] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId } }),
      prisma.tag.findUnique({ where: { id: tagId } }),
    ]);

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    if (!tag) {
      res.status(404).json({ success: false, error: 'Tag not found' });
      return;
    }

    // Check if tag belongs to the same project
    if (tag.projectId !== task.projectId) {
      res.status(400).json({ success: false, error: 'Tag does not belong to this project' });
      return;
    }

    // Add tag to task (ignore if already exists)
    await prisma.taskTag.upsert({
      where: {
        taskId_tagId: { taskId, tagId },
      },
      create: { taskId, tagId },
      update: {},
    });

    // Log activity
    await logActivity({
      entityType: 'TASK',
      entityId: taskId,
      action: 'TAG_ADDED',
      userId: req.user!.id,
      projectId: task.projectId,
      taskId,
      metadata: { tagName: tag.name, tagColor: tag.color },
    });

    res.json({ success: true, message: 'Tag added to task' });
  } catch (error) {
    console.error('Add tag to task error:', error);
    res.status(500).json({ success: false, error: 'Failed to add tag to task' });
  }
}

// Remove tag from task
export async function removeTagFromTask(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { taskId, tagId } = req.params;

    // Get task and tag info for logging
    const [task, tag] = await Promise.all([
      prisma.task.findUnique({ where: { id: taskId } }),
      prisma.tag.findUnique({ where: { id: tagId } }),
    ]);

    await prisma.taskTag.deleteMany({
      where: { taskId, tagId },
    });

    // Log activity
    if (task && tag) {
      await logActivity({
        entityType: 'TASK',
        entityId: taskId,
        action: 'TAG_REMOVED',
        userId: req.user!.id,
        projectId: task.projectId,
        taskId,
        metadata: { tagName: tag.name },
      });
    }

    res.json({ success: true, message: 'Tag removed from task' });
  } catch (error) {
    console.error('Remove tag from task error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove tag from task' });
  }
}
