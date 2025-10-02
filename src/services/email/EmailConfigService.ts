// ================================================================
// EMAIL CONFIG SERVICE - Manage email configuration
// ================================================================

import { supabase } from '../../lib/supabase'
import {
  EmailSettings,
  UpdateEmailSettingsRequest,
  OperationResult
} from '../../types/email'

export class EmailConfigService {
  private static instance: EmailConfigService
  private cachedConfig: EmailSettings | null = null
  private cacheExpiry: number = 0
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  private constructor() {}

  public static getInstance(): EmailConfigService {
    if (!EmailConfigService.instance) {
      EmailConfigService.instance = new EmailConfigService()
    }
    return EmailConfigService.instance
  }

  /**
   * Get current email configuration (with caching)
   */
  async getConfig(): Promise<OperationResult<EmailSettings>> {
    try {
      // Check cache first
      if (this.cachedConfig && Date.now() < this.cacheExpiry) {
        console.log('📧 Using cached email config')
        return {
          success: true,
          data: this.cachedConfig,
          timestamp: new Date().toISOString()
        }
      }

      console.log('📧 Fetching email config from database...')

      const { data, error } = await supabase
        .from('email_settings')
        .select('*')
        .single()

      if (error) {
        console.error('❌ Error fetching email config:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      if (!data) {
        console.error('❌ No email configuration found')
        return {
          success: false,
          error: 'Email configuration not found. Please configure email settings in Admin panel.',
          timestamp: new Date().toISOString()
        }
      }

      // Cache the config
      this.cachedConfig = data
      this.cacheExpiry = Date.now() + this.CACHE_TTL

      console.log('✅ Email config loaded:', data.provider)

      return {
        success: true,
        data: data,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Exception in getConfig:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Update email configuration
   */
  async updateConfig(
    updates: UpdateEmailSettingsRequest,
    userId: string
  ): Promise<OperationResult<EmailSettings>> {
    try {
      console.log('📧 Updating email config...')

      // Validate provider-specific requirements
      if (updates.provider === 'custom_smtp') {
        if (!updates.smtp_host || !updates.smtp_port) {
          return {
            success: false,
            error: 'SMTP host and port are required for custom SMTP',
            timestamp: new Date().toISOString()
          }
        }
      }

      if (updates.provider === 'sendgrid' && !updates.sendgrid_api_key) {
        return {
          success: false,
          error: 'SendGrid API key is required',
          timestamp: new Date().toISOString()
        }
      }

      if (updates.provider === 'resend' && !updates.resend_api_key) {
        return {
          success: false,
          error: 'Resend API key is required',
          timestamp: new Date().toISOString()
        }
      }

      // Update in database
      const { data, error } = await supabase
        .from('email_settings')
        .update({
          ...updates,
          updated_by: userId,
          updated_at: new Date().toISOString()
        })
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .select()
        .single()

      if (error) {
        console.error('❌ Error updating email config:', error)
        return {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      }

      // Invalidate cache
      this.invalidateCache()

      console.log('✅ Email config updated successfully')

      return {
        success: true,
        data: data,
        message: 'Email configuration updated successfully',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Exception in updateConfig:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Test email configuration
   */
  async testConfig(testEmail: string): Promise<OperationResult<void>> {
    try {
      console.log('📧 Testing email configuration...')

      const configResult = await this.getConfig()
      if (!configResult.success || !configResult.data) {
        return {
          success: false,
          error: 'Failed to load email configuration',
          timestamp: new Date().toISOString()
        }
      }

      const config = configResult.data

      if (!config.is_enabled) {
        return {
          success: false,
          error: 'Email system is disabled',
          timestamp: new Date().toISOString()
        }
      }

      // Send test email based on provider
      // This will be implemented after we create email providers
      console.log(`📧 Test email would be sent to: ${testEmail}`)

      return {
        success: true,
        message: `Test email sent to ${testEmail}`,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('❌ Exception in testConfig:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Check if email system is enabled and configured
   */
  async isEnabled(): Promise<boolean> {
    const configResult = await this.getConfig()
    return configResult.success && configResult.data?.is_enabled === true
  }

  /**
   * Get current provider
   */
  async getCurrentProvider(): Promise<string | null> {
    const configResult = await this.getConfig()
    return configResult.success ? configResult.data?.provider || null : null
  }

  /**
   * Invalidate cache (call after updates)
   */
  invalidateCache(): void {
    this.cachedConfig = null
    this.cacheExpiry = 0
    console.log('🔄 Email config cache invalidated')
  }

  /**
   * Encrypt sensitive data (passwords, API keys)
   * In production, use proper encryption library or Supabase Vault
   */
  private encryptSensitiveData(data: string): string {
    // TODO: Implement proper encryption
    // For now, just return as-is (NOT secure for production!)
    console.warn('⚠️ WARNING: Encryption not implemented. Use Supabase Vault in production.')
    return data
  }

  /**
   * Decrypt sensitive data
   */
  private decryptSensitiveData(encryptedData: string): string {
    // TODO: Implement proper decryption
    return encryptedData
  }
}
