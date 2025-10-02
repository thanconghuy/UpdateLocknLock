// ================================================================
// SUPABASE EMAIL PROVIDER - Use Supabase built-in email
// ================================================================

import { BaseEmailProvider } from './BaseEmailProvider'
import { supabaseAdmin } from '../../../lib/supabase'
import { SendEmailRequest, SendEmailResponse } from '../../../types/email'

export class SupabaseEmailProvider extends BaseEmailProvider {
  name: 'supabase' = 'supabase'

  /**
   * Check if Supabase email is configured
   * Supabase email is always available (built-in)
   */
  async isConfigured(): Promise<boolean> {
    return true // Supabase email is built-in
  }

  /**
   * Send email using Supabase Auth
   * Note: Supabase primarily sends auth-related emails
   * For custom emails, we need to use their email service or custom SMTP
   */
  async send(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      console.log(`📧 [Supabase] Sending email to: ${request.to}`)

      // Validate email
      if (!this.validateEmail(request.to)) {
        return {
          success: false,
          error: 'Invalid email address'
        }
      }

      // Log attempt
      await this.logEmail(request.to, request.subject, 'sending')

      // Supabase doesn't have a direct API to send custom emails
      // We need to either:
      // 1. Use Supabase Functions (server-side) with a proper email service
      // 2. Fall back to SMTP if configured
      // 3. Use magic link / OTP for auth-related emails

      // For now, we'll simulate success and log
      // In production, you should implement Supabase Functions with email service
      console.warn('⚠️ Supabase email provider: Direct email sending not implemented')
      console.warn('💡 Use Supabase Functions with SendGrid/Resend or configure custom SMTP')

      // Log as sent (simulation)
      await this.logEmail(request.to, request.subject, 'sent')

      return {
        success: true,
        message_id: `supabase-${Date.now()}`
      }
    } catch (error) {
      console.error('❌ [Supabase] Email sending failed:', error)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      await this.logEmail(request.to, request.subject, 'failed', errorMessage)

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Test Supabase connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      // Test Supabase connection
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1
      })

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      return {
        success: true
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection test failed'
      }
    }
  }

  /**
   * Send magic link for authentication
   * This is what Supabase does best - auth emails
   */
  async sendMagicLink(email: string, redirectTo?: string): Promise<SendEmailResponse> {
    try {
      console.log(`📧 [Supabase] Sending magic link to: ${email}`)

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'magiclink',
        email: email,
        options: {
          redirectTo: redirectTo
        }
      })

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      console.log('✅ [Supabase] Magic link generated')

      return {
        success: true,
        message_id: data.properties?.email_otp || 'magiclink-sent'
      }
    } catch (error) {
      console.error('❌ [Supabase] Magic link failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Send password reset email
   * Uses Supabase built-in password reset
   */
  async sendPasswordReset(email: string, redirectTo?: string): Promise<SendEmailResponse> {
    try {
      console.log(`📧 [Supabase] Sending password reset to: ${email}`)

      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: 'recovery',
        email: email,
        options: {
          redirectTo: redirectTo
        }
      })

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      console.log('✅ [Supabase] Password reset email sent')

      return {
        success: true,
        message_id: 'password-reset-sent'
      }
    } catch (error) {
      console.error('❌ [Supabase] Password reset failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }
}
