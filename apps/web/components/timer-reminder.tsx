'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { formatDuration } from '@/lib/utils';
import { Clock, Bell } from 'lucide-react';

interface ActiveTimer {
  id: string;
  taskId: string;
  startTime: string;
  description?: string;
  task?: {
    id: string;
    title: string;
  };
}

export function TimerReminder() {
  const { accessToken } = useAuthStore();
  const [lastReminderTime, setLastReminderTime] = useState<number>(0);
  const REMINDER_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

  const { data: activeTimerData } = useQuery({
    queryKey: ['activeTimer'],
    queryFn: () => api.get<{ success: boolean; data: ActiveTimer | null }>('/api/tasks/timer/active', accessToken!),
    enabled: !!accessToken,
    refetchInterval: 60000, // Refetch every minute
  });

  const activeTimer = activeTimerData?.data;

  const checkTimerDuration = useCallback(() => {
    if (!activeTimer) return;

    const startTime = new Date(activeTimer.startTime).getTime();
    const now = Date.now();
    const elapsed = now - startTime;

    // Check if timer has been running for at least 1 hour
    // and we haven't reminded in the last hour
    if (elapsed >= REMINDER_INTERVAL && now - lastReminderTime >= REMINDER_INTERVAL) {
      const hours = Math.floor(elapsed / (60 * 60 * 1000));
      const minutes = Math.floor((elapsed % (60 * 60 * 1000)) / 60000);

      toast({
        title: 'Timer Running',
        description: `You've been working on "${activeTimer.task?.title || 'a task'}" for ${hours}h ${minutes}m. Don't forget to stop the timer when you're done!`,
        duration: 10000,
      });

      setLastReminderTime(now);

      // Also try to show a browser notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Timer Reminder', {
          body: `You've been working for ${hours}h ${minutes}m`,
          icon: '/icon.png',
        });
      }
    }
  }, [activeTimer, lastReminderTime, REMINDER_INTERVAL]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check timer duration every minute
  useEffect(() => {
    if (!activeTimer) return;

    // Check immediately
    checkTimerDuration();

    // Then check every minute
    const interval = setInterval(checkTimerDuration, 60000);

    return () => clearInterval(interval);
  }, [activeTimer, checkTimerDuration]);

  // Don't render anything visible - this is a background component
  return null;
}

// Separate component for showing active timer in header
export function ActiveTimerBadge() {
  const { accessToken } = useAuthStore();
  const [elapsed, setElapsed] = useState<number>(0);

  const { data: activeTimerData } = useQuery({
    queryKey: ['activeTimer'],
    queryFn: () => api.get<{ success: boolean; data: ActiveTimer | null }>('/api/tasks/timer/active', accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30000,
  });

  const activeTimer = activeTimerData?.data;

  // Update elapsed time every second
  useEffect(() => {
    if (!activeTimer) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      const start = new Date(activeTimer.startTime).getTime();
      setElapsed(Math.floor((Date.now() - start) / 60000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!activeTimer) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm animate-pulse">
      <Clock className="h-4 w-4" />
      <span className="font-medium">{formatDuration(elapsed)}</span>
      <span className="hidden sm:inline text-green-600 truncate max-w-[150px]">
        {activeTimer.task?.title || 'Timer running'}
      </span>
    </div>
  );
}
