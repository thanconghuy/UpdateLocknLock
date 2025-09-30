// =======================================
// ROLE DATA SERVICE - Database Operations
// =======================================

import { supabase } from '../lib/supabase'
import {
  Role,
  OperationResult,
  UserManagementError,
  PermissionCheckResult,
  ROLE_LEVELS
} from '../types/userManagement'

export class RoleDataService {
  private static instance: RoleDataService
  private readonly tableName = 'roles'

  // Singleton pattern để đảm bảo chỉ có 1 instance
  public static getInstance(): RoleDataService {
    if (!RoleDataService.instance) {
      RoleDataService.instance = new RoleDataService()
    }
    return RoleDataService.instance
  }

  // ========================================
  // CORE ROLE OPERATIONS
  // ========================================

  /**
   * Lấy tất cả roles có sẵn trong hệ thống
   */
  async getAllRoles(): Promise<OperationResult<Role[]>> {
    try {
      console.log('🔍 RoleDataService: Getting all roles')

      const { data: roles, error } = await supabase
        .from(this.tableName)
        .select(`
          id,
          name,
          display_name,
          level,
          created_at,
          updated_at
        `)
        .order('level', { ascending: false }) // Sắp xếp theo level cao xuống thấp

      if (error) {
        console.error('❌ Error getting roles:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`✅ Retrieved ${roles?.length || 0} roles`)

      return {
        success: true,
        data: roles || [],
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in getAllRoles:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Lấy role theo ID
   */
  async getRoleById(id: string): Promise<OperationResult<Role | null>> {
    try {
      console.log(`🔍 RoleDataService: Getting role by ID: ${id}`)

      const { data: role, error } = await supabase
        .from(this.tableName)
        .select(`
          id,
          name,
          display_name,
          level,
          created_at,
          updated_at
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`⚠️ Role not found: ${id}`)
          return {
            success: true,
            data: null,
            message: 'Role not found',
            timestamp: new Date().toISOString()
          }
        }

        console.error('❌ Error getting role by ID:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`✅ Found role: ${role.name}`)
      return {
        success: true,
        data: role,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in getRoleById:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Lấy role theo tên
   */
  async getRoleByName(name: string): Promise<OperationResult<Role | null>> {
    try {
      console.log(`🔍 RoleDataService: Getting role by name: ${name}`)

      const { data: role, error } = await supabase
        .from(this.tableName)
        .select(`
          id,
          name,
          display_name,
          level,
          created_at,
          updated_at
        `)
        .eq('name', name)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`⚠️ Role not found: ${name}`)
          return {
            success: true,
            data: null,
            message: 'Role not found',
            timestamp: new Date().toISOString()
          }
        }

        console.error('❌ Error getting role by name:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`✅ Found role: ${role.name} (${role.display_name})`)
      return {
        success: true,
        data: role,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in getRoleByName:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  // ========================================
  // PERMISSION & HIERARCHY OPERATIONS
  // ========================================

  /**
   * Kiểm tra quyền hạn giữa 2 roles
   * @param currentRoleId Role hiện tại của user
   * @param targetRoleId Role được yêu cầu hoặc target role
   * @param action Hành động cần kiểm tra
   */
  async checkRolePermission(
    currentRoleId: string,
    targetRoleId: string,
    action: string
  ): Promise<OperationResult<PermissionCheckResult>> {
    try {
      console.log(`🔐 RoleDataService: Checking permission - Current: ${currentRoleId}, Target: ${targetRoleId}, Action: ${action}`)

      // Lấy thông tin cả 2 roles
      const [currentRoleResult, targetRoleResult] = await Promise.all([
        this.getRoleById(currentRoleId),
        this.getRoleById(targetRoleId)
      ])

      if (!currentRoleResult.success || !currentRoleResult.data) {
        return {
          success: false,
          error: 'Current role not found',
          timestamp: new Date().toISOString()
        }
      }

      if (!targetRoleResult.success || !targetRoleResult.data) {
        return {
          success: false,
          error: 'Target role not found',
          timestamp: new Date().toISOString()
        }
      }

      const currentRole = currentRoleResult.data
      const targetRole = targetRoleResult.data

      // Logic kiểm tra quyền theo hierarchy
      const currentLevel = currentRole.level
      const targetLevel = targetRole.level

      let allowed = false
      let reason = ''

      // Admin có thể làm tất cả
      if (currentRole.name === 'admin') {
        allowed = true
        reason = 'Admin has full permissions'
      }
      // Không thể thay đổi role cao hơn hoặc bằng mình
      else if (action.includes('CHANGE_ROLE') || action.includes('UPDATE_USER')) {
        if (currentLevel <= targetLevel) {
          allowed = false
          reason = `Cannot modify user with equal or higher role level (${currentLevel} <= ${targetLevel})`
        } else {
          allowed = true
          reason = 'Role level sufficient for modification'
        }
      }
      // Các action khác
      else {
        allowed = currentLevel >= targetLevel
        reason = allowed
          ? 'Role level sufficient'
          : `Insufficient role level (${currentLevel} < ${targetLevel})`
      }

      console.log(`✅ Permission check result: ${allowed} - ${reason}`)

      return {
        success: true,
        data: {
          allowed,
          reason,
          requiredLevel: targetLevel,
          userLevel: currentLevel
        },
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in checkRolePermission:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Lấy danh sách roles mà user có thể assign cho users khác
   * @param currentRoleId Role hiện tại của user
   */
  async getAssignableRoles(currentRoleId: string): Promise<OperationResult<Role[]>> {
    try {
      console.log(`🔍 RoleDataService: Getting assignable roles for: ${currentRoleId}`)

      const currentRoleResult = await this.getRoleById(currentRoleId)
      if (!currentRoleResult.success || !currentRoleResult.data) {
        return {
          success: false,
          error: 'Current role not found',
          timestamp: new Date().toISOString()
        }
      }

      const currentRole = currentRoleResult.data
      const allRolesResult = await this.getAllRoles()

      if (!allRolesResult.success) {
        return allRolesResult
      }

      // Admin có thể assign tất cả roles
      if (currentRole.name === 'admin') {
        console.log('✅ Admin can assign all roles')
        return {
          success: true,
          data: allRolesResult.data || [],
          timestamp: new Date().toISOString()
        }
      }

      // Các role khác chỉ có thể assign roles thấp hơn
      const assignableRoles = (allRolesResult.data || []).filter(role =>
        role.level < currentRole.level
      )

      console.log(`✅ Found ${assignableRoles.length} assignable roles`)

      return {
        success: true,
        data: assignableRoles,
        timestamp: new Date().toISOString()
      }

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
   * Validate role name và level
   */
  async validateRole(roleName: string): Promise<OperationResult<boolean>> {
    try {
      console.log(`🔍 RoleDataService: Validating role: ${roleName}`)

      // Kiểm tra role có tồn tại không
      const roleResult = await this.getRoleByName(roleName)

      if (!roleResult.success) {
        return {
          success: false,
          error: roleResult.error,
          timestamp: new Date().toISOString()
        }
      }

      if (!roleResult.data) {
        return {
          success: false,
          error: `Invalid role: ${roleName}`,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`✅ Role validated: ${roleName}`)
      return {
        success: true,
        data: true,
        message: 'Role is valid',
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in validateRole:', error)
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
   * Lấy default role cho new users
   */
  async getDefaultRole(): Promise<OperationResult<Role | null>> {
    try {
      console.log('🔍 RoleDataService: Getting default role')

      // Mặc định là viewer role
      return await this.getRoleByName('viewer')

    } catch (error) {
      console.error('❌ Exception in getDefaultRole:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Lấy admin role
   */
  async getAdminRole(): Promise<OperationResult<Role | null>> {
    try {
      console.log('🔍 RoleDataService: Getting admin role')

      return await this.getRoleByName('admin')

    } catch (error) {
      console.error('❌ Exception in getAdminRole:', error)
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
  async isAdminRole(roleId: string): Promise<OperationResult<boolean>> {
    try {
      const roleResult = await this.getRoleById(roleId)

      if (!roleResult.success || !roleResult.data) {
        return {
          success: false,
          error: 'Role not found',
          timestamp: new Date().toISOString()
        }
      }

      const isAdmin = roleResult.data.name === 'admin'

      return {
        success: true,
        data: isAdmin,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in isAdminRole:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }
}