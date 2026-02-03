'use client';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isWeekend,
  addMonths,
  subMonths,
} from 'date-fns';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Loader2,
  Sun,
  SunMedium,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth-store';
import { holidayApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'FULL' | 'HALF';
  year: number;
  month: number;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
}

interface HolidayManagerProps {
  isAdmin?: boolean;
}

export function HolidayManager({ isAdmin = false }: HolidayManagerProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { accessToken } = useAuthStore();
  const [currentDate, setCurrentDate] = React.useState(new Date());
  const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [holidayName, setHolidayName] = React.useState('');
  const [holidayType, setHolidayType] = React.useState<'FULL' | 'HALF'>('FULL');
  const [holidayToDelete, setHolidayToDelete] = React.useState<Holiday | null>(
    null
  );

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Fetch holidays for current month
  const { data, isLoading } = useQuery({
    queryKey: ['holidays', currentYear, currentMonth],
    queryFn: () => holidayApi.getByMonth(currentYear, currentMonth, accessToken!),
    enabled: !!accessToken,
  });

  // Create holiday mutation
  const createMutation = useMutation({
    mutationFn: (data: { date: string; name: string; type: 'FULL' | 'HALF' }) =>
      holidayApi.create(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setIsAddDialogOpen(false);
      setSelectedDate(null);
      setHolidayName('');
      setHolidayType('FULL');
      toast({
        title: 'Holiday created',
        description: 'The holiday has been added successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create holiday',
        variant: 'destructive',
      });
    },
  });

  // Delete holiday mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => holidayApi.delete(id, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      setHolidayToDelete(null);
      toast({
        title: 'Holiday deleted',
        description: 'The holiday has been removed',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete holiday',
        variant: 'destructive',
      });
    },
  });

  // Calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get start padding for first week
  const startPadding = monthStart.getDay();
  const paddingDays = Array(startPadding).fill(null);

  // Find holiday for a date
  const getHolidayForDate = (date: Date): Holiday | undefined => {
    if (!data?.data) return undefined;
    return data.data.find((h: Holiday) =>
      isSameDay(new Date(h.date), date)
    );
  };

  // Handle day click
  const handleDayClick = (date: Date) => {
    if (!isAdmin) return;
    if (isWeekend(date)) return;

    const existingHoliday = getHolidayForDate(date);
    if (existingHoliday) {
      setHolidayToDelete(existingHoliday);
    } else {
      setSelectedDate(date);
      setIsAddDialogOpen(true);
    }
  };

  // Handle add holiday
  const handleAddHoliday = () => {
    if (!selectedDate || !holidayName.trim()) return;

    createMutation.mutate({
      date: format(selectedDate, 'yyyy-MM-dd'),
      name: holidayName.trim(),
      type: holidayType,
    });
  };

  // Navigate months
  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const holidays = (data?.data as Holiday[]) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Holiday Calendar</h3>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? 'Click on a date to add or remove holidays'
              : 'View configured holidays and half-days'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={goToToday}>
          Today
        </Button>
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={goToPreviousMonth}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h4 className="text-lg font-medium">
          {format(currentDate, 'MMMM yyyy')}
        </h4>
        <Button variant="ghost" size="sm" onClick={goToNextMonth}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-muted/50">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="p-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {/* Padding days */}
            {paddingDays.map((_, index) => (
              <div key={`pad-${index}`} className="p-2 h-20 bg-muted/20" />
            ))}

            {/* Actual days */}
            {days.map((day) => {
              const holiday = getHolidayForDate(day);
              const weekend = isWeekend(day);
              const isToday = isSameDay(day, new Date());

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    'p-2 h-20 border-t border-l transition-colors',
                    weekend && 'bg-muted/30',
                    holiday?.type === 'FULL' && 'bg-red-50 dark:bg-red-900/20',
                    holiday?.type === 'HALF' &&
                      'bg-orange-50 dark:bg-orange-900/20',
                    !weekend && isAdmin && 'cursor-pointer hover:bg-muted/50',
                    isToday && 'ring-2 ring-primary ring-inset'
                  )}
                >
                  <div className="flex flex-col h-full">
                    <div
                      className={cn(
                        'text-sm font-medium',
                        weekend && 'text-muted-foreground',
                        isToday && 'text-primary'
                      )}
                    >
                      {format(day, 'd')}
                    </div>
                    {holiday && (
                      <div className="mt-1 flex-1">
                        <div
                          className={cn(
                            'text-xs rounded px-1 py-0.5 truncate',
                            holiday.type === 'FULL' &&
                              'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
                            holiday.type === 'HALF' &&
                              'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300'
                          )}
                        >
                          {holiday.type === 'HALF' && (
                            <SunMedium className="h-3 w-3 inline mr-0.5" />
                          )}
                          {holiday.type === 'FULL' && (
                            <Sun className="h-3 w-3 inline mr-0.5" />
                          )}
                          {holiday.name}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-100 border border-red-200" />
          <span>Full Day Holiday</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-orange-100 border border-orange-200" />
          <span>Half Day</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-muted/30 border" />
          <span>Weekend</span>
        </div>
      </div>

      {/* Holiday List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">
          Holidays this month ({holidays.length})
        </h4>
        {holidays.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No holidays configured for this month
          </p>
        ) : (
          <div className="space-y-2">
            {holidays.map((holiday) => (
              <div
                key={holiday.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      holiday.type === 'FULL' && 'bg-red-100 text-red-600',
                      holiday.type === 'HALF' && 'bg-orange-100 text-orange-600'
                    )}
                  >
                    {holiday.type === 'FULL' ? (
                      <Sun className="h-5 w-5" />
                    ) : (
                      <SunMedium className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{holiday.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(holiday.date), 'EEEE, MMMM d, yyyy')}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={holiday.type === 'FULL' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {holiday.type === 'FULL' ? 'Full Day' : 'Half Day'}
                  </Badge>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setHolidayToDelete(holiday)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Holiday Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Holiday</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <div className="text-sm text-muted-foreground mt-1">
                {selectedDate
                  ? format(selectedDate, 'EEEE, MMMM d, yyyy')
                  : '-'}
              </div>
            </div>
            <div>
              <Label htmlFor="holiday-name">Holiday Name</Label>
              <Input
                id="holiday-name"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="e.g., New Year's Day"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="holiday-type">Type</Label>
              <Select
                value={holidayType}
                onValueChange={(v) => setHolidayType(v as 'FULL' | 'HALF')}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL">
                    <div className="flex items-center gap-2">
                      <Sun className="h-4 w-4 text-red-500" />
                      Full Day Off
                    </div>
                  </SelectItem>
                  <SelectItem value="HALF">
                    <div className="flex items-center gap-2">
                      <SunMedium className="h-4 w-4 text-orange-500" />
                      Half Day
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddHoliday}
              disabled={!holidayName.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Add Holiday
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!holidayToDelete}
        onOpenChange={() => setHolidayToDelete(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Holiday</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">
              {holidayToDelete?.name}
            </span>
            ? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => holidayToDelete && deleteMutation.mutate(holidayToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default HolidayManager;
