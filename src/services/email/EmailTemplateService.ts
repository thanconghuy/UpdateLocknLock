// ================================================================
// EMAIL TEMPLATE SERVICE - Manage and render email templates
// ================================================================

import { supabase } from '../../lib/supabase'
import {
  EmailTemplate,
  EmailTemplateKey,
  CreateEmailTemplateRequest,
  UpdateEmailTemplateRequest,
  EmailTemplateVariables,
  OperationResult
} from '../../types/email'

export class EmailTemplateService {
  private static instance: EmailTemplateService
  private templateCache: Map<EmailTemplateKey, EmailTemplate> = new Map()
  private cacheExpiry: Map<EmailTemplateKey, number> = new Map()
  private readonly CACHE_TTL = 10 * 60 * 1000 // 10 minutes

  private constructor() {}

  public static getInstance(): EmailTemplateService {
    if (!EmailTemplateService.instance) {
      EmailTemplateService.instance = new EmailTemplateService()
    }
    return EmailTemplateService.instance
  }

  /**
   * Get all email templates
   */
  async getAllTemplates(): Promise<OperationResult<EmailTemplate[]>> {
    try {
      console.log('📧 Fetching all email templates...')

      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .order('template_name', { ascending: true })

      if (error) {
        console.error('❌ Error fetching templates:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`✅ Loaded ${data?.length || 0} email templates`)

      return {
        success: true,
        data: data || [],
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Exception in getAllTemplates:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Get template by key (with caching)
   */
  async getTemplate(templateKey: EmailTemplateKey): Promise<OperationResult<EmailTemplate>> {
    try {
      // Check cache first
      const cached = this.templateCache.get(templateKey)
      const expiry = this.cacheExpiry.get(templateKey) || 0

      if (cached && Date.now() < expiry) {
        console.log(`📧 Using cached template: ${templateKey}`)
        return {
          success: true,
          data: cached,
          timestamp: new Date().toISOString()
        }
      }

      console.log(`📧 Fetching template: ${templateKey}`)

      const { data, error } = await supabase
        .from('email_templates')
        .select('*')
        .eq('template_key', templateKey)
        .eq('is_active', true)
        .single()

      if (error) {
        console.warn(`⚠️ Template ${templateKey} not in DB, using default fallback`)
        // Use default template if DB doesn't have it
        const defaultTemplate = this.getDefaultTemplate(templateKey)
        if (defaultTemplate) {
          return {
            success: true,
            data: defaultTemplate,
            message: 'Using default template (not in database)',
            timestamp: new Date().toISOString()
          }
        }

        return {
          success: false,
          error: `Template not found in DB and no default available: ${templateKey}`,
          timestamp: new Date().toISOString()
        }
      }

      if (!data) {
        console.warn(`⚠️ Template ${templateKey} not found, using default`)
        const defaultTemplate = this.getDefaultTemplate(templateKey)
        if (defaultTemplate) {
          return {
            success: true,
            data: defaultTemplate,
            message: 'Using default template',
            timestamp: new Date().toISOString()
          }
        }

        return {
          success: false,
          error: `Template not found: ${templateKey}`,
          timestamp: new Date().toISOString()
        }
      }

      // Cache the template
      this.templateCache.set(templateKey, data)
      this.cacheExpiry.set(templateKey, Date.now() + this.CACHE_TTL)

      console.log(`✅ Template loaded: ${templateKey}`)

      return {
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Exception in getTemplate:', error)
      // Try default template as last resort
      const defaultTemplate = this.getDefaultTemplate(templateKey)
      if (defaultTemplate) {
        console.log(`💡 Using default template for ${templateKey}`)
        return {
          success: true,
          data: defaultTemplate,
          message: 'Using default template due to error',
          timestamp: new Date().toISOString()
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Get default hardcoded template (fallback when DB is not ready)
   */
  private getDefaultTemplate(templateKey: EmailTemplateKey): EmailTemplate | null {
    const defaults: Record<EmailTemplateKey, Partial<EmailTemplate>> = {
      new_user_credentials: {
        template_key: 'new_user_credentials',
        template_name: 'New User Credentials',
        subject: 'Chào mừng đến với Lock & Lock Product Management System',
        body_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0;">🎉 Chào mừng đến với Lock & Lock</h1>
              <p style="margin: 10px 0 0 0;">Product Management System</p>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0;">
              <p>Xin chào <strong>{{user_name}}</strong>,</p>
              <p>Tài khoản của bạn đã được tạo thành công! Dưới đây là thông tin đăng nhập:</p>
              <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0;">
                <p><strong>📧 Email/Username:</strong><br/>{{user_email}}</p>
                <p><strong>🔑 Mật khẩu tạm thời:</strong><br/><code style="font-size: 16px; background: #fff; padding: 5px 10px; border-radius: 3px;">{{temp_password}}</code></p>
              </div>
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p><strong>⚠️ LƯU Ý QUAN TRỌNG:</strong></p>
                <ul>
                  <li>Đây là mật khẩu tạm thời</li>
                  <li>Bạn <strong>SẼ BỊ BẮT BUỘC</strong> đổi mật khẩu khi đăng nhập lần đầu</li>
                </ul>
              </div>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{login_url}}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">🔗 Đăng nhập ngay</a>
              </div>
              <p>Trân trọng,<br/><strong>Lock & Lock Team</strong></p>
            </div>
          </div>
        `,
        body_text: 'Chào mừng {{user_name}}! Email: {{user_email}}, Mật khẩu: {{temp_password}}. Đăng nhập tại: {{login_url}}',
        available_variables: ['user_name', 'user_email', 'temp_password', 'login_url'],
        is_active: true
      },
      account_approved: {
        template_key: 'account_approved',
        template_name: 'Account Approved',
        subject: 'Tài khoản của bạn đã được kích hoạt',
        body_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0;">✅ Tài khoản đã được kích hoạt</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0;">
              <p>Xin chào <strong>{{user_name}}</strong>,</p>
              <p>Tin tốt! Tài khoản của bạn đã được quản trị viên phê duyệt và kích hoạt.</p>
              <p>Bây giờ bạn có thể đăng nhập và sử dụng đầy đủ các tính năng của hệ thống.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{login_url}}" style="display: inline-block; background: #11998e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Đăng nhập ngay</a>
              </div>
              <p>Trân trọng,<br/><strong>Lock & Lock Team</strong></p>
            </div>
          </div>
        `,
        body_text: 'Xin chào {{user_name}}, tài khoản của bạn đã được kích hoạt. Đăng nhập tại: {{login_url}}',
        available_variables: ['user_name', 'user_email', 'login_url'],
        is_active: true
      },
      password_reset: {
        template_key: 'password_reset',
        template_name: 'Password Reset',
        subject: 'Yêu cầu đặt lại mật khẩu',
        body_html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0;">🔐 Đặt lại mật khẩu</h1>
            </div>
            <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0;">
              <p>Xin chào <strong>{{user_name}}</strong>,</p>
              <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="{{reset_url}}" style="display: inline-block; background: #f5576c; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px;">Đặt lại mật khẩu</a>
              </div>
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p><strong>⚠️ Lưu ý:</strong> Link này chỉ có hiệu lực trong <strong>1 giờ</strong></p>
              </div>
              <p>Trân trọng,<br/><strong>Lock & Lock Team</strong></p>
            </div>
          </div>
        `,
        body_text: 'Xin chào {{user_name}}, đặt lại mật khẩu tại: {{reset_url}} (có hiệu lực 1 giờ)',
        available_variables: ['user_name', 'user_email', 'reset_url'],
        is_active: true
      },
      welcome_user: {
        template_key: 'welcome_user',
        template_name: 'Welcome User',
        subject: 'Chào mừng bạn!',
        body_html: '<p>Chào mừng {{user_name}} đến với hệ thống!</p>',
        body_text: 'Chào mừng {{user_name}}!',
        available_variables: ['user_name'],
        is_active: true
      }
    }

    const template = defaults[templateKey]
    if (!template) return null

    // Return complete EmailTemplate with default values
    return {
      id: `default-${templateKey}`,
      template_key: templateKey,
      template_name: template.template_name!,
      description: 'Default template (hardcoded fallback)',
      subject: template.subject!,
      body_html: template.body_html!,
      body_text: template.body_text,
      available_variables: template.available_variables || [],
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  }

  /**
   * Render template with variables
   */
  async renderTemplate(
    templateKey: EmailTemplateKey,
    variables: EmailTemplateVariables
  ): Promise<OperationResult<{ subject: string; html: string; text?: string }>> {
    try {
      console.log(`📧 Rendering template: ${templateKey}`)

      // Get template
      const templateResult = await this.getTemplate(templateKey)
      if (!templateResult.success || !templateResult.data) {
        return {
          success: false,
          error: templateResult.error || 'Failed to load template',
          timestamp: new Date().toISOString()
        }
      }

      const template = templateResult.data

      // Render subject
      const subject = this.interpolateVariables(template.subject, variables as Record<string, string>)

      // Render HTML body
      const html = this.interpolateVariables(template.body_html, variables as Record<string, string>)

      // Render text body (optional)
      const text = template.body_text
        ? this.interpolateVariables(template.body_text, variables as Record<string, string>)
        : undefined

      console.log(`✅ Template rendered: ${templateKey}`)

      return {
        success: true,
        data: { subject, html, text },
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Exception in renderTemplate:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Interpolate variables in template string
   * Replace {{variable_name}} with actual values
   */
  private interpolateVariables(template: string, variables: Record<string, string>): string {
    let result = template

    // Replace all {{variable}} with actual values
    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
      result = result.replace(regex, value || '')
    })

    // Warn about unreplaced variables
    const unreplaced = result.match(/\{\{[^}]+\}\}/g)
    if (unreplaced) {
      console.warn('⚠️ Unreplaced variables found:', unreplaced)
    }

    return result
  }

  /**
   * Create new template
   */
  async createTemplate(
    templateData: CreateEmailTemplateRequest,
    userId: string
  ): Promise<OperationResult<EmailTemplate>> {
    try {
      console.log('📧 Creating email template...')

      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          ...templateData,
          created_by: userId,
          updated_by: userId
        })
        .select()
        .single()

      if (error) {
        console.error('❌ Error creating template:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      console.log('✅ Template created:', data.template_key)

      return {
        success: true,
        data: data,
        message: 'Template created successfully',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Exception in createTemplate:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Update existing template
   */
  async updateTemplate(
    templateKey: EmailTemplateKey,
    updates: UpdateEmailTemplateRequest,
    userId: string
  ): Promise<OperationResult<EmailTemplate>> {
    try {
      console.log(`📧 Updating template: ${templateKey}`)

      const { data, error } = await supabase
        .from('email_templates')
        .update({
          ...updates,
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('template_key', templateKey)
        .select()
        .single()

      if (error) {
        console.error('❌ Error updating template:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      // Invalidate cache
      this.invalidateCache(templateKey)

      console.log('✅ Template updated:', templateKey)

      return {
        success: true,
        data: data,
        message: 'Template updated successfully',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Exception in updateTemplate:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(templateKey: EmailTemplateKey): Promise<OperationResult<void>> {
    try {
      console.log(`📧 Deleting template: ${templateKey}`)

      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('template_key', templateKey)

      if (error) {
        console.error('❌ Error deleting template:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      // Invalidate cache
      this.invalidateCache(templateKey)

      console.log('✅ Template deleted:', templateKey)

      return {
        success: true,
        message: 'Template deleted successfully',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Exception in deleteTemplate:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Invalidate template cache
   */
  invalidateCache(templateKey?: EmailTemplateKey): void {
    if (templateKey) {
      this.templateCache.delete(templateKey)
      this.cacheExpiry.delete(templateKey)
      console.log(`🔄 Template cache invalidated: ${templateKey}`)
    } else {
      this.templateCache.clear()
      this.cacheExpiry.clear()
      console.log('🔄 All template cache invalidated')
    }
  }

  /**
   * Preview template (render with sample data)
   */
  async previewTemplate(
    templateKey: EmailTemplateKey,
    sampleVariables?: Record<string, string>
  ): Promise<OperationResult<{ subject: string; html: string; text?: string }>> {
    // Default sample variables
    const defaultVariables: Record<string, string> = {
      user_name: 'John Doe',
      user_email: 'john@example.com',
      temp_password: 'SamplePass123!',
      login_url: 'https://your-app.com/login',
      reset_url: 'https://your-app.com/reset-password?token=sample'
    }

    const variables = { ...defaultVariables, ...sampleVariables }

    return this.renderTemplate(templateKey, variables)
  }
}
