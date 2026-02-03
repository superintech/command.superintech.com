'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { projectsApi, tasksApi, usersApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  FolderKanban,
  CheckSquare,
  Users,
  Clock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { ActivitySummaryCard } from '@/components/ai';

export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const isLoading = projectsLoading || tasksLoading || usersLoading;
  const projects = projectsData?.data || [];
  const tasks = tasksData?.data || [];
  const users = usersData?.data || [];

  const myTasks = tasks.filter((t) => t.assigneeId === user?.id);
  const inProgressTasks = myTasks.filter((t) => t.status === 'IN_PROGRESS');
  const overdueTasks = myTasks.filter((t) => {
    if (!t.dueDate) return false;
    return new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED';
  });

  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
  const activeUsers = users.filter((u) => u.isActive).length;

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
    ];
    return colors[index % colors.length];
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  };

  // Get recent activity from tasks
  const recentActivity = [...tasks]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())
    .slice(0, 5)
    .map((task, index) => ({
      id: task.id,
      user: task.assignee?.name || 'Unknown User',
      action: `updated task "${task.title}"`,
      date: formatDate(task.updatedAt || task.createdAt),
      colorIndex: index,
    }));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500 text-white">
            COMPLETED
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white">
            IN PROGRESS
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500 text-white">
            {status.replace('_', ' ')}
          </span>
        );
    }
  };

  const getProjectStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
            ACTIVE
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </span>
        );
      case 'PLANNING':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
            PLANNING
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-400">
            COMPLETED
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400">
            {status}
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-full">
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {isLoading ? (
          <>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50">
                <Skeleton className="h-4 w-24 mb-2 bg-slate-700" />
                <Skeleton className="h-8 w-12 bg-slate-700" />
              </div>
            ))}
          </>
        ) : (
          <>
            {/* Active Projects */}
            <div
              className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50 cursor-pointer hover:bg-[#1a2942] transition-colors"
              onClick={() => router.push('/dashboard/projects')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 tracking-wider uppercase">Active Projects</p>
                  <p className="text-3xl font-bold text-white mt-1">{String(activeProjects).padStart(2, '0')}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <FolderKanban className="h-5 w-5 text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Assigned Tasks */}
            <div
              className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50 cursor-pointer hover:bg-[#1a2942] transition-colors"
              onClick={() => router.push('/dashboard/tasks')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 tracking-wider uppercase">Assigned Tasks</p>
                  <p className="text-3xl font-bold text-white mt-1">{String(myTasks.length).padStart(2, '0')}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <CheckSquare className="h-5 w-5 text-orange-400" />
                </div>
              </div>
            </div>

            {/* In Progress Tasks */}
            <div
              className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50 cursor-pointer hover:bg-[#1a2942] transition-colors"
              onClick={() => router.push('/dashboard/tasks')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 tracking-wider uppercase">In Progress Tasks</p>
                  <p className="text-3xl font-bold text-white mt-1">{String(inProgressTasks.length).padStart(2, '0')}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>
              </div>
            </div>

            {/* Team Members */}
            <div
              className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50 cursor-pointer hover:bg-[#1a2942] transition-colors"
              onClick={() => router.push('/dashboard/team')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-slate-400 tracking-wider uppercase">Team Members</p>
                  <p className="text-3xl font-bold text-white mt-1">{String(activeUsers).padStart(2, '0')}</p>
                </div>
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-yellow-400" />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Main Content - Two Columns */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Welcome Card */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6">
            {/* Wave/Mountain SVG Background */}
            <svg
              className="absolute bottom-0 left-0 right-0 w-full opacity-20"
              viewBox="0 0 1440 320"
              preserveAspectRatio="none"
              style={{ height: '60%' }}
            >
              <path
                fill="currentColor"
                d="M0,224L60,213.3C120,203,240,181,360,181.3C480,181,600,203,720,224C840,245,960,267,1080,250.7C1200,235,1320,181,1380,154.7L1440,128L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
              />
            </svg>
            <svg
              className="absolute bottom-0 left-0 right-0 w-full opacity-10"
              viewBox="0 0 1440 320"
              preserveAspectRatio="none"
              style={{ height: '50%' }}
            >
              <path
                fill="currentColor"
                d="M0,288L60,272C120,256,240,224,360,213.3C480,203,600,213,720,229.3C840,245,960,267,1080,261.3C1200,256,1320,224,1380,208L1440,192L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"
              />
            </svg>

            <div className="relative z-10">
              <p className="text-purple-200 text-sm mb-1">Welcome to Project management</p>
              <h1 className="text-4xl font-bold text-white mb-16">
                Hello {user?.name?.split(' ')[0] || 'there'}
              </h1>

              {/* Overdue Alert */}
              {overdueTasks.length > 0 && (
                <div
                  className="flex items-center justify-between bg-[#131d2e]/80 backdrop-blur-sm rounded-xl px-4 py-3 cursor-pointer hover:bg-[#131d2e] transition-colors"
                  onClick={() => router.push('/dashboard/tasks')}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-slate-500 flex items-center justify-center">
                      <AlertCircle className="h-5 w-5 text-slate-300" />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        You have {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}
                      </p>
                      <p className="text-slate-400 text-sm">Please review and update your overdue tasks.</p>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center">
                    <ArrowRight className="h-5 w-5 text-slate-400" />
                  </div>
                </div>
              )}
              {overdueTasks.length === 0 && (
                <div className="flex items-center justify-between bg-[#131d2e]/80 backdrop-blur-sm rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-emerald-500 flex items-center justify-center">
                      <CheckSquare className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">All tasks are on track!</p>
                      <p className="text-slate-400 text-sm">You have no overdue tasks.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/activity')}
                className="text-slate-400 hover:text-white hover:bg-slate-700/50 text-xs"
              >
                View all
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <p className="text-slate-500 text-sm mb-4">Latest updates from your projects</p>

            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full bg-slate-700" />
                    <Skeleton className="h-4 flex-1 bg-slate-700" />
                    <Skeleton className="h-4 w-16 bg-slate-700" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-slate-500">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={activity.id} className="flex items-center gap-3 py-1">
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-medium',
                      getAvatarColor(index)
                    )}>
                      {getInitials(activity.user)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-300">
                        <span className="font-medium text-white">{activity.user}</span>{' '}
                        {activity.action}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-xs">
                      <span>{activity.date}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Activity Summary */}
          <ActivitySummaryCard />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* My Tasks */}
          <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-white">My Tasks</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/tasks')}
                className="text-slate-400 hover:text-white hover:bg-slate-700/50 text-xs"
              >
                View all
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <p className="text-slate-500 text-sm mb-4">Tasks assigned to you</p>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full bg-slate-700 rounded-lg" />
                ))}
              </div>
            ) : myTasks.length === 0 ? (
              <div className="text-center py-8">
                <CheckSquare className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500">No tasks assigned</p>
              </div>
            ) : (
              <div className="space-y-2">
                {myTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    className="bg-[#1a2942] rounded-lg p-3 cursor-pointer hover:bg-[#1f3352] transition-colors"
                    onClick={() => router.push('/dashboard/tasks')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-white truncate">{task.title}</p>
                        <p className="text-sm text-slate-400">{task.assignee?.name || user?.name}</p>
                      </div>
                      <div className="shrink-0">
                        {getStatusBadge(task.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Projects */}
          <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard/projects')}
                className="text-slate-400 hover:text-white hover:bg-slate-700/50 text-xs"
              >
                View all
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <p className="text-slate-500 text-sm mb-4">Projects you&apos;re part of</p>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full bg-slate-700 rounded-lg" />
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-8">
                <FolderKanban className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500">No projects yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {projects.slice(0, 4).map((project) => {
                  const projectTasks = tasks.filter((t) => t.projectId === project.id);
                  const completedTasks = projectTasks.filter((t) => t.status === 'COMPLETED').length;
                  const progress = projectTasks.length > 0
                    ? Math.round((completedTasks / projectTasks.length) * 100)
                    : 0;

                  return (
                    <div
                      key={project.id}
                      className="bg-[#1a2942] rounded-lg p-3 cursor-pointer hover:bg-[#1f3352] transition-colors"
                      onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-white">{project.name}</p>
                        {getProjectStatusBadge(project.status)}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <Progress
                            value={progress}
                            className="h-1.5 bg-slate-700"
                          />
                        </div>
                        <span className="text-xs text-slate-500">{progress}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
