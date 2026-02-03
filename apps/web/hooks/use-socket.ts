'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/lib/auth-store';
import { ChatMessage } from '@/lib/api';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface MentionNotification {
  roomId: string;
  messageId: string;
  senderName: string;
  content: string;
  roomName?: string;
}

interface UseSocketOptions {
  onMessage?: (message: ChatMessage) => void;
  onUserJoined?: (data: { roomId: string; userId: string; userName: string }) => void;
  onUserLeft?: (data: { roomId: string; userId: string; userName: string }) => void;
  onUserTyping?: (data: { roomId: string; userId: string; userName: string }) => void;
  onUserStoppedTyping?: (data: { roomId: string; userId: string }) => void;
  onOnlineUsersUpdate?: (userIds: string[]) => void;
  onMentionNotification?: (data: MentionNotification) => void;
  onError?: (error: { message: string }) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { accessToken, user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  // Initialize socket connection
  useEffect(() => {
    if (!accessToken) return;

    const socket = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      // Request online users list
      socket.emit('get-online-users');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setIsConnected(false);
    });

    socket.on('new-message', (message: ChatMessage) => {
      options.onMessage?.(message);
    });

    socket.on('user-joined', (data) => {
      options.onUserJoined?.(data);
    });

    socket.on('user-left', (data) => {
      options.onUserLeft?.(data);
    });

    socket.on('user-typing', (data) => {
      options.onUserTyping?.(data);
    });

    socket.on('user-stopped-typing', (data) => {
      options.onUserStoppedTyping?.(data);
    });

    socket.on('online-users', (userIds: string[]) => {
      setOnlineUsers(new Set(userIds));
      options.onOnlineUsersUpdate?.(userIds);
    });

    socket.on('user-online', (userId: string) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });

    socket.on('user-offline', (userId: string) => {
      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        updated.delete(userId);
        return updated;
      });
    });

    socket.on('mention-notification', (data: MentionNotification) => {
      options.onMentionNotification?.(data);
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
      options.onError?.(error);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [accessToken]);

  // Join a chat room
  const joinRoom = useCallback((roomId: string) => {
    if (socketRef.current && roomId) {
      // Leave previous room if any
      if (currentRoomId && currentRoomId !== roomId) {
        socketRef.current.emit('leave-room', currentRoomId);
      }
      socketRef.current.emit('join-room', roomId);
      setCurrentRoomId(roomId);
    }
  }, [currentRoomId]);

  // Leave current room
  const leaveRoom = useCallback(() => {
    if (socketRef.current && currentRoomId) {
      socketRef.current.emit('leave-room', currentRoomId);
      setCurrentRoomId(null);
    }
  }, [currentRoomId]);

  // Send a message
  const sendMessage = useCallback((content: string, fileId?: string) => {
    // Allow sending if there's content OR a file
    if (socketRef.current && currentRoomId && (content.trim() || fileId)) {
      socketRef.current.emit('send-message', {
        roomId: currentRoomId,
        content: content.trim() || '', // Send empty string if no text but has file
        fileId,
      });
    }
  }, [currentRoomId]);

  // Typing indicators
  const startTyping = useCallback(() => {
    if (socketRef.current && currentRoomId) {
      socketRef.current.emit('typing-start', currentRoomId);
    }
  }, [currentRoomId]);

  const stopTyping = useCallback(() => {
    if (socketRef.current && currentRoomId) {
      socketRef.current.emit('typing-stop', currentRoomId);
    }
  }, [currentRoomId]);

  // Mark messages as read
  const markAsRead = useCallback(() => {
    if (socketRef.current && currentRoomId) {
      socketRef.current.emit('mark-read', currentRoomId);
    }
  }, [currentRoomId]);

  return {
    isConnected,
    currentRoomId,
    onlineUsers,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead,
  };
}

// Global socket for online status tracking across components
let globalSocket: Socket | null = null;
let globalOnlineUsers = new Set<string>();
const listeners = new Set<(users: Set<string>) => void>();

export function useOnlineUsers() {
  const { accessToken } = useAuthStore();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(globalOnlineUsers);

  useEffect(() => {
    const listener = (users: Set<string>) => {
      setOnlineUsers(new Set(users));
    };
    listeners.add(listener);

    if (!globalSocket && accessToken) {
      globalSocket = io(SOCKET_URL, {
        auth: { token: accessToken },
        transports: ['websocket', 'polling'],
      });

      globalSocket.on('connect', () => {
        globalSocket?.emit('get-online-users');
      });

      globalSocket.on('online-users', (userIds: string[]) => {
        globalOnlineUsers = new Set(userIds);
        listeners.forEach((l) => l(globalOnlineUsers));
      });

      globalSocket.on('user-online', (userId: string) => {
        globalOnlineUsers.add(userId);
        listeners.forEach((l) => l(new Set(globalOnlineUsers)));
      });

      globalSocket.on('user-offline', (userId: string) => {
        globalOnlineUsers.delete(userId);
        listeners.forEach((l) => l(new Set(globalOnlineUsers)));
      });
    }

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0 && globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
      }
    };
  }, [accessToken]);

  return onlineUsers;
}
