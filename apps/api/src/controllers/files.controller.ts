import { Response, Request } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logActivity } from './activity.controller.js';
import { hasPermission } from './users.controller.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Generate a short code for file sharing (6 characters)
function generateShortCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  const randomBytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[randomBytes[i] % chars.length];
  }
  return code;
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

export const filesController = {
  // Upload files (with optional task/project association)
  upload: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      // Check permission
      if (!await hasPermission(userId, 'files.upload')) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied: Cannot upload files',
        });
      }

      const { taskId, projectId } = req.body;
      const files = req.files as Express.Multer.File[];

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
        });
      }

      // Create file records in database
      const fileRecords = await Promise.all(
        files.map(async (file) => {
          const fileRecord = await prisma.file.create({
            data: {
              name: file.originalname,
              originalName: file.originalname,
              path: file.path,
              mimeType: file.mimetype,
              size: file.size,
              uploaderId: userId,
              taskId: taskId || null,
              projectId: projectId || null,
            },
          });
          return fileRecord;
        })
      );

      // Log activity for each uploaded file
      for (const fileRecord of fileRecords) {
        const entityType = taskId ? 'TASK' : 'PROJECT';
        const entityId = taskId || projectId;
        if (entityId) {
          await logActivity({
            entityType: entityType as 'TASK' | 'PROJECT',
            entityId: entityId,
            action: 'FILE_UPLOADED',
            userId,
            projectId: projectId || undefined,
            taskId: taskId || undefined,
            metadata: { fileName: fileRecord.originalName, fileSize: fileRecord.size },
          });
        }
      }

      res.json({
        success: true,
        data: fileRecords,
      });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload files',
      });
    }
  },

  // List files (with optional filtering)
  list: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { taskId, projectId } = req.query;

      const where: Record<string, unknown> = {};
      if (taskId) where.taskId = taskId;
      if (projectId) where.projectId = projectId;

      const files = await prisma.file.findMany({
        where,
        include: {
          uploader: {
            select: { id: true, name: true, avatar: true },
          },
          task: {
            select: { id: true, title: true },
          },
          project: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        data: files,
      });
    } catch (error) {
      console.error('List files error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list files',
      });
    }
  },

  // Get single file info
  get: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const file = await prisma.file.findUnique({
        where: { id },
        include: {
          uploader: {
            select: { id: true, name: true, avatar: true },
          },
          task: {
            select: { id: true, title: true },
          },
          project: {
            select: { id: true, name: true },
          },
        },
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }

      res.json({
        success: true,
        data: file,
      });
    } catch (error) {
      console.error('Get file error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get file',
      });
    }
  },

  // Download file
  download: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const file = await prisma.file.findUnique({
        where: { id },
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }

      // Check if file exists on disk
      if (!fs.existsSync(file.path)) {
        return res.status(404).json({
          success: false,
          error: 'File not found on disk',
        });
      }

      res.download(file.path, file.originalName);
    } catch (error) {
      console.error('Download file error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download file',
      });
    }
  },

  // Delete file
  delete: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Check permission
      if (!await hasPermission(userId, 'files.delete')) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied: Cannot delete files',
        });
      }

      const file = await prisma.file.findUnique({
        where: { id },
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }

      // Delete from disk
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      // Delete from database
      await prisma.file.delete({
        where: { id },
      });

      res.json({
        success: true,
        message: 'File deleted successfully',
      });
    } catch (error) {
      console.error('Delete file error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete file',
      });
    }
  },

  // Create a shareable link for a file
  createShare: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      // Check permission
      if (!await hasPermission(userId, 'files.share')) {
        return res.status(403).json({
          success: false,
          error: 'Permission denied: Cannot share files',
        });
      }

      const { expiresIn, password, maxDownloads } = req.body;

      const file = await prisma.file.findUnique({
        where: { id },
      });

      if (!file) {
        return res.status(404).json({
          success: false,
          error: 'File not found',
        });
      }

      // Generate unique short code
      let code = generateShortCode();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await prisma.fileShare.findUnique({ where: { code } });
        if (!existing) break;
        code = generateShortCode();
        attempts++;
      }

      // Calculate expiration date if provided (in hours)
      let expiresAt: Date | null = null;
      if (expiresIn && typeof expiresIn === 'number') {
        expiresAt = new Date(Date.now() + expiresIn * 60 * 60 * 1000);
      }

      const share = await prisma.fileShare.create({
        data: {
          code,
          fileId: id,
          createdById: userId,
          expiresAt,
          password: password || null,
          maxDownloads: maxDownloads || null,
        },
        include: {
          file: {
            select: { originalName: true, size: true, mimeType: true },
          },
        },
      });

      // Get base URL from environment or use default
      const baseUrl = process.env.APP_URL || 'http://localhost:4000';
      const shareUrl = `${baseUrl}/s/${code}`;

      res.json({
        success: true,
        data: {
          ...share,
          shareUrl,
        },
      });
    } catch (error) {
      console.error('Create share error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create share link',
      });
    }
  },

  // List shares for a file
  getShares: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;

      const shares = await prisma.fileShare.findMany({
        where: { fileId: id, isActive: true },
        include: {
          file: {
            select: { originalName: true, size: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const baseUrl = process.env.APP_URL || 'http://localhost:4000';
      const sharesWithUrls = shares.map((share) => ({
        ...share,
        shareUrl: `${baseUrl}/s/${share.code}`,
      }));

      res.json({
        success: true,
        data: sharesWithUrls,
      });
    } catch (error) {
      console.error('Get shares error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get shares',
      });
    }
  },

  // Delete/deactivate a share
  deleteShare: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { shareId } = req.params;
      const userId = req.user!.id;

      const share = await prisma.fileShare.findUnique({
        where: { id: shareId },
        include: { file: true },
      });

      if (!share) {
        return res.status(404).json({
          success: false,
          error: 'Share not found',
        });
      }

      // Only allow creator, file owner, or admin to delete
      const canDelete =
        share.createdById === userId ||
        share.file.uploaderId === userId ||
        req.user!.role === 'CEO';

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to delete this share',
        });
      }

      await prisma.fileShare.delete({
        where: { id: shareId },
      });

      res.json({
        success: true,
        message: 'Share deleted successfully',
      });
    } catch (error) {
      console.error('Delete share error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete share',
      });
    }
  },
};

// Public endpoint - download file via share code (no auth required)
export async function downloadSharedFile(req: Request, res: Response) {
  try {
    const { code } = req.params;
    const { password } = req.query;

    const share = await prisma.fileShare.findUnique({
      where: { code },
      include: { file: true },
    });

    if (!share || !share.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Share link not found or has been deactivated',
      });
    }

    // Check expiration
    if (share.expiresAt && new Date() > share.expiresAt) {
      return res.status(410).json({
        success: false,
        error: 'Share link has expired',
      });
    }

    // Check max downloads
    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      return res.status(410).json({
        success: false,
        error: 'Download limit reached',
      });
    }

    // Check password if set
    if (share.password && share.password !== password) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password',
        requiresPassword: true,
      });
    }

    // Check if file exists on disk
    if (!fs.existsSync(share.file.path)) {
      return res.status(404).json({
        success: false,
        error: 'File not found on disk',
      });
    }

    // Increment download count
    await prisma.fileShare.update({
      where: { id: share.id },
      data: { downloadCount: { increment: 1 } },
    });

    res.download(share.file.path, share.file.originalName);
  } catch (error) {
    console.error('Download shared file error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download file',
    });
  }
}

// Get share info (public - for showing file details before download)
export async function getShareInfo(req: Request, res: Response) {
  try {
    const { code } = req.params;

    const share = await prisma.fileShare.findUnique({
      where: { code },
      include: {
        file: {
          select: {
            originalName: true,
            size: true,
            mimeType: true,
          },
        },
      },
    });

    if (!share || !share.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Share link not found',
      });
    }

    // Check expiration
    if (share.expiresAt && new Date() > share.expiresAt) {
      return res.status(410).json({
        success: false,
        error: 'Share link has expired',
      });
    }

    // Check max downloads
    if (share.maxDownloads && share.downloadCount >= share.maxDownloads) {
      return res.status(410).json({
        success: false,
        error: 'Download limit reached',
      });
    }

    res.json({
      success: true,
      data: {
        fileName: share.file.originalName,
        fileSize: share.file.size,
        mimeType: share.file.mimeType,
        requiresPassword: !!share.password,
        expiresAt: share.expiresAt,
        downloadCount: share.downloadCount,
        maxDownloads: share.maxDownloads,
      },
    });
  } catch (error) {
    console.error('Get share info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get share info',
    });
  }
}
