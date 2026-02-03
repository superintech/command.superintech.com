'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { api, projectsApi, tasksApi, usersApi, tagsApi, Tag } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskDetailModal } from '@/components/tasks/task-detail-modal';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { FileUploader, UploadedFile } from '@/components/ui/file-uploader';
import { toast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  ArrowLeft,
  Plus,
  Users,
  CheckSquare,
  UserPlus,
  Trash2,
  Edit,
  Tags,
  X,
  History,
  Clock,
  FolderKanban,
  ListTodo,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { ActivityFeed } from '@/components/activity-feed';
import { ProjectHealthCard } from '@/components/ai';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { user, accessToken } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', description: '', status: '' });
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'MEDIUM', assigneeId: '', dueDate: '' });
  const [taskFiles, setTaskFiles] = useState<UploadedFile[]>([]);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTag, setNewTag] = useState({ name: '', color: '#0ea5e9' });
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const { data: projectData, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId, accessToken!),
    enabled: !!accessToken && !!projectId,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', { projectId }],
    queryFn: () => tasksApi.list(accessToken!, { projectId }),
    enabled: !!accessToken && !!projectId,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags', projectId],
    queryFn: () => tagsApi.list(accessToken!, projectId),
    enabled: !!accessToken && !!projectId,
  });

  const createTagMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      tagsApi.create({ ...data, projectId }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', projectId] });
      setShowCreateTag(false);
      setNewTag({ name: '', color: '#0ea5e9' });
      toast({ title: 'Tag created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create tag', variant: 'destructive' });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: (tagId: string) => tagsApi.delete(tagId, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags', projectId] });
      setTagToDelete(null);
      toast({ title: 'Tag deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete tag', variant: 'destructive' });
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/api/projects/${projectId}/members`, { userId }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowAddMember(false);
      setSelectedUserId('');
      toast({ title: 'Member added successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to add member', variant: 'destructive' });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/api/projects/${projectId}/members/${userId}`, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast({ title: 'Member removed' });
    },
    onError: () => {
      toast({ title: 'Failed to remove member', variant: 'destructive' });
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string; status?: string }) =>
      projectsApi.update(projectId, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      setShowEditProject(false);
      toast({ title: 'Project updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update project', variant: 'destructive' });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: () => projectsApi.delete(projectId, accessToken!),
    onSuccess: () => {
      toast({ title: 'Project deleted' });
      router.push('/dashboard/projects');
    },
    onError: () => {
      toast({ title: 'Failed to delete project', variant: 'destructive' });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: typeof newTask) => {
      const taskResult = await tasksApi.create({ ...data, projectId }, accessToken!);
      if (taskFiles.length > 0 && taskResult.data) {
        try {
          const formData = new FormData();
          taskFiles.forEach((f) => {
            formData.append('files', f.file);
          });
          formData.append('taskId', taskResult.data.id);
          await api.uploadFiles(`/api/files/upload`, formData, accessToken!);
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          toast({ title: 'Task created but file upload failed', variant: 'destructive' });
        }
      }
      return taskResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks', { projectId }] });
      setShowCreateTask(false);
      setNewTask({ title: '', description: '', priority: 'MEDIUM', assigneeId: '', dueDate: '' });
      setTaskFiles([]);
      toast({ title: 'Task created successfully' });
    },
    onError: (error: Error) => {
      console.error('Task creation error:', error);
      toast({ title: 'Failed to create task', description: error.message, variant: 'destructive' });
    },
  });

  const project = projectData?.data;
  const tasks = tasksData?.data || [];
  const users = usersData?.data || [];
  const tags = tagsData?.data || [];

  const memberIds = project?.members?.map((m) => m.user.id) || [];
  const availableUsers = users.filter((u) => !memberIds.includes(u.id));

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/20">
            ACTIVE
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-blue-400 bg-blue-500/20">
            COMPLETED
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-amber-400 bg-amber-500/20">
            ON HOLD
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-red-400 bg-red-500/20">
            CANCELLED
            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
          </span>
        );
      case 'PLANNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-purple-400 bg-purple-500/20">
            PLANNING
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 bg-slate-500/20">
            {status}
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold text-red-400 bg-red-500/20">URGENT</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold text-orange-400 bg-orange-500/20">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold text-blue-400 bg-blue-500/20">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 bg-slate-500/20">LOW</span>;
    }
  };

  const getTaskStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/20">COMPLETED</span>;
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold text-amber-400 bg-amber-500/20">IN PROGRESS</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 bg-slate-500/20">{status.replace('_', ' ')}</span>;
    }
  };

  const taskStats = {
    total: tasks.length,
    todo: tasks.filter((t) => t.status === 'TODO').length,
    inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
    completed: tasks.filter((t) => t.status === 'COMPLETED').length,
  };

  if (projectLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-white">Project not found</h2>
        <Button variant="link" onClick={() => router.push('/dashboard/projects')} className="text-blue-400">
          Back to Projects
        </Button>
      </div>
    );
  }

  const isOwner = project.ownerId === user?.id;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const progressPercentage = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  const handleEditProject = () => {
    setEditForm({
      name: project.name,
      description: project.description || '',
      status: project.status,
    });
    setShowEditProject(true);
  };

  return (
    <div className="min-h-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/projects')}
            className="text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              {getStatusBadge(project.status)}
            </div>
            <p className="text-slate-400">{project.department?.name}</p>
          </div>
        </div>

        {isOwner && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleEditProject}
              className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit Project
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-400"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Project
            </Button>
          </div>
        )}
      </div>

      {/* Edit Project Form */}
      {showEditProject && (
        <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Edit Project</h2>
            <Button variant="ghost" size="icon" onClick={() => setShowEditProject(false)} className="text-slate-400 hover:text-white hover:bg-slate-700">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); updateProjectMutation.mutate(editForm); }} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Project Name *</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Project name"
                  className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Status</Label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white"
                >
                  <option value="PLANNING" className="bg-[#0a1628]">Planning</option>
                  <option value="ACTIVE" className="bg-[#0a1628]">Active</option>
                  <option value="ON_HOLD" className="bg-[#0a1628]">On Hold</option>
                  <option value="COMPLETED" className="bg-[#0a1628]">Completed</option>
                  <option value="CANCELLED" className="bg-[#0a1628]">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="Project description"
                className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={updateProjectMutation.isPending} className="bg-blue-500 hover:bg-blue-600 text-white">
                {updateProjectMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowEditProject(false)} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Progress Overview */}
      <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white">Overall Progress</span>
          <span className="text-sm text-slate-400">{progressPercentage}% Complete</span>
        </div>
        <Progress value={progressPercentage} className="h-2 bg-slate-700" />
        <p className="text-xs text-slate-500 mt-2">
          {completedTasks} of {tasks.length} tasks completed
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{String(taskStats.total).padStart(2, '0')}</p>
              <p className="text-xs text-slate-400">Total Tasks</p>
            </div>
          </div>
        </div>
        <div className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-500/20 flex items-center justify-center">
              <ListTodo className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{String(taskStats.todo).padStart(2, '0')}</p>
              <p className="text-xs text-slate-400">To Do</p>
            </div>
          </div>
        </div>
        <div className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{String(taskStats.inProgress).padStart(2, '0')}</p>
              <p className="text-xs text-slate-400">In Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{String(taskStats.completed).padStart(2, '0')}</p>
              <p className="text-xs text-slate-400">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Project Health Analysis */}
      <ProjectHealthCard
        projectId={projectId}
        projectName={project.name}
        className="w-full"
      />

      {/* Tabs */}
      <Tabs defaultValue="tasks" className="space-y-6">
        <TabsList className="bg-[#131d2e] border border-slate-700/50 p-1">
          <TabsTrigger value="tasks" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
            Tasks
          </TabsTrigger>
          <TabsTrigger value="members" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
            Members ({project.members?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="tags" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
            Tags ({tags.length})
          </TabsTrigger>
          <TabsTrigger value="activity" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
            <History className="h-4 w-4 mr-1" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="details" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
            Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Project Tasks</h3>
            <Button onClick={() => setShowCreateTask(!showCreateTask)} className="bg-blue-500 hover:bg-blue-600">
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>

          {showCreateTask && (
            <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-6">
              <form onSubmit={(e) => { e.preventDefault(); if (!newTask.title) return; createTaskMutation.mutate(newTask); }} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Title *</Label>
                    <Input
                      value={newTask.title}
                      onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="Task title"
                      className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Assignee</Label>
                    <select
                      value={newTask.assigneeId}
                      onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white"
                    >
                      <option value="" className="bg-[#0a1628]">Unassigned</option>
                      {project.members?.map((m) => (
                        <option key={m.user.id} value={m.user.id} className="bg-[#0a1628]">{m.user.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Description</Label>
                  <RichTextEditor
                    value={newTask.description}
                    onChange={(value) => setNewTask({ ...newTask, description: value })}
                    placeholder="Enter task description with formatting..."
                    minHeight="120px"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Priority</Label>
                    <select
                      value={newTask.priority}
                      onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                      className="flex h-10 w-full rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white"
                    >
                      <option value="LOW" className="bg-[#0a1628]">Low</option>
                      <option value="MEDIUM" className="bg-[#0a1628]">Medium</option>
                      <option value="HIGH" className="bg-[#0a1628]">High</option>
                      <option value="URGENT" className="bg-[#0a1628]">Urgent</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Due Date</Label>
                    <Input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className="bg-[#0a1628] border-slate-700 text-white"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-300">Attachments</Label>
                  <FileUploader files={taskFiles} onChange={setTaskFiles} maxFiles={10} maxSize={50 * 1024 * 1024} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createTaskMutation.isPending} className="bg-blue-500 hover:bg-blue-600">
                    {createTaskMutation.isPending ? 'Creating...' : 'Create'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateTask(false)} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-12 text-center">
              <CheckSquare className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-white">No tasks yet</h3>
              <p className="text-sm text-slate-400 mt-1">Create your first task for this project</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-4 cursor-pointer hover:bg-[#1a2942] transition-colors"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <h4 className="font-medium text-white">{task.title}</h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-400">{task.assignee?.name || 'Unassigned'}</span>
                        {(task as any).actualHours > 0 && (
                          <span className="flex items-center gap-1 text-xs text-blue-400">
                            <Clock className="h-3 w-3" />
                            {formatDuration(Math.round((task as any).actualHours * 60))}
                          </span>
                        )}
                        {(task as any).tags?.length > 0 && (
                          <div className="flex gap-1">
                            {(task as any).tags.slice(0, 3).map(({ tag }: { tag: Tag }) => (
                              <span key={tag.id} className="px-1.5 py-0.5 text-xs rounded" style={{ backgroundColor: tag.color + '20', color: tag.color }}>
                                {tag.name}
                              </span>
                            ))}
                            {(task as any).tags.length > 3 && <span className="text-xs text-slate-500">+{(task as any).tags.length - 3}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(task.priority)}
                      {getTaskStatusBadge(task.status)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="members" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Team Members</h3>
            {isOwner && (
              <Button onClick={() => setShowAddMember(!showAddMember)} className="bg-blue-500 hover:bg-blue-600">
                <UserPlus className="mr-2 h-4 w-4" />
                Add Member
              </Button>
            )}
          </div>

          {showAddMember && (
            <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-4">
              <div className="flex gap-2">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="flex h-10 flex-1 rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white"
                >
                  <option value="" className="bg-[#0a1628]">Select a user</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#0a1628]">{u.name} ({u.email})</option>
                  ))}
                </select>
                <Button onClick={() => selectedUserId && addMemberMutation.mutate(selectedUserId)} disabled={!selectedUserId || addMemberMutation.isPending} className="bg-blue-500 hover:bg-blue-600">
                  Add
                </Button>
                <Button variant="outline" onClick={() => setShowAddMember(false)} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {project.members?.map((member) => (
              <div key={member.user.id} className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="border-2 border-slate-600">
                      <AvatarImage src={member.user.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">{getInitials(member.user.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-white">{member.user.name}</p>
                      <p className="text-sm text-slate-400">{member.user.role}</p>
                    </div>
                  </div>
                  {isOwner && member.user.id !== project.ownerId && (
                    <Button variant="ghost" size="icon" onClick={() => removeMemberMutation.mutate(member.user.id)} className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-white">Project Tags</h3>
            {isOwner && (
              <Button onClick={() => setShowCreateTag(!showCreateTag)} className="bg-blue-500 hover:bg-blue-600">
                <Plus className="mr-2 h-4 w-4" />
                Create Tag
              </Button>
            )}
          </div>

          {showCreateTag && (
            <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-6">
              <form onSubmit={(e) => { e.preventDefault(); if (!newTag.name.trim()) return; createTagMutation.mutate(newTag); }} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-slate-300">Tag Name *</Label>
                    <Input
                      value={newTag.name}
                      onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                      placeholder="e.g., Bug, Feature, Documentation"
                      className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-300">Color</Label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={newTag.color} onChange={(e) => setNewTag({ ...newTag, color: e.target.value })} className="h-10 w-14 cursor-pointer rounded border border-slate-700 bg-transparent p-1" />
                      <Input value={newTag.color} onChange={(e) => setNewTag({ ...newTag, color: e.target.value })} className="flex-1 bg-[#0a1628] border-slate-700 text-white" />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-400">Preview:</span>
                  <span className="px-2 py-1 rounded text-sm font-medium" style={{ backgroundColor: newTag.color + '20', color: newTag.color }}>
                    {newTag.name || 'Tag Name'}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={createTagMutation.isPending || !newTag.name.trim()} className="bg-blue-500 hover:bg-blue-600">
                    {createTagMutation.isPending ? 'Creating...' : 'Create Tag'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowCreateTag(false)} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          )}

          {tags.length === 0 ? (
            <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-12 text-center">
              <Tags className="h-12 w-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-white">No tags yet</h3>
              <p className="text-sm text-slate-400 mt-1">Create tags to organize and categorize your tasks</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {tags.map((tag) => (
                <div key={tag.id} className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <div>
                        <p className="font-medium text-white">{tag.name}</p>
                        <p className="text-xs text-slate-500">Used in {tag._count?.tasks || 0} task{(tag._count?.tasks || 0) !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {isOwner && (
                      <Button variant="ghost" size="icon" onClick={() => setTagToDelete(tag)} className="text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="activity">
          <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Project Activity</h3>
            <ActivityFeed projectId={projectId} limit={50} showHeader={false} />
          </div>
        </TabsContent>

        <TabsContent value="details">
          <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-white mb-4">Project Details</h3>
            <div>
              <Label className="text-slate-500 text-sm">Description</Label>
              <p className="mt-1 text-white">{project.description || 'No description provided'}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label className="text-slate-500 text-sm">Owner</Label>
                <p className="mt-1 text-white">{project.owner?.name}</p>
              </div>
              <div>
                <Label className="text-slate-500 text-sm">Department</Label>
                <p className="mt-1 text-white">{project.department?.name}</p>
              </div>
              <div>
                <Label className="text-slate-500 text-sm">Start Date</Label>
                <p className="mt-1 text-white">{project.startDate ? new Date(project.startDate).toLocaleDateString() : 'Not set'}</p>
              </div>
              <div>
                <Label className="text-slate-500 text-sm">End Date</Label>
                <p className="mt-1 text-white">{project.endDate ? new Date(project.endDate).toLocaleDateString() : 'Not set'}</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Task Detail Modal */}
      <TaskDetailModal taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />

      {/* Delete Project Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Project"
        description="Are you sure you want to delete this project? This will also delete all tasks, files, and comments associated with it. This action cannot be undone."
        confirmText="Delete Project"
        variant="destructive"
        onConfirm={() => deleteProjectMutation.mutate()}
        loading={deleteProjectMutation.isPending}
        requireConfirmation={true}
        confirmationText="DELETE"
      />

      {/* Delete Tag Confirmation */}
      <ConfirmDialog
        open={!!tagToDelete}
        onOpenChange={(open) => !open && setTagToDelete(null)}
        title="Delete Tag"
        description={`Are you sure you want to delete the tag "${tagToDelete?.name}"? It will be removed from all tasks.`}
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => tagToDelete && deleteTagMutation.mutate(tagToDelete.id)}
        loading={deleteTagMutation.isPending}
      />
    </div>
  );
}
