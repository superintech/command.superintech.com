'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { usersApi, teamsApi, invitationsApi, permissionsApi, departmentsApi, User, Team, UserInvitation, Permission } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Building2,
  Mail,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Shield,
  UserPlus,
  Send,
  RefreshCw,
  XCircle,
  Clock,
  CheckCircle,
  Copy,
  Eye,
  Phone,
  Briefcase,
  Calendar,
  UsersRound,
  KeyRound,
} from 'lucide-react';

export default function TeamPage() {
  const { accessToken, user: currentUser, hasPermission } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('users');
  const [search, setSearch] = useState('');

  // Dialogs
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [showEditUserDialog, setShowEditUserDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [showTeamMembersDialog, setShowTeamMembersDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Queries
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: teamsData, isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => invitationsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: permissionsData } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const users = usersData?.data || [];
  const teams = teamsData?.data || [];
  const invitations = invitationsData?.data || [];
  const permissions = permissionsData?.data?.grouped || {};
  const departments = departmentsData?.data || [];

  // Filter users by search
  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  // Mutations
  const createUserMutation = useMutation({
    mutationFn: (data: Parameters<typeof usersApi.create>[0]) => usersApi.create(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User created successfully' });
      setShowCreateUserDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create user', description: error.message, variant: 'destructive' });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<User> }) => usersApi.update(id, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User updated successfully' });
      setShowEditUserDialog(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update user', description: error.message, variant: 'destructive' });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => usersApi.delete(id, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'User deactivated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to deactivate user', description: error.message, variant: 'destructive' });
    },
  });

  const sendInvitationMutation = useMutation({
    mutationFn: (data: Parameters<typeof invitationsApi.send>[0]) => invitationsApi.send(data, accessToken!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({ title: 'Invitation sent', description: 'Copy the invite link to share' });
      // Copy invite URL to clipboard
      navigator.clipboard.writeText(result.inviteUrl);
      setShowInviteDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to send invitation', description: error.message, variant: 'destructive' });
    },
  });

  const resendInvitationMutation = useMutation({
    mutationFn: (id: string) => invitationsApi.resend(id, accessToken!),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      navigator.clipboard.writeText(result.inviteUrl);
      toast({ title: 'Invitation resent', description: 'New link copied to clipboard' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to resend invitation', description: error.message, variant: 'destructive' });
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: (id: string) => invitationsApi.cancel(id, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] });
      toast({ title: 'Invitation cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to cancel invitation', description: error.message, variant: 'destructive' });
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: (data: Parameters<typeof teamsApi.create>[0]) => teamsApi.create(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Team created successfully' });
      setShowCreateTeamDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create team', description: error.message, variant: 'destructive' });
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (id: string) => teamsApi.delete(id, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Team deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete team', description: error.message, variant: 'destructive' });
    },
  });

  const addTeamMemberMutation = useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) =>
      teamsApi.addMember(teamId, memberId, 'MEMBER', accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Member added to team' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to add member', description: error.message, variant: 'destructive' });
    },
  });

  const removeTeamMemberMutation = useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) =>
      teamsApi.removeMember(teamId, memberId, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast({ title: 'Member removed from team' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to remove member', description: error.message, variant: 'destructive' });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      usersApi.resetPassword(userId, password, accessToken!),
    onSuccess: () => {
      toast({ title: 'Password reset successfully' });
      setShowResetPasswordDialog(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to reset password', description: error.message, variant: 'destructive' });
    },
  });

  // Helpers
  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-100 text-purple-700';
      case 'MANAGER':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-700';
      case 'INACTIVE':
        return 'bg-gray-100 text-gray-500';
      case 'SUSPENDED':
        return 'bg-red-100 text-red-700';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getInvitationStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'ACCEPTED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'EXPIRED':
        return <XCircle className="h-4 w-4 text-gray-400" />;
      case 'CANCELLED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';
  const canManageUsers = hasPermission('users.edit') || hasPermission('users.create') || hasPermission('users.invite');
  const canCreateUsers = hasPermission('users.create');
  const canInviteUsers = hasPermission('users.invite');
  const canManageTeams = hasPermission('teams.create') || hasPermission('teams.edit');
  const canManagePermissions = hasPermission('users.manage_permissions');

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Team' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Management</h1>
          <p className="text-gray-500 mt-1">Manage users, teams, and invitations</p>
        </div>
        {(canInviteUsers || canCreateUsers) && (
          <div className="flex gap-2">
            {canInviteUsers && (
              <Button variant="outline" onClick={() => setShowInviteDialog(true)} className="shadow-sm">
                <Send className="h-4 w-4 mr-2" />
                Invite User
              </Button>
            )}
            {canCreateUsers && (
              <Button onClick={() => setShowCreateUserDialog(true)} className="shadow-sm">
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Users</CardTitle>
            <div className="p-2 bg-blue-100 rounded-xl">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{users.filter((u) => u.isActive).length}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Teams</CardTitle>
            <div className="p-2 bg-green-100 rounded-xl">
              <UsersRound className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{teams.length}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending Invites</CardTitle>
            <div className="p-2 bg-yellow-100 rounded-xl">
              <Mail className="h-5 w-5 text-yellow-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{invitations.filter((i) => i.status === 'PENDING').length}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Departments</CardTitle>
            <div className="p-2 bg-purple-100 rounded-xl">
              <Building2 className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{departments.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="invitations">Invitations</TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Users Tab */}
        <TabsContent value="users" className="mt-4">
          {usersLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-4 w-48" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No users found</h3>
                <p className="mt-2 text-sm text-gray-500">
                  {search ? 'Try a different search term' : 'Add users to get started'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredUsers.map((user) => (
                <Card key={user.id} className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900">{user.name}</h3>
                          <p className="text-sm text-gray-500 truncate">{user.email}</p>
                          {user.designation && (
                            <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                              <Briefcase className="h-3 w-3" />
                              {user.designation}
                            </p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Badge variant="secondary" className={getRoleColor(user.role)}>
                              {user.role}
                            </Badge>
                            {user.status && user.status !== 'ACTIVE' && (
                              <Badge variant="secondary" className={getStatusColor(user.status)}>
                                {user.status}
                              </Badge>
                            )}
                          </div>
                          {user.teamMembers && user.teamMembers.length > 0 && (
                            <div className="mt-2 text-xs text-gray-500">
                              {user.teamMembers.map((tm) => tm.team?.name).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                      {canManageUsers && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedUser(user); setShowEditUserDialog(true); }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit User
                            </DropdownMenuItem>
                            {canManagePermissions && (
                              <>
                                <DropdownMenuItem onClick={() => { setSelectedUser(user); setShowPermissionsDialog(true); }}>
                                  <Shield className="h-4 w-4 mr-2" />
                                  Permissions
                                </DropdownMenuItem>
                                {user.id !== currentUser?.id && (
                                  <DropdownMenuItem onClick={() => { setSelectedUser(user); setShowResetPasswordDialog(true); }}>
                                    <KeyRound className="h-4 w-4 mr-2" />
                                    Reset Password
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Deactivate
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Teams Tab */}
        <TabsContent value="teams" className="mt-4">
          <div className="flex justify-end mb-4">
            {canManageTeams && (
              <Button onClick={() => setShowCreateTeamDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Team
              </Button>
            )}
          </div>
          {teamsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTeams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <UsersRound className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No teams found</h3>
                <p className="mt-2 text-sm text-gray-500">Create a team to organize your members</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.map((team) => (
                <Card key={team.id} className="hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 border-0 shadow-sm">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{team.name}</CardTitle>
                        {team.description && (
                          <CardDescription>{team.description}</CardDescription>
                        )}
                      </div>
                      {canManageUsers && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedTeam(team); setShowTeamMembersDialog(true); }}>
                              <Users className="h-4 w-4 mr-2" />
                              Manage Members
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => deleteTeamMutation.mutate(team.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {team.manager && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                        <span>Manager:</span>
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={team.manager.avatar} />
                          <AvatarFallback className="text-xs">{getInitials(team.manager.name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium text-gray-700">{team.manager.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {team.members?.slice(0, 5).map((member) => (
                          <Avatar key={member.id} className="h-8 w-8 border-2 border-white">
                            <AvatarImage src={member.user?.avatar} />
                            <AvatarFallback className="text-xs">{getInitials(member.user?.name || '')}</AvatarFallback>
                          </Avatar>
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">
                        {team._count?.members || team.members?.length || 0} members
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Invitations Tab */}
        <TabsContent value="invitations" className="mt-4">
          {invitationsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-6 w-48" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Mail className="h-12 w-12 text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No invitations</h3>
                <p className="mt-2 text-sm text-gray-500">Send invitations to add new team members</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation) => (
                <Card key={invitation.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getInvitationStatusIcon(invitation.status)}
                      <div>
                        <p className="font-medium">{invitation.email}</p>
                        <p className="text-sm text-gray-500">
                          {invitation.name && `${invitation.name} - `}
                          Role: {invitation.role}
                          {invitation.invitedBy && ` - Invited by ${invitation.invitedBy.name}`}
                        </p>
                        <p className="text-xs text-gray-400">
                          Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {invitation.status === 'PENDING' && canManageUsers && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => resendInvitationMutation.mutate(invitation.id)}
                          disabled={resendInvitationMutation.isPending}
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Resend
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                          onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                          disabled={cancelInvitationMutation.isPending}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      </div>
                    )}
                    {invitation.status !== 'PENDING' && (
                      <Badge variant="secondary" className={
                        invitation.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
                        invitation.status === 'EXPIRED' ? 'bg-gray-100 text-gray-500' :
                        'bg-red-100 text-red-700'
                      }>
                        {invitation.status}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <CreateUserDialog
        open={showCreateUserDialog}
        onOpenChange={setShowCreateUserDialog}
        departments={departments}
        teams={teams}
        onSubmit={(data) => createUserMutation.mutate(data)}
        isLoading={createUserMutation.isPending}
      />

      {/* Edit User Dialog */}
      <EditUserDialog
        open={showEditUserDialog}
        onOpenChange={(open) => { setShowEditUserDialog(open); if (!open) setSelectedUser(null); }}
        user={selectedUser}
        departments={departments}
        teams={teams}
        onSubmit={(data) => selectedUser && updateUserMutation.mutate({ id: selectedUser.id, data })}
        isLoading={updateUserMutation.isPending}
      />

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        departments={departments}
        teams={teams}
        onSubmit={(data) => sendInvitationMutation.mutate(data)}
        isLoading={sendInvitationMutation.isPending}
      />

      {/* Create Team Dialog */}
      <CreateTeamDialog
        open={showCreateTeamDialog}
        onOpenChange={setShowCreateTeamDialog}
        users={users}
        onSubmit={(data) => createTeamMutation.mutate(data)}
        isLoading={createTeamMutation.isPending}
      />

      {/* Team Members Dialog */}
      <TeamMembersDialog
        open={showTeamMembersDialog}
        onOpenChange={(open) => { setShowTeamMembersDialog(open); if (!open) setSelectedTeam(null); }}
        team={selectedTeam}
        users={users}
        onAddMember={(memberId) => selectedTeam && addTeamMemberMutation.mutate({ teamId: selectedTeam.id, memberId })}
        onRemoveMember={(memberId) => selectedTeam && removeTeamMemberMutation.mutate({ teamId: selectedTeam.id, memberId })}
        isLoading={addTeamMemberMutation.isPending || removeTeamMemberMutation.isPending}
      />

      {/* Permissions Dialog */}
      <PermissionsDialog
        open={showPermissionsDialog}
        onOpenChange={(open) => { setShowPermissionsDialog(open); if (!open) setSelectedUser(null); }}
        user={selectedUser}
        permissions={permissions}
        accessToken={accessToken!}
      />

      {/* Reset Password Dialog */}
      <ResetPasswordDialog
        open={showResetPasswordDialog}
        onOpenChange={(open) => { setShowResetPasswordDialog(open); if (!open) setSelectedUser(null); }}
        user={selectedUser}
        onSubmit={(password) => selectedUser && resetPasswordMutation.mutate({ userId: selectedUser.id, password })}
        isLoading={resetPasswordMutation.isPending}
      />
    </div>
  );
}

// Create User Dialog Component
function CreateUserDialog({
  open,
  onOpenChange,
  departments,
  teams,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Array<{ id: string; name: string }>;
  teams: Team[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    departmentId: '',
    designation: '',
    phone: '',
    teamIds: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'EMPLOYEE',
      departmentId: '',
      designation: '',
      phone: '',
      teamIds: [],
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
          <DialogDescription>Add a new user to your organization</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Leave empty to invite"
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formData.departmentId} onValueChange={(v) => setFormData({ ...formData, departmentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                placeholder="e.g., Software Engineer"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+1 234 567 8900"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit User Dialog Component
function EditUserDialog({
  open,
  onOpenChange,
  user,
  departments,
  teams,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  departments: Array<{ id: string; name: string }>;
  teams: Team[];
  onSubmit: (data: Partial<User>) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<Partial<User>>({});

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
        designation: user.designation,
        phone: user.phone,
        status: user.status,
        visibilityScope: user.visibilityScope,
      });
    }
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user information</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role || ''} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status || 'ACTIVE'} onValueChange={(v: any) => setFormData({ ...formData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="SUSPENDED">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={formData.departmentId || ''} onValueChange={(v) => setFormData({ ...formData, departmentId: v })}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input
                value={formData.designation || ''}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            {(formData.role === 'MANAGER' || formData.role === 'ADMIN') && (
              <div className="space-y-2">
                <Label>Visibility Scope</Label>
                <Select value={formData.visibilityScope || 'TEAM_ONLY'} onValueChange={(v: any) => setFormData({ ...formData, visibilityScope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEAM_ONLY">Team Only</SelectItem>
                    <SelectItem value="DEPARTMENT">Department</SelectItem>
                    <SelectItem value="ALL">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Invite User Dialog Component
function InviteUserDialog({
  open,
  onOpenChange,
  departments,
  teams,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Array<{ id: string; name: string }>;
  teams: Team[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'EMPLOYEE',
    departmentId: '',
    teamIds: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const resetForm = () => {
    setFormData({ email: '', name: '', role: 'EMPLOYEE', departmentId: '', teamIds: [] });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>Send an invitation to join your organization</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                  <SelectItem value="MANAGER">Manager</SelectItem>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select value={formData.departmentId} onValueChange={(v) => setFormData({ ...formData, departmentId: v })}>
              <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Teams</Label>
            <div className="border rounded-md p-3 max-h-32 overflow-y-auto space-y-2">
              {teams.map((team) => (
                <div key={team.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`team-${team.id}`}
                    checked={formData.teamIds.includes(team.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({ ...formData, teamIds: [...formData.teamIds, team.id] });
                      } else {
                        setFormData({ ...formData, teamIds: formData.teamIds.filter((id) => id !== team.id) });
                      }
                    }}
                  />
                  <label htmlFor={`team-${team.id}`} className="text-sm">{team.name}</label>
                </div>
              ))}
              {teams.length === 0 && <p className="text-sm text-gray-500">No teams available</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Create Team Dialog Component
function CreateTeamDialog({
  open,
  onOpenChange,
  users,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: User[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    managerId: '',
    memberIds: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const resetForm = () => {
    setFormData({ name: '', description: '', managerId: '', memberIds: [] });
  };

  const activeUsers = users.filter((u) => u.isActive);

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>Create a new team to organize members</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Team Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Team Manager</Label>
            <Select value={formData.managerId} onValueChange={(v) => setFormData({ ...formData, managerId: v })}>
              <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
              <SelectContent>
                {activeUsers.filter((u) => u.role === 'MANAGER' || u.role === 'ADMIN').map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Team Members</Label>
            <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
              {activeUsers.map((user) => (
                <div key={user.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`member-${user.id}`}
                    checked={formData.memberIds.includes(user.id)}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setFormData({ ...formData, memberIds: [...formData.memberIds, user.id] });
                      } else {
                        setFormData({ ...formData, memberIds: formData.memberIds.filter((id) => id !== user.id) });
                      }
                    }}
                  />
                  <label htmlFor={`member-${user.id}`} className="text-sm">{user.name}</label>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Team'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Team Members Dialog Component
function TeamMembersDialog({
  open,
  onOpenChange,
  team,
  users,
  onAddMember,
  onRemoveMember,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
  users: User[];
  onAddMember: (memberId: string) => void;
  onRemoveMember: (memberId: string) => void;
  isLoading: boolean;
}) {
  const [selectedUserId, setSelectedUserId] = useState('');

  if (!team) return null;

  const memberIds = team.members?.map((m) => m.userId) || [];
  const availableUsers = users.filter((u) => u.isActive && !memberIds.includes(u.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Team Members</DialogTitle>
          <DialogDescription>{team.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Add Member */}
          <div className="flex gap-2">
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select user to add" /></SelectTrigger>
              <SelectContent>
                {availableUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => { onAddMember(selectedUserId); setSelectedUserId(''); }}
              disabled={!selectedUserId || isLoading}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Current Members */}
          <div className="border rounded-md divide-y max-h-64 overflow-y-auto">
            {team.members?.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">No members yet</p>
            ) : (
              team.members?.map((member) => (
                <div key={member.id} className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.user?.avatar} />
                      <AvatarFallback className="text-xs">
                        {member.user?.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{member.user?.name}</p>
                      <p className="text-xs text-gray-500">{member.role}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-600"
                    onClick={() => onRemoveMember(member.userId)}
                    disabled={isLoading}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Permissions Dialog Component
function PermissionsDialog({
  open,
  onOpenChange,
  user,
  permissions,
  accessToken,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  permissions: Record<string, Permission[]>;
  accessToken: string;
}) {
  const queryClient = useQueryClient();
  const [userPermissions, setUserPermissions] = useState<Record<string, boolean>>({});
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch user details with permissions when dialog opens
  useEffect(() => {
    async function fetchUserPermissions() {
      if (!user || !open) return;
      setIsLoading(true);
      try {
        const result = await usersApi.get(user.id, accessToken);
        if (result.success && result.data) {
          setEffectivePermissions(result.data.effectivePermissions || []);
        }
      } catch (error) {
        console.error('Failed to fetch user permissions:', error);
      }
      setIsLoading(false);
    }
    fetchUserPermissions();
    setUserPermissions({});
  }, [user?.id, open, accessToken]);

  const updatePermissionsMutation = useMutation({
    mutationFn: (perms: Array<{ permissionId: string; granted: boolean }>) =>
      usersApi.updatePermissions(user!.id, perms, accessToken),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast({ title: 'Permissions updated' });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update permissions', description: error.message, variant: 'destructive' });
    },
  });

  if (!user) return null;

  const handleSave = () => {
    // Build the full list of permissions based on current state
    const allPerms = Object.values(permissions).flat();
    const perms = allPerms.map((perm) => {
      const isChecked = userPermissions[perm.id] ?? effectivePermissions.includes(perm.code);
      return { permissionId: perm.id, granted: isChecked };
    });
    updatePermissionsMutation.mutate(perms);
  };

  // Helper to check if a permission is granted
  const isPermissionGranted = (perm: Permission) => {
    if (userPermissions[perm.id] !== undefined) {
      return userPermissions[perm.id];
    }
    return effectivePermissions.includes(perm.code);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>User Permissions</DialogTitle>
          <DialogDescription>
            Configure permissions for {user.name}. Role: {user.role}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {Object.entries(permissions).map(([category, perms]) => (
            <div key={category} className="space-y-2">
              <h4 className="font-medium capitalize text-sm text-gray-700">{category}</h4>
              <div className="grid grid-cols-2 gap-2">
                {perms.map((perm) => (
                  <div key={perm.id} className="flex items-center gap-2 p-2 border rounded">
                    <Checkbox
                      id={perm.id}
                      checked={isPermissionGranted(perm)}
                      disabled={isLoading}
                      onCheckedChange={(checked) =>
                        setUserPermissions({ ...userPermissions, [perm.id]: !!checked })
                      }
                    />
                    <label htmlFor={perm.id} className="text-sm flex-1 cursor-pointer">
                      <div className="font-medium">{perm.name}</div>
                      {perm.description && (
                        <div className="text-xs text-gray-500">{perm.description}</div>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={updatePermissionsMutation.isPending}>
            {updatePermissionsMutation.isPending ? 'Saving...' : 'Save Permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Reset Password Dialog Component
function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onSubmit: (password: string) => void;
  isLoading: boolean;
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setPassword('');
      setConfirmPassword('');
      setError('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    onSubmit(password);
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
