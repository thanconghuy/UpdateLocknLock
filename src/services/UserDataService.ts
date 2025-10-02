// =======================================
// USER DATA SERVICE - Database Operations
// =======================================

import { supabase, supabaseAdmin } from '../lib/supabase'
import {
  UserProfile,
  CreateUserRequest,
  UpdateUserRequest,
  UserQueryParams,
  UserListResponse,
  OperationResult,
  UserManagementError,
  USER_ROLES
} from '../types/userManagement'
import { generatePassword } from '../utils/passwordGenerator'
import { EmailService } from './email/EmailService'

export class UserDataService {
  private static instance: UserDataService
  private readonly tableName = 'user_profiles'
  private emailService: EmailService

  // Singleton pattern để đảm bảo chỉ có 1 instance
  private constructor() {
    this.emailService = EmailService.getInstance()
  }

  public static getInstance(): UserDataService {
    if (!UserDataService.instance) {
      UserDataService.instance = new UserDataService()
    }
    return UserDataService.instance
  }

  // ========================================
  // CORE USER OPERATIONS
  // ========================================

  /**
   * Lấy tất cả users với pagination và filtering
   */
  async getAllUsers(params: UserQueryParams = {}): Promise<OperationResult<UserListResponse>> {
    try {
      console.log('🔍 UserDataService: Getting all users with params:', params)

      const {
        limit = 20,
        offset = 0,
        search,
        role,
        isActive,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = params

      // Build query
      let query = supabase
        .from(this.tableName)
        .select(`
          id,
          email,
          full_name,
          role,
          primary_role_id,
          is_active,
          created_at,
          updated_at
        `, { count: 'exact' })

      // Apply filters
      if (search) {
        query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`)
      }

      if (role) {
        query = query.eq('role', role)
      }

      if (typeof isActive === 'boolean') {
        query = query.eq('is_active', isActive)
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      // Apply pagination
      query = query.range(offset, offset + limit - 1)

      const { data: users, error, count } = await query

      if (error) {
        console.error('❌ Error getting users:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      const total = count || 0
      const page = Math.floor(offset / limit) + 1
      const hasNext = offset + limit < total
      const hasPrev = offset > 0

      console.log(`✅ Retrieved ${users?.length || 0} users of ${total} total`)

      return {
        success: true,
        data: {
          users: users || [],
          total,
          page,
          hasNext,
          hasPrev
        },
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in getAllUsers:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Lấy user theo ID - sử dụng bypass function để tránh RLS issues
   */
  async getUserById(id: string): Promise<OperationResult<UserProfile | null>> {
    try {
      console.log(`🔍 UserDataService: Getting user by ID: ${id}`)

      // Try bypass function first (to avoid RLS infinite recursion)
      const { data: bypassData, error: bypassError } = await supabase
        .rpc('get_user_with_role', { user_id: id })

      if (!bypassError && bypassData) {
        console.log(`✅ Found user via bypass function: ${bypassData.email}`)
        return {
          success: true,
          data: bypassData,
          timestamp: new Date().toISOString()
        }
      }

      console.warn('⚠️ Bypass function failed, trying direct query:', bypassError)

      // Fallback to direct query
      const { data: user, error } = await supabase
        .from(this.tableName)
        .select(`
          id,
          email,
          full_name,
          role,
          primary_role_id,
          is_active,
          created_at,
          updated_at
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          console.log(`⚠️ User not found: ${id}`)
          return {
            success: true,
            data: null,
            message: 'User not found',
            timestamp: new Date().toISOString()
          }
        }

        console.error('❌ Error getting user by ID:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`✅ Found user via direct query: ${user.email}`)
      return {
        success: true,
        data: user,
        timestamp: new Date().toISOString()
      }

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
   * Tạo user mới
   */
  async createUser(userData: CreateUserRequest): Promise<OperationResult<UserProfile & { generatedPassword?: string }>> {
    try {
      console.log('🔨 UserDataService: Creating new user:', userData.email)

      // Check if email already exists
      const emailCheck = await this.getUserByEmail(userData.email)
      if (emailCheck.success && emailCheck.data) {
        return {
          success: false,
          error: 'Email already exists',
          timestamp: new Date().toISOString()
        }
      }

      // Generate password if not provided
      let generatedPassword: string | undefined
      let password = userData.password

      if (!password) {
        generatedPassword = generatePassword({
          length: 14,
          includeUppercase: true,
          includeLowercase: true,
          includeNumbers: true,
          includeSymbols: true,
          excludeSimilarCharacters: true
        })
        password = generatedPassword
        console.log('🔑 Auto-generated secure password for user')
      }

      // Create Supabase Auth user first using admin client
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: userData.full_name || userData.email
        }
      })

      if (authError || !authData.user) {
        console.error('❌ Error creating auth user:', authError)
        return {
          success: false,
          error: authError?.message || 'Failed to create auth user',
          timestamp: new Date().toISOString()
        }
      }

      console.log('✅ Auth user created:', authData.user.id)

      // Check if profile already exists (in case of previous failed attempt)
      const existingProfile = await supabase
        .from(this.tableName)
        .select('id')
        .eq('id', authData.user.id)
        .single()

      if (existingProfile.data) {
        console.warn('⚠️ User profile already exists, using existing profile')
        // Profile already exists, just update it
        const { data: updatedUser, error: updateError } = await supabase
          .from(this.tableName)
          .update({
            email: userData.email,
            full_name: userData.full_name || userData.email,
            role: userData.role,
            primary_role_id: userData.primary_role_id,
            is_active: userData.is_active !== false,
            must_change_password: generatedPassword ? true : (userData.must_change_password || false),
            updated_at: new Date().toISOString()
          })
          .eq('id', authData.user.id)
          .select(`
            id,
            email,
            full_name,
            role,
            primary_role_id,
            is_active,
            must_change_password,
            created_at,
            updated_at
          `)
          .single()

        if (updateError) {
          console.error('❌ Error updating existing user profile:', updateError)
          return {
            success: false,
            error: updateError.message,
            timestamp: new Date().toISOString()
          }
        }

        console.log(`✅ User profile updated: ${updatedUser.email}`)

        // Send welcome email with credentials if password was generated
        if (generatedPassword) {
          console.log('📧 Sending welcome email with credentials...')
          const emailResult = await this.emailService.sendNewUserCredentials(
            updatedUser.email,
            updatedUser.full_name || updatedUser.email,
            generatedPassword
          )

          if (emailResult.success) {
            console.log('✅ Welcome email sent successfully')
          } else {
            console.warn('⚠️ Failed to send welcome email:', emailResult.error)
          }
        }

        const result: any = {
          ...updatedUser,
          generatedPassword: generatedPassword
        }

        return {
          success: true,
          data: result,
          message: generatedPassword
            ? 'User profile updated with auto-generated password. Welcome email sent.'
            : 'User profile updated successfully',
          timestamp: new Date().toISOString()
        }
      }

      // Create new user profile
      const newUser = {
        id: authData.user.id, // Use the same ID as auth user
        email: userData.email,
        full_name: userData.full_name || userData.email,
        role: userData.role,
        primary_role_id: userData.primary_role_id,
        is_active: userData.is_active !== false,
        must_change_password: generatedPassword ? true : (userData.must_change_password || false),
        created_at: new Date().toISOString()
      }

      const { data: user, error } = await supabase
        .from(this.tableName)
        .insert(newUser)
        .select(`
          id,
          email,
          full_name,
          role,
          primary_role_id,
          is_active,
          must_change_password,
          created_at,
          updated_at
        `)
        .single()

      if (error) {
        console.error('❌ Error creating user profile:', error)
        // Rollback: delete auth user if profile creation fails
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`✅ User created successfully: ${user.email}`)

      // Send welcome email with credentials if password was generated
      if (generatedPassword) {
        console.log('📧 Sending welcome email with credentials...')
        const emailResult = await this.emailService.sendNewUserCredentials(
          user.email,
          user.full_name || user.email,
          generatedPassword
        )

        if (emailResult.success) {
          console.log('✅ Welcome email sent successfully')
        } else {
          console.warn('⚠️ Failed to send welcome email:', emailResult.error)
          // Don't fail user creation if email fails, just log the warning
        }
      }

      // Return user data with generated password if applicable
      const result: any = {
        ...user,
        generatedPassword: generatedPassword
      }

      return {
        success: true,
        data: result,
        message: generatedPassword
          ? 'User created with auto-generated password. Welcome email sent.'
          : 'User created successfully',
        timestamp: new Date().toISOString()
      }

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
   * Cập nhật user
   */
  async updateUser(id: string, updates: UpdateUserRequest): Promise<OperationResult<UserProfile>> {
    try {
      console.log(`🔄 UserDataService: Updating user ${id}:`, updates)

      // Check if user exists
      const userCheck = await this.getUserById(id)
      if (!userCheck.success || !userCheck.data) {
        return {
          success: false,
          error: 'User not found',
          timestamp: new Date().toISOString()
        }
      }

      // Check email uniqueness if email is being updated
      if (updates.email && updates.email !== userCheck.data.email) {
        const emailCheck = await this.getUserByEmail(updates.email)
        if (emailCheck.success && emailCheck.data) {
          return {
            success: false,
            error: 'Email already exists',
            timestamp: new Date().toISOString()
          }
        }
      }

      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      }

      const { data: user, error } = await supabase
        .from(this.tableName)
        .update(updateData)
        .eq('id', id)
        .select(`
          id,
          email,
          full_name,
          role,
          primary_role_id,
          is_active,
          created_at,
          updated_at
        `)
        .single()

      if (error) {
        console.error('❌ Error updating user:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`✅ User updated successfully: ${user.email}`)
      return {
        success: true,
        data: user,
        message: 'User updated successfully',
        timestamp: new Date().toISOString()
      }

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
   * Deactivate user (soft delete)
   */
  async deactivateUser(id: string): Promise<OperationResult<boolean>> {
    try {
      console.log(`🔒 UserDataService: Deactivating user: ${id}`)

      const result = await this.updateUser(id, { is_active: false })

      if (result.success) {
        console.log(`✅ User deactivated successfully: ${id}`)
        return {
          success: true,
          data: true,
          message: 'User deactivated successfully',
          timestamp: new Date().toISOString()
        }
      }

      return {
        success: result.success,
        data: result.success,
        error: result.error,
        message: result.message,
        timestamp: result.timestamp
      }

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
  async activateUser(id: string): Promise<OperationResult<boolean>> {
    try {
      console.log(`🔓 UserDataService: Activating user: ${id}`)

      // Get user info first for email
      const userInfo = await this.getUserById(id)

      const result = await this.updateUser(id, { is_active: true })

      if (result.success) {
        console.log(`✅ User activated successfully: ${id}`)

        // Send account approved email
        if (userInfo.success && userInfo.data) {
          console.log('📧 Sending account approved notification...')
          const emailResult = await this.emailService.sendAccountApproved(
            userInfo.data.email,
            userInfo.data.full_name || userInfo.data.email
          )

          if (emailResult.success) {
            console.log('✅ Account approved email sent successfully')
          } else {
            console.warn('⚠️ Failed to send account approved email:', emailResult.error)
          }
        }

        return {
          success: true,
          data: true,
          message: 'User activated successfully. Notification email sent.',
          timestamp: new Date().toISOString()
        }
      }

      return {
        success: result.success,
        data: result.success,
        error: result.error,
        message: result.message,
        timestamp: result.timestamp
      }

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
   * Lấy user theo email
   */
  private async getUserByEmail(email: string): Promise<OperationResult<UserProfile | null>> {
    try {
      const { data: user, error } = await supabase
        .from(this.tableName)
        .select(`
          id,
          email,
          full_name,
          role,
          primary_role_id,
          is_active,
          created_at,
          updated_at
        `)
        .eq('email', email)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            success: true,
            data: null,
            timestamp: new Date().toISOString()
          }
        }
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      return {
        success: true,
        data: user,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Get users count by role
   */
  async getUserCountByRole(): Promise<OperationResult<Record<string, number>>> {
    try {
      console.log('📊 UserDataService: Getting user count by role')

      const { data: users, error } = await supabase
        .from(this.tableName)
        .select('role')
        .eq('is_active', true)

      if (error) {
        console.error('❌ Error getting user count by role:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      const roleCount = users?.reduce((acc, user) => {
        acc[user.role] = (acc[user.role] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      console.log('✅ User count by role:', roleCount)
      return {
        success: true,
        data: roleCount,
        timestamp: new Date().toISOString()
      }

    } catch (error) {
      console.error('❌ Exception in getUserCountByRole:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }
}