import { supabase } from '../lib/supabase'
import { createClient } from '@supabase/supabase-js'

interface DatabaseConfig {
  supabase_url: string
  supabase_anon_key: string
  // Table names are now hardcoded to products_new and product_updates for consistency
}

interface WooCommerceConfig {
  base_url: string
  consumer_key: string
  consumer_secret: string
  version: string
  timeout: number
  per_page: number
  verify_ssl: boolean
}

interface SystemSettings {
  id: string
  key: string
  value: any
  description?: string
  category: string
  is_public: boolean
  created_at: string
  updated_at: string
  created_by?: string
}

class SettingsService {
  private async encryptData(data: any): Promise<string> {
    // Simple base64 encoding for now - in production, use proper encryption
    return btoa(JSON.stringify(data))
  }

  private async decryptData(encryptedData: string): Promise<any> {
    try {
      return JSON.parse(atob(encryptedData))
    } catch (error) {
      console.error('Failed to decrypt data:', error)
      return null
    }
  }

  private async getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  }

  // Database Configuration Methods
  async getDatabaseConfig(): Promise<DatabaseConfig | null> {
    try {
      console.log('🔍 SettingsService: Starting getDatabaseConfig')

      // Check if user is authenticated first with timeout
      const authPromise = supabase.auth.getUser()
      const authTimeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Authentication check timed out')), 3000)
      )

      const { data: { user } } = await Promise.race([authPromise, authTimeoutPromise]) as any

      if (!user) {
        console.warn('⚠️ Database config access requires authentication - user not logged in')
        return null
      }

      console.log('✅ SettingsService: User authenticated:', user.id)

      // Add timeout protection for the entire operation
      const configFetch = new Promise(async (resolve, reject) => {
        try {
          console.log('SettingsService: Querying system_settings table')
          const { data, error } = await supabase
            .from('system_settings')
            .select('value')
            .eq('key', 'database_config')
            .order('updated_at', { ascending: false })
            .limit(1)

          if (error) {
            console.log('SettingsService: Query error:', error)
            // Handle specific error cases
            if (error.code === 'PGRST116' || error.message?.includes('no rows returned')) {
              // No configuration found - this is normal for first time setup
              console.log('No database configuration found - first time setup')
              resolve(null)
              return
            }

            if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
              console.error('Permission denied - user may not have admin access:', error)
              reject(new Error(`Permission denied: ${error.message}`))
              return
            }

            // Check if table doesn't exist
            if (error.code === '42P01' || error.message?.includes('relation') && error.message?.includes('does not exist')) {
              console.warn('system_settings table does not exist - need to run setup script')
              reject(new Error('Bảng system_settings chưa được tạo. Vui lòng chạy script setup_admin_settings.sql'))
              return
            }

            console.error('Error fetching database config:', error)
            reject(new Error(`Database query failed: ${error.message}`))
            return
          }

          console.log('SettingsService: Query successful, data:', data ? `Found ${data.length} records` : 'Empty')

          if (data && data.length > 0 && data[0].value) {
            const decryptedData = await this.decryptData(data[0].value)
            console.log('Database config decrypted successfully:', decryptedData ? 'Found' : 'Empty')
            resolve(decryptedData)
          } else {
            console.log('No configuration data found')
            resolve(null)
          }
        } catch (error) {
          console.error('SettingsService: Query exception:', error)
          reject(error)
        }
      })

      // Add timeout (3 seconds - reduced since we have hardcoded fallbacks)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          console.warn('⏰ SettingsService: getDatabaseConfig timeout after 3 seconds - using hardcoded defaults')
          reject(new Error('Database config loading timed out. Using hardcoded defaults.'))
        }, 3000)
      })

      const result = await Promise.race([configFetch, timeoutPromise])
      console.log('SettingsService: getDatabaseConfig completed')
      return result as DatabaseConfig | null

    } catch (error: any) {
      console.warn('SettingsService: getDatabaseConfig failed, using fallback - this is normal if system_settings table is not set up')
      return null // Return null to use fallback config
    }
  }

  async saveDatabaseConfig(config: DatabaseConfig): Promise<void> {
    const userId = await this.getCurrentUserId()
    if (!userId) {
      throw new Error('User not authenticated')
    }

    const encryptedData = await this.encryptData(config)

    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'database_config',
        value: encryptedData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })

    if (error) {
      throw new Error(`Failed to save database config: ${error.message}`)
    }
  }

  async testDatabaseConnection(config: DatabaseConfig): Promise<boolean> {
    try {
      // Create a test client with the provided config
      const testClient = createClient(config.supabase_url, config.supabase_anon_key, {
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'X-Client-Info': 'admin-settings-test'
          }
        }
      })

      // Test connection with timeout protection
      const connectionTest = new Promise(async (resolve, reject) => {
        try {
          // Try to query the products table with a simple query
          const { data, error } = await testClient
            .from('products_new') // Hardcoded for consistency
            .select('id')
            .limit(1)

          if (error) {
            reject(new Error(`Database test failed: ${error.message}`))
          } else {
            resolve({ success: true, data })
          }
        } catch (error) {
          reject(error)
        }
      })

      // Add timeout protection (8 seconds for admin settings)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Database connection test timeout after 8 seconds'))
        }, 8000)
      })

      // Race between connection test and timeout
      await Promise.race([connectionTest, timeoutPromise])

      return true
    } catch (error: any) {
      console.error('Database connection test exception:', error)
      return false
    }
  }

  // WooCommerce Configuration Methods
  async getWooCommerceConfig(): Promise<WooCommerceConfig | null> {
    try {
      // Check if user is authenticated first
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        console.warn('WooCommerce config access requires authentication')
        return null
      }

      const { data, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'woocommerce_config')
        .order('updated_at', { ascending: false })
        .limit(1)

      if (error) {
        // Handle specific error cases
        if (error.code === 'PGRST116' || error.message?.includes('no rows returned')) {
          // No configuration found - this is normal for first time setup
          console.log('No WooCommerce configuration found - first time setup')
          return null
        }

        if (error.code === '42501' || error.message?.includes('permission denied') || error.message?.includes('row-level security')) {
          console.error('Permission denied - user may not have admin access:', error)
          return null
        }

        console.error('Error fetching WooCommerce config:', error)
        return null
      }

      if (data && data.length > 0 && data[0].value) {
        return await this.decryptData(data[0].value)
      }

      return null
    } catch (error) {
      console.error('Exception fetching WooCommerce config:', error)
      return null
    }
  }

  async saveWooCommerceConfig(config: WooCommerceConfig): Promise<void> {
    const userId = await this.getCurrentUserId()
    if (!userId) {
      throw new Error('User not authenticated')
    }

    const encryptedData = await this.encryptData(config)

    const { error } = await supabase
      .from('system_settings')
      .upsert({
        key: 'woocommerce_config',
        value: encryptedData,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })

    if (error) {
      throw new Error(`Failed to save WooCommerce config: ${error.message}`)
    }
  }

  async testWooCommerceConnection(config: WooCommerceConfig): Promise<any> {
    try {
      const startTime = Date.now()

      // Basic auth header
      const auth = btoa(`${config.consumer_key}:${config.consumer_secret}`)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), config.timeout)

      // Test system status endpoint first
      const statusUrl = `${config.base_url}/wp-json/${config.version}/system_status`

      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      const responseTime = Date.now() - startTime

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const systemData = await response.json()

      // Get products count
      const productsUrl = `${config.base_url}/wp-json/${config.version}/products?per_page=1`
      const productsResponse = await fetch(productsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json'
        }
      })

      let productsCount = 0
      if (productsResponse.ok) {
        const totalHeader = productsResponse.headers.get('X-WP-Total')
        productsCount = totalHeader ? parseInt(totalHeader) : 0
      }

      return {
        success: true,
        response_time: responseTime,
        store_info: {
          name: systemData?.settings?.title || 'Unknown',
          version: systemData?.environment?.version || 'Unknown',
          products_count: productsCount
        }
      }
    } catch (error: any) {
      console.error('WooCommerce connection test failed:', error)

      if (error.name === 'AbortError') {
        return { success: false, error: 'Request timeout' }
      }

      return {
        success: false,
        error: error.message || 'Connection failed'
      }
    }
  }

  // General Settings Methods
  async getAllSettings(): Promise<SystemSettings[]> {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .order('updated_at', { ascending: false })

      if (error) {
        throw new Error(`Failed to fetch settings: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Exception fetching all settings:', error)
      return []
    }
  }

  async deleteSetting(category: string): Promise<void> {
    const { error } = await supabase
      .from('system_settings')
      .delete()
      .eq('category', category)

    if (error) {
      throw new Error(`Failed to delete setting: ${error.message}`)
    }
  }

  // Environment Variable Integration
  async getEffectiveConfig(): Promise<{
    database: DatabaseConfig | null
    woocommerce: WooCommerceConfig | null
    source: 'database' | 'environment' | 'mixed'
  }> {
    const dbConfig = await this.getDatabaseConfig()
    const wooConfig = await this.getWooCommerceConfig()

    // Check environment variables
    const envDbConfig = {
      supabase_url: import.meta.env.VITE_SUPABASE_URL || '',
      supabase_anon_key: import.meta.env.VITE_SUPABASE_ANON_KEY || ''
      // Table names are now hardcoded to products_new and product_updates for consistency
    }

    const envWooConfig = {
      base_url: import.meta.env.VITE_WOOCOMMERCE_BASE_URL || '',
      consumer_key: import.meta.env.VITE_WOOCOMMERCE_CONSUMER_KEY || '',
      consumer_secret: import.meta.env.VITE_WOOCOMMERCE_CONSUMER_SECRET || '',
      version: 'wc/v3',
      timeout: 30000,
      per_page: 100,
      verify_ssl: true
    }

    // Determine source and effective config
    const hasEnvDb = envDbConfig.supabase_url && envDbConfig.supabase_anon_key
    const hasEnvWoo = envWooConfig.base_url && envWooConfig.consumer_key && envWooConfig.consumer_secret

    const effectiveDbConfig = hasEnvDb ? envDbConfig : dbConfig
    const effectiveWooConfig = hasEnvWoo ? envWooConfig : wooConfig

    let source: 'database' | 'environment' | 'mixed' = 'database'
    if (hasEnvDb && hasEnvWoo) {
      source = 'environment'
    } else if (hasEnvDb || hasEnvWoo) {
      source = 'mixed'
    }

    return {
      database: effectiveDbConfig,
      woocommerce: effectiveWooConfig,
      source
    }
  }
}

// Create singleton instance
const settingsService = new SettingsService()

// Hook for React components
export const useSettingsService = () => {
  return settingsService
}

export default settingsService
export type { DatabaseConfig, WooCommerceConfig, SystemSettings }