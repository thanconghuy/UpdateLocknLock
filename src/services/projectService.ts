import { supabase } from '../lib/supabase'
import {
  Project,
  ProjectMember,
  CreateProjectData,
  UpdateProjectData,
  ProjectWithMembers
} from '../types/project'

export class ProjectService {

  // Lấy tất cả projects của user hiện tại
  static async getUserProjects(): Promise<ProjectWithMembers[]> {
    try {
      console.log('🔍 Starting getUserProjects...')

      // Check if table exists first
      console.log('🔍 Checking if projects table exists...')

      // First try simple query without JOINs to avoid 500 errors
      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching user projects:')
        console.error('Error message:', error.message)
        console.error('Error details:', error.details)
        console.error('Error hint:', error.hint)
        console.error('Error code:', error.code)
        return []
      }

      console.log('✅ Raw projects data:', projects)

      // Transform data to include default member info (without JOIN for now)
      const projectsWithMembers: ProjectWithMembers[] = projects?.map(project => ({
        ...project,
        members: [], // Empty for now until project_members table is properly set up
        member_count: 0,
        user_role: 'admin' as any // Default to admin for project owner
      })) || []

      console.log('✅ Fetched user projects:', projectsWithMembers.length)
      return projectsWithMembers
    } catch (error: any) {
      console.error('❌ Exception fetching user projects:')
      console.error('Exception message:', error?.message)
      console.error('Exception stack:', error?.stack)
      return []
    }
  }

  // Lấy project theo ID
  static async getProjectById(projectId: string): Promise<Project | null> {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .eq('is_active', true)
        .single()

      if (error) {
        console.error('❌ Error fetching project:', error)
        return null
      }

      console.log('✅ Fetched project:', project.name)
      return project as Project
    } catch (error) {
      console.error('❌ Exception fetching project:', error)
      return null
    }
  }

  // Tạo project mới
  static async createProject(projectData: CreateProjectData): Promise<Project | null> {
    try {
      // Generate slug
      const slug = await this.generateSlug(projectData.name)

      const { data: project, error } = await supabase
        .from('projects')
        .insert([
          {
            name: projectData.name,
            description: projectData.description,
            slug: slug,
            woocommerce_base_url: projectData.woocommerce_base_url,
            woocommerce_consumer_key: projectData.woocommerce_consumer_key,
            woocommerce_consumer_secret: projectData.woocommerce_consumer_secret,
            products_table: projectData.products_table || 'products',
            audit_table: projectData.audit_table || 'product_updates',
            settings: projectData.settings || {},
            owner_id: (await supabase.auth.getUser()).data.user?.id
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating project:', error)
        return null
      }

      console.log('✅ Created project:', project.name)
      return project as Project
    } catch (error) {
      console.error('❌ Exception creating project:', error)
      return null
    }
  }

  // Cập nhật project
  static async updateProject(projectData: UpdateProjectData): Promise<boolean> {
    try {
      const updateData: any = { ...projectData }
      delete updateData.id

      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectData.id)

      if (error) {
        console.error('❌ Error updating project:', error)
        return false
      }

      console.log('✅ Updated project:', projectData.id)
      return true
    } catch (error) {
      console.error('❌ Exception updating project:', error)
      return false
    }
  }

  // Xóa project (soft delete)
  static async deleteProject(projectId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_active: false })
        .eq('id', projectId)

      if (error) {
        console.error('❌ Error deleting project:', error)
        return false
      }

      console.log('✅ Deleted project:', projectId)
      return true
    } catch (error) {
      console.error('❌ Exception deleting project:', error)
      return false
    }
  }

  // Lấy members của project
  static async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    try {
      const { data: members, error } = await supabase
        .from('project_members')
        .select(`
          *,
          user_profiles (
            email,
            full_name,
            avatar_url
          )
        `)
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching project members:', error)
        return []
      }

      const projectMembers: ProjectMember[] = members?.map(member => ({
        ...member,
        user_profile: member.user_profiles
      })) || []

      console.log('✅ Fetched project members:', projectMembers.length)
      return projectMembers
    } catch (error) {
      console.error('❌ Exception fetching project members:', error)
      return []
    }
  }

  // Thêm member vào project
  static async addProjectMember(
    projectId: string,
    userEmail: string,
    role: 'admin' | 'editor' | 'viewer' = 'viewer'
  ): Promise<boolean> {
    try {
      // Tìm user theo email
      const { data: userProfile, error: userError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', userEmail)
        .single()

      if (userError || !userProfile) {
        console.error('❌ User not found:', userEmail)
        return false
      }

      // Thêm member
      const { error } = await supabase
        .from('project_members')
        .insert([
          {
            project_id: projectId,
            user_id: userProfile.id,
            role: role,
            invited_by: (await supabase.auth.getUser()).data.user?.id,
            joined_at: new Date().toISOString(),
            is_active: true
          }
        ])

      if (error) {
        console.error('❌ Error adding project member:', error)
        return false
      }

      console.log('✅ Added project member:', userEmail)
      return true
    } catch (error) {
      console.error('❌ Exception adding project member:', error)
      return false
    }
  }

  // Xóa member khỏi project
  static async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ is_active: false })
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Error removing project member:', error)
        return false
      }

      console.log('✅ Removed project member:', userId)
      return true
    } catch (error) {
      console.error('❌ Exception removing project member:', error)
      return false
    }
  }

  // Cập nhật role của member
  static async updateMemberRole(
    projectId: string,
    userId: string,
    newRole: 'admin' | 'editor' | 'viewer'
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('project_id', projectId)
        .eq('user_id', userId)

      if (error) {
        console.error('❌ Error updating member role:', error)
        return false
      }

      console.log('✅ Updated member role:', userId, 'to', newRole)
      return true
    } catch (error) {
      console.error('❌ Exception updating member role:', error)
      return false
    }
  }

  // Test kết nối WooCommerce với credentials của project
  static async testWooCommerceConnection(project: Project): Promise<boolean> {
    try {
      if (!project.woocommerce_consumer_key || !project.woocommerce_consumer_secret) {
        console.error('❌ Missing WooCommerce credentials in project')
        return false
      }

      // Test connection với project-specific credentials
      const result = await this.testWooCommerceWithCredentials(
        project.woocommerce_base_url,
        project.woocommerce_consumer_key,
        project.woocommerce_consumer_secret
      )

      return result.success
    } catch (error) {
      console.error('❌ WooCommerce connection test failed:', error)
      return false
    }
  }

  // Helper method để test WooCommerce connection với credentials cụ thể
  static async testWooCommerceWithCredentials(
    baseUrl: string,
    consumerKey: string,
    consumerSecret: string,
    timeout: number = 10000
  ): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!consumerKey || !consumerSecret) {
        return {
          success: false,
          message: 'Consumer Key hoặc Consumer Secret không hợp lệ'
        }
      }

      // Clean base URL
      const cleanBaseUrl = baseUrl.replace(/\/$/, '')
      const testUrl = `${cleanBaseUrl}/wp-json/wc/v3/system_status`

      // Create basic auth header
      const credentials = btoa(`${consumerKey}:${consumerSecret}`)

      // AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      return {
        success: true,
        message: 'Kết nối WooCommerce thành công!',
        data: {
          version: data.environment?.version || 'Unknown',
          store_name: data.settings?.title || 'Unknown Store'
        }
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Lỗi kết nối: ${err.message}`
      }
    }
  }

  // Utility: Generate unique slug
  private static async generateSlug(name: string): Promise<string> {
    try {
      // Simple fallback slug generation (avoid RPC for now)
      const baseSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50)

      // Add timestamp for uniqueness
      return `${baseSlug}-${Date.now()}`
    } catch (error) {
      console.error('❌ Exception generating slug:', error)
      return `project-${Date.now()}`
    }
  }

  // Utility: Check user permission in project
  static async getUserProjectRole(projectId: string, userId?: string): Promise<'owner' | 'admin' | 'editor' | 'viewer' | null> {
    try {
      const currentUserId = userId || (await supabase.auth.getUser()).data.user?.id

      if (!currentUserId) return null

      // First check if user is the project owner
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('owner_id')
        .eq('id', projectId)
        .single()

      if (projectError) {
        console.error('❌ Error checking project ownership:', projectError)
        return null
      }

      // If user is project owner, return admin role
      if (project?.owner_id === currentUserId) {
        return 'admin'
      }

      // For now, return viewer for non-owners (until project_members table is set up)
      return 'viewer'
    } catch (error) {
      console.error('❌ Exception checking user project role:', error)
      return null
    }
  }
}