'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { api, Task, tagsApi, Tag, filesApi, commentsApi } from '@/lib/api';
import { formatDateTime, formatDuration, formatFileSize } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor, RichTextDisplay } from '@/components/ui/rich-text-editor';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from '@/hooks/use-toast';
import {
  Clock,
  Play,
  Square,
  Calendar,
  User,
  Flag,
  Send,
  Edit,
  Trash2,
  Archive,
  X,
  Save,
  Paperclip,
  Download,
  FileText,
  FileImage,
  CheckCircle2,
  Circle,
  Plus,
  Tags,
  History,
  Upload,
  Loader2,
  Share2,
  Copy,
  Check,
  Link,
} from 'lucide-react';
import { ActivityFeed } from '@/components/activity-feed';

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface TimeEntry {
  id: string;
  taskId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  description?: string;
  user: {
    id: string;
    name: string;
  };
}

interface FileAttachment {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploader?: {
    id: string;
    name: string;
  };
}

interface Subtask {
  id: string;
  title: string;
  status: string;
  assigneeId?: string;
}

interface TaskTag {
  tag: Tag;
}

interface TaskDetail extends Task {
  comments?: Comment[];
  timeEntries?: TimeEntry[];
  files?: FileAttachment[];
  subtasks?: Subtask[];
  tags?: TaskTag[];
}

interface TaskDetailModalProps {
  taskId: string | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (taskId: string) => void;
  onArchive?: (taskId: string) => void;
}

const STATUS_OPTIONS = [
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'COMPLETED', label: 'Completed' },
];

const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

export function TaskDetailModal({
  taskId,
  open,
  onClose,
  onDelete,
  onArchive,
}: TaskDetailModalProps) {
  const { user, accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [timerDescription, setTimerDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentContent, setEditingCommentContent] = useState('');
  const [sharingFileId, setSharingFileId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copiedShareUrl, setCopiedShareUrl] = useState(false);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    status: '',
    priority: '',
    dueDate: '',
    assigneeId: '',
  });

  const { data: taskData, isLoading, error } = useQuery({
    queryKey: ['task', taskId],
    queryFn: () => api.get<{ success: boolean; data: TaskDetail }>(`/api/tasks/${taskId}`, accessToken!),
    enabled: !!taskId && !!accessToken && open,
    retry: false,
  });

  const { data: activeTimerData } = useQuery({
    queryKey: ['activeTimer'],
    queryFn: () => api.get<{ success: boolean; data: TimeEntry | null }>('/api/tasks/timer/active', accessToken!),
    enabled: !!accessToken && open,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<{ success: boolean; data: Array<{ id: string; name: string }> }>('/api/users', accessToken!),
    enabled: !!accessToken && isEditing,
  });

  const task = taskData?.data;
  const activeTimer = activeTimerData?.data;
  const isTimerRunningForThisTask = activeTimer && task && activeTimer.taskId === task.id;
  const users = usersData?.data || [];

  // Fetch project tags
  const { data: projectTagsData } = useQuery({
    queryKey: ['tags', task?.projectId],
    queryFn: () => tagsApi.list(accessToken!, task?.projectId),
    enabled: !!accessToken && !!task?.projectId && open,
  });

  const projectTags = projectTagsData?.data || [];
  const taskTagIds = task?.tags?.map((t) => t.tag.id) || [];

  // Initialize edit form when task loads
  useEffect(() => {
    if (task && isEditing) {
      setEditForm({
        title: task.title,
        description: task.description || '',
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
        assigneeId: task.assigneeId || '',
      });
    }
  }, [task, isEditing]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Task>) =>
      api.patch(`/api/tasks/${taskId}`, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsEditing(false);
      toast({ title: 'Task updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update task', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/tasks/${taskId}`, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Task deleted successfully' });
      onClose();
      onDelete?.(taskId!);
    },
    onError: () => {
      toast({ title: 'Failed to delete task', variant: 'destructive' });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: (content: string) =>
      api.post(`/api/tasks/${taskId}/comments`, { content }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['activity', undefined, taskId] });
      setNewComment('');
      toast({ title: 'Comment added' });
    },
    onError: () => {
      toast({ title: 'Failed to add comment', variant: 'destructive' });
    },
  });

  const startTimerMutation = useMutation({
    mutationFn: (description?: string) =>
      api.post(`/api/tasks/${taskId}/timer/start`, { description }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      queryClient.invalidateQueries({ queryKey: ['activity', undefined, taskId] });
      setTimerDescription('');
      toast({ title: 'Timer started' });
    },
    onError: () => {
      toast({ title: 'Failed to start timer', variant: 'destructive' });
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: (timeEntryId: string) =>
      api.post(`/api/tasks/${taskId}/timer/${timeEntryId}/stop`, {}, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['activity', undefined, taskId] });
      toast({ title: 'Timer stopped' });
    },
    onError: () => {
      toast({ title: 'Failed to stop timer', variant: 'destructive' });
    },
  });

  const addSubtaskMutation = useMutation({
    mutationFn: (title: string) =>
      api.post('/api/tasks', {
        title,
        projectId: task?.projectId,
        parentTaskId: taskId,
        status: 'TODO',
        priority: 'MEDIUM',
      }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setNewSubtask('');
      toast({ title: 'Subtask added' });
    },
    onError: () => {
      toast({ title: 'Failed to add subtask', variant: 'destructive' });
    },
  });

  const toggleSubtaskMutation = useMutation({
    mutationFn: ({ subtaskId, completed }: { subtaskId: string; completed: boolean }) =>
      api.patch(`/api/tasks/${subtaskId}`, {
        status: completed ? 'COMPLETED' : 'TODO',
      }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
    },
  });

  const addTagMutation = useMutation({
    mutationFn: (tagId: string) => tagsApi.addToTask(taskId!, tagId, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      toast({ title: 'Tag added' });
    },
    onError: () => {
      toast({ title: 'Failed to add tag', variant: 'destructive' });
    },
  });

  const removeTagMutation = useMutation({
    mutationFn: (tagId: string) => tagsApi.removeFromTask(taskId!, tagId, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      toast({ title: 'Tag removed' });
    },
    onError: () => {
      toast({ title: 'Failed to remove tag', variant: 'destructive' });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      commentsApi.update(taskId!, commentId, content, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      setEditingCommentId(null);
      setEditingCommentContent('');
      toast({ title: 'Comment updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update comment', variant: 'destructive' });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => commentsApi.delete(taskId!, commentId, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['activity', undefined, taskId] });
      toast({ title: 'Comment deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete comment', variant: 'destructive' });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: (fileId: string) => filesApi.delete(fileId, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['activity', undefined, taskId] });
      toast({ title: 'File deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete file', variant: 'destructive' });
    },
  });

  const handleCreateShare = async (fileId: string) => {
    setIsCreatingShare(true);
    setSharingFileId(fileId);
    try {
      const response = await filesApi.createShare(fileId, accessToken!);
      setShareUrl(response.data.shareUrl);
      toast({ title: 'Share link created' });
    } catch (error) {
      console.error('Create share error:', error);
      toast({ title: 'Failed to create share link', variant: 'destructive' });
      setSharingFileId(null);
    } finally {
      setIsCreatingShare(false);
    }
  };

  const handleCopyShareUrl = async () => {
    if (shareUrl) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedShareUrl(true);
        toast({ title: 'Link copied to clipboard' });
        setTimeout(() => setCopiedShareUrl(false), 2000);
      } catch (error) {
        toast({ title: 'Failed to copy link', variant: 'destructive' });
      }
    }
  };

  const closeShareDialog = () => {
    setSharingFileId(null);
    setShareUrl(null);
    setCopiedShareUrl(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !taskId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });
      formData.append('taskId', taskId);

      await api.uploadFiles('/api/files/upload', formData, accessToken!);
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['activity', undefined, taskId] });
      toast({ title: 'Files uploaded successfully' });
    } catch (error) {
      console.error('File upload error:', error);
      toast({ title: 'Failed to upload files', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500/20 text-red-400';
      case 'HIGH': return 'bg-orange-500/20 text-orange-400';
      case 'MEDIUM': return 'bg-blue-500/20 text-blue-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-500/20 text-emerald-400';
      case 'IN_PROGRESS': return 'bg-amber-500/20 text-amber-400';
      case 'IN_REVIEW': return 'bg-purple-500/20 text-purple-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      title: editForm.title,
      description: editForm.description || undefined,
      status: editForm.status,
      priority: editForm.priority,
      dueDate: editForm.dueDate || undefined,
      assigneeId: editForm.assigneeId || undefined,
    });
  };

  const handleStartTimer = () => {
    if (activeTimer) {
      toast({
        title: 'Timer already running',
        description: 'Please stop the current timer first.',
        variant: 'destructive',
      });
      return;
    }
    startTimerMutation.mutate(timerDescription || undefined);
  };

  const handleStopTimer = () => {
    if (isTimerRunningForThisTask && activeTimer) {
      stopTimerMutation.mutate(activeTimer.id);
    }
  };

  const totalTimeSpent = task?.timeEntries?.reduce((acc, entry) => acc + (entry.duration || 0), 0) || 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#131d2e] border-slate-700 text-white">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : task ? (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between pr-8">
                  <div className="flex-1">
                    {isEditing ? (
                      <Input
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="text-xl font-semibold bg-[#0a1628] border-slate-700 text-white"
                      />
                    ) : (
                      <>
                        <DialogTitle className="text-xl text-white">{task.title}</DialogTitle>
                        <p className="text-sm text-slate-400 mt-1">{task.project?.name}</p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <>
                        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="bg-blue-500 hover:bg-blue-600 text-white">
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowDeleteConfirm(true)}
                          className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </DialogHeader>

              {/* Status and Priority Badges */}
              <div className="flex flex-wrap gap-2 mt-2">
                {isEditing ? (
                  <>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      className="text-sm rounded-md border border-slate-700 bg-[#0a1628] text-white px-2 py-1"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value} className="bg-[#0a1628]">{s.label}</option>
                      ))}
                    </select>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                      className="text-sm rounded-md border border-slate-700 bg-[#0a1628] text-white px-2 py-1"
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p.value} value={p.value} className="bg-[#0a1628]">{p.label}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                    <Badge className={getPriorityColor(task.priority)}>
                      <Flag className="h-3 w-3 mr-1" />
                      {task.priority}
                    </Badge>
                  </>
                )}
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                <TabsList className="bg-[#0a1628] border border-slate-700/50">
                  <TabsTrigger value="details" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">Details</TabsTrigger>
                  <TabsTrigger value="subtasks" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
                    Subtasks ({task.subtasks?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
                    Comments ({task.comments?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="time" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">Time Tracking</TabsTrigger>
                  <TabsTrigger value="files" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
                    Files ({task.files?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="activity" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
                    <History className="h-4 w-4 mr-1" />
                    Activity
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="details" className="space-y-4 mt-4">
                  {/* Description */}
                  <div>
                    <Label className="text-sm font-medium text-slate-300 mb-2 block">Description</Label>
                    {isEditing ? (
                      <RichTextEditor
                        value={editForm.description}
                        onChange={(value) => setEditForm({ ...editForm, description: value })}
                        placeholder="Add a description..."
                        minHeight="120px"
                      />
                    ) : task.description ? (
                      <div className="bg-[#0a1628] rounded-lg p-3 text-white">
                        <RichTextDisplay content={task.description} />
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No description</p>
                    )}
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Assignee</p>
                        {isEditing ? (
                          <select
                            value={editForm.assigneeId}
                            onChange={(e) => setEditForm({ ...editForm, assigneeId: e.target.value })}
                            className="text-sm rounded-md border border-slate-700 bg-[#0a1628] text-white px-2 py-1 w-full"
                          >
                            <option value="" className="bg-[#0a1628]">Unassigned</option>
                            {users.map((u) => (
                              <option key={u.id} value={u.id} className="bg-[#0a1628]">{u.name}</option>
                            ))}
                          </select>
                        ) : (
                          <p className="text-sm font-medium text-white">{task.assignee?.name || 'Unassigned'}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Reporter</p>
                        <p className="text-sm font-medium text-white">{task.reporter?.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Due Date</p>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editForm.dueDate}
                            onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                            className="h-8 bg-[#0a1628] border-slate-700 text-white"
                          />
                        ) : (
                          <p className="text-sm font-medium text-white">
                            {task.dueDate ? formatDateTime(task.dueDate) : 'Not set'}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="text-xs text-slate-500">Time Spent</p>
                        <p className="text-sm font-medium text-white">
                          {totalTimeSpent > 0 ? formatDuration(totalTimeSpent) : 'No time logged'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Tags Section */}
                  <div>
                    <Label className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                      <Tags className="h-4 w-4" />
                      Tags
                    </Label>
                    <div className="flex flex-wrap items-center gap-2">
                      {task.tags && task.tags.length > 0 ? (
                        task.tags.map(({ tag }) => (
                          <Badge
                            key={tag.id}
                            style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color }}
                            className="flex items-center gap-1 border"
                          >
                            {tag.name}
                            <button
                              onClick={() => removeTagMutation.mutate(tag.id)}
                              className="ml-1 hover:opacity-70"
                              disabled={removeTagMutation.isPending}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500 italic">No tags</span>
                      )}

                      {/* Add Tag Popover */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-6 gap-1 border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                            <Plus className="h-3 w-3" />
                            Add
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2 bg-[#131d2e] border-slate-700" align="start">
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-slate-400 mb-2">Available Tags</p>
                            {projectTags.length > 0 ? (
                              projectTags
                                .filter((tag) => !taskTagIds.includes(tag.id))
                                .map((tag) => (
                                  <button
                                    key={tag.id}
                                    onClick={() => addTagMutation.mutate(tag.id)}
                                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-slate-700 text-left text-slate-300"
                                    disabled={addTagMutation.isPending}
                                  >
                                    <span
                                      className="w-3 h-3 rounded-full shrink-0"
                                      style={{ backgroundColor: tag.color }}
                                    />
                                    {tag.name}
                                  </button>
                                ))
                            ) : (
                              <p className="text-xs text-slate-500 text-center py-2">
                                No tags in this project
                              </p>
                            )}
                            {projectTags.length > 0 && projectTags.every((t) => taskTagIds.includes(t.id)) && (
                              <p className="text-xs text-slate-500 text-center py-2">
                                All tags added
                              </p>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="subtasks" className="mt-4">
                  <div className="space-y-3">
                    {/* Add subtask form */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a subtask..."
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newSubtask.trim()) {
                            addSubtaskMutation.mutate(newSubtask);
                          }
                        }}
                        className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                      />
                      <Button
                        size="icon"
                        onClick={() => newSubtask.trim() && addSubtaskMutation.mutate(newSubtask)}
                        disabled={!newSubtask.trim() || addSubtaskMutation.isPending}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Subtasks list */}
                    <div className="space-y-2">
                      {task.subtasks && task.subtasks.length > 0 ? (
                        task.subtasks.map((subtask) => (
                          <div
                            key={subtask.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800"
                          >
                            <button
                              onClick={() => toggleSubtaskMutation.mutate({
                                subtaskId: subtask.id,
                                completed: subtask.status !== 'COMPLETED',
                              })}
                              className="shrink-0"
                            >
                              {subtask.status === 'COMPLETED' ? (
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                              ) : (
                                <Circle className="h-5 w-5 text-slate-500" />
                              )}
                            </button>
                            <span className={subtask.status === 'COMPLETED' ? 'line-through text-slate-500' : 'text-white'}>
                              {subtask.title}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 text-center py-4">
                          No subtasks yet. Add one above!
                        </p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="comments" className="mt-4">
                  <div className="space-y-4">
                    {/* Add comment form */}
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Add a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[60px] bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                      />
                      <Button
                        size="icon"
                        onClick={() => newComment.trim() && addCommentMutation.mutate(newComment)}
                        disabled={!newComment.trim() || addCommentMutation.isPending}
                        className="bg-blue-500 hover:bg-blue-600"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Comments list */}
                    <div className="space-y-3">
                      {task.comments && task.comments.length > 0 ? (
                        task.comments.map((comment) => (
                          <div key={comment.id} className="flex gap-3 p-3 bg-[#0a1628] rounded-lg">
                            <Avatar className="h-8 w-8 shrink-0 border border-slate-700">
                              <AvatarImage src={comment.user.avatar} />
                              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white text-xs">{getInitials(comment.user.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-white">{comment.user.name}</span>
                                  <span className="text-xs text-slate-500">
                                    {formatDateTime(comment.createdAt)}
                                  </span>
                                </div>
                                {/* Edit/Delete buttons - only for comment author */}
                                {user?.id === comment.user.id && editingCommentId !== comment.id && (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setEditingCommentContent(comment.content);
                                      }}
                                    >
                                      <Edit className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                      onClick={() => deleteCommentMutation.mutate(comment.id)}
                                      disabled={deleteCommentMutation.isPending}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>
                              {editingCommentId === comment.id ? (
                                <div className="mt-2 space-y-2">
                                  <Textarea
                                    value={editingCommentContent}
                                    onChange={(e) => setEditingCommentContent(e.target.value)}
                                    className="min-h-[60px] bg-[#131d2e] border-slate-700 text-white"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        updateCommentMutation.mutate({
                                          commentId: comment.id,
                                          content: editingCommentContent,
                                        })
                                      }
                                      disabled={!editingCommentContent.trim() || updateCommentMutation.isPending}
                                      className="bg-blue-500 hover:bg-blue-600"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingCommentId(null);
                                        setEditingCommentContent('');
                                      }}
                                      className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-slate-300 mt-1">{comment.content}</p>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 text-center py-4">
                          No comments yet. Be the first to comment!
                        </p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="time" className="mt-4">
                  <div className="space-y-4">
                    {/* Timer control */}
                    <div className="p-4 bg-[#0a1628] rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">
                            {isTimerRunningForThisTask ? 'Timer Running' : 'Start Timer'}
                          </p>
                          <p className="text-sm text-slate-400">
                            Total: {totalTimeSpent > 0 ? formatDuration(totalTimeSpent) : '0m'}
                          </p>
                        </div>
                        {isTimerRunningForThisTask ? (
                          <Button
                            onClick={handleStopTimer}
                            variant="destructive"
                            disabled={stopTimerMutation.isPending}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            <Square className="h-4 w-4 mr-2" />
                            Stop
                          </Button>
                        ) : (
                          <Button
                            onClick={handleStartTimer}
                            disabled={startTimerMutation.isPending || !!activeTimer}
                            className="bg-emerald-500 hover:bg-emerald-600"
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Start
                          </Button>
                        )}
                      </div>

                      {/* Description input - only show when not running */}
                      {!isTimerRunningForThisTask && !activeTimer && (
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-400">What are you working on?</Label>
                          <Input
                            value={timerDescription}
                            onChange={(e) => setTimerDescription(e.target.value)}
                            placeholder="e.g., Fixing bug in login form..."
                            className="bg-[#131d2e] border-slate-700 text-white placeholder:text-slate-500"
                          />
                        </div>
                      )}

                      {/* Show current timer description if running */}
                      {isTimerRunningForThisTask && activeTimer?.description && (
                        <p className="text-sm text-slate-400 italic">
                          Working on: {activeTimer.description}
                        </p>
                      )}
                    </div>

                    {/* Time entries list */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-white">Time Entries</h4>
                      {task.timeEntries && task.timeEntries.length > 0 ? (
                        task.timeEntries.map((entry) => (
                          <div key={entry.id} className="p-3 border border-slate-700 rounded-lg bg-[#0a1628]">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-white">{entry.user.name}</p>
                                <p className="text-xs text-slate-500">
                                  {formatDateTime(entry.startTime)}
                                  {entry.endTime && ` - ${formatDateTime(entry.endTime)}`}
                                </p>
                              </div>
                              <span className="text-sm font-medium text-blue-400">
                                {entry.duration ? formatDuration(entry.duration) : 'In progress...'}
                              </span>
                            </div>
                            {entry.description && (
                              <p className="text-sm text-slate-400 mt-2 pt-2 border-t border-slate-700">
                                {entry.description}
                              </p>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500 text-center py-4">
                          No time entries yet.
                        </p>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="files" className="mt-4">
                  <div className="space-y-4">
                    {/* File upload section */}
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-white">Attachments</h4>
                      <div className="relative">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          disabled={isUploading}
                        />
                        <Button size="sm" disabled={isUploading} className="bg-blue-500 hover:bg-blue-600">
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          {isUploading ? 'Uploading...' : 'Upload Files'}
                        </Button>
                      </div>
                    </div>

                    {/* Files list */}
                    {task.files && task.files.length > 0 ? (
                      <div className="space-y-2">
                        {task.files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-3 bg-[#0a1628] rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              {file.mimeType.startsWith('image/') ? (
                                <FileImage className="h-5 w-5 text-blue-400" />
                              ) : (
                                <FileText className="h-5 w-5 text-slate-400" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-white">{file.originalName}</p>
                                <p className="text-xs text-slate-500">
                                  {formatFileSize(file.size)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              {/* Share button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                                onClick={() => handleCreateShare(file.id)}
                                disabled={isCreatingShare && sharingFileId === file.id}
                                title="Create shareable link"
                              >
                                {isCreatingShare && sharingFileId === file.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Share2 className="h-4 w-4" />
                                )}
                              </Button>
                              {/* Download button */}
                              <a
                                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/files/${file.id}/download`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:text-emerald-300 p-1.5 rounded hover:bg-emerald-500/10"
                                title="Download file"
                              >
                                <Download className="h-4 w-4" />
                              </a>
                              {/* Delete button */}
                              {(user?.id === file.uploader?.id || user?.role === 'CEO') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  onClick={() => deleteFileMutation.mutate(file.id)}
                                  disabled={deleteFileMutation.isPending}
                                  title="Delete file"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-slate-700 rounded-lg">
                        <Paperclip className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">
                          No files attached to this task.
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Click the Upload button above to add files.
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-4">
                  <ActivityFeed taskId={taskId!} limit={30} showHeader={false} />
                </TabsContent>
              </Tabs>
            </>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 font-medium">Error loading task</p>
              <p className="text-sm text-slate-500 mt-2">{(error as Error).message}</p>
            </div>
          ) : (
            <p className="text-center py-8 text-slate-500">Task not found</p>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        loading={deleteMutation.isPending}
      />

      {/* Share Link Dialog */}
      <Dialog open={!!shareUrl} onOpenChange={(open) => !open && closeShareDialog()}>
        <DialogContent className="max-w-md bg-[#131d2e] border-slate-700">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Link className="h-5 w-5" />
              Share Link Created
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-slate-400">
              Anyone with this link can download the file. The link will remain active until you delete it.
            </p>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={shareUrl || ''}
                className="flex-1 bg-[#0a1628] border-slate-700 text-white font-mono text-sm"
              />
              <Button
                onClick={handleCopyShareUrl}
                className={copiedShareUrl ? 'shrink-0 bg-emerald-500 hover:bg-emerald-600' : 'shrink-0 border-slate-600 bg-slate-800 text-white hover:bg-slate-700'}
                variant={copiedShareUrl ? 'default' : 'outline'}
              >
                {copiedShareUrl ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={closeShareDialog} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
