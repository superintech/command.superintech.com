const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface ApiOptions extends RequestInit {
  token?: string;
}

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(data.error || 'Request failed', response.status, data);
  }

  return data;
}

export const api = {
  get: <T>(endpoint: string, token?: string) =>
    request<T>(endpoint, { method: 'GET', token }),

  post: <T>(endpoint: string, body: unknown, token?: string) =>
    request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      token,
    }),

  patch: <T>(endpoint: string, body: unknown, token?: string) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    }),

  delete: <T>(endpoint: string, token?: string) =>
    request<T>(endpoint, { method: 'DELETE', token }),

  uploadFiles: async <T>(endpoint: string, formData: FormData, token?: string): Promise<T> => {
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // Note: Don't set Content-Type for FormData, browser will set it with boundary

    const response = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(data.error || 'Upload failed', response.status, data);
    }

    return data;
  },
};

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{
      success: boolean;
      data: {
        user: User;
        accessToken: string;
        refreshToken: string;
      };
    }>('/api/auth/login', { email, password }),

  refresh: (refreshToken: string) =>
    api.post<{
      success: boolean;
      data: {
        accessToken: string;
        refreshToken: string;
      };
    }>('/api/auth/refresh', { refreshToken }),

  logout: (refreshToken: string, token: string) =>
    api.post('/api/auth/logout', { refreshToken }, token),

  me: (token: string) =>
    api.get<{ success: boolean; data: User }>('/api/auth/me', token),
};

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
  departmentId: string | null;
  avatar?: string;
  phone?: string;
  designation?: string;
  joinDate?: string;
  visibilityScope?: 'TEAM_ONLY' | 'DEPARTMENT' | 'ALL';
  isActive: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  department?: {
    id: string;
    name: string;
    code: string;
  };
  teamMembers?: TeamMember[];
  effectivePermissions?: string[];
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  isActive: boolean;
  createdAt: string;
  manager?: {
    id: string;
    name: string;
    avatar?: string;
  };
  members?: TeamMember[];
  _count?: {
    members: number;
  };
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'MEMBER' | 'LEAD';
  joinedAt: string;
  team?: Team;
  user?: {
    id: string;
    name: string;
    avatar?: string;
    email?: string;
    role?: string;
    designation?: string;
  };
}

export interface Permission {
  id: string;
  code: string;
  name: string;
  description?: string;
  category: string;
}

export interface UserInvitation {
  id: string;
  email: string;
  name?: string;
  role: string;
  departmentId?: string;
  teamIds: string[];
  token: string;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  invitedBy?: {
    name: string;
    email: string;
  };
}

export interface UserProfile {
  id: string;
  userId: string;
  dateOfBirth?: string;
  gender?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  employeeId?: string;
  salary?: number;
  salaryFrequency?: string;
  bankName?: string;
  bankAccount?: string;
  taxId?: string;
  skills?: string[];
  qualifications?: any;
  documents?: any[];
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  ownerId: string;
  departmentId: string;
  owner?: {
    id: string;
    name: string;
    avatar?: string;
  };
  department?: {
    id: string;
    name: string;
    code: string;
  };
  members?: Array<{
    user: {
      id: string;
      name: string;
      avatar?: string;
      role?: string;
    };
  }>;
  _count?: {
    tasks: number;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectId: string;
  assigneeId?: string;
  reporterId: string;
  dueDate?: string;
  estimatedHours?: number;
  actualHours?: number;
  position: number;
  project?: {
    id: string;
    name: string;
  };
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  reporter?: {
    id: string;
    name: string;
    avatar?: string;
  };
  _count?: {
    comments: number;
    subtasks: number;
    timeEntries?: number;
  };
}

// Projects API
export const projectsApi = {
  list: (token: string) =>
    api.get<{ success: boolean; data: Project[] }>('/api/projects', token),

  get: (id: string, token: string) =>
    api.get<{ success: boolean; data: Project }>(`/api/projects/${id}`, token),

  create: (data: Partial<Project>, token: string) =>
    api.post<{ success: boolean; data: Project }>('/api/projects', data, token),

  update: (id: string, data: Partial<Project>, token: string) =>
    api.patch<{ success: boolean; data: Project }>(`/api/projects/${id}`, data, token),

  delete: (id: string, token: string) =>
    api.delete(`/api/projects/${id}`, token),
};

// Tasks API
export const tasksApi = {
  list: (token: string, params?: { projectId?: string; status?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<{ success: boolean; data: Task[] }>(`/api/tasks${query ? `?${query}` : ''}`, token);
  },

  get: (id: string, token: string) =>
    api.get<{ success: boolean; data: Task }>(`/api/tasks/${id}`, token),

  create: (data: Partial<Task>, token: string) =>
    api.post<{ success: boolean; data: Task }>('/api/tasks', data, token),

  update: (id: string, data: Partial<Task>, token: string) =>
    api.patch<{ success: boolean; data: Task }>(`/api/tasks/${id}`, data, token),

  delete: (id: string, token: string) =>
    api.delete(`/api/tasks/${id}`, token),

  reorder: (tasks: Array<{ id: string; position: number; status?: string }>, token: string) =>
    api.post('/api/tasks/reorder', { tasks }, token),

  // Timer functions
  startTimer: (taskId: string, token: string) =>
    api.post<{ success: boolean; data: TimeEntry }>(`/api/tasks/${taskId}/timer/start`, {}, token),

  stopTimer: (taskId: string, timeEntryId: string, token: string) =>
    api.post<{ success: boolean; data: TimeEntry }>(`/api/tasks/${taskId}/timer/${timeEntryId}/stop`, {}, token),

  getActiveTimer: (token: string) =>
    api.get<{ success: boolean; data: TimeEntry | null }>('/api/tasks/timer/active', token),
};

// Time Entry type
export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  description: string | null;
  task?: Task;
}

// Users API
export const usersApi = {
  list: (token: string, params?: { teamId?: string; departmentId?: string; role?: string; status?: string; search?: string }) => {
    const query = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
    return api.get<{ success: boolean; data: User[] }>(`/api/users${query ? `?${query}` : ''}`, token);
  },

  get: (id: string, token: string) =>
    api.get<{ success: boolean; data: User }>(`/api/users/${id}`, token),

  create: (data: Partial<User> & { password?: string; teamIds?: string[] }, token: string) =>
    api.post<{ success: boolean; data: User }>('/api/users', data, token),

  update: (id: string, data: Partial<User>, token: string) =>
    api.patch<{ success: boolean; data: User }>(`/api/users/${id}`, data, token),

  delete: (id: string, token: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/users/${id}`, token),

  // Profile
  getProfile: (id: string, token: string) =>
    api.get<{ success: boolean; data: UserProfile | null }>(`/api/users/${id}/profile`, token),

  updateProfile: (id: string, data: Partial<UserProfile>, token: string) =>
    api.patch<{ success: boolean; data: UserProfile }>(`/api/users/${id}/profile`, data, token),

  // Permissions
  getMyPermissions: (token: string) =>
    api.get<{ success: boolean; data: string[] }>('/api/users/me/permissions', token),

  updatePermissions: (id: string, permissions: Array<{ permissionId: string; granted: boolean }>, token: string) =>
    api.patch<{ success: boolean; message: string }>(`/api/users/${id}/permissions`, { permissions }, token),

  // User teams
  updateTeams: (id: string, teamIds: string[], token: string) =>
    api.patch<{ success: boolean; data: TeamMember[] }>(`/api/users/${id}/teams`, { teamIds }, token),

  // Password reset (Admin only)
  resetPassword: (id: string, password: string, token: string) =>
    api.post<{ success: boolean; message: string }>(`/api/users/${id}/reset-password`, { password }, token),
};

// Teams API
export const teamsApi = {
  list: (token: string) =>
    api.get<{ success: boolean; data: Team[] }>('/api/users/teams', token),

  get: (id: string, token: string) =>
    api.get<{ success: boolean; data: Team }>(`/api/users/teams/${id}`, token),

  create: (data: { name: string; description?: string; managerId?: string; memberIds?: string[] }, token: string) =>
    api.post<{ success: boolean; data: Team }>('/api/users/teams', data, token),

  update: (id: string, data: Partial<Team>, token: string) =>
    api.patch<{ success: boolean; data: Team }>(`/api/users/teams/${id}`, data, token),

  delete: (id: string, token: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/users/teams/${id}`, token),

  addMember: (teamId: string, memberId: string, role: string = 'MEMBER', token: string) =>
    api.post<{ success: boolean; data: TeamMember }>(`/api/users/teams/${teamId}/members`, { memberId, role }, token),

  removeMember: (teamId: string, memberId: string, token: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/users/teams/${teamId}/members/${memberId}`, token),
};

// Invitations API
export const invitationsApi = {
  list: (token: string, status?: string) => {
    const query = status ? `?status=${status}` : '';
    return api.get<{ success: boolean; data: UserInvitation[] }>(`/api/users/invitations${query}`, token);
  },

  send: (data: { email: string; name?: string; role?: string; departmentId?: string; teamIds?: string[] }, token: string) =>
    api.post<{ success: boolean; data: UserInvitation; inviteUrl: string }>('/api/users/invitations', data, token),

  resend: (id: string, token: string) =>
    api.post<{ success: boolean; data: UserInvitation; inviteUrl: string }>(`/api/users/invitations/${id}/resend`, {}, token),

  cancel: (id: string, token: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/users/invitations/${id}`, token),

  // Public endpoints (no token required)
  getByToken: (token: string) =>
    api.get<{ success: boolean; data: UserInvitation }>(`/api/users/invite/${token}`),

  accept: (token: string, data: { password: string; name?: string }) =>
    api.post<{ success: boolean; message: string }>(`/api/users/invite/${token}/accept`, data),
};

// Permissions API
export const permissionsApi = {
  list: (token: string) =>
    api.get<{ success: boolean; data: { permissions: Permission[]; grouped: Record<string, Permission[]> } }>('/api/users/permissions', token),
};

// Departments API
export const departmentsApi = {
  list: (token: string) =>
    api.get<{ success: boolean; data: Array<{ id: string; name: string; code: string }> }>(
      '/api/departments',
      token
    ),
};

// Tags API
export interface Tag {
  id: string;
  name: string;
  color: string;
  projectId: string;
  _count?: {
    tasks: number;
  };
}

export const tagsApi = {
  list: (token: string, projectId?: string) => {
    const query = projectId ? `?projectId=${projectId}` : '';
    return api.get<{ success: boolean; data: Tag[] }>(`/api/tags${query}`, token);
  },

  create: (data: { name: string; color?: string; projectId: string }, token: string) =>
    api.post<{ success: boolean; data: Tag }>('/api/tags', data, token),

  update: (id: string, data: { name?: string; color?: string }, token: string) =>
    api.patch<{ success: boolean; data: Tag }>(`/api/tags/${id}`, data, token),

  delete: (id: string, token: string) =>
    api.delete(`/api/tags/${id}`, token),

  addToTask: (taskId: string, tagId: string, token: string) =>
    api.post(`/api/tags/tasks/${taskId}/tags/${tagId}`, {}, token),

  removeFromTask: (taskId: string, tagId: string, token: string) =>
    api.delete(`/api/tags/tasks/${taskId}/tags/${tagId}`, token),
};

// Activity API
export interface ActivityLog {
  id: string;
  entityType: 'PROJECT' | 'TASK' | 'COMMENT' | 'FILE';
  entityId: string;
  action: string;
  userId: string;
  projectId?: string;
  taskId?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export const activityApi = {
  getFeed: (token: string, limit?: number) =>
    api.get<{ success: boolean; data: ActivityLog[] }>(
      `/api/activity/feed${limit ? `?limit=${limit}` : ''}`,
      token
    ),

  getProjectActivity: (projectId: string, token: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return api.get<{ success: boolean; data: ActivityLog[]; total: number }>(
      `/api/activity/project/${projectId}${query ? `?${query}` : ''}`,
      token
    );
  },

  getTaskActivity: (taskId: string, token: string, limit?: number, offset?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());
    const query = params.toString();
    return api.get<{ success: boolean; data: ActivityLog[]; total: number }>(
      `/api/activity/task/${taskId}${query ? `?${query}` : ''}`,
      token
    );
  },

  getMyActivity: (token: string, limit?: number) =>
    api.get<{ success: boolean; data: ActivityLog[] }>(
      `/api/activity/me${limit ? `?limit=${limit}` : ''}`,
      token
    ),
};

// Files API
export interface FileAttachment {
  id: string;
  name: string;
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  taskId?: string;
  projectId?: string;
  uploaderId: string;
  createdAt: string;
  uploader?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface FileShare {
  id: string;
  code: string;
  fileId: string;
  createdById: string;
  expiresAt?: string;
  password?: string;
  downloadCount: number;
  maxDownloads?: number;
  isActive: boolean;
  createdAt: string;
  shareUrl: string;
  file?: {
    originalName: string;
    size: number;
    mimeType: string;
  };
}

export const filesApi = {
  list: (token: string, params?: { taskId?: string; projectId?: string }) => {
    const query = new URLSearchParams(params as Record<string, string>).toString();
    return api.get<{ success: boolean; data: FileAttachment[] }>(`/api/files${query ? `?${query}` : ''}`, token);
  },

  get: (id: string, token: string) =>
    api.get<{ success: boolean; data: FileAttachment }>(`/api/files/${id}`, token),

  delete: (id: string, token: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/files/${id}`, token),

  getDownloadUrl: (id: string) =>
    `${API_URL}/api/files/${id}/download`,

  // File sharing
  createShare: (fileId: string, token: string, options?: { expiresIn?: number; password?: string; maxDownloads?: number }) =>
    api.post<{ success: boolean; data: FileShare }>(`/api/files/${fileId}/share`, options || {}, token),

  getShares: (fileId: string, token: string) =>
    api.get<{ success: boolean; data: FileShare[] }>(`/api/files/${fileId}/shares`, token),

  deleteShare: (shareId: string, token: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/files/share/${shareId}`, token),

  getPublicShareUrl: (code: string) => {
    // Return frontend share page URL (not the API endpoint)
    const baseUrl = typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006';
    return `${baseUrl}/share/${code}`;
  },
};

// Comments API
export interface Comment {
  id: string;
  content: string;
  taskId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export const commentsApi = {
  add: (taskId: string, content: string, token: string) =>
    api.post<{ success: boolean; data: Comment }>(`/api/tasks/${taskId}/comments`, { content }, token),

  update: (taskId: string, commentId: string, content: string, token: string) =>
    api.patch<{ success: boolean; data: Comment }>(`/api/tasks/${taskId}/comments/${commentId}`, { content }, token),

  delete: (taskId: string, commentId: string, token: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/tasks/${taskId}/comments/${commentId}`, token),
};

// Chat API
export interface ChatRoom {
  id: string;
  name: string;
  type: 'GENERAL' | 'PROJECT' | 'GROUP' | 'DIRECT';
  projectId?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members: ChatRoomMember[];
  lastMessage?: ChatMessage;
  unreadCount?: number;
  project?: {
    id: string;
    name: string;
  };
}

export interface ChatRoomMember {
  id: string;
  roomId: string;
  userId: string;
  joinedAt: string;
  lastSeenAt?: string;
  user: {
    id: string;
    name: string;
    avatar?: string;
    role?: string;
  };
}

export interface ChatMessage {
  id: string;
  content: string;
  roomId: string;
  senderId: string;
  fileId?: string;
  createdAt: string;
  updatedAt: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  file?: {
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
  };
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  user: {
    id: string;
    name: string;
  };
}

export const chatApi = {
  // Rooms
  createRoom: (data: { name: string; type?: string; memberIds?: string[]; projectId?: string }, token: string) =>
    api.post<{ success: boolean; data: ChatRoom }>('/api/chat/rooms', data, token),

  getRooms: (token: string) =>
    api.get<{ success: boolean; data: ChatRoom[] }>('/api/chat/rooms', token),

  getRoom: (roomId: string, token: string) =>
    api.get<{ success: boolean; data: ChatRoom }>(`/api/chat/rooms/${roomId}`, token),

  getMessages: (roomId: string, token: string, options?: { limit?: number; before?: string }) => {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.before) params.append('before', options.before);
    const query = params.toString();
    return api.get<{ success: boolean; data: ChatMessage[] }>(
      `/api/chat/rooms/${roomId}/messages${query ? `?${query}` : ''}`,
      token
    );
  },

  addMember: (roomId: string, userId: string, token: string) =>
    api.post<{ success: boolean; data: ChatRoomMember }>(`/api/chat/rooms/${roomId}/members`, { userId }, token),

  leaveRoom: (roomId: string, token: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/chat/rooms/${roomId}/leave`, token),

  // Direct Messages
  getOrCreateDM: (otherUserId: string, token: string) =>
    api.get<{ success: boolean; data: ChatRoom }>(`/api/chat/dm/${otherUserId}`, token),

  // Reactions
  toggleReaction: (messageId: string, emoji: string, token: string) =>
    api.post<{ success: boolean; data?: MessageReaction; message?: string }>(
      `/api/chat/messages/${messageId}/reactions`,
      { emoji },
      token
    ),
};

// EODR Types
// Detailed EODR Task structure
export interface EODRTask {
  taskId?: string;
  title: string;
  description?: string; // What was the task
  completedAt?: string; // When completed
  filesLocation?: string; // Files/Documents location
  pendingItems?: string; // What's pending
  projectName: string;
  hours: number;
  status: string;
}

export interface EODREntry {
  id: string;
  userId: string;
  date: string;
  tasks: EODRTask[];
  totalHours: number;
  adjustedHours?: number; // Manager-adjusted hours
  tasksCompleted: number;
  notes?: string; // Employee's daily notes
  managerNotes?: string; // Manager's review notes
  isVerified: boolean;
  verifiedById?: string;
  verifiedAt?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    department?: {
      id: string;
      name: string;
    };
  };
  verifiedBy?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface EODRSummary {
  userId: string;
  month: number;
  year: number;
  totalDays: number;
  workingDays: number;
  totalHours: number;
  avgHoursPerDay: number;
  totalTasksCompleted: number;
  attendanceRate: number;
  eodrScore: number;
  verifiedEntries: number;
  unverifiedEntries: number;
}

export interface TodayPreview {
  date: string;
  totalHours: number;
  tasksCompleted: number;
  tasks: Array<{
    taskId?: string;
    projectId?: string;
    title: string;
    description?: string;
    projectName: string;
    hours: number;
    status: string;
  }>;
  hasActiveTimer: boolean;
  activeTaskTitle: string | null;
  hasSubmittedEodr: boolean;
  eodrId: string | null;
  isVerified: boolean;
}

export interface TeamEODROverview {
  date: string;
  stats: {
    totalUsers: number;
    submitted: number;
    notSubmitted: number;
    verified: number;
    pendingVerification: number;
  };
  overview: Array<{
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      department?: { id: string; name: string };
    };
    hasSubmitted: boolean;
    entry: {
      id: string;
      totalHours: number;
      adjustedHours?: number;
      tasksCompleted: number;
      isVerified: boolean;
      verifiedBy?: { id: string; name: string };
      notes?: string;
      managerNotes?: string;
    } | null;
  }>;
}

// EODR API
export const eodrApi = {
  getEntries: (token: string, params?: { userId?: string; month?: number; year?: number; date?: string; unverifiedOnly?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.userId) query.append('userId', params.userId);
    if (params?.month) query.append('month', params.month.toString());
    if (params?.year) query.append('year', params.year.toString());
    if (params?.date) query.append('date', params.date);
    if (params?.unverifiedOnly) query.append('unverifiedOnly', 'true');
    const queryStr = query.toString();
    return api.get<{ success: boolean; data: EODREntry[] }>(
      `/api/eodr/entries${queryStr ? `?${queryStr}` : ''}`,
      token
    );
  },

  getEntry: (id: string, token: string) =>
    api.get<{ success: boolean; data: EODREntry }>(`/api/eodr/entries/${id}`, token),

  createEntry: (data: { date: string; tasks?: EODRTask[]; totalHours?: number; tasksCompleted?: number; notes?: string }, token: string) =>
    api.post<{ success: boolean; data: EODREntry }>('/api/eodr/entries', data, token),

  generateEODR: (date: string, token: string) =>
    api.post<{ success: boolean; data: EODREntry }>('/api/eodr/generate', { date }, token),

  getSummary: (token: string, params: { userId?: string; month: number; year: number }) => {
    const query = new URLSearchParams();
    if (params.userId) query.append('userId', params.userId);
    query.append('month', params.month.toString());
    query.append('year', params.year.toString());
    return api.get<{ success: boolean; data: EODRSummary }>(
      `/api/eodr/summary?${query.toString()}`,
      token
    );
  },

  getTodayPreview: (token: string) =>
    api.get<{ success: boolean; data: TodayPreview }>('/api/eodr/today', token),

  // Manager functions
  managerUpdateEntry: (id: string, data: { adjustedHours?: number; managerNotes?: string; isVerified?: boolean }, token: string) =>
    api.patch<{ success: boolean; data: EODREntry }>(`/api/eodr/entries/${id}/review`, data, token),

  bulkVerify: (entryIds: string[], managerNotes: string | null, token: string) =>
    api.post<{ success: boolean; message: string }>('/api/eodr/bulk-verify', { entryIds, managerNotes }, token),

  getTeamOverview: (token: string, date?: string) => {
    const query = date ? `?date=${date}` : '';
    return api.get<{ success: boolean; data: TeamEODROverview }>(`/api/eodr/team-overview${query}`, token);
  },
};

// KPI Types
export interface KPIRecord {
  id: string;
  userId: string;
  reviewerId?: string;
  month: number;
  year: number;
  attendance: number;
  quality: number;
  behaviour: number;
  eodrScore: number;
  totalScore: number;
  comments?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    role: string;
    department?: {
      id: string;
      name: string;
    };
  };
  reviewer?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface MonthlyKPISummary {
  id: string;
  userId: string;
  month: number;
  year: number;
  avgAttendance: number;
  avgQuality: number;
  avgBehaviour: number;
  avgEodrScore: number;
  overallScore: number;
  commissionTier: string;
  commissionBonus?: number;
  tierDetails?: {
    tier: string;
    bonus: number;
  };
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface KPIDashboardData {
  period: { month: number; year: number };
  totalEmployees: number;
  averages: {
    attendance: number;
    quality: number;
    behaviour: number;
    eodrScore: number;
    totalScore: number;
  };
  tierDistribution: Array<{ tier: string; count: number }>;
  topPerformers: KPIRecord[];
  records: KPIRecord[];
}

export interface MyKPIData {
  currentPeriod: { month: number; year: number };
  kpiRecord: KPIRecord | null;
  commissionTier: { tier: string; bonus: number } | null;
  historicalRecords: Array<{
    month: number;
    year: number;
    totalScore: number;
    attendance: number;
    quality: number;
    behaviour: number;
    eodrScore: number;
  }>;
  eodrEntries: EODREntry[];
  eodrStats: {
    totalDays: number;
    totalHours: number;
    totalTasksCompleted: number;
  };
}

// Employee of the Month types
export interface EmployeeOfMonthData {
  period: { month: number; year: number };
  workingDays: number;
  avgPointsRequired: number;
  employees: Array<{
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      role: string;
      department?: { id: string; name: string };
    };
    points: number;
    avgPoint: number;
    difference: number;
    attendance: number;
    quality: number;
    behaviour: number;
    eodrScore: number;
    isEligible: boolean;
  }>;
  employeeOfMonth: {
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      role: string;
      department?: { id: string; name: string };
    };
    points: number;
    avgPoint: number;
    difference: number;
  } | null;
  stats: {
    totalEmployees: number;
    eligibleCount: number;
    ineligibleCount: number;
    highestScore: number;
    lowestScore: number;
  };
}

// Team Scoring types
export interface TeamScoringData {
  period: { month: number; year: number; workingDays: number };
  team: Array<{
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      role: string;
      department?: { id: string; name: string };
    };
    hasKPIRecord: boolean;
    kpiRecord: {
      id: string;
      attendance: number;
      quality: number;
      behaviour: number;
      eodrScore: number;
      totalScore: number;
    } | null;
    eodrStats: {
      daysSubmitted: number;
      totalHours: number;
      tasksCompleted: number;
      suggestedAttendance: number;
    };
  }>;
  stats: {
    totalUsers: number;
    withKPIRecords: number;
    pendingScoring: number;
  };
}

// Daily KPI Score types
export interface DailyKPIScore {
  id: string;
  userId: string;
  scoredById: string;
  date: string;
  attendance: number;
  quality: number;
  behaviour: number;
  eodrScore: number;
  totalScore: number;
  comments?: string;
  eodrEntryId?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    department?: { id: string; name: string };
  };
  scoredBy?: {
    id: string;
    name: string;
  };
}

export interface TeamDailyScoringData {
  date: string;
  team: Array<{
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      role: string;
      department?: { id: string; name: string };
    };
    date: string;
    eodrEntry: {
      id: string;
      totalHours: number;
      adjustedHours?: number;
      tasksCompleted: number;
      isVerified: boolean;
      tasks: unknown;
      notes?: string;
    } | null;
    hasSubmittedEODR: boolean;
    isVerified: boolean;
    dailyScore: {
      id: string;
      attendance: number;
      quality: number;
      behaviour: number;
      eodrScore: number;
      totalScore: number;
      comments?: string;
    } | null;
    isScored: boolean;
  }>;
  stats: {
    totalUsers: number;
    submittedEODR: number;
    pendingEODR: number;
    scored: number;
    pendingScoring: number;
  };
}

export interface EmployeeOfMonthFromDailyData {
  period: { month: number; year: number };
  workingDays: number;
  avgPointsRequired: number;
  employees: Array<{
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      role: string;
      department?: { id: string; name: string };
    };
    points: number;
    daysScored: number;
    avgPointPerDay: number;
    avgPoint: number;
    difference: number;
    isEligible: boolean;
  }>;
  employeeOfMonth: {
    user: {
      id: string;
      name: string;
      email: string;
      avatar?: string;
      role: string;
      department?: { id: string; name: string };
    };
    points: number;
    daysScored: number;
    avgPointPerDay: number;
    avgPoint: number;
    difference: number;
    isEligible: boolean;
  } | null;
  stats: {
    totalEmployees: number;
    eligibleCount: number;
    ineligibleCount: number;
    highestScore: number;
    lowestScore: number;
  };
}

// KPI API
export const kpiApi = {
  getMyKPI: (token: string, params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.append('month', params.month.toString());
    if (params?.year) query.append('year', params.year.toString());
    const queryStr = query.toString();
    return api.get<{ success: boolean; data: MyKPIData }>(
      `/api/kpi/my${queryStr ? `?${queryStr}` : ''}`,
      token
    );
  },

  getDashboard: (token: string, params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.append('month', params.month.toString());
    if (params?.year) query.append('year', params.year.toString());
    const queryStr = query.toString();
    return api.get<{ success: boolean; data: KPIDashboardData }>(
      `/api/kpi/dashboard${queryStr ? `?${queryStr}` : ''}`,
      token
    );
  },

  getSummary: (token: string, params: { userId?: string; month: number; year: number }) => {
    const query = new URLSearchParams();
    if (params.userId) query.append('userId', params.userId);
    query.append('month', params.month.toString());
    query.append('year', params.year.toString());
    return api.get<{ success: boolean; data: MonthlyKPISummary }>(
      `/api/kpi/summary?${query.toString()}`,
      token
    );
  },

  getRecords: (token: string, params?: { userId?: string; month?: number; year?: number; departmentId?: string }) => {
    const query = new URLSearchParams();
    if (params?.userId) query.append('userId', params.userId);
    if (params?.month) query.append('month', params.month.toString());
    if (params?.year) query.append('year', params.year.toString());
    if (params?.departmentId) query.append('departmentId', params.departmentId);
    const queryStr = query.toString();
    return api.get<{ success: boolean; data: KPIRecord[] }>(
      `/api/kpi/records${queryStr ? `?${queryStr}` : ''}`,
      token
    );
  },

  getRecord: (id: string, token: string) =>
    api.get<{ success: boolean; data: KPIRecord }>(`/api/kpi/records/${id}`, token),

  createRecord: (
    data: {
      userId: string;
      month: number;
      year: number;
      attendance: number;
      quality: number;
      behaviour: number;
      eodrScore: number;
      comments?: string;
    },
    token: string
  ) => api.post<{ success: boolean; data: KPIRecord }>('/api/kpi/records', data, token),

  updateRecord: (
    id: string,
    data: { attendance?: number; quality?: number; behaviour?: number; eodrScore?: number; comments?: string },
    token: string
  ) => api.patch<{ success: boolean; data: KPIRecord }>(`/api/kpi/records/${id}`, data, token),

  autoCalculate: (
    data: { userId: string; month: number; year: number; quality?: number; behaviour?: number; comments?: string },
    token: string
  ) => api.post<{ success: boolean; data: KPIRecord }>('/api/kpi/auto-calculate', data, token),

  // Employee of the Month
  getEmployeeOfMonth: (token: string, params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.append('month', params.month.toString());
    if (params?.year) query.append('year', params.year.toString());
    const queryStr = query.toString();
    return api.get<{ success: boolean; data: EmployeeOfMonthData }>(
      `/api/kpi/employee-of-month${queryStr ? `?${queryStr}` : ''}`,
      token
    );
  },

  // Team Scoring (Manager only)
  getTeamForScoring: (token: string, params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.append('month', params.month.toString());
    if (params?.year) query.append('year', params.year.toString());
    const queryStr = query.toString();
    return api.get<{ success: boolean; data: TeamScoringData }>(
      `/api/kpi/team-scoring${queryStr ? `?${queryStr}` : ''}`,
      token
    );
  },

  // Manager score KPI for a user
  scoreKPI: (id: string, data: { attendance?: number; quality?: number; behaviour?: number; eodrScore?: number; comments?: string }, token: string) =>
    api.patch<{ success: boolean; data: KPIRecord }>(`/api/kpi/records/${id}/score`, data, token),

  // Create KPI score for a user
  createScore: (data: { userId: string; month: number; year: number; attendance?: number; quality?: number; behaviour?: number; eodrScore?: number; comments?: string }, token: string) =>
    api.post<{ success: boolean; data: KPIRecord }>('/api/kpi/score', data, token),

  // ============================================
  // DAILY KPI SCORING (Manager scores each employee daily)
  // ============================================

  // Get daily KPI scores (filter by userId, date range, or month/year)
  getDailyScores: (token: string, params?: { userId?: string; startDate?: string; endDate?: string; month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.userId) query.append('userId', params.userId);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month) query.append('month', params.month.toString());
    if (params?.year) query.append('year', params.year.toString());
    const queryStr = query.toString();
    return api.get<{ success: boolean; data: DailyKPIScore[] }>(
      `/api/kpi/daily${queryStr ? `?${queryStr}` : ''}`,
      token
    );
  },

  // Get team members with EODR status for daily scoring (Manager only)
  getTeamDailyScoring: (token: string, date?: string) => {
    const query = date ? `?date=${date}` : '';
    return api.get<{ success: boolean; data: TeamDailyScoringData }>(
      `/api/kpi/daily/team${query}`,
      token
    );
  },

  // Create or update daily KPI score for an employee (Manager only)
  createDailyScore: (
    data: {
      userId: string;
      date: string;
      attendance: number;
      quality: number;
      behaviour: number;
      eodrScore: number;
      comments?: string;
    },
    token: string
  ) => api.post<{ success: boolean; data: DailyKPIScore }>('/api/kpi/daily/score', data, token),

  // Calculate monthly summary from daily scores (Manager only)
  calculateMonthlySummary: (
    data: { month: number; year: number; userId?: string },
    token: string
  ) => api.post<{
    success: boolean;
    data: {
      period: { month: number; year: number };
      results: Array<{ userId: string; status: string; summary?: MonthlyKPISummary; daysScored?: number; reason?: string }>;
      stats: { processed: number; updated: number; skipped: number };
    };
  }>('/api/kpi/daily/calculate-monthly', data, token),

  // Get Employee of the Month based on daily scores
  getEmployeeOfMonthFromDaily: (token: string, params?: { month?: number; year?: number }) => {
    const query = new URLSearchParams();
    if (params?.month) query.append('month', params.month.toString());
    if (params?.year) query.append('year', params.year.toString());
    const queryStr = query.toString();
    return api.get<{ success: boolean; data: EmployeeOfMonthFromDailyData }>(
      `/api/kpi/employee-of-month-daily${queryStr ? `?${queryStr}` : ''}`,
      token
    );
  },
};

// ============================================
// HOLIDAY API
// ============================================

export interface Holiday {
  id: string;
  date: string;
  name: string;
  type: 'FULL' | 'HALF';
  year: number;
  month: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export const holidayApi = {
  list: (token: string, params?: { year?: number; month?: number }) => {
    const query = new URLSearchParams();
    if (params?.year) query.append('year', params.year.toString());
    if (params?.month) query.append('month', params.month.toString());
    const queryStr = query.toString();
    return api.get<{ success: boolean; data: Holiday[] }>(
      `/api/holidays${queryStr ? `?${queryStr}` : ''}`,
      token
    );
  },

  getByMonth: (year: number, month: number, token?: string) =>
    api.get<{ success: boolean; data: Holiday[] }>(
      `/api/holidays/${year}/${month}`,
      token
    ),

  create: (data: { date: string; name: string; type: 'FULL' | 'HALF' }, token?: string) =>
    api.post<{ success: boolean; data: Holiday }>('/api/holidays', data, token),

  update: (id: string, data: { date?: string; name?: string; type?: 'FULL' | 'HALF' }, token?: string) =>
    api.patch<{ success: boolean; data: Holiday }>(`/api/holidays/${id}`, data, token),

  delete: (id: string, token?: string) =>
    api.delete<{ success: boolean; message: string }>(`/api/holidays/${id}`, token),

  bulkCreate: (holidays: Array<{ date: string; name: string; type?: 'FULL' | 'HALF' }>, token?: string) =>
    api.post<{ success: boolean; data: { created: number; errors?: Array<{ date: string; error: string }>; holidays: Holiday[] } }>(
      '/api/holidays/bulk',
      { holidays },
      token
    ),
};

// ============================================
// EODR V2 API (Task-based Commission System)
// ============================================

export interface DailyEODREntry {
  id: string;
  userId: string;
  date: string;
  tasksAssigned: number;
  tasksCompleted: number;
  taskDetails: Array<{ taskName: string; timeSpent: number; status: string; taskId?: string; projectName?: string }>;
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
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    department?: { id: string; name: string } | null;
  };
  verifiedBy?: { id: string; name: string; avatar: string | null } | null;
}

export interface WeeklyEODRSummary {
  id: string;
  userId: string;
  weekNumber: number;
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  tasksAssigned: number;
  tasksCompleted: number;
  weeklyTarget: number;
  adjustedTarget: number | null;
  completionRate: number;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    department?: { id: string; name: string } | null;
  };
}

export interface MonthlyEODRSummary {
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
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    department?: { id: string; name: string } | null;
  };
  finalizedBy?: { id: string; name: string } | null;
}

export interface CommissionDashboard {
  year: number;
  monthlySummaries: MonthlyEODRSummary[];
  currentMonth: {
    month: number;
    workingDays: number;
    taskTarget: number;
    hoursLogged: number;
    taskEquivalent: number;
    completionPercent: number;
    projectedTier: string;
    projectedBonus: number;
    daysTracked: number;
  };
  commissionTiers: Record<string, { minPercent: number; bonus: number }>;
}

export const eodrV2Api = {
  // ============ DAILY EODR ============

  submitDaily: (
    data: {
      date: string;
      tasksAssigned?: number;
      tasksCompleted?: number;
      taskDetails?: Array<{ taskName: string; timeSpent: number; status: string }>;
      secondaryTasks?: unknown[];
      employeeComments?: string;
    },
    token?: string
  ) => api.post<{ success: boolean; data: DailyEODREntry }>('/api/eodr/v2/daily', data, token),

  autoPopulate: (date: string, token?: string) =>
    api.post<{
      success: boolean;
      data: {
        date: string;
        taskDetails: Array<{ taskName: string; timeSpent: number; status: string; taskId?: string; projectName?: string }>;
        totalHoursLogged: number;
        tasksCompleted: number;
        taskEquivalent: number;
        tasksAssigned: number;
      };
    }>('/api/eodr/v2/daily/auto-populate', { date }, token),

  getDailyEntries: (token?: string, params?: { userId?: string; date?: string; startDate?: string; endDate?: string; month?: number; year?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.userId) query.append('userId', params.userId);
    if (params?.date) query.append('date', params.date);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.month) query.append('month', params.month.toString());
    if (params?.year) query.append('year', params.year.toString());
    if (params?.status) query.append('status', params.status);
    const queryStr = query.toString();
    return api.get<{ success: boolean; data: DailyEODREntry[] }>(
      `/api/eodr/v2/daily${queryStr ? `?${queryStr}` : ''}`,
      token
    );
  },

  managerEditDaily: (id: string, data: Partial<DailyEODREntry>, token?: string) =>
    api.patch<{ success: boolean; data: DailyEODREntry }>(`/api/eodr/v2/daily/${id}/manager-edit`, data, token),

  bulkUpdateDaily: (updates: Array<{ id: string; [key: string]: unknown }>, token?: string) =>
    api.patch<{ success: boolean; data: Array<{ id: string; success: boolean; data?: DailyEODREntry; error?: string }> }>(
      '/api/eodr/v2/table/daily/bulk-update',
      { updates },
      token
    ),

  getDailyTableData: (month: number, year: number, userId?: string, token?: string) => {
    const query = userId ? `?userId=${userId}` : '';
    return api.get<{
      success: boolean;
      data: {
        month: number;
        year: number;
        workingDays: number;
        halfDays: number;
        dailyTarget: number;
        entries: DailyEODREntry[];
        holidays: Holiday[];
      };
    }>(`/api/eodr/v2/table/daily/${month}/${year}${query}`, token);
  },

  // ============ WEEKLY SUMMARY ============

  calculateWeeklySummary: (userId: string, weekNumber: number, month: number, year: number, token?: string) =>
    api.post<{ success: boolean; data: WeeklyEODRSummary }>(
      '/api/eodr/v2/weekly/calculate',
      { userId, weekNumber, month, year },
      token
    ),

  getWeeklyTableData: (month: number, year: number, userId?: string, token?: string) => {
    const query = userId ? `?userId=${userId}` : '';
    return api.get<{
      success: boolean;
      data: {
        month: number;
        year: number;
        weeklyTarget: number;
        summaries: WeeklyEODRSummary[];
      };
    }>(`/api/eodr/v2/table/weekly/${month}/${year}${query}`, token);
  },

  // ============ MONTHLY SUMMARY & COMMISSION ============

  calculateMonthlySummary: (userId: string, month: number, year: number, token?: string) =>
    api.post<{ success: boolean; data: MonthlyEODRSummary }>(
      '/api/eodr/v2/monthly/calculate',
      { userId, month, year },
      token
    ),

  bulkCalculateMonthlySummary: (month: number, year: number, token?: string) =>
    api.post<{
      success: boolean;
      data: {
        total: number;
        calculated: number;
        skipped: number;
        failed: number;
        results: Array<{ userId: string; success: boolean; skipped?: boolean; reason?: string; error?: string }>;
      };
    }>('/api/eodr/v2/monthly/bulk-calculate', { month, year }, token),

  finalizeMonthly: (userId: string, month: number, year: number, token?: string) =>
    api.post<{ success: boolean; data: MonthlyEODRSummary }>(
      '/api/eodr/v2/monthly/finalize',
      { userId, month, year },
      token
    ),

  getMonthlyTableData: (year: number, month?: number, userId?: string, token?: string) => {
    const query = new URLSearchParams();
    if (month) query.append('month', month.toString());
    if (userId) query.append('userId', userId);
    const queryStr = query.toString();
    return api.get<{
      success: boolean;
      data: {
        year: number;
        month: number | null;
        summaries: MonthlyEODRSummary[];
        tierStats: Record<string, number>;
        commissionTiers: Record<string, { minPercent: number; bonus: number }>;
      };
    }>(`/api/eodr/v2/table/monthly/${year}${queryStr ? `?${queryStr}` : ''}`, token);
  },

  // ============ DASHBOARD & EXPORT ============

  getCommissionDashboard: (year?: number, token?: string) => {
    const query = year ? `?year=${year}` : '';
    return api.get<{ success: boolean; data: CommissionDashboard }>(`/api/eodr/v2/dashboard${query}`, token);
  },

  exportData: (type: 'daily' | 'weekly' | 'monthly', year: number, month?: number, userId?: string, token?: string) => {
    const query = new URLSearchParams();
    query.append('type', type);
    query.append('year', year.toString());
    if (month) query.append('month', month.toString());
    if (userId) query.append('userId', userId);
    return api.get<{ success: boolean; data: unknown[] }>(`/api/eodr/v2/export?${query.toString()}`, token);
  },
};

// ============ AI API ============

export interface GeneratedTask {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimatedHours: number;
  subtasks: string[];
  tags: string[];
}

export interface ExtractedTask {
  title: string;
  description: string;
  assignee?: string;
  dueDate?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
}

export interface AssigneeSuggestion {
  suggestedAssignee: {
    id: string;
    name: string;
    reason: string;
  };
  alternativeAssignees: Array<{
    id: string;
    name: string;
    reason: string;
  }>;
  teamWorkload: Array<{
    id: string;
    name: string;
    designation: string | null;
    currentTasks: number;
  }>;
}

export interface ProjectAnalysis {
  healthScore: number;
  status: 'healthy' | 'at_risk' | 'critical';
  risks: string[];
  recommendations: string[];
  assessment: string;
  projectStats: {
    totalTasks: number;
    completedTasks: number;
    overdueTasks: number;
    completionRate: string | number;
  };
}

export const aiApi = {
  // Generate a task from natural language
  generateTask: (prompt: string, projectId?: string, token?: string) =>
    api.post<{
      success: boolean;
      data: GeneratedTask;
      usage: { promptTokens: number; completionTokens: number; totalTokens: number };
    }>('/api/ai/generate-task', { prompt, projectId }, token),

  // Enhance an existing task
  enhanceTask: (
    taskId: string,
    enhancementType: 'improve_description' | 'add_acceptance_criteria' | 'break_into_subtasks',
    token?: string
  ) =>
    api.post<{
      success: boolean;
      data: {
        enhancementType: string;
        original: { title: string; description: string };
        enhanced: string | { subtasks: string[] };
      };
    }>('/api/ai/enhance-task', { taskId, enhancementType }, token),

  // Extract tasks from meeting notes or text
  extractTasks: (text: string, projectId?: string, token?: string) =>
    api.post<{
      success: boolean;
      data: {
        tasks: ExtractedTask[];
        summary: string;
      };
    }>('/api/ai/extract-tasks', { text, projectId }, token),

  // Suggest assignee for a task
  suggestAssignee: (taskTitle: string, taskDescription: string, projectId: string, token?: string) =>
    api.post<{ success: boolean; data: AssigneeSuggestion }>(
      '/api/ai/suggest-assignee',
      { taskTitle, taskDescription, projectId },
      token
    ),

  // Summarize activity
  summarizeActivity: (userId?: string, period?: 'daily' | 'weekly', token?: string) =>
    api.post<{
      success: boolean;
      data: {
        summary: string;
        stats: {
          tasksWorkedOn: number;
          tasksCompleted: number;
          hoursLogged: number;
          eodrSubmitted: number;
        };
      };
    }>('/api/ai/summarize-activity', { userId, period }, token),

  // Analyze project health
  analyzeProject: (projectId: string, token?: string) =>
    api.get<{ success: boolean; data: ProjectAnalysis }>(
      `/api/ai/analyze-project/${projectId}`,
      token
    ),

  // Chat with AI assistant
  chat: (
    message: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    token?: string
  ) =>
    api.post<{
      success: boolean;
      data: {
        message: string;
        conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
      };
    }>('/api/ai/chat', { message, conversationHistory }, token),
};

export { ApiError, API_URL };
