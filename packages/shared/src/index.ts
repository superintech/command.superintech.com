// User Roles
export const UserRole = {
  CEO: 'CEO',
  CFO: 'CFO',
  COO: 'COO',
  MANAGER: 'MANAGER',
  TEAM_LEAD: 'TEAM_LEAD',
  EMPLOYEE: 'EMPLOYEE',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

// Departments
export const Department = {
  MANAGEMENT: 'MANAGEMENT',
  DEVELOPMENT: 'DEVELOPMENT',
  DESIGNING: 'DESIGNING',
  GHL_DEVELOPMENT: 'GHL_DEVELOPMENT',
} as const;
export type Department = (typeof Department)[keyof typeof Department];

// Task Status
export const TaskStatus = {
  BACKLOG: 'BACKLOG',
  TODO: 'TODO',
  IN_PROGRESS: 'IN_PROGRESS',
  IN_REVIEW: 'IN_REVIEW',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

// Task Priority
export const TaskPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT',
} as const;
export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

// Project Status
export const ProjectStatus = {
  PLANNING: 'PLANNING',
  ACTIVE: 'ACTIVE',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

// Chat Room Type
export const ChatRoomType = {
  GENERAL: 'GENERAL',
  PROJECT: 'PROJECT',
  GROUP: 'GROUP',
  DIRECT: 'DIRECT',
} as const;
export type ChatRoomType = (typeof ChatRoomType)[keyof typeof ChatRoomType];

// Notification Type
export const NotificationType = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_DUE_SOON: 'TASK_DUE_SOON',
  TASK_OVERDUE: 'TASK_OVERDUE',
  COMMENT_ADDED: 'COMMENT_ADDED',
  MENTION: 'MENTION',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  KPI_REMINDER: 'KPI_REMINDER',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

// User interfaces
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  departmentId: string;
  avatar?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthUser extends User {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

// Project interfaces
export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  ownerId: string;
  departmentId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string;
  departmentId: string;
}

// Task interfaces
export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: string;
  assigneeId?: string;
  reporterId: string;
  parentTaskId?: string;
  dueDate?: Date;
  estimatedHours?: number;
  actualHours?: number;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId: string;
  assigneeId?: string;
  parentTaskId?: string;
  dueDate?: string;
  estimatedHours?: number;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  dueDate?: string;
  estimatedHours?: number;
  position?: number;
}

// Time Entry interfaces
export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StartTimeEntryRequest {
  taskId: string;
  description?: string;
}

export interface StopTimeEntryRequest {
  id: string;
}

// Comment interfaces
export interface Comment {
  id: string;
  content: string;
  taskId: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCommentRequest {
  content: string;
  taskId: string;
}

// Chat interfaces
export interface ChatRoom {
  id: string;
  name: string;
  type: ChatRoomType;
  projectId?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  content: string;
  roomId: string;
  senderId: string;
  fileId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageRequest {
  content: string;
  roomId: string;
  fileId?: string;
}

// KPI interfaces
export interface KPIRecord {
  id: string;
  userId: string;
  reviewerId: string;
  month: number;
  year: number;
  attendance: number;
  quality: number;
  behaviour: number;
  eodrScore: number;
  totalScore: number;
  comments?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EODREntry {
  id: string;
  userId: string;
  date: Date;
  tasks: EODRTask[];
  totalHours: number;
  tasksCompleted: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EODRTask {
  taskId?: string;
  description: string;
  hoursSpent: number;
  link?: string;
}

export interface CreateEODRRequest {
  date: string;
  tasks: EODRTask[];
}

// File interfaces
export interface File {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  uploaderId: string;
  projectId?: string;
  taskId?: string;
  createdAt: Date;
}

// Notification interfaces
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  userId: string;
  isRead: boolean;
  data?: Record<string, unknown>;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// KPI Commission Tiers
export const KPI_TIERS = {
  TIER_1: { min: 95, max: 99.99, commission: 0 },
  TIER_2: { min: 100, max: 101.99, commission: 5 },
  TIER_3: { min: 102, max: 104.99, commission: 10 },
  TIER_4: { min: 105, max: 109.99, commission: 15 },
  TIER_5: { min: 110, max: Infinity, commission: 20 },
} as const;

export function calculateCommissionTier(score: number): number {
  if (score < 95) return 0;
  if (score < 100) return KPI_TIERS.TIER_1.commission;
  if (score < 102) return KPI_TIERS.TIER_2.commission;
  if (score < 105) return KPI_TIERS.TIER_3.commission;
  if (score < 110) return KPI_TIERS.TIER_4.commission;
  return KPI_TIERS.TIER_5.commission;
}
