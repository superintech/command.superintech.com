'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth-store';
import { projectsApi, departmentsApi, tasksApi, Project } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  FolderKanban,
  Edit,
  Trash2,
  Archive,
  Eye,
  X,
  Users,
  CheckSquare,
} from 'lucide-react';

export default function ProjectsPage() {
  const router = useRouter();
  const { accessToken, hasPermission } = useAuthStore();
  const canCreateProjects = hasPermission('projects.create');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProject, setNewProject] = useState({ name: '', description: '', departmentId: '' });

  const { data: projectsData, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: tasksData } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(accessToken!),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Project>) => projectsApi.create(data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowCreateForm(false);
      setNewProject({ name: '', description: '', departmentId: '' });
      toast({ title: 'Project created successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to create project', variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) =>
      projectsApi.update(id, data, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingProject(null);
      toast({ title: 'Project updated' });
    },
    onError: () => {
      toast({ title: 'Failed to update project', variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => projectsApi.delete(id, accessToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setProjectToDelete(null);
      toast({ title: 'Project deleted' });
    },
    onError: () => {
      toast({ title: 'Failed to delete project', variant: 'destructive' });
    },
  });

  const projects = projectsData?.data || [];
  const tasks = tasksData?.data || [];
  const departments = departmentsData?.data || [];

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate project progress based on completed tasks
  const getProjectProgress = (projectId: string) => {
    const projectTasks = tasks.filter((t) => t.projectId === projectId);
    if (projectTasks.length === 0) return 0;
    const completedTasks = projectTasks.filter((t) => t.status === 'COMPLETED').length;
    return Math.round((completedTasks / projectTasks.length) * 100);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name || !newProject.departmentId) {
      toast({ title: 'Please fill in required fields', variant: 'destructive' });
      return;
    }
    createMutation.mutate(newProject);
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    updateMutation.mutate({
      id: editingProject.id,
      data: {
        name: editingProject.name,
        description: editingProject.description,
        status: editingProject.status,
      },
    });
  };

  const handleArchive = (projectId: string) => {
    updateMutation.mutate({
      id: projectId,
      data: { status: 'CANCELLED' },
    });
    toast({ title: 'Project archived' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-emerald-400 bg-emerald-500/20">
            ACTIVE
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-blue-400 bg-blue-500/20">
            COMPLETED
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-amber-400 bg-amber-500/20">
            ON HOLD
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-red-400 bg-red-500/20">
            CANCELLED
            <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
          </span>
        );
      case 'PLANNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-purple-400 bg-purple-500/20">
            PLANNING
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 bg-slate-500/20">
            {status}
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
          </span>
        );
    }
  };

  // Stats
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
  const completedProjects = projects.filter((p) => p.status === 'COMPLETED').length;
  const totalTasks = tasks.length;

  return (
    <div className="min-h-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-slate-400 mt-1">Manage your team projects</p>
        </div>
        {canCreateProjects && (
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 tracking-wider uppercase">Total Projects</p>
              <p className="text-2xl font-bold text-white">{String(projects.length).padStart(2, '0')}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 tracking-wider uppercase">Active</p>
              <p className="text-2xl font-bold text-white">{String(activeProjects).padStart(2, '0')}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 tracking-wider uppercase">Completed</p>
              <p className="text-2xl font-bold text-white">{String(completedProjects).padStart(2, '0')}</p>
            </div>
          </div>
        </div>
        <div className="bg-[#131d2e] rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-400 tracking-wider uppercase">Total Tasks</p>
              <p className="text-2xl font-bold text-white">{String(totalTasks).padStart(2, '0')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && canCreateProjects && (
        <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Create New Project</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCreateForm(false)}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-slate-300">Project Name *</Label>
                <Input
                  id="name"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="Enter project name"
                  className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department" className="text-slate-300">Department *</Label>
                <select
                  id="department"
                  value={newProject.departmentId}
                  onChange={(e) => setNewProject({ ...newProject, departmentId: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="" className="bg-[#0a1628]">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id} className="bg-[#0a1628]">
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description" className="text-slate-300">Description</Label>
              <Input
                id="description"
                value={newProject.description}
                onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                placeholder="Enter project description"
                className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={createMutation.isPending} className="bg-blue-500 hover:bg-blue-600">
                {createMutation.isPending ? 'Creating...' : 'Create Project'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateForm(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Project Form */}
      {editingProject && (
        <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Edit Project</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditingProject(null)}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name" className="text-slate-300">Project Name *</Label>
                <Input
                  id="edit-name"
                  value={editingProject.name}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, name: e.target.value })
                  }
                  placeholder="Enter project name"
                  className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-status" className="text-slate-300">Status</Label>
                <select
                  id="edit-status"
                  value={editingProject.status}
                  onChange={(e) =>
                    setEditingProject({ ...editingProject, status: e.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-slate-700 bg-[#0a1628] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="PLANNING" className="bg-[#0a1628]">Planning</option>
                  <option value="ACTIVE" className="bg-[#0a1628]">Active</option>
                  <option value="ON_HOLD" className="bg-[#0a1628]">On Hold</option>
                  <option value="COMPLETED" className="bg-[#0a1628]">Completed</option>
                  <option value="CANCELLED" className="bg-[#0a1628]">Cancelled</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description" className="text-slate-300">Description</Label>
              <Input
                id="edit-description"
                value={editingProject.description || ''}
                onChange={(e) =>
                  setEditingProject({ ...editingProject, description: e.target.value })
                }
                placeholder="Enter project description"
                className="bg-[#0a1628] border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={updateMutation.isPending} className="bg-blue-500 hover:bg-blue-600">
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingProject(null)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-[#131d2e] border-slate-700 text-white placeholder:text-slate-500 focus:border-blue-500"
        />
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Skeleton className="h-5 w-32 bg-slate-700 mb-2" />
                  <Skeleton className="h-4 w-24 bg-slate-700" />
                </div>
                <Skeleton className="h-5 w-16 bg-slate-700 rounded" />
              </div>
              <Skeleton className="h-4 w-full bg-slate-700 mb-4" />
              <Skeleton className="h-2 w-full bg-slate-700 mb-4" />
              <div className="flex justify-between">
                <Skeleton className="h-4 w-16 bg-slate-700" />
                <Skeleton className="h-4 w-16 bg-slate-700" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
              <FolderKanban className="h-8 w-8 text-slate-600" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No projects found</h3>
            <p className="text-sm text-slate-400 mb-4">
              {search ? 'Try a different search term' : 'Get started by creating your first project'}
            </p>
            {!search && canCreateProjects && (
              <Button onClick={() => setShowCreateForm(true)} className="bg-blue-500 hover:bg-blue-600">
                <Plus className="mr-2 h-4 w-4" />
                Create Project
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const progress = getProjectProgress(project.id);
            const projectTasks = tasks.filter((t) => t.projectId === project.id);
            return (
              <ContextMenu key={project.id}>
                <ContextMenuTrigger>
                  <div
                    className="bg-[#131d2e] rounded-xl border border-slate-700/50 p-5 hover:bg-[#1a2942] cursor-pointer transition-all duration-200 hover:border-slate-600"
                    onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-white mb-1">{project.name}</h3>
                        <p className="text-sm text-slate-400">{project.department?.name}</p>
                      </div>
                      {getStatusBadge(project.status)}
                    </div>

                    {project.description && (
                      <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                        {project.description}
                      </p>
                    )}

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-slate-400 mb-2">
                        <span>Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-1.5 bg-slate-700" />
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-400">
                      <div className="flex items-center gap-1">
                        <CheckSquare className="h-4 w-4" />
                        <span>{projectTasks.length} tasks</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>
                          {project.members?.length || 0} member
                          {(project.members?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </ContextMenuTrigger>

                <ContextMenuContent className="w-48 bg-[#131d2e] border-slate-700">
                  <ContextMenuItem
                    onClick={() => router.push(`/dashboard/projects/${project.id}`)}
                    className="text-slate-300 focus:bg-slate-700 focus:text-white"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingProject(project);
                    }}
                    className="text-slate-300 focus:bg-slate-700 focus:text-white"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Project
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-slate-700" />
                  <ContextMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleArchive(project.id);
                    }}
                    className="text-slate-300 focus:bg-slate-700 focus:text-white"
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </ContextMenuItem>
                  <ContextMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectToDelete(project.id);
                    }}
                    className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
        title="Delete Project"
        description="Are you sure you want to delete this project? This will also delete all tasks, files, and comments associated with it. This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => projectToDelete && deleteMutation.mutate(projectToDelete)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
