'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { tasksApi, projectsApi } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Activity, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

interface Task {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  createdAt: string;
  assignee?: {
    id: string;
    name: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

interface Project {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  createdAt: string;
}

interface ActivityItem {
  id: string;
  type: 'task' | 'project';
  user: string;
  action: string;
  target: string;
  targetId: string;
  projectName?: string;
  date: Date;
  colorIndex: number;
}

export default function ActivityPage() {
  const router = useRouter();
  const { accessToken } = useAuthStore();

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const isLoading = tasksLoading || projectsLoading;
  const tasks: Task[] = tasksData?.data || [];
  const projects: Project[] = projectsData?.data || [];

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 1);
  };

  const getAvatarColor = (index: number) => {
    const colors = [
      'bg-emerald-500',
      'bg-amber-500',
      'bg-red-500',
      'bg-purple-500',
      'bg-blue-500',
      'bg-pink-500',
      'bg-cyan-500',
      'bg-orange-500',
    ];
    return colors[index % colors.length];
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHours === 0) {
        const diffMins = Math.floor(diffMs / (1000 * 60));
        return diffMins <= 1 ? 'Just now' : `${diffMins} minutes ago`;
      }
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    }).toUpperCase();
  };

  // Combine tasks and projects into activity items
  const activityItems: ActivityItem[] = [
    ...tasks.map((task, index) => ({
      id: `task-${task.id}`,
      type: 'task' as const,
      user: task.assignee?.name || 'Unknown User',
      action: task.status === 'COMPLETED'
        ? 'completed task'
        : task.status === 'IN_PROGRESS'
        ? 'started working on'
        : 'updated task',
      target: task.title,
      targetId: task.id,
      projectName: task.project?.name,
      date: new Date(task.updatedAt || task.createdAt),
      colorIndex: index,
    })),
    ...projects.map((project, index) => ({
      id: `project-${project.id}`,
      type: 'project' as const,
      user: 'Team',
      action: project.status === 'COMPLETED'
        ? 'completed project'
        : project.status === 'ACTIVE'
        ? 'activated project'
        : 'updated project',
      target: project.name,
      targetId: project.id,
      date: new Date(project.updatedAt || project.createdAt),
      colorIndex: tasks.length + index,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  // Group activities by date
  const groupedActivities = activityItems.reduce((groups, activity) => {
    const dateKey = activity.date.toDateString();
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(activity);
    return groups;
  }, {} as Record<string, ActivityItem[]>);

  const getDateLabel = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  const handleActivityClick = (activity: ActivityItem) => {
    if (activity.type === 'task') {
      router.push(`/dashboard/tasks?taskId=${activity.targetId}`);
    } else {
      router.push(`/dashboard/projects/${activity.targetId}`);
    }
  };

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/dashboard')}
          className="text-slate-400 hover:text-white hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Activity className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">All Activity</h1>
            <p className="text-slate-400 text-sm">Complete history of updates from your projects and tasks</p>
          </div>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-[#131d2e] rounded-xl border border-slate-700/50">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full bg-slate-700" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-3/4 mb-1 bg-slate-700" />
                  <Skeleton className="h-3 w-1/4 bg-slate-700" />
                </div>
              </div>
            ))}
          </div>
        ) : activityItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Activity className="h-12 w-12 text-slate-600 mb-3" />
            <p className="text-slate-400 text-lg">No activity yet</p>
            <p className="text-slate-500 text-sm mt-1">Activity will appear here when tasks and projects are updated</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {Object.entries(groupedActivities).map(([dateKey, activities]) => (
              <div key={dateKey}>
                {/* Date Header */}
                <div className="px-6 py-3 bg-slate-800/30 border-b border-slate-700/50">
                  <p className="text-sm font-medium text-slate-400">{getDateLabel(dateKey)}</p>
                </div>

                {/* Activities for this date */}
                <div className="divide-y divide-slate-700/30">
                  {activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                      onClick={() => handleActivityClick(activity)}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0',
                        getAvatarColor(activity.colorIndex)
                      )}>
                        {getInitials(activity.user)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-300">
                          <span className="font-medium text-white">{activity.user}</span>{' '}
                          {activity.action}{' '}
                          <span className="text-blue-400">&quot;{activity.target}&quot;</span>
                        </p>
                        {activity.projectName && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            in {activity.projectName}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-xs shrink-0">
                        <span>{formatDate(activity.date)}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
