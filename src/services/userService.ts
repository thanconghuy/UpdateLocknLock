import { UserRole, UserProfile, RolePermissions } from '../types/auth'
import { supabase } from '../lib/supabase'
import { createPermissionChecker } from '../utils/permissions'

export class UserService {
  // Tạo user profile mới
  static async createUserProfile(userData: {
    email: string
    full_name?: string
    role?: UserRole
    created_by?: string
  }): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('user_profiles')
      .insert({
        email: userData.email,
        full_name: userData.full_name,
        role: userData.role || UserRole.VIEWER,
        is_active: true,
        created_by: userData.created_by,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create user profile: ${error.message}`)
    }

    return data as UserProfile
  }

  // Lấy user profile hiện tại
  static async getCurrentUserProfile(): Promise<UserProfile | null> {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        return null
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data as UserProfile
    } catch (err) {
      console.error('Error in getCurrentUserProfile:', err)
      return null
    }
  }

  // Cập nhật user profile
  static async updateUserProfile(userId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update user profile: ${error.message}`)
    }

    return data as UserProfile
  }

  // Lấy tất cả user profiles (admin only)
  static async getAllUserProfiles(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch user profiles: ${error.message}`)
    }

    return data as UserProfile[]
  }

  // Kiểm tra permissions dựa trên role - Sử dụng permissions.ts
  static getRolePermissions(role: UserRole): RolePermissions {
    const mockUser: UserProfile = {
      id: 'temp',
      email: 'temp@temp.com',
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    }

    const checker = createPermissionChecker(mockUser)
    return {
      // System permissions
      canManageUsers: checker.canManageUsers(),
      canManageSettings: checker.canManageSettings(),
      canViewAllLogs: checker.canViewAllLogs(),
      canManageSystem: checker.canManageSystem(),

      // Project permissions
      canCreateProjects: checker.canCreateProjects(),
      canDeleteProjects: checker.canDeleteProjects(),
      canViewAllProjects: checker.canViewAllProjects(),
      canManageOwnProjects: checker.canManageOwnProjects(),
      canManageProjectMembers: checker.canManageProjectMembers(),

      // Product permissions
      canEditProducts: checker.canEditProducts(),
      canImportData: checker.canImportData(),
      canExportData: checker.canExportData(),
      canViewProducts: checker.canViewProducts(),

      // Report permissions
      canViewAllReports: checker.canViewAllReports(),
      canViewOwnReports: checker.canViewOwnReports(),
      canExportReports: checker.canExportReports(),

      // Limits
      maxProjects: checker.getMaxProjects(),
      maxTeamMembers: checker.getMaxTeamMembers()
    }
  }

  // Kiểm tra xem user có thể thực hiện action không
  static canUserPerformAction(userProfile: UserProfile, action: string): boolean {
    const checker = createPermissionChecker(userProfile)

    switch (action) {
      case 'manage_users':
        return checker.canManageUsers()
      case 'manage_settings':
        return checker.canManageSettings()
      case 'create_projects':
        return checker.canCreateProjects()
      case 'edit_products':
        return checker.canEditProducts()
      case 'import_data':
        return checker.canImportData()
      case 'export_data':
        return checker.canExportData()
      case 'view_all_reports':
        return checker.canViewAllReports()
      default:
        return false
    }
  }

  // Lấy mô tả role
  static getRoleDescription(role: UserRole): string {
    const mockUser: UserProfile = {
      id: 'temp',
      email: 'temp@temp.com',
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_active: true
    }

    return createPermissionChecker(mockUser).getRoleDescription()
  }

  // Log user activity
  static async logUserActivity(activity: {
    user_id: string
    action: string
    resource_type?: string
    resource_id?: string
    details?: Record<string, any>
  }): Promise<void> {
    try {
      await supabase
        .from('user_activity_logs')
        .insert({
          ...activity,
          created_at: new Date().toISOString()
        })
    } catch (error) {
      console.error('Error logging user activity:', error)
      // Don't throw error for logging failures
    }
  }

  // Suspend/unsuspend user
  static async toggleUserSuspension(userId: string, reason?: string): Promise<UserProfile> {
    const { data: currentUser, error: fetchError } = await supabase
      .from('user_profiles')
      .select('is_suspended')
      .eq('id', userId)
      .single()

    if (fetchError) {
      throw new Error(`Failed to fetch user: ${fetchError.message}`)
    }

    const newSuspendedStatus = !currentUser.is_suspended

    const { data, error } = await supabase
      .from('user_profiles')
      .update({
        is_suspended: newSuspendedStatus,
        suspended_reason: newSuspendedStatus ? reason : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update user suspension: ${error.message}`)
    }

    return data as UserProfile
  }
}