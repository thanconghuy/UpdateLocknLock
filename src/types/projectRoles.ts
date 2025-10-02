// =====================================================
// PROJECT ROLES TYPES
// 4 cấp độ đồng bộ với System Roles
// =====================================================

/**
 * 4 Project Roles (mapping với System Roles)
 */
export type ProjectRoleName = 'admin' | 'manager' | 'editor' | 'viewer'

/**
 * Project Role Levels (giống System Role Levels)
 */
export const PROJECT_ROLE_LEVELS = {
  admin: 100,
  manager: 80,
  editor: 60,
  viewer: 40
} as const

/**
 * Project Role Interface
 */
export interface ProjectRole {
  id: number
  name: ProjectRoleName
  display_name: string
  description: string
  level: number
  default_permissions: ProjectPermissions
  is_active: boolean
  created_at: string
  updated_at: string
}

/**
 * Project Permissions
 */
export interface ProjectPermissions {
  can_edit_project: boolean
  can_delete_project: boolean
  can_manage_members: boolean
  can_edit_products: boolean
  can_manage_woocommerce: boolean
  can_view_analytics: boolean
}

/**
 * Project Member (updated)
 */
export interface ProjectMember {
  id: string
  project_id: number // INTEGER
  user_id: string
  role: ProjectRoleName // 4 roles only
  status: 'active' | 'removed' | 'suspended'
  permissions?: Partial<ProjectPermissions> // Custom overrides
  notes?: string
  invited_by?: string
  created_at: string
  updated_at: string

  // Populated fields
  user?: {
    id: string
    email: string
    full_name?: string
    system_role: string // System role của user
    is_active: boolean
  }
}

/**
 * Mapping between System Role and Project Role
 */
export const SYSTEM_TO_PROJECT_ROLE_MAPPING = {
  admin: ['admin', 'manager', 'editor', 'viewer'],
  manager: ['manager', 'editor', 'viewer'],
  editor: ['editor', 'viewer'],
  viewer: ['viewer']
} as const

/**
 * Helper function: Check if system role can assign project role
 */
export function canAssignRole(systemRole: string, projectRole: ProjectRoleName): boolean {
  const allowedRoles = SYSTEM_TO_PROJECT_ROLE_MAPPING[systemRole as keyof typeof SYSTEM_TO_PROJECT_ROLE_MAPPING]
  return allowedRoles ? allowedRoles.includes(projectRole) : false
}

/**
 * Helper function: Get assignable roles for system role
 */
export function getAssignableRoles(systemRole: string): ProjectRoleName[] {
  return SYSTEM_TO_PROJECT_ROLE_MAPPING[systemRole as keyof typeof SYSTEM_TO_PROJECT_ROLE_MAPPING] || []
}

/**
 * Helper function: Get default project role for system role
 */
export function getDefaultProjectRole(systemRole: string): ProjectRoleName {
  switch (systemRole) {
    case 'admin':
      return 'admin'
    case 'manager':
      return 'manager'
    case 'editor':
      return 'editor'
    default:
      return 'viewer'
  }
}

/**
 * Default permissions by role
 */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<ProjectRoleName, ProjectPermissions> = {
  admin: {
    can_edit_project: true,
    can_delete_project: true,
    can_manage_members: true,
    can_edit_products: true,
    can_manage_woocommerce: true,
    can_view_analytics: true
  },
  manager: {
    can_edit_project: true,
    can_delete_project: false,
    can_manage_members: true,
    can_edit_products: true,
    can_manage_woocommerce: true,
    can_view_analytics: true
  },
  editor: {
    can_edit_project: false,
    can_delete_project: false,
    can_manage_members: false,
    can_edit_products: true,
    can_manage_woocommerce: true,
    can_view_analytics: true
  },
  viewer: {
    can_edit_project: false,
    can_delete_project: false,
    can_manage_members: false,
    can_edit_products: false,
    can_manage_woocommerce: false,
    can_view_analytics: true
  }
}
