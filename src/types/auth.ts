export enum UserRole {
  ADMIN = 'admin',           // Quản lý toàn hệ thống
  MANAGER = 'manager',       // Quản lý projects và team
  EDITOR = 'editor',         // Chỉnh sửa sản phẩm
  VIEWER = 'viewer',         // Xem cơ bản
  PRODUCT_EDITOR = 'product_editor',  // Chỉnh sửa sản phẩm (specific)
  PROJECT_VIEWER = 'project_viewer'   // Xem project (specific)
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  primary_role_id?: string
  role?: string // Computed field from roles system
  created_at: string
  updated_at: string
  is_active: boolean
  max_projects?: number
  max_team_members?: number
  permissions?: string[] // Array of permission names
  last_active_at?: string
  is_suspended?: boolean
  suspended_reason?: string
  created_by?: string
  last_role_sync?: string
}

export interface RolePermissions {
  // System permissions
  canManageUsers: boolean
  canManageSettings: boolean
  canViewAllLogs: boolean
  canManageSystem: boolean

  // Project permissions
  canCreateProjects: boolean
  canDeleteProjects: boolean
  canViewAllProjects: boolean
  canManageOwnProjects: boolean
  canManageProjectMembers: boolean

  // Product permissions
  canEditProducts: boolean
  canImportData: boolean
  canExportData: boolean
  canViewProducts: boolean

  // Report permissions
  canViewAllReports: boolean
  canViewOwnReports: boolean
  canExportReports: boolean

  // Limits
  maxProjects?: number
  maxTeamMembers?: number
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: UserRole
  assigned_by: string
  assigned_at: string
  is_active: boolean
  permissions?: Record<string, any>
  user?: UserProfile
}

export interface UserActivityLog {
  id: string
  user_id: string
  action: string
  resource_type?: string
  resource_id?: string
  details?: Record<string, any>
  ip_address?: string
  user_agent?: string
  created_at: string
}

export interface PermissionTemplate {
  id: string
  name: string
  role: UserRole
  permissions: Record<string, any>
  description?: string
  is_system_template: boolean
  created_by?: string
  created_at: string
  updated_at: string
}