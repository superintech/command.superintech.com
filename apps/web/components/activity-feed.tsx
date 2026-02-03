'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { activityApi, ActivityLog } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import {
  Plus,
  Edit,
  Trash2,
  ArrowRight,
  UserPlus,
  UserMinus,
  MessageSquare,
  Upload,
  Tag,
  CheckCircle2,
  Timer,
  TimerOff,
} from 'lucide-react';

interface ActivityFeedProps {
  projectId?: string;
  taskId?: string;
  limit?: number;
  showHeader?: boolean;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function getActivityIcon(activity: ActivityLog) {
  const metadata = activity.metadata as Record<string, unknown> | undefined;

  // Check for timer actions in metadata
  if (activity.action === 'UPDATED' && metadata?.action) {
    const actionStr = String(metadata.action).toLowerCase();
    if (actionStr.includes('timer started')) {
      return <Timer className="h-4 w-4 text-green-500" />;
    }
    if (actionStr.includes('timer stopped')) {
      return <TimerOff className="h-4 w-4 text-orange-500" />;
    }
  }

  switch (activity.action) {
    case 'CREATED':
      return <Plus className="h-4 w-4 text-green-500" />;
    case 'UPDATED':
      return <Edit className="h-4 w-4 text-blue-500" />;
    case 'DELETED':
      return <Trash2 className="h-4 w-4 text-red-500" />;
    case 'STATUS_CHANGED':
      return <ArrowRight className="h-4 w-4 text-purple-500" />;
    case 'ASSIGNED':
    case 'MEMBER_ADDED':
      return <UserPlus className="h-4 w-4 text-green-500" />;
    case 'UNASSIGNED':
    case 'MEMBER_REMOVED':
      return <UserMinus className="h-4 w-4 text-orange-500" />;
    case 'COMMENTED':
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case 'FILE_UPLOADED':
      return <Upload className="h-4 w-4 text-indigo-500" />;
    case 'TAG_ADDED':
    case 'TAG_REMOVED':
      return <Tag className="h-4 w-4 text-pink-500" />;
    default:
      return <CheckCircle2 className="h-4 w-4 text-gray-500" />;
  }
}

function formatActivityMessage(activity: ActivityLog): string {
  const entityType = activity.entityType.toLowerCase();
  const metadata = activity.metadata as Record<string, unknown> | undefined;
  const changes = activity.changes as Record<string, unknown> | undefined;

  switch (activity.action) {
    case 'CREATED':
      return `created ${entityType === 'task' ? 'task' : 'project'} "${metadata?.title || metadata?.name || ''}"`;
    case 'UPDATED':
      // Check for specific actions in metadata (timer, etc.)
      if (metadata?.action) {
        const actionStr = String(metadata.action).toLowerCase();
        if (actionStr.includes('timer started')) {
          return `started timer on "${metadata?.title || ''}"`;
        }
        if (actionStr.includes('timer stopped')) {
          const duration = metadata?.duration as number | undefined;
          if (duration && duration > 0) {
            const mins = Math.floor(duration / 60);
            const secs = duration % 60;
            return `stopped timer on "${metadata?.title || ''}" (${mins}m ${secs}s)`;
          }
          return `stopped timer on "${metadata?.title || ''}"`;
        }
      }
      return `updated ${entityType} "${metadata?.title || metadata?.name || ''}"`;
    case 'DELETED':
      return `deleted ${entityType} "${metadata?.title || metadata?.name || ''}"`;
    case 'STATUS_CHANGED':
      return `changed status from ${changes?.from || 'unknown'} to ${changes?.to || 'unknown'}`;
    case 'ASSIGNED':
      return `assigned task "${metadata?.title || ''}"`;
    case 'UNASSIGNED':
      return `unassigned from task "${metadata?.title || ''}"`;
    case 'COMMENTED':
      return `commented on "${metadata?.taskTitle || ''}"`;
    case 'FILE_UPLOADED':
      return `uploaded a file to ${entityType}`;
    case 'MEMBER_ADDED':
      return `added a member to project "${metadata?.name || ''}"`;
    case 'MEMBER_REMOVED':
      return `removed a member from project "${metadata?.name || ''}"`;
    case 'TAG_ADDED':
      return `added tag "${metadata?.tagName || ''}"`;
    case 'TAG_REMOVED':
      return `removed tag "${metadata?.tagName || ''}"`;
    default:
      return `performed ${activity.action.toLowerCase().replace('_', ' ')} on ${entityType}`;
  }
}

export function ActivityFeed({ projectId, taskId, limit = 20, showHeader = true }: ActivityFeedProps) {
  const { accessToken } = useAuthStore();

  const { data, isLoading } = useQuery({
    queryKey: ['activity', projectId, taskId, limit],
    queryFn: () => {
      if (taskId) {
        return activityApi.getTaskActivity(taskId, accessToken!, limit);
      } else if (projectId) {
        return activityApi.getProjectActivity(projectId, accessToken!, limit);
      } else {
        return activityApi.getFeed(accessToken!, limit);
      }
    },
    enabled: !!accessToken,
  });

  const activities = data?.data || [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        {showHeader && <Skeleton className="h-6 w-32" />}
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500 text-sm">
        No activity yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showHeader && (
        <h3 className="text-sm font-medium text-slate-400">Activity</h3>
      )}
      <div className="space-y-4">
        {activities.map((activity) => (
          <div key={activity.id} className="flex items-start gap-3">
            <Avatar className="h-8 w-8 border border-slate-700">
              <AvatarImage src={activity.user.avatar} />
              <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {getInitials(activity.user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {getActivityIcon(activity)}
                <p className="text-sm">
                  <span className="font-medium text-white">{activity.user.name}</span>{' '}
                  <span className="text-slate-400">
                    {formatActivityMessage(activity)}
                  </span>
                </p>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
