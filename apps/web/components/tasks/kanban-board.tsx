'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu';
import { Task, Tag } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TaskWithTags extends Task {
  tags?: Array<{ tag: Tag }>;
  actualHours?: number;
}
import {
  Calendar,
  Edit,
  Trash2,
  Archive,
  ArrowRight,
  MessageSquare,
  AlertCircle,
  Clock,
  Play,
  Square,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDuration } from '@/lib/utils';

const STATUS_COLUMNS = [
  { id: 'TODO', label: 'To Do', color: 'bg-slate-500' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-500' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-500' },
  { id: 'COMPLETED', label: 'Completed', color: 'bg-emerald-500' },
];

const PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'bg-slate-500/20 text-slate-400' },
  { value: 'MEDIUM', label: 'Medium', color: 'bg-blue-500/20 text-blue-400' },
  { value: 'HIGH', label: 'High', color: 'bg-orange-500/20 text-orange-400' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-500/20 text-red-400' },
];

interface KanbanBoardProps {
  tasks: TaskWithTags[];
  onTaskClick: (taskId: string) => void;
  onTaskMove: (taskId: string, newStatus: string) => void;
  onTaskEdit: (taskId: string) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskArchive: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  activeTimerTaskId?: string | null;
  activeTimerEntryId?: string | null;
  onStartTimer?: (taskId: string) => void;
  onStopTimer?: (taskId: string, timeEntryId: string) => void;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

function getPriorityColor(priority: string) {
  return PRIORITIES.find((p) => p.value === priority)?.color || 'bg-gray-100 text-gray-700';
}

function isOverdue(dueDate?: string) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

function isDueSoon(dueDate?: string) {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const now = new Date();
  const threeDays = 3 * 24 * 60 * 60 * 1000;
  return due > now && due.getTime() - now.getTime() < threeDays;
}

function formatDueDate(dueDate?: string) {
  if (!dueDate) return null;
  const date = new Date(dueDate);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TaskCardProps {
  task: TaskWithTags;
  onTaskClick: (taskId: string) => void;
  onTaskEdit: (taskId: string) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskArchive: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  isDragging?: boolean;
  isTimerActive?: boolean;
  activeTimerEntryId?: string | null;
  onStartTimer?: (taskId: string) => void;
  onStopTimer?: (taskId: string, timeEntryId: string) => void;
}

function TaskCard({
  task,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onTaskArchive,
  onStatusChange,
  isDragging = false,
  isTimerActive = false,
  activeTimerEntryId,
  onStartTimer,
  onStopTimer,
}: TaskCardProps) {
  const overdue = isOverdue(task.dueDate);
  const dueSoon = isDueSoon(task.dueDate);

  const handleTimerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTimerActive && activeTimerEntryId) {
      onStopTimer?.(task.id, activeTimerEntryId);
    } else {
      onStartTimer?.(task.id);
    }
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card
          className={cn(
            'cursor-pointer hover:shadow-md transition-all bg-[#0a1628] border-slate-700',
            isDragging && 'opacity-50 shadow-lg rotate-2',
            overdue && 'border-red-500/50 bg-red-500/10',
            dueSoon && !overdue && 'border-amber-500/50 bg-amber-500/10',
            isTimerActive && 'ring-2 ring-emerald-500 border-emerald-500/50'
          )}
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick(task.id);
          }}
        >
          <CardContent className="p-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-medium text-sm line-clamp-2 flex-1 text-white">{task.title}</h4>
              <div className="flex items-center gap-1 shrink-0">
                {overdue && <AlertCircle className="h-4 w-4 text-red-400" />}
                {/* Timer Button */}
                {onStartTimer && onStopTimer && (
                  <Button
                    variant={isTimerActive ? 'destructive' : 'ghost'}
                    size="icon"
                    className={cn(
                      'h-6 w-6',
                      isTimerActive ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                    )}
                    onClick={handleTimerClick}
                    title={isTimerActive ? 'Stop Timer' : 'Start Timer'}
                  >
                    {isTimerActive ? (
                      <Square className="h-3 w-3" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {task.description && (
              <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                {task.description.replace(/<[^>]*>/g, '').slice(0, 80)}
              </p>
            )}

            {/* Tags */}
            {task.tags && task.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {task.tags.slice(0, 3).map(({ tag }) => (
                  <span
                    key={tag.id}
                    className="px-1.5 py-0.5 text-xs rounded"
                    style={{
                      backgroundColor: tag.color + '20',
                      color: tag.color,
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
                {task.tags.length > 3 && (
                  <span className="text-xs text-slate-500">+{task.tags.length - 3}</span>
                )}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={cn('text-xs', getPriorityColor(task.priority))}>
                  {task.priority}
                </Badge>
              </div>

              {task.assignee && (
                <Avatar className="h-6 w-6 border border-slate-600">
                  <AvatarImage src={task.assignee.avatar} />
                  <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {getInitials(task.assignee.name)}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>

            {/* Footer with metadata */}
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
              {task.dueDate && (
                <div className={cn(
                  'flex items-center gap-1',
                  overdue && 'text-red-400 font-medium',
                  dueSoon && !overdue && 'text-amber-400'
                )}>
                  <Calendar className="h-3 w-3" />
                  {formatDueDate(task.dueDate)}
                </div>
              )}

              {task.actualHours && task.actualHours > 0 && (
                <div className="flex items-center gap-1 text-blue-400">
                  <Clock className="h-3 w-3" />
                  {formatDuration(Math.round(task.actualHours * 60))}
                </div>
              )}

              {task._count?.comments && task._count.comments > 0 && (
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {task._count.comments}
                </div>
              )}

              {task._count?.subtasks && task._count.subtasks > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs">Subtasks: {task._count.subtasks}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-48 bg-[#131d2e] border-slate-700">
        <ContextMenuItem onClick={() => onTaskClick(task.id)} className="text-slate-300 focus:bg-slate-700 focus:text-white">
          <Edit className="mr-2 h-4 w-4" />
          View Details
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onTaskEdit(task.id)} className="text-slate-300 focus:bg-slate-700 focus:text-white">
          <Edit className="mr-2 h-4 w-4" />
          Edit Task
        </ContextMenuItem>
        <ContextMenuSeparator className="bg-slate-700" />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="text-slate-300 focus:bg-slate-700 focus:text-white">
            <ArrowRight className="mr-2 h-4 w-4" />
            Move to
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-40 bg-[#131d2e] border-slate-700">
            {STATUS_COLUMNS.filter(s => s.id !== task.status).map((status) => (
              <ContextMenuItem
                key={status.id}
                onClick={() => onStatusChange(task.id, status.id)}
                className="text-slate-300 focus:bg-slate-700 focus:text-white"
              >
                <div className={cn('h-2 w-2 rounded-full mr-2', status.color)} />
                {status.label}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator className="bg-slate-700" />
        <ContextMenuItem onClick={() => onTaskArchive(task.id)} className="text-slate-300 focus:bg-slate-700 focus:text-white">
          <Archive className="mr-2 h-4 w-4" />
          Archive
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => onTaskDelete(task.id)}
          className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

function SortableTaskCard(props: TaskCardProps & { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard {...props} isDragging={isDragging} />
    </div>
  );
}

interface KanbanColumnProps {
  column: { id: string; label: string; color: string };
  tasks: TaskWithTags[];
  onTaskClick: (taskId: string) => void;
  onTaskEdit: (taskId: string) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskArchive: (taskId: string) => void;
  onStatusChange: (taskId: string, newStatus: string) => void;
  isOver?: boolean;
  activeTimerTaskId?: string | null;
  activeTimerEntryId?: string | null;
  onStartTimer?: (taskId: string) => void;
  onStopTimer?: (taskId: string, timeEntryId: string) => void;
}

function KanbanColumn({
  column,
  tasks,
  onTaskClick,
  onTaskEdit,
  onTaskDelete,
  onTaskArchive,
  onStatusChange,
  isOver = false,
  activeTimerTaskId,
  activeTimerEntryId,
  onStartTimer,
  onStopTimer,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col rounded-xl bg-[#131d2e] border border-slate-700/50 p-3 min-h-[500px] transition-colors',
        isOver && 'bg-blue-500/10 ring-2 ring-blue-400'
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <div className={cn('h-3 w-3 rounded-full', column.color)} />
        <h3 className="font-medium text-sm text-white">{column.label}</h3>
        <span className="text-xs text-slate-400 bg-slate-700 px-1.5 py-0.5 rounded">
          {tasks.length}
        </span>
      </div>

      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 overflow-y-auto">
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              id={task.id}
              task={task}
              onTaskClick={onTaskClick}
              onTaskEdit={onTaskEdit}
              onTaskDelete={onTaskDelete}
              onTaskArchive={onTaskArchive}
              onStatusChange={onStatusChange}
              isTimerActive={activeTimerTaskId === task.id}
              activeTimerEntryId={activeTimerEntryId}
              onStartTimer={onStartTimer}
              onStopTimer={onStopTimer}
            />
          ))}
          {tasks.length === 0 && (
            <div className={cn(
              'flex items-center justify-center h-24 text-sm text-slate-500 border-2 border-dashed border-slate-700 rounded-lg transition-colors',
              isOver && 'border-blue-400 bg-blue-500/10 text-blue-400'
            )}>
              {isOver ? 'Drop here' : 'Drop tasks here'}
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function KanbanBoard({
  tasks,
  onTaskClick,
  onTaskMove,
  onTaskEdit,
  onTaskDelete,
  onTaskArchive,
  onStatusChange,
  activeTimerTaskId,
  activeTimerEntryId,
  onStartTimer,
  onStopTimer,
}: KanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeColumn, setActiveColumn] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getTasksByStatus = (status: string) => {
    return tasks
      .filter((t) => t.status === status)
      .sort((a, b) => a.position - b.position);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;

    if (!over) {
      setActiveColumn(null);
      return;
    }

    // Check if hovering over a column
    const column = STATUS_COLUMNS.find((c) => c.id === over.id);
    if (column) {
      setActiveColumn(column.id);
      return;
    }

    // Check if hovering over a task - get its column
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask) {
      setActiveColumn(overTask.status);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setActiveColumn(null);

    if (!over) return;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask) return;

    // Check if dropped on a column (status)
    const column = STATUS_COLUMNS.find((c) => c.id === over.id);
    if (column) {
      if (draggedTask.status !== column.id) {
        onTaskMove(draggedTask.id, column.id);
      }
      return;
    }

    // Check if dropped on another task
    const overTask = tasks.find((t) => t.id === over.id);
    if (overTask && draggedTask.status !== overTask.status) {
      onTaskMove(draggedTask.id, overTask.status);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="grid gap-4 md:grid-cols-4">
        {STATUS_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            tasks={getTasksByStatus(column.id)}
            onTaskClick={onTaskClick}
            onTaskEdit={onTaskEdit}
            onTaskDelete={onTaskDelete}
            onTaskArchive={onTaskArchive}
            onStatusChange={onStatusChange}
            isOver={activeColumn === column.id}
            activeTimerTaskId={activeTimerTaskId}
            activeTimerEntryId={activeTimerEntryId}
            onStartTimer={onStartTimer}
            onStopTimer={onStopTimer}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask && (
          <TaskCard
            task={activeTask}
            onTaskClick={() => {}}
            onTaskEdit={() => {}}
            onTaskDelete={() => {}}
            onTaskArchive={() => {}}
            onStatusChange={() => {}}
            isDragging
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
