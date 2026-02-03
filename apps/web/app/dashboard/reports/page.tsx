'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/lib/auth-store';
import { kpiApi, eodrApi, eodrV2Api, holidayApi, usersApi, projectsApi, tasksApi, EODREntry, TeamDailyScoringData, Task } from '@/lib/api';
import { DailyEODRTable, WeeklySummaryTable, MonthlySummaryTable, HolidayManager } from '@/components/reports';
import {
  BarChart3,
  Calendar,
  Clock,
  CheckCircle2,
  TrendingUp,
  Award,
  Users,
  ChevronLeft,
  ChevronRight,
  FileText,
  Star,
  Target,
  Heart,
  Brain,
  RefreshCw,
  Loader2,
  Trophy,
  Edit,
  Eye,
  Check,
  AlertTriangle,
  CalendarDays,
  ClipboardCheck,
  Plus,
  Trash2,
  Save,
  FileUp,
} from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const TIER_COLORS: Record<string, string> = {
  PLATINUM: 'bg-gradient-to-r from-purple-500 to-pink-500 text-white',
  GOLD: 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white',
  SILVER: 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-800',
  BRONZE: 'bg-gradient-to-r from-orange-600 to-orange-800 text-white',
  NONE: 'bg-gray-200 text-gray-600',
};

const TIER_ICONS: Record<string, React.ReactNode> = {
  PLATINUM: <Star className="h-4 w-4 fill-current" />,
  GOLD: <Award className="h-4 w-4 fill-current" />,
  SILVER: <Award className="h-4 w-4" />,
  BRONZE: <Award className="h-4 w-4" />,
  NONE: null,
};

function isManager(role: string): boolean {
  return ['ADMIN', 'CEO', 'CFO', 'COO', 'MANAGER', 'TEAM_LEAD'].includes(role);
}

function KPIScoreCard({ title, value, icon, description, color, max = 100 }: {
  title: string;
  value: number;
  icon: React.ReactNode;
  description?: string;
  color: string;
  max?: number;
}) {
  return (
    <Card className="!bg-[#131d2e] border-slate-700 hover:border-slate-600 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <div className="mt-2 flex items-baseline">
              <p className="text-3xl font-bold text-white">{value}</p>
              <p className="ml-1 text-sm text-slate-500">/{max}</p>
            </div>
            {description && (
              <p className="mt-1 text-xs text-slate-500">{description}</p>
            )}
          </div>
          <div className={`rounded-xl p-3 ${color}`}>
            {icon}
          </div>
        </div>
        <div className="mt-4 h-2 rounded-full bg-slate-700">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${color}`}
            style={{ width: `${(value / max) * 100}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function EODRCard({ entry, onReview }: { entry: EODREntry; onReview?: () => void }) {
  const date = new Date(entry.date);
  const dateStr = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const displayHours = entry.adjustedHours ?? entry.totalHours;

  return (
    <Card className="!bg-[#131d2e] border-slate-700 hover:border-slate-600 transition-all duration-200 hover:-translate-y-0.5">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="font-medium text-white">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2">
            {entry.isVerified ? (
              <Badge variant="default" className="bg-green-500/20 text-green-400 text-xs">
                <Check className="h-3 w-3 mr-1" />Verified
              </Badge>
            ) : (
              <Badge variant="outline" className="text-orange-400 border-orange-500/50 text-xs">
                Pending
              </Badge>
            )}
            {onReview && (
              <Button variant="ghost" size="sm" onClick={onReview} className="text-slate-400 hover:text-white hover:bg-slate-700/50">
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-slate-400">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            <span>{entry.tasksCompleted} tasks</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-blue-400" />
            <span>{displayHours.toFixed(1)} hours</span>
            {entry.adjustedHours !== undefined && entry.adjustedHours !== null && entry.adjustedHours !== entry.totalHours && (
              <span className="text-xs text-orange-400">(adj.)</span>
            )}
          </div>
        </div>

        {Array.isArray(entry.tasks) && entry.tasks.length > 0 && (
          <div className="mt-3 space-y-1">
            {entry.tasks.slice(0, 3).map((task, idx) => (
              <div key={idx} className="text-xs text-slate-300 truncate">
                <span className="font-medium">{task.title}</span>
                <span className="text-slate-500 ml-1">({task.hours.toFixed(1)}h)</span>
                {task.pendingItems && (
                  <span className="text-orange-400 ml-1">[Pending]</span>
                )}
              </div>
            ))}
            {entry.tasks.length > 3 && (
              <div className="text-xs text-slate-500">
                +{entry.tasks.length - 3} more tasks
              </div>
            )}
          </div>
        )}

        {entry.notes && (
          <p className="mt-2 text-xs text-slate-400 italic border-t border-slate-700 pt-2">
            {entry.notes}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TierBadge({ tier, bonus }: { tier: string; bonus?: number }) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${TIER_COLORS[tier] || TIER_COLORS.NONE}`}>
      {TIER_ICONS[tier]}
      <span className="font-semibold">{tier}</span>
      {bonus !== undefined && bonus > 0 && (
        <span className="text-sm opacity-90">+{(bonus * 100).toFixed(0)}%</span>
      )}
    </div>
  );
}

export default function ReportsPage() {
  const { accessToken, user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedDate, setSelectedDate] = useState(now.toISOString().split('T')[0]); // For daily scoring
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [reviewingEntry, setReviewingEntry] = useState<EODREntry | null>(null);
  const [adjustedHours, setAdjustedHours] = useState<string>('');
  const [managerNotes, setManagerNotes] = useState('');

  // Daily scoring state
  const [scoringMember, setScoringMember] = useState<TeamDailyScoringData['team'][0] | null>(null);
  const [dailyScoreValues, setDailyScoreValues] = useState({
    attendance: 1, // Default to Average/Normal
    quality: 1,
    behaviour: 1,
    eodrScore: 1,
    comments: '',
  });

  // Submit Report state
  const [submitDate, setSubmitDate] = useState(now.toISOString().split('T')[0]);
  const [submitNotes, setSubmitNotes] = useState('');
  const [submitTasks, setSubmitTasks] = useState<Array<{
    taskId: string;
    projectId: string;
    title: string;
    description: string;
    completedAt: string;
    filesLocation: string;
    pendingItems: string;
    projectName: string;
    hours: number;
    status: string;
  }>>([
    { taskId: '', projectId: '', title: '', description: '', completedAt: '', filesLocation: '', pendingItems: '', projectName: '', hours: 0, status: 'COMPLETED' }
  ]);

  // Scoring scale descriptions (0-2)
  const SCORE_DESCRIPTIONS = {
    attendance: {
      0: 'Late login/early logout - Not meeting expectations',
      1: 'On time login/logout (Normal)',
      2: 'Extra hours/early start - Going above & beyond (Appreciation)',
    },
    quality: {
      0: 'Regular rework required - Below expectations',
      1: 'Good quality work with minor corrections (Normal)',
      2: 'Exceptional quality - No rework needed (Appreciation)',
    },
    eodrScore: {
      0: 'Not filling daily - Regular reminders needed',
      1: 'Filling daily on time (Normal)',
      2: 'Exceptional detail & insights (Appreciation)',
    },
    behaviour: {
      0: 'Poor attitude towards work/teammates/managers',
      1: 'Professional attitude, following instructions (Normal)',
      2: 'Outstanding attitude, proactive ideas (Appreciation)',
    },
  };

  const userIsManager = user ? isManager(user.role) : false;

  // State for EODR employee selection (for managers/admins)
  const [selectedEodrEmployeeId, setSelectedEodrEmployeeId] = useState<string | null>(null);

  // Fetch data
  const { data: myKpiData, isLoading: loadingMyKpi } = useQuery({
    queryKey: ['my-kpi', selectedMonth, selectedYear],
    queryFn: () => kpiApi.getMyKPI(accessToken!, { month: selectedMonth, year: selectedYear }),
    enabled: !!accessToken,
  });

  const { data: dashboardData, isLoading: loadingDashboard } = useQuery({
    queryKey: ['kpi-dashboard', selectedMonth, selectedYear],
    queryFn: () => kpiApi.getDashboard(accessToken!, { month: selectedMonth, year: selectedYear }),
    enabled: !!accessToken && userIsManager,
  });

  // Employee of Month based on daily scores
  const { data: employeeOfMonthData, isLoading: loadingEOM } = useQuery({
    queryKey: ['employee-of-month-daily', selectedMonth, selectedYear],
    queryFn: () => kpiApi.getEmployeeOfMonthFromDaily(accessToken!, { month: selectedMonth, year: selectedYear }),
    enabled: !!accessToken,
  });

  // Team daily scoring (for selected date)
  const { data: teamDailyScoringData, isLoading: loadingTeamDaily } = useQuery({
    queryKey: ['team-daily-scoring', selectedDate],
    queryFn: () => kpiApi.getTeamDailyScoring(accessToken!, selectedDate),
    enabled: !!accessToken && userIsManager,
  });

  const { data: eodrEntries, isLoading: loadingEodr } = useQuery({
    queryKey: ['eodr-entries', selectedMonth, selectedYear, selectedUserId],
    queryFn: () => eodrApi.getEntries(accessToken!, {
      month: selectedMonth,
      year: selectedYear,
      userId: selectedUserId || undefined
    }),
    enabled: !!accessToken,
  });

  const { data: todayPreview, isLoading: loadingToday } = useQuery({
    queryKey: ['eodr-today'],
    queryFn: () => eodrApi.getTodayPreview(accessToken!),
    enabled: !!accessToken,
    refetchInterval: 60000,
  });

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(accessToken!),
    enabled: !!accessToken && userIsManager,
  });

  // Filter only employees (not ADMIN, MANAGER, etc.) for EODR selection
  const employeesList = useMemo(() => {
    if (!usersData?.data) return [];
    return usersData.data.filter((u: { role: string; isActive: boolean }) =>
      u.role === 'EMPLOYEE' && u.isActive
    );
  }, [usersData]);

  // For employees, always show their own data. For managers, show selected employee
  const eodrUserId = useMemo(() => {
    if (!userIsManager) {
      // Employee sees only their own data
      return user?.id || null;
    }
    // Manager/Admin sees selected employee data
    return selectedEodrEmployeeId;
  }, [userIsManager, user?.id, selectedEodrEmployeeId]);

  // Fetch projects for the submit report form
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  // Fetch tasks for the submit report form
  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(accessToken!),
    enabled: !!accessToken,
  });

  // My daily scores
  const { data: myDailyScoresData } = useQuery({
    queryKey: ['my-daily-scores', selectedMonth, selectedYear],
    queryFn: () => kpiApi.getDailyScores(accessToken!, { month: selectedMonth, year: selectedYear }),
    enabled: !!accessToken,
  });

  // Generate EODR mutation
  const generateEodrMutation = useMutation({
    mutationFn: (date: string) => eodrApi.generateEODR(date, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eodr-entries'] });
      queryClient.invalidateQueries({ queryKey: ['eodr-today'] });
      queryClient.invalidateQueries({ queryKey: ['my-kpi'] });
      toast({ title: 'EODR generated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to generate EODR', variant: 'destructive' });
    },
  });

  // Manager update EODR mutation
  const updateEodrMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { adjustedHours?: number; managerNotes?: string; isVerified?: boolean } }) =>
      eodrApi.managerUpdateEntry(id, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eodr-entries'] });
      queryClient.invalidateQueries({ queryKey: ['team-daily-scoring'] });
      setReviewingEntry(null);
      toast({ title: 'EODR updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update EODR', variant: 'destructive' });
    },
  });

  // Create daily KPI score mutation
  const createDailyScoreMutation = useMutation({
    mutationFn: (data: { userId: string; date: string; attendance: number; quality: number; behaviour: number; eodrScore: number; comments?: string }) =>
      kpiApi.createDailyScore(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-daily-scoring'] });
      queryClient.invalidateQueries({ queryKey: ['employee-of-month-daily'] });
      queryClient.invalidateQueries({ queryKey: ['my-daily-scores'] });
      setScoringMember(null);
      toast({ title: 'Daily score saved successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to save daily score', variant: 'destructive' });
    },
  });

  // Calculate monthly summary mutation
  const calculateMonthlySummaryMutation = useMutation({
    mutationFn: (data: { month: number; year: number }) =>
      kpiApi.calculateMonthlySummary(data, accessToken!),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['kpi-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['my-kpi'] });
      queryClient.invalidateQueries({ queryKey: ['employee-of-month-daily'] });
      const stats = response.data.stats;
      toast({ title: `Monthly summary calculated: ${stats.updated} updated, ${stats.skipped} skipped` });
    },
    onError: () => {
      toast({ title: 'Failed to calculate monthly summary', variant: 'destructive' });
    },
  });

  // Submit EODR report mutation
  const submitEodrMutation = useMutation({
    mutationFn: (data: { date: string; tasks: typeof submitTasks; totalHours: number; tasksCompleted: number; notes?: string }) =>
      eodrApi.createEntry({
        date: data.date,
        tasks: data.tasks.map(t => ({
          ...t,
          taskId: '',
          completedAt: t.completedAt || new Date().toISOString(),
        })),
        totalHours: data.totalHours,
        tasksCompleted: data.tasksCompleted,
        notes: data.notes,
      }, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eodr-entries'] });
      queryClient.invalidateQueries({ queryKey: ['eodr-today'] });
      queryClient.invalidateQueries({ queryKey: ['my-kpi'] });
      // Reset form
      setSubmitTasks([{ taskId: '', projectId: '', title: '', description: '', completedAt: '', filesLocation: '', pendingItems: '', projectName: '', hours: 0, status: 'COMPLETED' }]);
      setSubmitNotes('');
      toast({ title: 'Daily report submitted successfully!' });
    },
    onError: () => {
      toast({ title: 'Failed to submit report', variant: 'destructive' });
    },
  });

  const handlePreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handlePreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const handleGenerateToday = () => {
    const today = new Date().toISOString().split('T')[0];
    generateEodrMutation.mutate(today);
  };

  const handleReviewEntry = (entry: EODREntry) => {
    setReviewingEntry(entry);
    setAdjustedHours((entry.adjustedHours ?? entry.totalHours).toString());
    setManagerNotes(entry.managerNotes || '');
  };

  const handleSaveReview = (verify: boolean) => {
    if (!reviewingEntry) return;
    updateEodrMutation.mutate({
      id: reviewingEntry.id,
      data: {
        adjustedHours: parseFloat(adjustedHours),
        managerNotes,
        isVerified: verify,
      },
    });
  };

  const handleOpenDailyScoring = (member: TeamDailyScoringData['team'][0]) => {
    setScoringMember(member);
    // Set initial values from existing score or defaults
    if (member.dailyScore) {
      setDailyScoreValues({
        attendance: member.dailyScore.attendance,
        quality: member.dailyScore.quality,
        behaviour: member.dailyScore.behaviour,
        eodrScore: member.dailyScore.eodrScore,
        comments: member.dailyScore.comments || '',
      });
    } else {
      // Default: 1 (Average/Normal) for all metrics
      // 0 = Poor, 1 = Normal/Average, 2 = Excellent (appreciation only)
      setDailyScoreValues({
        attendance: 1,
        quality: 1,
        behaviour: 1,
        eodrScore: 1,
        comments: '',
      });
    }
  };

  const handleSaveDailyScore = () => {
    if (!scoringMember) return;
    createDailyScoreMutation.mutate({
      userId: scoringMember.user.id,
      date: selectedDate,
      attendance: dailyScoreValues.attendance,
      quality: dailyScoreValues.quality,
      behaviour: dailyScoreValues.behaviour,
      eodrScore: dailyScoreValues.eodrScore,
      comments: dailyScoreValues.comments || undefined,
    });
  };

  const handleCalculateMonthly = () => {
    calculateMonthlySummaryMutation.mutate({
      month: selectedMonth,
      year: selectedYear,
    });
  };

  // Submit Report handlers
  const handleAddTask = () => {
    setSubmitTasks([...submitTasks, { taskId: '', projectId: '', title: '', description: '', completedAt: '', filesLocation: '', pendingItems: '', projectName: '', hours: 0, status: 'COMPLETED' }]);
  };

  const handleRemoveTask = (index: number) => {
    if (submitTasks.length === 1) return;
    setSubmitTasks(submitTasks.filter((_, i) => i !== index));
  };

  const handleTaskChange = (index: number, field: string, value: string | number) => {
    const updated = [...submitTasks];
    updated[index] = { ...updated[index], [field]: value };

    // If project changed, reset task selection
    if (field === 'projectId') {
      updated[index].taskId = '';
      // Find project name
      const project = projects.find(p => p.id === value);
      updated[index].projectName = project?.name || '';
    }

    setSubmitTasks(updated);
  };

  // Handle task selection from dropdown - auto-fill hours and completed time
  const handleTaskSelection = async (index: number, taskId: string) => {
    if (!taskId) {
      handleTaskChange(index, 'taskId', '');
      return;
    }

    try {
      // Fetch task details with time entries
      const response = await tasksApi.get(taskId, accessToken!);
      const task = response.data as Task & {
        timeEntries?: Array<{
          id: string;
          startTime: string;
          endTime: string | null;
          duration: number | null;
        }>;
      };

      const updated = [...submitTasks];
      updated[index] = {
        ...updated[index],
        taskId: task.id,
        title: task.title,
        description: updated[index].description || '', // Keep existing description or empty - team member should fill this
        status: task.status,
        projectName: task.project?.name || updated[index].projectName,
      };

      // Calculate hours from time entries for today
      if (task.timeEntries && task.timeEntries.length > 0) {
        const today = new Date(submitDate);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Filter time entries for the selected date
        const todayEntries = task.timeEntries.filter(te => {
          const entryDate = new Date(te.startTime);
          return entryDate >= today && entryDate < tomorrow;
        });

        // Sum up duration (in minutes)
        const totalMinutes = todayEntries.reduce((sum, te) => sum + (te.duration || 0), 0);
        const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
        updated[index].hours = totalHours;

        // Find the last completed entry (with endTime) for completed at
        const completedEntries = todayEntries.filter(te => te.endTime);
        if (completedEntries.length > 0) {
          // Get the most recent end time
          const lastEntry = completedEntries.sort((a, b) =>
            new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime()
          )[0];
          updated[index].completedAt = lastEntry.endTime!;
        }
      } else if (task.actualHours) {
        // Fallback to actualHours from task
        updated[index].hours = task.actualHours;
      }

      setSubmitTasks(updated);
    } catch (error) {
      console.error('Failed to fetch task details:', error);
      // Just set the taskId without auto-fill
      handleTaskChange(index, 'taskId', taskId);
    }
  };

  const handleSubmitReport = () => {
    // Validate at least one task with title
    const validTasks = submitTasks.filter(t => t.title.trim());
    if (validTasks.length === 0) {
      toast({ title: 'Please add at least one task', variant: 'destructive' });
      return;
    }

    // Validate all tasks have descriptions
    const tasksWithoutDescription = validTasks.filter(t => !t.description.trim());
    if (tasksWithoutDescription.length > 0) {
      toast({
        title: 'Description required',
        description: `Please fill in the "What was done?" description for all ${tasksWithoutDescription.length} task(s)`,
        variant: 'destructive'
      });
      return;
    }

    const totalHours = validTasks.reduce((sum, t) => sum + (t.hours || 0), 0);
    const tasksCompleted = validTasks.filter(t => t.status === 'COMPLETED').length;

    submitEodrMutation.mutate({
      date: submitDate,
      tasks: validTasks,
      totalHours,
      tasksCompleted,
      notes: submitNotes || undefined,
    });
  };

  const handleLoadFromTimeEntries = () => {
    if (today?.tasks && today.tasks.length > 0) {
      setSubmitTasks(today.tasks.map(t => ({
        taskId: t.taskId || '',
        projectId: t.projectId || '',
        title: t.title,
        description: '', // Keep empty - team member should fill in what was done
        completedAt: new Date().toISOString(),
        filesLocation: '',
        pendingItems: t.status !== 'COMPLETED' ? 'Task still in progress' : '',
        projectName: t.projectName,
        hours: t.hours,
        status: t.status,
      })));
      toast({ title: 'Tasks loaded from time entries. Please fill in the description for each task.' });
    } else {
      toast({ title: 'No time entries found for today', variant: 'destructive' });
    }
  };

  const myKpi = myKpiData?.data;
  const dashboard = dashboardData?.data;
  const eom = employeeOfMonthData?.data;
  const teamDailyRaw = teamDailyScoringData?.data;

  // Filter teamDaily to only include employees (exclude ADMIN, MANAGER, etc.)
  const teamDaily = useMemo(() => {
    if (!teamDailyRaw) return null;
    return {
      ...teamDailyRaw,
      team: teamDailyRaw.team?.filter((member: { user: { role: string } }) =>
        member.user.role === 'EMPLOYEE'
      ) || [],
    };
  }, [teamDailyRaw]);

  const entries = eodrEntries?.data || [];
  const today = todayPreview?.data;
  const users = usersData?.data || [];
  const myDailyScores = myDailyScoresData?.data || [];
  const projects = projectsData?.data || [];
  const allTasks = tasksData?.data || [];

  // Get tasks filtered by project
  const getTasksForProject = (projectId: string) => {
    if (!projectId) return [];
    return allTasks.filter((t: Task) => t.projectId === projectId);
  };

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 3 }, (_, i) => currentYear - i);
  }, []);

  const selectedDateObj = new Date(selectedDate);
  const selectedDateStr = selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Reports & KPI' }]} />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports & KPI</h1>
          <p className="text-slate-400 mt-1">Track performance metrics and daily reports</p>
        </div>

        {/* Period Selector */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePreviousMonth} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[130px] bg-[#131d2e] border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#131d2e] border-slate-700">
                {MONTHS.map((month, idx) => (
                  <SelectItem key={idx} value={(idx + 1).toString()} className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px] bg-[#131d2e] border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#131d2e] border-slate-700">
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()} className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={handleNextMonth} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue={userIsManager ? "eodr-table" : "my-kpi"}>
        <TabsList className="flex-wrap bg-[#131d2e] border border-slate-700">
          {/* Employee-only tabs */}
          {!userIsManager && (
            <>
              <TabsTrigger value="my-kpi" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">My KPI</TabsTrigger>
              <TabsTrigger value="submit-report" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
                <FileUp className="h-4 w-4 mr-1" />
                Submit Report
              </TabsTrigger>
              <TabsTrigger value="eodr" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">Daily Reports</TabsTrigger>
            </>
          )}
          {/* Manager-only tab */}
          {userIsManager && (
            <TabsTrigger value="daily-scoring" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
              <ClipboardCheck className="h-4 w-4 mr-1" />
              Daily Scoring
            </TabsTrigger>
          )}
          <TabsTrigger value="employee-of-month" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white text-slate-400">
            <Trophy className="h-4 w-4 mr-1" />
            Employee of Month
          </TabsTrigger>
          <TabsTrigger value="eodr-table" className="data-[state=active]:bg-green-500 data-[state=active]:text-white text-slate-400">
            <BarChart3 className="h-4 w-4 mr-1" />
            EODR Table
          </TabsTrigger>
          <TabsTrigger value="weekly-summary" className="data-[state=active]:bg-green-500 data-[state=active]:text-white text-slate-400">
            <Calendar className="h-4 w-4 mr-1" />
            Weekly
          </TabsTrigger>
          <TabsTrigger value="monthly-commission" className="data-[state=active]:bg-green-500 data-[state=active]:text-white text-slate-400">
            <TrendingUp className="h-4 w-4 mr-1" />
            Commission
          </TabsTrigger>
          {user?.role === 'ADMIN' && (
            <TabsTrigger value="holidays" className="data-[state=active]:bg-purple-500 data-[state=active]:text-white text-slate-400">
              <CalendarDays className="h-4 w-4 mr-1" />
              Holidays
            </TabsTrigger>
          )}
        </TabsList>

        {/* My KPI Tab */}
        <TabsContent value="my-kpi" className="space-y-6">
          {loadingMyKpi ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : myKpi ? (
            <>
              {myKpi.commissionTier && (
                <Card className="bg-gradient-to-r from-[#131d2e] to-[#1a2538] border-slate-700">
                  <CardContent className="flex items-center justify-between p-6">
                    <div>
                      <p className="text-sm text-slate-400">Current Commission Tier</p>
                      <h3 className="text-2xl font-bold mt-1 text-white">{MONTHS[selectedMonth - 1]} {selectedYear}</h3>
                    </div>
                    <TierBadge tier={myKpi.commissionTier.tier} bonus={myKpi.commissionTier.bonus} />
                  </CardContent>
                </Card>
              )}

              {/* Daily Scores Summary */}
              {myDailyScores.length > 0 && (
                <Card className="!bg-[#131d2e] border-slate-700">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <CalendarDays className="h-5 w-5 text-blue-400" />
                      My Daily Scores - {MONTHS[selectedMonth - 1]}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-4 mb-4">
                      <div className="text-center p-3 bg-blue-500/20 rounded border border-blue-500/30">
                        <p className="text-2xl font-bold text-blue-400">
                          {(myDailyScores.reduce((sum, s) => sum + s.attendance, 0) / myDailyScores.length).toFixed(1)}
                        </p>
                        <p className="text-sm text-slate-400">Avg Attendance</p>
                      </div>
                      <div className="text-center p-3 bg-green-500/20 rounded border border-green-500/30">
                        <p className="text-2xl font-bold text-green-400">
                          {(myDailyScores.reduce((sum, s) => sum + s.quality, 0) / myDailyScores.length).toFixed(1)}
                        </p>
                        <p className="text-sm text-slate-400">Avg Quality</p>
                      </div>
                      <div className="text-center p-3 bg-pink-500/20 rounded border border-pink-500/30">
                        <p className="text-2xl font-bold text-pink-400">
                          {(myDailyScores.reduce((sum, s) => sum + s.behaviour, 0) / myDailyScores.length).toFixed(1)}
                        </p>
                        <p className="text-sm text-slate-400">Avg Behaviour</p>
                      </div>
                      <div className="text-center p-3 bg-purple-500/20 rounded border border-purple-500/30">
                        <p className="text-2xl font-bold text-purple-400">
                          {(myDailyScores.reduce((sum, s) => sum + s.eodrScore, 0) / myDailyScores.length).toFixed(1)}
                        </p>
                        <p className="text-sm text-slate-400">Avg EODR</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400">
                      {myDailyScores.length} days scored this month | Total Points: {myDailyScores.reduce((sum, s) => sum + s.totalScore, 0).toFixed(1)}
                    </p>
                  </CardContent>
                </Card>
              )}

              {myKpi.kpiRecord ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <KPIScoreCard
                      title="Attendance"
                      value={myKpi.kpiRecord.attendance}
                      icon={<Calendar className="h-5 w-5 text-white" />}
                      description="Working days present"
                      color="bg-blue-500"
                    />
                    <KPIScoreCard
                      title="Quality"
                      value={myKpi.kpiRecord.quality}
                      icon={<Target className="h-5 w-5 text-white" />}
                      description="Work quality score"
                      color="bg-green-500"
                    />
                    <KPIScoreCard
                      title="Behaviour"
                      value={myKpi.kpiRecord.behaviour}
                      icon={<Heart className="h-5 w-5 text-white" />}
                      description="Professional conduct"
                      color="bg-pink-500"
                    />
                    <KPIScoreCard
                      title="EODR Score"
                      value={myKpi.kpiRecord.eodrScore}
                      icon={<Brain className="h-5 w-5 text-white" />}
                      description="Daily report consistency"
                      color="bg-purple-500"
                    />
                  </div>

                  <Card className="!bg-[#131d2e] border-slate-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <TrendingUp className="h-5 w-5 text-blue-400" />
                        Overall Performance Score
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-4xl font-bold text-white">{myKpi.kpiRecord.totalScore}</span>
                        <span className="text-slate-500">/100</span>
                      </div>
                      <div className="h-4 rounded-full bg-slate-700">
                        <div
                          className={`h-4 rounded-full transition-all ${
                            myKpi.kpiRecord.totalScore >= 90 ? 'bg-purple-500' :
                            myKpi.kpiRecord.totalScore >= 80 ? 'bg-yellow-500' :
                            myKpi.kpiRecord.totalScore >= 70 ? 'bg-slate-400' :
                            myKpi.kpiRecord.totalScore >= 60 ? 'bg-orange-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${myKpi.kpiRecord.totalScore}%` }}
                        />
                      </div>
                      {myKpi.kpiRecord.reviewer && (
                        <p className="mt-4 text-sm text-slate-400">
                          Reviewed by {myKpi.kpiRecord.reviewer.name}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="!bg-[#131d2e] border-slate-700">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <BarChart3 className="h-12 w-12 text-slate-600" />
                    <h3 className="mt-4 text-lg font-medium text-white">No Monthly KPI Record Yet</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Monthly summary for {MONTHS[selectedMonth - 1]} {selectedYear} has not been calculated yet.
                    </p>
                    {myDailyScores.length > 0 && (
                      <p className="mt-2 text-sm text-blue-400">
                        You have {myDailyScores.length} daily scores - ask your manager to calculate the monthly summary.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="!bg-[#131d2e] border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">EODR Summary for {MONTHS[selectedMonth - 1]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="text-center p-4 bg-blue-500/20 rounded-lg border border-blue-500/30">
                      <FileText className="h-8 w-8 text-blue-400 mx-auto" />
                      <p className="mt-2 text-2xl font-bold text-white">{myKpi.eodrStats.totalDays}</p>
                      <p className="text-sm text-slate-400">Days Reported</p>
                    </div>
                    <div className="text-center p-4 bg-green-500/20 rounded-lg border border-green-500/30">
                      <Clock className="h-8 w-8 text-green-400 mx-auto" />
                      <p className="mt-2 text-2xl font-bold text-white">{myKpi.eodrStats.totalHours.toFixed(1)}</p>
                      <p className="text-sm text-slate-400">Total Hours</p>
                    </div>
                    <div className="text-center p-4 bg-purple-500/20 rounded-lg border border-purple-500/30">
                      <CheckCircle2 className="h-8 w-8 text-purple-400 mx-auto" />
                      <p className="mt-2 text-2xl font-bold text-white">{myKpi.eodrStats.totalTasksCompleted}</p>
                      <p className="text-sm text-slate-400">Tasks Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="!bg-[#131d2e] border-slate-700">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BarChart3 className="h-12 w-12 text-slate-600" />
                <h3 className="mt-4 text-lg font-medium text-white">No Data Available</h3>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Submit Report Tab */}
        <TabsContent value="submit-report" className="space-y-6">
          <Card className="!bg-[#131d2e] border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileUp className="h-5 w-5 text-blue-400" />
                  Submit End of Day Report
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={submitDate}
                    onChange={(e) => setSubmitDate(e.target.value)}
                    className="w-[180px] bg-[#0a1628] border-slate-700 text-white"
                  />
                  <Button variant="outline" size="sm" onClick={handleLoadFromTimeEntries} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Load from Timer
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Task List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold text-white">Tasks Completed Today</Label>
                  <Button variant="outline" size="sm" onClick={handleAddTask} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Task
                  </Button>
                </div>

                {submitTasks.map((task, idx) => (
                  <Card key={idx} className="p-4 bg-[#0a1628] border-slate-700">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-slate-400">Task #{idx + 1}</span>
                        {submitTasks.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveTask(idx)} className="text-red-400 hover:text-red-300 hover:bg-red-500/10">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`task-title-${idx}`} className="text-slate-300">Task Title *</Label>
                          <Input
                            id={`task-title-${idx}`}
                            value={task.title}
                            onChange={(e) => handleTaskChange(idx, 'title', e.target.value)}
                            placeholder="What was the task?"
                            className="bg-[#131d2e] border-slate-700 text-white placeholder:text-slate-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`task-project-${idx}`} className="text-slate-300">Project</Label>
                          <select
                            id={`task-project-${idx}`}
                            value={task.projectId}
                            onChange={(e) => handleTaskChange(idx, 'projectId', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-slate-700 bg-[#131d2e] text-white px-3 py-2 text-sm"
                          >
                            <option value="">Select project</option>
                            {projects.map((p) => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Task Selection Dropdown */}
                      {task.projectId && (
                        <div className="space-y-2">
                          <Label htmlFor={`task-select-${idx}`} className="text-slate-300">Select Task (Optional - auto-fills hours)</Label>
                          <select
                            id={`task-select-${idx}`}
                            value={task.taskId}
                            onChange={(e) => handleTaskSelection(idx, e.target.value)}
                            className="flex h-10 w-full rounded-md border border-slate-700 bg-[#131d2e] text-white px-3 py-2 text-sm"
                          >
                            <option value="">Select a task or enter manually below</option>
                            {getTasksForProject(task.projectId).map((t: Task) => (
                              <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                          </select>
                          <p className="text-xs text-slate-500">
                            Selecting a task will auto-fill hours from time entries
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor={`task-desc-${idx}`} className="text-slate-300">Description - What was done? <span className="text-red-400">*</span></Label>
                        <Textarea
                          id={`task-desc-${idx}`}
                          value={task.description}
                          onChange={(e) => handleTaskChange(idx, 'description', e.target.value)}
                          placeholder="Describe what you worked on and accomplished..."
                          rows={2}
                          className={`bg-[#131d2e] border-slate-700 text-white placeholder:text-slate-500 ${!task.description.trim() ? 'border-red-500/50' : ''}`}
                          required
                        />
                        {!task.description.trim() && (
                          <p className="text-xs text-red-400">Please describe what was done for this task</p>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor={`task-hours-${idx}`} className="text-slate-300">Hours Spent</Label>
                          <Input
                            id={`task-hours-${idx}`}
                            type="number"
                            step="0.5"
                            min="0"
                            value={task.hours || ''}
                            onChange={(e) => handleTaskChange(idx, 'hours', parseFloat(e.target.value) || 0)}
                            placeholder="0.0"
                            className="bg-[#131d2e] border-slate-700 text-white placeholder:text-slate-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`task-status-${idx}`} className="text-slate-300">Status</Label>
                          <select
                            id={`task-status-${idx}`}
                            value={task.status}
                            onChange={(e) => handleTaskChange(idx, 'status', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-slate-700 bg-[#131d2e] text-white px-3 py-2 text-sm"
                          >
                            <option value="COMPLETED">Completed</option>
                            <option value="IN_PROGRESS">In Progress</option>
                            <option value="IN_REVIEW">In Review</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`task-completed-${idx}`} className="text-slate-300">Completed At</Label>
                          <Input
                            id={`task-completed-${idx}`}
                            type="time"
                            value={task.completedAt ? task.completedAt.split('T')[1]?.substring(0, 5) || '' : ''}
                            onChange={(e) => handleTaskChange(idx, 'completedAt', `${submitDate}T${e.target.value}:00.000Z`)}
                            className="bg-[#131d2e] border-slate-700 text-white"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`task-files-${idx}`} className="text-slate-300">Files/Documents Location</Label>
                          <Input
                            id={`task-files-${idx}`}
                            value={task.filesLocation}
                            onChange={(e) => handleTaskChange(idx, 'filesLocation', e.target.value)}
                            placeholder="Drive link, folder path, or N/A"
                            className="bg-[#131d2e] border-slate-700 text-white placeholder:text-slate-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`task-pending-${idx}`} className="text-slate-300">What&apos;s Pending?</Label>
                          <Input
                            id={`task-pending-${idx}`}
                            value={task.pendingItems}
                            onChange={(e) => handleTaskChange(idx, 'pendingItems', e.target.value)}
                            placeholder="Any outstanding items or N/A"
                            className="bg-[#131d2e] border-slate-700 text-white placeholder:text-slate-500"
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="submit-notes" className="text-slate-300">Additional Notes (Optional)</Label>
                <Textarea
                  id="submit-notes"
                  value={submitNotes}
                  onChange={(e) => setSubmitNotes(e.target.value)}
                  placeholder="Any additional notes about your day, blockers, achievements, etc."
                  rows={3}
                  className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              {/* Summary */}
              <div className="bg-blue-500/20 p-4 rounded-lg border border-blue-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">Report Summary</span>
                  <span className="text-sm text-slate-400">{new Date(submitDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-400">{submitTasks.filter(t => t.title.trim()).length}</p>
                    <p className="text-xs text-slate-400">Tasks</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-400">{submitTasks.reduce((sum, t) => sum + (t.hours || 0), 0).toFixed(1)}</p>
                    <p className="text-xs text-slate-400">Total Hours</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-400">{submitTasks.filter(t => t.status === 'COMPLETED' && t.title.trim()).length}</p>
                    <p className="text-xs text-slate-400">Completed</p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmitTasks([{ taskId: '', projectId: '', title: '', description: '', completedAt: '', filesLocation: '', pendingItems: '', projectName: '', hours: 0, status: 'COMPLETED' }]);
                    setSubmitNotes('');
                  }}
                  className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
                >
                  Clear Form
                </Button>
                <Button
                  onClick={handleSubmitReport}
                  disabled={submitEodrMutation.isPending}
                  className="bg-blue-500 hover:bg-blue-600"
                >
                  {submitEodrMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Submit Report
                </Button>
              </div>

              {/* Previous Report Info */}
              {today?.hasSubmittedEodr && (
                <div className={`p-4 rounded-lg ${today.isVerified ? 'bg-green-500/20 border border-green-500/30' : 'bg-orange-500/20 border border-orange-500/30'}`}>
                  <div className="flex items-center gap-2">
                    {today.isVerified ? (
                      <Check className="h-5 w-5 text-green-400" />
                    ) : (
                      <Clock className="h-5 w-5 text-orange-400" />
                    )}
                    <span className={`font-medium ${today.isVerified ? 'text-green-400' : 'text-orange-400'}`}>
                      {today.isVerified ? 'Today\'s report has been verified' : 'Today\'s report is pending verification'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">
                    Submitting again will update your existing report (verification will be reset).
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EODR Tab */}
        <TabsContent value="eodr" className="space-y-6">
          {!loadingToday && today && (
            <Card className="bg-gradient-to-r from-[#131d2e] to-[#1a2538] border-slate-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Clock className="h-5 w-5 text-blue-400" />
                    Today&apos;s Work
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {today.hasSubmittedEodr && (
                      <Badge variant={today.isVerified ? 'default' : 'outline'}>
                        {today.isVerified ? 'Verified' : 'Submitted'}
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      onClick={handleGenerateToday}
                      disabled={generateEodrMutation.isPending}
                    >
                      {generateEodrMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Generate EODR
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-8">
                  <div>
                    <p className="text-3xl font-bold text-blue-400">{today.totalHours.toFixed(1)}h</p>
                    <p className="text-sm text-slate-400">Hours logged</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-green-400">{today.tasksCompleted}</p>
                    <p className="text-sm text-slate-400">Tasks completed</p>
                  </div>
                  {today.hasActiveTimer && (
                    <div className="flex items-center gap-2 text-orange-400">
                      <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                      <span className="text-sm">Timer active: {today.activeTaskTitle}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {userIsManager && (
            <div className="flex items-center gap-4">
              <Select
                value={selectedUserId || 'all'}
                onValueChange={(v) => setSelectedUserId(v === 'all' ? null : v)}
              >
                <SelectTrigger className="w-[250px] bg-[#131d2e] border-slate-700 text-white">
                  <SelectValue placeholder="Filter by user" />
                </SelectTrigger>
                <SelectContent className="bg-[#131d2e] border-slate-700">
                  <SelectItem value="all" className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">All Users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-white hover:bg-slate-700/50 focus:bg-slate-700/50">
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {loadingEodr ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : entries.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {entries.map((entry) => (
                <EODRCard
                  key={entry.id}
                  entry={entry}
                  onReview={userIsManager ? () => handleReviewEntry(entry) : undefined}
                />
              ))}
            </div>
          ) : (
            <Card className="!bg-[#131d2e] border-slate-700">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="h-12 w-12 text-slate-600" />
                <h3 className="mt-4 text-lg font-medium text-white">No Reports Found</h3>
                <p className="mt-2 text-sm text-slate-400">
                  No EODR entries for {MONTHS[selectedMonth - 1]} {selectedYear}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Daily Scoring Tab (Managers Only) */}
        {userIsManager && (
          <TabsContent value="daily-scoring" className="space-y-6">
            {/* Date Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePreviousDay} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-[180px] bg-[#131d2e] border-slate-700 text-white"
                  />
                </div>
                <Button variant="outline" size="icon" onClick={handleNextDay} className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                  className="border-slate-600 bg-slate-800 text-white hover:bg-slate-700"
                >
                  Today
                </Button>
              </div>
              <p className="text-lg font-medium text-white">{selectedDateStr}</p>
            </div>

            {loadingTeamDaily ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : teamDaily ? (
              <>
                {/* Stats Cards */}
                <div className="grid gap-4 md:grid-cols-5">
                  <Card className="!bg-[#131d2e] border-slate-700">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-white">{teamDaily.stats.totalUsers}</p>
                      <p className="text-sm text-slate-400">Total Team</p>
                    </CardContent>
                  </Card>
                  <Card className="!bg-[#131d2e] border-slate-700">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-400">{teamDaily.stats.submittedEODR}</p>
                      <p className="text-sm text-slate-400">Submitted EODR</p>
                    </CardContent>
                  </Card>
                  <Card className="!bg-[#131d2e] border-slate-700">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-red-400">{teamDaily.stats.pendingEODR}</p>
                      <p className="text-sm text-slate-400">Missing EODR</p>
                    </CardContent>
                  </Card>
                  <Card className="!bg-[#131d2e] border-slate-700">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-400">{teamDaily.stats.scored}</p>
                      <p className="text-sm text-slate-400">Scored</p>
                    </CardContent>
                  </Card>
                  <Card className="!bg-[#131d2e] border-slate-700">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-orange-400">{teamDaily.stats.pendingScoring}</p>
                      <p className="text-sm text-slate-400">Pending Score</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Team Scoring Table */}
                <Card className="!bg-[#131d2e] border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Daily KPI Scoring - {selectedDateStr}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700 bg-[#0a1628]">
                            <th className="text-left py-3 px-4 font-semibold text-slate-300">Employee</th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-300">EODR</th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-300">Hours</th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-300">Tasks</th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-300">Attendance</th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-300">Quality</th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-300">Behaviour</th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-300">EODR Score</th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-300">Total</th>
                            <th className="text-center py-3 px-2 font-semibold text-slate-300">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {teamDaily.team.map((member) => (
                            <tr
                              key={member.user.id}
                              className={`border-b border-slate-700/50 hover:bg-slate-700/30 ${
                                !member.hasSubmittedEODR ? 'bg-red-500/10' :
                                member.isScored ? 'bg-green-500/10' : ''
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={member.user.avatar} />
                                    <AvatarFallback className="bg-blue-500 text-white">{member.user.name.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium text-sm text-white">{member.user.name}</p>
                                    <p className="text-xs text-slate-400">{member.user.department?.name}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="text-center py-3 px-2">
                                {member.hasSubmittedEODR ? (
                                  <Badge className="bg-green-500/20 text-green-400 text-xs">
                                    <Check className="h-3 w-3 mr-1" />
                                    Yes
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive" className="text-xs">
                                    Missing
                                  </Badge>
                                )}
                              </td>
                              <td className="text-center py-3 px-2 text-sm text-slate-300">
                                {member.eodrEntry?.totalHours?.toFixed(1) || '-'}
                                {member.eodrEntry?.adjustedHours != null && member.eodrEntry.adjustedHours !== member.eodrEntry.totalHours && (
                                  <span className="text-xs text-orange-400 ml-1">
                                    ({member.eodrEntry.adjustedHours.toFixed(1)})
                                  </span>
                                )}
                              </td>
                              <td className="text-center py-3 px-2 text-sm text-slate-300">
                                {member.eodrEntry?.tasksCompleted || '-'}
                              </td>
                              <td className="text-center py-3 px-2 text-slate-300">
                                {member.dailyScore?.attendance ?? '-'}
                              </td>
                              <td className="text-center py-3 px-2 text-slate-300">
                                {member.dailyScore?.quality ?? '-'}
                              </td>
                              <td className="text-center py-3 px-2 text-slate-300">
                                {member.dailyScore?.behaviour ?? '-'}
                              </td>
                              <td className="text-center py-3 px-2 text-slate-300">
                                {member.dailyScore?.eodrScore ?? '-'}
                              </td>
                              <td className="text-center py-3 px-2 font-bold text-white">
                                {member.dailyScore?.totalScore?.toFixed(1) ?? '-'}
                              </td>
                              <td className="text-center py-3 px-2">
                                <Button
                                  size="sm"
                                  variant={member.isScored ? 'outline' : 'default'}
                                  onClick={() => handleOpenDailyScoring(member)}
                                >
                                  <Edit className="h-4 w-4 mr-1" />
                                  {member.isScored ? 'Edit' : 'Score'}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-4 text-xs text-slate-500">
                      Note: Scores are on a 0-2 scale (0=Poor, 1=Average, 2=Excellent). Total = sum of all 4 metrics (max 8).
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
        )}

        {/* Employee of the Month Tab */}
        <TabsContent value="employee-of-month" className="space-y-6">
          {userIsManager && (
            <div className="flex justify-end">
              <Button
                onClick={handleCalculateMonthly}
                disabled={calculateMonthlySummaryMutation.isPending}
              >
                {calculateMonthlySummaryMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Calculate Monthly Summary
              </Button>
            </div>
          )}

          {loadingEOM ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : eom ? (
            <>
              {/* Winner Card */}
              {eom.employeeOfMonth && (
                <Card className="!bg-gradient-to-r !from-yellow-900/40 !to-orange-900/40 border-yellow-500/50">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <Avatar className="h-16 w-16 border-4 border-yellow-400">
                            <AvatarImage src={eom.employeeOfMonth.user.avatar} />
                            <AvatarFallback className="bg-yellow-500 text-white text-xl">
                              {eom.employeeOfMonth.user.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -top-2 -right-2 bg-[#131d2e] rounded-full p-1 border-2 border-yellow-400">
                            <Trophy className="h-6 w-6 text-yellow-400 fill-yellow-400" />
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-yellow-400 font-medium">Employee of the Month</p>
                          <h2 className="text-2xl font-bold text-white">{eom.employeeOfMonth.user.name}</h2>
                          <p className="text-sm text-slate-400">{eom.employeeOfMonth.user.department?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-bold text-yellow-400">{eom.employeeOfMonth.points.toFixed(1)}</p>
                        <p className="text-sm text-slate-400">Total Points ({eom.employeeOfMonth.daysScored} days)</p>
                        <Badge className="mt-2 bg-green-500/20 text-green-400">
                          +{eom.employeeOfMonth.difference.toFixed(1)} above avg
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!eom.employeeOfMonth && eom.employees.length > 0 && (
                <Card className="!bg-[#131d2e] border-slate-700">
                  <CardContent className="p-6 text-center">
                    <AlertTriangle className="h-12 w-12 text-orange-400 mx-auto" />
                    <h3 className="mt-4 text-lg font-medium text-white">No Eligible Winner</h3>
                    <p className="text-sm text-slate-400 mt-2">
                      Employee of the month is only awarded to those who achieve a positive or zero difference from the average.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Stats */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="!bg-[#131d2e] border-slate-700">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-white">{eom.workingDays}</p>
                    <p className="text-sm text-slate-400">Working Days</p>
                  </CardContent>
                </Card>
                <Card className="!bg-[#131d2e] border-slate-700">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-white">{eom.avgPointsRequired.toFixed(1)}</p>
                    <p className="text-sm text-slate-400">Avg Points</p>
                  </CardContent>
                </Card>
                <Card className="!bg-[#131d2e] border-slate-700">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">{eom.stats?.eligibleCount || 0}</p>
                    <p className="text-sm text-slate-400">Eligible</p>
                  </CardContent>
                </Card>
                <Card className="!bg-[#131d2e] border-slate-700">
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold text-red-400">{eom.stats?.ineligibleCount || 0}</p>
                    <p className="text-sm text-slate-400">Below Average</p>
                  </CardContent>
                </Card>
              </div>

              {/* Employee Table */}
              <Card className="!bg-[#131d2e] border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">{MONTHS[selectedMonth - 1]} {selectedYear}</CardTitle>
                </CardHeader>
                <CardContent>
                  {eom.employees.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-slate-700 bg-[#0a1628]">
                            <th className="text-left py-3 px-4 font-semibold text-slate-300">Name</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-300">Days Scored</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-300">Points</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-300">Avg Point</th>
                            <th className="text-center py-3 px-4 font-semibold text-slate-300">Difference</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eom.employees.map((emp, idx) => (
                            <tr
                              key={emp.user.id}
                              className={`border-b border-slate-700 ${
                                emp.difference >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'
                              }`}
                            >
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  {idx === 0 && emp.isEligible && (
                                    <Trophy className="h-5 w-5 text-yellow-500" />
                                  )}
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={emp.user.avatar} />
                                    <AvatarFallback className="bg-blue-500 text-white">{emp.user.name.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium text-white">{emp.user.name}</span>
                                </div>
                              </td>
                              <td className="text-center py-3 px-4 text-slate-300">{emp.daysScored}</td>
                              <td className="text-center py-3 px-4 font-bold text-white">{emp.points.toFixed(1)}</td>
                              <td className="text-center py-3 px-4 text-slate-300">{emp.avgPoint.toFixed(1)}</td>
                              <td className="text-center py-3 px-4">
                                <span className={`font-bold ${
                                  emp.difference >= 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {emp.difference >= 0 ? '+' : ''}{emp.difference.toFixed(1)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-center text-slate-400 py-8">
                      No daily KPI scores for this period. Managers need to score employees daily.
                    </p>
                  )}
                  <p className="mt-4 text-xs text-slate-500 italic">
                    Note: Employee of the month only awarded to those who achieve the Difference of Points in + (positive) not - (negative) or difference is 0
                  </p>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="!bg-[#131d2e] border-slate-700">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Trophy className="h-12 w-12 text-slate-500" />
                <h3 className="mt-4 text-lg font-medium text-slate-400">No Data Available</h3>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* EODR Table Tab - Excel-like view */}
        <TabsContent value="eodr-table" className="space-y-6">
          <Card className="!bg-[#131d2e] border-slate-700">
            <CardContent className="p-6">
              {/* Employee Selector for Managers/Admins */}
              {userIsManager && (
                <div className="mb-6 flex items-center gap-4">
                  <Label className="text-slate-300">Select Employee:</Label>
                  <Select
                    value={selectedEodrEmployeeId || ''}
                    onValueChange={(v) => setSelectedEodrEmployeeId(v || null)}
                  >
                    <SelectTrigger className="w-[280px] bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Choose an employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesList.map((emp: { id: string; name: string; email: string }) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show table only if employee is selected (for managers) or if user is employee */}
              {eodrUserId ? (
                <DailyEODRTable
                  month={selectedMonth}
                  year={selectedYear}
                  userId={eodrUserId}
                  userRole={user?.role || 'EMPLOYEE'}
                  isManager={userIsManager}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg">Select an employee to view their daily EODR entries</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weekly Summary Tab */}
        <TabsContent value="weekly-summary" className="space-y-6">
          <Card className="!bg-[#131d2e] border-slate-700">
            <CardContent className="p-6">
              {/* Employee Selector for Managers/Admins */}
              {userIsManager && (
                <div className="mb-6 flex items-center gap-4">
                  <Label className="text-slate-300">Select Employee:</Label>
                  <Select
                    value={selectedEodrEmployeeId || ''}
                    onValueChange={(v) => setSelectedEodrEmployeeId(v || null)}
                  >
                    <SelectTrigger className="w-[280px] bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Choose an employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesList.map((emp: { id: string; name: string; email: string }) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show table only if employee is selected (for managers) or if user is employee */}
              {eodrUserId ? (
                <WeeklySummaryTable
                  month={selectedMonth}
                  year={selectedYear}
                  userId={eodrUserId}
                  userRole={user?.role || 'EMPLOYEE'}
                  isManager={userIsManager}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg">Select an employee to view their weekly summary</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Commission Tab */}
        <TabsContent value="monthly-commission" className="space-y-6">
          <Card className="!bg-[#131d2e] border-slate-700">
            <CardContent className="p-6">
              {/* Employee Selector for Managers/Admins */}
              {userIsManager && (
                <div className="mb-6 flex items-center gap-4">
                  <Label className="text-slate-300">Select Employee:</Label>
                  <Select
                    value={selectedEodrEmployeeId || ''}
                    onValueChange={(v) => setSelectedEodrEmployeeId(v || null)}
                  >
                    <SelectTrigger className="w-[280px] bg-slate-800 border-slate-600">
                      <SelectValue placeholder="Choose an employee..." />
                    </SelectTrigger>
                    <SelectContent>
                      {employeesList.map((emp: { id: string; name: string; email: string }) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} ({emp.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Show table only if employee is selected (for managers) or if user is employee */}
              {eodrUserId ? (
                <MonthlySummaryTable
                  year={selectedYear}
                  month={selectedMonth}
                  userId={eodrUserId}
                  userRole={user?.role || 'EMPLOYEE'}
                  isManager={userIsManager}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Users className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg">Select an employee to view their monthly commission</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Holiday Config Tab - Admin only */}
        {user?.role === 'ADMIN' && (
          <TabsContent value="holidays" className="space-y-6">
            <Card className="!bg-[#131d2e] border-slate-700">
              <CardContent className="p-6">
                <HolidayManager isAdmin={true} />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* EODR Review Dialog */}
      <Dialog open={!!reviewingEntry} onOpenChange={() => setReviewingEntry(null)}>
        <DialogContent className="max-w-lg bg-[#131d2e] border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">Review EODR Entry</DialogTitle>
          </DialogHeader>
          {reviewingEntry && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={reviewingEntry.user?.avatar} />
                  <AvatarFallback className="bg-blue-500 text-white">{reviewingEntry.user?.name?.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-white">{reviewingEntry.user?.name}</p>
                  <p className="text-sm text-slate-400">
                    {new Date(reviewingEntry.date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="bg-[#0a1628] p-3 rounded border border-slate-700">
                <p className="text-sm font-medium mb-2 text-white">Tasks:</p>
                {Array.isArray(reviewingEntry.tasks) && reviewingEntry.tasks.map((task, idx) => (
                  <div key={idx} className="text-sm py-1 border-b border-slate-700 last:border-0">
                    <p className="font-medium text-white">{task.title}</p>
                    {task.description && <p className="text-slate-400 text-xs">{task.description}</p>}
                    <div className="flex gap-2 text-xs text-slate-500 mt-1">
                      <span>{task.hours.toFixed(1)}h</span>
                      <span>|</span>
                      <span>{task.projectName}</span>
                      {task.pendingItems && <span className="text-orange-400">| Pending: {task.pendingItems}</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Adjust Hours (Original: {reviewingEntry.totalHours}h)</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={adjustedHours}
                  onChange={(e) => setAdjustedHours(e.target.value)}
                  className="bg-[#0a1628] border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Manager Notes</Label>
                <Textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Add notes about the review..."
                  className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              {reviewingEntry.notes && (
                <div className="bg-blue-500/10 p-3 rounded border border-blue-500/30">
                  <p className="text-sm font-medium text-blue-400">Employee Notes:</p>
                  <p className="text-sm text-slate-300">{reviewingEntry.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setReviewingEntry(null)} className="border-slate-700 text-slate-300 hover:bg-slate-700/50">
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleSaveReview(false)}
              disabled={updateEodrMutation.isPending}
              className="border-slate-700 text-slate-300 hover:bg-slate-700/50"
            >
              Save Only
            </Button>
            <Button
              onClick={() => handleSaveReview(true)}
              disabled={updateEodrMutation.isPending}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              {updateEodrMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Verify
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Daily Scoring Dialog */}
      <Dialog open={!!scoringMember} onOpenChange={() => setScoringMember(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#131d2e] border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">
              Daily KPI Score - {scoringMember?.user.name}
            </DialogTitle>
          </DialogHeader>
          {scoringMember && (
            <div className="space-y-4 pr-2">
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={scoringMember.user.avatar} />
                  <AvatarFallback className="bg-blue-500 text-white">{scoringMember.user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-white">{scoringMember.user.name}</p>
                  <p className="text-sm text-slate-400">{selectedDateStr}</p>
                </div>
              </div>

              {scoringMember.eodrEntry && (
                <div className="bg-[#0a1628] p-3 rounded text-sm border border-slate-700">
                  <p className="font-medium mb-1 text-white">EODR Summary:</p>
                  <p className="text-slate-300">Hours: {scoringMember.eodrEntry.totalHours.toFixed(1)}h | Tasks: {scoringMember.eodrEntry.tasksCompleted}</p>
                </div>
              )}

              {!scoringMember.hasSubmittedEODR && (
                <div className="bg-red-500/10 p-3 rounded text-sm text-red-400 border border-red-500/30">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  This employee has not submitted EODR for this date.
                </div>
              )}

              <div className="space-y-4">
                {/* Attendance */}
                <div className="space-y-2">
                  <Label className="font-semibold text-white">Attendance</Label>
                  <div className="space-y-1">
                    {[0, 1, 2].map((score) => (
                      <label key={score} className={`flex items-start gap-3 p-2 rounded cursor-pointer border ${dailyScoreValues.attendance === score ? 'bg-blue-500/20 border-blue-500/50' : 'bg-[#0a1628] border-slate-700 hover:bg-slate-700/50'}`}>
                        <input
                          type="radio"
                          name="attendance"
                          value={score}
                          checked={dailyScoreValues.attendance === score}
                          onChange={() => setDailyScoreValues({ ...dailyScoreValues, attendance: score })}
                          className="mt-1"
                        />
                        <div>
                          <span className={`font-medium ${score === 0 ? 'text-red-400' : score === 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {score} - {score === 0 ? 'Poor' : score === 1 ? 'Average' : 'Excellent'}
                          </span>
                          <p className="text-xs text-slate-400">{SCORE_DESCRIPTIONS.attendance[score as 0 | 1 | 2]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Quality */}
                <div className="space-y-2">
                  <Label className="font-semibold text-white">Quality</Label>
                  <div className="space-y-1">
                    {[0, 1, 2].map((score) => (
                      <label key={score} className={`flex items-start gap-3 p-2 rounded cursor-pointer border ${dailyScoreValues.quality === score ? 'bg-blue-500/20 border-blue-500/50' : 'bg-[#0a1628] border-slate-700 hover:bg-slate-700/50'}`}>
                        <input
                          type="radio"
                          name="quality"
                          value={score}
                          checked={dailyScoreValues.quality === score}
                          onChange={() => setDailyScoreValues({ ...dailyScoreValues, quality: score })}
                          className="mt-1"
                        />
                        <div>
                          <span className={`font-medium ${score === 0 ? 'text-red-400' : score === 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {score} - {score === 0 ? 'Rework' : score === 1 ? 'Average' : 'Excellent'}
                          </span>
                          <p className="text-xs text-slate-400">{SCORE_DESCRIPTIONS.quality[score as 0 | 1 | 2]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* EODR */}
                <div className="space-y-2">
                  <Label className="font-semibold text-white">EODR</Label>
                  <div className="space-y-1">
                    {[0, 1, 2].map((score) => (
                      <label key={score} className={`flex items-start gap-3 p-2 rounded cursor-pointer border ${dailyScoreValues.eodrScore === score ? 'bg-blue-500/20 border-blue-500/50' : 'bg-[#0a1628] border-slate-700 hover:bg-slate-700/50'}`}>
                        <input
                          type="radio"
                          name="eodrScore"
                          value={score}
                          checked={dailyScoreValues.eodrScore === score}
                          onChange={() => setDailyScoreValues({ ...dailyScoreValues, eodrScore: score })}
                          className="mt-1"
                        />
                        <div>
                          <span className={`font-medium ${score === 0 ? 'text-red-400' : score === 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {score} - {score === 0 ? 'Not Filling' : score === 1 ? 'Normal' : 'Excellent'}
                          </span>
                          <p className="text-xs text-slate-400">{SCORE_DESCRIPTIONS.eodrScore[score as 0 | 1 | 2]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Behaviour */}
                <div className="space-y-2">
                  <Label className="font-semibold text-white">Behaviour</Label>
                  <div className="space-y-1">
                    {[0, 1, 2].map((score) => (
                      <label key={score} className={`flex items-start gap-3 p-2 rounded cursor-pointer border ${dailyScoreValues.behaviour === score ? 'bg-blue-500/20 border-blue-500/50' : 'bg-[#0a1628] border-slate-700 hover:bg-slate-700/50'}`}>
                        <input
                          type="radio"
                          name="behaviour"
                          value={score}
                          checked={dailyScoreValues.behaviour === score}
                          onChange={() => setDailyScoreValues({ ...dailyScoreValues, behaviour: score })}
                          className="mt-1"
                        />
                        <div>
                          <span className={`font-medium ${score === 0 ? 'text-red-400' : score === 1 ? 'text-yellow-400' : 'text-green-400'}`}>
                            {score} - {score === 0 ? 'Poor' : score === 1 ? 'Normal' : 'Excellent'}
                          </span>
                          <p className="text-xs text-slate-400">{SCORE_DESCRIPTIONS.behaviour[score as 0 | 1 | 2]}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Comments (optional)</Label>
                <Textarea
                  value={dailyScoreValues.comments}
                  onChange={(e) => setDailyScoreValues({ ...dailyScoreValues, comments: e.target.value })}
                  placeholder="Add any notes about today's performance..."
                  className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="bg-blue-500/10 p-3 rounded text-center border border-blue-500/30">
                <p className="text-sm text-slate-400">Total Daily Score</p>
                {(() => {
                  const total = dailyScoreValues.attendance + dailyScoreValues.quality + dailyScoreValues.behaviour + dailyScoreValues.eodrScore;
                  const isAboveNormal = total > 4;
                  const isBelowNormal = total < 4;
                  return (
                    <p className={`text-2xl font-bold ${isAboveNormal ? 'text-green-400' : isBelowNormal ? 'text-red-400' : 'text-blue-400'}`}>
                      {total}
                      <span className="text-base font-normal text-slate-400"> / 4</span>
                    </p>
                  );
                })()}
                <p className="text-xs text-slate-500">Baseline: 4 (1 per metric) • Above 4 = Exceptional</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setScoringMember(null)} className="border-slate-700 text-slate-300 hover:bg-slate-700/50">
              Cancel
            </Button>
            <Button
              onClick={handleSaveDailyScore}
              disabled={createDailyScoreMutation.isPending}
              className="bg-blue-500 text-white hover:bg-blue-600"
            >
              {createDailyScoreMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Score
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
