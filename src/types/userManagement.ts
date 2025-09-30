// ===================================
// USER MANAGEMENT TYPES & INTERFACES
// ===================================

// Core Database Entities
export interface Role {
  id: string
  name: 'admin' | 'manager' | 'editor' | 'viewer'
  display_name: string
  level: number
  created_at?: string
  updated_at?: string
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  role: string // Direct role string
  primary_role_id: string // Foreign key to roles table
  is_active: boolean
  created_at: string
  updated_at?: string
  roles?: Role // Joined role data
}

// Operation Types
export type UserAction =
  | 'VIEW_USERS'
  | 'CREATE_USER'
  | 'UPDATE_USER'
  | 'DELETE_USER'
  | 'CHANGE_ROLE'
  | 'ACTIVATE_USER'
  | 'DEACTIVATE_USER'

export type RoleAction =
  | 'VIEW_ROLES'
  | 'ASSIGN_ROLE'
  | 'VALIDATE_ROLE'

// Data Transfer Objects
export interface CreateUserRequest {
  email: string
  full_name?: string
  role: string
  primary_role_id: string
  is_active?: boolean
}

export interface UpdateUserRequest {
  email?: string
  full_name?: string
  role?: string
  primary_role_id?: string
  is_active?: boolean
}

export interface UserRoleChangeRequest {
  userId: string
  newRoleId: string
  newRoleName: string
  reason?: string
}

// Response Types
export interface OperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp: string
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings?: string[]
}

export interface PermissionCheckResult {
  allowed: boolean
  reason?: string
  requiredLevel?: number
  userLevel?: number
}

// Query & Filter Types
export interface UserQueryParams {
  limit?: number
  offset?: number
  search?: string
  role?: string
  isActive?: boolean
  sortBy?: 'email' | 'created_at' | 'role' | 'full_name'
  sortOrder?: 'asc' | 'desc'
}

export interface UserListResponse {
  users: UserProfile[]
  total: number
  page: number
  hasNext: boolean
  hasPrev: boolean
}

// Permission & Security
export interface UserPermissions {
  canViewUsers: boolean
  canCreateUsers: boolean
  canUpdateUsers: boolean
  canDeleteUsers: boolean
  canChangeRoles: boolean
  canManageRoles: boolean
}

export interface SecurityContext {
  currentUser: UserProfile
  permissions: UserPermissions
  sessionId?: string
}

// Error Types
export interface UserManagementError {
  code: string
  message: string
  details?: any
  field?: string
  timestamp: string
}

export type UserErrorCode =
  | 'USER_NOT_FOUND'
  | 'EMAIL_ALREADY_EXISTS'
  | 'INVALID_EMAIL_FORMAT'
  | 'INVALID_ROLE'
  | 'PERMISSION_DENIED'
  | 'VALIDATION_FAILED'
  | 'DATABASE_ERROR'
  | 'UNKNOWN_ERROR'

// Event Types for State Management
export interface UserEvent {
  type: 'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED' | 'ROLE_CHANGED'
  userId: string
  data?: any
  timestamp: string
  triggeredBy: string
}

// Configuration
export interface UserManagementConfig {
  maxUsersPerPage: number
  defaultRole: string
  allowSelfUpdate: boolean
  requireEmailVerification: boolean
  enableUserDeactivation: boolean
  enableRoleHierarchy: boolean
}

// API Response Wrapper
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: UserManagementError
  metadata?: {
    total?: number
    page?: number
    limit?: number
    processingTime?: number
  }
}

// Constants
export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  EDITOR: 'editor',
  VIEWER: 'viewer'
} as const

export const ROLE_LEVELS = {
  ADMIN: 10,
  MANAGER: 8,
  EDITOR: 6,
  VIEWER: 4
} as const

export const USER_ACTIONS = {
  VIEW_USERS: 'VIEW_USERS',
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
  CHANGE_ROLE: 'CHANGE_ROLE',
  ACTIVATE_USER: 'ACTIVATE_USER',
  DEACTIVATE_USER: 'DEACTIVATE_USER'
} as const