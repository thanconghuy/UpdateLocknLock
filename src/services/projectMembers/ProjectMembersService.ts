import { supabase } from '@/lib/supabase'
import { ProjectRoleName } from '@/types/projectRoles'

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface ProjectMember {
  member_id: string
  project_id: number
  user_id: string
  user_email: string
  user_full_name: string | null
  user_system_role: string
  project_role: ProjectRoleName
  status: string
  permissions: Record<string, boolean>
  created_at: string
  invited_by: string | null
}

export interface AvailableUser {
  user_id: string
  email: string
  full_name: string | null
  system_role: string
  is_active: boolean
}

export interface AddMemberParams {
  projectId: number
  userId: string
  role: ProjectRoleName
  customPermissions?: Record<string, boolean>
}

export interface UpdateMemberRoleParams {
  memberId: string
  newRole: ProjectRoleName
  customPermissions?: Record<string, boolean>
}

export interface ProjectRole {
  id: number
  name: ProjectRoleName
  display_name: string
  description: string
  level: number
  default_permissions: Record<string, boolean>
  is_active: boolean
}

// =====================================================
// ERROR HANDLING
// =====================================================

class ProjectMembersError extends Error {
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'ProjectMembersError'
  }
}

// =====================================================
// SERVICE CLASS
// =====================================================

export class ProjectMembersService {
  /**
   * Get danh sách members của project
   */
  async getMembers(projectId: number, requestingUserId: string): Promise<ProjectMember[]> {
    try {
      const { data, error } = await supabase.rpc('get_project_members', {
        p_project_id: projectId,
        p_requesting_user_id: requestingUserId
      })

      if (error) {
        console.error('[ProjectMembersService] Error getting members:', error)
        throw new ProjectMembersError(this.formatError(error), error.code)
      }

      return data || []
    } catch (err) {
      if (err instanceof ProjectMembersError) throw err
      throw new ProjectMembersError('Không thể tải danh sách thành viên')
    }
  }

  /**
   * Get danh sách users có thể thêm vào project
   */
  async getAvailableUsers(projectId: number, requestingUserId: string): Promise<AvailableUser[]> {
    try {
      const { data, error } = await supabase.rpc('get_available_users_for_project', {
        p_project_id: projectId,
        p_requesting_user_id: requestingUserId
      })

      if (error) {
        console.error('[ProjectMembersService] Error getting available users:', error)
        throw new ProjectMembersError(this.formatError(error), error.code)
      }

      return data || []
    } catch (err) {
      if (err instanceof ProjectMembersError) throw err
      throw new ProjectMembersError('Không thể tải danh sách users')
    }
  }

  /**
   * Thêm member mới vào project
   */
  async addMember(params: AddMemberParams, requestingUserId: string): Promise<string> {
    try {
      const { projectId, userId, role, customPermissions } = params

      const { data, error } = await supabase.rpc('add_project_member', {
        p_project_id: projectId,
        p_user_id: userId,
        p_role: role,
        p_requesting_user_id: requestingUserId,
        p_custom_permissions: customPermissions || null
      })

      if (error) {
        console.error('[ProjectMembersService] Error adding member:', error)
        throw new ProjectMembersError(this.formatError(error), error.code)
      }

      return data
    } catch (err) {
      if (err instanceof ProjectMembersError) throw err
      throw new ProjectMembersError('Không thể thêm thành viên')
    }
  }

  /**
   * Cập nhật role của member
   */
  async updateMemberRole(params: UpdateMemberRoleParams, requestingUserId: string): Promise<boolean> {
    try {
      const { memberId, newRole, customPermissions } = params

      const { data, error } = await supabase.rpc('update_project_member_role', {
        p_member_id: memberId,
        p_new_role: newRole,
        p_requesting_user_id: requestingUserId,
        p_custom_permissions: customPermissions || null
      })

      if (error) {
        console.error('[ProjectMembersService] Error updating member role:', error)
        throw new ProjectMembersError(this.formatError(error), error.code)
      }

      return data
    } catch (err) {
      if (err instanceof ProjectMembersError) throw err
      throw new ProjectMembersError('Không thể cập nhật role')
    }
  }

  /**
   * Xóa member khỏi project
   */
  async removeMember(memberId: string, requestingUserId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('remove_project_member', {
        p_member_id: memberId,
        p_requesting_user_id: requestingUserId
      })

      if (error) {
        console.error('[ProjectMembersService] Error removing member:', error)
        throw new ProjectMembersError(this.formatError(error), error.code)
      }

      return data
    } catch (err) {
      if (err instanceof ProjectMembersError) throw err
      throw new ProjectMembersError('Không thể xóa thành viên')
    }
  }

  /**
   * Get danh sách roles có thể assign
   */
  async getAvailableRoles(): Promise<ProjectRole[]> {
    try {
      const { data, error } = await supabase
        .from('project_roles')
        .select('id, name, display_name, description, level, default_permissions, is_active')
        .eq('is_active', true)
        .order('level', { ascending: false })

      if (error) {
        console.error('[ProjectMembersService] Error getting roles:', error)
        throw new ProjectMembersError('Không thể tải danh sách roles')
      }

      return data || []
    } catch (err) {
      if (err instanceof ProjectMembersError) throw err
      throw new ProjectMembersError('Không thể tải danh sách roles')
    }
  }

  /**
   * Format error message cho user-friendly
   */
  private formatError(error: any): string {
    if (error.message) {
      // PostgreSQL RAISE EXCEPTION messages
      if (error.message.includes('Permission denied')) {
        return 'Bạn không có quyền thực hiện thao tác này'
      }
      if (error.message.includes('already a member')) {
        return 'User này đã là thành viên của project'
      }
      if (error.message.includes('Cannot assign role higher')) {
        return 'Bạn không thể assign role cao hơn role của mình'
      }
      if (error.message.includes('Cannot change your own role')) {
        return 'Bạn không thể thay đổi role của chính mình'
      }
      if (error.message.includes('Cannot remove yourself')) {
        return 'Bạn không thể xóa chính mình khỏi project'
      }
      if (error.message.includes('last admin')) {
        return 'Không thể xóa admin cuối cùng của project'
      }
      if (error.message.includes('Member not found')) {
        return 'Không tìm thấy thành viên'
      }

      return error.message
    }

    return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
  }
}

// Export singleton instance
export const projectMembersService = new ProjectMembersService()
