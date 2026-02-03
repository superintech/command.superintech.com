import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from './prisma.js';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userName?: string;
}

interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

let io: Server | null = null;

// Track online users: Map<socketId, userId>
const socketToUser = new Map<string, string>();
// Track user sockets: Map<userId, Set<socketId>>
const userSockets = new Map<string, Set<string>>();

function getOnlineUserIds(): string[] {
  return Array.from(userSockets.keys());
}

function addUserSocket(userId: string, socketId: string) {
  socketToUser.set(socketId, userId);
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(socketId);
}

function removeUserSocket(socketId: string): string | undefined {
  const userId = socketToUser.get(socketId);
  if (userId) {
    socketToUser.delete(socketId);
    const sockets = userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        userSockets.delete(userId);
        return userId; // User went offline
      }
    }
  }
  return undefined;
}

export function initializeSocket(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production'
        ? process.env.CORS_ORIGIN
        : ['http://localhost:3006', 'http://127.0.0.1:3006'],
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as JwtPayload;

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, isActive: true },
      });

      if (!user || !user.isActive) {
        return next(new Error('User not found or inactive'));
      }

      socket.userId = user.id;
      socket.userName = user.name;
      next();
    } catch (error) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`User connected: ${socket.userName} (${socket.userId})`);

    // Track online user
    const wasOffline = !userSockets.has(socket.userId!);
    addUserSocket(socket.userId!, socket.id);

    // Join user's personal room for direct notifications
    socket.join(`user:${socket.userId}`);

    // Broadcast user online status if they were offline
    if (wasOffline) {
      socket.broadcast.emit('user-online', socket.userId);
    }

    // Send current online users to this socket
    socket.emit('online-users', getOnlineUserIds());

    // Get online users
    socket.on('get-online-users', () => {
      socket.emit('online-users', getOnlineUserIds());
    });

    // Join chat room
    socket.on('join-room', async (roomId: string) => {
      try {
        // Verify user is a member of this room
        const membership = await prisma.chatRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: socket.userId!,
            },
          },
        });

        if (!membership) {
          socket.emit('error', { message: 'Not a member of this room' });
          return;
        }

        socket.join(`room:${roomId}`);
        console.log(`${socket.userName} joined room: ${roomId}`);

        // Update last seen
        await prisma.chatRoomMember.update({
          where: { id: membership.id },
          data: { lastSeenAt: new Date() },
        });

        // Notify others in room
        socket.to(`room:${roomId}`).emit('user-joined', {
          roomId,
          userId: socket.userId,
          userName: socket.userName,
        });
      } catch (error) {
        console.error('Join room error:', error);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave chat room
    socket.on('leave-room', (roomId: string) => {
      socket.leave(`room:${roomId}`);
      console.log(`${socket.userName} left room: ${roomId}`);

      socket.to(`room:${roomId}`).emit('user-left', {
        roomId,
        userId: socket.userId,
        userName: socket.userName,
      });
    });

    // Send message
    socket.on('send-message', async (data: { roomId: string; content: string; fileId?: string }) => {
      try {
        const { roomId, content, fileId } = data;

        // Require either content or a file
        if (!content?.trim() && !fileId) {
          socket.emit('error', { message: 'Message content or file is required' });
          return;
        }

        // Verify membership
        const membership = await prisma.chatRoomMember.findUnique({
          where: {
            roomId_userId: {
              roomId,
              userId: socket.userId!,
            },
          },
        });

        if (!membership) {
          socket.emit('error', { message: 'Not a member of this room' });
          return;
        }

        // Create message
        const message = await prisma.chatMessage.create({
          data: {
            content: content?.trim() || '',
            roomId,
            senderId: socket.userId!,
            fileId: fileId || null,
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
                user: { select: { id: true, name: true } },
              },
            },
          },
        });

        // Broadcast to all room members (including sender)
        io?.to(`room:${roomId}`).emit('new-message', message);

        // Get room info for notifications
        const room = await prisma.chatRoom.findUnique({
          where: { id: roomId },
          select: { name: true, type: true },
        });

        // Extract mentioned users from message content
        const mentionRegex = /@([A-Za-z]+(?:\s+[A-Za-z]+)*)/g;
        const mentions: string[] = [];
        let match;
        while ((match = mentionRegex.exec(content)) !== null) {
          mentions.push(match[1].toLowerCase());
        }

        // Get room members with their names
        const roomMembers = await prisma.chatRoomMember.findMany({
          where: { roomId, userId: { not: socket.userId } },
          select: { userId: true, user: { select: { name: true } } },
        });

        // Create notifications
        for (const member of roomMembers) {
          const isMentioned = mentions.some(
            (mention) => member.user.name.toLowerCase() === mention
          );

          if (isMentioned) {
            // Create mention notification (higher priority)
            await prisma.notification.create({
              data: {
                type: 'CHAT_MENTION',
                title: 'You were mentioned',
                message: `${socket.userName} mentioned you in ${room?.type === 'DIRECT' ? 'a direct message' : room?.name || 'a chat'}: "${content.substring(0, 50)}${content.length > 50 ? '...' : ''}"`,
                userId: member.userId,
                data: { roomId, messageId: message.id, mentioned: true },
              },
            });

            // Emit real-time notification to mentioned user
            io?.to(`user:${member.userId}`).emit('mention-notification', {
              roomId,
              messageId: message.id,
              senderName: socket.userName,
              content: content.substring(0, 100),
              roomName: room?.name,
            });
          } else {
            // Regular message notification
            await prisma.notification.create({
              data: {
                type: 'CHAT_MESSAGE',
                title: 'New Message',
                message: `${socket.userName}: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
                userId: member.userId,
                data: { roomId, messageId: message.id },
              },
            });
          }
        }
      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing-start', (roomId: string) => {
      socket.to(`room:${roomId}`).emit('user-typing', {
        roomId,
        userId: socket.userId,
        userName: socket.userName,
      });
    });

    socket.on('typing-stop', (roomId: string) => {
      socket.to(`room:${roomId}`).emit('user-stopped-typing', {
        roomId,
        userId: socket.userId,
      });
    });

    // Mark messages as read
    socket.on('mark-read', async (roomId: string) => {
      try {
        await prisma.chatRoomMember.updateMany({
          where: {
            roomId,
            userId: socket.userId,
          },
          data: { lastSeenAt: new Date() },
        });
      } catch (error) {
        console.error('Mark read error:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userName}`);
      const offlineUserId = removeUserSocket(socket.id);
      if (offlineUserId) {
        // User has no more active sockets, they're offline
        io?.emit('user-offline', offlineUserId);
      }
    });
  });

  console.log('✅ Socket.io initialized');
  return io;
}

export function getIO(): Server | null {
  return io;
}

// Helper to emit to specific user
export function emitToUser(userId: string, event: string, data: unknown) {
  io?.to(`user:${userId}`).emit(event, data);
}

// Helper to emit to room
export function emitToRoom(roomId: string, event: string, data: unknown) {
  io?.to(`room:${roomId}`).emit(event, data);
}

// Check if user is online
export function isUserOnline(userId: string): boolean {
  return userSockets.has(userId);
}
