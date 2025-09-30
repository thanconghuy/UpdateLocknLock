// =======================================
// USER MANAGEMENT CONTROLLER - Business Logic
// =======================================

import {
  CreateUserRequest,
  UpdateUserRequest,
  UserRoleChangeRequest,
  UserQueryParams,
  UserListResponse,
  UserProfile,
  OperationResult,
  SecurityContext,
  UserEvent,
  USER_ACTIONS
} from '../types/userManagement'

import { UserDataService } from './UserDataService'
import { RoleDataService } from './RoleDataService'
import { PermissionService } from './PermissionService'
import { UserValidation } from '../utils/userValidation'

export class UserManagementController {
  private static instance: UserManagementController
  private userDataService: UserDataService
  private roleDataService: RoleDataService
  private permissionService: PermissionService

  private constructor() {
    this.userDataService = UserDataService.getInstance()
    this.roleDataService = RoleDataService.getInstance()
    this.permissionService = PermissionService.getInstance()
  }

  // Singleton pattern
  public static getInstance(): UserManagementController {
    if (!UserManagementController.instance) {
      UserManagementController.instance = new UserManagementController()
    }
    return UserManagementController.instance
  }

  // ========================================
  // USER MANAGEMENT OPERATIONS
  // ========================================

  /**
   * Lấy danh sách users với permission check
   */
  async getUsers(
    currentUserId: string,
    params: UserQueryParams = {}
  ): Promise<OperationResult<UserListResponse>> {
    try {
      console.log('🔍 UserManagementController: Getting users list')

      // Check permission
      const permissionResult = await this.permissionService.checkUserPermission(
        currentUserId,
        USER_ACTIONS.VIEW_USERS
      )

      if (!permissionResult.success || !permissionResult.data?.allowed) {
        return {
          success: false,
          error: permissionResult.data?.reason || 'Permission denied',
          timestamp: new Date().toISOString()
        }
      }

      // Get users
      const usersResult = await this.userDataService.getAllUsers(params)

      if (usersResult.success) {
        console.log(`✅ Retrieved ${usersResult.data?.users?.length || 0} users`)
      }

      return usersResult

    } catch (error) {
      console.error('❌ Exception in getUsers:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Lấy thông tin user theo ID với permission check
   */
  async getUserById(
    currentUserId: string,
    targetUserId: string
  ): Promise<OperationResult<UserProfile | null>> {
    try {
      console.log(`🔍 UserManagementController: Getting user ${targetUserId}`)

      // Check permission
      const permissionResult = await this.permissionService.checkUserPermission(
        currentUserId,
        USER_ACTIONS.VIEW_USERS,
        targetUserId
      )

      if (!permissionResult.success || !permissionResult.data?.allowed) {
        return {
          success: false,
          error: permissionResult.data?.reason || 'Permission denied',
          timestamp: new Date().toISOString()
        }
      }

      // Get user
      return await this.userDataService.getUserById(targetUserId)

    } catch (error) {
      console.error('❌ Exception in getUserById:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Tạo user mới với validation và permission check
   */
  async createUser(
    currentUserId: string,
    userData: CreateUserRequest
  ): Promise<OperationResult<UserProfile>> {
    try {
      console.log('🔨 UserManagementController: Creating new user')

      // Check permission
      const permissionResult = await this.permissionService.checkUserPermission(
        currentUserId,
        USER_ACTIONS.CREATE_USER
      )

      if (!permissionResult.success || !permissionResult.data?.allowed) {
        return {
          success: false,
          error: permissionResult.data?.reason || 'Permission denied',
          timestamp: new Date().toISOString()
        }
      }

      // Validate input data
      const validation = UserValidation.validateCreateUserRequest(userData)
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          timestamp: new Date().toISOString()
        }
      }

      // Validate role exists
      const roleValidation = await this.roleDataService.validateRole(userData.role)
      if (!roleValidation.success || !roleValidation.data) {
        return {
          success: false,
          error: `Invalid role: ${userData.role}`,
          timestamp: new Date().toISOString()
        }
      }

      // Check if current user can assign this role
      const assignableRolesResult = await this.roleDataService.getAssignableRoles(
        await this.getCurrentUserRoleId(currentUserId)
      )

      if (assignableRolesResult.success && assignableRolesResult.data) {
        const canAssignRole = assignableRolesResult.data.some(role => role.id === userData.primary_role_id)
        if (!canAssignRole) {
          return {
            success: false,
            error: 'Cannot assign this role - insufficient permissions',
            timestamp: new Date().toISOString()
          }
        }
      }

      // Sanitize input data
      const sanitizedData = {
        ...userData,
        email: UserValidation.sanitizeEmail(userData.email),
        full_name: UserValidation.sanitizeFullName(userData.full_name),
        role: UserValidation.sanitizeRole(userData.role)
      }

      // Create user
      const createResult = await this.userDataService.createUser(sanitizedData)

      // Log event if successful
      if (createResult.success && createResult.data) {
        await this.logUserEvent({
          type: 'USER_CREATED',
          userId: createResult.data.id,
          data: { createdBy: currentUserId, role: userData.role },
          timestamp: new Date().toISOString(),
          triggeredBy: currentUserId
        })
      }

      return createResult

    } catch (error) {
      console.error('❌ Exception in createUser:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Cập nhật user với validation và permission check
   */
  async updateUser(
    currentUserId: string,
    targetUserId: string,
    updates: UpdateUserRequest
  ): Promise<OperationResult<UserProfile>> {
    try {
      console.log(`🔄 UserManagementController: Updating user ${targetUserId}`)

      // Check permission
      const permissionResult = await this.permissionService.checkUserPermission(
        currentUserId,
        USER_ACTIONS.UPDATE_USER,
        targetUserId
      )

      if (!permissionResult.success || !permissionResult.data?.allowed) {
        return {
          success: false,
          error: permissionResult.data?.reason || 'Permission denied',
          timestamp: new Date().toISOString()
        }
      }

      // Validate input data
      const validation = UserValidation.validateUpdateUserRequest(updates)
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          timestamp: new Date().toISOString()
        }
      }

      // Get current user data for comparison
      const currentUserData = await this.userDataService.getUserById(targetUserId)
      if (!currentUserData.success || !currentUserData.data) {
        return {
          success: false,
          error: 'Target user not found',
          timestamp: new Date().toISOString()
        }
      }

      // Check if anything actually changed
      if (!UserValidation.hasUserDataChanged(currentUserData.data, updates)) {
        return {
          success: true,
          data: currentUserData.data,
          message: 'No changes detected',
          timestamp: new Date().toISOString()
        }
      }

      // If role is being changed, validate role assignment
      if (updates.role && updates.primary_role_id) {
        const roleValidation = await this.roleDataService.validateRole(updates.role)
        if (!roleValidation.success || !roleValidation.data) {
          return {
            success: false,
            error: `Invalid role: ${updates.role}`,
            timestamp: new Date().toISOString()
          }
        }

        // Check if current user can assign this role
        const assignableRolesResult = await this.roleDataService.getAssignableRoles(
          await this.getCurrentUserRoleId(currentUserId)
        )

        if (assignableRolesResult.success && assignableRolesResult.data) {
          const canAssignRole = assignableRolesResult.data.some(role => role.id === updates.primary_role_id)
          if (!canAssignRole) {
            return {
              success: false,
              error: 'Cannot assign this role - insufficient permissions',
              timestamp: new Date().toISOString()
            }
          }
        }
      }

      // Sanitize input data
      const sanitizedUpdates = {
        ...updates
      }

      if (updates.email) {
        sanitizedUpdates.email = UserValidation.sanitizeEmail(updates.email)
      }

      if (updates.full_name) {
        sanitizedUpdates.full_name = UserValidation.sanitizeFullName(updates.full_name)
      }

      if (updates.role) {
        sanitizedUpdates.role = UserValidation.sanitizeRole(updates.role)
      }

      // Update user
      const updateResult = await this.userDataService.updateUser(targetUserId, sanitizedUpdates)

      // Log event if successful
      if (updateResult.success && updateResult.data) {
        await this.logUserEvent({
          type: 'USER_UPDATED',
          userId: targetUserId,
          data: { updatedBy: currentUserId, changes: sanitizedUpdates },
          timestamp: new Date().toISOString(),
          triggeredBy: currentUserId
        })
      }

      return updateResult

    } catch (error) {
      console.error('❌ Exception in updateUser:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Thay đổi role của user
   */
  async changeUserRole(
    currentUserId: string,
    roleChangeRequest: UserRoleChangeRequest
  ): Promise<OperationResult<UserProfile>> {
    try {
      console.log(`🔄 UserManagementController: Changing role for user ${roleChangeRequest.userId}`)

      // Validate input data
      const validation = UserValidation.validateRoleChangeRequest(roleChangeRequest)
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          timestamp: new Date().toISOString()
        }
      }

      // Check permission
      const permissionResult = await this.permissionService.checkUserPermission(
        currentUserId,
        USER_ACTIONS.CHANGE_ROLE,
        roleChangeRequest.userId
      )

      if (!permissionResult.success || !permissionResult.data?.allowed) {
        return {
          success: false,
          error: permissionResult.data?.reason || 'Permission denied',
          timestamp: new Date().toISOString()
        }
      }

      // Update user with new role
      const updateResult = await this.updateUser(currentUserId, roleChangeRequest.userId, {
        role: roleChangeRequest.newRoleName,
        primary_role_id: roleChangeRequest.newRoleId
      })

      // Log role change event if successful
      if (updateResult.success && updateResult.data) {
        await this.logUserEvent({
          type: 'ROLE_CHANGED',
          userId: roleChangeRequest.userId,
          data: {
            changedBy: currentUserId,
            newRole: roleChangeRequest.newRoleName,
            newRoleId: roleChangeRequest.newRoleId,
            reason: roleChangeRequest.reason
          },
          timestamp: new Date().toISOString(),
          triggeredBy: currentUserId
        })
      }

      return updateResult

    } catch (error) {
      console.error('❌ Exception in changeUserRole:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Deactivate user
   */
  async deactivateUser(
    currentUserId: string,
    targetUserId: string
  ): Promise<OperationResult<boolean>> {
    try {
      console.log(`🔒 UserManagementController: Deactivating user ${targetUserId}`)

      // Check permission
      const permissionResult = await this.permissionService.checkUserPermission(
        currentUserId,
        USER_ACTIONS.DEACTIVATE_USER,
        targetUserId
      )

      if (!permissionResult.success || !permissionResult.data?.allowed) {
        return {
          success: false,
          error: permissionResult.data?.reason || 'Permission denied',
          timestamp: new Date().toISOString()
        }
      }

      // Cannot deactivate self
      if (currentUserId === targetUserId) {
        return {
          success: false,
          error: 'Cannot deactivate your own account',
          timestamp: new Date().toISOString()
        }
      }

      // Deactivate user
      const result = await this.userDataService.deactivateUser(targetUserId)

      // Log event if successful
      if (result.success) {
        await this.logUserEvent({
          type: 'USER_UPDATED',
          userId: targetUserId,
          data: { deactivatedBy: currentUserId, action: 'deactivate' },
          timestamp: new Date().toISOString(),
          triggeredBy: currentUserId
        })
      }

      return result

    } catch (error) {
      console.error('❌ Exception in deactivateUser:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Activate user
   */
  async activateUser(
    currentUserId: string,
    targetUserId: string
  ): Promise<OperationResult<boolean>> {
    try {
      console.log(`🔓 UserManagementController: Activating user ${targetUserId}`)

      // Check permission
      const permissionResult = await this.permissionService.checkUserPermission(
        currentUserId,
        USER_ACTIONS.ACTIVATE_USER,
        targetUserId
      )

      if (!permissionResult.success || !permissionResult.data?.allowed) {
        return {
          success: false,
          error: permissionResult.data?.reason || 'Permission denied',
          timestamp: new Date().toISOString()
        }
      }

      // Activate user
      const result = await this.userDataService.activateUser(targetUserId)

      // Log event if successful
      if (result.success) {
        await this.logUserEvent({
          type: 'USER_UPDATED',
          userId: targetUserId,
          data: { activatedBy: currentUserId, action: 'activate' },
          timestamp: new Date().toISOString(),
          triggeredBy: currentUserId
        })
      }

      return result

    } catch (error) {
      console.error('❌ Exception in activateUser:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  /**
   * Lấy Security Context cho user
   */
  async getSecurityContext(userId: string): Promise<OperationResult<SecurityContext>> {
    try {
      return await this.permissionService.createSecurityContext(userId)
    } catch (error) {
      console.error('❌ Exception in getSecurityContext:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Lấy danh sách roles mà user có thể assign
   */
  async getAssignableRoles(userId: string) {
    try {
      const currentUserRoleId = await this.getCurrentUserRoleId(userId)
      return await this.roleDataService.getAssignableRoles(currentUserRoleId)
    } catch (error) {
      console.error('❌ Exception in getAssignableRoles:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Lấy role ID của user hiện tại
   */
  private async getCurrentUserRoleId(userId: string): Promise<string> {
    const userResult = await this.userDataService.getUserById(userId)
    if (!userResult.success || !userResult.data) {
      throw new Error('User not found')
    }
    return userResult.data.primary_role_id
  }

  /**
   * Log user event (simple console log for now)
   */
  private async logUserEvent(event: UserEvent): Promise<void> {
    try {
      console.log('📝 UserEvent:', JSON.stringify(event, null, 2))
      // In the future, this could save to a database table or send to an audit service
    } catch (error) {
      console.error('❌ Error logging user event:', error)
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats(currentUserId: string): Promise<OperationResult<Record<string, number>>> {
    try {
      // Check permission
      const permissionResult = await this.permissionService.checkUserPermission(
        currentUserId,
        USER_ACTIONS.VIEW_USERS
      )

      if (!permissionResult.success || !permissionResult.data?.allowed) {
        return {
          success: false,
          error: permissionResult.data?.reason || 'Permission denied',
          timestamp: new Date().toISOString()
        }
      }

      return await this.userDataService.getUserCountByRole()

    } catch (error) {
      console.error('❌ Exception in getUserStats:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }
}