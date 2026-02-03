'use client';

import * as React from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuthStore } from '@/lib/auth-store';
import { aiApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ActivitySummaryCardProps {
  className?: string;
}

interface SummaryData {
  summary: string;
  stats: {
    tasksWorkedOn: number;
    tasksCompleted: number;
    hoursLogged: number;
    eodrSubmitted: number;
  };
}

export function ActivitySummaryCard({ className }: ActivitySummaryCardProps) {
  const { accessToken } = useAuthStore();
  const [period, setPeriod] = React.useState<'daily' | 'weekly'>('daily');
  const [summaryData, setSummaryData] = React.useState<SummaryData | null>(null);

  const summaryMutation = useMutation({
    mutationFn: (p: 'daily' | 'weekly') =>
      aiApi.summarizeActivity(undefined, p, accessToken!),
    onSuccess: (response) => {
      setSummaryData(response.data);
    },
  });

  const handleGenerateSummary = (p: 'daily' | 'weekly') => {
    setPeriod(p);
    summaryMutation.mutate(p);
  };

  React.useEffect(() => {
    // Auto-generate daily summary on mount
    if (accessToken) {
      summaryMutation.mutate('daily');
    }
  }, [accessToken]);

  return (
    <Card className={cn('bg-[#131d2e] border-slate-700', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-400" />
            AI Activity Summary
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs
          value={period}
          onValueChange={(v) => handleGenerateSummary(v as 'daily' | 'weekly')}
        >
          <TabsList className="bg-slate-800 border-slate-700 w-full">
            <TabsTrigger
              value="daily"
              className="flex-1 data-[state=active]:bg-purple-600"
            >
              <Clock className="h-4 w-4 mr-2" />
              Today
            </TabsTrigger>
            <TabsTrigger
              value="weekly"
              className="flex-1 data-[state=active]:bg-purple-600"
            >
              <Calendar className="h-4 w-4 mr-2" />
              This Week
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {summaryMutation.isPending ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-sm text-slate-400">
              AI is analyzing your activity...
            </p>
          </div>
        ) : summaryData ? (
          <div className="space-y-4">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-slate-400">Tasks Worked</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {summaryData.stats.tasksWorkedOn}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-xs text-slate-400">Completed</span>
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {summaryData.stats.tasksCompleted}
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-orange-400" />
                  <span className="text-xs text-slate-400">Hours Logged</span>
                </div>
                <p className="text-2xl font-bold text-orange-400">
                  {summaryData.stats.hoursLogged}h
                </p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-slate-400">Productivity</span>
                </div>
                <p className="text-2xl font-bold text-purple-400">
                  {summaryData.stats.tasksWorkedOn > 0
                    ? Math.round(
                        (summaryData.stats.tasksCompleted /
                          summaryData.stats.tasksWorkedOn) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
            </div>

            {/* AI Summary */}
            <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-purple-400" />
                <span className="text-sm font-medium text-purple-300">
                  AI Insights
                </span>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                {summaryData.summary}
              </p>
            </div>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => summaryMutation.mutate(period)}
              disabled={summaryMutation.isPending}
              className="w-full border-slate-600"
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4 mr-2',
                  summaryMutation.isPending && 'animate-spin'
                )}
              />
              Refresh Summary
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Sparkles className="h-8 w-8 text-slate-500" />
            <p className="text-sm text-slate-400">
              Click to generate your activity summary
            </p>
            <Button
              onClick={() => summaryMutation.mutate(period)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Generate Summary
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ActivitySummaryCard;
