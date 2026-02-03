import { Response } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

export const chatController = {
  // Create a new chat room
  createRoom: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { name, type, memberIds, projectId } = req.body;

      if (!name && type !== 'DIRECT') {
        return res.status(400).json({
          success: false,
          error: 'Room name is required',
        });
      }

      // For direct messages, ensure exactly 2 members
      if (type === 'DIRECT') {
        if (!memberIds || memberIds.length !== 1) {
          return res.status(400).json({
            success: false,
            error: 'Direct messages require exactly one other member',
          });
        }

        // Check if direct room already exists between these users
        const existingRoom = await prisma.chatRoom.findFirst({
          where: {
            type: 'DIRECT',
            AND: [
              { members: { some: { userId } } },
              { members: { some: { userId: memberIds[0] } } },
            ],
          },
        });

        if (existingRoom) {
          return res.json({
            success: true,
            data: existingRoom,
            message: 'Existing room returned',
          });
        }
      }

      // Create room with members
      const allMemberIds = [userId, ...(memberIds || [])];
      const uniqueMemberIds = [...new Set(allMemberIds)];

      const room = await prisma.chatRoom.create({
        data: {
          name: name || 'Direct Message',
          type: type || 'GROUP',
          createdById: userId,
          projectId: projectId || null,
          members: {
            create: uniqueMemberIds.map((id) => ({
              userId: id,
            })),
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatar: true },
              },
            },
          },
          createdBy: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: room,
      });
    } catch (error) {
      console.error('Create room error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create room',
      });
    }
  },

  // Get all rooms for current user
  getRooms: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const rooms = await prisma.chatRoom.findMany({
        where: {
          members: {
            some: { userId },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatar: true },
              },
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            include: {
              sender: {
                select: { id: true, name: true },
              },
            },
          },
          _count: {
            select: { messages: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      // Calculate unread counts
      const roomsWithUnread = await Promise.all(
        rooms.map(async (room) => {
          const membership = room.members.find((m) => m.user.id === userId);
          const lastSeen = membership?.lastSeenAt || new Date(0);

          const unreadCount = await prisma.chatMessage.count({
            where: {
              roomId: room.id,
              createdAt: { gt: lastSeen },
              senderId: { not: userId },
            },
          });

          return {
            ...room,
            unreadCount,
            lastMessage: room.messages[0] || null,
          };
        })
      );

      res.json({
        success: true,
        data: roomsWithUnread,
      });
    } catch (error) {
      console.error('Get rooms error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get rooms',
      });
    }
  },

  // Get single room
  getRoom: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const room = await prisma.chatRoom.findFirst({
        where: {
          id,
          members: { some: { userId } },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatar: true, role: true },
              },
            },
          },
          createdBy: {
            select: { id: true, name: true },
          },
          project: {
            select: { id: true, name: true },
          },
        },
      });

      if (!room) {
        return res.status(404).json({
          success: false,
          error: 'Room not found or access denied',
        });
      }

      res.json({
        success: true,
        data: room,
      });
    } catch (error) {
      console.error('Get room error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get room',
      });
    }
  },

  // Get messages for a room
  getMessages: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { limit = 50, before } = req.query;

      // Verify membership
      const membership = await prisma.chatRoomMember.findUnique({
        where: {
          roomId_userId: {
            roomId: id,
            userId,
          },
        },
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Not a member of this room',
        });
      }

      const messages = await prisma.chatMessage.findMany({
        where: {
          roomId: id,
          ...(before ? { createdAt: { lt: new Date(before as string) } } : {}),
        },
        include: {
          sender: {
            select: { id: true, name: true, avatar: true },
          },
          file: {
            select: { id: true, originalName: true, mimeType: true, size: true },
          },
          reactions: {
            include: {
              user: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: Number(limit),
      });

      // Update last seen
      await prisma.chatRoomMember.update({
        where: { id: membership.id },
        data: { lastSeenAt: new Date() },
      });

      res.json({
        success: true,
        data: messages.reverse(), // Return in chronological order
      });
    } catch (error) {
      console.error('Get messages error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get messages',
      });
    }
  },

  // Add member to room
  addMember: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { userId: memberUserId } = req.body;
      const userId = req.user!.id;

      // Verify current user is a member
      const membership = await prisma.chatRoomMember.findUnique({
        where: {
          roomId_userId: {
            roomId: id,
            userId,
          },
        },
      });

      if (!membership) {
        return res.status(403).json({
          success: false,
          error: 'Not a member of this room',
        });
      }

      // Check if user is already a member
      const existingMember = await prisma.chatRoomMember.findUnique({
        where: {
          roomId_userId: {
            roomId: id,
            userId: memberUserId,
          },
        },
      });

      if (existingMember) {
        return res.status(400).json({
          success: false,
          error: 'User is already a member',
        });
      }

      const newMember = await prisma.chatRoomMember.create({
        data: {
          roomId: id,
          userId: memberUserId,
        },
        include: {
          user: {
            select: { id: true, name: true, avatar: true },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: newMember,
      });
    } catch (error) {
      console.error('Add member error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add member',
      });
    }
  },

  // Leave room
  leaveRoom: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await prisma.chatRoomMember.delete({
        where: {
          roomId_userId: {
            roomId: id,
            userId,
          },
        },
      });

      res.json({
        success: true,
        message: 'Left room successfully',
      });
    } catch (error) {
      console.error('Leave room error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to leave room',
      });
    }
  },

  // Add reaction to message
  addReaction: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { messageId } = req.params;
      const { emoji } = req.body;
      const userId = req.user!.id;

      // Verify message exists and user has access
      const message = await prisma.chatMessage.findUnique({
        where: { id: messageId },
        include: {
          room: {
            include: {
              members: { where: { userId } },
            },
          },
        },
      });

      if (!message || message.room.members.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Message not found or access denied',
        });
      }

      // Toggle reaction (add if not exists, remove if exists)
      const existingReaction = await prisma.messageReaction.findUnique({
        where: {
          messageId_userId_emoji: {
            messageId,
            userId,
            emoji,
          },
        },
      });

      if (existingReaction) {
        await prisma.messageReaction.delete({
          where: { id: existingReaction.id },
        });
        return res.json({
          success: true,
          message: 'Reaction removed',
        });
      }

      const reaction = await prisma.messageReaction.create({
        data: {
          messageId,
          userId,
          emoji,
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: reaction,
      });
    } catch (error) {
      console.error('Add reaction error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add reaction',
      });
    }
  },

  // Create or get direct message room with a user
  getOrCreateDM: async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { otherUserId } = req.params;

      // Check if DM room already exists
      const existingRoom = await prisma.chatRoom.findFirst({
        where: {
          type: 'DIRECT',
          AND: [
            { members: { some: { userId } } },
            { members: { some: { userId: otherUserId } } },
          ],
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatar: true },
              },
            },
          },
        },
      });

      if (existingRoom) {
        return res.json({
          success: true,
          data: existingRoom,
        });
      }

      // Get other user's name for room name
      const otherUser = await prisma.user.findUnique({
        where: { id: otherUserId },
        select: { name: true },
      });

      if (!otherUser) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      // Create new DM room
      const room = await prisma.chatRoom.create({
        data: {
          name: 'Direct Message',
          type: 'DIRECT',
          createdById: userId,
          members: {
            create: [
              { userId },
              { userId: otherUserId },
            ],
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, avatar: true },
              },
            },
          },
        },
      });

      res.status(201).json({
        success: true,
        data: room,
      });
    } catch (error) {
      console.error('Get/create DM error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get or create DM room',
      });
    }
  },
};
