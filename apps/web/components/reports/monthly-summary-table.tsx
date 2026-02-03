'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Download,
  RefreshCcw,
  Calculator,
  Lock,
  Loader2,
  Trophy,
  Medal,
  Award,
  Star,
  Minus,
} from 'lucide-react';
import { EditableTable, ColumnDef } from '@/components/ui/editable-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth-store';
import { eodrV2Api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface MonthlySummary {
  id: string;
  userId: string;
  month: number;
  year: number;
  totalWorkingDays: number;
  taskTarget: number;
  tasksCompleted: number;
  totalHoursLogged: number;
  completionPercent: number;
  taskEquivalent: number;
  commissionTier: string;
  commissionPercent: number;
  isFinalized: boolean;
  finalizedById: string | null;
  finalizedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    department: { id: string; name: string } | null;
  };
  finalizedBy: { id: string; name: string } | null;
}

interface MonthlySummaryTableProps {
  year: number;
  month?: number;
  userId?: string;
  userRole: string;
  isManager?: boolean;
}

const TIER_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  PLATINUM: {
    icon: Trophy,
    color: 'text-purple-600',
    bg: 'bg-gradient-to-r from-purple-500 to-pink-500',
  },
  GOLD: {
    icon: Medal,
    color: 'text-yellow-600',
    bg: 'bg-gradient-to-r from-yellow-400 to-orange-500',
  },
  SILVER: {
    icon: Award,
    color: 'text-gray-500',
    bg: 'bg-gradient-to-r from-gray-300 to-gray-400',
  },
  BRONZE: {
    icon: Star,
    color: 'text-orange-700',
    bg: 'bg-gradient-to-r from-orange-600 to-orange-800',
  },
  NONE: {
    icon: Minus,
    color: 'text-gray-400',
    bg: 'bg-gray-200',
  },
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function MonthlySummaryTable({
  year,
  month,
  userId,
  userRole,
  isManager = false,
}: MonthlySummaryTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { accessToken } = useAuthStore();
  const [selectedEntry, setSelectedEntry] = React.useState<MonthlySummary | null>(
    null
  );
  const [isCalculating, setIsCalculating] = React.useState(false);

  // Fetch monthly summary data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['eodr-v2-monthly', year, month, userId],
    queryFn: () => eodrV2Api.getMonthlyTableData(year, month, userId, accessToken!),
    enabled: !!accessToken,
  });

  // Calculate monthly summary mutation
  const calculateMutation = useMutation({
    mutationFn: ({
      userId,
      month,
      year,
    }: {
      userId: string;
      month: number;
      year: number;
    }) => eodrV2Api.calculateMonthlySummary(userId, month, year, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eodr-v2-monthly'] });
      toast({
        title: 'Calculated',
        description: 'Monthly summary calculated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to calculate monthly summary',
        variant: 'destructive',
      });
    },
  });

  // Bulk calculate mutation
  const bulkCalculateMutation = useMutation({
    mutationFn: ({ month, year }: { month: number; year: number }) =>
      eodrV2Api.bulkCalculateMonthlySummary(month, year, accessToken!),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['eodr-v2-monthly'] });
      toast({
        title: 'Calculated',
        description: `Calculated for ${data.data?.calculated || 0} employees`,
      });
      setIsCalculating(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to bulk calculate',
        variant: 'destructive',
      });
      setIsCalculating(false);
    },
  });

  // Finalize mutation
  const finalizeMutation = useMutation({
    mutationFn: ({
      userId,
      month,
      year,
    }: {
      userId: string;
      month: number;
      year: number;
    }) => eodrV2Api.finalizeMonthly(userId, month, year, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eodr-v2-monthly'] });
      setSelectedEntry(null);
      toast({
        title: 'Finalized',
        description: 'Monthly summary has been finalized',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to finalize monthly summary',
        variant: 'destructive',
      });
    },
  });

  // Define columns
  const columns: ColumnDef<MonthlySummary>[] = [
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
          <div>
            <span className="truncate text-sm block">{row.user.name}</span>
            {row.user.department && (
              <span className="text-xs text-muted-foreground">
                {row.user.department.name}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'month',
      header: 'Month',
      width: '100px',
      editable: false,
      render: (value) => MONTHS[(value as number) - 1]?.substring(0, 3) || '-',
    },
    {
      key: 'totalWorkingDays',
      header: 'Work Days',
      width: '90px',
      align: 'center',
      editable: false,
    },
    {
      key: 'taskTarget',
      header: 'Target',
      width: '80px',
      align: 'center',
      editable: false,
      render: (value) => (value as number).toFixed(0),
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
      key: 'totalHoursLogged',
      header: 'Hours',
      width: '80px',
      align: 'center',
      editable: false,
      render: (value) => (value as number).toFixed(1),
    },
    {
      key: 'completionPercent',
      header: 'Completion',
      width: '130px',
      editable: false,
      render: (value, row) => {
        const percent = value as number;
        return (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span
                className={cn(
                  percent >= 100 && 'text-green-600',
                  percent >= 80 && percent < 100 && 'text-yellow-600',
                  percent < 80 && 'text-red-600'
                )}
              >
                {percent.toFixed(1)}%
              </span>
            </div>
            <Progress
              value={Math.min(percent, 150)}
              max={150}
              className={cn(
                'h-2',
                percent >= 150 && 'bg-purple-500',
                percent >= 120 && percent < 150 && 'bg-yellow-500',
                percent >= 110 && percent < 120 && 'bg-gray-400',
                percent >= 100 && percent < 110 && 'bg-orange-600',
                percent < 100 && 'bg-gray-300'
              )}
            />
          </div>
        );
      },
    },
    {
      key: 'commissionTier',
      header: 'Tier',
      width: '120px',
      align: 'center',
      editable: false,
      render: (value, row) => {
        const tier = value as string;
        const config = TIER_CONFIG[tier] || TIER_CONFIG.NONE;
        const Icon = config.icon;

        return (
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center',
                config.bg
              )}
            >
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <span className={cn('text-xs font-medium', config.color)}>
                {tier}
              </span>
              <span className="text-xs text-muted-foreground block">
                {(row.commissionPercent * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'isFinalized',
      header: 'Status',
      width: '100px',
      align: 'center',
      editable: false,
      render: (value, row) => (
        <div>
          {value ? (
            <Badge variant="default" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Locked
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Draft
            </Badge>
          )}
        </div>
      ),
    },
  ];

  // Add actions column for managers
  if (isManager) {
    columns.push({
      key: 'actions',
      header: '',
      width: '80px',
      align: 'center',
      editable: false,
      render: (_, row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEntry(row);
          }}
          disabled={row.isFinalized}
        >
          {row.isFinalized ? 'View' : 'Finalize'}
        </Button>
      ),
    });
  }

  // Export to JSON
  const handleExport = async () => {
    try {
      const exportData = await eodrV2Api.exportData('monthly', year, month, userId, accessToken!);
      const blob = new Blob([JSON.stringify(exportData.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monthly-commission-${year}${month ? `-${month}` : ''}.json`;
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

  // Handle bulk calculate
  const handleBulkCalculate = () => {
    if (!month) {
      toast({
        title: 'Error',
        description: 'Please select a month to calculate',
        variant: 'destructive',
      });
      return;
    }
    setIsCalculating(true);
    bulkCalculateMutation.mutate({ month, year });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summaries = data?.data?.summaries || [];
  const tierStats = data?.data?.tierStats || {};

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Monthly Commission Summary</h3>
          <p className="text-sm text-muted-foreground">
            {year} {month ? `- ${MONTHS[month - 1]}` : '(All Months)'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isManager && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkCalculate}
              disabled={isCalculating || !month}
            >
              {isCalculating ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 mr-1" />
              )}
              Calculate All
            </Button>
          )}
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

      {/* Tier Stats */}
      {isManager && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {Object.entries(TIER_CONFIG).map(([tier, config]) => {
            const Icon = config.icon;
            const count = tierStats[tier] || 0;
            return (
              <div
                key={tier}
                className={cn(
                  'p-4 border rounded-lg',
                  count > 0 && 'border-l-4',
                  count > 0 && tier === 'PLATINUM' && 'border-l-purple-500',
                  count > 0 && tier === 'GOLD' && 'border-l-yellow-500',
                  count > 0 && tier === 'SILVER' && 'border-l-gray-400',
                  count > 0 && tier === 'BRONZE' && 'border-l-orange-600',
                  count > 0 && tier === 'NONE' && 'border-l-gray-300'
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center',
                      config.bg
                    )}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold">{count}</div>
                    <div className={cn('text-xs', config.color)}>{tier}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Commission Tier Legend */}
      <div className="p-4 bg-muted/30 rounded-lg">
        <h4 className="text-sm font-medium mb-2">Commission Tiers</h4>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-purple-600 font-medium">PLATINUM</span>
            <span className="text-muted-foreground ml-1">≥150% = 15%</span>
          </div>
          <div>
            <span className="text-yellow-600 font-medium">GOLD</span>
            <span className="text-muted-foreground ml-1">≥120% = 10%</span>
          </div>
          <div>
            <span className="text-gray-500 font-medium">SILVER</span>
            <span className="text-muted-foreground ml-1">≥110% = 5%</span>
          </div>
          <div>
            <span className="text-orange-700 font-medium">BRONZE</span>
            <span className="text-muted-foreground ml-1">≥100% = 2%</span>
          </div>
          <div>
            <span className="text-gray-400 font-medium">NONE</span>
            <span className="text-muted-foreground ml-1">&lt;100% = 0%</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <EditableTable
        data={summaries}
        columns={columns}
        rowKey="id"
        userRole={userRole}
        readOnly={true}
        stickyHeader
        maxHeight="400px"
        emptyMessage="No monthly summaries found. Calculate summaries to see data."
      />

      {/* Finalize Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedEntry?.isFinalized ? 'Commission Details' : 'Finalize Commission'}
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedEntry.user.avatar || undefined} />
                  <AvatarFallback>
                    {selectedEntry.user.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium">{selectedEntry.user.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {MONTHS[selectedEntry.month - 1]} {selectedEntry.year}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Task Target</div>
                  <div className="text-lg font-semibold">
                    {selectedEntry.taskTarget.toFixed(0)}
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Completed</div>
                  <div className="text-lg font-semibold">
                    {selectedEntry.tasksCompleted.toFixed(1)}
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Completion</div>
                  <div className="text-lg font-semibold">
                    {selectedEntry.completionPercent.toFixed(1)}%
                  </div>
                </div>
                <div className="p-3 border rounded-lg">
                  <div className="text-xs text-muted-foreground">Commission</div>
                  <div
                    className={cn(
                      'text-lg font-semibold',
                      TIER_CONFIG[selectedEntry.commissionTier]?.color
                    )}
                  >
                    {selectedEntry.commissionTier} (
                    {(selectedEntry.commissionPercent * 100).toFixed(0)}%)
                  </div>
                </div>
              </div>

              {!selectedEntry.isFinalized && (
                <p className="text-sm text-muted-foreground">
                  Finalizing will lock this record and prevent further changes.
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedEntry(null)}>
              Cancel
            </Button>
            {selectedEntry && !selectedEntry.isFinalized && (
              <Button
                onClick={() =>
                  finalizeMutation.mutate({
                    userId: selectedEntry.userId,
                    month: selectedEntry.month,
                    year: selectedEntry.year,
                  })
                }
                disabled={finalizeMutation.isPending}
              >
                {finalizeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4 mr-1" />
                )}
                Finalize
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default MonthlySummaryTable;
