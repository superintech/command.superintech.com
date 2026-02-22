'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Clock, Square } from 'lucide-react';

interface ActiveTimer {
  id: string;
  taskId: string;
  startTime: string;
  description?: string;
  task?: {
    id: string;
    title: string;
    projectId: string;
  };
}

const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function TimerIndicator() {
  const { accessToken } = useAuthStore();
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState('00:00:00');
  const lastReminderRef = useRef<number>(0);

  const { data: timerData } = useQuery({
    queryKey: ['activeTimer'],
    queryFn: () => api.get<{ success: boolean; data: ActiveTimer | null }>('/api/tasks/timer/active', accessToken!),
    enabled: !!accessToken,
    refetchInterval: 30000,
  });

  const stopMutation = useMutation({
    mutationFn: () => {
      const timer = timerData?.data;
      if (!timer) throw new Error('No active timer');
      return api.post(`/api/tasks/${timer.taskId}/timer/${timer.id}/stop`, {}, accessToken!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activeTimer'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Timer stopped' });
    },
    onError: () => {
      toast({ title: 'Failed to stop timer', variant: 'destructive' });
    },
  });

  const activeTimer = timerData?.data;

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Show reminder function
  const showReminder = useCallback((hours: number, minutes: number, taskTitle: string) => {
    const message = `You've been working on "${taskTitle}" for ${hours}h ${minutes}m. Don't forget to stop the timer when done!`;

    toast({
      title: 'Timer Reminder',
      description: message,
      duration: 15000,
    });

    // Browser notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Timer Reminder', {
        body: message,
        icon: '/favicon.ico',
        tag: 'timer-reminder',
      });
    }

    // Play a subtle sound (optional)
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignore if audio play fails
    } catch {}
  }, []);

  useEffect(() => {
    if (!activeTimer) {
      setElapsed('00:00:00');
      lastReminderRef.current = 0;
      return;
    }

    const updateElapsed = () => {
      const start = new Date(activeTimer.startTime).getTime();
      const now = Date.now();
      const diff = Math.floor((now - start) / 1000);
      const elapsedMs = now - start;

      const hours = Math.floor(diff / 3600);
      const minutes = Math.floor((diff % 3600) / 60);
      const seconds = diff % 60;

      setElapsed(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );

      // Check for hourly reminder
      // Should remind when elapsed >= 1 hour AND we haven't reminded in the last hour
      if (elapsedMs >= REMINDER_INTERVAL_MS) {
        const hoursPassed = Math.floor(elapsedMs / REMINDER_INTERVAL_MS);
        const expectedReminders = hoursPassed;
        const lastReminderHour = Math.floor(lastReminderRef.current / REMINDER_INTERVAL_MS);

        if (lastReminderHour < expectedReminders) {
          showReminder(hours, minutes, activeTimer.task?.title || 'a task');
          lastReminderRef.current = elapsedMs;
        }
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [activeTimer, showReminder]);

  if (!activeTimer) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg bg-blue-500/20 px-3 py-1.5 border border-blue-500/30">
      <Clock className="h-4 w-4 text-blue-400 animate-pulse" />
      <div className="text-sm">
        <span className="font-mono font-medium text-blue-400">{elapsed}</span>
        <span className="ml-2 text-[hsl(var(--text-secondary))] hidden sm:inline truncate max-w-[150px]">
          {activeTimer.task?.title || 'Task'}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 hover:bg-red-500/20"
        onClick={() => stopMutation.mutate()}
        disabled={stopMutation.isPending}
      >
        <Square className="h-3 w-3 text-red-400" />
      </Button>
    </div>
  );
}
