'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { ChatRoom, chatApi, User } from '@/lib/api';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { ChatMessageArea } from '@/components/chat/chat-message-area';
import { ChatMembersSidebar } from '@/components/chat/chat-members-sidebar';
import { useOnlineUsers } from '@/hooks/use-socket';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Hash, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ChatPage() {
  const { accessToken, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [showMembers, setShowMembers] = useState(true);
  const onlineUsers = useOnlineUsers();

  const leaveRoomMutation = useMutation({
    mutationFn: () => chatApi.leaveRoom(selectedRoom!.id, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
      setSelectedRoom(null);
      toast({ title: 'Left room successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to leave room', variant: 'destructive' });
    },
  });

  const startDMMutation = useMutation({
    mutationFn: (otherUser: User) => chatApi.getOrCreateDM(otherUser.id, accessToken!),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
      setSelectedRoom(response.data);
    },
    onError: () => {
      toast({ title: 'Failed to start conversation', variant: 'destructive' });
    },
  });

  const handleStartDM = (otherUser: User) => {
    startDMMutation.mutate(otherUser);
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex -m-6 bg-[hsl(var(--layout-bg))]">
      {/* Sidebar - full width on mobile when no room selected, fixed w-60 on lg+ */}
      <div className={cn(
        'shrink-0 lg:block lg:w-60',
        selectedRoom ? 'hidden' : 'block w-full'
      )}>
        <ChatSidebar
          selectedRoomId={selectedRoom?.id || null}
          onSelectRoom={setSelectedRoom}
          onStartDM={handleStartDM}
          onlineUsers={onlineUsers}
        />
      </div>

      {/* Main Chat Area - hidden on mobile when no room, visible when room selected */}
      <div className={cn(
        'flex-1 flex min-w-0',
        selectedRoom ? 'flex' : 'hidden lg:flex'
      )}>
        {selectedRoom ? (
          <>
            <div className="flex-1 flex flex-col min-w-0">
              {/* Mobile back button */}
              <div className="lg:hidden flex items-center gap-2 px-4 py-2 border-b border-[hsl(var(--layout-border))] bg-[hsl(var(--layout-card))]">
                <button
                  onClick={() => setSelectedRoom(null)}
                  className="flex items-center gap-1 text-sm text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              </div>
              <div className="flex-1">
                <ChatMessageArea
                  room={selectedRoom}
                  onlineUsers={onlineUsers}
                  onLeaveRoom={() => leaveRoomMutation.mutate()}
                />
              </div>
            </div>
            {/* Members Sidebar - hidden on mobile, visible on lg+ for group chats */}
            {selectedRoom.type !== 'DIRECT' && showMembers && (
              <div className="hidden lg:block w-60 shrink-0">
                <ChatMembersSidebar room={selectedRoom} onlineUsers={onlineUsers} />
              </div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[hsl(var(--layout-card))] text-[hsl(var(--text-secondary))]">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-[hsl(var(--text-primary))] mb-2">Welcome to Chat</h2>
              <p className="text-[hsl(var(--text-secondary))] max-w-md">
                Select a conversation from the sidebar or start a new one.
                <br />
                You can message team members directly or create group chats.
              </p>
              <div className="flex items-center justify-center gap-4 mt-8 text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full" />
                  <span>{onlineUsers.size} online</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
