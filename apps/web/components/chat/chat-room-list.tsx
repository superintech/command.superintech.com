'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { chatApi, ChatRoom, usersApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  Users,
  User,
  MessageSquare,
  Hash,
  Search,
} from 'lucide-react';

interface ChatRoomListProps {
  selectedRoomId: string | null;
  onSelectRoom: (room: ChatRoom) => void;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function getRoomDisplayName(room: ChatRoom, currentUserId: string) {
  if (room.type === 'DIRECT') {
    const otherMember = room.members.find((m) => m.user.id !== currentUserId);
    return otherMember?.user.name || 'Direct Message';
  }
  return room.name;
}

function getRoomAvatar(room: ChatRoom, currentUserId: string) {
  if (room.type === 'DIRECT') {
    const otherMember = room.members.find((m) => m.user.id !== currentUserId);
    return otherMember?.user.avatar;
  }
  return undefined;
}

export function ChatRoomList({ selectedRoomId, onSelectRoom }: ChatRoomListProps) {
  const { user, accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const { data: roomsData, isLoading } = useQuery({
    queryKey: ['chatRooms'],
    queryFn: () => chatApi.getRooms(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(accessToken!),
    enabled: !!accessToken && showCreateDialog,
  });

  const createRoomMutation = useMutation({
    mutationFn: (data: { name: string; memberIds: string[] }) =>
      chatApi.createRoom(data, accessToken!),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
      setShowCreateDialog(false);
      setNewRoomName('');
      setSelectedMembers([]);
      onSelectRoom(response.data);
      toast({ title: 'Room created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create room', variant: 'destructive' });
    },
  });

  const rooms = roomsData?.data || [];
  const users = usersData?.data || [];

  const filteredRooms = rooms.filter((room) => {
    const displayName = getRoomDisplayName(room, user?.id || '');
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleCreateRoom = () => {
    if (!newRoomName.trim()) {
      toast({ title: 'Room name is required', variant: 'destructive' });
      return;
    }
    createRoomMutation.mutate({
      name: newRoomName.trim(),
      memberIds: selectedMembers,
    });
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  return (
    <div className="flex flex-col h-full border-r">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Messages</h2>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Chat Room</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div>
                  <Label>Room Name</Label>
                  <Input
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="e.g., Project Discussion"
                  />
                </div>
                <div>
                  <Label>Add Members</Label>
                  <ScrollArea className="h-48 border rounded-md mt-2">
                    <div className="p-2 space-y-2">
                      {users
                        .filter((u) => u.id !== user?.id)
                        .map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
                            onClick={() => toggleMember(u.id)}
                          >
                            <Checkbox
                              checked={selectedMembers.includes(u.id)}
                              onCheckedChange={() => toggleMember(u.id)}
                            />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={u.avatar} />
                              <AvatarFallback>{getInitials(u.name)}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{u.name}</p>
                              <p className="text-xs text-gray-500">{u.role}</p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateRoom}
                    disabled={createRoomMutation.isPending}
                  >
                    Create Room
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Room List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 rounded-lg animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-24 mb-1" />
                      <div className="h-3 bg-gray-200 rounded w-32" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredRooms.map((room) => {
                const displayName = getRoomDisplayName(room, user?.id || '');
                const avatar = getRoomAvatar(room, user?.id || '');
                const isSelected = room.id === selectedRoomId;

                return (
                  <button
                    key={room.id}
                    onClick={() => onSelectRoom(room)}
                    className={`w-full p-3 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={avatar} />
                        <AvatarFallback>
                          {room.type === 'DIRECT' ? (
                            <User className="h-5 w-5" />
                          ) : room.type === 'GROUP' ? (
                            <Users className="h-5 w-5" />
                          ) : (
                            <Hash className="h-5 w-5" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-sm truncate">
                            {displayName}
                          </p>
                          {room.lastMessage && (
                            <span className="text-xs text-gray-400">
                              {formatDistanceToNow(new Date(room.lastMessage.createdAt), {
                                addSuffix: false,
                              })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-gray-500 truncate">
                            {room.lastMessage ? (
                              <>
                                {room.lastMessage.sender.id === user?.id
                                  ? 'You: '
                                  : `${room.lastMessage.sender.name}: `}
                                {room.lastMessage.content.substring(0, 30)}
                                {room.lastMessage.content.length > 30 ? '...' : ''}
                              </>
                            ) : (
                              `${room.members.length} members`
                            )}
                          </p>
                          {room.unreadCount && room.unreadCount > 0 && (
                            <Badge className="ml-2 h-5 min-w-[20px] px-1.5">
                              {room.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
