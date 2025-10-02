import { supabase } from '../lib/supabase'
import type { ProjectMember } from '../types/project'

export interface ProjectRole {
  id: number
  name: string
  display_name: string
  description: string
  level: number
  default_permissions: Record<string, boolean>
  is_active: boolean
}

export interface ProjectInvitation {
  id: string
  project_id: string
  email: string
  role: string
  invited_by: string
  token: string
  expires_at: string
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  created_at: string
}

export interface UserPermissions {
  can_manage_members: boolean
  can_edit_project: boolean
  can_delete_project: boolean
  can_manage_woocommerce: boolean
  can_edit_products: boolean
  can_view_analytics: boolean
}

export class ProjectMemberService {
  // Lấy tất cả role có sẵn
  static async getAvailableRoles(): Promise<ProjectRole[]> {
    const { data, error } = await supabase
      .from('project_roles')
      .select('*')
      .eq('is_active', true)
      .order('level', { ascending: false })

    if (error) {
      console.error('❌ Error fetching roles:', error)
      throw error
    }

    return data || []
  }

  // Lấy danh sách thành viên của project
  static async getProjectMembers(projectId: number): Promise<ProjectMember[]> {
    try {
      console.log('🔍 Fetching members for project:', projectId)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Use SECURITY DEFINER function to bypass RLS
      const { data, error } = await supabase.rpc('get_project_members_for_user', {
        p_project_id: projectId,
        p_user_id: user.id
      })

      if (error) {
        console.error('❌ Error fetching project members:', error)
        throw error
      }

      console.log('✅ Fetched project members:', data?.length || 0)

      // Transform data từ function result
      return (data || []).map((member: any) => ({
        id: member.id,
        project_id: member.project_id,
        user_id: member.user_id,
        role: member.role,
        assigned_by: member.invited_by || '',
        assigned_at: member.assigned_at,
        is_active: member.status === 'active',
        permissions: member.permissions || {},
        user: {
          id: member.user_id,
          email: member.user_email,
          full_name: member.user_full_name || member.user_email,
          role: member.role, // Project role
          is_active: member.user_is_active
        }
      }))
    } catch (error) {
      console.error('❌ Exception fetching project members:', error)
      throw error
    }
  }

  // Kiểm tra quyền của user trong project
  static async getUserProjectPermissions(projectId: number, userId?: string): Promise<UserPermissions> {
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id
    }

    if (!userId) {
      return {
        can_manage_members: false,
        can_edit_project: false,
        can_delete_project: false,
        can_manage_woocommerce: false,
        can_edit_products: false,
        can_view_analytics: false
      }
    }

    try {
      // Gọi function đã tạo trong database
      const { data, error } = await supabase
        .rpc('get_user_project_permissions', {
          p_project_id: projectId,
          p_user_id: userId
        })

      if (error) {
        console.error('❌ Error checking permissions:', error)
        throw error
      }

      return data || {
        can_manage_members: false,
        can_edit_project: false,
        can_delete_project: false,
        can_manage_woocommerce: false,
        can_edit_products: false,
        can_view_analytics: false
      }
    } catch (error) {
      console.error('❌ Permission check failed:', error)
      return {
        can_manage_members: false,
        can_edit_project: false,
        can_delete_project: false,
        can_manage_woocommerce: false,
        can_edit_products: false,
        can_view_analytics: false
      }
    }
  }

  // Lấy role của user trong project
  static async getUserProjectRole(projectId: number, userId?: string): Promise<string> {
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser()
      userId = user?.id
    }

    if (!userId) return 'none'

    try {
      const { data, error } = await supabase
        .rpc('get_user_project_role', {
          p_project_id: projectId,
          p_user_id: userId
        })

      if (error) {
        console.error('❌ Error checking role:', error)
        return 'none'
      }

      return data || 'none'
    } catch (error) {
      console.error('❌ Role check failed:', error)
      return 'none'
    }
  }

  // Thêm thành viên vào project
  static async addProjectMember(
    projectId: number,
    userId: string,
    role: string = 'viewer',
    permissions?: Record<string, boolean>
  ): Promise<ProjectMember> {
    try {
      console.log('➕ Adding member to project:', { projectId, userId, role })

      const { data: currentUser } = await supabase.auth.getUser()
      if (!currentUser.user) {
        throw new Error('User not authenticated')
      }

      // Use SECURITY DEFINER function to add member (bypasses RLS)
      const { data: newMemberId, error } = await supabase.rpc('add_project_member', {
        p_project_id: projectId,
        p_user_id: userId,
        p_role: role,
        p_invited_by: currentUser.user.id,
        p_permissions: permissions || {}
      })

      if (error) {
        console.error('❌ Error adding member:', error)
        throw error
      }

      console.log('✅ Added member successfully:', newMemberId)

      // Fetch the newly added member details
      const members = await this.getProjectMembers(projectId)
      const newMember = members.find(m => m.id === newMemberId)

      if (!newMember) {
        throw new Error('Failed to fetch newly added member')
      }

      return newMember
    } catch (error: any) {
      console.error('❌ Exception adding member:', error)
      // Re-throw with user-friendly message
      if (error.message?.includes('already a member')) {
        throw new Error('User đã là thành viên của project này')
      }
      if (error.message?.includes('does not have permission')) {
        throw new Error('Bạn không có quyền thêm thành viên vào project này')
      }
      throw error
    }
  }

  // Cập nhật role/quyền của thành viên
  static async updateMemberRole(
    memberId: string,
    role: string,
    permissions?: Record<string, boolean>
  ): Promise<void> {
    const updateData: any = { role, updated_at: new Date().toISOString() }
    if (permissions) {
      updateData.permissions = permissions
    }

    const { error } = await supabase
      .from('project_members')
      .update(updateData)
      .eq('id', memberId)

    if (error) {
      console.error('❌ Error updating member:', error)
      throw error
    }
  }

  // Xóa thành viên khỏi project
  static async removeMember(memberId: string): Promise<void> {
    const { error } = await supabase
      .from('project_members')
      .update({
        status: 'removed',
        updated_at: new Date().toISOString()
      })
      .eq('id', memberId)

    if (error) {
      console.error('❌ Error removing member:', error)
      throw error
    }
  }

  // Lấy danh sách users có thể thêm vào project (chưa là member)
  static async getAvailableUsers(projectId: number): Promise<Array<{
    id: string
    email: string
    full_name: string | null
    role: string
  }>> {
    try {
      console.log('🔍 Fetching available users for project:', projectId)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      // Use SECURITY DEFINER function to bypass RLS and avoid infinite recursion
      const { data, error } = await supabase.rpc('get_available_users_for_project', {
        p_project_id: projectId,
        p_user_id: user.id
      })

      if (error) {
        console.error('❌ Error fetching available users:', error)
        throw error
      }

      console.log('✅ Available users to add:', data?.length || 0)

      return (data || []).map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }))
    } catch (error) {
      console.error('❌ Exception fetching available users:', error)
      throw error
    }
  }
}