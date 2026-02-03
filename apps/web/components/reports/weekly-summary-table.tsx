'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, RefreshCcw, Calculator, Loader2 } from 'lucide-react';
import { EditableTable, ColumnDef } from '@/components/ui/editable-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth-store';
import { eodrV2Api } from '@/lib/api';

interface WeeklySummary {
  id: string;
  userId: string;
  weekNumber: number;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  tasksAssigned: number;
  tasksCompleted: number;
  weeklyTarget: number;
  adjustedTarget: number | null;
  completionRate: number;
  comments: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    department: { id: string; name: string } | null;
  };
}

interface WeeklySummaryTableProps {
  month: number;
  year: number;
  userId?: string;
  userRole: string;
  isManager?: boolean;
}

export function WeeklySummaryTable({
  month,
  year,
  userId,
  userRole,
  isManager = false,
}: WeeklySummaryTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { accessToken } = useAuthStore();

  // Fetch weekly summary data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['eodr-v2-weekly', month, year, userId],
    queryFn: () => eodrV2Api.getWeeklyTableData(month, year, userId, accessToken!),
    enabled: !!accessToken,
  });

  // Calculate weekly summary mutation
  const calculateMutation = useMutation({
    mutationFn: ({
      userId,
      weekNumber,
      month,
      year,
    }: {
      userId: string;
      weekNumber: number;
      month: number;
      year: number;
    }) => eodrV2Api.calculateWeeklySummary(userId, weekNumber, month, year, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eodr-v2-weekly'] });
      toast({
        title: 'Calculated',
        description: 'Weekly summary calculated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to calculate weekly summary',
        variant: 'destructive',
      });
    },
  });

  // Get completion rate color
  const getCompletionColor = (rate: number): string => {
    if (rate >= 100) return 'text-green-600';
    if (rate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Get progress color
  const getProgressColor = (rate: number): string => {
    if (rate >= 100) return 'bg-green-500';
    if (rate >= 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Define columns
  const columns: ColumnDef<WeeklySummary>[] = [
    {
      key: 'user',
      header: 'Employee',
      width: '180px',
      editable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6">
            <AvatarImage src={row.user.avatar || undefined} />
            <AvatarFallback>{row.user.name[0]}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm">{row.user.name}</span>
        </div>
      ),
    },
    {
      key: 'weekNumber',
      header: 'Week',
      width: '70px',
      align: 'center',
      editable: false,
      render: (value) => (
        <Badge variant="outline" className="text-xs">
          W{value as number}
        </Badge>
      ),
    },
    {
      key: 'startDate',
      header: 'Period',
      width: '150px',
      editable: false,
      render: (_, row) =>
        `${format(new Date(row.startDate), 'MMM d')} - ${format(
          new Date(row.endDate),
          'MMM d'
        )}`,
    },
    {
      key: 'tasksAssigned',
      header: 'Assigned',
      width: '80px',
      align: 'center',
      editable: false,
      render: (value) => (value as number).toFixed(1),
    },
    {
      key: 'tasksCompleted',
      header: 'Completed',
      width: '90px',
      align: 'center',
      editable: false,
      render: (value) => (value as number).toFixed(1),
    },
    {
      key: 'adjustedTarget',
      header: 'Target',
      width: '70px',
      align: 'center',
      editable: false,
      render: (value, row) => ((value as number) ?? row.weeklyTarget).toFixed(1),
    },
    {
      key: 'completionRate',
      header: 'Progress',
      width: '150px',
      editable: false,
      render: (value, row) => {
        const rate = value as number;
        const target = row.adjustedTarget ?? row.weeklyTarget;
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={getCompletionColor(rate)}>{rate.toFixed(1)}%</span>
              <span className="text-muted-foreground">
                {row.tasksCompleted.toFixed(1)}/{target.toFixed(1)}
              </span>
            </div>
            <Progress
              value={Math.min(rate, 150)}
              max={150}
              className={`h-2 ${getProgressColor(rate)}`}
            />
          </div>
        );
      },
    },
    {
      key: 'comments',
      header: 'Comments',
      width: '200px',
      type: 'textarea',
      editable: false,
      render: (value) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[190px]">
          {(value as string) || '-'}
        </span>
      ),
    },
  ];

  const summaries = data?.data?.summaries || [];
  const weeklyTarget = data?.data?.weeklyTarget || 15;

  // Group by user for summary stats - must be before any early returns
  const userStats = React.useMemo(() => {
    const stats = new Map<
      string,
      { name: string; totalCompleted: number; weeks: number; avgRate: number }
    >();

    summaries.forEach((s) => {
      const existing = stats.get(s.userId);
      if (existing) {
        existing.totalCompleted += s.tasksCompleted;
        existing.weeks += 1;
        existing.avgRate =
          (existing.avgRate * (existing.weeks - 1) + s.completionRate) /
          existing.weeks;
      } else {
        stats.set(s.userId, {
          name: s.user.name,
          totalCompleted: s.tasksCompleted,
          weeks: 1,
          avgRate: s.completionRate,
        });
      }
    });

    return Array.from(stats.values()).sort((a, b) => b.avgRate - a.avgRate);
  }, [summaries]);

  // Export to JSON
  const handleExport = async () => {
    try {
      const exportData = await eodrV2Api.exportData('weekly', year, month, userId, accessToken!);
      const blob = new Blob([JSON.stringify(exportData.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weekly-summary-${year}-${month}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to export data',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Weekly Summary</h3>
          <p className="text-sm text-muted-foreground">
            Weekly target: {weeklyTarget} tasks (5 working days × 3 tasks)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {isManager && userStats.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
            <div className="text-sm text-muted-foreground">Top Performers</div>
            <div className="text-lg font-semibold text-green-600">
              {userStats.filter((u) => u.avgRate >= 100).length}
            </div>
            <div className="text-xs text-muted-foreground">100%+ completion</div>
          </div>
          <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <div className="text-sm text-muted-foreground">On Track</div>
            <div className="text-lg font-semibold text-yellow-600">
              {userStats.filter((u) => u.avgRate >= 80 && u.avgRate < 100).length}
            </div>
            <div className="text-xs text-muted-foreground">80-99% completion</div>
          </div>
          <div className="p-4 border rounded-lg bg-red-50 dark:bg-red-900/20">
            <div className="text-sm text-muted-foreground">Needs Attention</div>
            <div className="text-lg font-semibold text-red-600">
              {userStats.filter((u) => u.avgRate < 80).length}
            </div>
            <div className="text-xs text-muted-foreground">&lt;80% completion</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-sm text-muted-foreground">Avg Completion</div>
            <div className="text-lg font-semibold">
              {userStats.length > 0
                ? (
                    userStats.reduce((sum, u) => sum + u.avgRate, 0) /
                    userStats.length
                  ).toFixed(1)
                : 0}
              %
            </div>
            <div className="text-xs text-muted-foreground">Team average</div>
          </div>
        </div>
      )}

      {/* Table */}
      <EditableTable
        data={summaries}
        columns={columns}
        rowKey="id"
        userRole={userRole}
        readOnly={true}
        stickyHeader
        maxHeight="400px"
        emptyMessage="No weekly summaries found. Calculate summaries to see data."
      />
    </div>
  );
}

export default WeeklySummaryTable;
