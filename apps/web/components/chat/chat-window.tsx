'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { chatApi, ChatRoom, ChatMessage } from '@/lib/api';
import { useSocket } from '@/hooks/use-socket';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import {
  Send,
  MoreVertical,
  Users,
  Settings,
  LogOut,
  Smile,
  Paperclip,
  User,
  Hash,
} from 'lucide-react';

interface ChatWindowProps {
  room: ChatRoom;
  onLeaveRoom?: () => void;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatMessageDate(date: Date) {
  if (isToday(date)) {
    return format(date, 'h:mm a');
  }
  if (isYesterday(date)) {
    return 'Yesterday ' + format(date, 'h:mm a');
  }
  return format(date, 'MMM d, h:mm a');
}

function getRoomDisplayName(room: ChatRoom, currentUserId: string) {
  if (room.type === 'DIRECT') {
    const otherMember = room.members.find((m) => m.user.id !== currentUserId);
    return otherMember?.user.name || 'Direct Message';
  }
  return room.name;
}

export function ChatWindow({ room, onLeaveRoom }: ChatWindowProps) {
  const { user, accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Socket connection
  const {
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage: socketSendMessage,
    startTyping,
    stopTyping,
    markAsRead,
  } = useSocket({
    onMessage: useCallback((newMessage: ChatMessage) => {
      if (newMessage.roomId === room.id) {
        setMessages((prev) => [...prev, newMessage]);
        // Invalidate rooms to update unread counts
        queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
      }
    }, [room.id, queryClient]),
    onUserTyping: useCallback((data: { roomId: string; userId: string; userName: string }) => {
      if (data.roomId === room.id && data.userId !== user?.id) {
        setTypingUsers((prev) => new Map(prev).set(data.userId, data.userName));
      }
    }, [room.id, user?.id]),
    onUserStoppedTyping: useCallback((data: { roomId: string; userId: string }) => {
      if (data.roomId === room.id) {
        setTypingUsers((prev) => {
          const updated = new Map(prev);
          updated.delete(data.userId);
          return updated;
        });
      }
    }, [room.id]),
  });

  // Load initial messages
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['chatMessages', room.id],
    queryFn: () => chatApi.getMessages(room.id, accessToken!, { limit: 100 }),
    enabled: !!accessToken && !!room.id,
  });

  // Set initial messages
  useEffect(() => {
    if (messagesData?.data) {
      setMessages(messagesData.data);
    }
  }, [messagesData]);

  // Join room on mount, leave on unmount
  useEffect(() => {
    joinRoom(room.id);
    markAsRead();

    return () => {
      leaveRoom();
    };
  }, [room.id, joinRoom, leaveRoom, markAsRead]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);

    // Send typing indicator
    startTyping();

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of no input
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  // Send message
  const handleSendMessage = () => {
    if (!message.trim()) return;

    socketSendMessage(message.trim());
    setMessage('');
    stopTyping();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const displayName = getRoomDisplayName(room, user?.id || '');
  const typingUserNames = Array.from(typingUsers.values());

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {room.type === 'DIRECT' ? (
              <AvatarFallback>
                <User className="h-5 w-5" />
              </AvatarFallback>
            ) : (
              <AvatarFallback>
                {room.type === 'GROUP' ? (
                  <Users className="h-5 w-5" />
                ) : (
                  <Hash className="h-5 w-5" />
                )}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <h3 className="font-semibold">{displayName}</h3>
            <p className="text-xs text-gray-500">
              {isConnected ? (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                  {room.members.length} members
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full" />
                  Connecting...
                </span>
              )}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Users className="h-4 w-4 mr-2" />
              View Members
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="h-4 w-4 mr-2" />
              Room Settings
            </DropdownMenuItem>
            {room.type !== 'DIRECT' && (
              <DropdownMenuItem
                className="text-red-600"
                onClick={onLeaveRoom}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Leave Room
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No messages yet</p>
            <p className="text-sm mt-1">Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const isOwn = msg.sender.id === user?.id;
              const showAvatar =
                index === 0 ||
                messages[index - 1].sender.id !== msg.sender.id;

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                >
                  {showAvatar ? (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={msg.sender.avatar} />
                      <AvatarFallback>
                        {getInitials(msg.sender.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <div className="w-8" />
                  )}
                  <div
                    className={`max-w-[70%] ${isOwn ? 'items-end' : 'items-start'}`}
                  >
                    {showAvatar && !isOwn && (
                      <p className="text-xs text-gray-500 mb-1">
                        {msg.sender.name}
                      </p>
                    )}
                    <div
                      className={`rounded-2xl px-4 py-2 ${
                        isOwn
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-gray-100'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.file && (
                        <div className="mt-2 p-2 bg-white/10 rounded">
                          <p className="text-xs">{msg.file.originalName}</p>
                        </div>
                      )}
                    </div>
                    <p
                      className={`text-xs text-gray-400 mt-1 ${
                        isOwn ? 'text-right' : ''
                      }`}
                    >
                      {formatMessageDate(new Date(msg.createdAt))}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Typing indicator */}
        {typingUserNames.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.1s' }}
              />
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: '0.2s' }}
              />
            </div>
            <span>
              {typingUserNames.length === 1
                ? `${typingUserNames[0]} is typing...`
                : `${typingUserNames.join(', ')} are typing...`}
            </span>
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="shrink-0">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button variant="ghost" size="icon" className="shrink-0">
            <Smile className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleSendMessage}
            disabled={!message.trim() || !isConnected}
            className="shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
