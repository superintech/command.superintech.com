'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  Lightbulb,
  Target,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuthStore } from '@/lib/auth-store';
import { aiApi, ProjectAnalysis } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProjectHealthCardProps {
  projectId: string;
  projectName: string;
  className?: string;
}

const STATUS_CONFIG = {
  healthy: {
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: CheckCircle2,
    label: 'Healthy',
  },
  at_risk: {
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: AlertTriangle,
    label: 'At Risk',
  },
  critical: {
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: AlertTriangle,
    label: 'Critical',
  },
};

export function ProjectHealthCard({
  projectId,
  projectName,
  className,
}: ProjectHealthCardProps) {
  const { accessToken } = useAuthStore();

  const {
    data: healthData,
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['project-health', projectId],
    queryFn: () => aiApi.analyzeProject(projectId, accessToken!),
    enabled: !!accessToken && !!projectId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const analysis = healthData?.data;

  if (isLoading) {
    return (
      <Card className={cn('bg-[#131d2e] border-slate-700', className)}>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return (
      <Card className={cn('bg-[#131d2e] border-slate-700', className)}>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-3">
          <Activity className="h-8 w-8 text-slate-500" />
          <p className="text-slate-400 text-sm">Unable to analyze project</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-slate-600"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = STATUS_CONFIG[analysis.status] || STATUS_CONFIG.healthy;
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={cn('bg-[#131d2e] border-slate-700', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-400" />
            Project Health
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-8 w-8 p-0 text-slate-400 hover:text-white"
          >
            <RefreshCw
              className={cn('h-4 w-4', isFetching && 'animate-spin')}
            />
          </Button>
        </div>
        <p className="text-sm text-slate-400">{projectName}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Health Score */}
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'h-20 w-20 rounded-full flex items-center justify-center border-4',
              statusConfig.bg,
              statusConfig.border
            )}
          >
            <span className={cn('text-2xl font-bold', statusConfig.color)}>
              {analysis.healthScore}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon className={cn('h-5 w-5', statusConfig.color)} />
              <span className={cn('font-semibold', statusConfig.color)}>
                {statusConfig.label}
              </span>
            </div>
            <p className="text-sm text-slate-400">{analysis.assessment}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-white">
              {analysis.projectStats.totalTasks}
            </p>
            <p className="text-xs text-slate-400">Total Tasks</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-green-400">
              {analysis.projectStats.completedTasks}
            </p>
            <p className="text-xs text-slate-400">Completed</p>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 text-center">
            <p className="text-lg font-bold text-red-400">
              {analysis.projectStats.overdueTasks}
            </p>
            <p className="text-xs text-slate-400">Overdue</p>
          </div>
        </div>

        {/* Completion Rate */}
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-400">Completion Rate</span>
            <span className="text-white font-medium">
              {analysis.projectStats.completionRate}%
            </span>
          </div>
          <Progress
            value={Number(analysis.projectStats.completionRate)}
            className="h-2 bg-slate-700"
          />
        </div>

        {/* Risks */}
        {analysis.risks.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Risks Identified
            </h4>
            <ul className="space-y-1">
              {analysis.risks.slice(0, 3).map((risk, idx) => (
                <li
                  key={idx}
                  className="text-xs text-slate-400 bg-slate-800/50 px-3 py-2 rounded"
                >
                  {risk}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-purple-400" />
              AI Recommendations
            </h4>
            <ul className="space-y-1">
              {analysis.recommendations.slice(0, 3).map((rec, idx) => (
                <li
                  key={idx}
                  className="text-xs text-slate-400 bg-purple-500/10 px-3 py-2 rounded border border-purple-500/20"
                >
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ProjectHealthCard;
