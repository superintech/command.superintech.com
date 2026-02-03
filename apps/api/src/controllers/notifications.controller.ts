import { Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

type AuthRequest = AuthenticatedRequest;

// Get user notifications
export async function getNotifications(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { limit = '50', unreadOnly } = req.query;

    const notifications = await prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly === 'true' && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
    });

    res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
}

// Get unread count
export async function getUnreadCount(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;

    const count = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch unread count' });
  }
}

// Mark notification as read
export async function markAsRead(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
}

// Mark all notifications as read
export async function markAllAsRead(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;

    await prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
}

// Delete notification
export async function deleteNotification(req: AuthRequest, res: Response) {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete notification' });
  }
}

// Create notification (internal use, exported for other controllers)
export async function createNotification(notificationData: {
  type: string;
  title: string;
  message: string;
  userId: string;
  data?: Record<string, unknown>;
}) {
  return prisma.notification.create({
    data: {
      type: notificationData.type as any,
      title: notificationData.title,
      message: notificationData.message,
      userId: notificationData.userId,
      data: notificationData.data ? JSON.parse(JSON.stringify(notificationData.data)) : undefined,
    },
  });
}
