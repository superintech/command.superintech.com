'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { ChatRoom, chatApi, User } from '@/lib/api';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { ChatMessageArea } from '@/components/chat/chat-message-area';
import { ChatMembersSidebar } from '@/components/chat/chat-members-sidebar';
import { useOnlineUsers } from '@/hooks/use-socket';
import { toast } from '@/hooks/use-toast';
import { MessageSquare, Hash } from 'lucide-react';

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
    <div className="h-[calc(100vh-4rem)] flex -m-6 bg-[#0a1628]">
      {/* Sidebar - Chat rooms list */}
      <ChatSidebar
        selectedRoomId={selectedRoom?.id || null}
        onSelectRoom={setSelectedRoom}
        onStartDM={handleStartDM}
        onlineUsers={onlineUsers}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex">
        {selectedRoom ? (
          <>
            <div className="flex-1">
              <ChatMessageArea
                room={selectedRoom}
                onlineUsers={onlineUsers}
                onLeaveRoom={() => leaveRoomMutation.mutate()}
              />
            </div>
            {/* Members Sidebar - only for group chats */}
            {selectedRoom.type !== 'DIRECT' && showMembers && (
              <ChatMembersSidebar room={selectedRoom} onlineUsers={onlineUsers} />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center bg-[#131d2e] text-slate-400">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-2xl font-semibold text-white mb-2">Welcome to Chat</h2>
              <p className="text-slate-400 max-w-md">
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
