// ================================================================
// SMTP EMAIL PROVIDER - Custom SMTP (Gmail, Office365, etc.)
// ================================================================

import { BaseEmailProvider } from './BaseEmailProvider'
import { SendEmailRequest, SendEmailResponse, EmailSettings } from '../../../types/email'

/**
 * SMTP Provider for custom email servers
 * Supports Gmail, Office365, and other SMTP servers
 *
 * Note: Browser cannot send emails directly via SMTP
 * This provider needs to be called from server-side (Supabase Functions or API)
 */
export class SMTPProvider extends BaseEmailProvider {
  name: 'custom_smtp' = 'custom_smtp'
  private config: EmailSettings | null = null

  constructor(config?: EmailSettings) {
    super()
    this.config = config || null
  }

  /**
   * Set SMTP configuration
   */
  setConfig(config: EmailSettings): void {
    this.config = config
  }

  /**
   * Check if SMTP is properly configured
   */
  async isConfigured(): Promise<boolean> {
    if (!this.config) return false

    return !!(
      this.config.smtp_host &&
      this.config.smtp_port &&
      this.config.smtp_username &&
      this.config.smtp_password
    )
  }

  /**
   * Send email via SMTP
   * Note: This needs to be implemented server-side
   */
  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      console.log(`📧 [SMTP] Sending email to: ${request.to}`)

      // Validate configuration
      if (!await this.isConfigured()) {
        return {
          success: false,
          error: 'SMTP not configured properly'
        }
      }

      // Validate email
      if (!this.validateEmail(request.to)) {
        return {
          success: false,
          error: 'Invalid email address'
        }
      }

      // Log attempt
      await this.logEmail(request.to, request.subject, 'sending')

      // IMPORTANT: Browser cannot send SMTP emails directly
      // You need to implement this via:
      // 1. Supabase Edge Functions
      // 2. Backend API endpoint
      // 3. Third-party service (SendGrid, Resend, etc.)

      console.warn('⚠️ SMTP email sending requires server-side implementation')
      console.warn('💡 Options:')
      console.warn('   1. Create Supabase Edge Function with nodemailer')
      console.warn('   2. Create backend API endpoint')
      console.warn('   3. Use SendGrid/Resend provider instead')

      // For now, we'll call a Supabase Function (if exists)
      const result = await this.sendViaSupabaseFunction(request)

      if (result.success) {
        await this.logEmail(request.to, request.subject, 'sent')
      } else {
        await this.logEmail(request.to, request.subject, 'failed', result.error)
      }

      return result

    } catch (error) {
      console.error('❌ [SMTP] Email sending failed:', error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.logEmail(request.to, request.subject, 'failed', errorMessage)

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Send email via Supabase Edge Function
   * This function should be created in your Supabase project
   */
  private async sendViaSupabaseFunction(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      const { supabase } = await import('../../../lib/supabase')

      // Call Supabase Edge Function: send-email
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          to: request.to,
          to_name: request.to_name,
          subject: request.subject,
          html: request.html,
          text: request.text,
          smtp_config: {
            host: this.config?.smtp_host,
            port: this.config?.smtp_port,
            username: this.config?.smtp_username,
            password: this.config?.smtp_password,
            secure: this.config?.smtp_secure
          },
          from: {
            email: this.config?.from_email,
            name: this.config?.from_name
          }
        }
      })

      if (error) {
        console.error('❌ Supabase Function error:', error)
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true,
        message_id: data?.messageId || 'smtp-sent'
      }

    } catch (error) {
      console.error('❌ Supabase Function call failed:', error)

      // If function doesn't exist, return helpful error
      if (error instanceof Error && error.message.includes('not found')) {
        return {
          success: false,
          error: 'Supabase Edge Function "send-email" not found. Please create it first.'
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Test SMTP connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!await this.isConfigured()) {
        return {
          success: false,
          error: 'SMTP configuration incomplete'
        }
      }

      // Test by sending to Supabase Function
      console.log('📧 Testing SMTP connection...')

      // Send test email
      const testResult = await this.send({
        to: this.config?.from_email || 'test@example.com',
        subject: 'SMTP Test Email',
        html: '<p>This is a test email to verify SMTP configuration.</p>',
        text: 'This is a test email to verify SMTP configuration.'
      })

      return {
        success: testResult.success,
        error: testResult.error
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }

  /**
   * Validate SMTP configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    if (!this.config) {
      errors.push('SMTP configuration not set')
      return { isValid: false, errors }
    }

    if (!this.config.smtp_host) {
      errors.push('SMTP host is required')
    }

    if (!this.config.smtp_port) {
      errors.push('SMTP port is required')
    }

    if (this.config.smtp_port && (this.config.smtp_port < 1 || this.config.smtp_port > 65535)) {
      errors.push('SMTP port must be between 1 and 65535')
    }

    if (!this.config.smtp_username) {
      errors.push('SMTP username is required')
    }

    if (!this.config.smtp_password) {
      errors.push('SMTP password is required')
    }

    if (!this.config.from_email) {
      errors.push('From email is required')
    } else if (!this.validateEmail(this.config.from_email)) {
      errors.push('From email is invalid')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  /**
   * Get SMTP server presets for common providers
   */
  static getPreset(provider: 'gmail' | 'outlook' | 'yahoo' | 'custom'): Partial<EmailSettings> {
    const presets = {
      gmail: {
        smtp_host: 'smtp.gmail.com',
        smtp_port: 587,
        smtp_secure: true
      },
      outlook: {
        smtp_host: 'smtp-mail.outlook.com',
        smtp_port: 587,
        smtp_secure: true
      },
      yahoo: {
        smtp_host: 'smtp.mail.yahoo.com',
        smtp_port: 587,
        smtp_secure: true
      },
      custom: {
        smtp_host: '',
        smtp_port: 587,
        smtp_secure: true
      }
    }

    return presets[provider] || presets.custom
  }
}
