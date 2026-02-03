'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Bell,
  CheckCheck,
  MessageSquare,
  UserPlus,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'TASK_ASSIGNED':
      return <UserPlus className="h-4 w-4 text-blue-400" />;
    case 'TASK_COMPLETED':
      return <CheckCircle className="h-4 w-4 text-emerald-400" />;
    case 'COMMENT_ADDED':
      return <MessageSquare className="h-4 w-4 text-purple-400" />;
    case 'TASK_OVERDUE':
      return <AlertCircle className="h-4 w-4 text-red-400" />;
    case 'TASK_DUE_SOON':
      return <Clock className="h-4 w-4 text-amber-400" />;
    default:
      return <Bell className="h-4 w-4 text-slate-400" />;
  }
}

function formatTimeAgo(date: string) {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return then.toLocaleDateString();
}

export function NotificationsDropdown() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Get navigation URL based on notification type and data
  const getNotificationUrl = (notification: Notification): string | null => {
    const data = notification.data || {};

    switch (notification.type) {
      case 'TASK_ASSIGNED':
      case 'TASK_COMPLETED':
      case 'TASK_OVERDUE':
      case 'TASK_DUE_SOON':
      case 'COMMENT_ADDED':
        // Navigate to task page if taskId exists
        if (data.taskId) {
          return `/dashboard/tasks?taskId=${data.taskId}`;
        }
        // If projectId exists, navigate to project
        if (data.projectId) {
          return `/dashboard/projects/${data.projectId}`;
        }
        return '/dashboard/tasks';

      case 'NEW_MESSAGE':
      case 'CHAT_MESSAGE':
        // Navigate to chat with room selected
        if (data.roomId) {
          return `/dashboard/chat?room=${data.roomId}`;
        }
        return '/dashboard/chat';

      case 'PROJECT_ADDED':
      case 'PROJECT_UPDATED':
        if (data.projectId) {
          return `/dashboard/projects/${data.projectId}`;
        }
        return '/dashboard/projects';

      default:
        return null;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }

    // Navigate to appropriate location
    const url = getNotificationUrl(notification);
    if (url) {
      setOpen(false); // Close the dropdown
      router.push(url);
    }
  };

  const { data: notificationsData } = useQuery({
    queryKey: ['notifications'],
    queryFn: () =>
      api.get<{ success: boolean; data: Notification[] }>('/api/notifications', accessToken!),
    enabled: !!accessToken,
    refetchInterval: 60000, // Refresh every minute
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) =>
      api.patch(`/api/notifications/${notificationId}/read`, {}, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.post('/api/notifications/mark-all-read', {}, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = notificationsData?.data || [];
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-400 hover:text-white hover:bg-slate-800">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-[#131d2e] border-slate-700" align="end">
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h3 className="font-semibold text-white">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-10 w-10 text-slate-600 mb-2" />
              <p className="text-sm text-slate-400">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'flex gap-3 p-4 hover:bg-slate-800 cursor-pointer transition-colors',
                    !notification.isRead && 'bg-blue-500/10'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm text-slate-300',
                      !notification.isRead && 'font-medium text-white'
                    )}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {formatTimeAgo(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.isRead && (
                    <div className="shrink-0">
                      <div className="h-2 w-2 rounded-full bg-blue-500" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
