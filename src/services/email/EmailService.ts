// ================================================================
// EMAIL SERVICE - Main orchestrator for email system
// ================================================================

import { EmailConfigService } from './EmailConfigService'
import { EmailTemplateService } from './EmailTemplateService'
import { SupabaseEmailProvider } from './providers/SupabaseEmailProvider'
import { SMTPProvider } from './providers/SMTPProvider'
import {
  IEmailProvider,
  SendEmailRequest,
  SendEmailResponse,
  EmailTemplateKey,
  EmailTemplateVariables,
  OperationResult
} from '../../types/email'

export class EmailService {
  private static instance: EmailService
  private configService: EmailConfigService
  private templateService: EmailTemplateService
  private currentProvider: IEmailProvider | null = null

  private constructor() {
    this.configService = EmailConfigService.getInstance()
    this.templateService = EmailTemplateService.getInstance()
  }

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService()
    }
    return EmailService.instance
  }

  /**
   * Get appropriate email provider based on configuration
   */
  private async getProvider(): Promise<IEmailProvider> {
    // Return cached provider if available
    if (this.currentProvider) {
      return this.currentProvider
    }

    const configResult = await this.configService.getConfig()
    if (!configResult.success || !configResult.data) {
      console.warn('⚠️ No email config found, falling back to Supabase provider')
      this.currentProvider = new SupabaseEmailProvider()
      return this.currentProvider
    }

    const config = configResult.data

    // Select provider based on configuration
    switch (config.provider) {
      case 'supabase':
        console.log('📧 Using Supabase email provider')
        this.currentProvider = new SupabaseEmailProvider()
        break

      case 'custom_smtp':
        console.log('📧 Using custom SMTP provider')
        const smtpProvider = new SMTPProvider(config)
        this.currentProvider = smtpProvider
        break

      case 'sendgrid':
        console.warn('⚠️ SendGrid provider not yet implemented, falling back to Supabase')
        this.currentProvider = new SupabaseEmailProvider()
        break

      case 'resend':
        console.warn('⚠️ Resend provider not yet implemented, falling back to Supabase')
        this.currentProvider = new SupabaseEmailProvider()
        break

      default:
        console.warn('⚠️ Unknown provider, falling back to Supabase')
        this.currentProvider = new SupabaseEmailProvider()
    }

    return this.currentProvider
  }

  /**
   * Send email with template
   */
  async sendTemplateEmail(
    templateKey: EmailTemplateKey,
    recipientEmail: string,
    variables: EmailTemplateVariables,
    recipientName?: string
  ): Promise<OperationResult<SendEmailResponse>> {
    try {
      console.log(`📧 Sending template email: ${templateKey} to ${recipientEmail}`)

      // Check if email system is enabled
      const isEnabled = await this.configService.isEnabled()
      if (!isEnabled) {
        console.warn('⚠️ Email system is disabled')
        return {
          success: false,
          error: 'Email system is currently disabled',
          timestamp: new Date().toISOString()
        }
      }

      // Render template
      const renderResult = await this.templateService.renderTemplate(templateKey, variables)
      if (!renderResult.success || !renderResult.data) {
        return {
          success: false,
          error: renderResult.error || 'Failed to render template',
          timestamp: new Date().toISOString()
        }
      }

      const { subject, html, text } = renderResult.data

      // Get provider
      const provider = await this.getProvider()

      // Send email
      const sendRequest: SendEmailRequest = {
        to: recipientEmail,
        to_name: recipientName,
        subject: subject,
        html: html,
        text: text,
        template_key: templateKey
      }

      const sendResult = await provider.send(sendRequest)

      if (sendResult.success) {
        console.log(`✅ Email sent successfully to ${recipientEmail}`)
        return {
          success: true,
          data: sendResult,
          message: 'Email sent successfully',
          timestamp: new Date().toISOString()
        }
      } else {
        console.error(`❌ Failed to send email: ${sendResult.error}`)
        return {
          success: false,
          error: sendResult.error || 'Failed to send email',
          timestamp: new Date().toISOString()
        }
      }

    } catch (error) {
      console.error('❌ Exception in sendTemplateEmail:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Send custom email (without template)
   */
  async sendEmail(request: SendEmailRequest): Promise<OperationResult<SendEmailResponse>> {
    try {
      console.log(`📧 Sending custom email to ${request.to}`)

      // Check if email system is enabled
      const isEnabled = await this.configService.isEnabled()
      if (!isEnabled) {
        return {
          success: false,
          error: 'Email system is currently disabled',
          timestamp: new Date().toISOString()
        }
      }

      // Get provider
      const provider = await this.getProvider()

      // Send email
      const sendResult = await provider.send(request)

      if (sendResult.success) {
        console.log(`✅ Email sent successfully to ${request.to}`)
        return {
          success: true,
          data: sendResult,
          message: 'Email sent successfully',
          timestamp: new Date().toISOString()
        }
      } else {
        console.error(`❌ Failed to send email: ${sendResult.error}`)
        return {
          success: false,
          error: sendResult.error || 'Failed to send email',
          timestamp: new Date().toISOString()
        }
      }

    } catch (error) {
      console.error('❌ Exception in sendEmail:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Send welcome email with credentials to new user
   */
  async sendNewUserCredentials(
    userEmail: string,
    userName: string,
    tempPassword: string,
    loginUrl: string = window.location.origin + '/login'
  ): Promise<OperationResult<SendEmailResponse>> {
    console.log(`📧 Sending new user credentials to: ${userEmail}`)

    return this.sendTemplateEmail(
      'new_user_credentials',
      userEmail,
      {
        user_name: userName,
        user_email: userEmail,
        temp_password: tempPassword,
        login_url: loginUrl
      },
      userName
    )
  }

  /**
   * Send email confirmation link
   */
  async sendEmailConfirmation(
    userEmail: string,
    userName: string,
    confirmationUrl: string
  ): Promise<OperationResult<SendEmailResponse>> {
    console.log(`📧 Sending email confirmation to: ${userEmail}`)

    return this.sendTemplateEmail(
      'email_confirmation',
      userEmail,
      {
        user_name: userName,
        user_email: userEmail,
        confirmation_url: confirmationUrl
      },
      userName
    )
  }

  /**
   * Send account approved notification
   */
  async sendAccountApproved(
    userEmail: string,
    userName: string,
    loginUrl: string = window.location.origin + '/login'
  ): Promise<OperationResult<SendEmailResponse>> {
    console.log(`📧 Sending account approved notification to: ${userEmail}`)

    return this.sendTemplateEmail(
      'account_approved',
      userEmail,
      {
        user_name: userName,
        user_email: userEmail,
        login_url: loginUrl
      },
      userName
    )
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(
    userEmail: string,
    userName: string,
    resetUrl: string
  ): Promise<OperationResult<SendEmailResponse>> {
    console.log(`📧 Sending password reset email to: ${userEmail}`)

    return this.sendTemplateEmail(
      'password_reset',
      userEmail,
      {
        user_name: userName,
        user_email: userEmail,
        reset_url: resetUrl
      },
      userName
    )
  }

  /**
   * Test email configuration
   */
  async testEmailConfig(testEmail: string): Promise<OperationResult<void>> {
    try {
      console.log('📧 Testing email configuration...')

      const provider = await this.getProvider()
      const testResult = await provider.testConnection()

      if (!testResult.success) {
        return {
          success: false,
          error: testResult.error || 'Connection test failed',
          timestamp: new Date().toISOString()
        }
      }

      // Send test email
      const sendResult = await this.sendEmail({
        to: testEmail,
        subject: 'Test Email - Lock & Lock System',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>🎉 Email Configuration Test</h2>
            <p>This is a test email from Lock & Lock Product Management System.</p>
            <p>If you receive this email, your email configuration is working correctly!</p>
            <hr/>
            <p style="color: #666; font-size: 12px;">
              Sent at: ${new Date().toLocaleString()}
            </p>
          </div>
        `,
        text: 'This is a test email from Lock & Lock Product Management System.'
      })

      if (sendResult.success) {
        return {
          success: true,
          message: `Test email sent successfully to ${testEmail}`,
          timestamp: new Date().toISOString()
        }
      } else {
        return {
          success: false,
          error: sendResult.error || 'Failed to send test email',
          timestamp: new Date().toISOString()
        }
      }

    } catch (error) {
      console.error('❌ Exception in testEmailConfig:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Invalidate cached provider (call after config update)
   */
  resetProvider(): void {
    this.currentProvider = null
    this.configService.invalidateCache()
    console.log('🔄 Email provider cache cleared')
  }
}
