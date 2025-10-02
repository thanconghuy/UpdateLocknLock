// ================================================================
// BASE EMAIL PROVIDER - Abstract base class for all email providers
// ================================================================

import {
  IEmailProvider,
  EmailProvider,
  SendEmailRequest,
  SendEmailResponse
} from '../../../types/email'

export abstract class BaseEmailProvider implements IEmailProvider {
  abstract name: EmailProvider

  /**
   * Check if provider is properly configured
   */
  abstract isConfigured(): Promise<boolean>

  /**
   * Send email
   */
  abstract send(request: SendEmailRequest): Promise<SendEmailResponse>

  /**
   * Test connection/configuration
   */
  abstract testConnection(): Promise<{ success: boolean; error?: string }>

  /**
   * Validate email address format
   */
  protected validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Sanitize email content (prevent injection)
   */
  protected sanitizeContent(content: string): string {
    // Basic sanitization - in production use a proper library
    return content
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
  }

  /**
   * Log email attempt
   */
  protected async logEmail(
    recipient: string,
    subject: string,
    status: 'queued' | 'sending' | 'sent' | 'failed',
    error?: string
  ): Promise<void> {
    try {
      const { supabase } = await import('../../../lib/supabase')

      await supabase.from('email_logs').insert({
        recipient_email: recipient,
        subject: subject,
        status: status,
        provider_used: this.name,
        error_message: error,
        sent_at: status === 'sent' ? new Date().toISOString() : null
      })
    } catch (logError) {
      console.error('Failed to log email:', logError)
      // Don't throw - logging failure shouldn't prevent email sending
    }
  }
}
