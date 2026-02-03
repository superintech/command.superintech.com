'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { projectsApi, tasksApi } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  Search,
  FolderKanban,
  CheckSquare,
  ArrowRight,
  X,
  Loader2,
} from 'lucide-react';

interface Project {
  id: string;
  name: string;
  status: string;
  description?: string;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  project?: {
    id: string;
    name: string;
  };
}

export function GlobalSearch() {
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch projects
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  // Fetch tasks
  const { data: tasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const isLoading = projectsLoading || tasksLoading;
  const projects: Project[] = projectsData?.data || [];
  const tasks: Task[] = tasksData?.data || [];

  // Filter results based on query
  const filteredProjects = query.length >= 2
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  const filteredTasks = query.length >= 2
    ? tasks.filter((t) =>
        t.title.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  const totalResults = filteredProjects.length + filteredTasks.length;
  const hasResults = totalResults > 0;

  // Combined results for keyboard navigation
  const allResults = [
    ...filteredProjects.map((p) => ({ type: 'project' as const, item: p })),
    ...filteredTasks.map((t) => ({ type: 'task' as const, item: t })),
  ];

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < allResults.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && allResults[selectedIndex]) {
          handleSelect(allResults[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setQuery('');
        inputRef.current?.blur();
        break;
    }
  };

  const handleSelect = (result: { type: 'project' | 'task'; item: Project | Task }) => {
    if (result.type === 'project') {
      router.push(`/dashboard/projects/${result.item.id}`);
    } else {
      router.push(`/dashboard/tasks?taskId=${result.item.id}`);
    }
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(-1);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setSelectedIndex(-1);
  };

  const handleFocus = () => {
    if (query.length >= 2) {
      setIsOpen(true);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'COMPLETED':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'IN_PROGRESS':
        return 'bg-amber-500/20 text-amber-400';
      case 'PLANNING':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search projects and tasks..."
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          className="w-full bg-[#131d2e] border-slate-700 text-white placeholder:text-slate-500 pl-10 pr-10 h-10 rounded-lg focus:border-blue-500 focus:ring-blue-500/20"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#131d2e] border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 text-blue-400 animate-spin" />
            </div>
          ) : !hasResults ? (
            <div className="py-8 text-center">
              <Search className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No results found for &quot;{query}&quot;</p>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              {/* Projects Section */}
              {filteredProjects.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <FolderKanban className="h-3 w-3" />
                      Projects ({filteredProjects.length})
                    </p>
                  </div>
                  {filteredProjects.map((project, index) => (
                    <div
                      key={project.id}
                      className={cn(
                        'flex items-center justify-between px-4 py-3 cursor-pointer transition-colors',
                        selectedIndex === index
                          ? 'bg-blue-500/20'
                          : 'hover:bg-slate-800'
                      )}
                      onClick={() => handleSelect({ type: 'project', item: project })}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                          <FolderKanban className="h-4 w-4 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-medium truncate">{project.name}</p>
                          {project.description && (
                            <p className="text-xs text-slate-500 truncate">{project.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-3">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-medium',
                          getStatusColor(project.status)
                        )}>
                          {project.status}
                        </span>
                        <ArrowRight className="h-4 w-4 text-slate-500" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks Section */}
              {filteredTasks.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
                    <p className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <CheckSquare className="h-3 w-3" />
                      Tasks ({filteredTasks.length})
                    </p>
                  </div>
                  {filteredTasks.map((task, index) => {
                    const resultIndex = filteredProjects.length + index;
                    return (
                      <div
                        key={task.id}
                        className={cn(
                          'flex items-center justify-between px-4 py-3 cursor-pointer transition-colors',
                          selectedIndex === resultIndex
                            ? 'bg-blue-500/20'
                            : 'hover:bg-slate-800'
                        )}
                        onClick={() => handleSelect({ type: 'task', item: task })}
                        onMouseEnter={() => setSelectedIndex(resultIndex)}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0">
                            <CheckSquare className="h-4 w-4 text-emerald-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{task.title}</p>
                            {task.project && (
                              <p className="text-xs text-slate-500 truncate">
                                {task.project.name}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-3">
                          <span className={cn(
                            'px-2 py-0.5 rounded text-[10px] font-medium',
                            getStatusColor(task.status)
                          )}>
                            {task.status.replace('_', ' ')}
                          </span>
                          <ArrowRight className="h-4 w-4 text-slate-500" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* View All Results */}
              {totalResults > 0 && (
                <div className="px-4 py-3 border-t border-slate-700 bg-slate-800/30">
                  <p className="text-xs text-slate-500 text-center">
                    Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Enter</kbd> to select,{' '}
                    <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">↑</kbd>{' '}
                    <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">↓</kbd> to navigate,{' '}
                    <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">Esc</kbd> to close
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
