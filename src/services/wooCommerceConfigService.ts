import { supabase } from '../lib/supabase'

export interface WooCommerceConfig {
  consumer_key: string
  consumer_secret: string
  // Có thể thêm các config khác như version, timeout, etc.
  version?: string
  timeout?: number
}

export interface WooCommerceProjectConfig {
  base_url: string
  consumer_key: string
  consumer_secret: string
  version?: string
  timeout?: number
}

export class WooCommerceConfigService {

  /**
   * Lưu WooCommerce config vào Admin Settings
   */
  static async saveWooCommerceConfig(config: WooCommerceConfig): Promise<void> {
    try {
      // Encrypt dữ liệu nhạy cảm
      const encryptedConfig = btoa(JSON.stringify(config))

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          category: 'woocommerce',
          config_data: encryptedConfig,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'category'
        })

      if (error) {
        throw new Error(`Failed to save WooCommerce config: ${error.message}`)
      }

      console.log('✅ WooCommerce config saved successfully')
    } catch (err: any) {
      console.error('❌ Error saving WooCommerce config:', err)
      throw err
    }
  }

  /**
   * Load WooCommerce config từ Admin Settings
   */
  static async getWooCommerceConfig(): Promise<WooCommerceConfig | null> {
    try {
      console.log('🔄 Loading WooCommerce config from database...')

      // Check current user first
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError) {
        console.error('❌ Auth error:', userError.message)
        throw new Error(`Authentication error: ${userError.message}`)
      }

      if (!userData.user) {
        console.error('❌ No authenticated user')
        throw new Error('No authenticated user')
      }

      console.log('✅ User authenticated:', userData.user.email)

      // Check user profile and admin status
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('role, is_active')
        .eq('id', userData.user.id)
        .single()

      if (profileError) {
        console.error('❌ Profile error:', profileError.message)
        throw new Error(`Profile error: ${profileError.message}`)
      }

      console.log('✅ User profile:', profileData)

      if (profileData.role !== 'admin') {
        throw new Error('Access denied: Admin role required')
      }

      // Try to load WooCommerce config
      const { data, error } = await supabase
        .from('system_settings')
        .select('config_data')
        .eq('category', 'woocommerce')
        .order('updated_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('❌ Database error:', error)
        throw new Error(`Database error: ${error.message}`)
      }

      if (!data || data.length === 0) {
        console.log('ℹ️ No WooCommerce config found in system_settings')
        return null
      }

      // Decrypt dữ liệu
      try {
        const decryptedConfig = JSON.parse(atob(data[0].config_data))
        console.log('✅ WooCommerce config loaded successfully')

        return {
          consumer_key: decryptedConfig.consumer_key || '',
          consumer_secret: decryptedConfig.consumer_secret || '',
          version: decryptedConfig.version || 'wc/v3',
          timeout: decryptedConfig.timeout || 10000
        }
      } catch (decryptError) {
        console.error('❌ Decryption error:', decryptError)
        throw new Error('Failed to decrypt config data')
      }

    } catch (err: any) {
      console.error('❌ Error loading WooCommerce config:', err)
      throw err // Re-throw to handle in UI
    }
  }

  /**
   * Test WooCommerce connection với project credentials
   */
  static async testWooCommerceConnection(project: {
    woocommerce_base_url: string;
    woocommerce_consumer_key: string;
    woocommerce_consumer_secret: string;
  }): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      if (!project.woocommerce_consumer_key || !project.woocommerce_consumer_secret) {
        return {
          success: false,
          message: 'Consumer Key hoặc Consumer Secret không hợp lệ'
        }
      }

      // Clean base URL
      const cleanBaseUrl = project.woocommerce_base_url.replace(/\/$/, '')
      const testUrl = `${cleanBaseUrl}/wp-json/wc/v3/system_status`

      // Create basic auth header
      const credentials = btoa(`${project.woocommerce_consumer_key}:${project.woocommerce_consumer_secret}`)

      // AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

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

  /**
   * Get WooCommerce config từ project data (per-project credentials)
   */
  static async getProjectWooConfig(project: {
    woocommerce_base_url: string;
    woocommerce_consumer_key: string;
    woocommerce_consumer_secret: string;
  }): Promise<WooCommerceProjectConfig | null> {
    try {
      if (!project.woocommerce_consumer_key || !project.woocommerce_consumer_secret) {
        console.log('ℹ️ No WooCommerce credentials in project')
        return null
      }

      return {
        base_url: project.woocommerce_base_url,
        consumer_key: project.woocommerce_consumer_key,
        consumer_secret: project.woocommerce_consumer_secret,
        version: 'wc/v3',
        timeout: 10000
      }
    } catch (err: any) {
      console.error('❌ Error getting project WooCommerce config:', err)
      return null
    }
  }

  /**
   * Kiểm tra xem đã có WooCommerce config chưa
   */
  static async hasWooCommerceConfig(): Promise<boolean> {
    try {
      const config = await this.getWooCommerceConfig()
      return config !== null && !!config.consumer_key && !!config.consumer_secret
    } catch (err) {
      return false
    }
  }

  /**
   * Test WooCommerce connection với global config + test URL
   */
  static async testGlobalWooCommerceConnection(testBaseUrl: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      // Get global config
      const globalConfig = await this.getWooCommerceConfig()
      if (!globalConfig) {
        return {
          success: false,
          message: 'Chưa có cấu hình WooCommerce global. Vui lòng cấu hình Consumer Key và Secret trước.'
        }
      }

      if (!globalConfig.consumer_key || !globalConfig.consumer_secret) {
        return {
          success: false,
          message: 'Consumer Key hoặc Consumer Secret không hợp lệ'
        }
      }

      // Clean base URL
      const cleanBaseUrl = testBaseUrl.replace(/\/$/, '')
      const testUrl = `${cleanBaseUrl}/wp-json/wc/v3/system_status`

      // Create basic auth header
      const credentials = btoa(`${globalConfig.consumer_key}:${globalConfig.consumer_secret}`)

      // AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), globalConfig.timeout || 10000)

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

  /**
   * Xóa WooCommerce config (admin only)
   */
  static async deleteWooCommerceConfig(): Promise<void> {
    try {
      const { error } = await supabase
        .from('system_settings')
        .delete()
        .eq('category', 'woocommerce')

      if (error) {
        throw new Error(`Failed to delete WooCommerce config: ${error.message}`)
      }

      console.log('✅ WooCommerce config deleted successfully')
    } catch (err: any) {
      console.error('❌ Error deleting WooCommerce config:', err)
      throw err
    }
  }
}