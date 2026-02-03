'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { api, tasksApi, projectsApi, usersApi, tagsApi, Task, Tag, TimeEntry, GeneratedTask } from '@/lib/api';
import { AITaskAssistant } from '@/components/ai';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { TaskDetailModal } from '@/components/tasks/task-detail-modal';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { FileUploader, UploadedFile } from '@/components/ui/file-uploader';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
  Calendar,
  User,
  Tags,
  SlidersHorizontal,
  Clock,
  Sparkles,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils';

const statusColumns = [
  { id: 'TODO', label: 'To Do', color: 'bg-slate-500' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-500' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-500' },
  { id: 'COMPLETED', label: 'Completed', color: 'bg-emerald-500' },
];

const priorities = [
  { value: 'LOW', label: 'Low', color: 'bg-slate-500/20 text-slate-400' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-500/20 text-red-400' },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface TaskWithTags extends Task {
  tags?: Array<{ tag: Tag }>;
  actualHours?: number;
}

interface Filters {
  status: string[];
  priority: string[];
  assigneeId: string[];
  projectId: string[];
  tagId: string[];
  myTasks: boolean;
  dueSoon: boolean;
  overdue: boolean;
}

export default function TasksPage() {
  const { accessToken, user, hasPermission } = useAuthStore();
  const canCreateTasks = hasPermission('tasks.create');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban' | 'calendar'>('kanban');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    status: [],
    priority: [],
    assigneeId: [],
    projectId: [],
    tagId: [],
    myTasks: false,
    dueSoon: false,
    overdue: false,
  });
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    projectId: '',
    priority: 'MEDIUM',
    assigneeId: '',
    dueDate: '',
  });
  const [taskFiles, setTaskFiles] = useState<UploadedFile[]>([]);
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const taskResult = await tasksApi.create(data, accessToken!);

      if (taskFiles.length > 0 && taskResult.data) {
        try {
          const formData = new FormData();
          taskFiles.forEach((f) => {
            formData.append('files', f.file);
          });
          formData.append('taskId', taskResult.data.id);

          await api.uploadFiles('/api/files/upload', formData, accessToken!);
        } catch (uploadError) {
          console.error('File upload error:', uploadError);
          toast({ title: 'Task created but file upload failed', variant: 'destructive' });
        }
      }

      return taskResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowCreateForm(false);
      setNewTask({ title: '', description: '', projectId: '', priority: 'MEDIUM', assigneeId: '', dueDate: '' });
      setTaskFiles([]);
      toast({ title: 'Task created successfully' });
    },
    onError: (error: Error) => {
      console.error('Task creation error:', error);
      toast({ title: 'Failed to create task', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) =>
      tasksApi.update(id, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Task updated' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.delete(id, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Task deleted' });
      setTaskToDelete(null);
    },
    onError: () => {
      toast({ title: 'Failed to delete task', variant: 'destructive' });
    },
  });

  // Timer queries and mutations
  const { data: activeTimerData } = useQuery({
    queryKey: ['activeTimer'],
    queryFn: () => tasksApi.getActiveTimer(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const startTimerMutation = useMutation({
    mutationFn: (taskId: string) => tasksApi.startTimer(taskId, accessToken!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Timer started' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to start timer', description: error.message, variant: 'destructive' });
    },
  });

  const stopTimerMutation = useMutation({
    mutationFn: ({ taskId, timeEntryId }: { taskId: string; timeEntryId: string }) =>
      tasksApi.stopTimer(taskId, timeEntryId, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Timer stopped' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to stop timer', description: error.message, variant: 'destructive' });
    },
  });

  const activeTimer = activeTimerData?.data;

  const handleStartTimer = (taskId: string) => {
    // If there's an active timer on another task, stop it first
    if (activeTimer && activeTimer.taskId !== taskId) {
      stopTimerMutation.mutate(
        { taskId: activeTimer.taskId, timeEntryId: activeTimer.id },
        {
          onSuccess: () => {
            startTimerMutation.mutate(taskId);
          },
        }
      );
    } else {
      startTimerMutation.mutate(taskId);
    }
  };

  const handleStopTimer = (taskId: string, timeEntryId: string) => {
    stopTimerMutation.mutate({ taskId, timeEntryId });
  };

  const tasks = (tasksData?.data || []) as TaskWithTags[];
  const projects = projectsData?.data || [];
  const users = usersData?.data || [];
  const allTags = tagsData?.data || [];

  // Apply filters
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search filter
      if (search && !t.title.toLowerCase().includes(search.toLowerCase()) &&
          !t.description?.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }

      // My tasks filter
      if (filters.myTasks && t.assigneeId !== user?.id) {
        return false;
      }

      // Status filter
      if (filters.status.length > 0 && !filters.status.includes(t.status)) {
        return false;
      }

      // Priority filter
      if (filters.priority.length > 0 && !filters.priority.includes(t.priority)) {
        return false;
      }

      // Assignee filter
      if (filters.assigneeId.length > 0 && (!t.assigneeId || !filters.assigneeId.includes(t.assigneeId))) {
        return false;
      }

      // Project filter
      if (filters.projectId.length > 0 && !filters.projectId.includes(t.projectId)) {
        return false;
      }

      // Tag filter
      if (filters.tagId.length > 0) {
        const taskTagIds = t.tags?.map((tt) => tt.tag.id) || [];
        if (!filters.tagId.some((tagId) => taskTagIds.includes(tagId))) {
          return false;
        }
      }

      // Due soon filter (within 3 days)
      if (filters.dueSoon) {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        const now = new Date();
        const threeDays = 3 * 24 * 60 * 60 * 1000;
        if (!(due > now && due.getTime() - now.getTime() < threeDays)) return false;
      }

      // Overdue filter
      if (filters.overdue) {
        if (!t.dueDate) return false;
        if (new Date(t.dueDate) >= new Date()) return false;
      }

      return true;
    });
  }, [tasks, search, filters, user?.id]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.myTasks) count++;
    if (filters.dueSoon) count++;
    if (filters.overdue) count++;
    count += filters.status.length;
    count += filters.priority.length;
    count += filters.assigneeId.length;
    count += filters.projectId.length;
    count += filters.tagId.length;
    return count;
  }, [filters]);

  const clearFilters = () => {
    setFilters({
      status: [],
      priority: [],
      assigneeId: [],
      projectId: [],
      tagId: [],
      myTasks: false,
      dueSoon: false,
      overdue: false,
    });
  };

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    const current = new Date(startDate);

    while (current <= lastDay || days.length % 7 !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  }, [currentDate]);

  const getTasksForDate = (date: Date) => {
    return filteredTasks.filter((task) => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return (
        taskDate.getDate() === date.getDate() &&
        taskDate.getMonth() === date.getMonth() &&
        taskDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || !newTask.projectId) {
      toast({ title: 'Please fill in required fields', variant: 'destructive' });
      return;
    }
    createMutation.mutate(newTask);
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateMutation.mutate({ id: taskId, data: { status: newStatus } });
  };

  const handleTaskMove = (taskId: string, newStatus: string) => {
    updateMutation.mutate({ id: taskId, data: { status: newStatus } });
  };

  const handleTaskDelete = (taskId: string) => {
    setTaskToDelete(taskId);
  };

  const handleTaskArchive = (taskId: string) => {
    updateMutation.mutate({ id: taskId, data: { status: 'CANCELLED' } });
    toast({ title: 'Task archived' });
  };

  const getPriorityColor = (priority: string) => {
    return priorities.find((p) => p.value === priority)?.color || 'bg-gray-100 text-gray-700';
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[{ label: 'Tasks' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-slate-400 mt-1">Manage and track your tasks</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-slate-700 bg-[#131d2e]">
            <Button
              variant={viewMode === 'kanban' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('kanban')}
              className={cn("rounded-r-none", viewMode === 'kanban' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700')}
            >
              Kanban
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className={cn("rounded-none border-x border-slate-700", viewMode === 'list' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700')}
            >
              List
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              className={cn("rounded-l-none", viewMode === 'calendar' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700')}
            >
              Calendar
            </Button>
          </div>
          {canCreateTasks && (
            <div className="flex gap-2">
              <Button
                onClick={() => setShowAIAssistant(true)}
                variant="outline"
                className="border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:text-purple-300"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                AI Assistant
              </Button>
              <Button onClick={() => setShowCreateForm(!showCreateForm)} className="bg-blue-500 hover:bg-blue-600 text-white">
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* AI Task Assistant */}
      <AITaskAssistant
        open={showAIAssistant}
        onOpenChange={setShowAIAssistant}
        projectId={newTask.projectId || undefined}
        onTaskGenerated={(generatedTask: GeneratedTask) => {
          // Pre-fill the create form with AI-generated task
          setNewTask({
            ...newTask,
            title: generatedTask.title,
            description: generatedTask.description,
            priority: generatedTask.priority,
          });
          setShowCreateForm(true);
          toast({
            title: 'Task Pre-filled',
            description: 'Review and adjust the AI-generated task before creating.',
          });
        }}
      />

      {/* Create Form */}
      {showCreateForm && canCreateTasks && (
        <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Create New Task</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-slate-300">Task Title *</Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Enter task title"
                  className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project" className="text-slate-300">Project *</Label>
                <select
                  id="project"
                  value={newTask.projectId}
                  onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white"
                >
                  <option value="" className="bg-[#0a1628]">Select project</option>
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id} className="bg-[#0a1628]">
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="priority" className="text-slate-300">Priority</Label>
                <select
                  id="priority"
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white"
                >
                  {priorities.map((p) => (
                    <option key={p.value} value={p.value} className="bg-[#0a1628]">
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assignee" className="text-slate-300">Assignee</Label>
                <select
                  id="assignee"
                  value={newTask.assigneeId}
                  onChange={(e) => setNewTask({ ...newTask, assigneeId: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white"
                >
                  <option value="" className="bg-[#0a1628]">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#0a1628]">
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate" className="text-slate-300">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="bg-[#0a1628] border-slate-700 text-white"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-300">Description</Label>
              <RichTextEditor
                value={newTask.description}
                onChange={(value) => setNewTask({ ...newTask, description: value })}
                placeholder="Enter task description with formatting..."
                minHeight="120px"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Attachments</Label>
              <FileUploader
                files={taskFiles}
                onChange={setTaskFiles}
                maxFiles={10}
                maxSize={50 * 1024 * 1024}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending} className="bg-blue-500 hover:bg-blue-600 text-white">
                {createMutation.isPending ? 'Creating...' : 'Create Task'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[#131d2e] border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Quick Filters */}
        <Button
          variant={filters.myTasks ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilters({ ...filters, myTasks: !filters.myTasks })}
          className={filters.myTasks ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'}
        >
          <User className="h-4 w-4 mr-1" />
          My Tasks
        </Button>

        {/* Filter Popover */}
        <Popover open={showFilters} onOpenChange={setShowFilters}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="relative border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white">
              <SlidersHorizontal className="h-4 w-4 mr-1" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center bg-blue-500">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-[#131d2e] border-slate-700" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-white">Filters</h4>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-400 hover:text-white hover:bg-slate-700">
                    Clear all
                  </Button>
                )}
              </div>

              {/* Due Date Filters */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-400">Due Date</Label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={filters.dueSoon}
                      onCheckedChange={(checked) =>
                        setFilters({ ...filters, dueSoon: checked as boolean })
                      }
                    />
                    <span className="text-sm text-slate-300">Due soon (within 3 days)</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={filters.overdue}
                      onCheckedChange={(checked) =>
                        setFilters({ ...filters, overdue: checked as boolean })
                      }
                    />
                    <span className="text-sm text-slate-300">Overdue</span>
                  </label>
                </div>
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-400">Status</Label>
                <div className="flex flex-wrap gap-2">
                  {statusColumns.map((status) => (
                    <Badge
                      key={status.id}
                      variant={filters.status.includes(status.id) ? 'default' : 'outline'}
                      className={cn("cursor-pointer", filters.status.includes(status.id) ? 'bg-blue-500' : 'border-slate-600 text-slate-300 hover:bg-slate-700')}
                      onClick={() => {
                        const newStatus = filters.status.includes(status.id)
                          ? filters.status.filter((s) => s !== status.id)
                          : [...filters.status, status.id];
                        setFilters({ ...filters, status: newStatus });
                      }}
                    >
                      <div className={cn('h-2 w-2 rounded-full mr-1', status.color)} />
                      {status.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-400">Priority</Label>
                <div className="flex flex-wrap gap-2">
                  {priorities.map((priority) => (
                    <Badge
                      key={priority.value}
                      variant={filters.priority.includes(priority.value) ? 'default' : 'outline'}
                      className={cn("cursor-pointer", filters.priority.includes(priority.value) ? 'bg-blue-500' : 'border-slate-600 text-slate-300 hover:bg-slate-700')}
                      onClick={() => {
                        const newPriority = filters.priority.includes(priority.value)
                          ? filters.priority.filter((p) => p !== priority.value)
                          : [...filters.priority, priority.value];
                        setFilters({ ...filters, priority: newPriority });
                      }}
                    >
                      {priority.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Project Filter */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-400">Project</Label>
                <select
                  multiple
                  value={filters.projectId}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, (opt) => opt.value);
                    setFilters({ ...filters, projectId: values });
                  }}
                  className="w-full h-24 rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white"
                >
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.id} className="bg-[#0a1628]">
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee Filter */}
              <div className="space-y-2">
                <Label className="text-sm text-slate-400">Assignee</Label>
                <select
                  multiple
                  value={filters.assigneeId}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, (opt) => opt.value);
                    setFilters({ ...filters, assigneeId: values });
                  }}
                  className="w-full h-24 rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id} className="bg-[#0a1628]">
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tag Filter */}
              {allTags.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-slate-400">Tags</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {allTags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant={filters.tagId.includes(tag.id) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        style={{
                          backgroundColor: filters.tagId.includes(tag.id) ? tag.color : 'transparent',
                          borderColor: tag.color,
                          color: filters.tagId.includes(tag.id) ? 'white' : tag.color,
                        }}
                        onClick={() => {
                          const newTagId = filters.tagId.includes(tag.id)
                            ? filters.tagId.filter((t) => t !== tag.id)
                            : [...filters.tagId, tag.id];
                          setFilters({ ...filters, tagId: newTagId });
                        }}
                      >
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.myTasks && (
            <Badge variant="secondary" className="gap-1">
              My Tasks
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setFilters({ ...filters, myTasks: false })}
              />
            </Badge>
          )}
          {filters.dueSoon && (
            <Badge variant="secondary" className="gap-1">
              Due Soon
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setFilters({ ...filters, dueSoon: false })}
              />
            </Badge>
          )}
          {filters.overdue && (
            <Badge variant="secondary" className="gap-1">
              Overdue
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() => setFilters({ ...filters, overdue: false })}
              />
            </Badge>
          )}
          {filters.status.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1">
              {statusColumns.find((c) => c.id === s)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  setFilters({ ...filters, status: filters.status.filter((st) => st !== s) })
                }
              />
            </Badge>
          ))}
          {filters.priority.map((p) => (
            <Badge key={p} variant="secondary" className="gap-1">
              {priorities.find((pr) => pr.value === p)?.label}
              <X
                className="h-3 w-3 cursor-pointer"
                onClick={() =>
                  setFilters({ ...filters, priority: filters.priority.filter((pr) => pr !== p) })
                }
              />
            </Badge>
          ))}
          {filters.tagId.map((tagId) => {
            const tag = allTags.find((t) => t.id === tagId);
            return tag ? (
              <Badge
                key={tagId}
                className="gap-1"
                style={{
                  backgroundColor: tag.color + '20',
                  color: tag.color,
                  borderColor: tag.color,
                }}
              >
                <Tags className="h-3 w-3" />
                {tag.name}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() =>
                    setFilters({ ...filters, tagId: filters.tagId.filter((t) => t !== tagId) })
                  }
                />
              </Badge>
            ) : null;
          })}
        </div>
      )}

      {/* Tasks View */}
      {isLoading ? (
        <div className="space-y-4">
          {viewMode === 'kanban' ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-lg bg-[#131d2e] p-4 space-y-3">
                  <Skeleton className="h-6 w-24 bg-slate-700" />
                  <Skeleton className="h-24 w-full bg-slate-700" />
                  <Skeleton className="h-24 w-full bg-slate-700" />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#131d2e] rounded-xl border border-slate-700/50">
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-16 w-full bg-slate-700" />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard
          tasks={filteredTasks}
          onTaskClick={setSelectedTaskId}
          onTaskMove={handleTaskMove}
          onTaskEdit={setSelectedTaskId}
          onTaskDelete={handleTaskDelete}
          onTaskArchive={handleTaskArchive}
          onStatusChange={handleStatusChange}
          activeTimerTaskId={activeTimer?.taskId || null}
          activeTimerEntryId={activeTimer?.id || null}
          onStartTimer={handleStartTimer}
          onStopTimer={handleStopTimer}
        />
      ) : viewMode === 'calendar' ? (
        <div className="bg-[#131d2e] rounded-xl border border-slate-700/50">
          <div className="flex items-center justify-between p-6 border-b border-slate-700/50">
            <h2 className="text-lg font-semibold text-white">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth} className="border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} className="border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-7 gap-px bg-slate-700">
              {DAYS.map((day) => (
                <div key={day} className="bg-[#0a1628] p-2 text-center text-sm font-medium text-slate-400">
                  {day}
                </div>
              ))}
              {calendarDays.map((date, index) => {
                const dayTasks = getTasksForDate(date);
                return (
                  <div
                    key={index}
                    className={cn(
                      'min-h-[100px] bg-[#131d2e] p-2',
                      !isCurrentMonth(date) && 'bg-[#0a1628] text-slate-600',
                      isToday(date) && 'bg-blue-500/10'
                    )}
                  >
                    <div className={cn('text-sm font-medium text-white', isToday(date) && 'text-blue-400', !isCurrentMonth(date) && 'text-slate-600')}>
                      {date.getDate()}
                    </div>
                    <div className="mt-1 space-y-1">
                      {dayTasks.slice(0, 3).map((task) => (
                        <div
                          key={task.id}
                          className={cn(
                            'cursor-pointer truncate rounded px-1 py-0.5 text-xs',
                            getPriorityColor(task.priority)
                          )}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          {task.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-xs text-slate-500">+{dayTasks.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[#131d2e] rounded-xl border border-slate-700/50">
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckSquare className="h-12 w-12 text-slate-600" />
              <h3 className="mt-4 text-lg font-medium text-white">No tasks found</h3>
              <p className="mt-2 text-sm text-slate-400">
                {search || activeFiltersCount > 0
                  ? 'Try adjusting your filters'
                  : 'Create your first task to get started'}
              </p>
              {!search && activeFiltersCount === 0 && (
                <Button className="mt-4 bg-blue-500 hover:bg-blue-600 text-white" onClick={() => setShowCreateForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Task
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex-1 space-y-1">
                    <h4 className="font-medium text-white">{task.title}</h4>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-slate-400">
                        {task.project?.name} {task.assignee && `- ${task.assignee.name}`}
                      </span>
                      {task.actualHours && task.actualHours > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-400">
                          <Clock className="h-3 w-3" />
                          {formatDuration(Math.round(task.actualHours * 60))}
                        </span>
                      )}
                      {task.tags && task.tags.length > 0 && (
                        <div className="flex gap-1">
                          {task.tags.slice(0, 3).map(({ tag }) => (
                            <span
                              key={tag.id}
                              className="px-1.5 py-0.5 text-xs rounded"
                              style={{
                                backgroundColor: tag.color + '20',
                                color: tag.color,
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {task.tags.length > 3 && (
                            <span className="text-xs text-slate-500">+{task.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn('rounded-full px-2 py-1 text-xs', getPriorityColor(task.priority))}>
                      {task.priority}
                    </span>
                    <select
                      value={task.status}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(task.id, e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-md border border-slate-700 bg-[#0a1628] px-2 py-1 text-sm text-white"
                    >
                      {statusColumns.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#0a1628]">
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        open={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!taskToDelete}
        onOpenChange={(open) => !open && setTaskToDelete(null)}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => taskToDelete && deleteMutation.mutate(taskToDelete)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
