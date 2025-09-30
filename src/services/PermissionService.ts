// =======================================
// PERMISSION SERVICE - Authorization Logic
// =======================================

import { supabase } from '../lib/supabase'
import {
  UserProfile,
  Role,
  UserAction,
  RoleAction,
  UserPermissions,
  SecurityContext,
  PermissionCheckResult,
  OperationResult,
  USER_ACTIONS,
  ROLE_LEVELS
} from '../types/userManagement'
import { RoleDataService } from './RoleDataService'
import { UserDataService } from './UserDataService'

export class PermissionService {
  private static instance: PermissionService
  private roleService: RoleDataService
  private userService: UserDataService

  private constructor() {
    this.roleService = RoleDataService.getInstance()
    this.userService = UserDataService.getInstance()
  }

  // Singleton pattern
  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService()
    }
    return PermissionService.instance
  }

  // ========================================
  // CORE PERMISSION CHECKS
  // ========================================

  /**
   * Kiểm tra quyền hạn của user cho một action cụ thể
   */
  async checkUserPermission(
    userId: string,
    action: UserAction,
    targetUserId?: string
  ): Promise<OperationResult<PermissionCheckResult>> {
    try {
      console.log(`🔐 PermissionService: Checking permission - User: ${userId}, Action: ${action}, Target: ${targetUserId || 'N/A'}`)

      // Lấy thông tin user hiện tại
      const userResult = await this.userService.getUserById(userId)
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString()
        }
      }

      const user = userResult.data

      // Kiểm tra user có active không
      if (!user.is_active) {
        return {
          success: true,
          data: {
            allowed: false,
            reason: 'User account is inactive'
          },
          timestamp: new Date().toISOString()
        }
      }

      // Lấy thông tin role
      const roleResult = await this.roleService.getRoleById(user.primary_role_id)
      if (!roleResult.success || !roleResult.data) {
        return {
          success: false,
          error: 'User role not found',
          timestamp: new Date().toISOString()
        }
      }

      const userRole = roleResult.data

      // Kiểm tra quyền theo action
      const permissionResult = await this.checkActionPermission(userRole, action, targetUserId)

      console.log(`✅ Permission check result: ${permissionResult.data?.allowed} - ${permissionResult.data?.reason}`)

      return permissionResult

    } catch (error) {
      console.error('❌ Exception in checkUserPermission:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Kiểm tra quyền hạn theo action cụ thể
   */
  private async checkActionPermission(
    userRole: Role,
    action: UserAction,
    targetUserId?: string
  ): Promise<OperationResult<PermissionCheckResult>> {
    try {
      const roleName = userRole.name
      const roleLevel = userRole.level

      let allowed = false
      let reason = ''

      // Admin có thể làm tất cả
      if (roleName === 'admin') {
        allowed = true
        reason = 'Admin has full permissions'
      } else {
        switch (action) {
          case USER_ACTIONS.VIEW_USERS:
            // Chỉ Admin có thể xem users
            allowed = (roleName as string) === 'admin'
            reason = allowed ? 'Admin has view permission' : 'Only admin can view user management'
            break

          case USER_ACTIONS.CREATE_USER:
            // Chỉ Admin và Manager có thể tạo users
            allowed = ['admin', 'manager'].includes(roleName)
            reason = allowed ? 'Role has create permission' : 'Insufficient role level for creating users'
            break

          case USER_ACTIONS.UPDATE_USER:
            if (targetUserId) {
              // Kiểm tra có thể update target user không
              const canUpdateResult = await this.canModifyUser(userRole, targetUserId)
              if (canUpdateResult.success && canUpdateResult.data) {
                allowed = canUpdateResult.data.allowed
                reason = canUpdateResult.data.reason || 'Permission check completed'
              } else {
                allowed = false
                reason = 'Cannot verify target user permissions'
              }
            } else {
              // Chỉ Admin và Manager có thể update users nói chung
              allowed = ['admin', 'manager'].includes(roleName)
              reason = allowed ? 'Role has update permission' : 'Insufficient role level for updating users'
            }
            break

          case USER_ACTIONS.DELETE_USER:
            // Chỉ Admin có thể delete users
            allowed = (roleName as string) === 'admin'
            reason = allowed ? 'Admin can delete users' : 'Only admin can delete users'
            break

          case USER_ACTIONS.CHANGE_ROLE:
            if (targetUserId) {
              // Kiểm tra có thể thay đổi role của target user không
              const canChangeResult = await this.canModifyUser(userRole, targetUserId)
              if (canChangeResult.success && canChangeResult.data) {
                allowed = canChangeResult.data.allowed && ['admin', 'manager'].includes(roleName)
                reason = allowed ? 'Role has permission to change roles' : 'Insufficient permission for role changes'
              } else {
                allowed = false
                reason = 'Cannot verify target user permissions'
              }
            } else {
              allowed = ['admin', 'manager'].includes(roleName)
              reason = allowed ? 'Role has role change permission' : 'Insufficient role level for changing roles'
            }
            break

          case USER_ACTIONS.ACTIVATE_USER:
          case USER_ACTIONS.DEACTIVATE_USER:
            // Admin và Manager có thể activate/deactivate
            allowed = ['admin', 'manager'].includes(roleName)
            reason = allowed ? 'Role has activation permission' : 'Insufficient role level for user activation'
            break

          default:
            allowed = false
            reason = 'Unknown action'
        }
      }

      return {
        success: true,
        data: {
          allowed,
          reason,
          userLevel: roleLevel
        },
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in checkActionPermission:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Kiểm tra user có thể modify một user khác không
   */
  private async canModifyUser(
    currentUserRole: Role,
    targetUserId: string
  ): Promise<OperationResult<PermissionCheckResult>> {
    try {
      // Admin có thể modify tất cả
      if (currentUserRole.name === 'admin') {
        return {
          success: true,
          data: {
            allowed: true,
            reason: 'Admin can modify all users'
          },
          timestamp: new Date().toISOString()
        }
      }

      // Lấy thông tin target user
      const targetUserResult = await this.userService.getUserById(targetUserId)
      if (!targetUserResult.success || !targetUserResult.data) {
        return {
          success: false,
          error: 'Target user not found',
          timestamp: new Date().toISOString()
        }
      }

      const targetUser = targetUserResult.data

      // Lấy role của target user
      const targetRoleResult = await this.roleService.getRoleById(targetUser.primary_role_id)
      if (!targetRoleResult.success || !targetRoleResult.data) {
        return {
          success: false,
          error: 'Target user role not found',
          timestamp: new Date().toISOString()
        }
      }

      const targetRole = targetRoleResult.data

      // So sánh level
      const currentLevel = currentUserRole.level
      const targetLevel = targetRole.level

      const allowed = currentLevel > targetLevel
      const reason = allowed
        ? `Role level sufficient (${currentLevel} > ${targetLevel})`
        : `Cannot modify user with equal or higher role level (${currentLevel} <= ${targetLevel})`

      return {
        success: true,
        data: {
          allowed,
          reason,
          userLevel: currentLevel,
          requiredLevel: targetLevel
        },
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in canModifyUser:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  // ========================================
  // PERMISSION HELPERS
  // ========================================

  /**
   * Tạo SecurityContext cho user
   */
  async createSecurityContext(userId: string): Promise<OperationResult<SecurityContext>> {
    try {
      console.log(`🔐 PermissionService: Creating security context for: ${userId}`)

      // Lấy thông tin user
      const userResult = await this.userService.getUserById(userId)
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString()
        }
      }

      const user = userResult.data

      // Tạo permissions object
      const permissions = await this.getUserPermissions(userId)
      if (!permissions.success || !permissions.data) {
        return {
          success: false,
          error: 'Cannot determine user permissions',
          timestamp: new Date().toISOString()
        }
      }

      const securityContext: SecurityContext = {
        currentUser: user,
        permissions: permissions.data,
        sessionId: `session_${Date.now()}`
      }

      console.log('✅ Security context created')

      return {
        success: true,
        data: securityContext,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in createSecurityContext:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Lấy danh sách permissions của user
   */
  async getUserPermissions(userId: string): Promise<OperationResult<UserPermissions>> {
    try {
      console.log(`🔐 PermissionService: Getting permissions for: ${userId}`)

      const userResult = await this.userService.getUserById(userId)
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString()
        }
      }

      const user = userResult.data

      // Lấy role info
      const roleResult = await this.roleService.getRoleById(user.primary_role_id)
      if (!roleResult.success || !roleResult.data) {
        return {
          success: false,
          error: 'User role not found',
          timestamp: new Date().toISOString()
        }
      }

      const role = roleResult.data
      const roleName = role.name

      // Tạo permissions dựa trên role - CHỈ ADMIN có quyền User Management
      const permissions: UserPermissions = {
        canViewUsers: roleName === 'admin', // Chỉ Admin
        canCreateUsers: roleName === 'admin', // Chỉ Admin
        canUpdateUsers: roleName === 'admin', // Chỉ Admin
        canDeleteUsers: roleName === 'admin', // Chỉ Admin
        canChangeRoles: roleName === 'admin', // Chỉ Admin
        canManageRoles: roleName === 'admin' // Chỉ Admin
      }

      console.log(`✅ Permissions determined for role: ${roleName}`)

      return {
        success: true,
        data: permissions,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in getUserPermissions:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Kiểm tra user có phải admin không
   */
  async isAdminUser(userId: string): Promise<OperationResult<boolean>> {
    try {
      const userResult = await this.userService.getUserById(userId)
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString()
        }
      }

      const isAdmin = userResult.data.role === 'admin'

      return {
        success: true,
        data: isAdmin,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in isAdminUser:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Lấy danh sách users mà current user có thể manage
   */
  async getManageableUsers(currentUserId: string): Promise<OperationResult<string[]>> {
    try {
      console.log(`🔐 PermissionService: Getting manageable users for: ${currentUserId}`)

      const userResult = await this.userService.getUserById(currentUserId)
      if (!userResult.success || !userResult.data) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString()
        }
      }

      const currentUser = userResult.data

      // Admin có thể manage tất cả
      if (currentUser.role === 'admin') {
        const allUsersResult = await this.userService.getAllUsers()
        if (!allUsersResult.success || !allUsersResult.data) {
          return {
            success: false,
            error: 'Cannot fetch users list',
            timestamp: new Date().toISOString()
          }
        }

        const userIds = allUsersResult.data.users.map(user => user.id)
        return {
          success: true,
          data: userIds,
          timestamp: new Date().toISOString()
        }
      }

      // Các role khác chỉ manage được users có level thấp hơn
      const currentRoleResult = await this.roleService.getRoleById(currentUser.primary_role_id)
      if (!currentRoleResult.success || !currentRoleResult.data) {
        return {
          success: false,
          error: 'Current user role not found',
          timestamp: new Date().toISOString()
        }
      }

      const currentRole = currentRoleResult.data
      const manageableUserIds: string[] = []

      // Lấy tất cả users và check từng user
      const allUsersResult = await this.userService.getAllUsers()
      if (allUsersResult.success && allUsersResult.data) {
        for (const user of allUsersResult.data.users) {
          const canModifyResult = await this.canModifyUser(currentRole, user.id)
          if (canModifyResult.success && canModifyResult.data?.allowed) {
            manageableUserIds.push(user.id)
          }
        }
      }

      console.log(`✅ Found ${manageableUserIds.length} manageable users`)

      return {
        success: true,
        data: manageableUserIds,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in getManageableUsers:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }
}