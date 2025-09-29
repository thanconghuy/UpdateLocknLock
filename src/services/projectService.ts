import { supabase } from '../lib/supabase'
import {
  Project,
  ProjectMember,
  CreateProjectData,
  UpdateProjectData,
  ProjectWithMembers
} from '../types/project'

interface ValidationResult {
  isValid: boolean
  errors: string[]
}

interface WooCommerceTestData {
  woocommerce_base_url: string
  woocommerce_consumer_key: string
  woocommerce_consumer_secret: string
}

export class ProjectService {

  // Validation helpers
  static validateProjectData(data: Partial<CreateProjectData | UpdateProjectData>): ValidationResult {
    const errors: string[] = []

    // Required fields validation
    if (data.name && (!data.name.trim() || data.name.trim().length < 2)) {
      errors.push('Tên project phải có ít nhất 2 ký tự')
    }

    if (data.name && data.name.trim().length > 100) {
      errors.push('Tên project không được quá 100 ký tự')
    }

    if (data.description && data.description.length > 500) {
      errors.push('Mô tả không được quá 500 ký tự')
    }

    // WooCommerce URL validation
    if (data.woocommerce_base_url) {
      try {
        new URL(data.woocommerce_base_url)
      } catch {
        errors.push('URL WooCommerce không hợp lệ')
      }
    }

    // Consumer key validation
    if (data.woocommerce_consumer_key && !data.woocommerce_consumer_key.startsWith('ck_')) {
      errors.push('Consumer Key phải bắt đầu bằng "ck_"')
    }

    // Consumer secret validation
    if (data.woocommerce_consumer_secret && !data.woocommerce_consumer_secret.startsWith('cs_')) {
      errors.push('Consumer Secret phải bắt đầu bằng "cs_"')
    }

    // Table name validation
    if (data.products_table && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(data.products_table)) {
      errors.push('Tên bảng products chỉ được chứa chữ cái, số và dấu gạch dưới')
    }

    if (data.audit_table && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(data.audit_table)) {
      errors.push('Tên bảng audit chỉ được chứa chữ cái, số và dấu gạch dưới')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // Test WooCommerce connection
  static async testWooCommerceConnection(data: WooCommerceTestData): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🧪 Testing WooCommerce connection...')

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const auth = btoa(`${data.woocommerce_consumer_key}:${data.woocommerce_consumer_secret}`)
      const testUrl = `${data.woocommerce_base_url}/wp-json/wc/v3/system_status`

      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        }
      }

      console.log('✅ WooCommerce connection successful')
      return { success: true }

    } catch (error: any) {
      console.error('❌ WooCommerce connection test failed:', error)

      if (error.name === 'AbortError') {
        return { success: false, error: 'Connection timeout' }
      }

      return {
        success: false,
        error: error.message || 'Connection failed'
      }
    }
  }

  // Lấy tất cả projects của user hiện tại (bao gồm cả projects đã xóa cho admin)
  static async getUserProjects(includeDeleted: boolean = false): Promise<ProjectWithMembers[]> {
    try {
      console.log('🔍 Starting getUserProjects with includeDeleted:', includeDeleted)

      // Check if table exists first
      console.log('🔍 Checking if projects table exists...')

      let query = supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (!includeDeleted) {
        // Normal query: active AND inactive projects (but not deleted)
        console.log('📋 Loading ACTIVE and INACTIVE projects (not deleted)...')
        query = query.is('deleted_at', null) // Show both active and inactive, but not deleted
      } else {
        // Admin query: include soft-deleted projects within 7 days + active + inactive
        console.log('📋 Loading ALL projects (including deleted for admin)...')
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        console.log('📅 Seven days ago cutoff:', sevenDaysAgo)
        query = query.or(`deleted_at.is.null,and(is_active.eq.false,deleted_at.gte.${sevenDaysAgo})`)
      }

      const { data: projects, error } = await query

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

  // Lấy project theo ID (bao gồm cả projects đã xóa nếu cần)
  static async getProjectById(projectId: string, includeDeleted: boolean = false): Promise<Project | null> {
    try {
      let query = supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)

      if (!includeDeleted) {
        query = query.eq('is_active', true).is('deleted_at', null)
      }

      const { data: project, error } = await query.single()

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

      // Generate next project_id
      const projectId = await this.generateNextProjectId()

      const { data: project, error } = await supabase
        .from('projects')
        .insert([
          {
            project_id: projectId,  // 🆕 Add project_id
            name: projectData.name,
            description: projectData.description,
            slug: slug,
            woocommerce_base_url: projectData.woocommerce_base_url,
            woocommerce_consumer_key: projectData.woocommerce_consumer_key,
            woocommerce_consumer_secret: projectData.woocommerce_consumer_secret,
            products_table: 'products_new', // Hardcoded for consistency
            audit_table: 'product_updates', // Hardcoded for consistency
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

  // Cập nhật project với validation
  static async updateProject(projectData: UpdateProjectData): Promise<boolean> {
    try {
      console.log('🔄 Updating project:', projectData.id)

      // Validation
      const validationResult = this.validateProjectData(projectData)
      if (!validationResult.isValid) {
        console.error('❌ Project validation failed:', validationResult.errors)
        return false
      }

      // Safety check: Verify user has permission to update
      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('id, name, owner_id, woocommerce_base_url, woocommerce_consumer_key, woocommerce_consumer_secret')
        .eq('id', projectData.id)
        .single()

      if (fetchError || !project) {
        console.error('❌ Project not found or access denied:', fetchError)
        return false
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('❌ User not authenticated for project update')
        return false
      }

      // Check if user can update (owner, admin, or manager)
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const canUpdate = project.owner_id === user.id ||
                       userProfile?.role === 'admin' ||
                       userProfile?.role === 'manager'

      if (!canUpdate) {
        console.error('❌ User does not have permission to update this project')
        return false
      }

      // Prepare update data
      const updateData: any = { ...projectData }
      delete updateData.id
      updateData.updated_at = new Date().toISOString()

      // Test WooCommerce connection if credentials changed
      if (updateData.woocommerce_base_url ||
          updateData.woocommerce_consumer_key ||
          updateData.woocommerce_consumer_secret) {

        const testResult = await this.testWooCommerceConnection({
          woocommerce_base_url: updateData.woocommerce_base_url || project.woocommerce_base_url,
          woocommerce_consumer_key: updateData.woocommerce_consumer_key || project.woocommerce_consumer_key,
          woocommerce_consumer_secret: updateData.woocommerce_consumer_secret || project.woocommerce_consumer_secret
        })

        if (!testResult.success) {
          console.error('❌ WooCommerce connection test failed:', testResult.error)
          // Allow update but log warning
          console.warn('⚠️ Proceeding with update despite WooCommerce connection failure')
        }
      }

      console.log('🔍 About to execute UPDATE query:', {
        projectDataId: projectData.id,
        projectName: project.name,
        updateData,
        query: `UPDATE projects SET ${Object.keys(updateData).map(k => `${k} = '${updateData[k]}'`).join(', ')} WHERE id = '${projectData.id}'`
      })

      const { error, data: updateResult } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', projectData.id)
        .select() // Return updated rows to verify

      console.log('🔍 UPDATE query result:', {
        error,
        updateResult,
        rowsUpdated: updateResult?.length || 0
      })

      if (error) {
        console.error('❌ Error updating project:', error)
        return false
      }

      if (!updateResult || updateResult.length === 0) {
        console.error('❌ No rows were updated! Project ID may not exist:', projectData.id)
        return false
      }

      if (updateResult.length > 1) {
        console.error('🚨 CRITICAL: Multiple rows updated! This should never happen:', updateResult.length)
        return false
      }

      console.log('✅ Updated project:', project.name, 'Updated row:', updateResult[0])
      return true
    } catch (error) {
      console.error('❌ Exception updating project:', error)
      return false
    }
  }

  // Xóa project với 2-tier deletion strategy
  static async deleteProject(projectId: string, permanentDelete: boolean = false): Promise<boolean> {
    try {
      console.log(`🔄 ${permanentDelete ? 'Permanent' : 'Soft'} deleting project:`, projectId)

      // Safety check: Verify user has permission to delete
      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('id, name, owner_id, is_active, deleted_at')
        .eq('id', projectId)
        .single()

      if (fetchError || !project) {
        console.error('❌ Project not found or access denied:', fetchError)
        return false
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('❌ User not authenticated for project deletion')
        return false
      }

      // Check if user can delete (owner, admin, or manager)
      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const canDelete = project.owner_id === user.id ||
                       ['admin', 'manager'].includes(userProfile?.role)
      if (!canDelete) {
        console.error('❌ User does not have permission to delete this project')
        return false
      }

      if (permanentDelete) {
        // Permanent delete - remove project and cascade all related data
        return await this.permanentDeleteProject(projectId, project.name)
      } else {
        // Soft delete - mark as inactive with deleted_at timestamp
        const now = new Date().toISOString()
        const { error } = await supabase
          .from('projects')
          .update({
            is_active: false,
            deleted_at: now,
            updated_at: now
          })
          .eq('id', projectId)

        if (error) {
          console.error('❌ Error soft deleting project:', error)
          return false
        }

        console.log('✅ Soft deleted project (7-day recovery period):', project.name)
      }

      return true
    } catch (error) {
      console.error('❌ Exception deleting project:', error)
      return false
    }
  }

  // Khôi phục project đã xóa (trong vòng 7 ngày)
  static async restoreProject(projectId: string): Promise<boolean> {
    try {
      console.log('🔄 Restoring project:', projectId)

      // Get project info (including deleted projects)
      const { data: project, error: fetchError } = await supabase
        .from('projects')
        .select('id, name, owner_id, deleted_at')
        .eq('id', projectId)
        .eq('is_active', false)
        .not('deleted_at', 'is', null)
        .single()

      if (fetchError || !project) {
        console.error('❌ Deleted project not found:', fetchError)
        return false
      }

      // Check if within 7-day recovery period
      const deletedAt = new Date(project.deleted_at)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      if (deletedAt < sevenDaysAgo) {
        console.error('❌ Project deleted more than 7 days ago, cannot restore')
        return false
      }

      // Check user permission
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('❌ User not authenticated for project restore')
        return false
      }

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const canRestore = project.owner_id === user.id ||
                        ['admin', 'manager'].includes(userProfile?.role)
      if (!canRestore) {
        console.error('❌ User does not have permission to restore this project')
        return false
      }

      // Restore project
      const { error } = await supabase
        .from('projects')
        .update({
          is_active: true,
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)

      if (error) {
        console.error('❌ Error restoring project:', error)
        return false
      }

      console.log('✅ Restored project:', project.name)
      return true
    } catch (error) {
      console.error('❌ Exception restoring project:', error)
      return false
    }
  }

  // Xóa vĩnh viễn project và cascade all related data
  private static async permanentDeleteProject(projectId: string, projectName: string): Promise<boolean> {
    try {
      console.log('🔥 ===== PERMANENT DELETE CASCADE STARTING =====')
      console.log('🎯 Target project:', { id: projectId, name: projectName })

      // Delete in specific order to avoid foreign key constraints

      // 1. Delete project members (skip if table doesn't exist)
      console.log('🔄 Step 1: Deleting project members...')
      const { data: membersDeleted, error: membersError } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .select()

      if (membersError) {
        if (membersError.code === 'PGRST205') {
          console.log('⚠️ project_members table does not exist, skipping...')
        } else {
          console.error('❌ Error deleting project members:', membersError)
          return false
        }
      } else {
        console.log('✅ Deleted project members:', membersDeleted?.length || 0)
      }

      // 2. Delete product updates/audit logs (skip if table doesn't exist or no project_id column)
      console.log('🔄 Step 2: Deleting product updates...')
      const { data: updatesDeleted, error: updatesError } = await supabase
        .from('product_updates')
        .delete()
        .eq('project_id', projectId)
        .select()

      if (updatesError) {
        if (updatesError.code === 'PGRST205') {
          console.log('⚠️ product_updates table does not exist, skipping...')
        } else if (updatesError.code === '42703') {
          console.log('⚠️ product_updates table exists but no project_id column, skipping...')
        } else {
          console.error('❌ Error deleting product updates:', updatesError)
          return false
        }
      } else {
        console.log('✅ Deleted product updates:', updatesDeleted?.length || 0)
      }

      // 3. Delete products (skip if table doesn't exist or no project_id column)
      console.log('🔄 Step 3: Deleting products...')
      const { data: productsDeleted, error: productsError } = await supabase
        .from('products_new')
        .delete()
        .eq('project_id', projectId)
        .select()

      if (productsError) {
        if (productsError.code === 'PGRST205') {
          console.log('⚠️ products_new table does not exist, skipping...')
        } else if (productsError.code === '42703') {
          console.log('⚠️ products_new table exists but no project_id column, skipping...')
        } else {
          console.error('❌ Error deleting products:', productsError)
          return false
        }
      } else {
        console.log('✅ Deleted products:', productsDeleted?.length || 0)
      }

      // 4. Finally delete the project itself
      console.log('🔄 Step 4: Deleting the project record...')
      const { data: projectDeleted, error: projectError } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .select()

      if (projectError) {
        console.error('❌ Error deleting project:', projectError)
        return false
      }

      console.log('✅ Deleted project record:', projectDeleted?.length || 0)
      console.log('🎉 ===== PERMANENT DELETE CASCADE COMPLETED =====')
      console.log('📊 Summary:', {
        projectName,
        projectId,
        membersDeleted: membersError?.code === 'PGRST205' ? 'SKIPPED (table not exists)' : (membersDeleted?.length || 0),
        updatesDeleted: updatesError?.code === 'PGRST205' ? 'SKIPPED (table not exists)' :
                       updatesError?.code === '42703' ? 'SKIPPED (no project_id column)' : (updatesDeleted?.length || 0),
        productsDeleted: productsError?.code === 'PGRST205' ? 'SKIPPED (table not exists)' :
                        productsError?.code === '42703' ? 'SKIPPED (no project_id column)' : (productsDeleted?.length || 0),
        projectRecordDeleted: projectDeleted?.length || 0
      })

      return true
    } catch (error) {
      console.error('💥 EXCEPTION in permanent delete cascade:', error)
      return false
    }
  }

  // Lấy danh sách projects đã xóa (chỉ admin/manager)
  static async getDeletedProjects(): Promise<Project[]> {
    try {
      // Check user permission first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return []

      const { data: userProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!['admin', 'manager'].includes(userProfile?.role)) {
        return []
      }

      // Get projects deleted within 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: projects, error } = await supabase
        .from('projects')
        .select('*')
        .eq('is_active', false)
        .not('deleted_at', 'is', null)
        .gte('deleted_at', sevenDaysAgo)
        .order('deleted_at', { ascending: false })

      if (error) {
        console.error('❌ Error fetching deleted projects:', error)
        return []
      }

      console.log('✅ Fetched deleted projects:', projects?.length || 0)
      return projects as Project[] || []
    } catch (error) {
      console.error('❌ Exception fetching deleted projects:', error)
      return []
    }
  }

  // Cleanup projects deleted more than 7 days ago (background job)
  static async cleanupExpiredProjects(): Promise<number> {
    try {
      console.log('🔄 Starting cleanup of expired deleted projects...')

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      // Get projects to be permanently deleted
      const { data: expiredProjects, error: fetchError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('is_active', false)
        .not('deleted_at', 'is', null)
        .lt('deleted_at', sevenDaysAgo)

      if (fetchError) {
        console.error('❌ Error fetching expired projects:', fetchError)
        return 0
      }

      if (!expiredProjects || expiredProjects.length === 0) {
        console.log('✅ No expired projects to cleanup')
        return 0
      }

      let cleanedCount = 0
      for (const project of expiredProjects) {
        const success = await this.permanentDeleteProject(project.id, project.name)
        if (success) {
          cleanedCount++
        }
      }

      console.log(`✅ Cleaned up ${cleanedCount} expired projects`)
      return cleanedCount
    } catch (error) {
      console.error('❌ Exception in cleanup:', error)
      return 0
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

  // Test kết nối WooCommerce với project data
  static async testWooCommerceConnectionForProject(project: Project): Promise<boolean> {
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

  // Utility: Generate next project_id
  private static async generateNextProjectId(): Promise<number> {
    try {
      // Get highest project_id currently in use
      const { data, error } = await supabase
        .from('projects')
        .select('project_id')
        .order('project_id', { ascending: false })
        .limit(1)

      if (error) {
        console.error('❌ Error getting max project_id:', error)
        // Fallback to random ID between 500-999
        return Math.floor(Math.random() * 500) + 500
      }

      const maxProjectId = data?.[0]?.project_id || 99
      const nextId = maxProjectId + 1

      console.log('🔢 Generated project_id:', nextId)
      return nextId
    } catch (error) {
      console.error('❌ Exception generating project_id:', error)
      // Fallback to timestamp-based ID
      return Math.floor(Date.now() / 1000) % 10000
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