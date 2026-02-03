'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { chatApi, api, ChatRoom, ChatMessage, API_URL } from '@/lib/api';
import { useSocket } from '@/hooks/use-socket';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from '@/hooks/use-toast';
import { EmojiPicker } from './emoji-picker';
import { MentionInput, renderMessageWithMentions } from './mention-input';
import {
  Send,
  Smile,
  Paperclip,
  Hash,
  Users,
  Settings,
  UserPlus,
  LogOut,
  MoreVertical,
  X,
  Download,
  FileIcon,
  Image as ImageIcon,
  AtSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessageAreaProps {
  room: ChatRoom;
  onlineUsers: Set<string>;
  onLeaveRoom?: () => void;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatMessageTime(date: Date) {
  return format(date, 'h:mm a');
}

function formatDateDivider(date: Date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

function getRoomDisplayName(room: ChatRoom, currentUserId: string) {
  if (room.type === 'DIRECT') {
    const otherMember = room.members.find((m) => m.user.id !== currentUserId);
    return otherMember?.user.name || 'Direct Message';
  }
  return room.name;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export function ChatMessageArea({ room, onlineUsers, onLeaveRoom }: ChatMessageAreaProps) {
  const { user, accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isConnected,
    joinRoom,
    leaveRoom,
    sendMessage: socketSendMessage,
    startTyping,
    stopTyping,
    markAsRead,
  } = useSocket({
    onMessage: useCallback(
      (newMessage: ChatMessage) => {
        if (newMessage.roomId === room.id) {
          setMessages((prev) => [...prev, newMessage]);
          queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
        }
      },
      [room.id, queryClient]
    ),
    onUserTyping: useCallback(
      (data: { roomId: string; userId: string; userName: string }) => {
        if (data.roomId === room.id && data.userId !== user?.id) {
          setTypingUsers((prev) => new Map(prev).set(data.userId, data.userName));
        }
      },
      [room.id, user?.id]
    ),
    onUserStoppedTyping: useCallback(
      (data: { roomId: string; userId: string }) => {
        if (data.roomId === room.id) {
          setTypingUsers((prev) => {
            const updated = new Map(prev);
            updated.delete(data.userId);
            return updated;
          });
        }
      },
      [room.id]
    ),
  });

  // Load initial messages
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['chatMessages', room.id],
    queryFn: () => chatApi.getMessages(room.id, accessToken!, { limit: 100 }),
    enabled: !!accessToken && !!room.id,
  });

  // Toggle reaction mutation
  const toggleReactionMutation = useMutation({
    mutationFn: ({ messageId, emoji }: { messageId: string; emoji: string }) =>
      chatApi.toggleReaction(messageId, emoji, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatMessages', room.id] });
    },
  });

  useEffect(() => {
    if (messagesData?.data) {
      setMessages(messagesData.data);
    }
  }, [messagesData]);

  useEffect(() => {
    joinRoom(room.id);
    markAsRead();
    return () => {
      leaveRoom();
    };
  }, [room.id, joinRoom, leaveRoom, markAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value);
    startTyping();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 2000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      console.log('File selected:', file.name, file.type, file.size);
      if (file.size > 50 * 1024 * 1024) {
        toast({ title: 'File too large', description: 'Maximum file size is 50MB', variant: 'destructive' });
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async (): Promise<string | null> => {
    if (!selectedFile || !accessToken) {
      console.error('Upload failed: No file or token', { selectedFile, hasToken: !!accessToken });
      return null;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('files', selectedFile); // Backend expects 'files' not 'file'

      console.log('Uploading file:', selectedFile.name, selectedFile.type, selectedFile.size);

      const response = await api.uploadFiles<{ success: boolean; data: Array<{ id: string }> }>(
        '/api/files/upload',
        formData,
        accessToken
      );

      console.log('Upload response:', response);

      // Response returns array of files, get the first one
      if (response.data && response.data.length > 0) {
        return response.data[0].id;
      }

      console.error('Upload succeeded but no file ID returned:', response);
      toast({ title: 'Upload failed', description: 'No file ID returned', variant: 'destructive' });
      return null;
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: 'Upload failed',
        description: errorMessage,
        variant: 'destructive'
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async () => {
    if ((!message.trim() && !selectedFile) || !isConnected) return;

    let fileId: string | undefined;
    if (selectedFile) {
      const uploadedFileId = await uploadFile();
      if (uploadedFileId) {
        fileId = uploadedFileId;
      } else if (!message.trim()) {
        return;
      }
    }

    socketSendMessage(message.trim() || ' ', fileId);
    setMessage('');
    setSelectedFile(null);
    stopTyping();

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
  };

  const handleReaction = (messageId: string, emoji: string) => {
    toggleReactionMutation.mutate({ messageId, emoji });
  };

  const displayName = getRoomDisplayName(room, user?.id || '');
  const typingUserNames = Array.from(typingUsers.values());

  // Group messages by date
  const groupedMessages: { date: Date; messages: ChatMessage[] }[] = [];
  messages.forEach((msg) => {
    const msgDate = new Date(msg.createdAt);
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (!lastGroup || !isSameDay(lastGroup.date, msgDate)) {
      groupedMessages.push({ date: msgDate, messages: [msg] });
    } else {
      lastGroup.messages.push(msg);
    }
  });

  return (
    <div className="flex flex-col h-full bg-[#131d2e]">
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-slate-700 shadow-sm">
        <div className="flex items-center gap-2">
          {room.type === 'DIRECT' ? (
            <span className="text-slate-400">@</span>
          ) : (
            <Hash className="h-5 w-5 text-slate-400" />
          )}
          <h3 className="font-semibold text-white">{displayName}</h3>
          {room.type === 'DIRECT' && (
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                onlineUsers.has(room.members.find((m) => m.user.id !== user?.id)?.user.id || '')
                  ? 'bg-green-500'
                  : 'bg-slate-500'
              )}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          {room.type !== 'DIRECT' && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50">
                    <Users className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{room.members.length} members</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white hover:bg-slate-700/50">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0a1628] border-slate-700 text-slate-200">
              {room.type !== 'DIRECT' && (
                <>
                  <DropdownMenuItem className="hover:bg-slate-700/50 cursor-pointer focus:bg-slate-700/50">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Members
                  </DropdownMenuItem>
                  <DropdownMenuItem className="hover:bg-slate-700/50 cursor-pointer focus:bg-slate-700/50">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-red-400 hover:bg-slate-700/50 cursor-pointer focus:bg-slate-700/50 focus:text-red-400"
                    onClick={onLeaveRoom}
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Leave Group
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400">
            <Hash className="h-16 w-16 mb-4 opacity-30" />
            <h3 className="text-xl font-semibold text-white">
              Welcome to #{displayName}
            </h3>
            <p className="text-sm mt-1">This is the start of your conversation</p>
          </div>
        ) : (
          <div className="py-4">
            {groupedMessages.map((group, groupIndex) => (
              <div key={groupIndex}>
                {/* Date Divider */}
                <div className="flex items-center gap-2 my-4">
                  <div className="flex-1 h-px bg-slate-700" />
                  <span className="text-xs text-slate-400 font-medium">
                    {formatDateDivider(group.date)}
                  </span>
                  <div className="flex-1 h-px bg-slate-700" />
                </div>

                {/* Messages */}
                {group.messages.map((msg, index) => {
                  const isOwn = msg.sender.id === user?.id;
                  const prevMsg = index > 0 ? group.messages[index - 1] : null;
                  const showHeader =
                    !prevMsg ||
                    prevMsg.sender.id !== msg.sender.id ||
                    new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() > 5 * 60 * 1000;

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'group relative hover:bg-slate-700/30 rounded px-2 py-0.5',
                        showHeader && 'mt-4 pt-1'
                      )}
                    >
                      <div className="flex gap-4">
                        {showHeader ? (
                          <Avatar className="h-10 w-10 mt-0.5">
                            <AvatarImage src={msg.sender.avatar} />
                            <AvatarFallback className="bg-blue-500 text-white text-sm">
                              {getInitials(msg.sender.name)}
                            </AvatarFallback>
                          </Avatar>
                        ) : (
                          <div className="w-10 flex items-center justify-center">
                            <span className="text-[10px] text-slate-500 opacity-0 group-hover:opacity-100">
                              {format(new Date(msg.createdAt), 'h:mm')}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {showHeader && (
                            <div className="flex items-baseline gap-2">
                              <span className="font-medium text-white hover:underline cursor-pointer">
                                {msg.sender.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {formatMessageTime(new Date(msg.createdAt))}
                              </span>
                            </div>
                          )}
                          <div className="text-slate-200 break-words">
                            {renderMessageWithMentions(
                              msg.content,
                              room.members.map((m) => ({
                                id: m.user.id,
                                name: m.user.name,
                                avatar: m.user.avatar,
                                role: m.user.role,
                              })),
                              user?.id
                            )}
                          </div>

                          {/* File Attachment */}
                          {msg.file && (
                            <div className="mt-2 max-w-md">
                              {msg.file.mimeType.startsWith('image/') ? (
                                <div className="rounded-lg overflow-hidden bg-[#0a1628]">
                                  <img
                                    src={`${API_URL}/api/files/${msg.file.id}/download`}
                                    alt={msg.file.originalName}
                                    className="max-w-full max-h-80 object-contain"
                                  />
                                </div>
                              ) : (
                                <a
                                  href={`${API_URL}/api/files/${msg.file.id}/download`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-3 p-3 bg-[#0a1628] rounded-lg hover:bg-slate-700/50 transition-colors border border-slate-700"
                                >
                                  <FileIcon className="h-10 w-10 text-slate-400" />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-blue-400 hover:underline truncate">
                                      {msg.file.originalName}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {(msg.file.size / 1024).toFixed(1)} KB
                                    </p>
                                  </div>
                                  <Download className="h-5 w-5 text-slate-400" />
                                </a>
                              )}
                            </div>
                          )}

                          {/* Reactions */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {Object.entries(
                                msg.reactions.reduce((acc, r) => {
                                  acc[r.emoji] = acc[r.emoji] || [];
                                  acc[r.emoji].push(r.user.name);
                                  return acc;
                                }, {} as Record<string, string[]>)
                              ).map(([emoji, users]) => (
                                <button
                                  key={emoji}
                                  onClick={() => handleReaction(msg.id, emoji)}
                                  className={cn(
                                    'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
                                    'bg-[#0a1628] hover:bg-slate-700/50 border border-slate-700',
                                    users.includes(user?.name || '') && 'border-blue-500 bg-blue-500/20'
                                  )}
                                >
                                  <span>{emoji}</span>
                                  <span className="text-slate-400">{users.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Reaction Button */}
                        <div className="opacity-0 group-hover:opacity-100 absolute right-2 -top-3 flex items-center gap-0.5 bg-[#0a1628] rounded border border-slate-700">
                          {REACTION_EMOJIS.slice(0, 4).map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => handleReaction(msg.id, emoji)}
                              className="p-1 hover:bg-slate-700/50 rounded text-sm"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Typing Indicator */}
        {typingUserNames.length > 0 && (
          <div className="flex items-center gap-2 text-sm text-slate-400 px-4 py-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            </div>
            <span>
              <strong>{typingUserNames.join(', ')}</strong>
              {typingUserNames.length === 1 ? ' is typing...' : ' are typing...'}
            </span>
          </div>
        )}
      </ScrollArea>

      {/* File Preview */}
      {selectedFile && (
        <div className="px-4 py-2 bg-[#0a1628] border-t border-slate-700">
          <div className="flex items-center gap-3 p-2 bg-[#131d2e] rounded-lg border border-slate-700">
            {selectedFile.type.startsWith('image/') ? (
              <ImageIcon className="h-8 w-8 text-slate-400" />
            ) : (
              <FileIcon className="h-8 w-8 text-slate-400" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{selectedFile.name}</p>
              <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedFile(null)}
              className="text-slate-400 hover:text-white hover:bg-slate-700/50"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4">
        <div className="flex items-center gap-2 bg-[#0a1628] border border-slate-700 rounded-lg px-4 py-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.zip,.rar,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="text-slate-400 hover:text-white hover:bg-slate-700/50 h-8 w-8"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          {room.type !== 'DIRECT' ? (
            <MentionInput
              value={message}
              onChange={(val) => {
                setMessage(val);
                startTyping();
                if (typingTimeoutRef.current) {
                  clearTimeout(typingTimeoutRef.current);
                }
                typingTimeoutRef.current = setTimeout(() => {
                  stopTyping();
                }, 2000);
              }}
              onKeyPress={handleKeyPress}
              members={room.members.map((m) => ({
                id: m.user.id,
                name: m.user.name,
                avatar: m.user.avatar,
                role: m.user.role,
              }))}
              placeholder={`Message #${displayName} — Type @ to mention`}
              disabled={!isConnected || isUploading}
            />
          ) : (
            <Input
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={`Message @${displayName}`}
              disabled={!isConnected || isUploading}
              className="flex-1 bg-transparent border-0 text-white placeholder:text-slate-500 focus-visible:ring-0"
            />
          )}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="text-slate-400 hover:text-white hover:bg-slate-700/50 h-8 w-8"
            >
              <Smile className="h-5 w-5" />
            </Button>
            {showEmojiPicker && (
              <EmojiPicker
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
          <Button
            onClick={handleSendMessage}
            disabled={(!message.trim() && !selectedFile) || !isConnected || isUploading}
            size="icon"
            className="bg-blue-500 hover:bg-blue-600 h-8 w-8"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {!isConnected && (
          <p className="text-xs text-yellow-500 mt-1 text-center">Connecting to chat server...</p>
        )}
      </div>
    </div>
  );
}
