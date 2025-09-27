import { UserRole, RolePermissions, UserProfile } from '../types/auth'

// Định nghĩa quyền mặc định cho từng role
export const DEFAULT_PERMISSIONS: Record<UserRole, RolePermissions> = {
  [UserRole.ADMIN]: {
    // System permissions
    canManageUsers: true,
    canManageSettings: true,
    canViewAllLogs: true,
    canManageSystem: true,

    // Project permissions
    canCreateProjects: true,
    canDeleteProjects: true,
    canViewAllProjects: true,
    canManageOwnProjects: true,
    canManageProjectMembers: true,

    // Product permissions
    canEditProducts: true,
    canImportData: true,
    canExportData: true,
    canViewProducts: true,

    // Report permissions
    canViewAllReports: true,
    canViewOwnReports: true,
    canExportReports: true,

    // No limits for admin
    maxProjects: undefined,
    maxTeamMembers: undefined,
  },

  [UserRole.MANAGER]: {
    // System permissions
    canManageUsers: false,
    canManageSettings: false,
    canViewAllLogs: false,
    canManageSystem: false,

    // Project permissions
    canCreateProjects: true,
    canDeleteProjects: false, // Chỉ delete project của mình
    canViewAllProjects: true,  // Có thể xem tất cả để học hỏi (read-only)
    canManageOwnProjects: true,
    canManageProjectMembers: true,

    // Product permissions
    canEditProducts: true,
    canImportData: true,
    canExportData: true,
    canViewProducts: true,

    // Report permissions
    canViewAllReports: false,
    canViewOwnReports: true,
    canExportReports: true,

    // Limits
    maxProjects: 10,
    maxTeamMembers: 5,
  },

  [UserRole.PRODUCT_EDITOR]: {
    // System permissions
    canManageUsers: false,
    canManageSettings: false,
    canViewAllLogs: false,
    canManageSystem: false,

    // Project permissions
    canCreateProjects: false,
    canDeleteProjects: false,
    canViewAllProjects: false,
    canManageOwnProjects: false,
    canManageProjectMembers: false,

    // Product permissions
    canEditProducts: true,
    canImportData: true,
    canExportData: false,
    canViewProducts: true,

    // Report permissions
    canViewAllReports: false,
    canViewOwnReports: true,
    canExportReports: false,

    // No project limits but can't create
    maxProjects: 0,
    maxTeamMembers: 0,
  },

  [UserRole.PROJECT_VIEWER]: {
    // System permissions
    canManageUsers: false,
    canManageSettings: false,
    canViewAllLogs: false,
    canManageSystem: false,

    // Project permissions
    canCreateProjects: false,
    canDeleteProjects: false,
    canViewAllProjects: false,
    canManageOwnProjects: false,
    canManageProjectMembers: false,

    // Product permissions
    canEditProducts: false,
    canImportData: false,
    canExportData: false,
    canViewProducts: true,

    // Report permissions
    canViewAllReports: false,
    canViewOwnReports: true,
    canExportReports: false,

    // No creation limits
    maxProjects: 0,
    maxTeamMembers: 0,
  },

  [UserRole.VIEWER]: {
    // System permissions
    canManageUsers: false,
    canManageSettings: false,
    canViewAllLogs: false,
    canManageSystem: false,

    // Project permissions
    canCreateProjects: false,
    canDeleteProjects: false,
    canViewAllProjects: false,
    canManageOwnProjects: false,
    canManageProjectMembers: false,

    // Product permissions
    canEditProducts: false,
    canImportData: false,
    canExportData: false,
    canViewProducts: false, // Chỉ xem được khi được giao

    // Report permissions
    canViewAllReports: false,
    canViewOwnReports: false,
    canExportReports: false,

    // No limits
    maxProjects: 0,
    maxTeamMembers: 0,
  },
}

// Helper functions để kiểm tra quyền
export class PermissionChecker {
  private userProfile: UserProfile
  private permissions: RolePermissions

  constructor(userProfile: UserProfile) {
    this.userProfile = userProfile
    this.permissions = this.getUserPermissions()
  }

  private getUserPermissions(): RolePermissions {
    // Nếu user có custom permissions, merge với default
    const defaultPerms = DEFAULT_PERMISSIONS[this.userProfile.role]
    const customPerms = this.userProfile.permissions || {}

    return {
      ...defaultPerms,
      ...customPerms,
    }
  }

  // System permissions
  canManageUsers(): boolean {
    return this.permissions.canManageUsers
  }

  canManageSettings(): boolean {
    return this.permissions.canManageSettings
  }

  canViewAllLogs(): boolean {
    return this.permissions.canViewAllLogs
  }

  canManageSystem(): boolean {
    return this.permissions.canManageSystem
  }

  // Project permissions
  canCreateProjects(): boolean {
    if (!this.permissions.canCreateProjects) return false

    // Kiểm tra limit nếu có
    const maxProjects = this.permissions.maxProjects || this.userProfile.max_projects
    if (maxProjects && maxProjects <= 0) return false

    return true
  }

  canDeleteProjects(): boolean {
    return this.permissions.canDeleteProjects
  }

  canViewAllProjects(): boolean {
    return this.permissions.canViewAllProjects
  }

  canManageOwnProjects(): boolean {
    return this.permissions.canManageOwnProjects
  }

  canManageProjectMembers(): boolean {
    return this.permissions.canManageProjectMembers
  }

  // Product permissions
  canEditProducts(): boolean {
    return this.permissions.canEditProducts
  }

  canImportData(): boolean {
    return this.permissions.canImportData
  }

  canExportData(): boolean {
    return this.permissions.canExportData
  }

  canViewProducts(): boolean {
    return this.permissions.canViewProducts
  }

  // Report permissions
  canViewAllReports(): boolean {
    return this.permissions.canViewAllReports
  }

  canViewOwnReports(): boolean {
    return this.permissions.canViewOwnReports
  }

  canExportReports(): boolean {
    return this.permissions.canExportReports
  }

  // Project-specific permissions
  canAccessProject(projectId: string, userProjectRole?: string): boolean {
    // Admin có thể truy cập tất cả
    if (this.userProfile.role === UserRole.ADMIN) return true

    // Nếu có role trong project cụ thể
    if (userProjectRole) return true

    // Nếu có quyền xem tất cả projects
    if (this.permissions.canViewAllProjects) return true

    return false
  }

  canEditProject(projectOwnerId: string, projectManagerId?: string, userProjectRole?: string): boolean {
    // Admin có thể edit tất cả
    if (this.userProfile.role === UserRole.ADMIN) return true

    // Owner có thể edit
    if (projectOwnerId === this.userProfile.id) return true

    // Manager có thể edit
    if (projectManagerId === this.userProfile.id) return true

    // Nếu có role manager trong project
    if (userProjectRole === 'manager') return true

    return false
  }

  canManageMembersOfProject(projectOwnerId: string, projectManagerId?: string, userProjectRole?: string): boolean {
    // Admin có thể manage tất cả
    if (this.userProfile.role === UserRole.ADMIN) return true

    // Owner có thể manage
    if (projectOwnerId === this.userProfile.id) return true

    // Manager có thể manage nếu có quyền
    if (
      (projectManagerId === this.userProfile.id || userProjectRole === 'manager') &&
      this.permissions.canManageProjectMembers
    ) {
      return true
    }

    return false
  }

  // Utility methods
  isAdmin(): boolean {
    return this.userProfile.role === UserRole.ADMIN
  }

  isManager(): boolean {
    return this.userProfile.role === UserRole.MANAGER
  }

  isProductEditor(): boolean {
    return this.userProfile.role === UserRole.PRODUCT_EDITOR
  }

  isProjectViewer(): boolean {
    return this.userProfile.role === UserRole.PROJECT_VIEWER
  }

  isViewer(): boolean {
    return this.userProfile.role === UserRole.VIEWER
  }

  getMaxProjects(): number | undefined {
    return this.permissions.maxProjects || this.userProfile.max_projects
  }

  getMaxTeamMembers(): number | undefined {
    return this.permissions.maxTeamMembers || this.userProfile.max_team_members
  }

  // Role description for UI
  getRoleDescription(): string {
    switch (this.userProfile.role) {
      case UserRole.ADMIN:
        return '👑 Quản trị viên - Toàn quyền hệ thống'
      case UserRole.MANAGER:
        return '🏢 Quản lý dự án - Quản lý team và projects'
      case UserRole.PRODUCT_EDITOR:
        return '✏️ Biên tập viên - Chỉnh sửa sản phẩm'
      case UserRole.PROJECT_VIEWER:
        return '👁️ Xem dự án - Chỉ xem thông tin project'
      case UserRole.VIEWER:
        return '👤 Người xem - Quyền hạn chế'
      default:
        return '❓ Chưa xác định'
    }
  }

  // Get available actions for UI
  getAvailableActions(): string[] {
    const actions: string[] = []

    if (this.canManageUsers()) actions.push('Quản lý người dùng')
    if (this.canManageSettings()) actions.push('Quản lý cài đặt')
    if (this.canCreateProjects()) actions.push('Tạo dự án mới')
    if (this.canManageOwnProjects()) actions.push('Quản lý dự án')
    if (this.canEditProducts()) actions.push('Chỉnh sửa sản phẩm')
    if (this.canImportData()) actions.push('Import dữ liệu')
    if (this.canExportData()) actions.push('Export dữ liệu')
    if (this.canViewAllReports()) actions.push('Xem tất cả báo cáo')
    else if (this.canViewOwnReports()) actions.push('Xem báo cáo của mình')

    return actions
  }
}

// Factory function
export function createPermissionChecker(userProfile: UserProfile): PermissionChecker {
  return new PermissionChecker(userProfile)
}

// Hook-ready function
export function getUserPermissions(userProfile: UserProfile): RolePermissions {
  return new PermissionChecker(userProfile)['getUserPermissions']()
}