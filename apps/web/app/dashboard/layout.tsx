'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GlobalSearch } from '@/components/global-search';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FolderKanban,
  CheckSquare,
  MessageSquare,
  FileText,
  BarChart3,
  LogOut,
  Menu,
  X,
  User,
  ChevronLeft,
  Plus,
  Sparkles,
  Home,
} from 'lucide-react';
import { TimerIndicator } from '@/components/timer-indicator';
import { NotificationsDropdown } from '@/components/notifications-dropdown';
import { ChatNotificationProvider } from '@/components/chat/chat-notification-provider';
import { AIChatBot } from '@/components/ai';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Projects', href: '/dashboard/projects', icon: FolderKanban, permissions: ['projects.view'] },
  { name: 'Tasks', href: '/dashboard/tasks', icon: CheckSquare, permissions: ['tasks.view'] },
  { name: 'Message', href: '/dashboard/chat', icon: MessageSquare },
  { name: 'Files', href: '/dashboard/files', icon: FileText, permissions: ['files.view'] },
  { name: 'Reports', href: '/dashboard/reports', icon: BarChart3, permissions: ['reports.view'] },
];

// Map routes to page titles
const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/projects': 'Projects',
  '/dashboard/tasks': 'Tasks',
  '/dashboard/team': 'Team',
  '/dashboard/chat': 'Message',
  '/dashboard/files': 'Files',
  '/dashboard/reports': 'Reports',
  '/dashboard/activity': 'Activity',
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout, hasAnyPermission, fetchPermissions, permissions } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Get current page title
  const getCurrentPageTitle = () => {
    for (const [path, title] of Object.entries(pageTitles)) {
      if (pathname === path || (path !== '/dashboard' && pathname.startsWith(path))) {
        return title;
      }
    }
    return 'Dashboard';
  };

  // Check if a navigation item is active
  const isActiveLink = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(href);
  };

  // Fetch permissions on mount if authenticated
  useEffect(() => {
    if (isAuthenticated && permissions.length === 0) {
      fetchPermissions();
    }
  }, [isAuthenticated, permissions.length, fetchPermissions]);

  // Filter navigation based on permissions
  const filteredNavigation = navigation.filter((item) => {
    if (!('permissions' in item) || !item.permissions?.length) return true;
    if (user?.role === 'ADMIN') return true;
    return hasAnyPermission(item.permissions);
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a1628]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <ChatNotificationProvider>
      <div className="flex h-screen overflow-hidden bg-[#0a1628]">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0a1628] border-r border-slate-700/50 transition-all duration-300 ease-in-out lg:static',
            sidebarCollapsed ? 'w-20' : 'w-64',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          {/* Logo Section */}
          <div className={cn(
            'flex h-16 items-center justify-between px-4 border-b border-slate-700/50',
            sidebarCollapsed && 'justify-center px-2'
          )}>
            <Link href="/dashboard" className="flex items-center gap-3">
              {/* SIT Logo */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 shadow-lg shadow-cyan-500/20">
                <span className="text-sm font-bold text-white tracking-tight">SIT</span>
              </div>
              {!sidebarCollapsed && (
                <span className="font-semibold text-white text-lg">Super In Tech</span>
              )}
            </Link>
            {!sidebarCollapsed && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white lg:flex hidden"
                onClick={() => setSidebarCollapsed(true)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Expand button when collapsed */}
          {sidebarCollapsed && (
            <div className="flex justify-center py-2 border-b border-slate-700/50">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => setSidebarCollapsed(false)}
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </Button>
            </div>
          )}

          {/* Navigation */}
          <nav className={cn(
            'flex-1 overflow-y-auto py-4',
            sidebarCollapsed ? 'px-2' : 'px-3'
          )}>
            <div className="space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = isActiveLink(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative',
                      sidebarCollapsed && 'justify-center px-2',
                      isActive
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                    )}
                    onClick={() => setSidebarOpen(false)}
                    title={sidebarCollapsed ? item.name : undefined}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
                    )}
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!sidebarCollapsed && item.name}
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Bottom Card - Let's start! */}
          {!sidebarCollapsed && (
            <div className="p-4">
              <div className="bg-[#131d2e] rounded-xl p-4 text-center">
                <h3 className="text-white font-semibold mb-1">Let&apos;s start!</h3>
                <p className="text-slate-400 text-xs mb-4">
                  Creating or adding new tasks couldn&apos;t be easier
                </p>
                <Button
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={() => router.push('/dashboard/tasks')}
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Improvements
                </Button>
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <header className="flex h-16 items-center justify-between bg-[#0a1628] border-b border-slate-700/50 px-6">
            {/* Left - Menu button (mobile) and Page Title */}
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden text-white"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Home className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-white font-semibold text-lg">{getCurrentPageTitle()}</span>
              </div>
            </div>

            {/* Center - Search */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <GlobalSearch />
            </div>

            {/* Right - Actions */}
            <div className="flex items-center gap-3">
              <TimerIndicator />

              {/* New Project Button */}
              <Button
                variant="outline"
                className="hidden sm:flex border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-400"
                onClick={() => router.push('/dashboard/projects')}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>

              {/* New Task Button */}
              <Button
                className="hidden sm:flex bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => router.push('/dashboard/tasks')}
              >
                <Plus className="h-4 w-4 mr-2" />
                New Task
              </Button>

              {/* Notifications */}
              <NotificationsDropdown />

              {/* User Avatar */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                    <Avatar className="h-10 w-10 border-2 border-slate-600">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-gradient-to-br from-amber-400 to-orange-500 text-white font-medium">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-[#131d2e] border-slate-700 text-white" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-white">{user.name}</p>
                      <p className="text-xs leading-none text-slate-400">{user.email}</p>
                      <p className="text-xs leading-none text-blue-400 font-medium mt-1">{user.role}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <DropdownMenuItem asChild className="text-slate-300 focus:bg-slate-700 focus:text-white">
                    <Link href="/dashboard/team" className="flex items-center cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-slate-700" />
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-red-400 focus:bg-red-500/10 focus:text-red-400"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-y-auto p-6 bg-[#0a1628]">{children}</main>
        </div>
      </div>

      {/* AI Chat Bot - Floating */}
      <AIChatBot />
    </ChatNotificationProvider>
  );
}
