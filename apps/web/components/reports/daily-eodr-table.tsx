'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Download, RefreshCcw, Check, X, Loader2, Eye } from 'lucide-react';
import { EditableTable, ColumnDef } from '@/components/ui/editable-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth-store';
import { eodrV2Api } from '@/lib/api';

interface DailyEODREntry {
  id: string;
  userId: string;
  date: string;
  tasksAssigned: number;
  tasksCompleted: number;
  taskDetails: { taskName: string; timeSpent: number; status: string }[];
  secondaryTasks: unknown[] | null;
  finalCount: number;
  totalHoursLogged: number;
  adjustedHours: number | null;
  taskEquivalent: number;
  employeeComments: string | null;
  managerRemarks: string | null;
  isHalfDay: boolean;
  isHoliday: boolean;
  status: string;
  verifiedById: string | null;
  verifiedAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    department: { id: string; name: string } | null;
  };
  verifiedBy: { id: true; name: string; avatar: string | null } | null;
}

interface DailyEODRTableProps {
  month: number;
  year: number;
  userId?: string;
  userRole: string;
  isManager?: boolean;
}

export function DailyEODRTable({
  month,
  year,
  userId,
  userRole,
  isManager = false,
}: DailyEODRTableProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { accessToken } = useAuthStore();
  const [selectedEntry, setSelectedEntry] = React.useState<DailyEODREntry | null>(null);

  // Fetch daily EODR data
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['eodr-v2-daily', month, year, userId],
    queryFn: () => eodrV2Api.getDailyTableData(month, year, userId, accessToken!),
    enabled: !!accessToken,
  });

  // Manager edit mutation
  const editMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<DailyEODREntry>;
    }) => eodrV2Api.managerEditDaily(id, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eodr-v2-daily'] });
      toast({
        title: 'Updated',
        description: 'Entry updated successfully',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update entry',
        variant: 'destructive',
      });
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: (updates: { id: string; [key: string]: unknown }[]) =>
      eodrV2Api.bulkUpdateDaily(updates, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eodr-v2-daily'] });
      toast({
        title: 'Updated',
        description: 'Entries updated successfully',
      });
    },
  });

  // Handle cell change
  const handleCellChange = (
    rowId: string,
    columnKey: string,
    value: unknown,
    row: DailyEODREntry
  ) => {
    editMutation.mutate({
      id: rowId,
      data: { [columnKey]: value },
    });
  };

  // Define columns
  const columns: ColumnDef<DailyEODREntry>[] = [
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
      key: 'date',
      header: 'Date',
      width: '100px',
      editable: false,
      render: (value) => format(new Date(value as string), 'MMM d'),
    },
    {
      key: 'tasksAssigned',
      header: 'Assigned',
      width: '80px',
      align: 'center',
      type: 'number',
      editable: (_, role) => ['ADMIN', 'MANAGER'].includes(role),
    },
    {
      key: 'tasksCompleted',
      header: 'Completed',
      width: '90px',
      align: 'center',
      type: 'number',
      editable: (_, role) => ['ADMIN', 'MANAGER'].includes(role),
    },
    {
      key: 'taskDetails',
      header: 'Tasks',
      width: '120px',
      editable: false,
      render: (value, row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedEntry(row);
          }}
        >
          <Eye className="h-3 w-3 mr-1" />
          {Array.isArray(value) ? value.length : 0} tasks
        </Button>
      ),
    },
    {
      key: 'totalHoursLogged',
      header: 'Hours',
      width: '70px',
      align: 'center',
      editable: false,
      render: (value) =>
        typeof value === 'number' ? value.toFixed(1) : '-',
    },
    {
      key: 'adjustedHours',
      header: 'Adj. Hours',
      width: '90px',
      align: 'center',
      type: 'number',
      editable: (_, role) => ['ADMIN', 'MANAGER'].includes(role),
      render: (value) =>
        value !== null ? (value as number).toFixed(1) : '-',
    },
    {
      key: 'taskEquivalent',
      header: 'Task Eq.',
      width: '80px',
      align: 'center',
      editable: false,
      render: (value) =>
        typeof value === 'number' ? value.toFixed(2) : '-',
    },
    {
      key: 'employeeComments',
      header: 'Comments',
      width: '150px',
      type: 'textarea',
      editable: false,
      render: (value) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[140px]">
          {(value as string) || '-'}
        </span>
      ),
    },
    {
      key: 'managerRemarks',
      header: 'Remarks',
      width: '150px',
      type: 'textarea',
      editable: (_, role) => ['ADMIN', 'MANAGER'].includes(role),
      render: (value) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[140px]">
          {(value as string) || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      align: 'center',
      type: 'select',
      options: [
        { value: 'PENDING', label: 'Pending' },
        { value: 'VERIFIED', label: 'Verified' },
        { value: 'REJECTED', label: 'Rejected' },
      ],
      editable: (_, role) => ['ADMIN', 'MANAGER'].includes(role),
      render: (value) => {
        const status = value as string;
        return (
          <Badge
            variant={
              status === 'VERIFIED'
                ? 'default'
                : status === 'REJECTED'
                ? 'destructive'
                : 'secondary'
            }
            className="text-xs"
          >
            {status === 'VERIFIED' && <Check className="h-3 w-3 mr-1" />}
            {status === 'REJECTED' && <X className="h-3 w-3 mr-1" />}
            {status}
          </Badge>
        );
      },
    },
  ];

  // Export to JSON (can be converted to Excel by user)
  const handleExport = async () => {
    try {
      const exportData = await eodrV2Api.exportData('daily', year, month, userId, accessToken!);
      const blob = new Blob([JSON.stringify(exportData.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-eodr-${year}-${month}.json`;
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

  const entries = data?.data?.entries || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Daily EODR Entries</h3>
          <p className="text-sm text-muted-foreground">
            {data?.data?.workingDays || 0} working days, {entries.length} entries
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

      {/* Table */}
      <EditableTable
        data={entries}
        columns={columns}
        rowKey="id"
        userRole={userRole}
        readOnly={!isManager}
        onCellChange={handleCellChange}
        stickyHeader
        maxHeight="500px"
        emptyMessage="No EODR entries found for this period"
      />

      {/* Task Details Dialog */}
      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Task Details - {selectedEntry?.user.name}
              {selectedEntry?.date && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({format(new Date(selectedEntry.date), 'MMM d, yyyy')})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-auto">
            {selectedEntry?.taskDetails?.length ? (
              selectedEntry.taskDetails.map((task, index) => (
                <div
                  key={index}
                  className="p-3 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{task.taskName}</span>
                    <Badge
                      variant={
                        task.status === 'COMPLETED' ? 'default' : 'secondary'
                      }
                      className="text-xs"
                    >
                      {task.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Time: {task.timeSpent.toFixed(1)} hours
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center py-4">
                No tasks recorded
              </p>
            )}
            {selectedEntry?.secondaryTasks &&
              Array.isArray(selectedEntry.secondaryTasks) &&
              selectedEntry.secondaryTasks.length > 0 && (
                <>
                  <h4 className="font-medium text-sm mt-4">Secondary Tasks</h4>
                  {selectedEntry.secondaryTasks.map((task: unknown, index) => (
                    <div
                      key={index}
                      className="p-3 border rounded-lg bg-muted/30"
                    >
                      <span className="text-sm">
                        {typeof task === 'object' && task !== null
                          ? JSON.stringify(task)
                          : String(task)}
                      </span>
                    </div>
                  ))}
                </>
              )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DailyEODRTable;
