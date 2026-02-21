'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { chatApi, usersApi, ChatRoom, User } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Hash,
  Users,
  Plus,
  Search,
  MessageCircle,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Mail,
  AtSign,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  selectedRoomId: string | null;
  onSelectRoom: (room: ChatRoom) => void;
  onStartDM: (user: User) => void;
  onlineUsers: Set<string>;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export function ChatSidebar({
  selectedRoomId,
  onSelectRoom,
  onStartDM,
  onlineUsers,
}: ChatSidebarProps) {
  const { user, accessToken } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showStartDM, setShowStartDM] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [dmExpanded, setDmExpanded] = useState(true);
  const [groupsExpanded, setGroupsExpanded] = useState(true);
  const [dmSearchQuery, setDmSearchQuery] = useState('');

  const { data: roomsData } = useQuery({
    queryKey: ['chatRooms'],
    queryFn: () => chatApi.getRooms(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const rooms = roomsData?.data || [];
  const users = usersData?.data || [];

  const directMessages = rooms.filter((r) => r.type === 'DIRECT');
  const groupChats = rooms.filter((r) => r.type === 'GROUP' || r.type === 'PROJECT');

  const filteredDMs = directMessages.filter((room) => {
    const otherMember = room.members.find((m) => m.user.id !== user?.id);
    return otherMember?.user.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredGroups = groupChats.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter users for DM search - search by name or email
  const filteredUsersForDM = useMemo(() => {
    const otherUsers = users.filter((u) => u.id !== user?.id);
    if (!dmSearchQuery.trim()) return otherUsers;

    const query = dmSearchQuery.toLowerCase();
    return otherUsers.filter(
      (u) =>
        u.name.toLowerCase().includes(query) ||
        u.email.toLowerCase().includes(query)
    );
  }, [users, user?.id, dmSearchQuery]);

  // Check if user already has a DM with someone
  const hasExistingDM = (userId: string) => {
    return directMessages.some((room) =>
      room.members.some((m) => m.user.id === userId)
    );
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !accessToken) return;

    try {
      const response = await chatApi.createRoom(
        { name: newGroupName.trim(), type: 'GROUP', memberIds: selectedMembers },
        accessToken
      );
      onSelectRoom(response.data);
      setShowCreateGroup(false);
      setNewGroupName('');
      setSelectedMembers([]);
    } catch (error) {
      console.error('Failed to create group:', error);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="w-full bg-[hsl(var(--layout-card))] flex flex-col h-full border-r border-[hsl(var(--layout-border))]">
      {/* Header */}
      <div className="h-12 px-4 flex items-center border-b border-[hsl(var(--layout-border))] shadow-sm">
        <h2 className="font-semibold text-[hsl(var(--text-primary))]">Messages</h2>
      </div>

      {/* Search */}
      <div className="p-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Find or start a conversation"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500 h-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {/* Direct Messages Section */}
        <div className="px-2 py-1">
          <button
            className="flex items-center justify-between w-full px-1 py-1 text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase"
            onClick={() => setDmExpanded(!dmExpanded)}
          >
            <span className="flex items-center gap-1">
              {dmExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Direct Messages
            </span>
            <Dialog open={showStartDM} onOpenChange={setShowStartDM}>
              <DialogTrigger asChild>
                <Plus
                  className="h-4 w-4 hover:text-white cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </DialogTrigger>
              <DialogContent className="bg-[#131d2e] border-slate-700 text-white">
                <DialogHeader>
                  <DialogTitle>Start a Direct Message</DialogTitle>
                  <DialogDescription className="text-slate-400">
                    Search for team members by name or email to start a conversation
                  </DialogDescription>
                </DialogHeader>
                <div className="mt-4 space-y-4">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by name or email..."
                      value={dmSearchQuery}
                      onChange={(e) => setDmSearchQuery(e.target.value)}
                      className="pl-10 bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                      autoFocus
                    />
                  </div>

                  {/* User List */}
                  <ScrollArea className="h-72">
                    <div className="space-y-1">
                      {filteredUsersForDM.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                          <AtSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No users found</p>
                          <p className="text-xs mt-1">Try searching with a different name or email</p>
                        </div>
                      ) : (
                        filteredUsersForDM.map((u) => {
                          const hasDM = hasExistingDM(u.id);
                          return (
                            <button
                              key={u.id}
                              className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-slate-700/50 transition-colors group"
                              onClick={() => {
                                onStartDM(u);
                                setShowStartDM(false);
                                setDmSearchQuery('');
                              }}
                            >
                              <div className="relative">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={u.avatar} />
                                  <AvatarFallback className="bg-blue-500 text-white text-sm">
                                    {getInitials(u.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span
                                  className={cn(
                                    'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#131d2e]',
                                    onlineUsers.has(u.id) ? 'bg-green-500' : 'bg-slate-500'
                                  )}
                                />
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium truncate">{u.name}</p>
                                  {hasDM && (
                                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 text-[10px] px-1.5 py-0">
                                      Existing
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-slate-400">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate">{u.email}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5">{u.role}</p>
                              </div>
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <MessageCircle className="h-5 w-5 text-blue-400" />
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </ScrollArea>

                  {/* Helper Text */}
                  <p className="text-xs text-slate-500 text-center">
                    {users.length - 1} team member{users.length - 1 !== 1 ? 's' : ''} available
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </button>

          {dmExpanded && (
            <div className="mt-1 space-y-0.5">
              {filteredDMs.map((room) => {
                const otherMember = room.members.find((m) => m.user.id !== user?.id);
                const isSelected = room.id === selectedRoomId;
                const isOnline = otherMember ? onlineUsers.has(otherMember.user.id) : false;

                return (
                  <button
                    key={room.id}
                    onClick={() => onSelectRoom(room)}
                    className={cn(
                      'flex items-center gap-3 w-full px-2 py-1.5 rounded text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors',
                      isSelected && 'bg-slate-700/50 text-white'
                    )}
                  >
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={otherMember?.user.avatar} />
                        <AvatarFallback className="bg-blue-500 text-white text-xs">
                          {otherMember ? getInitials(otherMember.user.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className={cn(
                          'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#131d2e]',
                          isOnline ? 'bg-green-500' : 'bg-slate-500'
                        )}
                      />
                    </div>
                    <span className="flex-1 text-left text-sm truncate">
                      {otherMember?.user.name || 'Unknown'}
                    </span>
                    {room.unreadCount && room.unreadCount > 0 && (
                      <Badge className="bg-red-500 text-white text-xs px-1.5 py-0 min-w-[18px] h-[18px]">
                        {room.unreadCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Groups Section */}
        <div className="px-2 py-1 mt-2">
          <button
            className="flex items-center justify-between w-full px-1 py-1 text-xs font-semibold text-slate-400 hover:text-slate-200 uppercase"
            onClick={() => setGroupsExpanded(!groupsExpanded)}
          >
            <span className="flex items-center gap-1">
              {groupsExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Groups
            </span>
            <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
              <DialogTrigger asChild>
                <Plus
                  className="h-4 w-4 hover:text-white cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                />
              </DialogTrigger>
              <DialogContent className="bg-[#131d2e] border-slate-700 text-white">
                <DialogHeader>
                  <DialogTitle>Create a Group</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label className="text-slate-400 text-xs uppercase">Group Name</Label>
                    <Input
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g., Project Alpha Team"
                      className="mt-2 bg-[#0a1628] border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-slate-400 text-xs uppercase">Add Members</Label>
                    <ScrollArea className="h-48 mt-2 bg-[#0a1628] rounded-md border border-slate-700">
                      <div className="p-2 space-y-1">
                        {users
                          .filter((u) => u.id !== user?.id)
                          .map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center gap-3 p-2 rounded hover:bg-slate-700/50 cursor-pointer"
                              onClick={() => toggleMember(u.id)}
                            >
                              <Checkbox
                                checked={selectedMembers.includes(u.id)}
                                className="border-slate-500"
                              />
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={u.avatar} />
                                <AvatarFallback className="bg-blue-500 text-white text-xs">
                                  {getInitials(u.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{u.name}</span>
                            </div>
                          ))}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setShowCreateGroup(false)} className="text-white hover:bg-slate-700/50">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleCreateGroup}
                      disabled={!newGroupName.trim()}
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      Create Group
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </button>

          {groupsExpanded && (
            <div className="mt-1 space-y-0.5">
              {filteredGroups.map((room) => {
                const isSelected = room.id === selectedRoomId;

                return (
                  <button
                    key={room.id}
                    onClick={() => onSelectRoom(room)}
                    className={cn(
                      'flex items-center gap-2 w-full px-2 py-1.5 rounded text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition-colors',
                      isSelected && 'bg-slate-700/50 text-white'
                    )}
                  >
                    <Hash className="h-5 w-5 text-slate-500" />
                    <span className="flex-1 text-left text-sm truncate">{room.name}</span>
                    {room.unreadCount && room.unreadCount > 0 && (
                      <Badge className="bg-red-500 text-white text-xs px-1.5 py-0 min-w-[18px] h-[18px]">
                        {room.unreadCount}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* User Panel */}
      <div className="h-14 px-2 bg-[hsl(var(--layout-bg))] border-t border-[hsl(var(--layout-border))] flex items-center gap-2">
        <div className="relative">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-blue-500 text-white text-xs">
              {user ? getInitials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-[#0a1628]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[hsl(var(--text-primary))] truncate">{user?.name}</p>
          <p className="text-xs text-slate-400">Online</p>
        </div>
      </div>
    </div>
  );
}
