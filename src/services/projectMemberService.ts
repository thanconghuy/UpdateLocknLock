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
  static async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    const { data, error } = await supabase
      .from('project_members')
      .select(`
        *,
        user:auth.users!inner(
          id,
          email,
          raw_user_meta_data
        )
      `)
      .eq('project_id', projectId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching project members:', error)
      throw error
    }

    // Transform data để khớp với interface
    return (data || []).map(member => ({
      id: member.id,
      project_id: member.project_id,
      user_id: member.user_id,
      role: member.role,
      assigned_by: member.invited_by || '',
      assigned_at: member.created_at,
      is_active: member.status === 'active',
      permissions: member.permissions || {},
      user: {
        id: member.user.id,
        email: member.user.email,
        full_name: member.user.raw_user_meta_data?.full_name || member.user.email,
        role: member.role,
        is_active: true
      }
    }))
  }

  // Kiểm tra quyền của user trong project
  static async getUserProjectPermissions(projectId: string, userId?: string): Promise<UserPermissions> {
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
  static async getUserProjectRole(projectId: string, userId?: string): Promise<string> {
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
    projectId: string,
    userId: string,
    role: string = 'viewer',
    permissions?: Record<string, boolean>
  ): Promise<ProjectMember> {
    const { data: currentUser } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('project_members')
      .insert({
        project_id: projectId,
        user_id: userId,
        role,
        status: 'active',
        invited_by: currentUser.user?.id,
        joined_at: new Date().toISOString(),
        permissions: permissions || {}
      })
      .select(`
        *,
        user:auth.users!inner(id, email, raw_user_meta_data)
      `)
      .single()

    if (error) {
      console.error('❌ Error adding member:', error)
      throw error
    }

    return {
      id: data.id,
      project_id: data.project_id,
      user_id: data.user_id,
      role: data.role,
      assigned_by: data.invited_by || '',
      assigned_at: data.created_at,
      is_active: true,
      permissions: data.permissions || {},
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.raw_user_meta_data?.full_name || data.user.email,
        role: data.role,
        is_active: true
      }
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

  // Tạo lời mời tham gia project
  static async createInvitation(
    projectId: string,
    email: string,
    role: string = 'viewer'
  ): Promise<ProjectInvitation> {
    const { data: currentUser } = await supabase.auth.getUser()

    // Tạo token bảo mật
    const token = crypto.randomUUID()

    const { data, error } = await supabase
      .from('project_invitations')
      .insert({
        project_id: projectId,
        email,
        role,
        invited_by: currentUser.user?.id,
        token,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 ngày
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      console.error('❌ Error creating invitation:', error)
      throw error
    }

    return data
  }

  // Lấy danh sách lời mời đang chờ
  static async getPendingInvitations(projectId: string): Promise<ProjectInvitation[]> {
    const { data, error } = await supabase
      .from('project_invitations')
      .select('*')
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('❌ Error fetching invitations:', error)
      throw error
    }

    return data || []
  }
}